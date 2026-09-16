
// The auto-classifier groups a table's fields into business-concern buckets so
// Core mode reads as an ownership conversation, not a column dump.
//
// Order is load-bearing: each field gets placed in the FIRST bucket whose
// pattern matches its (normalised, snake_cased) name. Semantic buckets are
// checked BEFORE the generic Identity catch-all so e.g. `brandId` lands in
// "Brand & supply", `categoryId` in "Classification", `baseUomId` in "Units of
// measure" — not all in Identity just because they end in `_id`.
//
// Identity is strict: the table's own PK + business identifiers (sku, upc, etc)
// + legacy/external system references. Anything else FK-shaped falls through
// to "Relations".

const AUDIT_NAMES = new Set([
  "created_at", "updated_at", "deleted_at", "modified_at", "last_modified_at",
  "created_by", "updated_by", "deleted_by", "modified_by", "last_modified_by",
  "version", "etag", "row_version", "revision",
]);

// Order matters. Earlier buckets win. The general principle:
//   Hierarchy / Brand / Address / Tax / UoM / Contact / Money / Quantities /
//   Classification are checked BEFORE Subject so that semantically-specific
//   refs (parent_customer_id, brand_id, time_zone, tax_profile_id, etc.)
//   don't get swept into the broad "Subject" anchor bucket. Subject is then
//   the catch-all for "this row anchors to <entity>" references. Identity
//   (business codes — sku, upc, etc.) comes after Subject; the table's own
//   PK and legacy/external identifiers are handled by priority rules in
//   bucketFor before the loop.
const BUCKETS = [
  ["Hierarchy",
    /^(parent|root|path|materialized_path|level|depth|ancestors|children|parent_.*|root_.*|.*_path|.*_hierarchy.*)$/],

  ["Brand & supply",
    /^(brand|.*_brand|manufacturer|.*_manufacturer|mfg|.*_mfg|maker|.*_part_number)$/],

  ["Address",
    /^(address|.*_address|.*_address_.*|line[12]|street.*|city|state|province|postal_code|postcode|zip|zip_code|country|region|district|locality|geo.*|latitude|longitude|coordinates|time_?zone)$/],

  ["Tax & compliance",
    /^(tax.*|.*_tax|vat.*|gst.*|hst.*|hsn.*|sst.*|duty.*|tariff.*|hazmat.*|regulatory.*|compliance.*|certification.*|certified.*|exempt.*|exemption.*|cites.*|gdpr.*|pii.*|safety.*)$/],

  ["Units of measure",
    /^(uom|.*_uom|unit_of_measure|unit|.*_unit|measure|.*_measure|weight|.*_weight|height|width|depth|length|dimensions?|volume)$/],

  ["Contact",
    /^(email|.*_email|phone.*|.*_phone|mobile|fax|contact|.*_contact|contacts|website|url)$/],

  ["Money & pricing",
    /^(price.*|.*_price|.*_pricing.*|cost.*|.*_cost|amount.*|.*_amount|total.*|.*_total|subtotal.*|grand_total|net.*|gross.*|fee.*|.*_fee|charge.*|.*_charge|discount.*|.*_discount|markup.*|margin.*|.*_margin|currency.*|exchange_rate|credit_(limit|terms))$/],

  ["Quantities",
    /^(qty|quantity|.*_qty|.*_quantity|count|.*_count|on_hand.*|committed.*|available.*|allocated.*|reserved.*|backorder.*|par.*|min_qty|max_qty|reorder.*|in_transit.*|inbound_.*|damaged.*|quarantine.*|standard_pack.*)$/],

  ["Classification",
    /^(type|.*_type|kind|.*_kind|category|.*_category|categories|class|.*_class|classification|family|.*_family|segment|.*_segment|tier|.*_tier|department|.*_department|subcategory|.*_subcategory|commodity|.*_commodity|.*_group|group|tag|tags)$/],

  ["Subject",
    /^(.*_?)?(branch|warehouse|location|product|customer|vendor|supplier|user|account|employee|item|invoice|quote|shipment|transfer|territory|zone|route|order|sales_order|purchase_order|fulfillment_order|return|lot|serial|bin_location|price_book|driver|buyer|sales_rep|carrier)$/],

  ["Identity",
    /^(.*_no|.*_number|number|sku|upc|ean|gtin|isbn|barcode.*|account_number|code|.*_code|.*_ref)$/],

  ["Naming",
    /^(name|.*_name|display_name|legal_name|trading_name|alias|aliases|title|label|short_description|long_description|description|notes|remarks|abbreviation)$/],

  ["Lifecycle",
    /^(status|.*_status|state|.*_state|lifecycle.*|phase|stage|is_active|active|archived|is_archived|enabled|is_enabled|published|is_published|approved|is_approved|is_default|is_primary|priority|sort_order|sort|fulfillment_method)$/],

  ["Timing",
    /^(.*_at|.*_on|.*_date|valid_from|valid_to|effective_from|effective_to|expires_on|expires_at|begin.*|end.*|due_at|due_date|introduced_date|discontinued_date)$/],
];

const DISPLAY_ORDER = [
  'Identity',
  'Naming',
  'Classification',
  'Hierarchy',
  'Brand & supply',
  'Subject',
  'Contact',
  'Address',
  'Money & pricing',
  'Tax & compliance',
  'Units of measure',
  'Quantities',
  'Lifecycle',
  'Timing',
  'Relations',
  'Attributes',
  'Audit',
];

function normaliseName(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[A-Z]/g, c => c.toLowerCase())
    .replace(/[^a-z0-9_]+/g, '_');
}

// Anything matching these counts as Identity regardless of what semantic
// pattern it might also match — e.g. legacyProductId would otherwise land in
// Subject because it ends in "product".
const IDENTITY_PRIORITY = /^(legacy_.*|external_(id|ref)|source_system.*)$/;

function bucketFor(field) {
  const n = normaliseName(field.name);
  if (AUDIT_NAMES.has(n)) return 'Audit';
  if (field.pk) return 'Identity';
  if (IDENTITY_PRIORITY.test(n)) return 'Identity';
  // Test both the raw name and a version with the `_id` / `_key` suffix
  // stripped, so `category_id` matches Classification's `category` literal,
  // `branch_id` matches Subject's `branch`, etc.
  const stripped = n.replace(/_(id|node_id|key|ref|guid|uid)$/, '');
  const variants = stripped === n ? [n] : [n, stripped];
  for (const [name, re] of BUCKETS) {
    if (variants.some(v => re.test(v))) return name;
  }
  if (field.fk) return 'Relations';
  return 'Attributes';
}

export function groupsOfTable(table) {
  // A schema may carry its own field grouping. This wins: the model that
  // produced the data knows what its categories are.
  if (Array.isArray(table.fieldGroups) && table.fieldGroups.length > 0) {
    const byId = new Map(table.fields.map(f => [f.id, f]));
    const result = [];
    const used = new Set();
    for (const g of table.fieldGroups) {
      const fields = (g.fieldIds || []).map(id => byId.get(id)).filter(Boolean);
      fields.forEach(f => used.add(f.id));
      if (fields.length > 0) result.push({ name: g.name, fields });
    }
    const leftover = table.fields.filter(f => !used.has(f.id));
    if (leftover.length > 0) result.push({ name: 'Other', fields: leftover });
    return result;
  }

  // Auto-classify into ownership-relevant buckets.
  const buckets = new Map();
  for (const f of table.fields) {
    const name = bucketFor(f);
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(f);
  }

  const ordered = [];
  for (const name of DISPLAY_ORDER) {
    const fs = buckets.get(name);
    if (fs && fs.length > 0) ordered.push({ name, fields: fs });
  }
  for (const [name, fs] of buckets) {
    if (!DISPLAY_ORDER.includes(name) && fs.length > 0) {
      ordered.push({ name, fields: fs });
    }
  }
  return ordered;
}

export function findFieldGroup(table, fieldId) {
  const groups = groupsOfTable(table);
  for (const g of groups) {
    if (g.fields.some(f => f.id === fieldId)) return g.name;
  }
  return null;
}
