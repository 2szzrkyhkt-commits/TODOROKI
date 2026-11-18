# T02 新着記事のXML/HTMLサイトマップ同期

別作業で追加された7記事、その後のGMOペイメントゲートウェイの記事が
Git正本へ入った一方で、サイトマップは195件のままだった。公開検査で
欠落を再現し、8記事の追加後は203ページとなる。本文は変更しない。

ネットワーク/秘密情報を使わないtools/sync-page-discovery.mjsを既存ビルドへ
組み込む。検索対象HTMLのcanonical/noindex/titleから追加分だけを検出し、
既存XMLのURL/lastmodとHTMLリンクを保持して検索一覧へ追記する。
不正canonical/既存の不明URL/重複XMLは勝手に削除せずビルドを失敗させる。
同じソースで再実行しても差分は出ない。--checkは保存せず差分時に失敗する。
既存GitHub品質検査の先頭にも同じ同期を追加し、その後に完全性/表示を検証。
T04の合意済み対象33ページは変えず、全体件数だけ追加記事に追従させる。

Wranglerのbuild.commandはdev/deploy用の公式custom build設定。
Workers Buildsでは同設定だけを有効化の証拠としないため、既存のmain用
build triggerのbuild_commandにも同じNodeコマンドを設定し読戻し検証する。
https://developers.cloudflare.com/workers/wrangler/custom-builds/
https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
認証/実行トークン/対象branch/公開範囲/定期タスク3件/AdSenseは変更しない。
新規Cron/Automation/build triggerの作成なし。

8隔離ケースで追加・再実行・noindex/資産除外・HTMLエスケープ・既存データ保持・
不正canonicalと不明URLの停止を検証。既存Python71・security・検索を併用。
本番のGoogle掲載やGSCの転送検証の結末は別であり、T02は未完了維持。
配備/公開検証の結果はTODO正本へ別途記録する。

旧版PRの長い検査が最新版を塞いだため、同じPR branchの新しい実行は旧版を取消す。
本番側のgroupとcancel=falseは維持し、品質履歴の同時書込を増やさない。
既存のcron式と定期Automation3件は変更しない。
