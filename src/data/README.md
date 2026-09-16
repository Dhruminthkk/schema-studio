# src/data/

Schemas and the three registries that expose them to the app.

## Registries

| File | Registers |
| --- | --- |
| `schemas.js` | Every schema on the start screen and in the schema menu: `BUILTIN_SCHEMAS`, and `SCHEMA_GROUPS` for the sections they sit under. |
| `walkthroughs.js` | Guided tours, keyed by schema id. A schema may have several. |
| `rationale.js` | Design-note pages, keyed by schema id. |

Nothing is loaded at startup. The app opens on the start screen with an empty canvas and stays
there until a schema is chosen; the choice is then remembered in `localStorage` under
`schemastudio.schema`.

`schema.js` derives everything else from the loaded schema: `domainsOf()` builds the domain
registry from whatever values the tables carry, and `dataClassOf()` labels a data class. Neither
vocabulary is hard-coded, so a schema from any domain renders without being registered anywhere —
see `../lib/palette.js` for how colours are assigned.

## Adding a schema

1. Drop a JSON file here shaped `{ tables, relationships }`
2. Import it in `schemas.js` and append to `BUILTIN_SCHEMAS`
3. Optionally register a walkthrough and a rationale under the same id

Each entry needs a `group` (one of the `SCHEMA_GROUPS` ids), a `name`, a one-line `blurb` for the
start-screen card, and a longer `description` shown on hover. Table, field and relationship counts
are computed by `schemaStats()` — don't put them in the name.

Field ids must be unique across the whole schema — relationships and foreign keys address fields
by id, not by table-plus-name. The convention here is `f_<table>_<field>`.

The full contract is in [`site/guide.html`](../../site/guide.html).

## Grouping

A table may carry `fieldGroups` — an ordered `[{ name, fieldIds }]` — and the canvas uses it
verbatim. Any field not listed falls into a trailing `Other` group. Without `fieldGroups`, fields
are auto-classified into business-concern buckets by `../lib/groups.js`.

## A note on data

The demo content is entirely fictional. **Ardent Mutual** is an invented general-insurance carrier;
the legacy file names (`PMAST`, `POLTERM`, `PHOLD`), attribute numbers, record counts and fill
rates are fabricated to be *plausible*, not real.

If you point this tool at a real estate, keep the real schema out of this folder and load it at
runtime through **Import** instead — anything committed here ships with the repo.

Field-level `example` values are rendered verbatim by the inspector and are **not** masked for
you. Leave them empty for anything sensitive.
