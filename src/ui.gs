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
function buildEventsCard_(messageId, events, tz, note) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(t_('foundTitle'))
      .setSubtitle(t_('foundSubtitle', { count: events.length })));

  // 予備モデルに切り替えたことなどを、目立たない補足として先頭に出す
  if (note) {
    card.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(muted_(note))));
  }

  events.forEach((ev, i) => {
    const section = CardService.newCardSection().setHeader(`${i + 1}. ${ev.title}`);

    // 重複の警告は、色付きの太字で一番上に出す。違いは文言で伝える
    if (ev.existing) {
      const label = ev.existing.level === 'same' ? t_('warnSame') : t_('warnSimilar');
      section.addWidget(CardService.newDecoratedText()
        .setText(
          `<font color="${WARNING_COLOR}"><b>${escapeHtml_(label)}</b></font><br>` +
          `<font color="${WARNING_COLOR}">${escapeHtml_(ev.existing.title)}</font>`
        )
        .setBottomLabel(formatRange_(ev.existing, tz))
        .setWrapText(true));
    }

    section.addWidget(CardService.newDecoratedText()
      .setTopLabel(t_('labelWhen'))
      .setText(escapeHtml_(formatRange_(ev, tz)))
      .setWrapText(true));
    if (ev.location) {
      section.addWidget(CardService.newDecoratedText()
        .setTopLabel(t_('labelWhere'))
        .setText(escapeHtml_(ev.location))
        .setWrapText(true));
    }
    if (ev.description) {
      section.addWidget(CardService.newDecoratedText()
        .setTopLabel(t_('labelNotes'))
        .setText(escapeHtml_(ev.description))
        .setWrapText(true));
    }

    // 候補ごとの登録チェック。既存の予定と重複しそうなものは最初からオフにする
    section.addWidget(CardService.newDecoratedText()
      .setText(`<b>${escapeHtml_(t_('addThis'))}</b>`)
      .setSwitchControl(CardService.newSwitch()
        .setControlType(CardService.SwitchControlType.CHECK_BOX)
        .setFieldName(selectFieldName_(i))
        .setValue('on')
        .setSelected(!ev.existing)));

    card.addSection(section);
  });

  const addButton = CardService.newTextButton()
    .setText(t_('addButton'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onRegisterEvents')
      .setParameters({ messageId: messageId })
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
    .addSection(modelSection);

  const about = buildAboutSection_();
  if (about) card.addSection(about);

  return card.setFixedFooter(CardService.newFixedFooter().setPrimaryButton(saveButton)).build();
}

/** ホームページ・プライバシーポリシー・利用規約へのリンク（URL が決まっているものだけ） */
function buildAboutSection_() {
  const links = [
    [t_('homepage'), HOMEPAGE_URL],
    [t_('privacyPolicy'), PRIVACY_POLICY_URL],
    [t_('terms'), TERMS_URL],
  ].filter(([, url]) => !!url);
  if (!links.length) return null;
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

function buildOpenSettingsButton_(messageId) {
  return CardService.newTextButton()
    .setText(t_('openSettings'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('onOpenSettingsFromCard')
      .setParameters({ messageId: messageId || '' }));
}

// ---------------------------------------------------------------------------
// 表示用のユーティリティ
// ---------------------------------------------------------------------------

/** 予定の日時を、表示言語に合わせた書式で返す。range は { allDay, start, end }（ISO 文字列） */
function formatRange_(range, tz) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const fmt = LOCALE === 'ja'
    ? { date: 'yyyy/MM/dd', time: 'HH:mm', dateTime: 'yyyy/MM/dd HH:mm' }
    : { date: 'MMM d, yyyy', time: 'h:mm a', dateTime: 'MMM d, yyyy h:mm a' };
  const allDayLabel = LOCALE === 'ja' ? `（${t_('allDay')}）` : ` (${t_('allDay')})`;

  if (range.allDay) {
    const lastDay = new Date(end.getTime() - DAY_MS);
    const s = Utilities.formatDate(start, tz, fmt.date);
    const e = Utilities.formatDate(lastDay, tz, fmt.date);
    return (s === e ? s : `${s} – ${e}`) + allDayLabel;
  }
  const sameDay = Utilities.formatDate(start, tz, 'yyyyMMdd') === Utilities.formatDate(end, tz, 'yyyyMMdd');
  return Utilities.formatDate(start, tz, fmt.dateTime) + ' – ' +
    Utilities.formatDate(end, tz, sameDay ? fmt.time : fmt.dateTime);
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
