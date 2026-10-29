# 法務・表示・広告点検（2026-10-29）

対象ソースツリー：80c4dbed6437d4ea2687b0387edd4f046e893b4c。HTML130件・PDF379件を一覧化し、PDF全文抽出・参照URLの抽出・広告表記・認証ソースを点検。機械点検は全事実の独立照合や権利許諾の確認ではない。

## 実施した修正
- 自動Googleタグを同意後の読み込みへ変更。EEA・英国・スイス・地域不明・GPC有効時はGoogleタグを読み込まない。独自UIはGoogle認定CMPではなく、規制対象地域で認定CMPの代用として広告を配信しない。
- ログイン・問い合わせの米国送信先と目的・送信内容・公表保護措置を明記し、未選択の専用同意を追加。認証APIにも同意確認を追加し、同意履歴をメールのHMAC値で保存。
- 運営方針・外部送信一覧・PDF出典確認ページと全ページからの導線を追加。
- TOPIX6言語資料からQUICKによる推計表・金額ランキング・個別銘柄の優先表現を外し、JPX公式発表リンクを付した仕組み解説へ改訂。再利用条件の確認なしに引用表記だけを足して解決扱いにしない。
- 基礎記事・簿記学習に公式参考資料を追加。出版社・試験機関の監修と誤認させない表示。
- TAC出版の既存承認リンクを財務諸表・CF・辞典に追加。ネットオフの既存承認リンクをPDFビューアに追加。広告のPR表示・nofollow sponsored noopenerを維持。

## 確認できた点
- ソースに売買執行・資金預かり・有料銘柄助言の機能なし。記事・教材は認証せずに取得できる構成。
- 認証はOTP期限・試行回数制限・IP等による送信制限・ハッシュ検証・安全なCookie属性を使用。
- ビッグマック資料は第三者データの転載ではなく仮定の数字による説明で、The Economistの参照が記載済み。
- GMO事件・Anthropic S-1・PHPセキュリティ記事の主要参照先は一次情報に到達。全記事の全数値を独立再計算したという意味ではない。

## 未完了・運営者による確認が必要な点
- 元教材・提供Word・画像の作成者、第三者の転載許諾、保有している契約・許諾証跡はリポジトリから確認できない。全設問・全図版が独自作成とは断定不可。
- PDF379件の文章の参照状況を公開したが、画像主体の資料、古い市場数値、個別企業評価点の根拠、翻訳精度は追加検証が必要。参照情報の有無だけで合法・違法を判定しない。
- Cloudflare/Resend/Formspree管理画面のDPA適用、保存国、実アクセス権、削除運用、再委託先の継続監督は未確認。説明文追加だけで実運用を保証しない。
- 個人情報保護法32条に関する運営者氏名・住所等の回答体制は運営者が実際に用意する必要がある。個人情報を勝手にサイトへ掲載していない。
- 外部サイトの利用規約と国内外の法令は変更される。法律意見書・当局や専門家の適法性確認の代替ではない。

## 一次資料
- https://www.fsa.go.jp/common/law/guide/kinyushohin/07.html
- https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/
- https://www.ppc.go.jp/all_faq_index/faq1-q12-1/
- https://www.ppc.go.jp/all_faq_index/faq1-q9-1/
- https://www.bunka.go.jp/seisaku/bunka_gyosei/kibankyoka/faq/index.html
- https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing
- https://support.google.com/adsense/answer/13554116
- https://www.cloudflare.com/trust-hub/appi/
- https://resend.com/legal/dpa
- https://resend.com/legal/subprocessors
- https://formspree.io/legal/privacy-policy/
- https://www.jpx.co.jp/news/6030/20261007-01.html
