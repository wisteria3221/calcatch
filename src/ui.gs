/**
 * カード UI の組み立て。
 */

const WARNING_COLOR = '#d93025';  // 重複の警告（赤）
const MUTED_COLOR = '#5f6368';    // 補足の文字（灰色）
const AI_STUDIO_KEY_URL = 'https://aistudio.google.com/apikey';

/** メールを開いていないときに出すカード */
function buildHomeCard_() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t_('homeTitle')))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(escapeHtml_(t_('homeText'))))
      .addWidget(buildOpenSettingsButton_('')))
    .build();
}

/** API キーが未設定のときに出すカード */
function buildSetupCard_(messageId) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t_('setupTitle')))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(escapeHtml_(t_('setupText'))))
      .addWidget(CardService.newTextButton()
        .setText(t_('getApiKey'))
        .setOpenLink(CardService.newOpenLink().setUrl(AI_STUDIO_KEY_URL)))
      .addWidget(buildOpenSettingsButton_(messageId)))
    .build();
}

/**
 * メール本文を初めて Gemini に送る前に出す、送信内容についての同意カード。
 * 同意するまでメールの内容は送らない
 */
function buildConsentCard_(messageId) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t_('dataConsentTitle')))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(escapeHtml_(t_('dataConsentText')).replace(/\n/g, '<br>')))
      .addWidget(CardService.newTextButton()
        .setText(t_('privacyPolicy'))
        .setOpenLink(CardService.newOpenLink().setUrl(siteUrl_('privacy.html'))))
      .addWidget(buildOpenSettingsButton_(messageId, false)))
    .setFixedFooter(CardService.newFixedFooter().setPrimaryButton(CardService.newTextButton()
      .setText(t_('dataConsentAccept'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('onAcceptDataConsent')
        .setParameters({ messageId: messageId })
        .setLoadIndicator(CardService.LoadIndicator.SPINNER))))
    .build();
}

/** 予定が見つからなかったときや、エラーのときに出すカード */
function buildMessageCard_(messageId, title, text, buttonLabel) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(escapeHtml_(text)))
      .addWidget(buildReextractButton_(messageId, buttonLabel)))
    .build();
}

/** 抽出結果のカード */
function buildEventsCard_(messageId, token, events, tz, note) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(t_('foundTitle'))
      .setSubtitle(t_('foundSubtitle', { count: events.length })));

  // 予備モデルに切り替えたことなどを、目立たない補足として先頭に出す
  if (note) {
    card.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(muted_(note))));
  }

  // 並び：予定名（登録のチェック）→ 日時 → 場所 → 重複の警告 → メモ。
  // 警告は既存の予定の日時を出すので、すぐ上の日時と見比べられる位置に置く。
  // メモは判断にほとんど使わない補足なので、灰色にして最後に置く
  events.forEach((ev, i) => {
    const section = CardService.newCardSection();

    // 予定名と登録のチェックを同じ行に。既存の予定と重複しそうなものは最初からオフにする
    section.addWidget(CardService.newDecoratedText()
      .setText(`<b>${escapeHtml_(ev.title)}</b>`)
      .setWrapText(true)
      .setSwitchControl(CardService.newSwitch()
        .setControlType(CardService.SwitchControlType.CHECK_BOX)
        .setFieldName(selectFieldName_(i))
        .setValue('on')
        .setSelected(!ev.existing)));

    section.addWidget(iconText_(CardService.Icon.CLOCK, t_('labelWhen'), escapeHtml_(formatRange_(ev, tz))));
    if (ev.location) {
      section.addWidget(iconText_(CardService.Icon.MAP_PIN, t_('labelWhere'), escapeHtml_(ev.location)));
    }

    // 重複の警告は赤。違いは文言で伝える
    if (ev.existing) {
      const label = ev.existing.level === 'same' ? t_('warnSame') : t_('warnSimilar');
      // 標準のアイコンに警告の絵柄がないため、サイトに置いた赤いアイコンを使う。
      // 既存の予定の日時も赤で本文に入れる（bottomLabel は色を付けられない）
      section.addWidget(CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIconUrl(SITE_URL + 'images/warning.png').setAltText(label))
        .setText(
          `<font color="${WARNING_COLOR}"><b>${escapeHtml_(label)}</b></font><br>` +
          `<font color="${WARNING_COLOR}">${escapeHtml_(ev.existing.title)}</font><br>` +
          `<font color="${WARNING_COLOR}">${escapeHtml_(formatRange_(ev.existing, tz))}</font>`
        )
        .setWrapText(true));
    }

    if (ev.description) {
      section.addWidget(iconText_(CardService.Icon.DESCRIPTION, t_('labelNotes'), muted_(ev.description)));
    }

    card.addSection(section);
  });

  const addButton = CardService.newTextButton()
    .setText(t_('addButton'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onRegisterEvents')
      .setParameters({ messageId: messageId, token: token })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER));

  card.setFixedFooter(CardService.newFixedFooter()
    .setPrimaryButton(addButton)
    .setSecondaryButton(buildReextractButton_(messageId, t_('reextract'))));
  return card.build();
}

/** 登録結果のカード。登録できた予定は、タップするとカレンダーで開く */
function buildResultCard_(created, failed, tz) {
  const section = CardService.newCardSection();
  created.forEach(({ ev, link }) => {
    const item = CardService.newDecoratedText()
      .setTopLabel(t_('resultAdded'))
      .setText(escapeHtml_(ev.title))
      .setBottomLabel(formatRange_(ev, tz))
      .setWrapText(true);
    if (link) item.setOpenLink(CardService.newOpenLink().setUrl(link));
    section.addWidget(item);
  });
  failed.forEach((ev) => {
    section.addWidget(CardService.newDecoratedText()
      .setTopLabel(t_('resultFailed'))
      .setText(`<font color="${WARNING_COLOR}">${escapeHtml_(ev.title)}</font>`)
      .setWrapText(true));
  });

  const first = created[0] ? new Date(created[0].ev.start) : new Date();
  section.addWidget(CardService.newTextButton()
    .setText(t_('openCalendar'))
    .setOpenLink(CardService.newOpenLink().setUrl(
      'https://calendar.google.com/calendar/r/day/' + Utilities.formatDate(first, tz, 'yyyy/M/d'))));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t_('resultTitle')))
    .addSection(section)
    .build();
}

/**
 * 設定カード。messageId を渡すと、保存後にそのメールの抽出結果へ戻る
 * （API キー未設定の案内から開いた場合）。
 */
function buildSettingsCard_(messageId) {
  const apiKey = getApiKey_();
  const currentModel = getSelectedModel_();
  const isPreset = MODEL_CHOICES.some((c) => c.id === currentModel);

  // API キー
  const keySection = CardService.newCardSection()
    .setHeader(t_('apiKeySection'))
    .addWidget(CardService.newTextInput()
      .setFieldName('api_key')
      .setTitle(t_('apiKeyInput'))
      .setHint(apiKey ? t_('apiKeyHintSet', { last4: apiKey.slice(-4) }) : t_('apiKeyHintUnset')))
    .addWidget(CardService.newTextButton()
      .setText(t_('getApiKey'))
      .setOpenLink(CardService.newOpenLink().setUrl(AI_STUDIO_KEY_URL)));
  if (apiKey) {
    keySection.addWidget(CardService.newTextButton()
      .setText(t_('removeApiKey'))
      .setOnClickAction(CardService.newAction()
        .setFunctionName('onRemoveApiKey')
        .setParameters({ messageId: messageId || '' })));
  }
  keySection.addWidget(CardService.newTextParagraph().setText(muted_(t_('dataNotice'))));

  // モデル
  const modelSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('model_choice')
    .setTitle(t_('modelSelect'));
  MODEL_CHOICES.forEach((c) => modelSelect.addItem(t_(c.labelKey), c.id, c.id === currentModel));
  modelSelect.addItem(t_('modelCustom'), CUSTOM_MODEL_CHOICE, !isPreset);

  const modelSection = CardService.newCardSection()
    .setHeader(t_('modelSection'))
    .addWidget(modelSelect)
    .addWidget(CardService.newTextInput()
      .setFieldName('custom_model')
      .setTitle(t_('customModelTitle'))
      .setHint(t_('customModelHint'))
      .setValue(isPreset ? '' : currentModel))
    .addWidget(CardService.newTextParagraph().setText(muted_(
      t_('currentModel', { model: modelDisplayName_(currentModel) }) + '\n' + t_('modelNote'))));

  // 終了時刻が書かれていない予定の長さ
  const currentDuration = getDefaultDurationHours_();
  const durationSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('duration_choice')
    .setTitle(t_('durationSelect'));
  DURATION_CHOICES.forEach((h) => durationSelect.addItem(
    h === 1 ? t_('durationOneHour') : t_('durationHours', { hours: h }), String(h), h === currentDuration));
  const durationSection = CardService.newCardSection()
    .setHeader(t_('durationSection'))
    .addWidget(durationSelect)
    .addWidget(CardService.newTextParagraph().setText(muted_(t_('durationNote'))));

  const saveButton = CardService.newTextButton()
    .setText(t_('save'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onSaveSettings')
      .setParameters({ messageId: messageId || '' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER));

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t_('settingsTitle')))
    .addSection(keySection)
    .addSection(modelSection)
    .addSection(durationSection);

  card.addSection(buildAboutSection_());

  return card.setFixedFooter(CardService.newFixedFooter().setPrimaryButton(saveButton)).build();
}

/** ホームページ・プライバシーポリシー・利用規約へのリンク */
function buildAboutSection_() {
  const links = [
    [t_('homepage'), siteUrl_('')],
    [t_('privacyPolicy'), siteUrl_('privacy.html')],
    [t_('terms'), siteUrl_('terms.html')],
  ];
  const section = CardService.newCardSection().setHeader(t_('aboutSection'));
  links.forEach(([label, url]) => section.addWidget(CardService.newTextButton()
    .setText(label)
    .setOpenLink(CardService.newOpenLink().setUrl(url))));
  return section;
}

function buildReextractButton_(messageId, label) {
  return CardService.newTextButton()
    .setText(label)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onReextractEvents')
      .setParameters({ messageId: messageId })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER));
}

/** 「設定を開く」ボタン。filled が false なら目立たない形にする（ほかに主となるボタンがあるとき） */
function buildOpenSettingsButton_(messageId, filled) {
  return CardService.newTextButton()
    .setText(t_('openSettings'))
    .setTextButtonStyle(filled === false ? CardService.TextButtonStyle.TEXT : CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onOpenSettingsFromCard')
      .setParameters({ messageId: messageId || '' }));
}

// ---------------------------------------------------------------------------
// 表示用のユーティリティ
// ---------------------------------------------------------------------------

/**
 * 予定の日時を、表示言語に合わせた書式で曜日つきで返す。range は { allDay, start, end }（ISO 文字列）
 * 例：2026/10/25（日）14:00 – 16:00 ／ Sun, Oct 25, 2026, 2:00 PM – 4:00 PM
 */
function formatRange_(range, tz) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const ja = LOCALE === 'ja';
  const date = (d) => ja
    ? `${Utilities.formatDate(d, tz, 'yyyy/MM/dd')}（${weekdayName_(d, tz)}）`
    : `${weekdayName_(d, tz)}, ${Utilities.formatDate(d, tz, 'MMM d, yyyy')}`;
  const time = (d) => Utilities.formatDate(d, tz, ja ? 'HH:mm' : 'h:mm a');
  const dateTime = (d) => date(d) + (ja ? '' : ', ') + time(d);

  if (range.allDay) {
    const lastDay = addDays_(end, -1, tz);  // 終了日は「翌日」なので 1 日戻す
    const s = date(start);
    const e = date(lastDay);
    const days = s === e ? s : `${s} – ${e}`;
    return ja ? days + t_('allDay') : `${days} (${t_('allDay')})`;
  }
  const sameDay = Utilities.formatDate(start, tz, 'yyyyMMdd') === Utilities.formatDate(end, tz, 'yyyyMMdd');
  return dateTime(start) + ' – ' + (sameDay ? time(end) : dateTime(end));
}

const WEEKDAY_NAMES = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** 曜日名。Utilities.formatDate の曜日は英語固定なので、日付から自前で求める */
function weekdayName_(d, tz) {
  const [y, m, day] = Utilities.formatDate(d, tz, 'yyyy-MM-dd').split('-').map(Number);
  return WEEKDAY_NAMES[LOCALE === 'ja' ? 'ja' : 'en'][new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
}

/** 先頭にアイコンを付けた 1 行。label はアイコンの代替テキスト（読み上げ用） */
function iconText_(icon, label, html) {
  return CardService.newDecoratedText()
    .setStartIcon(CardService.newIconImage().setIcon(icon).setAltText(label))
    .setText(html)
    .setWrapText(true);
}

/** 灰色の補足テキスト（改行は <br> にする） */
function muted_(text) {
  return `<font color="${MUTED_COLOR}">${escapeHtml_(text).replace(/\n/g, '<br>')}</font>`;
}

/** カードのテキストは HTML として解釈されるため、予定名などの記号をエスケープする */
function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notify_(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

function selectFieldName_(index) {
  return 'select_' + index;
}
