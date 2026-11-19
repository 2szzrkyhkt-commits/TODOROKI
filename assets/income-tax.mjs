// NTA No.2260, law reference 2026-04-01; checked 2026-11-17.
export const RULE=Object.freeze({id:'nta-2260-2026',year:2026,lawAsOf:'2026-04-01',checkedAt:'2026-11-17',source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',maxInput:330000000});
const bands=[
 [40000000,45,4796000],[18000000,40,2796000],[9000000,33,1536000],
 [6950000,23,636000],[3300000,20,427500],[1950000,10,97500],[0,5,0]
];
export function parseYen(raw){
 if(typeof raw!=='string')throw new TypeError('金額を円単位で入力してください。');
 const s=raw.normalize('NFKC').trim();
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))throw new RangeError('0以上の整数を円単位で入力してください（例：7,000,000）。');
 const value=Number(s.replaceAll(',',''));
 if(!Number.isSafeInteger(value)||value>RULE.maxInput)throw new RangeError('この計算機の入力範囲は0〜330,000,000円です。');
 return value;
}
export function calculateIncomeTax(raw){
 const entered=parseYen(raw),rounded=Math.floor(entered/1000)*1000;
 const [,ratePercent,quickDeduction]=bands.find(([min])=>rounded>=min);
 const tax=Number(BigInt(rounded)*BigInt(ratePercent)/100n-BigInt(quickDeduction));
 return {ruleId:RULE.id,entered,rounded,discarded:entered-rounded,ratePercent,quickDeduction,tax};
}
