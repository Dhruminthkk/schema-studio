// Optional guided walkthroughs per built-in schema. The Walkthrough button in
// the toolbar lists every walkthrough available for the currently loaded
// schema; selecting one plays it back, focusing the canvas on the listed
// tables for each step.
//
// Each schema maps to an array of walkthroughs:
//   { id, name, description, steps: [
//       { id, title, body, focus: 'all' | [tableId, ...], touches: [...], questions: [...] }
//   ] }


import ardentDispositionWalk from './walkthroughs.ardent-disposition.json';
import ardentMinimalWalk from './walkthroughs.ardent-minimal.json';
import ardentHolderWalk from './walkthroughs.ardent-holder.json';

export const WALKTHROUGHS = {
  ardent_policy_disposition: [ardentDispositionWalk],
  ardent_minimal: [ardentMinimalWalk],
  ardent_policyholder_normalised: [ardentHolderWalk],
  ardent_policyholder_denormalised: [ardentHolderWalk],
  ardent_policyholder_minimal: [ardentHolderWalk],
  // ---------------------------------------------------------------------
  // Blog
  // ---------------------------------------------------------------------
  example_blog: [
    {
      id: 'tour',
      name: 'A tour of the blog schema',
      description: 'Walk the five tables in the order a reader would meet them.',
      steps: [
        {
          id: 'intro',
          title: 'Five tables — that is the whole blog',
          body: 'A blog only needs a handful of entities: people who write, the posts they write, the tags they organise posts by, and the comments readers leave. The schema gets very small once you stop trying to model everything at once.',
          focus: 'all',
          touches: ['Identity', 'Content'],
          questions: [],
        },
        {
          id: 'people',
          title: 'user — every account in the system',
          body: 'One row per registered account. Authors and commenters live in the same table because they share the same shape (email, display name, created_at) — the role column tells you which of them this row is being used as right now.',
          focus: ['t_user'],
          touches: ['Identity'],
          questions: [],
        },
        {
          id: 'posts-and-tags',
          title: 'post and tag — content and how it is sorted',
          body: 'A post is the unit of content. A tag is a categorical label. The relationship between them is many-to-many — one post can have many tags, one tag is attached to many posts — so the link lives on a separate post_tag join table.',
          focus: ['t_post', 't_tag', 't_post_tag'],
          touches: ['Content'],
          questions: [],
        },
        {
          id: 'comments',
          title: 'comment — readers respond to posts',
          body: 'Comments hang off posts. Each comment knows its post and its author. Status (pending, approved, spam, hidden) is a single column on the row — the moderation lifecycle without a separate moderation table.',
          focus: ['t_comment', 't_post', 't_user'],
          touches: ['Content'],
          questions: [],
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------
  // E-commerce
  // ---------------------------------------------------------------------
  example_ecommerce: [
    {
      id: 'tour',
      name: 'A tour of the e-commerce schema',
      description: 'Walk from customer through product to order, then look at fulfillment and finance.',
      steps: [
        {
          id: 'intro',
          title: 'Fourteen tables, five concerns',
          body: 'The model breaks into five concerns: who the customer is, what the product is, where the stock lives, what the customer ordered, and how it gets paid for and shipped. Every table belongs to exactly one of those concerns.',
          focus: 'all',
          touches: ['All concerns'],
          questions: [],
        },
        {
          id: 'who',
          title: 'Who — customer and address',
          body: 'A customer can carry many addresses, typed as billing or shipping. Storing addresses on their own row (instead of inline on the customer) lets the same customer ship to many places without rewriting their identity.',
          focus: ['t_customer', 't_address'],
          touches: ['Customer'],
          questions: [],
        },
        {
          id: 'what',
          title: 'What — product, category, inventory',
          body: 'A product is the catalogue identity (SKU, name, price). A category is the taxonomy it sits in — self-referential to model the hierarchy. Inventory is the per-warehouse stock count. Categories and products are many-to-many through the join table.',
          focus: ['t_product', 't_category', 't_product_category', 't_inventory', 't_warehouse'],
          touches: ['Product', 'Inventory'],
          questions: [],
        },
        {
          id: 'ordering',
          title: 'Ordering — cart then order',
          body: 'A cart is a working session of pending intent. An order is a committed promise. Order lines lock the unit_price at the time of order, so historical totals stay correct even after a price change on the product.',
          focus: ['t_cart', 't_cart_item', 't_order', 't_order_item', 't_product'],
          touches: ['Orders'],
          questions: [],
        },
        {
          id: 'after-order',
          title: 'After the order — payment, shipment, review',
          body: 'A payment can have multiple rows per order — retries, partial captures, refunds. A shipment is the physical fulfillment from a warehouse. A review is the customer\'s feedback after delivery, linked to both the product and the customer.',
          focus: ['t_payment', 't_shipment', 't_review'],
          touches: ['Finance', 'Fulfillment'],
          questions: [],
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------
  // SaaS project tracker
  // ---------------------------------------------------------------------
  example_saas: [
    {
      id: 'tour',
      name: 'A tour of the SaaS schema',
      description: 'Walk the multi-tenant shape — workspaces at the top, tasks at the bottom.',
      steps: [
        {
          id: 'intro',
          title: 'Ten tables, one tenant key',
          body: 'Everything in this schema scopes to a workspace. A user is global; a membership is what gives that user access to one specific workspace. Projects, tasks, labels, attachments, and audit logs all key off workspace_id, which is the multi-tenant boundary.',
          focus: 'all',
          touches: ['Multi-tenant'],
          questions: [],
        },
        {
          id: 'identity',
          title: 'user, workspace, membership',
          body: 'A user is global identity (one row per person, one email, one login). A workspace is one tenant. A membership connects a user to a workspace and gives them a role inside it. One user can belong to many workspaces.',
          focus: ['t_user', 't_workspace', 't_membership'],
          touches: ['Identity'],
          questions: [],
        },
        {
          id: 'work',
          title: 'project and task — the work',
          body: 'A project lives in a workspace. A task lives in a project. The task is where most activity happens — status transitions, assignment, due dates, completions. Everything else (labels, comments, attachments) hangs off task.',
          focus: ['t_project', 't_task'],
          touches: ['Work'],
          questions: [],
        },
        {
          id: 'around-task',
          title: 'Around the task — labels, comments, attachments',
          body: 'Labels are workspace-scoped tags, joined to tasks many-to-many through task_label. Comments are threaded via parent_comment_id (a self-reference). Attachments are files uploaded against a task.',
          focus: ['t_label', 't_task_label', 't_comment', 't_attachment'],
          touches: ['Collaboration'],
          questions: [],
        },
        {
          id: 'audit',
          title: 'audit_log — every change, in one shape',
          body: 'A polymorphic audit log records every state-changing action — across tasks, projects, comments, memberships, anything. One table replaces N per-entity audit tables; entity_type + entity_id give you the polymorphic foreign key.',
          focus: ['t_audit_log'],
          touches: ['Governance'],
          questions: [],
        },
      ],
    },
  ],


};
