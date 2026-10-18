# Google Workspace Marketplace 掲載情報

Cloud コンソール（プロジェクト `calcatch-wisteria`）の「Google Workspace Marketplace SDK」に入力する内容。
掲載文を変えたらこのファイルも更新する。

## アプリの構成（App Configuration）

コンソールの表示言語によって項目名の訳が少し違うことがあるため、英語の項目名を括弧で併記している。

| 項目 | 値 |
| --- | --- |
| アプリの公開設定（App visibility） | 一般公開（Public） |
| インストール設定（Installation settings） | 個人と管理者によるインストール（Individual + Admin install） |
| アプリの統合（App integrations） | Google Workspace アドオン → Apps Script のデプロイ ID でデプロイ（Deploy using Apps Script deployment ID） |
| デプロイ ID（Deployment ID） | `AKfycbyIeh-7N6-rxpM5FFfAMDdhqFVhB6wZAprrxz_fFP0FdBEgv3SKy-vbKWqjLcg5WuI8Qg` |
| 開発者名（Developer name） | wisteria3221 |
| 開発者のウェブサイトの URL（Developer website URL） | https://calcatch.wisteria.xyz/ |
| 開発者のメールアドレス（Developer email） | calcatch-support@googlegroups.com |

OAuth スコープ（OAuth scopes。`src/appsscript.json` と同じ 7 つ）:

```
https://www.googleapis.com/auth/gmail.addons.execute
https://www.googleapis.com/auth/gmail.addons.current.message.readonly
https://www.googleapis.com/auth/calendar.events.owned
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/script.external_request
https://www.googleapis.com/auth/script.locale
https://www.googleapis.com/auth/userinfo.email
```

## ストアの掲載情報（Store Listing）

| 項目 | 値 |
| --- | --- |
| カテゴリ（Category） | 仕事効率化（Productivity） |
| 料金（Pricing） | 無料（Free of charge） |
| アプリのアイコン 128×128（Application icon） | `docs/images/icon-128.png` |
| アプリのアイコン 32×32（Application icon） | `docs/images/icon-32.png` |
| アプリのカードバナー 220×140（Application card banner） | `marketplace/banner-220x140.png`（元データ `banner.svg`） |
| スクリーンショット（Screenshots） | `marketplace/screenshots/{en,ja}/` の 4 枚（下記） |
| 利用規約の URL（Terms of service URL） | https://calcatch.wisteria.xyz/terms.html |
| プライバシー ポリシーの URL（Privacy policy URL） | https://calcatch.wisteria.xyz/privacy.html |
| サポートの URL（Support URL） | https://github.com/wisteria3221/calcatch/issues |
| ヘルプの URL（Help URL） | https://calcatch.wisteria.xyz/ |

言語は英語（既定）と日本語の 2 つを登録する。言語ごとに、アプリ名・簡単な説明・詳細な説明・スクリーンショットを入力する。

### 英語（English）

**アプリケーション名（Application name）**

```
CalCatch
```

**簡単な説明（Short description）**

```
Find the events written in your emails with Gemini and add them to Google Calendar in one step, with duplicate checks.
```

**詳細な説明（Detailed description）**

```
CalCatch is a Gmail add-on that turns the dates, times and places written in an email into Google Calendar events.

Open an email and CalCatch reads it with Gemini, then lists the events it found: title, date and time, location and notes. Check the ones you want and press "Add to Calendar". Each event includes a link back to the original email.

Features
• Reads the email for you — events are extracted as soon as you open an email.
• Avoids duplicates — events that look already registered in your calendar are flagged and left unchecked.
• You stay in control — nothing is added until you choose the events and press "Add to Calendar".
• Choose the Gemini model and how long events without an end time should be in Settings.
• Works in English and Japanese, following your Gmail display language.

Your own Gemini API key
CalCatch calls the Gemini API with your own API key, created in Google AI Studio. There is no CalCatch server, and the developer never receives your email or calendar data. Gemini API usage is billed to the Google Cloud project that owns your key.

On the Gemini API free tier, content you send is used to improve Google products and may be read by human reviewers. Because emails often contain personal information, we strongly recommend a key with billing enabled. CalCatch asks for your agreement before sending any email.

Getting started
1. Create a Gemini API key in Google AI Studio.
2. In Gmail, open CalCatch from the side panel and choose Settings from the add-on menu.
3. Paste your API key and save.

Source code: https://github.com/wisteria3221/calcatch (MIT License)
Support: calcatch-support@googlegroups.com
```

### 日本語（Japanese）

**アプリケーション名（Application name）**

```
CalCatch
```

**簡単な説明（Short description）**

```
メールに書かれた予定を Gemini で見つけ、Google カレンダーにそのまま登録。登録済みの予定との重複もチェックします。
```

**詳細な説明（Detailed description）**

```
CalCatch は、メール本文に書かれた日時や場所を Google カレンダーの予定に変える Gmail アドオンです。

メールを開くと Gemini が本文を読み取り、見つかった予定（予定名・日時・場所・メモ）を一覧表示します。登録したい予定にチェックを入れて「カレンダーに登録」を押すだけ。予定の説明欄には元のメールへのリンクが入ります。

主な機能
• 本文から自動で読み取り — メールを開いた時点で予定を抽出します。
• 二重登録を防止 — カレンダーに登録済みと思われる予定には警告を表示し、チェックを外しておきます。
• 登録は自分で決める — 予定を選んで「カレンダーに登録」を押すまで、何も登録されません。
• Gemini のモデルや、終了時刻がないときの予定の長さを設定で選べます。
• Gmail の表示言語に合わせて日本語・英語で表示します。

ご自身の Gemini API キーで動作
CalCatch は、Google AI Studio で発行したご自身の API キーで Gemini API を呼び出します。CalCatch 独自のサーバーはなく、メールやカレンダーの内容が開発者に送られることはありません。Gemini API の料金は、API キーを発行した Google Cloud プロジェクトに請求されます。

Gemini API の無料枠では、送信した内容が Google の製品改善に使われ、人が読む場合もあります。メールには個人情報が含まれることが多いため、課金を有効にしたキーの使用を強くおすすめします。CalCatch はメールを送信する前に同意を求めます。

はじめかた
1. Google AI Studio で Gemini API キーを発行します。
2. Gmail のサイドパネルで CalCatch を開き、アドオンのメニューから「設定」を選びます。
3. API キーを貼り付けて保存します。

ソースコード：https://github.com/wisteria3221/calcatch（MIT ライセンス）
サポート：calcatch-support@googlegroups.com
```

## スクリーンショット（1280×800）

`marketplace/screenshots/{en,ja}/` の 4 枚を、言語ごとにこの順で登録する。
カードの構成と文言を src/ui.gs・src/i18n.gs に合わせて再現した合成画像で、メールと予定は架空のもの。
UI や文言を変えたら `node marketplace/screenshots/build.js` で作り直す（Google Chrome を使う）。

1. `1-events.png` — メールを開き、抽出された予定の一覧が出ている状態（メインの 1 枚）
2. `2-duplicate.png` — 重複の警告（赤）が出て、チェックが外れている予定を含む一覧
3. `3-added.png` — 登録結果と、登録した予定の説明欄に入る元メールへのリンク
4. `4-settings.png` — 設定画面（API キー・モデル・予定の長さ）
