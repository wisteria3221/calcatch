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
  getUuid: (() => { let n = 0; return () => `uuid-${++n}`; })(),
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
  userEmail: 'me@example.com',
  locked: false,
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
  Session: { getScriptTimeZone: () => 'Asia/Tokyo', getActiveUser: () => ({ getEmail: () => state.userEmail }) },
  LockService: { getUserLock: () => ({
    tryLock: () => { if (state.locked) return false; state.locked = true; return true; },
    releaseLock: () => { state.locked = false; },
  }) },
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
// 登録ボタンのイベント。表示中のカードに埋め込まれた token（＝最後に保存した候補の token）を付ける
const pendingToken = () => { const p = state.cache._m['pending:m1']; return p ? JSON.parse(p).token : ''; };
const regEv = (locale, extra) => Object.assign(ev(locale, extra), { parameters: { messageId: 'm1', token: pendingToken() } });
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
// 初回は、メールを送る前に送信内容への同意を求める（同意するまで Gemini に本文を送らない）
ok(cardText(res).includes('popToRoot') && cardText(res).includes('メールの送信について') && cardText(res).includes('onAcceptDataConsent'),
  'after save → consent card before sending the email');
ok(state.fetchLog.length === 2, 'no extraction call before consent (only the two key checks)');
ok(cardText(res).includes('無料枠に個人情報や機密情報を送らない') && cardText(res).includes('https://calcatch.wisteria.xyz/ja/privacy.html'),
  'consent card explains free-tier terms and links the privacy policy');
res = call('onAcceptDataConsent', ev('ja'));
ok(state.userProps._m.DATA_CONSENT === '1' && cardText(res).includes('見つかった予定'), 'agree → consent saved, back to extraction card');
// allDay=true でも根拠に時刻があれば時刻付きになる
ok(cardText(res).includes('2026/10/25（日）14:00 – 16:00'), 'time recovered from evidence (14:00–16:00), ja format with weekday');
ok(state.fetchLog[0].key === 'BADKEY' && state.fetchLog.slice(1).every((f) => f.key === 'GOODKEY1234'), 'Gemini called with the key being validated, then the saved user key');

// 6. 既存予定と重複 → 警告とチェックオフ
state.calendarEvents = [{ summary: '勉強会', start: { dateTime: '2026-10-25T14:00:00+09:00' }, end: { dateTime: '2026-10-25T16:00:00+09:00' }, description: '' }];
card = call('onGmailMessageOpen', ev('en-US'));
const t = cardText(card);
ok(t.includes('Probably already in your calendar') && t.includes('setSelected(false)'), 'duplicate warned and unchecked (en)');
ok(t.includes('Sun, Oct 25, 2026, 2:00 PM – 4:00 PM'), 'en date format with weekday');
const callsBefore = state.fetchLog.length;
ok(true, `cached: Gemini calls so far ${callsBefore}`);
call('onGmailMessageOpen', ev('ja'));
ok(state.fetchLog.length === callsBefore, 'second open uses cache (no Gemini call)');

// 7. 登録
state.calendarEvents = [];
call('onGmailMessageOpen', ev('ja'));
res = call('onRegisterEvents', regEv('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
const ins = state.inserted[0];
ok(ins && ins.cal === 'primary' && ins.res.start.timeZone === 'Asia/Tokyo' && ins.res.summary === '勉強会', 'event inserted to primary with tz');
ok(ins && ins.res.description.includes('元のメール: https://mail.google.com/mail/u/me@example.com/#all/thread123'), 'description has mail link for the signed-in account');
ok(cardText(res).includes('1件を登録しました') && cardText(res).includes('setOpenLink'), 'result card with link');
res = call('onRegisterEvents', regEv('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
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
ok(!state.userProps._m.DATA_CONSENT, 'removing the key also clears the consent');

// 12. 時刻読み取り
const x = vm.runInContext('extractTimes_', sandbox);
ok(JSON.stringify(x('午後2時半〜4:15 PM')) === '["14:30","16:15"]', 'extractTimes_ mixed formats');
ok(x('所要3時間').length === 0, 'duration not treated as time');

// 13. 設定画面のリンクが表示言語に合わせたページを指す
state.userProps._m.GEMINI_API_KEY = 'K';
state.userProps._m.DATA_CONSENT = '1';
card = call('onOpenSettings', ev('ja'));
ok(cardText(card).includes('https://calcatch.wisteria.xyz/ja/privacy.html') && cardText(card).includes('https://calcatch.wisteria.xyz/ja/terms.html'), 'settings links → Japanese pages (ja)');
card = call('onOpenSettings', ev('en-US'));
ok(cardText(card).includes('https://calcatch.wisteria.xyz/privacy.html') && !cardText(card).includes('/ja/'), 'settings links → English pages (en)');

// 14. 日時の表示（曜日つき・終日・日をまたぐ予定）
const fmtRange = (locale, range) => { sandbox.__r = range; return vm.runInContext(`setLocale_({ commonEventObject: { userLocale: '${locale}' } }); formatRange_(__r, 'Asia/Tokyo')`, sandbox); };
const allDay1 = { allDay: true, start: '2026-10-24T15:00:00Z', end: '2026-10-25T15:00:00Z' };          // 10/25（日）
const allDay3 = { allDay: true, start: '2026-10-24T15:00:00Z', end: '2026-10-27T15:00:00Z' };          // 10/25（日）〜10/27（火）
const overnight = { allDay: false, start: '2026-10-25T13:00:00Z', end: '2026-10-26T01:00:00Z' };      // 10/25 22:00 〜 10/26 10:00
ok(fmtRange('ja', allDay1) === '2026/10/25（日）終日', `all-day (ja): ${fmtRange('ja', allDay1)}`);
ok(fmtRange('ja', allDay3) === '2026/10/25（日） – 2026/10/27（火）終日', `multi-day all-day (ja): ${fmtRange('ja', allDay3)}`);
ok(fmtRange('ja', overnight) === '2026/10/25（日）22:00 – 2026/10/26（月）10:00', `overnight (ja): ${fmtRange('ja', overnight)}`);
ok(fmtRange('en', allDay1) === 'Sun, Oct 25, 2026 (all day)', `all-day (en): ${fmtRange('en', allDay1)}`);
ok(fmtRange('en', allDay3) === 'Sun, Oct 25, 2026 – Tue, Oct 27, 2026 (all day)', `multi-day all-day (en): ${fmtRange('en', allDay3)}`);
ok(fmtRange('en', overnight) === 'Sun, Oct 25, 2026, 10:00 PM – Mon, Oct 26, 2026, 10:00 AM', `overnight (en): ${fmtRange('en', overnight)}`);

// 15. 全角英数字は半角にする（記号・全角スペース・かなはそのまま）
sandbox.__ev = { title: 'ＭＴＧ（第２回）　Ａ会議室', startDate: '2026-10-25', allDay: true, location: 'ビル５Ｆ', description: 'ｚｏｏｍ ＩＤ：１２３' };
const norm = vm.runInContext(`normalizeEvent_(__ev, 'Asia/Tokyo')`, sandbox);
ok(norm.title === 'MTG（第2回）　A会議室', `half-width title: ${norm.title}`);
ok(norm.location === 'ビル5F' && norm.description === 'zoom ID：123', `half-width location/notes: ${norm.location} / ${norm.description}`);

// 16. 抽出結果カードの並び：予定名（チェック）→ 日時 → 場所 → 重複の警告 → メモ
state.calendarEvents = [{ summary: '勉強会', start: { dateTime: '2026-10-25T14:00:00+09:00' }, end: { dateTime: '2026-10-25T16:00:00+09:00' }, description: '' }];
state.geminiResponses.push(geminiOk([{ title: '勉強会', timeEvidence: '10月25日 14:00〜16:00', startDate: '2026-10-25', allDay: false, startTime: '14:00', endTime: '16:00', location: '渋谷', description: '資料は当日配布' }]));
card = call('onReextractEvents', ev('ja'));
const widgets = dump(card).split('CardSection{').find((d) => d.includes('資料は当日配布')) || '';
const pos = ['<b>勉強会</b>', 'Icon.CLOCK', 'Icon.MAP_PIN', '登録済みの可能性が高い', 'Icon.DESCRIPTION'].map((k) => widgets.indexOf(k));
ok(pos.every((p) => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), `event section order title→when→where→warning→notes ${pos.join(',')}`);
const titleRow = widgets.slice(0, widgets.indexOf('Icon.CLOCK'));
ok(titleRow.includes('setSwitchControl') && titleRow.includes('setSelected(false)'), 'checkbox is on the title row (unchecked for duplicate)');
ok(!widgets.startsWith('setHeader'), 'no section header (title is in the body)');
ok(widgets.includes('setIconUrl(https://calcatch.wisteria.xyz/images/warning.png)') && !widgets.includes('⚠'), 'warning row has red warning icon (no ⚠ in text)');
ok(widgets.includes('<font color="#d93025">2026/10/25（日）14:00 – 16:00</font>') && !widgets.includes('setBottomLabel'), 'existing event date shown in red in the text');
ok(widgets.includes('setAltText(日時)') && widgets.includes('setAltText(場所)') && widgets.includes('setAltText(メモ)'), 'icons have alt text from labels');

// 17. 夏時間の切り替え日でも、終日予定の終了日と表示がずれない
const normIn = (e, tz) => { sandbox.__ev = e; return vm.runInContext(`normalizeEvent_(__ev, '${tz}')`, sandbox); };
const fallBack = normIn({ title: 'Fall', startDate: '2026-11-01', allDay: true }, 'America/New_York');
ok(fallBack.end === '2026-11-02T05:00:00.000Z', `all-day end on DST fall-back day is next midnight: ${fallBack.end}`);
// カレンダーから読んだ既存の終日予定（3/8 0:00 EST 〜 3/9 0:00 EDT。この日は 23 時間しかない）
sandbox.__r = { allDay: true, start: '2026-03-08T05:00:00.000Z', end: '2026-03-09T04:00:00.000Z' };
const springText = vm.runInContext(`setLocale_({ commonEventObject: { userLocale: 'en' } }); formatRange_(__r, 'America/New_York')`, sandbox);
ok(springText === 'Sun, Mar 8, 2026 (all day)', `all-day on DST spring-forward day shown as one day: ${springText}`);

// 18. 根拠から時刻を読むときの範囲の判定（全角チルダ・「から」・日付のハイフン）
const fromEvidence = (evidence) => {
  const n = normIn({ title: 'X', timeEvidence: evidence, startDate: '2026-10-25', allDay: true }, 'Asia/Tokyo');
  return (new Date(n.end) - new Date(n.start)) / 60000;
};
ok(fromEvidence('10月25日 14時～16時') === 120, 'fullwidth tilde ～ (U+FF5E) read as range');
ok(fromEvidence('10月25日 14時〜16時') === 120, 'wave dash 〜 (U+301C) read as range');
ok(fromEvidence('10月25日 14時から16時まで') === 120, '「から」 read as range');
ok(fromEvidence('2026-10-25 開場13:30 / 開演14:00') === 120, 'hyphens in the date are not a time range (default 2h)');

// 19. 選んだモデルが見つからない（404）→ 予備モデルで抽出し、「見つからない」と表示
state.userProps._m.GEMINI_MODEL = 'gemini-old';
state.geminiResponses.push({ status: 404, body: { error: { message: 'models/gemini-old is not found' } } });
state.geminiResponses.push(geminiOk([{ title: 'MTG', timeEvidence: '10/26 10:00', startDate: '2026-10-26', allDay: false, startTime: '10:00' }]));
card = call('onReextractEvents', ev('ja'));
ok(cardText(card).includes('選んだモデル（gemini-old）が見つからないため') && !cardText(card).includes('混雑していた'), 'missing model → "not found" note, not "busy"');
state.userProps._m.GEMINI_MODEL = 'gemini-flash-latest';

// 20. 登録がすべて失敗 → 失敗を通知し、候補を残して再試行できる
state.calendarEvents = [];
state.geminiResponses.push(geminiOk([{ title: '勉強会', timeEvidence: '10月25日 14:00〜16:00', startDate: '2026-10-25', allDay: false, startTime: '14:00', endTime: '16:00' }]));
call('onReextractEvents', ev('ja'));
const realInsert = sandbox.Calendar.Events.insert;
sandbox.Calendar.Events.insert = () => { throw new Error('backend error'); };
res = call('onRegisterEvents', regEv('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
ok(cardText(res).includes('登録できませんでした') && !cardText(res).includes('0件を登録'), 'all inserts failed → failure notice');
sandbox.Calendar.Events.insert = realInsert;
res = call('onRegisterEvents', regEv('ja', { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } }));
ok(cardText(res).includes('1件を登録しました'), 'pending kept after total failure, retry succeeds');

// 21. 重複チェックはカレンダーごとに 1 回だけ一覧を取得する
let listCalls = 0;
const realList = sandbox.Calendar.Events.list;
let listOpts = null;
sandbox.Calendar.Events.list = (...a) => { listCalls++; listOpts = a[1]; return realList(...a); };
state.geminiResponses.push(geminiOk([
  { title: 'A', timeEvidence: '10/25 10:00', startDate: '2026-10-25', allDay: false, startTime: '10:00' },
  { title: 'B', timeEvidence: '10/27 10:00', startDate: '2026-10-27', allDay: false, startTime: '10:00' },
  { title: 'C', timeEvidence: '10/30', startDate: '2026-10-30', allDay: true },
]));
call('onReextractEvents', ev('ja'));
ok(listCalls === 1, `one Events.list call per calendar for 3 events: ${listCalls}`);
ok(listOpts.maxResults === 2500 && ['status', 'summary', 'description', 'start', 'end'].every((f) => listOpts.fields.includes(f)),
  `Events.list asks for large pages and only the fields it uses: ${listOpts.fields}`);
sandbox.Calendar.Events.list = realList;

// 22. 開演・開始などの時刻は終了時刻にしない（Gemini が endTime に入れてきても外す）
const minutesOf = (e) => { const n = normIn(Object.assign({ title: 'X', startDate: '2027-02-27', allDay: false }, e), 'Asia/Tokyo'); return (new Date(n.end) - new Date(n.start)) / 60000; };
ok(minutesOf({ timeEvidence: '2027/02/27(土)  15：00開場 16：30開演', startTime: '15:00', endTime: '16:30' }) === 120, '「16：30開演」 is not the end time');
ok(minutesOf({ timeEvidence: '開場15:00 開演16:30', startTime: '15:00', endTime: '16:30' }) === 120, '「開演16:30」 is not the end time');
ok(minutesOf({ timeEvidence: '13:00受付 13:30開始', startTime: '13:00', endTime: '13:30' }) === 120, '「13:30開始」 is not the end time');
ok(minutesOf({ timeEvidence: 'Doors 6:00 PM, show starts 7:00 PM', startTime: '18:00', endTime: '19:00' }) === 120, '"show starts 7:00 PM" is not the end time');
ok(minutesOf({ timeEvidence: '開演16:30 終演19:00', startTime: '16:30', endTime: '19:00' }) === 150, '「終演19:00」 is kept as the end time');
ok(minutesOf({ timeEvidence: '13:00開始〜15:00終了', startTime: '13:00', endTime: '15:00' }) === 120, '「15:00終了」 is kept as the end time');
ok(minutesOf({ timeEvidence: '10月25日 14:00〜16:30', startTime: '14:00', endTime: '16:30' }) === 150, 'plain range end is kept');
ok(minutesOf({ timeEvidence: '14:00から', startTime: '14:00', endTime: '17:00' }) === 180, 'end time not in the evidence is kept');

// 23. 終了時刻がないときの長さは設定で変えられ、キャッシュ済みの結果にもすぐ反映される
state.userProps._m.GEMINI_API_KEY = 'K';
state.calendarEvents = [];
state.geminiResponses.push(geminiOk([{ title: 'BLEACH FES.', timeEvidence: '2027/02/27(土) 15：00開場 16：30開演', startDate: '2027-02-27', allDay: false, startTime: '15:00', endTime: '16:30' }]));
card = call('onReextractEvents', ev('ja'));
ok(cardText(card).includes('2027/02/27（土）15:00 – 17:00'), 'default duration is 2 hours');
card = call('onOpenSettings', ev('ja'));
ok(cardText(card).includes('setFieldName(duration_choice)') && cardText(card).includes('addItem(2時間,2,true)'), 'settings has duration dropdown (2h selected)');
card = call('onOpenSettings', ev('en-US'));
ok(cardText(card).includes('addItem(1 hour,1,false)') && cardText(card).includes('addItem(4 hours,4,false)'), 'duration choices in English');
state.geminiResponses.push({ status: 200, body: {} });  // checkGemini_
res = call('onSaveSettings', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: {
  model_choice: { stringInputs: { value: ['gemini-flash-latest'] } }, duration_choice: { stringInputs: { value: ['3'] } } } } }));
ok(state.userProps._m.DEFAULT_DURATION_HOURS === '3', 'duration saved');
const fetchesBefore = state.fetchLog.length;
ok(cardText(res).includes('2027/02/27（土）15:00 – 18:00') && state.fetchLog.length === fetchesBefore, 'new duration applied to cached result without calling Gemini');
state.geminiResponses.push({ status: 200, body: {} });
call('onSaveSettings', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: {
  model_choice: { stringInputs: { value: ['gemini-flash-latest'] } }, duration_choice: { stringInputs: { value: ['99'] } } } } }));
ok(state.userProps._m.DEFAULT_DURATION_HOURS === '3', 'invalid duration ignored');
state.geminiResponses.push(geminiOk([{ title: '勉強会', timeEvidence: '10月25日 14:00〜16:00', startDate: '2026-10-25', allDay: false, startTime: '14:00', endTime: '16:00' }]));
card = call('onReextractEvents', ev('ja'));
ok(cardText(card).includes('2026/10/25（日）14:00 – 16:00'), 'written end time is not changed by the duration setting');

// 24. 古いカード（別の画面で再抽出する前のもの）からは登録しない
const select0 = { commonEventObject: { userLocale: 'ja', formInputs: { select_0: { stringInputs: { value: ['on'] } } } } };
state.calendarEvents = [];
state.geminiResponses.push(geminiOk([{ title: '古い候補', timeEvidence: '10/25 10:00', startDate: '2026-10-25', allDay: false, startTime: '10:00' }]));
call('onReextractEvents', ev('ja'));
const staleToken = pendingToken();
state.geminiResponses.push(geminiOk([{ title: '新しい候補', timeEvidence: '10/26 10:00', startDate: '2026-10-26', allDay: false, startTime: '10:00' }]));
call('onReextractEvents', ev('ja'));
const insertedBefore = state.inserted.length;
res = call('onRegisterEvents', Object.assign(ev('ja', select0), { parameters: { messageId: 'm1', token: staleToken } }));
ok(cardText(res).includes('有効期限') && state.inserted.length === insertedBefore, 'stale card cannot register (token mismatch)');
res = call('onRegisterEvents', regEv('ja', select0));
ok(state.inserted.length === insertedBefore + 1 && state.inserted[insertedBefore].res.summary === '新しい候補', 'current card registers its own event');

// 25. 終了時刻が開始より前（日をまたぐ）なら翌日の終了にする。長すぎるものは読み違いとして既定の長さ
ok(minutesOf({ timeEvidence: '22:00〜翌1:00', startTime: '22:00', endTime: '01:00' }) === 180, 'overnight end (22:00–01:00) is next day');
ok(minutesOf({ timeEvidence: '13:00〜03:00', startTime: '13:00', endTime: '03:00' }) === 120, 'implausibly long overnight end falls back to default length');

// 26. 読めないカレンダーがあっても、ほかのカレンダーで重複を検出する
const realCalList = sandbox.Calendar.CalendarList.list;
const realEvList = sandbox.Calendar.Events.list;
sandbox.Calendar.CalendarList.list = () => ({ items: [{ id: 'broken' }, { id: 'primary' }] });
sandbox.Calendar.Events.list = (id, opts) => { if (id === 'broken') throw new Error('forbidden'); return realEvList(id, opts); };
state.calendarEvents = [{ summary: '勉強会', start: { dateTime: '2026-10-25T14:00:00+09:00' }, end: { dateTime: '2026-10-25T16:00:00+09:00' }, description: '' }];
state.geminiResponses.push(geminiOk([{ title: '勉強会', timeEvidence: '10月25日 14:00〜16:00', startDate: '2026-10-25', allDay: false, startTime: '14:00', endTime: '16:00' }]));
card = call('onReextractEvents', ev('ja'));
ok(cardText(card).includes('登録済みの可能性が高い'), 'duplicate still detected when one calendar fails');
sandbox.Calendar.CalendarList.list = realCalList;
sandbox.Calendar.Events.list = realEvList;

// 27. 新しいキーを保存したら同意を取り直す。同意するまでメールの内容を送らない
state.geminiResponses.push({ status: 200, body: {} });  // checkGemini_
res = call('onSaveSettings', ev('ja', { commonEventObject: { userLocale: 'ja', formInputs: {
  api_key: { stringInputs: { value: ['NEWKEY5678'] } }, model_choice: { stringInputs: { value: ['gemini-flash-latest'] } } } } }));
ok(!state.userProps._m.DATA_CONSENT && cardText(res).includes('メールの送信について'), 'new key → consent asked again');
const fetchesBeforeOpen = state.fetchLog.length;
card = call('onReextractEvents', ev('en-US'));
ok(cardText(card).includes('About sending your email') && cardText(card).includes('Agree and continue') && state.fetchLog.length === fetchesBeforeOpen,
  'no consent → consent card (en), Gemini not called');
state.userProps._m.DATA_CONSENT = '1';

// 28. 元のメールへのリンク：メールアドレスが取れないときはアカウント番号 0 にする
ok(vm.runInContext(`mailLink_('t1')`, sandbox) === 'https://mail.google.com/mail/u/me@example.com/#all/t1', 'mail link uses the account email');
state.userEmail = '';
ok(vm.runInContext(`mailLink_('t1')`, sandbox) === 'https://mail.google.com/mail/u/0/#all/t1', 'mail link falls back to u/0 without an email');
state.userEmail = 'me@example.com';

// 29. Pro は選択肢に出さない
card = call('onOpenSettings', ev('ja'));
ok(!cardText(card).includes('gemini-pro-latest') && !cardText(card).includes('高精度'), 'Pro model is not offered');

// 30. 二重登録の防止：登録の前に候補を確保し、処理中の押下は待たせる
state.calendarEvents = [];
state.geminiResponses.push(geminiOk([{ title: '連打テスト', timeEvidence: '10/25 10:00', startDate: '2026-10-25', allDay: false, startTime: '10:00' }]));
call('onReextractEvents', ev('ja'));
const realInsert2 = sandbox.Calendar.Events.insert;
let pendingDuringInsert = 'unset';
sandbox.Calendar.Events.insert = (r, c) => { pendingDuringInsert = state.cache._m['pending:m1']; return realInsert2(r, c); };
const insertedBefore2 = state.inserted.length;
state.locked = true;  // 別の登録処理が実行中
res = call('onRegisterEvents', regEv('ja', select0));
ok(cardText(res).includes('登録の処理中') && state.inserted.length === insertedBefore2, 'register while another is running → busy notice, nothing added');
state.locked = false;
res = call('onRegisterEvents', regEv('ja', select0));
ok(state.inserted.length === insertedBefore2 + 1 && pendingDuringInsert === undefined, 'candidates are claimed before inserting');
ok(!state.locked, 'lock released after registering');
sandbox.Calendar.Events.insert = realInsert2;

// 31. 中止された予定（status: cancelled）は重複の照合に使わない
state.calendarEvents = [{ status: 'cancelled', summary: '中止テスト', start: { dateTime: '2026-10-25T10:00:00+09:00' }, end: { dateTime: '2026-10-25T12:00:00+09:00' }, description: '' }];
state.geminiResponses.push(geminiOk([{ title: '中止テスト', timeEvidence: '10/25 10:00〜12:00', startDate: '2026-10-25', allDay: false, startTime: '10:00', endTime: '12:00' }]));
card = call('onReextractEvents', ev('ja'));
ok(!cardText(card).includes('登録済みの可能性が高い') && cardText(card).includes('setSelected(true)'), 'cancelled event is not treated as a duplicate');
state.calendarEvents[0].status = 'confirmed';
card = call('onGmailMessageOpen', ev('ja'));  // 抽出結果はキャッシュを使い、照合だけやり直す
ok(cardText(card).includes('登録済みの可能性が高い'), 'same event with status confirmed is a duplicate');
state.calendarEvents = [];

const total = (process.exitCode === 1) ? 'FAILED' : 'ALL PASSED';
console.log(`\n${total}`);
