# Schema Studio

Explore a legacy data estate as a model you can walk around — not a static diagram someone
exported once.

Pan and zoom the ERD, follow guided walkthroughs, read the rationale behind each design decision,
and click any field to see where it came from in the legacy system, how much of the population
actually fills it, how sensitive it is, and whether it should be stored at all.

Runs entirely in the browser. No network calls, no backend.

It opens on a start screen: import your own JSON or SQL DDL, or pick one of the bundled models.
Whatever you choose is remembered, so the next visit goes straight back to it — click **Schema
Studio** in the top-left to come back and change it.

## The worked example

Ships with **Ardent Mutual**, a fictional general-insurance carrier running a 1980s MultiValue
system. Every record count, attribute number and fill rate is invented — the point is to show the
*shape* of a real legacy estate at realistic complexity, and the kinds of finding this tool exists
to surface:

| Schema | What it shows |
| --- | --- |
| **policy / policy_term field disposition** | 113 live legacy fields, each classified and given a recommendation — carry it, combine it, drop it, or stop and ask an SME. The hard question is which columns of a `policy*term`-keyed file are genuinely policy-level. |
| **Minimal: quote, bind, claim** | The smallest model that supports three flows. A claim attaches to the policy *term*, not the policy, because which term was in force on the date of loss decides what cover applies. |
| **Policyholder: normalised / denormalised / minimal** | One classified field catalog projected three ways — a system of record, a dashboard read model, and a minimal cut. Same facts, so the shapes cannot drift apart. |

Three small starter schemas (blog, e-commerce, SaaS) are included for orientation.

### What the example deliberately demonstrates

- **A sum that is stored beside its own parts.** `sum_insured_total` equals buildings + contents on
  every sampled policy. So does the premium tax, the commission amount and the outstanding balance.
  Each is marked computed, with its formula on the field.
- **Two columns for one relationship.** `agency_code` agrees with `broker_code` 99.4% of the time.
- **A status hidden in a search key.** PMAST has no status column, so the business writes LAPSED,
  CANCELLED, VOID, NTU and DECLINED into the alphabetical search key — on 6.81% of policies.
- **Parallel arrays that are really rows.** Endorsement codes and their texts, rating factors and
  their values, adjustment dates and their premium deltas — kept in step by position.
- **PII and PCI classification** driving what may reach a read model. Payment-instrument fields
  appear in the normalised shape and in neither read model.

## Documentation

| | |
| --- | --- |
| [`site/index.html`](site/index.html) | Landing page — what it is and what it does |
| [`site/guide.html`](site/guide.html) | Full guide — every feature, the JSON contract, authoring |
| [`src/data/README.md`](src/data/README.md) | The registries and how to add a schema |

## Run it

```
npm install
npm run dev      # http://localhost:5310
npm run build    # static bundle in dist/
```

## Add your own schema

To explore one without committing it, just use **Import** — nothing leaves the browser.

To bundle one into the build:

1. Drop a JSON file in `src/data/` shaped `{ tables, relationships }`
2. Import it in `src/data/schemas.js` and append an entry to `BUILTIN_SCHEMAS`, with a `group`
   from `SCHEMA_GROUPS`, a one-line `blurb` for the start-screen card and a longer `description`
3. Optionally add a walkthrough in `walkthroughs.js` and a rationale page in `rationale.js`

Nothing else needs registering. There is no fixed vocabulary of domains or data classes — whatever
words your schema uses for `domain` and `dataClass` are picked up from the data, labelled, and
given a colour off the active theme's ramp.

### Field properties the inspector understands

Beyond `name` / `type` / `pk` / `fk`, a field may carry: `legacyField`, `fillPct`, `category`,
`sensitivity` (`internal` | `confidential` | `pii` | `pci`), `dashboardRole`, `storage`
(`stored` | `computed` | `projected` | `migrated`), `computed` (a formula — renders inline with an
&fnof; marker), `warning` (`{severity, message}`) and `issues` (`[{kind, detail}]`).

A table may declare `fieldGroups` to control how the canvas groups its fields; without it, fields
are auto-classified into business-concern buckets.

## Licence

Not yet chosen. Until a licence is added, default copyright applies and no reuse rights are
granted — add one before publishing.
