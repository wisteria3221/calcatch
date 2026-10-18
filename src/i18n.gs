/**
 * 画面に表示する文言（日本語・英語）。
 * Gmail の表示言語が日本語なら日本語、それ以外は英語で表示する。
 * 文言を追加するときは、ja と en の両方に同じキーを追加すること。
 */

const MESSAGES = {
  ja: {
    // 共通
    retry: '再試行',
    reextract: '再抽出',
    openSettings: '設定を開く',
    allDay: '終日',
    originalEmail: '元のメール',

    // ホーム（メールを開いていないとき）
    homeTitle: 'CalCatch',
    homeText: 'メールを開くと、本文に書かれた予定を Gemini で読み取り、Google カレンダーに登録できます。',

    // 初回設定の案内
    setupTitle: 'API キーを設定してください',
    setupText: 'CalCatch はメールの予定を読み取るために Gemini API を使います。' +
      'Google AI Studio で API キーを発行し、設定画面に貼り付けてください。',
    getApiKey: 'API キーを発行する（Google AI Studio）',

    // 抽出結果
    foundTitle: '見つかった予定',
    foundSubtitle: '{count}件・登録するものにチェックを入れてください',
    fallbackNote: '選んだモデル（{selected}）が混雑していたため、{used}モデルで抽出しました。',
    fallbackNoteUnavailable: '選んだモデル（{selected}）が見つからないため、{used}モデルで抽出しました。設定でモデルを変更してください。',
    warnSame: '登録済みの可能性が高い予定',
    warnSimilar: '似た予定がカレンダーにあります',
    labelWhen: '日時',
    labelWhere: '場所',
    labelNotes: 'メモ',
    addButton: 'カレンダーに登録',
    extractFailedTitle: '予定を抽出できませんでした',
    noEventsTitle: '予定は見つかりませんでした',
    noEventsText: 'このメールの本文には、カレンダーに登録できる予定が見つかりませんでした。',

    // 登録
    expired: '候補の有効期限が切れました。もう一度抽出してください',
    selectSome: '登録する予定を選んでください',
    addedCount: '{count}件を登録しました',
    addedPartial: '{count}件を登録しました（{failed}件は失敗）',
    addFailedAll: '登録できませんでした。時間をおいてもう一度お試しください',
    resultTitle: '登録結果',
    resultAdded: '登録済み',
    resultFailed: '登録に失敗',
    openCalendar: 'Google カレンダーを開く',

    // 設定
    settingsTitle: '設定',
    apiKeySection: 'Gemini API キー',
    apiKeyInput: 'API キー',
    apiKeyHintSet: '設定済み（末尾 {last4}）。変更するときだけ入力してください',
    apiKeyHintUnset: 'Google AI Studio で発行したキーを貼り付けてください',
    removeApiKey: 'API キーを削除',
    apiKeyRemoved: 'API キーを削除しました',
    dataNotice: 'メール本文は、あなたの API キーを使って Gemini API に送信されます。' +
      'Gemini API の無料枠では、送信した内容が Google のサービス改善に使われる場合があります。' +
      '気になる場合は、課金を有効にした API キー（有料枠）を使ってください。',
    modelSection: 'Gemini のモデル',
    modelSelect: '使用するモデル',
    modelCustom: 'その他（モデル名を直接入力）',
    customModelTitle: 'モデル名（「その他」を選んだときだけ使います）',
    customModelHint: '例: gemini-2.5-flash',
    currentModel: '現在の設定: {model}',
    modelNote: '高精度モデルは応答に時間がかかり、無料枠では使えない場合があります。' +
      '選んだモデルが混雑しているときは、軽量モデルで抽出します。',
    durationSection: '予定の長さ',
    durationSelect: '終了時刻が書かれていないとき',
    durationOneHour: '1時間',
    durationHours: '{hours}時間',
    durationNote: 'メールに終了時刻がない予定は、開始からこの長さで登録します。',
    save: '保存',
    saved: '保存しました',
    savedUnverified: '保存しました。ただし動作を確認できませんでした（{reason}）',
    enterModel: 'モデル名を入力してください',
    badModelName: 'モデル名には英数字と「.」「_」「-」だけを使ってください',
    keyRejected: 'API キーが正しくないため、保存しませんでした（{reason}）',
    modelRejected: 'このモデルは使えないため、保存しませんでした（{reason}）',
    aboutSection: 'CalCatch について',
    homepage: 'ホームページ',
    privacyPolicy: 'プライバシーポリシー',
    terms: '利用規約',

    // モデル
    modelStandard: '標準',
    modelLite: '軽量',
    modelPro: '高精度',
    modelStandardLabel: '標準（おすすめ）：速さと精度のバランスがよい',
    modelLiteLabel: '軽量：速くて安いが、精度はやや落ちる',
    modelProLabel: '高精度：精度は高いが、遅くて料金も高い',

    // Gemini のエラー
    errNoKey: 'API キーが設定されていません。メニューの「設定」から設定してください。',
    errInvalidKey: 'API キーが正しくないか、無効になっています。設定から確認してください。',
    errModel: '選んだモデルが使えません。設定でモデルを変更してください。',
    errQuota: 'Gemini API の利用上限に達しました。しばらく待つか、設定でモデルや API キーを見直してください。',
    errBusy: 'Gemini が混雑しています。少し時間をおいて再度お試しください。',
    errNoResponse: 'Gemini から有効な応答がありませんでした。もう一度お試しください。',
    errGeneric: 'Gemini API でエラーが発生しました（{detail}）',
  },

  en: {
    retry: 'Retry',
    reextract: 'Re-extract',
    openSettings: 'Open settings',
    allDay: 'all day',
    originalEmail: 'Original email',

    homeTitle: 'CalCatch',
    homeText: 'Open an email and CalCatch reads the events written in it with Gemini, ' +
      'so you can add them to Google Calendar.',

    setupTitle: 'Set up your API key',
    setupText: 'CalCatch uses the Gemini API to read events in your emails. ' +
      'Create an API key in Google AI Studio and paste it in Settings.',
    getApiKey: 'Get an API key (Google AI Studio)',

    foundTitle: 'Events found',
    foundSubtitle: '{count} found · check the ones to add',
    fallbackNote: 'The selected model ({selected}) was busy, so the {used} model was used.',
    fallbackNoteUnavailable: 'The selected model ({selected}) wasn’t found, so the {used} model was used. Choose another model in Settings.',
    warnSame: 'Probably already in your calendar',
    warnSimilar: 'A similar event is in your calendar',
    labelWhen: 'When',
    labelWhere: 'Where',
    labelNotes: 'Notes',
    addButton: 'Add to Calendar',
    extractFailedTitle: 'Couldn’t extract events',
    noEventsTitle: 'No events found',
    noEventsText: 'No events that can be added to your calendar were found in this email.',

    expired: 'These results have expired. Please extract again.',
    selectSome: 'Select at least one event to add.',
    addedCount: 'Added {count} event(s)',
    addedPartial: 'Added {count} event(s); {failed} failed',
    addFailedAll: 'Couldn’t add the events. Please try again later.',
    resultTitle: 'Result',
    resultAdded: 'Added',
    resultFailed: 'Failed to add',
    openCalendar: 'Open Google Calendar',

    settingsTitle: 'Settings',
    apiKeySection: 'Gemini API key',
    apiKeyInput: 'API key',
    apiKeyHintSet: 'Saved (ends with {last4}). Enter a key only to change it.',
    apiKeyHintUnset: 'Paste a key created in Google AI Studio.',
    removeApiKey: 'Remove API key',
    apiKeyRemoved: 'API key removed.',
    dataNotice: 'Email content is sent to the Gemini API using your API key. ' +
      'On the Gemini API free tier, content you send may be used to improve Google products. ' +
      'If that concerns you, use an API key with billing enabled (paid tier).',
    modelSection: 'Gemini model',
    modelSelect: 'Model',
    modelCustom: 'Other (enter a model name)',
    customModelTitle: 'Model name (used only when “Other” is selected)',
    customModelHint: 'e.g. gemini-2.5-flash',
    currentModel: 'Current: {model}',
    modelNote: 'The Pro model is slower and may not be available on the free tier. ' +
      'If the selected model is busy, the Lite model is used instead.',
    durationSection: 'Event length',
    durationSelect: 'When no end time is given',
    durationOneHour: '1 hour',
    durationHours: '{hours} hours',
    durationNote: 'Events without an end time in the email are added with this length from the start.',
    save: 'Save',
    saved: 'Saved.',
    savedUnverified: 'Saved, but couldn’t verify it ({reason})',
    enterModel: 'Enter a model name.',
    badModelName: 'Model names can contain only letters, numbers, “.”, “_” and “-”.',
    keyRejected: 'The API key is not valid, so it was not saved ({reason})',
    modelRejected: 'This model can’t be used, so it was not saved ({reason})',
    aboutSection: 'About CalCatch',
    homepage: 'Homepage',
    privacyPolicy: 'Privacy Policy',
    terms: 'Terms of Service',

    modelStandard: 'Standard',
    modelLite: 'Lite',
    modelPro: 'Pro',
    modelStandardLabel: 'Standard (recommended): balanced speed and accuracy',
    modelLiteLabel: 'Lite: faster and cheaper, slightly less accurate',
    modelProLabel: 'Pro: most accurate, but slower and more expensive',

    errNoKey: 'No API key is set. Open Settings from the add-on menu to add one.',
    errInvalidKey: 'The API key is incorrect or no longer valid. Check it in Settings.',
    errModel: 'The selected model can’t be used. Choose another model in Settings.',
    errQuota: 'You’ve reached the Gemini API usage limit. Wait a while, or review the model or API key in Settings.',
    errBusy: 'Gemini is busy right now. Please try again in a moment.',
    errNoResponse: 'Gemini didn’t return a valid response. Please try again.',
    errGeneric: 'The Gemini API returned an error ({detail})',
  },
};

/** 現在の表示言語（'ja' または 'en'）。各トリガー・アクションの最初に setLocale_ で決める */
let LOCALE = 'en';

/** イベントオブジェクトから Gmail の表示言語を読み取り、表示言語を決める */
function setLocale_(e) {
  const userLocale = (e && e.commonEventObject && e.commonEventObject.userLocale) || '';
  LOCALE = /^ja/i.test(userLocale) ? 'ja' : 'en';
}

/** 文言を取り出す。{name} の部分は params の値で置き換える */
function t_(key, params) {
  const table = MESSAGES[LOCALE] || MESSAGES.en;
  let text = table[key] !== undefined ? table[key] : (MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key);
  Object.keys(params || {}).forEach((name) => {
    text = text.split(`{${name}}`).join(String(params[name]));
  });
  return text;
}
