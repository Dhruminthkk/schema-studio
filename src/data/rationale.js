// Optional rationale pages per built-in schema. Rendered by RationalePanel
// as a right-side overlay. Each rationale page explains the design — what
// each table is for and why the schema is shaped this way.
//
// Section shape:
//   { kind: 'h2' | 'h3',  text: '...' }                                — headings
//   { kind: 'p' | 'lead', text: '...' }                                — paragraphs
//   { kind: 'bullets',    items: ['...', ...], label?: '...' }         — bullet list
//   { kind: 'table',      head: [...], rows: [[...], ...] }            — small reference table
//   { kind: 'callout',    tone: 'accent'|'warn'|'good', title?, text } — coloured callout
//   { kind: 'spacer' }                                                 — vertical breathing room

import ardentDispositionRationale from './rationale.ardent-disposition.json';

export const RATIONALES = {

  ardent_policy_disposition: [
    ardentDispositionRationale,
  ],

  // ---------------------------------------------------------------------
  // Blog
  // ---------------------------------------------------------------------
  example_blog: [
    {
      id: 'design',
      name: 'Design notes',
      title: 'Blog — design notes',
      subtitle: '5 tables · the minimum a blog needs',
      intent: 'A blog is one of the smallest realistic schemas. Five tables cover authoring, organising, and reading.',
      sections: [
        { kind: 'h2', text: 'Why these five tables' },
        { kind: 'p', text: 'A blog only has so many concerns: people who write, posts they write, tags those posts are organised under, and comments left by readers. The user table holds both authors and commenters because they have the same shape — the role column says which capacity a given row is exercising.' },

        { kind: 'h2', text: 'Why post and tag join through a third table' },
        { kind: 'p', text: 'Posts and tags are many-to-many. A post can carry many tags; a tag is attached to many posts. Putting a list of tag ids on the post row would not scale and would not be queryable. The post_tag join table is the standard answer — one row per (post, tag) pair.' },

        { kind: 'h2', text: 'Why comment status is a single column' },
        { kind: 'p', text: 'Moderation states (pending, approved, spam, hidden) are a small enum. Keeping them as one column on the comment row avoids a separate moderation table for what is really just a lifecycle flag. If the moderation workflow grows (assignees, reviewer notes, history), a separate moderation_action table would join in later — but only when the cost of adding it is justified.' },
      ],
    },
  ],

  // ---------------------------------------------------------------------
  // E-commerce
  // ---------------------------------------------------------------------
  example_ecommerce: [
    {
      id: 'design',
      name: 'Design notes',
      title: 'E-commerce — design notes',
      subtitle: '14 tables · the standard shape',
      intent: 'A typical e-commerce model. Five concerns — customer, product, inventory, order, after-order — each carry their own tables.',
      sections: [
        { kind: 'h2', text: 'Why address is a separate table' },
        { kind: 'p', text: 'A customer has one identity but many places they ship to and bill from. Embedding addresses inline on the customer row would either cap them at one or force a JSON blob. A separate address table with type=billing|shipping lets the same customer carry as many addresses as they need, each with its own row, queryable for analytics.' },

        { kind: 'h2', text: 'Why order_item.unit_price is a snapshot' },
        { kind: 'p', text: 'The unit_price column on order_item stores the price at the time the order was placed, not a live lookup to product. If a product\'s price changes next week, this week\'s order total still adds up to what the customer was charged. This is the difference between a transactional commitment and a master attribute.' },

        { kind: 'h2', text: 'Why inventory is its own table' },
        { kind: 'p', text: 'Stock is per (product, warehouse). Putting qty_on_hand on the product row would force every product to live at one warehouse — which is fine for the simplest case and wrong as soon as you open a second fulfilment site. Inventory as a separate table lets the same product have different counts at each warehouse without changing the product row.' },

        { kind: 'h2', text: 'Why payment is one-to-many with order' },
        { kind: 'p', text: 'A single order can have many payment rows: an initial attempt that failed and was retried, a partial capture, a later refund. Modelling payment as a 1-to-many child of order, each row carrying its own amount and status, lets reconciliation queries actually work — sum the succeeded payments, subtract refunds, compare to order.total.' },
      ],
    },
  ],

  // ---------------------------------------------------------------------
  // SaaS project tracker
  // ---------------------------------------------------------------------
  example_saas: [
    {
      id: 'design',
      name: 'Design notes',
      title: 'SaaS project tracker — design notes',
      subtitle: '10 tables · multi-tenant',
      intent: 'A multi-tenant SaaS shape. Every operational row scopes to a workspace; users are global and gain access through memberships.',
      sections: [
        { kind: 'h2', text: 'Why workspace_id is on almost every table' },
        { kind: 'p', text: 'The workspace is the tenant boundary. Tasks, labels, projects, and audit logs all carry workspace_id so a query can scope cleanly to one tenant\'s data without joining through three other tables. This is the simplest way to enforce row-level isolation in queries and indexes.' },

        { kind: 'h2', text: 'Why user is global and membership is the access record' },
        { kind: 'p', text: 'A person should have one account (one email, one login, one profile photo) even if they belong to five workspaces. So user is global. Whether they can see a given workspace, and what role they hold there, lives on membership. Removing a user from a workspace is one membership delete; their global account is untouched.' },

        { kind: 'h2', text: 'Why comment is self-referential' },
        { kind: 'p', text: 'A comment carries a nullable parent_comment_id pointing back at itself. Top-level comments have a null parent; replies point at the comment they\'re replying to. This is enough to model threaded discussions without a separate "thread" or "reply" table — recursion in the query, not in the schema.' },

        { kind: 'h2', text: 'Why audit_log is polymorphic' },
        { kind: 'p', text: 'Recording every change with a separate audit table per entity (task_audit, project_audit, comment_audit, …) explodes quickly. One polymorphic audit_log with entity_type + entity_id captures every action in one shape. The cost is a soft foreign key (no DB-level constraint) — acceptable because the audit log is append-only and never joined for transactional reads.' },
      ],
    },
  ],

};
