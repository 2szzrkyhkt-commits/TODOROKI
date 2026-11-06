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
METHODS = {
 **{i:'urllib GET; follow redirects; maximum three attempts; record status, final URL and elapsed time' for i in (1,2,3,4,6,7)},
 **{i:'HTMLParser across every repository HTML; source existence/structure only, deployed behavior remains partial' for i in (8,9,10,11,16,17,18,21,27,50,51)},
 **{i:'Parse robots or XML sitemap; compare referenced paths to source tree' for i in (12,13,14)},
 19:'Parse every application/ld+json block; schema semantics require further verification',
 20:'GET unique external URLs with four concurrent workers; 403/429/network failures are inconclusive',
 22:'Inspect PDF magic bytes; content rendering remains unverified',
 23:'Compare PDF catalog paths with source tree, including Unicode normalization',
 25:'Group PDF SHA256 hashes; duplicates are evidence for review, not automatic deletions',
 **{i:'Playwright read-only browser smoke check; per-page/browser evidence in browser.json' for i in (26,28,29,30,31,32,33,34,41,43,52)}
}
for criterion in CRITERIA:
 number=int(criterion['id'][2:])
 criterion['inspection']=criterion['name']+'：要求された範囲を証拠と照合し、未実行範囲を残す'
 criterion['automatic_method']=METHODS.get(number,'未実装または手動検証が必要。実行成功扱いにしない')
 criterion['implementation']='partial' if number in METHODS else 'pending'
