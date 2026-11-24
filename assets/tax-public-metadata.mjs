export const SUBJECTS = ['簿記論', '財務諸表論', '所得税法', '法人税法', '相続税法', '消費税法', '酒税法', '国税徴収法', '住民税', '事業税', '固定資産税', '実務・関連資料'];
export const KINDS = {law: '法令', answer: 'タックスアンサー', circular: '通達'};
export const MAX_ROWS = 8000;
export const MAX_BYTES = 4 * 1024 * 1024;
const STATES = ['未施行', '廃止・失効版', '停止（公式区分）', '旧版', '現行版（公式区分）', '施行日到来・現行性未確認', '施行日未確認'];

function date(value, timestamp = false) {
  const pattern = timestamp ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/ : /^\d{4}-\d{2}-\d{2}$/;
  return typeof value === 'string' && pattern.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}

export function publicRow(row) {
  if (!row || !Object.hasOwn(KINDS, row.kind) || typeof row.title !== 'string' ||
      !row.title.trim() || row.title.length > 300 || /[\p{Cc}<>]|(?:https?:|www\.)/iu.test(row.title) ||
      !Array.isArray(row.subjects) || !row.subjects.length || row.subjects.some(s => !SUBJECTS.includes(s))) return null;
  const checked = date(row.checked, true);
  if (!checked) return null;
  const result = {kind: row.kind, title: row.title.trim(), subjects: [...new Set(row.subjects)], checked};
  if (row.kind === 'law') {
    if (typeof row.number !== 'string' || !/^[A-Za-z0-9_]{15,80}$/.test(row.number) || !STATES.includes(row.state)) return null;
    Object.assign(result, {number: row.number, state: row.state, promulgated: date(row.promulgated), effective: date(row.effective)});
  }
  return result;
}

export function publicMetadata(value) {
  if (!value || !Array.isArray(value.rows) || value.rows.length > MAX_ROWS || !date(value.updated, true)) throw Error('invalid_catalog');
  const rows = value.rows.map(publicRow);
  if (rows.some(row => !row)) throw Error('invalid_catalog');
  return {updated: value.updated, rows};
}
