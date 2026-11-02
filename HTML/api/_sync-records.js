// A bulk upsert must contain at most one row for each conflict key.
// Prefer the most recently edited copy; equal/absent timestamps use the last
// occurrence, matching the client collection merge convention.
function uniqueRecords(records, key = 'id') {
  const output = [], positions = new Map();
  for (const record of records) {
    const id = record[key];
    if (id == null || String(id).trim() === '') { output.push(record); continue; }
    const normalized = String(id);
    if (!positions.has(normalized)) { positions.set(normalized, output.length); output.push(record); continue; }
    const index = positions.get(normalized);
    const timestamp = row => Date.parse(row.updatedAt || row.updated_at || row.createdAt || row.created_at || '') || 0;
    if (timestamp(record) >= timestamp(output[index])) output[index] = record;
  }
  return output;
}
function sameRecord(a, b) {
  return require('node:util').isDeepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)));
}
function sameAppointment(a, b) {
  const content = value => {
    if (!value) return value;
    const { updatedAt, updated_at, ...fields } = value;
    return fields;
  };
  return sameRecord(content(a), content(b));
}
module.exports = { uniqueRecords, sameRecord, sameAppointment };
