/**
 * Parses a number the way a Dutch user types it: "." groups thousands and
 * "," is the decimal separator, so "350.000" is three hundred and fifty
 * thousand and "85,5" is eighty-five and a half.
 *
 * The form keeps raw strings in state rather than numbers, so a
 * half-typed "1," or "-" stays exactly what the user typed instead of
 * being rewritten under the cursor. This function is what turns that
 * string into the number field-validation.ts judges.
 *
 * "empty" and "invalid" are distinguished because they are different
 * messages: an untouched required field says "Dit veld is verplicht",
 * a field containing "abc" says "Vul een getal in".
 */

export type ParsedNumber =
  | { state: "empty" }
  | { state: "invalid" }
  | { state: "ok"; value: number };

/**
 * A dot run only counts as thousands grouping when every group after the
 * first is exactly three digits ("1.234", "1.234.567"). "12.5" therefore
 * keeps its dot as a decimal point, which is what someone typing an area
 * on a keyboard without a numpad comma almost certainly meant.
 */
const THOUSANDS_GROUPED = /^-?\d{1,3}(\.\d{3})+$/;

export function parseNumberInput(raw: string): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === "") return { state: "empty" };

  let normalised = trimmed.replace(/\s/g, "");

  if (normalised.includes(",")) {
    // A comma present means the Dutch convention is in play: dots are
    // thousands separators and the (last) comma is the decimal point.
    normalised = normalised.replace(/\./g, "").replace(",", ".");
  } else if (THOUSANDS_GROUPED.test(normalised)) {
    normalised = normalised.replace(/\./g, "");
  }

  // Number("") is 0 and Number("1.2.3") is NaN; the empty case is already
  // handled above, so only the NaN guard is needed here.
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return { state: "invalid" };
  return { state: "ok", value: parsed };
}
