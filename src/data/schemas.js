// Registry of built-in schemas. Each entry is a self-contained
// { tables, relationships } payload that the canvas can load directly.
//
// Add your own by:
//   1. dropping a JSON file in this folder with { tables, relationships }
//   2. importing it below
//   3. appending an entry to BUILTIN_SCHEMAS with a `group` from SCHEMA_GROUPS
//
// `blurb` is the one-line summary on the start screen and under the schema
// menu; `description` is the longer text shown on hover.
//
// Nothing here loads at startup. The app opens on the start screen until a
// schema is chosen, and remembers that choice for the next visit.

import ardentPair from './ardent_policy_disposition.json';
import ardentMinimal from './ardent_minimal.json';
import ardentHolderNorm from './ardent_policyholder_normalised.json';
import ardentHolderDenorm from './ardent_policyholder_denormalised.json';
import ardentHolderMin from './ardent_policyholder_minimal.json';
import exampleBlog from './example_blog.json';
import exampleEcommerce from './example_ecommerce.json';
import exampleSaas from './example_saas.json';

// Rendered in this order, on the start screen and in the schema menu.
export const SCHEMA_GROUPS = [
  {
    id: 'example',
    label: 'The worked example',
    sub: 'Ardent Mutual — a fictional general-insurance carrier on a 1980s MultiValue system. Every count and fill rate is invented; the shape is what is real.',
  },
  {
    id: 'starter',
    label: 'Starter schemas',
    sub: 'Small, familiar models. Worth a look before taking on 113 fields.',
  },
];

export const BUILTIN_SCHEMAS = [
  {
    id: 'ardent_policy_disposition',
    group: 'example',
    name: 'Policy / policy_term field disposition',
    blurb: '113 live legacy fields, each classified and given a recommendation: carry it, combine it, drop it, or stop and ask an SME.',
    description: 'Every field in PMAST and POLTERM that still holds data, classified by what kind of field it is, assigned to the policy or the term, and given a recommendation: carry it over, combine it into another field, drop it, or stop and ask an SME. PMAST is keyed on the policy so its columns are policy facts; POLTERM is keyed policy*term, and which of its columns are genuinely policy-level is the open question the model exists to surface.',
    data: ardentPair,
  },
  {
    id: 'ardent_minimal',
    group: 'example',
    name: 'Minimal: quote, bind, claim',
    blurb: 'The smallest model that supports three flows. A claim attaches to the policy term, not the policy.',
    description: 'The smallest model that supports quoting, binding and claiming. An entity is present only if one of those three flows cannot work without it. A claim attaches to the policy TERM rather than the policy, because which term was in force on the date of loss decides what cover applies.',
    data: ardentMinimal,
  },
  {
    id: 'ardent_policyholder_normalised',
    group: 'example',
    name: 'Policyholder: normalised',
    blurb: 'The system of record. One party document, plus the three collections that earn their place beside it.',
    description: 'The system of record. One party document with nested sections for everything 1:1, plus three collections beside it: portfolio and claims because a batch rebuilds them on a different cadence, and payment instruments because a security boundary outranks document locality.',
    data: ardentHolderNorm,
  },
  {
    id: 'ardent_policyholder_denormalised',
    group: 'example',
    name: 'Policyholder: denormalised',
    blurb: 'One wide read model per holder — every dashboard tile in a single fetch, payment data excluded outright.',
    description: 'One wide document per holder carrying every dashboard tile in a single fetch. Rebuilt from the normalised collections and never written to directly. Payment-instrument data is excluded outright; drill-down detail stays on the normalised side.',
    data: ardentHolderDenorm,
  },
  {
    id: 'ardent_policyholder_minimal',
    group: 'example',
    name: 'Policyholder: minimal',
    blurb: 'The smallest cut that still answers "how is this relationship doing?" — who they are, what they are worth, what they cost.',
    description: 'The smallest model that still answers "how is this relationship doing?" — who they are and the dimensions every tile slices by, what they are worth, and what they cost. Most of what remains is owned by the policy and claims files, so this shape cannot be built from PHOLD alone.',
    data: ardentHolderMin,
  },
  {
    id: 'example_blog',
    group: 'starter',
    name: 'Blog',
    blurb: 'About as small as a realistic schema gets: authors, posts, tags and comments.',
    description: 'One of the smallest realistic schemas. Five tables cover authoring, organising and reading: people who write, the posts they write, the tags those posts are filed under, and the comments readers leave.',
    data: exampleBlog,
  },
  {
    id: 'example_ecommerce',
    group: 'starter',
    name: 'E-commerce',
    blurb: 'The standard shape. Shows why a line-item price is a snapshot, and why stock needs product and warehouse together.',
    description: 'The standard shape, across five concerns — customer, product, inventory, order and after-order. Shows why a line-item price is a snapshot rather than a lookup, and why stock has to be keyed on product and warehouse together.',
    data: exampleEcommerce,
  },
  {
    id: 'example_saas',
    group: 'starter',
    name: 'SaaS project tracker',
    blurb: 'A multi-tenant shape. Every operational row carries a tenant boundary; users stay global.',
    description: 'A multi-tenant shape. Every operational row carries workspace_id as its tenant boundary, while users stay global and reach a workspace through a membership row.',
    data: exampleSaas,
  },
];

export function schemaById(id) {
  return BUILTIN_SCHEMAS.find(s => s.id === id) || null;
}

export function schemasInGroup(groupId) {
  return BUILTIN_SCHEMAS.filter(s => s.group === groupId);
}

// Counts for the start-screen cards and the menu subtitles.
export function schemaStats(entry) {
  const tables = entry.data.tables;
  return {
    tables: tables.length,
    fields: tables.reduce((n, t) => n + t.fields.length, 0),
    relationships: entry.data.relationships.length,
  };
}
