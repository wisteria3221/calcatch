# OAuth アプリの確認申請

Google Auth Platform（プロジェクト `calcatch-wisteria`）の「確認センター（Verification Center）」から申請する。
必要なものは、スコープごとの使い道の説明（英語）と、デモ動画（YouTube に限定公開でアップロード）。

## スコープの説明（申請フォームに貼る）

| スコープ | 説明（英語） |
| --- | --- |
| `gmail.addons.execute` | Required to run CalCatch as a Gmail add-on and show its cards in the Gmail side panel. |
| `gmail.addons.current.message.readonly` | CalCatch reads only the email the user is currently viewing (subject, sender, received date and body) so that it can find the events written in it. It cannot access any other email. |
| `calendar.events.owned` | CalCatch reads events on calendars the user owns, only around the dates found in the email, to warn about events that are already registered. When the user checks events and presses "Add to Calendar", it creates those events on the user's primary calendar. It never changes or deletes existing events. |
| `calendar.calendarlist.readonly` | Used to get the time zone of the user's primary calendar and the list of calendars the user owns, which are the calendars checked for duplicate events. |
| `script.external_request` | Used to send the open email to the Google Gemini API with the user's own API key to extract events. No other external service is called. |
| `script.locale` | Used to show the add-on in the user's Gmail display language (English or Japanese). |
| `userinfo.email` | Used to build the link back to the original email (`https://mail.google.com/mail/u/<email>/#all/<threadId>`) that is added to each event, so that the link opens the right account when the user is signed in to several accounts. |

なぜ狭いスコープでは足りないかを聞かれたときの回答：

- `calendar.events.owned` は、全権限の `calendar` や `calendar.events` ではなく、ユーザーが所有するカレンダーの予定に限ったスコープ。重複チェック（読み取り）と登録（作成）の両方に使うので、`calendar.events.readonly` だけでは足りない。
- メールは `gmail.readonly` ではなく、開いているメールだけを読める `gmail.addons.current.message.readonly` を使っている。

## デモ動画の撮影前の準備

1. **Google アカウントの表示言語を英語にする**（https://myaccount.google.com/language）。審査担当者が読めるよう、同意画面と CalCatch の画面を英語で見せる。撮影後に日本語へ戻す。
2. **CalCatch の設定画面で「API キーを削除」を押す**。アクセス権を削除しても保存済みのキーと同意は残るため、先に消しておかないと手順 7・8 の画面が出ない（キーを削除すると同意も取り直しになる）。
3. **CalCatch へのアクセス権をいったん削除する**（https://myaccount.google.com/connections → CalCatch → 削除）。同意画面を最初から映すため。
4. **デモ用のメールを自分宛てに送る**。スクリーンショットと同じ架空の内容（下記）を使う。
5. デモ用メールの予定のうち 1 件（Volunteer info session, 11/5 19:00–20:00）を、あらかじめカレンダーに登録しておく（重複の警告を映すため）。
6. 画面録画は macOS の「スクリーンショット」アプリ（⇧⌘5）で、Chrome のウィンドウ全体を撮る。音声なしでよい（字幕は YouTube 上か編集で入れる。入れなくても、下の字幕の内容が画面でわかれば足りる）。

デモ用メール（件名・本文）：

```
Subject: Autumn Community Meetup & volunteer info session

Hi everyone,

Our Autumn Community Meetup is coming up again this year. Bring your friends and family!

Autumn Community Meetup
Date: Saturday, November 14, 1:00–4:00 PM
Place: Greenfield Community Center, Hall 2F
Admission: $5 at the door. Please bring indoor shoes.

If you are volunteering on the day, please join the info session beforehand:
Volunteer info session
Date: Thursday, November 5, 7:00–8:00 PM
Place: Online (Google Meet)

See you there!
Greenfield Community Events
```

## 台本（3〜4 分）

各場面の「字幕」は動画に入れる英語の説明文。

| # | 画面での操作 | 字幕 |
| --- | --- | --- |
| 1 | https://calcatch.wisteria.xyz/ を表示し、ゆっくりスクロールする | CalCatch is a Gmail add-on that adds events written in emails to Google Calendar. |
| 2 | プライバシーポリシーのページを開く | Privacy policy: https://calcatch.wisteria.xyz/privacy.html |
| 3 | Gmail を開き、デモ用メールを開く。右のサイドパネルで CalCatch のアイコンを押す | The user opens an email and opens CalCatch in the Gmail side panel. |
| 4 | 「Authorize access」を押し、アカウントを選ぶ | CalCatch asks the user to authorize access. |
| 5 | **同意画面を表示したまま、ポップアップのアドレスバーをクリックし、URL の `client_id=358436174527-…` の部分が見えるようにする**（見えにくければ URL をコピーして通常のタブに貼る）。アプリ名「CalCatch」と各スコープの一覧を映す | OAuth consent screen. App name: CalCatch. Client ID is shown in the address bar. |
| 6 | 「Allow」を押す | The user grants access. |
| 7 | CalCatch のカード「Set up your API key」が出る。「Open settings」で設定を開き、Gemini API キーを貼って「Save」（キーは映らないよう、貼ったあとすぐ保存する。ヒントの末尾 4 文字は映ってよい） | The user enters their own Gemini API key. CalCatch has no server of its own. |
| 8 | メールに戻ると同意カード「About sending your email」が出る。文面を映してから「Agree and continue」 | Before sending any email to the Gemini API, CalCatch asks for the user's agreement. |
| 9 | 予定の一覧（Events found）が出る。2 件の予定と日時・場所を映す | Scope gmail.addons.current.message.readonly: CalCatch reads only the email currently open and finds the events in it. |
| 10 | 1 件目に赤い警告「Probably already in your calendar」が出て、チェックが外れていることを映す | Scope calendar.events.owned (read) and calendar.calendarlist.readonly: CalCatch checks the user's own calendars around these dates and warns about an event that is already registered. |
| 11 | 2 件目だけチェックが入った状態で「Add to Calendar」を押す。登録結果のカードを映す | Scope calendar.events.owned (create): only the events the user checks are added, after the user presses "Add to Calendar". |
| 12 | 「Open Google Calendar」を押し、登録された予定を開く。説明欄の「Original email: https://mail.google.com/mail/u/…」を映し、リンクを押して元のメールに戻る | Scope userinfo.email: each event links back to the original email, using the user's email address so the link opens the right account. |
| 13 | Gmail の CalCatch で「Settings」を開き、モデル・予定の長さ・プライバシーポリシーへのリンクを映す | The user can change the Gemini model and remove the API key at any time. |
| 14 | （任意）https://myaccount.google.com/connections で CalCatch のアクセス権を確認し、削除できることを映す | Users can revoke CalCatch's access from their Google Account at any time. |

撮影後：

1. YouTube に「限定公開（Unlisted）」でアップロードし、URL を申請フォームに貼る。
2. Google アカウントの表示言語を日本語に戻す。
3. 申請後、審査担当者からメール（yusuke42@gmail.com 宛て）で質問が来ることがある。届いたら内容を共有してもらえれば、返信の文面を用意する。
