# T04: MACD・ストキャスティクス・DMI/ADXの独立計算例

2026-11-17、基準3fdc178。先行PR #53の3記事はそのまま保持する。
今回も既存T04の部分対応で、45項目は完了21/未完了24のまま。

## 参照した公式仕様

- MACDの主線/シグナル/差と平均方式の設定：
  https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/
- EMAの更新重み2/(期間+1)：
  https://www.tradingview.com/support/solutions/43000502589-moving-averages/
- Stochasticの高安期間・％K追加平滑化・％D期間、追加平滑化1で無効：
  https://www.tradingview.com/support/solutions/43000502332-stochastic-stoch/
- ADXのDX絶対比率と前回ADXを用いた平滑化：
  https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/

文章・図・実装コードは転載しない。公式式を参照し、以下の仮想条件と独立表を作成。
原資料の全ての説明を検証・翻訳したという意味ではない。

## 追記した独自例

MACD：前回EMA12/26=100、シグナル=0から終値110→109を2回更新。
ヒストグラムは0.63818→0.93945となる。足の終値下落とヒストグラム増加が共存する例。
EMA9のシグナルを選択した条件であり、SMA設定や実チャートの初期化とは区別する。

Stochastic：全足H110/L90、終値100/100/92/106/110/94/100。
参照3・平均3・追加平均3として、ファスト％Kが足3から、％D=スロー％Kが足5から、
スロー％Dが足7で62.22となる。必要な履歴不足を0にしない。期間14の説明とは別設定。

DMI/ADX：各行は独立、前回ADX20・平滑化14と仮定。
DI30/10と10/30はともにDX50/次ADX22.14。DI10/10ならDX0でも次ADX18.57。
DI0/0は未定義として表示処理を推定しない。OHLCからDIを作る例ではない。
指標値を騰落確率と誤解しない説明と3記事の計算例への相互リンクを追加。

## 保持と検証

追加sectionと局所styleを除くと元の3 Git blobと完全一致。
既存本文・広告aside・ヘッダー・公開日・URL・canonicalを保持。
新規計算機/入力/保存/収集/外部通信は追加しない。

新規Python5件：FractionによるMACDの2回更新と反例、7本の価格からの二重平滑化と
ウォームアップ、DXの方向対称性・0分母、出典/日付/仮定/リンク、元バイト列保持。
既存50件を含む55件がローカル成功。既存CIへ3記事×390/1440pxの表行数・キーボード・
相互リンク・横溢れ・JS例外検証を接続。CI/本番結果は別途確認する。
実機確認、全記事の事実確認、全45項目の完了を示すものではない。
