# TODOROKI 自動監査（実装途中・暫定基準）

issue #9、全41コメント、main c25d125、および docs/site-quality-review.md を調査。原典62項目は見つからない。criteria.py は今回の要求から作った暫定62項目であり、歴史的原典の確定版ではない。

## 現在実装した範囲

- 全HTMLの静的タグ・canonical参照・hreflang参照・見出し・リンク・アンカー・script重複・alt、PDFヘッダー・カタログ整合、サイトマップ整合。
- GETだけの本番HTTP検査、最大3回・1秒/2秒の指数バックオフ。403/429/DNS失敗は未確認とし、サイト停止と区別。
- Playwright: 主要9ページ、日次Chromium、週次Chromium/Firefox/WebKit、390/1440px。JSエラー、ヘッダー、ナビ存在、横スクロール、壊れた画像、axe serious/critical、スクリーンショット保存。存在検査を操作成功扱いにしない。
- 全62行のJSON/Markdown、過去結果継承、エラー指紋、差分と復旧履歴。取得した本文やCookie値は保存しない。
- 時間毎Actions、JST03時の日次、日曜週次、1日月次、main push、成功deployment_status、PRのオフライン自己テスト。
- Artifact 90日、quality-history独立ブランチの追記コミット。後者は期限なしで増えるため容量の継続管理が必要。公開リポジトリの履歴は公開であり、管理者専用画面ではない。
- 新規重要検出のみGitHub issue作成。通知失敗時は履歴保存に進まない。正常時のissue作成なし。外部の既存監視に共通指紋がないため、既存監視との完全な重複防止は未完了。
- Cloudflare独立watchdog雛形。Actionsの直近予約成功が3時間以上ない時に別通知先へ一度通知。未配備・未検証。

## 未実装・未検証

原典照合、検索/言語切替/テロップ/簿記/計算の具体的操作アサーション、PDF表示内容、広告配信/配置/同意連動、スクリーンショット差分基準、重なり、キーボード、Lighthouse/CWV、TLS期限、セキュリティ各項目、依存監査、データバックアップ・隔離復元、安全な自動修正PR、認証付き管理者画面。62行の未確認項目を参照。

ソースの静的検査成功は「一部完了」。本番の予約実行成功、履歴ブランチ保存、issue通知、ブラウザ実行は、実行証拠が得られるまでは未確認。月次モードの存在は復元テスト実装を意味しない。稼働継続はmainへの承認マージとActions有効化が前提。

Actionsスケジュールは遅延・無効化があり、厳密な毎時や365日の保証ではない。Cloudflare watchdogは別Worker/KV・読み取り専用GitHub secret・通知先secretの設定が必要。新規課金リソースは作成していない。watchdog自身の停止監視も未構築。

## 検証

`python -m unittest discover -s tools/quality -p 'test_*.py' -v`

`python tools/quality/audit.py --offline --out /tmp/quality-results`

`python tools/quality/audit.py --mode hourly --out /tmp/quality-results`

本番の変更、フォーム送信、ログイン試行、広告クリック、データ更新は一切行わない。監査ファイルは既存 `.assetsignore` の /tools/** と /.github/** に含まれ、公開アセットに混入しない。

## 導入手順

1. PR差分と自己テスト結果をレビューし、承認後mainへマージ。
2. Actionsの実行・write権限・定期実行を確認。予約イベントの成功とhistoryブランチ・Artifactsを照合。
3. Cloudflare独立watchdogを無料枠の範囲で配備し、意図的な古い成功日時による通知を隔離検証。
4. 原典62項目、既存通知との対応表、バックアップ取得権限を確定し、未実装を拡充。

完成条件は満たしていない。完全自動運用開始とは報告しない。
