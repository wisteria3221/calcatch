/**
 * Marketplace 掲載用のスクリーンショット（1280×800）を作る。
 * カードの構成と文言は src/ui.gs・src/i18n.gs に合わせている。UI や文言を変えたら、ここも合わせて作り直す。
 * メールと予定はすべて架空のもの。
 *
 *   node marketplace/screenshots/build.js
 *
 * 出力：marketplace/screenshots/{en,ja}/1-events.png など
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = __dirname;
const ICON = fs.readFileSync(path.join(__dirname, '../../docs/images/icon.svg'), 'utf8');

const ICONS = {
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  notes: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  caret: 'M7 10l5 5 5-5z',
};
const svg = (name, color) =>
  `<svg class="ic" viewBox="0 0 24 24"><path fill="${color || '#5f6368'}" d="${ICONS[name]}"/></svg>`;

// ---------------------------------------------------------------------------
// 文言と架空のデータ
// ---------------------------------------------------------------------------

const T = {
  ja: {
    headlines: [
      ['メールを開くだけで、予定が見つかる', '本文の日時・場所を Gemini が読み取ります。チェックした予定を Google カレンダーに登録できます。'],
      ['登録済みの予定を知らせて、二重登録を防ぐ', 'カレンダーに同じ予定や似た予定があれば赤で警告し、最初からチェックを外しておきます。'],
      ['登録した予定には、元のメールへのリンク付き', 'あとから予定を見返したときも、元のメールにすぐ戻れます。'],
      ['ご自身の Gemini API キーで動作', 'CalCatch 独自のサーバーはありません。モデルや、終了時刻がないときの予定の長さも選べます。'],
    ],
    mail: {
      subject: '【ご案内】秋の地域交流会と事前説明会について',
      from: 'みどり町 地域交流会 事務局',
      addr: 'events@example.com',
      date: '10月19日 10:12',
      body: [
        'みなさま',
        'いつもお世話になっております。地域交流会 事務局です。',
        '今年も秋の地域交流会を開催します。お誘い合わせのうえご参加ください。',
        '■ 秋の地域交流会<br>日時：11月14日（土）13:00〜16:00<br>会場：みどり町コミュニティセンター 2F ホール<br>参加費：500円（当日受付）　※上履きをお持ちください',
        'あわせて、当日のボランティアの方向けに事前説明会を行います。<br>■ 事前説明会<br>日時：11月5日（木）19:00〜20:00<br>場所：オンライン（Google Meet）',
        'どうぞよろしくお願いいたします。',
      ],
    },
    events: [
      { title: '事前説明会（地域交流会）', when: '2026/11/05（木）19:00 – 20:00', where: 'オンライン（Google Meet）' },
      { title: '秋の地域交流会', when: '2026/11/14（土）13:00 – 16:00', where: 'みどり町コミュニティセンター 2F ホール', notes: '参加費 500円（当日受付）。上履きを持参。' },
    ],
    existing: { title: '地域交流会 事前説明会', when: '2026/11/05（木）19:00 – 20:00' },
    ui: {
      foundTitle: '見つかった予定', foundSubtitle: (n) => `${n}件・登録するものにチェックを入れてください`,
      warnSame: '登録済みの可能性が高い予定', add: 'カレンダーに登録', reextract: '再抽出',
      resultTitle: '登録結果', resultAdded: '登録済み', openCalendar: 'Google カレンダーを開く', addedCount: '2件を登録しました',
      originalEmail: '元のメール',
      settingsTitle: '設定', apiKeySection: 'Gemini API キー', apiKeyInput: 'API キー', apiKeyHint: '設定済み（末尾 x7Qk）。変更するときだけ入力してください',
      getApiKey: 'API キーを発行する（Google AI Studio）', removeApiKey: 'API キーを削除',
      dataNotice: 'メール本文は、あなたの API キーを使って Gemini API に送信されます。Gemini API の無料枠では、送信した内容が Google の製品改善に使われ、人が読む場合もあります。メールには個人情報が含まれることが多いため、課金を有効にした API キー（有料枠）をおすすめします。',
      modelSection: 'Gemini のモデル', modelSelect: '使用するモデル', modelValue: '標準（おすすめ）：速さと精度のバランスがよい',
      durationSection: '予定の長さ', durationSelect: '終了時刻が書かれていないとき', durationValue: '1時間',
      save: '保存',
      eventDetail: '予定の詳細',
    },
  },
  en: {
    headlines: [
      ['Open an email. CalCatch finds the events.', 'Gemini reads the dates, times and places in the email. Add the ones you check to Google Calendar.'],
      ['Warns you before you add an event twice', 'Events that look already in your calendar are marked in red and left unchecked.'],
      ['Every event links back to the original email', 'When you look at the event later, the email it came from is one click away.'],
      ['Runs on your own Gemini API key', 'There is no CalCatch server. Choose the model and how long events without an end time should be.'],
    ],
    mail: {
      subject: 'Autumn Community Meetup & volunteer info session',
      from: 'Greenfield Community Events',
      addr: 'events@example.com',
      date: 'Oct 19, 10:12 AM',
      body: [
        'Hi everyone,',
        'Our Autumn Community Meetup is coming up again this year. Bring your friends and family!',
        '<b>Autumn Community Meetup</b><br>Date: Saturday, November 14, 1:00–4:00 PM<br>Place: Greenfield Community Center, Hall 2F<br>Admission: $5 at the door. Please bring indoor shoes.',
        'If you are volunteering on the day, please join the info session beforehand:<br><b>Volunteer info session</b><br>Date: Thursday, November 5, 7:00–8:00 PM<br>Place: Online (Google Meet)',
        'See you there!<br>Greenfield Community Events',
      ],
    },
    events: [
      { title: 'Volunteer info session', when: 'Thu, Nov 5, 2026, 7:00 PM – 8:00 PM', where: 'Online (Google Meet)' },
      { title: 'Autumn Community Meetup', when: 'Sat, Nov 14, 2026, 1:00 PM – 4:00 PM', where: 'Greenfield Community Center, Hall 2F', notes: 'Admission $5 at the door. Bring indoor shoes.' },
    ],
    existing: { title: 'Meetup volunteer info session', when: 'Thu, Nov 5, 2026, 7:00 PM – 8:00 PM' },
    ui: {
      foundTitle: 'Events found', foundSubtitle: (n) => `${n} found · check the ones to add`,
      warnSame: 'Probably already in your calendar', add: 'Add to Calendar', reextract: 'Re-extract',
      resultTitle: 'Result', resultAdded: 'Added', openCalendar: 'Open Google Calendar', addedCount: 'Added 2 event(s)',
      originalEmail: 'Original email',
      settingsTitle: 'Settings', apiKeySection: 'Gemini API key', apiKeyInput: 'API key', apiKeyHint: 'Saved (ends with x7Qk). Enter a key only to change it.',
      getApiKey: 'Get an API key (Google AI Studio)', removeApiKey: 'Remove API key',
      dataNotice: 'Email content is sent to the Gemini API using your API key. On the Gemini API free tier, content you send is used to improve Google products and may be read by human reviewers. Because emails often contain personal information, we recommend an API key with billing enabled (paid tier).',
      modelSection: 'Gemini model', modelSelect: 'Model', modelValue: 'Standard (recommended): balanced speed and accuracy',
      durationSection: 'Event length', durationSelect: 'When no end time is given', durationValue: '1 hour',
      save: 'Save',
      eventDetail: 'Event details',
    },
  },
};

// ---------------------------------------------------------------------------
// 部品
// ---------------------------------------------------------------------------

function mailPane(m) {
  return `<div class="mail">
    <div class="subject">${m.subject}</div>
    <div class="from"><div class="avatar">${m.from[0]}</div>
      <div><b>${m.from}</b> <span class="muted">&lt;${m.addr}&gt;</span><div class="muted small">${m.date}</div></div></div>
    <div class="body">${m.body.map((p) => `<p>${p}</p>`).join('')}</div>
  </div>`;
}

function checkbox(on) {
  return on ? `<span class="cb on">${svg('check', '#fff')}</span>` : '<span class="cb"></span>';
}

function eventSection(ev, u, opts) {
  const warn = opts.existing ? `<div class="row warnrow">${svg('warn', '#d93025')}
      <div class="red"><b>${u.warnSame}</b><br>${opts.existing.title}<br>${opts.existing.when}</div></div>` : '';
  return `<div class="section">
    <div class="row title"><div><b>${ev.title}</b></div>${checkbox(!opts.existing)}</div>
    <div class="row">${svg('clock')}<div>${ev.when}</div></div>
    ${ev.where ? `<div class="row">${svg('pin')}<div>${ev.where}</div></div>` : ''}
    ${warn}
    ${ev.notes ? `<div class="row">${svg('notes')}<div class="muted">${ev.notes}</div></div>` : ''}
  </div>`;
}

function panel(inner, footer, cls) {
  return `<div class="panel ${cls || ''}">
    <div class="addon"><span class="logo">${ICON}</span>CalCatch</div>
    <div class="card">${inner}</div>
    ${footer ? `<div class="footer">${footer}</div>` : ''}
  </div>`;
}

function eventsCard(d, withDuplicate) {
  const u = d.ui;
  const sections = d.events.map((ev, i) =>
    eventSection(ev, u, { existing: withDuplicate && i === 0 ? d.existing : null })).join('');
  return panel(
    `<div class="header"><div class="h1">${u.foundTitle}</div><div class="sub">${u.foundSubtitle(d.events.length)}</div></div>${sections}`,
    `<span class="btn filled">${u.add}</span><span class="btn text">${u.reextract}</span>`);
}

function resultCard(d) {
  const u = d.ui;
  const items = d.events.map((ev) => `<div class="item"><div class="toplabel">${u.resultAdded}</div>
    <div>${ev.title}</div><div class="toplabel">${ev.when}</div></div>`).join('');
  return panel(`<div class="header"><div class="h1">${u.resultTitle}</div></div>
    <div class="section">${items}<span class="btn text left">${u.openCalendar}</span></div>`);
}

function settingsCard(d) {
  const u = d.ui;
  return panel(`<div class="header"><div class="h1">${u.settingsTitle}</div></div>
    <div class="section"><div class="sechead">${u.apiKeySection}</div>
      <div class="input"><div class="label">${u.apiKeyInput}</div></div>
      <div class="hint">${u.apiKeyHint}</div>
      <span class="btn text left">${u.getApiKey}</span><br><span class="btn text left">${u.removeApiKey}</span>
      <p class="muted small">${u.dataNotice}</p></div>
    <div class="section"><div class="sechead">${u.modelSection}</div>
      <div class="input select"><div class="label">${u.modelSelect}</div><div>${u.modelValue}</div>${svg('caret')}</div></div>
    <div class="section"><div class="sechead">${u.durationSection}</div>
      <div class="input select"><div class="label">${u.durationSelect}</div><div>${u.durationValue}</div>${svg('caret')}</div></div>`,
  `<span class="btn filled">${u.save}</span>`, 'settings');
}

/** 登録した予定の詳細（説明欄に元のメールへのリンク） */
function eventDetail(d) {
  const ev = d.events[1];
  const u = d.ui;
  return `<div class="mail detail">
    <div class="muted small">${u.eventDetail}</div>
    <div class="evtitle"><span class="chip"></span>${ev.title}</div>
    <div class="row">${svg('clock')}<div>${ev.when}</div></div>
    <div class="row">${svg('pin')}<div>${ev.where}</div></div>
    <div class="row">${svg('notes')}<div>${ev.notes}<br><br>${u.originalEmail}: <span class="link">https://mail.google.com/mail/u/you@example.com/#all/19a3f2c8d4e5b6a7</span></div></div>
  </div>
  <div class="toast">${u.addedCount}</div>`;
}

// ---------------------------------------------------------------------------
// ページ
// ---------------------------------------------------------------------------

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; width: 1280px; height: 800px; overflow: hidden;
  font-family: "Helvetica Neue", Arial, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif;
  color: #202124; background: linear-gradient(160deg, #e8f0fe 0%, #f8fbff 60%, #fef7e0 100%); }
.top { height: 150px; padding: 36px 80px 0; }
.top h1 { margin: 0 0 12px; font-size: 36px; font-weight: 700; color: #174ea6; letter-spacing: .01em; }
.top p { margin: 0; font-size: 19px; color: #3c4043; line-height: 1.5; }
.window { position: absolute; left: 80px; right: 80px; top: 150px; bottom: 0;
  background: #fff; border-radius: 14px 14px 0 0; box-shadow: 0 8px 32px rgba(60,64,67,.22); display: flex; overflow: hidden; }
.mail { flex: 1; padding: 28px 36px; font-size: 14.5px; line-height: 1.6; position: relative; }
.subject { font-size: 21px; margin-bottom: 18px; }
.from { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
.avatar { width: 38px; height: 38px; border-radius: 50%; background: #34a853; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex: none; }
.body p { margin: 0 0 12px; }
.muted { color: #5f6368; }
.small { font-size: 12.5px; }
.red { color: #d93025; }
.panel { width: 380px; border-left: 1px solid #dadce0; display: flex; flex-direction: column; font-size: 14px; line-height: 1.45; background: #fff; }
.addon { height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; font-size: 16px; border-bottom: 1px solid #dadce0; }
.logo svg { width: 24px; height: 24px; display: block; }
.card { flex: 1; overflow: hidden; }
.header { padding: 16px 16px 10px; }
.h1 { font-size: 16px; font-weight: 500; }
.sub { font-size: 13px; color: #5f6368; margin-top: 2px; }
.section { border-top: 1px solid #e8eaed; padding: 10px 16px 6px; }
.sechead { font-size: 13px; font-weight: 600; color: #5f6368; margin: 2px 0 10px; }
.row { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 8px; }
.row.title { justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ic { width: 20px; height: 20px; flex: none; margin-top: 0; }
.cb { width: 18px; height: 18px; border: 2px solid #5f6368; border-radius: 2px; flex: none; display: flex; align-items: center; justify-content: center; }
.cb.on { background: #1a73e8; border-color: #1a73e8; }
.cb .ic { width: 16px; height: 16px; }
.footer { border-top: 1px solid #dadce0; padding: 12px 16px; display: flex; gap: 8px; box-shadow: 0 -2px 6px rgba(60,64,67,.08); }
.btn { display: inline-block; padding: 8px 18px; border-radius: 4px; font-weight: 500; font-size: 14px; }
.btn.filled { background: #1a73e8; color: #fff; }
.btn.text { color: #1a73e8; }
.btn.left { padding-left: 0; }
.item { margin-bottom: 12px; }
.toplabel { font-size: 12px; color: #5f6368; }
.input { border: 1px solid #80868b; border-radius: 4px; padding: 6px 12px; min-height: 44px; position: relative; margin-bottom: 4px; }
.input .label { font-size: 11.5px; color: #5f6368; }
.input.select { padding-right: 36px; margin-bottom: 10px; }
.input.select > div:not(.label) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.settings .section { padding-top: 8px; padding-bottom: 2px; }
.settings .btn.text { padding-top: 4px; padding-bottom: 4px; }
.settings p.small { font-size: 12px; line-height: 1.4; }
.input.select .ic { position: absolute; right: 8px; top: 12px; }
.hint { font-size: 12px; color: #5f6368; margin: 0 0 6px 12px; }
p.small { margin: 6px 0 4px; line-height: 1.5; }
.detail { padding-top: 36px; font-size: 15px; }
.detail .row { margin-bottom: 16px; gap: 18px; }
.detail .ic { width: 22px; height: 22px; }
.evtitle { font-size: 24px; margin: 10px 0 22px; display: flex; align-items: center; gap: 14px; }
.chip { width: 16px; height: 16px; border-radius: 4px; background: #039be5; }
.link { color: #1a73e8; text-decoration: underline; word-break: break-all; }
.toast { position: absolute; left: 32px; bottom: 28px; background: #323232; color: #fff; padding: 14px 22px; border-radius: 4px; font-size: 14px; box-shadow: 0 3px 10px rgba(0,0,0,.25); }
`;

function page(lang, n, content) {
  const [h, p] = T[lang].headlines[n];
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${CSS}</style>
<body><div class="top"><h1>${h}</h1><p>${p}</p></div><div class="window">${content}</div></body></html>`;
}

const SHOTS = [
  ['1-events', (d) => mailPane(d.mail) + eventsCard(d, false)],
  ['2-duplicate', (d) => mailPane(d.mail) + eventsCard(d, true)],
  ['3-added', (d) => eventDetail(d) + resultCard(d)],
  ['4-settings', (d) => mailPane(d.mail) + settingsCard(d)],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'calcatch-shots-'));
for (const lang of ['en', 'ja']) {
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  SHOTS.forEach(([name, build], n) => {
    const html = path.join(tmp, `${lang}-${name}.html`);
    fs.writeFileSync(html, page(lang, n, build(T[lang])));
    const png = path.join(OUT, lang, `${name}.png`);
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--window-size=1280,800', `--screenshot=${png}`, `file://${html}`], { stdio: 'ignore' });
    console.log(path.relative(process.cwd(), png));
  });
}
