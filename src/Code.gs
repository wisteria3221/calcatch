/**
 * CalCatch — メール本文の予定を Gemini で抽出し、Google カレンダーに登録する Gmail アドオン
 *
 * 流れ:
 *   1. メールを開く → 本文を Gemini に渡し、構造化 JSON でイベント候補を取得（結果はキャッシュ）
 *   2. カレンダーの既存予定と照合し、重複しそうなものに警告を付ける
 *   3. 候補をチェックボックス付きで表示 → 選んだものだけカレンダーに登録
 *
 * 利用者ごとの設定（ユーザープロパティ。アドオンのメニュー →「設定」で変更）:
 *   GEMINI_API_KEY … 利用者自身の Gemini API キー
 *   GEMINI_MODEL   … 利用者が選んだモデル名
 *   DEFAULT_DURATION_HOURS … 終了時刻が書かれていない予定の長さ（時間）
 *   DATA_CONSENT   … 送信内容についての同意を得た文面の版（API キーを変えると消す）
 */

const HOUR_MS = 60 * 60 * 1000;

// 公開用のページ（GitHub Pages: リポジトリの docs/）。日本語版は /ja/ 以下
const SITE_URL = 'https://calcatch.wisteria.xyz/';

/** 表示言語に合わせたサイトのページ URL（path は '' / 'privacy.html' / 'terms.html'） */
function siteUrl_(path) {
  return SITE_URL + (LOCALE === 'ja' ? 'ja/' : '') + path;
}

// 設定画面で選べるモデル。いずれも自動更新エイリアスなので、新しいモデルが出ても選択肢を直す必要はない。
// Pro は応答に時間がかかり、アドオンの実行時間の上限（約 30 秒）を超えやすいため選択肢に入れない
const MODEL_CHOICES = [
  { id: 'gemini-flash-latest',      nameKey: 'modelStandard', labelKey: 'modelStandardLabel' },
  { id: 'gemini-flash-lite-latest', nameKey: 'modelLite',     labelKey: 'modelLiteLabel' },
];
const CUSTOM_MODEL_CHOICE = 'custom';  // 「その他（モデル名を直接入力）」
const DEFAULT_MODEL = 'gemini-flash-latest';

// 終了時刻が書かれていない予定の長さ（時間）。設定画面で選べる値と既定値
const DURATION_CHOICES = [1, 2, 3, 4];
const DEFAULT_DURATION_HOURS = 2;

// Gemini の抽出結果と、登録待ちの候補を保持する秒数（CacheService の上限は 6 時間）
const CACHE_TTL_SEC = 6 * 60 * 60;
// 抽出のしかた（プロンプトや時刻の読み取り）を変えたら上げ、古いキャッシュを使わないようにする
const EXTRACT_VERSION = 'v8';

const PROP_API_KEY = 'GEMINI_API_KEY';
const PROP_MODEL = 'GEMINI_MODEL';
const PROP_DURATION = 'DEFAULT_DURATION_HOURS';
const PROP_DATA_CONSENT = 'DATA_CONSENT';
// 同意カードの文面を大きく変えたら上げ、同意を取り直す
const DATA_CONSENT_VERSION = '1';

// 登録処理の順番待ちをする最大時間
const LOCK_WAIT_MS = 10000;

// ---------------------------------------------------------------------------
// トリガー / アクション
// ---------------------------------------------------------------------------

/** メールを開いていないときのホーム画面 */
function onHomepage(e) {
  setLocale_(e);
  return buildHomeCard_();
}

/** メールを開いたときに呼ばれるコンテキストトリガー。開いた時点で候補を抽出して表示する */
function onGmailMessageOpen(e) {
  setLocale_(e);
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return buildExtractionCard_(e.gmail.messageId, false);
}

/** 「再抽出」「再試行」ボタン。キャッシュを使わずに Gemini で抽出し直す */
function onReextractEvents(e) {
  setLocale_(e);
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  const card = buildExtractionCard_(e.parameters.messageId, true);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

/** 「カレンダーに登録」ボタン */
function onRegisterEvents(e) {
  setLocale_(e);
  const messageId = e.parameters.messageId;
  const cache = CacheService.getUserCache();

  // ボタンが続けて押されても二重に登録しないよう、候補の取り出しは 1 回ずつ行い、
  // 登録を始める前にキャッシュから外して「確保」する（2 回目の押下は期限切れとして扱われる）
  const lock = LockService.getUserLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return notify_(t_('registerBusy'));
  let pending;
  let selected;
  try {
    const cached = cache.get(pendingKey_(messageId));
    pending = cached ? JSON.parse(cached) : null;
    if (!pending || pending.token !== e.parameters.token) return notify_(t_('expired'));

    // 各候補のチェックボックス（select_0, select_1, ...）のうち、オンのものを集める
    const inputs = e.commonEventObject.formInputs || {};
    selected = pending.events.filter((_, i) => !!formValue_(inputs, selectFieldName_(i)));
    if (selected.length === 0) return notify_(t_('selectSome'));

    cache.remove(pendingKey_(messageId));
  } finally {
    lock.releaseLock();
  }

  const created = [];
  const failed = [];
  let tz = null;
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    const threadId = GmailApp.getMessageById(messageId).getThread().getId();
    const mailLink = mailLink_(threadId);
    tz = getCalendarTimeZone_();
    selected.forEach((ev) => {
      try {
        created.push({ ev: ev, link: createCalendarEvent_(ev, tz, mailLink) });
      } catch (err) {
        console.error(err);
        failed.push(ev);
      }
    });
  } finally {
    // 1 件も登録できなかったときは、そのまま再試行できるよう候補を戻す
    if (created.length === 0) cache.put(pendingKey_(messageId), JSON.stringify(pending), CACHE_TTL_SEC);
  }

  const notice = created.length === 0 ? t_('addFailedAll')
    : failed.length > 0 ? t_('addedPartial', { count: created.length, failed: failed.length })
    : t_('addedCount', { count: created.length });
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(notice))
    .setNavigation(CardService.newNavigation().updateCard(buildResultCard_(created, failed, tz)))
    .build();
}

/** アドオンのメニュー（︙）の「設定」 */
function onOpenSettings(e) {
  setLocale_(e);
  const messageId = (e.gmail && e.gmail.messageId) || '';
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([buildSettingsCard_(messageId)])
    .build();
}

/** カード内の「設定を開く」ボタン */
function onOpenSettingsFromCard(e) {
  setLocale_(e);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildSettingsCard_(e.parameters.messageId)))
    .build();
}

/**
 * 設定の「保存」ボタン。
 * 入力された API キーとモデルで Gemini が使えるかを確かめてから保存する。
 * メールを開いた状態で保存した場合は、そのメールの抽出結果に戻る。
 */
function onSaveSettings(e) {
  setLocale_(e);
  const messageId = e.parameters.messageId;
  const inputs = e.commonEventObject.formInputs || {};
  const newKey = formValue_(inputs, 'api_key').trim();
  const choice = formValue_(inputs, 'model_choice') || DEFAULT_MODEL;
  const model = choice === CUSTOM_MODEL_CHOICE
    ? formValue_(inputs, 'custom_model').trim().replace(/^models\//, '')
    : choice;

  if (!model) return notify_(t_('enterModel'));
  if (!/^[A-Za-z0-9._-]+$/.test(model)) return notify_(t_('badModelName'));

  let warning = '';
  const keyToCheck = newKey || getApiKey_();
  if (keyToCheck) {
    const check = checkGemini_(keyToCheck, model);
    if (!check.ok) {
      if (check.code === 'invalid_key') {
        // 新しく入力したキーが使えないなら保存しない。既存のキーの問題なら、モデルだけ保存して知らせる
        if (newKey) return notify_(t_('keyRejected', { reason: check.message }));
        warning = t_('errInvalidKey');
      } else if (check.code === 'model') {
        return notify_(t_('modelRejected', { reason: check.message }));
      } else {
        warning = t_('savedUnverified', { reason: check.message });
      }
    }
  }

  const props = PropertiesService.getUserProperties();
  if (newKey) {
    props.setProperty(PROP_API_KEY, newKey);
    // キーが変わると無料枠か有料枠かも変わりうるため、送信内容への同意を取り直す
    props.deleteProperty(PROP_DATA_CONSENT);
  }
  props.setProperty(PROP_MODEL, model);
  const duration = Number(formValue_(inputs, 'duration_choice'));
  if (DURATION_CHOICES.indexOf(duration) !== -1) props.setProperty(PROP_DURATION, String(duration));

  const navigation = CardService.newNavigation();
  if (messageId && getApiKey_() && e.gmail) {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    navigation.popToRoot().updateCard(buildExtractionCard_(messageId, false));
  } else {
    navigation.updateCard(buildSettingsCard_(messageId));
  }
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(warning || t_('saved')))
    .setNavigation(navigation)
    .build();
}

/**
 * 送信内容についての同意カードの「同意して続ける」ボタン。
 * 同意を記録し、そのメールの抽出結果を表示する。
 */
function onAcceptDataConsent(e) {
  setLocale_(e);
  PropertiesService.getUserProperties().setProperty(PROP_DATA_CONSENT, DATA_CONSENT_VERSION);
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildExtractionCard_(e.parameters.messageId, false)))
    .build();
}

/** 設定の「API キーを削除」ボタン */
function onRemoveApiKey(e) {
  setLocale_(e);
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(PROP_API_KEY);
  props.deleteProperty(PROP_DATA_CONSENT);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(t_('apiKeyRemoved')))
    .setNavigation(CardService.newNavigation().updateCard(buildSettingsCard_(e.parameters.messageId)))
    .build();
}

// ---------------------------------------------------------------------------
// 抽出の流れ
// ---------------------------------------------------------------------------

/**
 * メールから予定を抽出し、表示するカードを返す。
 * Gemini の抽出結果はメールとモデルごとにキャッシュし、forceRefresh が true のときだけ呼び直す。
 * カレンダーとの重複チェックは、表示のたびに最新の状態で行う。
 */
function buildExtractionCard_(messageId, forceRefresh) {
  const apiKey = getApiKey_();
  if (!apiKey) return buildSetupCard_(messageId);
  // メール本文を Gemini に送る前に、送信内容と無料枠での扱いについて同意を得る
  if (!hasDataConsent_()) return buildConsentCard_(messageId);

  const message = GmailApp.getMessageById(messageId);
  const tz = getCalendarTimeZone_();
  const cache = CacheService.getUserCache();
  const model = getSelectedModel_();
  const key = extractedKey_(messageId, model);

  let result = null;  // { events, usedModel, fallbackReason }
  const cached = forceRefresh ? null : cache.get(key);
  if (cached) {
    result = JSON.parse(cached);
  } else {
    try {
      const extracted = extractEventsWithGemini_(message, tz, model, apiKey);
      result = {
        events: extracted.events.map((ev) => normalizeEvent_(ev, tz)).filter(Boolean),
        usedModel: extracted.usedModel,
        fallbackReason: extracted.fallbackReason,
      };
    } catch (err) {
      console.error(err);
      if (err.geminiCode === 'invalid_key') return buildSetupCard_(messageId);
      return buildMessageCard_(messageId, t_('extractFailedTitle'), describeError_(err), t_('retry'));
    }
    cache.put(key, JSON.stringify(result), CACHE_TTL_SEC);
  }

  // 終了時刻を推定した予定は、キャッシュ済みでも今の設定の長さで終了を決め直す
  const events = applyDefaultDuration_(result.events, getDefaultDurationHours_());
  if (events.length === 0) {
    return buildMessageCard_(messageId, t_('noEventsTitle'), t_('noEventsText'), t_('reextract'));
  }

  // カレンダーに同じ・似た予定が登録済みかを確認する（失敗しても抽出結果は表示する）
  try {
    annotateExistingEvents_(events, tz, message.getThread().getId());
  } catch (err) {
    console.error(err);
  }

  // チェックボックスは候補の番号で対応づけるため、表示したカードと候補の組を token で確かめられるようにする
  // （別の画面で再抽出して候補が入れ替わった後に、古いカードから別の予定を登録しないため）
  const token = Utilities.getUuid();
  cache.put(pendingKey_(messageId), JSON.stringify({ token: token, events: events }), CACHE_TTL_SEC);
  // 選んだモデルが混雑していた・見つからなかったために予備モデルで抽出した場合は、そのことを表示する
  const note = result.usedModel !== model
    ? t_(result.fallbackReason === 'model' ? 'fallbackNoteUnavailable' : 'fallbackNote',
      { selected: modelDisplayName_(model), used: modelDisplayName_(result.usedModel) })
    : '';
  return buildEventsCard_(messageId, token, events, tz, note);
}

// ---------------------------------------------------------------------------
// 設定の読み書き
// ---------------------------------------------------------------------------

/** 利用者の Gemini API キー。未設定なら空文字 */
function getApiKey_() {
  return PropertiesService.getUserProperties().getProperty(PROP_API_KEY) || '';
}

/** 送信内容についての同意（今の版の文面に対するもの）が済んでいれば true */
function hasDataConsent_() {
  return PropertiesService.getUserProperties().getProperty(PROP_DATA_CONSENT) === DATA_CONSENT_VERSION;
}

/** 利用者が選んだモデル名。未設定なら既定値 */
function getSelectedModel_() {
  return PropertiesService.getUserProperties().getProperty(PROP_MODEL) || DEFAULT_MODEL;
}

/** 終了時刻が書かれていない予定の長さ（時間）。未設定なら既定値 */
function getDefaultDurationHours_() {
  const hours = Number(PropertiesService.getUserProperties().getProperty(PROP_DURATION));
  return DURATION_CHOICES.indexOf(hours) !== -1 ? hours : DEFAULT_DURATION_HOURS;
}

/**
 * 画面に表示するモデル名。選択肢のモデルは「標準」などの短い名前、
 * 直接入力されたモデルは入力されたモデル名をそのまま返す。
 */
function modelDisplayName_(id) {
  const choice = MODEL_CHOICES.find((c) => c.id === id);
  return choice ? t_(choice.nameKey) : id;
}

/** フォーム入力から 1 つ目の文字列値を取り出す。なければ空文字 */
function formValue_(inputs, name) {
  const input = inputs[name];
  return input && input.stringInputs && input.stringInputs.value.length
    ? input.stringInputs.value[0]
    : '';
}

/**
 * 予定の説明欄に入れる、元のメールへのリンク。
 * 複数のアカウントでログインしていても正しいアカウントで開くよう、番号ではなくメールアドレスで指定する
 */
function mailLink_(threadId) {
  let account = '0';
  try {
    const email = Session.getActiveUser().getEmail();
    if (/^[^\s/#?@]+@[^\s/#?@]+$/.test(email)) account = email;
  } catch (err) {
    console.error(err);
  }
  return `https://mail.google.com/mail/u/${account}/#all/${threadId}`;
}

/** Gemini の抽出結果のキャッシュキー（メールとモデルごと） */
function extractedKey_(messageId, model) {
  return `extracted:${EXTRACT_VERSION}:${model}:${messageId}`;
}

/** 登録待ちの候補（重複チェック済み）のキャッシュキー */
function pendingKey_(messageId) {
  return 'pending:' + messageId;
}
