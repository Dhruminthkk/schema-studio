// Schema Studio data helpers.
//
// Neither the domain nor the data-class vocabulary is fixed. A schema brings
// its own words — "policy" and "party" for an insurer, "product" and "orders"
// for a distributor — and the UI takes them as it finds them. Colours and
// labels are derived (see lib/palette.js), so an imported schema needs no
// registration here to render correctly.

import { spreadHues, hashHue, colorFromHue, labelOf } from '../lib/palette.js';

// The canvas opens on nothing until the start screen hands it a schema.
export const EMPTY_SCHEMA = { tables: [], relationships: [] };

// Labels for the data classes the tool has an opinion about. Anything else a
// schema uses still works — it falls through to a prettified version of its
// own key.
const KNOWN_DATA_CLASSES = {
  master:        'Master',
  transactional: 'Transactional',
  reference:     'Reference',
  config:        'Config',
  variant:       'Variant',
  derived:       'Derived',
};

export function dataClassOf(key) {
  if (!key) return null;
  return {
    key,
    label: KNOWN_DATA_CLASSES[key] || labelOf(key),
    // Drives the badge tint in styles.css; unknown classes get the neutral one.
    cssClass: KNOWN_DATA_CLASSES[key] ? key : 'unknown',
  };
}

export function dataClassOptions(tables = []) {
  const seen = new Set(Object.keys(KNOWN_DATA_CLASSES));
  for (const t of tables) if (t.dataClass) seen.add(t.dataClass);
  return [...seen];
}

// The domain registry for a loaded schema: every value any table names, either
// as its own domain or as one it is owned by or read from.
export function domainsOf(tables = []) {
  const keys = new Set();
  for (const t of tables) {
    if (t.domain) keys.add(t.domain);
    if (t.owningDomain) keys.add(t.owningDomain);
    for (const d of t.consumingDomains || []) if (d) keys.add(d);
  }
  // Sorted so a given schema always produces the same colours, and the
  // assignment does not shift when tables are reordered on the canvas.
  const sorted = [...keys].sort();
  const hues = spreadHues(sorted.length);
  const registry = {};
  sorted.forEach((key, i) => {
    registry[key] = { key, name: labelOf(key), color: colorFromHue(hues[i]) };
  });
  return registry;
}

export function domainMetaOf(registry, key) {
  if (!key) return null;
  return registry[key] || { key, name: labelOf(key), color: colorFromHue(hashHue(key)) };
}
