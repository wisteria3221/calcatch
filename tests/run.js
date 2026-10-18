// Apps Script のサービス（CardService / PropertiesService / CacheService / Calendar / GmailApp /
// UrlFetchApp / Utilities）を模擬して、CalCatch の各フローを Node で通しで動かすテスト。
// 実行: npm test   （src/ 以下の .gs を vm で読み込む。失敗があれば終了コード 1）
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { DateTime } = require('luxon');

const SRC = process.argv[2] || path.join(__dirname, '..', 'src');
const files = ['i18n.gs', 'gemini.gs', 'calendar.gs', 'ui.gs', 'Code.gs'];

// ---- Card builder mock: records calls ----
function builder(type) {
  const calls = [];
  const p = new Proxy({}, {
    get(_, k) {
      if (k === 'build') return () => ({ type, calls });
      if (k === '__type') return type;
      if (k === '__calls') return calls;
      return (...args) => { calls.push([k, args]); return p; };
    },
  });
  return p;
}
const CardService = new Proxy({}, {
  get(_, k) {
    if (typeof k === 'string' && k.startsWith('new')) return () => builder(k.slice(3));
    return new Proxy({}, { get: (_, v) => `${String(k)}.${String(v)}` });
  },
});

// ---- Utilities mock (subset of Java SimpleDateFormat) ----
const toLuxon = (fmt) => fmt
  .replace(/'([^']*)'/g, "'$1'")
  .replace(/EEE/g, 'ccc').replace(/yyyy/g, 'yyyy').replace(/a/g, 'a');
const Utilities = {
  formatDate: (d, tz, fmt) => DateTime.fromJSDate(d, { zone: tz }).setLocale('en').toFormat(toLuxon(fmt)),
  parseDate: (s, tz, fmt) => {
    const dt = DateTime.fromFormat(s, fmt, { zone: tz });
    if (!dt.isValid) throw new Error(`parseDate failed: ${s} / ${fmt}`);
    return dt.toJSDate();
  },
  sleep: () => {},
};

function props() {
  const m = {};
  return {
    getProperty: (k) => (k in m ? m[k] : null),
    setProperty: (k, v) => { m[k] = v; },
    deleteProperty: (k) => { delete m[k]; },
    _m: m,
  };
}
function cache() {
  const m = {};
  return { get: (k) => (k in m ? m[k] : null), put: (k, v) => { m[k] = v; }, remove: (k) => { delete m[k]; }, _m: m };
}

// ---- Scenario state ----
const state = {
  userProps: props(),
  cache: cache(),
  geminiResponses: [],   // queue of {status, body}
  fetchLog: [],
  calendarEvents: [],    // existing events on primary
  inserted: [],
};

const message = {
  getDate: () => new Date('2026-10-18T01:00:00Z'),
  getPlainBody: () => '10月25日（土）14時〜16時 勉強会 @渋谷',
  getFrom: () => 'a@example.com',
  getSubject: () => '勉強会のご案内',
  getThread: () => ({ getId: () => 'thread123' }),
};

const sandbox = {
  console,
  CardService,
  Utilities,
  Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
  PropertiesService: { getUserProperties: () => state.userProps },
  CacheService: { getUserCache: () => state.cache },
  GmailApp: { setCurrentMessageAccessToken: () => {}, getMessageById: () => message },
  UrlFetchApp: {
    fetch: (url, opts) => {
      state.fetchLog.push({ url, key: opts.headers['x-goog-api-key'] });
      const r = state.geminiResponses.shift() || { status: 500, body: {} };
      return { getResponseCode: () => r.status, getContentText: () => JSON.stringify(r.body) };
    },
  },
  Calendar: {
    CalendarList: {
      get: () => ({ timeZone: 'Asia/Tokyo' }),
      list: () => ({ items: [{ id: 'primary' }] }),
    },
    Events: {
      list: () => ({ items: state.calendarEvents }),
      insert: (res, cal) => { state.inserted.push({ res, cal }); return { htmlLink: 'https://www.google.com/calendar/event?eid=x' }; },
    },
  },
};
vm.createContext(sandbox);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });

// ---- helpers ----
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) process.exitCode = 1; };
// 入れ子のビルダー（Proxy）も含めて、記録した呼び出しを文字列にする
function dump(v, depth = 0) {
  if (depth > 20) return '…';
  if (v && typeof v === 'object' && v.__calls) {
    return `${v.__type}{` + v.__calls.map(([k, a]) => `${k}(${a.map((x) => dump(x, depth + 1)).join(',')})`).join(' ') + '}';
  }
  if (v && typeof v === 'object' && Array.isArray(v.calls) && v.type) {
    return `${v.type}{` + v.calls.map(([k, a]) => `${k}(${a.map((x) => dump(x, depth + 1)).join(',')})`).join(' ') + '}';
  }
  if (Array.isArray(v)) return '[' + v.map((x) => dump(x, depth + 1)).join(',') + ']';
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const cardText = (card) => dump(card);
const geminiOk = (events) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({ events }) }] } }] } });
const ev = (locale, extra = {}) => Object.assign({
  commonEventObject: { userLocale: locale, formInputs: {} },
  gmail: { messageId: 'm1', accessToken: 't' },
  parameters: { messageId: 'm1' },
}, extra);
const call = (name, e) => { sandbox.__e = e; return vm.runInContext(`${name}(__e)`, sandbox); };

// 1. i18n キーが ja / en で揃っている
const M = vm.runInContext('MESSAGES', sandbox);
const missing = Object.keys(M.ja).filter((k) => !(k in M.en)).concat(Object.keys(M.en).filter((k) => !(k in M.ja)));
ok(missing.length === 0, `i18n keys match (${Object.keys(M.ja).length} keys) ${missing.join(',')}`);

// 2. ソース中で使われている t_('key') がすべて定義済み
const allSrc = files.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const used = [...allSrc.matchAll(/t_\('([A-Za-z0-9]+)'/g)].map((m) => m[1]);
const keysInChoices = [...allSrc.matchAll(/(?:nameKey|labelKey): '([A-Za-z0-9]+)'/g)].map((m) => m[1]);
const undef = [...new Set(used.concat(keysInChoices))].filter((k) => !(k in M.ja));
ok(undef.length === 0, `all t_() keys defined ${undef.join(',')}`);

// 3. キー未設定でメールを開く → 初回設定カード（API を呼ばない）
let card = call('onGmailMessageOpen', ev('ja'));
ok(cardText(card).includes('API キーを設定してください') && state.fetchLog.length === 0, 'no key → setup card (ja), no Gemini call');
card = call('onGmailMessageOpen', ev('en-US'));
ok(cardText(card).includes('Set up your API key'), 'no key → setup card (en)');

// 4. 設定で不正なキーを保存 → 保存しない
state.geminiResponses.push({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
let res = call('onSaveSettings', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: {
  api_key: { stringInputs: { value: ['BADKEY'] } }, model_choice: { stringInputs: { value: ['gemini-flash-latest'] } } } } }));
ok(cardText(res).includes('API キーが正しくないため') && !state.userProps._m.GEMINI_API_KEY, 'invalid key rejected and not saved');

// 5. 正しいキーを保存 → 保存して、そのメールの抽出結果に戻る
state.geminiResponses.push({ status: 200, body: {} });  // checkGemini_
state.geminiResponses.push(geminiOk([{ title: '勉強会', timeEvidence: '10月25日（土）14時〜16時', startDate: '2026-10-25', allDay: true, location: '渋谷' }]));
res = call('onSaveSettings', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: {
  api_key: { stringInputs: { value: [' GOODKEY1234 '] } }, model_choice: { stringInputs: { value: ['gemini-flash-latest'] } } } } }));
ok(state.userProps._m.GEMINI_API_KEY === 'GOODKEY1234', 'valid key saved (trimmed)');
ok(cardText(res).includes('popToRoot') && cardText(res).includes('見つかった予定'), 'after save → back to extraction card');
// allDay=true でも根拠に時刻があれば時刻付きになる
ok(cardText(res).includes('2026/10/25 14:00 – 16:00'), 'time recovered from evidence (14:00–16:00), ja format');
ok(state.fetchLog[0].key === 'BADKEY' && state.fetchLog.slice(1).every((f) => f.key === 'GOODKEY1234'), 'Gemini called with the key being validated, then the saved user key');

// 6. 既存予定と重複 → 警告とチェックオフ
state.calendarEvents = [{ summary: '勉強会', start: { dateTime: '2026-10-25T14:00:00+09:00' }, end: { dateTime: '2026-10-25T16:00:00+09:00' }, description: '' }];
card = call('onGmailMessageOpen', ev('en-US'));
const t = cardText(card);
ok(t.includes('Probably already in your calendar') && t.includes('setSelected(false)'), 'duplicate warned and unchecked (en)');
ok(t.includes('Oct 25, 2026 2:00 PM – 4:00 PM'), 'en date format');
const callsBefore = state.fetchLog.length;
ok(true, `cached: Gemini calls so far ${callsBefore}`);
call('onGmailMessageOpen', ev('ja'));
ok(state.fetchLog.length === callsBefore, 'second open uses cache (no Gemini call)');

// 7. 登録
state.calendarEvents = [];
call('onGmailMessageOpen', ev('ja'));
res = call('onRegisterEvents', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
const ins = state.inserted[0];
ok(ins && ins.cal === 'primary' && ins.res.start.timeZone === 'Asia/Tokyo' && ins.res.summary === '勉強会', 'event inserted to primary with tz');
ok(ins && ins.res.description.includes('元のメール: https://mail.google.com/mail/u/0/#all/thread123'), 'description has mail link');
ok(cardText(res).includes('1件を登録しました') && cardText(res).includes('setOpenLink'), 'result card with link');
res = call('onRegisterEvents', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
ok(cardText(res).includes('有効期限'), 'second register blocked (pending cleared)');

// 8. 混雑 → 予備モデルで抽出し、補足を表示
state.geminiResponses.push({ status: 503, body: { error: { message: 'overloaded' } } }, { status: 503, body: {} }, { status: 503, body: {} });
state.geminiResponses.push(geminiOk([{ title: 'MTG', timeEvidence: '10/26 10:00', startDate: '2026-10-26', allDay: false, startTime: '10:00' }]));
card = call('onReextractEvents', ev('ja'));
ok(cardText(card).includes('選んだモデル（標準）が混雑していたため、軽量モデルで抽出しました。'), 'fallback note shown with friendly names');

// 9. 上限エラー → 利用者向けの文言
for (let i = 0; i < 6; i++) state.geminiResponses.push({ status: 429, body: { error: { message: 'quota exceeded' } } });
card = call('onReextractEvents', ev('en-US'));
ok(cardText(card).includes('usage limit'), 'quota error message (en)');

// 10. 存在しないモデルを直接入力 → 保存しない
state.geminiResponses.push({ status: 404, body: { error: { message: 'models/foo is not found' } } });
res = call('onSaveSettings', ev('ja', { parameters: { messageId: '' }, commonEventObject: { userLocale: 'ja', formInputs: {
  model_choice: { stringInputs: { value: ['custom'] } }, custom_model: { stringInputs: { value: ['models/foo'] } } } } }));
ok(cardText(res).includes('このモデルは使えない') && state.userProps._m.GEMINI_MODEL === 'gemini-flash-latest', 'unknown model rejected');

// 11. 設定カード（キー末尾表示、言語）・ホーム・キー削除
card = call('onOpenSettings', ev('ja'));
ok(cardText(card).includes('末尾 1234') && cardText(card).includes('現在の設定: 標準'), 'settings shows masked key and friendly model name');
ok(!cardText(card).includes('GOODKEY1234'), 'full key never rendered');
card = call('onHomepage', { commonEventObject: { userLocale: 'en' } });
ok(cardText(card).includes('Open an email'), 'homepage (en)');
res = call('onRemoveApiKey', ev('ja'));
ok(!state.userProps._m.GEMINI_API_KEY && cardText(res).includes('削除しました'), 'API key removed');

// 12. 時刻読み取り
const x = vm.runInContext('extractTimes_', sandbox);
ok(JSON.stringify(x('午後2時半〜4:15 PM')) === '["14:30","16:15"]', 'extractTimes_ mixed formats');
ok(x('所要3時間').length === 0, 'duration not treated as time');

// 13. 設定画面のリンクが表示言語に合わせたページを指す
state.userProps._m.GEMINI_API_KEY = 'K';
card = call('onOpenSettings', ev('ja'));
ok(cardText(card).includes('https://calcatch.wisteria.xyz/ja/privacy.html') && cardText(card).includes('https://calcatch.wisteria.xyz/ja/terms.html'), 'settings links → Japanese pages (ja)');
card = call('onOpenSettings', ev('en-US'));
ok(cardText(card).includes('https://calcatch.wisteria.xyz/privacy.html') && !cardText(card).includes('/ja/'), 'settings links → English pages (en)');

const total = (process.exitCode === 1) ? 'FAILED' : 'ALL PASSED';
console.log(`\n${total}`);
