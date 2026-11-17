# T04: RSI・ATR・VWAPの独立計算例

確認日2026-11-17。基準e97cc46e82f94bfae1763776485cb9454de03d7a。
T04の3記事を対象とする部分対応。45項目は21完了/24未完了を維持する。

## 公式資料と独自の追記

- TradingView RSI https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/
  上下の終値変化とRMAによる平均、RSI式を確認。
- TradingView PineJSStd rma https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.PineJSStd/#rma
  RMAのα=1/lengthを確認。
- TradingView ATR https://www.tradingview.com/support/solutions/43000501823-average-true-range-atr/
  TRの3候補の最大、既定のRMA、方向と変動幅の区別を確認。
- TradingView VWAP https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/
  HLC3/出来高累計を使う計算と起点設定を確認。

資料の文章・図表・ソースコードは転載せず、公式式を参照して独自の仮想データを作成。
以下は実在銘柄・成績・TradingView実チャートの再現ではない。

RSI：100円から+2/-1を7回、14変化/15終値を作成。初期平均1/0.5、RSI66.67。
翌日+3のRMAは71.11、直近14変化のSMAは68.18。
同じ期間でも70をまたぐかどうかが平均方式で変わることを数値で示す。

ATR：n=3の例でTR80/30/50/20を前日終値付きOHLCから独立計算。
初期53.33→次42.22、SMAなら33.33。終値1020に対する割合4.14%は確率ではない。
代表的14期間の説明と、この例の3期間を区別する。

VWAP：3約定の累計売買代金100000/406000/505000、数量100/400/500、
VWAP1000/1015/1010。1本の足に集約したHLC3近似1000との違いと、
翌セッションでリセットした1030/起点維持1013.33の違いを明示。
追加出来高0と累計出来高0を区別する。

## 保持と検証

追加sectionと局所styleを除くと、元の3 Git blobにバイト単位で一致する。
既存本文・広告aside・ヘッダー・公開日・URL・canonical・多言語設定を維持。
新規入力・保存・外部通信・指標計算機は追加しない。

新規Python5テスト：Fractionによる独立計算、全表の値、前日終値の連続性、
出典/仮定/日付/内部リンク、元バイト列の保持。既存45件を含む50件がローカル成功。
既存publicationのソース7チェックも成功。公開195 URL/PDF317 URLを維持。

既存CIへ390/1440pxの3記事の表行数/出典/日付/キーボード横スクロール/
関連記事遷移/横溢れ/JS例外の検証を接続。結果を確認してからmainへ反映する。
スクリーンショットは検証用であり、iPhone実機確認ではない。
CI/本番反映結果はPRとTODOへ別途記録し、この事前記録だけで成功と扱わない。

T04全体の全記事・翻訳・事実確認は未完了。全体の完了チェックを付けない。
