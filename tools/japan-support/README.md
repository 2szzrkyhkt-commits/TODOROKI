# JAPAN SUPPORTの既存Cron接続

既存Cloudflare Workerの取得済みソースを基準に、収集機能だけを既存EDINET Cronから呼び出す。新しいCron、一般公開URL、認証除外、秘密値の複製は追加しない。

- support worker：既存fetchとAccess判定をそのまま保持。内部専用のSupportCollector.runだけを追加する。
- coordinator：既存5分Cron・EDINET処理・30分ごとの税法呼出を維持。独立したwaitUntilでSupportCollectorを呼ぶ。supportの失敗は他処理へ伝播させない。
- 取得元：既存D1に登録された有効・許可確認済みの固定URLだけ。commercial/reproduction/modificationとautomated_access、reviewed_atを確認し、不明なら拒否する。現状はe-Gov児童手当法の改正メタデータ1取得元のみ。
- 頻度：Cronからの確認は5分ごとだが、実取得はsources.next_attemptと既存interval_seconds（最低1時間）に従う。1回に1資料、既存リースで重複実行を抑止する。
- 変更データはrevisionsにpendingとして保存する。受給条件、支給額、公開状態は自動で更新しない。
- 既存データは削除しない。同じ本文ハッシュは重複保存しない。3回以上の連続失敗は未解決incidentを重複作成しない。
- 外部APIは15秒、512KiBまで。転送は自動追跡しない。失敗時の指数バックオフと正常な旧データの保持を継承する。

`node test.mjs`：許可不足の拒否、本文上限、無効時停止、公開403維持、RPCのenv、既存税法の時刻、support例外の分離を検証。

## 配備・復元

Workers APIのinherit bindingを利用して既存設定を保持する。秘密値を読み出さない。SupportCollector用のService bindingのみをcoordinatorに追加する。2つのWorkerの現在のコードとCronを確認してから実施する。

復元時はCloudflareの直前バージョンへ戻す。coordinatorから追加のSUPPORT_COLLECTOR呼出を外すと、支援データ収集だけを停止できる。DB、EDINET/税法の既存bindingsとCron、Accessは維持する。既存の支援制度テーブルを復元・初期化しない。

## 完了とは区別する範囲

内部収集の接続は制度網羅・受給条件や金額の正確性・一般公開の完成を意味しない。法改正検知は人の確認が必要な候補であり、法的判断・自動支給判定を行わない。新たな取得元の許可確認も自動では行わない。
