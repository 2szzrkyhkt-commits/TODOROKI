// Reading order is editorial. Topic matching extends the related links for new articles.
export const themes = [
  ['株式投資の基礎', '投資対象の選び方から、企業と株価を見る手順へ。', '/investment-list', ['investment', 'price-value', 'fundamental-analysis', 'company-comparison-method'], /資産形成|株式投資|インデックス投資/],
  ['財務諸表の読み方', '三表のつながりを理解し、利益と現金収支を照合する。', '/business-list', ['financial-statements-basics', 'cash-flow-financial-health', 'company-comparison-method'], /財務諸表|キャッシュフロー|営業CF|FCF/],
  ['企業価値評価', '倍率を比較し、利益・資産・キャッシュフローから買値を検討する。', '/investment-list', ['fundamental-analysis', 'valuation-per-pbr', 'cash-flow-financial-health', 'margin-of-safety'], /割安株価|買い目安|企業価値|PERとPBR|オーナー利益/],
  ['バリュー投資', '価格と価値の違いから、安全域と企業比較へ。', '/investment-list', ['price-value', 'margin-of-safety', 'valuation-per-pbr', 'company-comparison-method'], /安全域|安全マージン|バリュー投資/],
  ['マクロ経済', '物価と金利の基本を押さえ、家計や市場との関係を読む。', '/economy-list', ['inflation', 'interest-rate', 'inflation-asset-gap', 'yen-carry-trade-fx-outlook-2026'], /インフレ|金融政策|円キャリー/],
  ['半導体産業', '製造装置・メモリー・応用分野の企業を、対象期を確かめながら比較する。', '/science-technology', ['kokusai-electric-6525-earnings-2026', 'advantest-6857-earnings-analysis-2026', 'kioxia-earnings-analysis-2026', 'renesas-earnings-analysis-2026'], /半導体|キオクシア|アドバンテスト|ルネサス/],
  ['金融・金利', '金利の基礎から、金融政策と為替の関係へ進む。', '/economy-list', ['interest-rate', 'inflation', 'yen-carry-trade-fx-outlook-2026', 'monetary-policy-weekly-20261030'], /金利|金融政策|円キャリー/],
  ['行動経済学', '時間選好・社会的選好の考え方を、意思決定の例から学ぶ。', '/behavioral-economics', ['human-behavior', 'discounted-utility', 'social-preferences'], /行動経済学|社会的選好|割引効用/],
  ['簿記学習', '会計の前提と三表を確認し、簿記1級教材へ進む。', '/boki1', ['accounting-postulates', 'financial-statements-basics', 'cash-flow-financial-health'], /会計公準|簿記/],
  ['テクニカル分析', 'ローソク足と出来高を確認し、移動平均から各指標へ進む。', '/investment-list', ['technical-analysis', 'candlestick-basics', 'volume-basics', 'moving-average-basics', 'rsi-basics'], /移動平均|ボリンジャー|テクニカル|ローソク足|RSI|MACD|VWAP|ATR|DMI|ADX|一目均衡|出来高|ストキャス|パラボリック|ドンチャン|ピボット|エンベロープ/],
];

// Older, undated evergreen pages observed in public-repository history.
// This is age evidence, not an article publication date or content review date.
export const archiveMinAge = 30;
export const observedBy = Object.fromEntries([
  'investment', 'price-value', 'margin-of-safety', 'inflation', 'inflation-asset-gap',
  'interest-rate', 'business-ma', 'mbo-investing', 'human-behavior',
  'discounted-utility', 'social-preferences', 'politics-society',
].map(slug => ['/'+slug, '2026-10-23']));
export const evergreenTopics = /投資の基礎|財務諸表|企業価値評価|バリュー投資|テクニカル分析|行動経済学|簿記学習/;

// Explicit anchor vocabulary for editorial review of body-link suggestions.
export const anchorTargets = [
  ['キャッシュフロー','/cash-flow-financial-health'],
  ['財務諸表','/financial-statements-basics'],
  ['安全域','/margin-of-safety'],
  ['企業比較','/company-comparison-method'],
  ['PERとPBR','/valuation-per-pbr'],
  ['ファンダメンタルズ分析','/fundamental-analysis'],
];
