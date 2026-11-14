# TODOROKI共通データAPI v1設計

状態：設計完了、未実装・未公開。唯一のタスク管理元はTODOROKI-TODO.mdの「共通データAPIの設計」。この文書は別のToDoを作らない。

## 構成と費用

データの所有者は既存の各プロジェクトのままにする。既存Workers/Sitesの読み取りアダプターをTODOROKI側から利用し、R2/D1の全データ複製や独立した収集キューは作らない。新しいCron・定期タスク・有料APIは設計に含めない。呼び出しは利用者の検索時だけとし、既存の更新時刻・保存先を参照する。接続できないプロジェクトはpartialと理由を返す。サービス間の接続には、実装時に用途を限定した内部Service bindingまたは既存の認証済みAPIを使う。

API公開は別の実装・検証工程。ここで示すパスは契約であり、現在アクセスできるURLではない。既存のAccessやログインを緩めて公開してはならない。

## 契約

|メソッド・パス|所有プロジェクト|返すもの・範囲|
|---|---|---|
|GET /v1/companies/{market}/{company_id}/annual|日本/米国企業分析|通期最大10期。提出資料ID・決算日・連結/個別・会計基準と単位を保持|
|GET /v1/companies/{market}/{company_id}/valuations|日本/米国企業分析|PER/PBR/ROE/ROA/FCF/オーナー利益/DCF/安全域。計算式バージョン・入力・利回り基準日を保持|
|GET /v1/statistics/{country}/{series_id}/observations|日米経済統計|系列、期間、値、基準年、季節調整、公表日、改定、出典|
|GET /v1/support/programs|JAPAN SUPPORT|地域・条件・期限・根拠。一般向けはverifiedの制度のみ。開発環境は非公開を維持|
|GET /v1/slot/machines|SLOT|メーカー・機種・検証済み事実。取得元の利用許可未確認、未承認のデータは除外|
|GET /v1/learning/{subject}/materials|簿記/税法|独自教材、対象試験年度、法令・基準の版、施行日、参照資料|
|GET /v1/content/articles|TODOROKI/LIFE|実際に公開済みの自社記事の題名・概要・URL。下書きは所有者向けの別契約|
|GET /v1/sources/{source_id}|各データ所有者|出典URL、公表日、取得・確認日時、利用条件の確認状態。秘密値は返さない|
|GET /v1/health|各データ所有者|サービス名・最終正常確認時刻・利用可能状態。エラー本文や環境変数は返さない|

marketはJP/US、countryはJP/US。company_idは市場別IDであり同じ数字を市場なしで同一企業と扱わない。HTTP GETに収集開始・保存変更・申請などの副作用を持たせない。

## 共通レスポンスと単位

common-data-api.schema.jsonを数値レコードの正規契約とする。schema_version、project、access、generated_at、partial、items、next_cursor、errorsを返す。カーソルは不透明、limitは1〜100、日付範囲は上限を持つ。ソートは期間・IDで安定させる。

各値はvalue、unit、scale、status、period、sourcesを必須とする。欠損はnullとmissingで返し、0で代用しない。円・米ドル、百万円・円、割合・百分率を区別し、消費者側で換算したら換算方法とレート基準日を別に保持する。割合はratio（0.1）、百分率はpercent（10）とする。

verified/calculatedの値にはHTTPSの出典URLと確認日時が最低1件必要。計算値にはformula_versionとinputsを必須とする。FCF・オーナー利益・DCFは入力の期、会計基準、連結範囲、通貨が一致しない場合incompatibleを返す。期末開示株価・将来予想・最新市場株価は別の指標IDと日付で扱う。DGS10はpercentであり計算時に100で割る。

支援制度の金額・適用条件は根拠条文/公式資料・対象年度・式バージョンを保持し、確認不足ならpending。法改正の検知だけでverifiedに昇格しない。SLOTの設定別確率はsetting_noと出典確認日を保持し、文章・画像・図表・有料サイト独自情報を共通APIに載せない。

## 認証とデータ境界

- 各プロジェクトの現行公開範囲を維持する。JAPAN SUPPORT・SLOTの保護対象は公開APIに合流させない。
- 所有者データは本人セッションと用途別audience/scopeで認可し、別プロジェクトのトークンを流用しない。個人の収支・店舗記録・会員情報・支給判定入力は公開キャッシュから除外する。
- Service bindingは必要な読み取りメソッドだけに接続する。収集開始・任意SQL・任意URL取得・Secrets読出の共通エンドポイントは作らない。
- CORSは必要な既存オリジンだけ。privateレスポンスはprivate,no-store、公開キャッシュは検証済みレコードとその版だけを対象にする。
- URL/フィルターは許可済みの識別子に変換し、SQLはパラメータ化。利用者指定URLをサーバーが代理取得しない。

## 更新・障害・互換性

ETagはデータの版と権限範囲を含める。古い正常データを残し、stale・last_success_at・error_codeを明示する。取得失敗時に空の正常レスポンスや0値へ上書きしない。個別サービス失敗はpartial=true、itemsは確認できたデータだけとする。401/403/429を取得元停止や不存在と誤認しない。失敗時の再取得時刻は既存収集処理が管理し、共通APIから追加の再試行を開始しない。

404は確認済み不存在、422は条件/単位不整合、503は利用不可。errorsには対象project、機械可読code、retry_atだけを入れ、トークン・Cookie・個人情報・上流の生エラー本文は返さない。

破壊的な契約変更はv2。v1には追加フィールドのみ許容するが、スキーマでの明示とクライアント互換性を確認する。削除・終了した制度や資料は履歴に残し、ended/supersededと有効期間を付ける。

## 検証と導入の境界

JSON Schema Draft 2020-12で、実値0、欠損null、出典不足、計算入力不足、異通貨、未知のstatusを検証した。認証/契約/単位の境界テスト、各所有者アダプターの実データ照合、部分失敗、再取得/キャッシュの統合検証が実装時の必須条件。設計完了は共通APIの稼働開始ではない。
