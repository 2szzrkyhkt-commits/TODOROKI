# T41 定期実行の重複・無料枠消費の確認

確認日：2026-11-17（日本時間）。T41は未完了。21/45を維持する。

## 実測範囲

Cloudflare GraphQL workersInvocationsAdaptiveをscriptNameごとに集計。
期間は2026-11-16 00:00–11-17 00:00 UTC（日本時間11/16 09:00–11/17 09:00）。
8 Workerに合計11,559 invocations、errors 51。Adaptive計測値は課金明細やCron起動専用ログと同一ではない。
本体10,619、EDINET288、EDGAR285、米国統計24、税法48、支援293、SLOT本体1、collector1。
台帳中で行が返らなかったstaging/LIFEを0と補完しない。
EDINETの48、EDGARの1、米国統計の2 errorsはscriptThrewException。
本体にはclientDisconnected4があるがerrorsは0。successを収集元の正常取得証拠としない。

同期間のd1AnalyticsAdaptiveGroupsはrowsRead5,887、rowsWritten805。
現時点のD1メタデータ5件のfile_sizeは49,152/339,968/118,784/81,920/139,264 bytes、合計729,088 bytes。
行の実データ・個人情報・KV値は取得しない。保存容量は一日集計でなく確認時点のスナップショット。

公式Free参照上限はWorkers100,000requests/UTC日、D1読取5,000,000行/日、書込100,000行/日、全体保存5GB。
実測との参照比率は11.559%/0.11774%/0.805%。現在の契約がFreeであることや請求0円を保証しない。
workers/account-settingsのdefault_usage_model=standardだけではFree/Paidを判定しない。
subscriptions読取は403：既存OAuthはBilling Readを扱えない。別トークン・権限追加・迂回は実施しない。
KV/R2利用量、現行契約・請求、全期間の消費確認は未完了。T41チェックの根拠には不足する。

## SLOTの同時刻起動

現行10 WorkerのCronは台帳と一致。EDINET/EDGARは5分毎、米国統計はUTC毎時17分。
SLOT本体/collectorはいずれも0 1 * * *（10:00 JST）。他6 WorkerはCronなし。
現行配備ソースを読取照合すると本体scheduledはcollection disabledのscaffoldログのみ。
実収集はcollectorのrunCollectionだけで、D1にdaily leaseを持つ。
allowed=1かつ規約/robots確認・有効な許可資料のある取得元だけを対象とする。
したがって同時刻設定だけで二重収集と断定しない。実測の両者subrequests=0とも整合する。
本体の1回起動は残っているが、利用者の変更禁止に従いCronを変更/削除しない。
ロックの全競合条件や全期間の二重書込が不存在という証明ではない。

## 再現手順と安全境界

docs/cloud-usage-2026-11-17.jsonは集計値だけの記録。秘密値/個別URL/アクセス元を含めない。
tools/cloud-usage/report.mjsのassessでネットワークなしに集計可能。
report.test.mjsで欠測・二重加算・UTC期間・超過・未確認契約を検証する。
既存security.test.mjsから実行するが、監査時のCloudflare通信や予約実行は追加しない。
この変更は運用検証コードと証拠のみ。本番ページ・広告・収集コード・データ・権限・スケジュールは変更しない。

## 公式参照（確認日11/17）

- https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://www.cloudflare.com/plans/
- https://developers.cloudflare.com/d1/reference/faq/

次の残作業は既存権限で確認可能なKV/R2計測経路と契約判定の確認。
本人操作が必要な請求画面確認は安全な回線利用時まで保留し、他TODOを止めない。
