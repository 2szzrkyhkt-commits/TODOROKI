# GSC検索掲載の精査とサイトマップ24件補完 — 2026-11-17

既存TODO T02の継続。sc-domain:todoroki-gold.comの所有者管理画面を読み取り、必要な公開テストと登録依頼を実施した。新しいTODO・予約・広告設定は作らない。

## 実装した修正：サイトマップの掲載漏れ24件

最新mainのGit tree全件（truncated=false）と公開チェックを照合し、indexable HTML195件に対してsitemap.xmlが171件しかない問題を検出した。欠落24ファイルすべての現行main本文を取得し、noindexでないことと正しい自己canonicalを確認した。既存171 URLを維持して24 URLを追加し195件へ補完する。lastmodは推測して追加しない。login/pdf-viewerの意図的noindexは除外したまま。全195件の想定URLとの集合一致と重複0を検証した。

追加対象：
- /advantest-6857-earnings-analysis-2026
- /agi
- /ai-gold-rush-bits-atoms
- /arbitrage-trading
- /behavioral-economics
- /fujikura-earnings-analysis-2026
- /furukawa-electric-5801-earnings-2026
- /government-owned-shares
- /jt-russia-earnings-analysis-2026
- /kioxia-earnings-analysis-2026
- /kokusai-electric-6525-earnings-2026
- /ngk-5333-valuation-2026-nov
- /olympus-7733-earnings-2026
- /recruit-6098-earnings-2026
- /regulatory-capture-explained
- /renesas-earnings-analysis-2026
- /rohm-6963-earnings-2026
- /sk-kaken-earnings-analysis-2026
- /softbank-group-9984-earnings-2026
- /starts-8850-earnings-2026
- /sumitomo-electric-earnings-2026
- /sumitomo-metal-mining-5713-earnings-2026
- /taiheiyo-cement-5233-valuation-2026-nov
- /tax-study

publication.pyにindexable HTML sitemap coverage検査を追加し、新しい公開記事のサイトマップ掲載漏れをCIで失敗させる。非公開/noindexを機械的に追加しない。単なるsitemap内URLの同一オリジン検査では検出できなかった欠落を補う。

## 管理画面で確認した現在の集計

登録済み540、未登録911。これは確認時に画面に出た集計で、全URLを今日再クロールした結果ではない。

|除外理由|件数|判定・対応|
|---|---:|---|
|404|13|以前の旧URL対応と意図的404の判断を維持。全削除URLを無関係なトップページへ転送しない|
|noindex|785|既存の意図的除外を維持。今回の新規解除なし|
|リダイレクトあり|79|別名転送と正規ページを区別。除外数を0にするため転送を廃止しない|
|適切なcanonicalの代替|9|正規選択がある代替URL。意図的除外と扱う|
|正規未指定の重複|5|M&A2件と既存PDF別名3件。既存canonical実装を重複修正しない|
|他の4xx|2|下記終了済み購入API。記事ではない|
|401|1|下記終了済み有料配信API。認証を外して検索掲載しない|
|クロール済み未登録|3|公開PDF2件と終了済みAPI1件。登録完了とは扱わない|
|リダイレクトエラー|8|Google側の修正検証は「開始」のまま。合格とは扱わない|
|検出済み未登録|6|下記6URL。公開記事2件を今回検査・登録依頼|

## 未確認だった4xx/401のURL

- /api/purchases/confirm — GSC前回クロール2026-10-28
- /api/checkout — 同2026-10-28
- /api/download/okamura-7994 — 同2026-10-26

現在mainのworker.jsではいずれも既存RETIRED_SALES_PATHSの対象で、410/noindex/no-storeを返す実装。決済・ダウンロードを起動せずGETだけを監査対象にする。古いGSCの400/401を現在の記事障害と解釈しない。既存の認証・販売終了処理を変更しない。

この3経路の本番410/noindex・両サイトマップ非掲載をpublication.pyの読取監査へ追加した。HTTPErrorで失われていたX-Robots-Tagの証拠を保持し、403等の取得不能は合格でなくinconclusiveのまま。GETが200へ戻る・noindex欠落・サイトマップ混入を検出する。新規3テストを含むpublicationの10テスト成功。終了済みAPIを検索へ戻す修正はしない。

## 公開記事の実行結果

|URL|Google公開テスト|登録依頼|
|---|---|---|
|/mhi-7011-earnings-analysis-2026|2026-11-17 10:47 JST「URLはGoogleに登録できます」|受付画面「インデックス登録をリクエスト済み」、優先クロールキュー追加を確認|
|/ntt-2026-q2-earnings-valuation|2026-11-17 10:48 JST 同上|同じ受付完了を確認|

両記事はGSC検査時「検出・未クロール」、サイトマップは検出されていた。登録依頼を送った事実と検索結果への掲載完了を区別する。重複送信は行わない。

検出済み6件の残り：/break-even/、/calculators/、/compound-interest/、/us-equity。今回はこれらの個別ライブテスト・登録依頼は未実施。

クロール済み未登録3件：/pdf/en/physical-ai.pdf、/api/shop、/pdf/PHPの重大な脆弱性と対策_PHP2Shell.pdf。/api/shopは終了済み販売経路、PDF2件のGoogle再評価は未確認。

重複5件：/pdf/M%26Aと資本配分_企業価値を高める再編の見方.pdf、/pdf/日本企業_M%26A産業再編_黒金4P.pdf、/pdf/Amazon輸入ビジネス_価格差と相乗り販売_修正版.pdf、/pdf/社会的選好_情報共有_フリーライド_黒金.pdf、/pdf/社会的選好と情報共有_仕事仲間の協力_改訂版.pdf。既存workerのNFC正規化と正規PDF Linkを確認し、再実装しない。

## 本番確認の根拠と限界

GitHub Actions43996398007/job133750313253（main eb17730、2026-11-17 10:37 JST）の本番公開チェックはads.txt/robots/両sitemapの200、8つの.html別名の正規200・canonical、既存PDF canonical等が成功した。今回の実行環境からのHTTPは403であり、その403を一般公開障害やGoogle取得不能と断定しない。Google自身の公開テスト2件が到達・登録可能と確認したことを優先する。

T02全体は未完了。Googleの転送検証8件の合格、PDFの再評価、残り検出URL等の確認が残る。45項目のチェック数は18/45を維持。AdSense、日米比較、既存定期タスク3件・Cron・認証・データの変更なし。
