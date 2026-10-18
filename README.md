# CalCatch

**English** | [日本語](#日本語)

CalCatch is a Gmail add-on that finds events written in an email with Gemini and adds them to Google Calendar.

- Open an email and CalCatch lists the events it found (date, time, place, notes).
- Events that look already registered in your calendar are flagged and unchecked by default.
- Check the ones you want and press **Add to Calendar**. Each event links back to the original email.
- Uses **your own Gemini API key** (set it in the add-on menu → **Settings**), so usage is billed to your own Google Cloud project.
- Choose the Gemini model (Standard / Lite / Pro / custom) in **Settings**.
- Japanese and English UI (follows your Gmail language).

> Status: in development. Not yet published on Google Workspace Marketplace.

## Development

The add-on is written in Google Apps Script and managed with [clasp](https://github.com/google/clasp).

```sh
npm install -g @google/clasp
clasp login
clasp push        # upload src/ to the Apps Script project
```

| Path | Contents |
| --- | --- |
| `src/appsscript.json` | Manifest (scopes, triggers, advanced Calendar service) |
| `src/Code.gs` | Triggers / actions and per-user settings |
| `src/gemini.gs` | Gemini API calls, retries/fallback, result normalization |
| `src/calendar.gs` | Calendar API access and duplicate detection |
| `src/ui.gs` | Card UI |
| `src/i18n.gs` | Japanese / English strings |

Each user's Gemini API key and model choice are stored in their own User Properties. No API key is stored in this repository.

### OAuth scopes

| Scope | Why |
| --- | --- |
| `gmail.addons.execute` | Run as a Gmail add-on |
| `gmail.addons.current.message.readonly` | Read the email that is currently open |
| `calendar.events.owned` | Check for duplicates and add events on calendars you own |
| `calendar.calendarlist.readonly` | List your calendars and read your calendar time zone |
| `script.external_request` | Call the Gemini API |
| `script.locale` | Show the UI in your Gmail language |

---

## 日本語

CalCatch は、メール本文に書かれた予定を Gemini で読み取り、Google カレンダーに登録する Gmail アドオンです。

- メールを開くと、見つかった予定（日時・場所・メモ）を一覧表示します。
- カレンダーに登録済みと思われる予定には警告を表示し、最初からチェックを外しておきます。
- 登録したい予定にチェックを入れて「カレンダーに登録」を押すと登録されます。予定の説明欄には元のメールへのリンクが入ります。
- **利用者自身の Gemini API キー**を使います（アドオンのメニュー →「設定」で設定）。料金は利用者自身の Google Cloud プロジェクトに請求されます。
- 「設定」で Gemini のモデル（標準・軽量・高精度・直接入力）を選べます。
- 画面は日本語と英語に対応しています（Gmail の表示言語に合わせます）。

> 状態：開発中。Google Workspace Marketplace にはまだ公開していません。

## 開発

Google Apps Script で作成し、[clasp](https://github.com/google/clasp) で管理しています。

```sh
npm install -g @google/clasp
clasp login
clasp push        # src/ の内容を Apps Script プロジェクトに反映
```

Gemini の API キーとモデルの選択は、利用者ごとのユーザープロパティに保存します。このリポジトリに API キーは含まれていません。

## License

[MIT](LICENSE)
