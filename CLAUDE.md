# CalCatch — 開発メモ（Claude Code 向け）

メール本文に書かれた予定を Gemini で抽出し、Google カレンダーに登録する Gmail アドオン（Google Apps Script）。
Google Workspace Marketplace での一般公開を目指している。オーナーとのやり取りは日本語。

## 主要な情報

| 項目 | 値 |
| --- | --- |
| GitHub | https://github.com/wisteria3221/calcatch（public, MIT） |
| Apps Script プロジェクト | scriptId は `.clasp.json` を参照（Google アカウント yusuke42@gmail.com 所有） |
| サイト（GitHub Pages, `docs/`） | https://calcatch.wisteria.xyz/ （英語） / `/ja/` （日本語） |
| ドメイン | `wisteria.xyz`（ConoHa で取得・DNS 管理）。`calcatch` の CNAME → `wisteria3221.github.io` |
| Cloud プロジェクト | `calcatch-wisteria`（名前 CalCatch、プロジェクト番号 358436174527）。請求先アカウントは未紐付け |
| サポートメール | `calcatch-support@googlegroups.com`（Google グループ「CalCatch Support」、オーナー yusuke42@gmail.com。外部から投稿可・会話は管理者のみ閲覧） |
| 公開用デプロイ | `AKfycbyIeh-7N6-rxpM5FFfAMDdhqFVhB6wZAprrxz_fFP0FdBEgv3SKy-vbKWqjLcg5WuI8Qg`（Marketplace SDK に指定。現在 version 1） |
| Search Console | `wisteria.xyz` をドメインプロパティとして所有確認済み（OAuth の承認済みドメイン用） |

## 構成

```
src/            Apps Script のソース（clasp の rootDir）
  Code.gs       トリガー・アクション（入口）、ユーザー設定の読み書き、抽出の流れ
  gemini.gs     Gemini API 呼び出し（再試行・予備モデル）、エラー分類、抽出結果の正規化・時刻パース
  calendar.gs   Calendar API（高度なサービス）での読み書き、既存予定との重複判定
  ui.gs         カード UI（CardService）、日付の表示形式
  i18n.gs       日本語・英語の文言（MESSAGES）、setLocale_ / t_
  appsscript.json  マニフェスト（スコープ・トリガー・高度なサービス）
docs/           公開サイト（ホーム・プライバシーポリシー・利用規約、英日）
tests/run.js    Apps Script のサービスを模擬した Node のテスト
```

Apps Script はすべての `.gs` を同じグローバルスコープで読み込む。トップレベルの `const` 名がファイル間で重複しないこと。

## 開発の流れ

```sh
npm install          # 初回のみ（テスト用に luxon を入れる）
npm test             # src/ を模擬環境で動かす。すべて PASS であること
clasp push           # Apps Script に反映（npm run push でテスト → push）
```

- `clasp push` の前提：`clasp login` 済み、かつ https://script.google.com/home/usersettings で Apps Script API がオン。
- 動作確認は Gmail で行う（テストデプロイ「Test latest code」をインストール済みなので、push すれば最新コードで動く）。マニフェストのスコープを変えたときは、Gmail 側で再承認が必要。
- 変更したら `npm test` → `clasp push` → Gmail で確認 → コミット・プッシュ。
- マニフェストを変えたときの `clasp push` は確認待ちで「Skipping push.」になるので `clasp push --force` を使う。
- 公開版を更新するとき：`clasp create-version "説明"` → `clasp create-deployment -i <公開用デプロイの ID> -V <新しい版>`（デプロイ ID は変えない。Marketplace SDK の設定はそのまま）。

## コーディング上の決まり

- **文言は必ず i18n.gs に追加**し、`ja` と `en` の両方に同じキーを入れる（テストでキーの過不足を検査している）。画面の言語は Gmail の表示言語（`userLocale`）で決まる。
- **カードのテキストは HTML として解釈される**。予定名・場所など外部由来の文字列は `escapeHtml_()` を通す。DecoratedText の topLabel / bottomLabel は plain text。
- **抽出のしかた（プロンプト・スキーマ・正規化）を変えたら `EXTRACT_VERSION` を上げる**（古いキャッシュを使わないため）。
- **スコープは最小限に保つ**。追加・変更すると OAuth 審査の申請内容とサイトのプライバシーポリシー（`docs/privacy.html` と `docs/ja/privacy.html`）の更新が必要。
- 外部リンクを開く URL は `appsscript.json` の `openLinkUrlPrefixes` に含めること。
- API キーなどの秘密情報はコミットしない。Gemini の API キーは利用者ごとにユーザープロパティ（`GEMINI_API_KEY`）へ保存する。

## これまでの主な決定事項

- 開いた瞬間に抽出する（ボタンなし）。抽出結果はメール×モデルごとに CacheService へ 6 時間キャッシュ。カレンダーとの重複チェックは毎回最新で行う。
- 重複の警告は赤 1 色。「登録済みの可能性が高い」「似た予定がある」の違いは文言で表す。重複候補は最初からチェックを外す。
- モデルは設定画面で選択（標準 `gemini-flash-latest` / 軽量 `gemini-flash-lite-latest` / 高精度 `gemini-pro-latest` / 直接入力）。画面にはエイリアス ID ではなく「標準」などの名前を出す。混雑時は軽量モデルに切り替え、その旨を表示。
- API キーは利用者自身のもの（開発者のキーを共有で使う処理はない）。
- カレンダーのスコープは `calendar.events.owned` + `calendar.calendarlist.readonly`（全権限の `calendar` は使わない）。
- 公開サイトとプライバシーポリシーは GitHub Pages（独自ドメインのサブドメイン）。問い合わせ先はサポートメール（Google グループ）と GitHub Issues。

## 公開までの残り作業

ブラウザ（Google のコンソール画面）でしかできない作業は、手順を案内してオーナーに操作してもらう。支払い・同意・承認はオーナーが行う。

- [x] GitHub Pages の「Enforce HTTPS」をオン
- [x] 標準の Google Cloud プロジェクト「CalCatch」を作成（ID `calcatch-wisteria`。`calcatch` は他者が使用済み）
- [ ] 請求先アカウントを紐付け（オーナーが判断・実行）。予算アラートを設定
- [x] API を有効化：Google Workspace Marketplace SDK（`appsmarket-component.googleapis.com`）、Google Calendar API（`calendar-json.googleapis.com`）
- [x] OAuth 同意画面（Google Auth Platform）：アプリ名 CalCatch、外部公開、ホーム／プライバシー／規約の URL、承認済みドメイン `wisteria.xyz`、スコープ 6 つ
- [x] ユーザーサポートメール：Google グループ `calcatch-support@googlegroups.com` を作成、外部からの受信を確認済み
- [x] アイコンを作成（`docs/images/`。封筒＋カレンダーのバッジ。96px 以上は `icon.svg`、48px 以下は線を太くした `icon-small.svg` から書き出し。マニフェストの logoUrl は `icon-48.png`）
- [x] Apps Script プロジェクトを新しい Cloud プロジェクト（プロジェクト番号）に紐付け
- [x] バージョンを固定したデプロイを作成（Marketplace SDK に指定する）
- [ ] Marketplace SDK の設定と掲載情報（説明文・スクリーンショット、日英）
- [ ] OAuth アプリの確認を申請（スコープの使い方を示すデモ動画が必要。台本はこちらで用意）
- [ ] Marketplace の審査に申請、指摘に対応

## 補足

- Apps Script 上のメインファイル名は「コード.gs」のままになっている。最初の `clasp push` で `Code.gs` に置き換わる。
- アドオンのメニュー（universal action）のラベルはマニフェストで多言語化できないため「Settings / 設定」としている。
- Gemini の無料枠では送信内容が Google のサービス改善に使われうるため、設定画面とプライバシーポリシーで告知している。
