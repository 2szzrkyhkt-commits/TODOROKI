"""PDF原本に基づく紹介文を、検索データと静的ページへ同時に反映する。"""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
# 原本の抽出テキストと照合済み。価格・予想・最新の市場シェアは追加しない。
EDITORIAL = {
 'pdf-01': {
  'description': 'AIで変わる仕事と現場技能の価値を整理。移動・見積もり・工具などの費用も含め、個人事業主が適正価格を考える手順を解説します。',
  'lead': '現場の料金は、作業中の時間だけでは判断できません。この資料は、一人親方・個人事業主など、自ら経費と事業リスクを負担する人を想定し、技能の価値と価格の決め方を整理しています。',
  'points': ['AIで効率化しやすい事務と、現場の判断・実作業の違い', '材料費・移動費・工具代・見積もりなどを含めた原価の考え方', 'AIによる見積もりの補助と、価格の根拠を顧客へ説明する手順'],
  'question': '請求額を会社員の時給と、そのまま比べられる？',
  'answer': '請求額には、直接請求しにくい移動・営業・事務の時間や、工具・車両などの経費も含まれます。仕事内容と負担する費用をそろえて比較する必要があります。ただし、費用がかかることだけで、あらゆる高価格が正当化されるわけではありません。',
  'related': ['pdf-09', 'pdf-43', 'inflation']},
 'pdf-02': {
  'description': 'DRAMとは何かを、NANDとの違いから解説。電源を切ると消える仕組み、DDR・LPDDR・HBM、AIでメモリ帯域が重要になる理由を整理します。',
  'lead': 'DRAMは、CPUやGPUが処理するデータを一時的に保存する半導体メモリです。長期保存用のNANDとは役割が異なります。この資料では、メモリの基礎からAIとHBMの関係までをつなげて読めます。',
  'points': ['電荷で情報を保持し、リフレッシュが必要になる基本構造', 'DRAMとNANDの用途・データ保持・速度の違い', 'DDR・LPDDR・HBMの役割と、メモリの需給循環'],
  'question': 'AIでは、なぜHBMが使われる？',
  'answer': 'GPUの計算能力を生かすには、大量のデータを高速に供給する必要があります。DRAMを積層したHBMは、GPUの近くで広いデータ転送帯域を確保するために使われます。保存容量だけでなく、データを送る速さにも注目すると役割を理解しやすくなります。',
  'related': ['pdf-05','pdf-03','pdf-06']},
 'pdf-03': {
  'description': 'EUVとは何か、DUVとの違いと半導体の微細化との関係を解説。露光装置・周辺装置・半導体メーカーの役割を2ページで整理します。',
  'lead': 'EUVは、半導体の回路パターンをウェハー上へ転写する露光で使われる極端紫外線です。資料では、技術の仕組みと、その技術を支える企業の役割を分けて説明しています。',
  'points': ['EUVの波長13.5nmと、ArFを使うDUVの波長193nmの違い', '短い波長が微細化や一部の工程削減に役立つ理由', '露光装置・塗布現像・マスク検査・半導体製造の役割分担'],
  'question': 'EUV装置を作る企業と、EUVを使う企業は同じ？',
  'answer': '役割は異なります。資料では、ASMLを露光装置、東京エレクトロンを塗布・現像などの周辺装置、レーザーテックをマスク検査、TSMCなどを半導体製造の側として整理しています。同じEUV関連でも、どの工程を担うかを分けて読むことがポイントです。',
  'related': ['pdf-02','pdf-05','pdf-11']},
 'pdf-04': {
  'description': 'FRBとFed・FOMCの違いを解説。米国の利上げ・利下げが、企業利益や株式評価、ドル円、日本株へ波及する仕組みを整理します。',
  'lead': '金融ニュースで聞くFRB・Fed・FOMCは、厳密には同じものではありません。まず組織と意思決定の違いを押さえ、その後で米国の金融政策が株価や為替へ伝わる経路を整理する資料です。',
  'points': ['Fedは中央銀行制度全体、FRBはその中核となる理事会という違い', 'FOMCが政策金利の誘導目標などを決める仕組み', '米金利・為替・米国株を通じて、日本株へ影響が広がる経路'],
  'question': '米国が利下げすれば、株価は必ず上がる？',
  'answer': '利下げは借入負担や株式評価を通じて支えになる一方、景気悪化への懸念が強ければ株価が下がることもあります。利下げという結果だけでなく、その背景と市場の予想との差を合わせて読むことが大切です。',
  'related': ['interest-rate','pdf-47','pdf-34']},
 'pdf-05': {
  'description': 'NANDフラッシュメモリの用途・需給・価格変動を解説。DRAMとの役割の違いと、製造メーカー・装置メーカーの事業特性を整理します。',
  'lead': 'NANDフラッシュは、電源を切ってもデータを保持するメモリで、SSDやスマートフォンなどに使われます。この資料では、製品の役割だけでなく、市況を見る指標と関連企業の立場の違いを整理しています。',
  'points': ['不揮発性メモリとしての用途と、3D NANDの技術競争', '販売価格・在庫・設備投資・工場稼働率を合わせて見る視点', 'NANDを作る企業と、製造・加工装置を供給する企業の違い'],
  'question': 'NAND価格が上がると、関連企業は同じように利益が増える？',
  'answer': '事業によって影響の受け方が異なります。メモリメーカーは販売価格・出荷数量・製造コストの影響を受け、装置メーカーは顧客の設備投資にも左右されます。資料では、キオクシア、東京エレクトロン、SCREEN、ディスコの事業領域を分けて確認できます。',
  'related': ['pdf-02','pdf-03','pdf-06']},
 'pdf-12': {
  'description': 'グレアムの投資基準7条件を整理。流動比率200％、10年黒字、平均EPSによるPER、PBRとの組み合わせを、独自ルールと区別して解説します。',
  'lead': 'グレアムの7条件は、企業の規模・財務・利益・配当・成長と、支払う価格を組み合わせる考え方です。この資料では、元の基準と、現代の日本株で追加して確認する項目を区別しています。',
  'points': ['流動比率・長期負債・10年間の黒字継続など、会社の状態を確認する条件', '過去3年間の平均EPSを使ったPERと、PBRを組み合わせる考え方', '赤字を一部許容する、配当条件を外すなどの独自変更との違い'],
  'question': 'PER15倍以下・PBR1.5倍以下だけで7条件を満たす？',
  'answer': '価格の条件だけでは、7条件すべてを満たしたことにはなりません。資料では会社の財務や利益の継続性も確認します。また、PERとPBRは積が22.5以下という組み合わせでも考えます。基準を変更した場合は、元の条件と独自の判断を分けて扱います。',
  'related': ['margin-of-safety','price-value','pdf-13']},
 'pdf-34': {
  'description': 'マネーサプライとマネーストック、マネタリーベースの違いを解説。日本のM1・M2・M3の集計範囲と、お金の量と物価の関係を整理します。',
  'lead': '「お金の量」が増えたというニュースでも、何を集計した指標なのかで意味は変わります。この資料は、個人や企業が保有する現金・預金と、中央銀行が供給する通貨を区別するための入門です。',
  'points': ['日本で使われるマネーストックという名称と、主な保有主体', 'M1・M2・M3で異なる金融商品や対象金融機関の範囲', 'マネタリーベースとの違いと、お金の残高・支出・供給の関係'],
  'question': '日銀当座預金が増えれば、個人の預金も同じ割合で増える？',
  'answer': '自動的に同じ割合で増えるわけではありません。個人や企業の預金には、銀行の貸し出しや融資需要も関わります。また、お金の残高が増えても、物価への影響は消費・投資に回る動きや、モノ・サービスの供給によって変わります。',
  'related': ['inflation','interest-rate','pdf-04']},
 'pdf-47': {
  'description': '金利が上がると株価が下がりやすい理由を、現在価値・資産比較・借入コスト・需要の4経路で解説。業種や利上げの背景による違いも整理します。',
  'lead': '金利上昇は、株式の評価と企業の実際の利益の両方に影響します。この資料では、株価に伝わる経路を4つに分け、金利だけで株価の方向を決めつけないための見方を整理しています。',
  'points': ['割引率の上昇で、将来利益の現在価値が下がりやすくなる仕組み', '債券・預金との比較、企業の借入負担、消費・投資への波及', '成長株・高負債企業・銀行・保険で異なる影響の受け方'],
  'question': '金利が上がると、すべての株が下がる？',
  'answer': '景気拡大で企業利益が伸びる局面なら、金利上昇と株高が同時に起きることもあります。業種、借入条件、保有資産によって影響は異なり、利上げが予想されていたかどうかも関係します。「なぜ金利が上がったか」と合わせて考えることがポイントです。',
  'related': ['interest-rate','pdf-04','price-value']},
}

def build():
 data_path=ROOT/'content.json'
 data=json.loads(data_path.read_text())
 by_id={d['id']:d for d in data}
 old={key:by_id[key]['description'] for key in EDITORIAL}
 for key,e in EDITORIAL.items():
  d=by_id[key]
  d['description']=e['description']
  links=''.join(f'<li><a href="{html.escape(by_id[k]["url"],quote=True)}">{html.escape(by_id[k]["title"])}</a></li>' for k in e['related'])
  d['overview']=(
   '<section class="article-body pdf-overview" aria-labelledby="pdf-overview-title">'
   '<h2 id="pdf-overview-title">この資料で分かること</h2>'
   f'<p>{html.escape(e["lead"])}</p><ul>'
   +''.join('<li>'+html.escape(p)+'</li>' for p in e['points'])
   +f'</ul><h3>{html.escape(e["question"])}</h3><p>{html.escape(e["answer"])}</p>'
   +'<h3>あわせて読みたい</h3><ul>'+links+'</ul>'
   +'<p class="subtle">編集：<a href="/about.html">TODOROKI</a> ／ 本ページは掲載PDFの内容をもとに構成しています。</p></section>')
 # Update only matching cards, so list descriptions agree with the search data.
 for path in ROOT.rglob('*.html'):
  s=path.read_text()
  for key,previous in old.items():
   d=by_id[key]
   pattern=r'(<h3><a href="'+re.escape(html.escape(d['url'],quote=True))+r'">.*?</a></h3><p>)'+re.escape(html.escape(previous))+r'(</p>)'
   s=re.sub(pattern,lambda m:m[1]+html.escape(d['description'])+m[2],s,flags=re.S)
  key=next((k for k in EDITORIAL if path==ROOT/by_id[k]['url'].lstrip('/')),None)
  if key:
   d=by_id[key]
   for attr in ['name="description"','property="og:description"']:
    s=re.sub(r'(<meta '+attr+r' content=")[^"]*(")',lambda m:m[1]+html.escape(d['description'],quote=True)+m[2],s)
   def schema(m):
    obj=json.loads(m[1]);obj['description']=d['description']
    return '<script type="application/ld+json">'+json.dumps(obj,ensure_ascii=False)+'</script>'
   s=re.sub(r'<script type="application/ld\+json">(.*?)</script>',schema,s,flags=re.S)
   # Allow safe repeat runs without duplicating the overview.
   s=re.sub(r'<section class="article-body pdf-overview".*?</section>','',s,flags=re.S)
   marker='<div class="pdf-toolbar"'
   assert s.count(marker)==1,path
   s=s.replace(marker,d['overview']+marker)
  if s!=path.read_text():path.write_text(s)
 data_path.write_text(json.dumps(data,ensure_ascii=False))

if __name__=='__main__':build()
