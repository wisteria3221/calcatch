# CalCatch

**English** | [日本語](#日本語)

CalCatch is a Gmail add-on that finds events written in an email with Gemini and adds them to Google Calendar.

- Open an email and CalCatch lists the events it found (date, time, place, notes).
- Events that look already registered in your calendar are flagged and unchecked by default.
- Check the ones you want and press **Add to Calendar**. Each event links back to the original email.
- Choose the Gemini model (Standard / Lite / Pro / custom) from the add-on menu → **Settings**.

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
| `src/appsscript.json` | Manifest (scopes, triggers, add-on name) |
| `src/Code.gs` | Triggers, Gemini call, duplicate check, card UI, calendar registration |

The Gemini API key is stored in Script Properties (`GEMINI_API_KEY`) and is never committed to this repository.

---

## 日本語

CalCatch は、メール本文に書かれた予定を Gemini で読み取り、Google カレンダーに登録する Gmail アドオンです。

- メールを開くと、見つかった予定（日時・場所・メモ）を一覧表示します。
- カレンダーに登録済みと思われる予定には警告を表示し、最初からチェックを外しておきます。
- 登録したい予定にチェックを入れて「カレンダーに登録」を押すと登録されます。予定の説明欄には元のメールへのリンクが入ります。
- アドオンのメニュー →「設定」で、Gemini のモデル（標準・軽量・高精度・直接入力）を選べます。

> 状態：開発中。Google Workspace Marketplace にはまだ公開していません。

## 開発

Google Apps Script で作成し、[clasp](https://github.com/google/clasp) で管理しています。

```sh
npm install -g @google/clasp
clasp login
clasp push        # src/ の内容を Apps Script プロジェクトに反映
```

Gemini の API キーはスクリプトプロパティ（`GEMINI_API_KEY`）に保存しており、このリポジトリには含めていません。
