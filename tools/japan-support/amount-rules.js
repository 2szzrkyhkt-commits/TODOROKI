export const amountRules = {
  "programId": "jp-child-allowance",
  "schemaVersion": 1,
  "version": "2026-11-16.1",
  "effectiveFromMonth": "2024-10",
  "checkedOn": "2026-11-16",
  "rates": {
    "under3": 15000,
    "older": 10000,
    "third": 30000
  },
  "birthdayMonthInclusive": true,
  "payFiscalAge": 18,
  "countFiscalAge": 22,
  "multiChildTypes": [
    "individual"
  ],
  "sources": [
    {
      "id": "guide",
      "url": "https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai",
      "section": "支給額・申請・支払時期",
      "checkedAt": "2026-11-16T13:27:13.634810Z",
      "sha256": "a14fe7f49417399a5ca3309939870a5083ce8cf9abd5de24b1c15e62d0ff9722"
    },
    {
      "id": "count",
      "url": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/c9d07fdc-1873-4b62-ba35-b38a62a471a6/9f5267a3/20250213_policies_kokoseido_jidouteate_annai_05.pdf",
      "section": "第3子以降のカウント",
      "checkedAt": "2026-11-16T13:27:23.156204Z",
      "sha256": "bf6901ee08d7283c012caa024f0a456f0eae52aadbd71aa600ebf735eed04155"
    },
    {
      "id": "facility",
      "url": "https://www.cfa.go.jp/policies/kokoseido/jidouteate/faq/jigyousha/",
      "section": "Q2・Q3",
      "checkedAt": "2026-11-16T13:27:29.349823Z",
      "sha256": "9813ec550be2de2c1cfcfed52566bf0aca8cce22bb02812ac20f18f832bd67c6"
    },
    {
      "id": "law",
      "url": "https://laws.e-gov.go.jp/api/2/law_data/346AC0000000073",
      "section": "第6条・第8条・第9条",
      "checkedAt": "2026-11-16T13:27:35.655193Z",
      "sha256": "7c5d9216d036f30bd0a046922a20c56921cd51c736ea9d9ee586be059502e582",
      "lawRevisionId": "346AC0000000073_20250601_504AC0000000068",
      "revisionStatus": "CurrentEnforced"
    },
    {
      "id": "monthly_bands",
      "url": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/71c2c6c6-efb3-452e-8d82-8273b281bac4/c7512dc6/20240705_councils_kodomo_seisaku_kyougi_71c2c6c_04.pdf",
      "section": "令和6年10月以降の月額区分（3歳の誕生月まで/翌月から）",
      "checkedAt": "2026-11-16T13:33:39.623589Z",
      "sha256": "aa85dc4d40b88577eb0eb956673e583ae6ccc84fb244032d926781063b1d5e45"
    }
  ],
  "attribution": "こども家庭庁の案内・資料とe-Gov児童手当法第6条の額の表をTODOROKIが計算用データへ編集。認定・支払額の確定は行いません。"
};
