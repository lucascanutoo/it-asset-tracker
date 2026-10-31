'use strict';
// The Windows SQL driver can return an INT column as decimal text.
function normalizeMachineId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}
function sameMachineId(left, right) {
  const id = normalizeMachineId(left);
  return id !== null && id === normalizeMachineId(right);
}
module.exports = { normalizeMachineId, sameMachineId };
