# T03/T41 監査の依存準備と重複起動

前回main監査44210886334は10:17 JSTに成功。総所要28分20秒。
取得済みログではUbuntu mirrorからの依存パッケージ取得に時間を要していた。
mesa-libgalliumの前後167秒、libcodec2の前後137秒などの間隔を確認した。
テスト失敗・認証失敗・永久停止とは判断しない。

現行browser.mjsはdaily=Chromium、weekly/monthly=Chromium/Firefox/WebKitだが、
依存準備はmain push時に全3種類を導入していた。依存準備のMODEを実際の検査と合わせ、
dailyではChromiumだけ、weekly/monthlyでは従来どおり全3種類を準備する。
hourlyは従来のifでこのstepをスキップし、想定外MODEが入れば成功へ補完せず失敗する。
Playwright/axeのバージョン、テスト本体、3ブラウザを要する検査範囲は変更しない。

TODO正本だけのmain pushは同じ総合監査を重複起動しないよう、当該1パスのみ
paths-ignoreへ追加する。他のdocsやコードが同じpushに含まれれば従来どおり対象。
毎時Cron、手動実行、PR、deployment_statusの起動条件、concurrency/権限/通知/保存は維持。
既に待機/実行中のrunを自動キャンセルしたり、失敗を成功にしたりしない。

YAMLから抽出した実際の準備スクリプトを模擬npm/npxで実行し、dailyは1種類、
weekly/monthlyは3種類、hourly/未知値を直接渡すと失敗することを確認。
Browser checks以降のstep群は変更前とバイト一致。元のCron/権限/全検証は維持。
PR CIとmainの実行時間・結果を確認後、正本へ追記する。

これはT03の全62項目合格、T41のアカウント請求/無料枠照合完了を意味しない。
