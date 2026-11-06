# Provisional criteria: the original historical list has not been located.
GROUPS = {
'hourly': ['トップHTTP','主要ページHTTP','404・500検出','リダイレクト','TLS証明書','公開API','応答時間'],
'daily': ['title','description','canonical','hreflang','robots','サイトマップ','PDFサイトマップ','noindex','見出し構造','重複ページ','内部リンク','構造化データ','外部リンク','アンカー','PDF実体','PDFカタログ','PDFビューア','重複ファイル','JS実行エラー','script重複','ヘッダー','ナビゲーション','言語切替','検索','テロップ','簿記学習','計算ツール','AdSenseタグ','広告タグ重複','広告配置','広告スマホ重なり','プライバシー整合','広告配信成功'],
'weekly': ['横スクロール','文字・ボタン重なり','レスポンシブ画像','キーボード・操作','スクリーンショット差分','ブラウザ互換性','Lighthouse・CWV','JS・CSS・画像負荷','キャッシュ','alt','フォームラベル','コントラスト・ARIA・フォーカス','認証','アクセス権限','セキュリティヘッダー','Cookie','秘密情報','依存脆弱性','API制御・フォーム安全性'],
'daily-backup': ['バックアップ存在・鮮度・整合'],
'monthly': ['隔離復元'],
'manual': ['iPhone実機・原典62項目照合']}
CRITERIA = [dict(id=f'TQ{i:02}',name=n,frequency=g,provisional=True) for i,(g,n) in enumerate(((g,n) for g,ns in GROUPS.items() for n in ns),1)]
assert len(CRITERIA)==62
