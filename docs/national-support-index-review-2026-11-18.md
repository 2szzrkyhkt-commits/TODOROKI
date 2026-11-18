# T29 国の生活支援制度索引の追加

Jグランツだけでは国の生活支援制度の収録不足が残るため、厚生労働省の固定HTML
「生活困窮者自立支援制度」の各事業の概要を既存収集経路へ追加する。
原本60701 bytes/SHA256 65e98871b06f64c529f15671658c99fc65aa930d497ada843c9a0ff6c9719f7b。
7見出しをPython HTML解析と独立照合。旧コロナ支援リーフレットは掲載終了の告知があり採用しない。

- 取得元: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html
- 利用条件: https://www.mhlw.go.jp/chosakuken/index.html
- 別規則一覧: https://www.mhlw.go.jp/chosakuken/exhibit.html
- PDL1.0: https://www.digital.go.jp/resources/open_data/public_data_license_v1.0

利用条件・例外一覧・robotsを確認。別規則対象のロゴ/画像/命令裁判例DB等は収集しない。
事業名と元ページへの参照・取得原本ハッシュだけを整理し、出典と加工主体を明記する。
第三者サイト・添付PDF・画像・リンク先の巡回や本文の転載は行わない。
レビュー記録とハッシュはtools/japan-support/national-source-review.json。

既存revisionsへpendingの索引候補として保存する。既存programs/条件/金額/公開状態を
自動更新しない。1候補文書内の7事業名であり、7制度の受給条件検証完了ではない。
条件判定/金額計算/地域の実施/公表日は未確認、全国制度を網羅したとは扱わない。

既存の1資料/周期・512KiB/15秒・redirect manual・日次間隔・リース/再試行を維持。
新規Cron/定期タスク/DBスキーマ/binding/認証は追加しない。許可済み固定sourceを1行だけ登録する。
ON CONFLICT DO NOTHINGにより再実行で既存取得状態や失敗/待機期限を初期化しない。

candidate_json全体のSHA256を保存キーとし、本文原本SHA256は候補内へ別記する。
保存後と304応答時は候補の全文ハッシュ・スキーマを読み戻し確認し、欠落/改変時は失敗とする。
parser版を含むJSONにより版の異なる候補を同じキーへ上書きしない。
将来parser版を変更する際は旧304キャッシュと版の整合を再確認する。

見出し抽出の境界/不正/重複/空/隠れたscript等、保存改変/欠落/304/302/403、
チェックポイント失敗、登録SQLの再実行で既存状態保持を検証する。
実配備・既存周期取得/保存・独立照合はTODO正本へ記録する。T29は一般公開と全国収録が残り未完了。
