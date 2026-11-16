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

## T28 更新停止・制度終了の監視

既存SupportCollector.runの収集後、保存済みのsources/programs/revisionsだけを監視する。新しいCron、外部通信、公開APIは作らない。監視保存の失敗は収集結果へmonitor.status=failedを付け、成功した収集を取り消さない。収集そのものが例外の場合も監視を試行してから元の例外を伝える。

- 取得元：無効、規約未確認、収集一時停止、未取得、時刻未確認、周期内、更新停止を区別する。更新停止は最終成功からmax(2周期, 1周期+1時間)を超過した状態。元資料が変化しないだけでは停止にしない。取得失敗回数と未確認の改定候補数を別記する。
- 制度終了：verification=verifiedかつ過去のverified_atを持つレコードのみを使用。明示されたended状態、または確認済みeffective_period_json.toの日を日本時間で過ぎた場合に終了を検知する。終了日は当日中を含む。申請期間の締切はapplicationState=closedであり制度終了ではない。未確認/不正な期日、収集失敗、法改正、取得元削除から終了を推定しない。
- 元のprograms.status・条件・金額を自動変更せず、監視用2テーブルへ記録する。資料の適用日・金額の法的判断や制度の網羅性はT24–27/T29で別途検証する。現在のpending制度を自動的に公開可能とはしない。
- monitor-schema.sqlは専用D1へ追加のみ適用する。support_monitor_latestは各対象の最新状態・確認時刻、support_monitor_historyは初回と状態変更だけを保存する。履歴挿入と最新状態更新は対象ごとに同一トランザクション。古い監視呼出で最新状態を巻き戻さない。同一状態は履歴を重複追加しない。定期処理を止めてもデータは削除しない。
- 所有者は専用D1のSELECTでentity_key/state_json/checked_atと履歴を確認できる。新しいログイン除外経路は設けず、既存fetchの403/Accessロックを保持する。外部への通知送信は行わない。
- テスト：node test-monitor.mjs（Node 24のnode:sqlite、実SQLiteでの状態遷移/履歴/rollbackを検証）、node test.mjs（既存の認証・RPC・税法周期・障害分離の回帰）。本番のprogramsやsourcesへテスト値を注入しない。

## T25 出典付き条件データ

現在の収録対象は児童手当1制度。conditions-data.jsは公式案内・Q&A・所得制限案内・現行施行の児童手当法第4条から編集した25入力項目・16条件。各条件に出典/節/資料確認日/原資料ハッシュ、型、未入力の取扱い、個別確認の要否を付ける。年齢は高校在学の有無ではなく法定の年度末範囲。留学・再留学・父母指定・未成年後見・複数養育者の優先・別生計/同居・施設/里親・短期入所・公務員の申請先・認定請求/15日手続を分ける。

これは条件を照合・保管する機能で、個人の受給可否の判定エンジン（T26）や金額計算（T27）ではない。制度の全体verification/statusをverified/activeへ昇格させない。過去の所得証明等の必要書類から所得制限を復活させず、現行の所得制限なしを独立データにする。個別確認の枝は自動判定不可として保持する。

conditions-evidence.jsonは確認した4原資料のURL・取得日時・SHA256、法令のCurrentEnforced版IDのみを保存し、本文・画像は転載しない。公式資料をTODOROKIが項目へ編集した旨を記載。取得元の自動アクセス許可、enabled、next_attemptは変更しない。静的確認日以降の改正を自動で確認したとは表示しない。

conditions-schema.sqlで専用D1に版テーブルを追加。既存SupportCollector.runの末尾で保存する。既存programsの自由文は保持し、新規資料は別版として追加する。同じ版と同じハッシュなら無書込、同じ版に異なる内容なら失敗とする。監視・収集が成功しても条件保存が失敗した場合はconditions.status=failedを記録する。Cron・タスク・bindingsの変更は不要。

既存Access判定内のGET /api/conditions?program_id=jp-child-allowanceで出典付きJSONを読める。公開ロックを解除する経路はない。所有者のD1 SELECTでもdocument_json/content_hash/stored_atを確認できる。読取時にハッシュとスキーマを検証する。未入力・未確認はnull/要確認でありfalseではない。条件入力の実データは保存しない。

検証：node test-conditions.mjs（92検証）、node test-monitor.mjs（59検証）、node test.mjs（既存認証/RPC/税法周期回帰）。T25は現在収録制度の条件構造と保管経路が対象。追加制度の網羅と原本照合はT24、一般公開はT29で継続する。
