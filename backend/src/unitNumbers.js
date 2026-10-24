export const MAX_SYLLABUS_UNITS = 100;

export const unitHeadingPattern = /^\s*unit\s*[-:]?\s*(\d+|[ivxlcdm]+)\b\s*[:.\-–—]?/i;

export function parseUnitNumber(value) {
  const label = String(value || '').trim();
  if (/^\d+$/.test(label)) {
    const number = Number(label);
    return Number.isInteger(number) && number >= 1 && number <= MAX_SYLLABUS_UNITS ? number : undefined;
  }
  if (!/^[ivxlcdm]+$/i.test(label)) return undefined;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const roman = label.toUpperCase();
  let total = 0;
  for (let index = 0; index < roman.length; index++) {
    const current = values[roman[index]];
    const next = values[roman[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total >= 1 && total <= MAX_SYLLABUS_UNITS ? total : undefined;
}
