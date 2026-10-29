# TODOROKI 任意支援の実装・受付開始条件

2026-10-29。受付停止で実装。実課金・Stripeへの申立て送信・本番シークレット設定は未実施。

## Stripe側の未解決事項

本人確認済み、charges_enabled/payouts_enabledはtrue。ただしverification_supportabilityの再審査要求がcurrently_dueにある。登録事業説明も有料記事・PDF販売のまま。これらのフラグだけで投げ銭の承認済みとは判断しない。Stripeへ実態を正確に説明し、無料の投資・経済メディアへの対価・特典なしの任意支援が利用可能か確認する。名称変更による審査回避は行わない。

提出文案（未送信）:

「TODOROKI（https://todoroki-gold.com/）の事業内容の再確認をお願いします。以前登録した有料記事・PDF販売は終了し、現在は投資・経済・企業分析に関する記事・PDFを無料公開しています。今後、無料コンテンツ制作とサイト運営に対する任意の一回払い支援（300円、500円、1,000円、3,000円）を導入したいと考えています。支援者への限定記事、個別相談、投資助言、利益や運用成果の保証などの特典・対価は設けません。サイトには投資・企業分析の内容が含まれるため、このモデルがStripeの利用対象となるか、必要な条件とともに審査をお願いします。承認を確認するまで受付は有効化しません。」

## 配置と必要な設定

- worker.jsからsupport-payments.mjsを呼ぶ。既存ログイン処理は維持。
- support.htmlとsupport.jsは自サイトの支援画面。OFUSEへのリンクは使用しない。
- support.sqlを既存D1 DBへ適用する。node --test tests/support.test.mjsで単体検証。
- CloudflareのシークレットにSTRIPE_RESTRICTED_KEY（Checkout Sessions書込の最小権限）とSTRIPE_WEBHOOK_SECRETを設定。コードやGitHubへ値を書かない。接続したStripeプラグインの資格情報はWorkerへ自動転送されない。
- 検証用のStripe環境でWebhookを /api/support/webhook に登録。checkout.session.completed / checkout.session.async_payment_succeeded / checkout.session.async_payment_failed を購読し、署名と通知の再送を検証。
- STRIPE_MODEはtestまたはlive。SUPPORT_ENABLEDとSUPPORT_APPROVEDの両方が文字列trueで、必要なシークレットとDBが揃う時のみ受付。設定が無い時は503で停止。
- 本番承認後にライブ用設定へ切替。金額・支払先表示・キャンセル・返金対応・領収表示を確認して受付開始する。
- 戻り画面は決済成功を断定しない。通知のpayment_statusがpaidの場合のみDBへpaidを保存。通知再送はsession_idの主キーで重複防止。
- support_attemptsは同じIDの再利用による二重決済防止のため23時間で受付不可。失敗時もIDは維持し、別金額では再利用しない。
- 運用時は古いsupport_limitsと失効したsupport_attemptsを定期削除する。決済・通知記録の保持期間は別途運用方針を決める。

## 検証範囲

6件のローカル単体テストを実施。停止中にStripeへ送信しない、承認フラグ、Origin/金額検証、同一リクエストキー、通知の署名・期限・改ざん、重複通知とpaidの保持を確認。Stripe API/Cloudflare/D1本番を使用した結合テストとブラウザ表示確認は未実施。
