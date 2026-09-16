// Colours and labels for open vocabularies.
//
// A domain is whatever string the loaded schema puts on `table.domain` —
// "policy", "party", "claims" in one model, "product", "orders", "inventory"
// in the next. The tool cannot ship a fixed list, so it derives one from the
// data and colours it here.
//
// Lightness and chroma come from the active theme (`--d-l` / `--d-c` in
// styles.css); only the hue is chosen here. That keeps every generated colour
// in step with the rest of the palette across all eight themes.

// Hues are assigned by POSITION in the schema's sorted domain list, not by
// hashing the name. Hashing looks tempting — it makes a colour depend only on
// its own key — but two arbitrary hashes land arbitrarily close together, and
// "party" next to "policy" at 1.4° apart is two identical-looking swatches in
// the same legend. Stepping by the golden angle guarantees the widest possible
// separation for however many domains a schema actually has.
const GOLDEN_ANGLE = 137.508;

// Starts in the blues rather than at pure red, which reads better for the
// single-domain case.
const HUE_ORIGIN = 250;

export function spreadHues(n) {
  return Array.from({ length: n }, (_, i) => (HUE_ORIGIN + i * GOLDEN_ANGLE) % 360);
}

// For a key that is not in the registry — a domain named on `owningDomain` or
// `consumingDomains` but carried by no table of its own. Position is unknown,
// so this falls back to the key's own hash.
export function hashHue(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function colorFromHue(hue) {
  return `oklch(var(--d-l) var(--d-c) ${hue.toFixed(1)})`;
}

// "policy_term" / "policy-term" / "policyTerm" -> "Policy term"
export function labelOf(key) {
  if (!key) return '—';
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!words) return '—';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}
