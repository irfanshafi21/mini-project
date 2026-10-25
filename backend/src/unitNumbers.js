export const MAX_SYLLABUS_UNITS = 100;

// PDF text extraction can replace a dash with U+FFFD (�); syllabi also use
// several dash/colon/period variants before a unit label. Accept these so
// extraction noise does not collapse every section into Unit 1.
const unitHeadingSeparators = String.raw`\s:;.,\-‐‑‒–—―−﹘﹣－�`;
export const unitHeadingPattern = new RegExp(
  String.raw`^\s*unit\b[${unitHeadingSeparators}]*([0-9]+|[ivxlcdm]+)\b[${unitHeadingSeparators}]*`,
  'i',
);

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
  if (total < 1 || total > MAX_SYLLABUS_UNITS) return undefined;
  let remaining = total;
  let canonical = '';
  for (const [value, numeral] of [[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
    while (remaining >= value) {
      canonical += numeral;
      remaining -= value;
    }
  }
  return canonical === roman ? total : undefined;
}
