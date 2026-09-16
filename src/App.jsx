import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  domainsOf, domainMetaOf, dataClassOf, EMPTY_SCHEMA,
} from './data/schema.js';
import { SCHEMA_GROUPS, schemaById, schemasInGroup, schemaStats } from './data/schemas.js';
import { WALKTHROUGHS } from './data/walkthroughs.js';
import { RATIONALES } from './data/rationale.js';
import { WalkthroughOverlay } from './components/walkthrough.jsx';
import { RationalePanel } from './components/rationale.jsx';
import { StartScreen } from './components/start.jsx';
import {
  Icon, usePanZoom, TableCard, RelationshipsLayer, computeFieldPositions,
} from './components/canvas.jsx';
import {
  Tooltip, InspectorPanel, ReviewPanel, Minimap, DomainLegend, ExportModal,
} from './components/panels.jsx';
import { analyzeSchema } from './lib/analyze.js';
import { resolveOverlaps, reduceCrossings, autoArrange as computeAutoArrange } from './lib/layout.js';
import { groupsOfTable } from './lib/groups.js';
import { computeDropSets } from './lib/dropped.js';
import { buildSqlDdl, buildMarkdownDoc, buildMermaid, parseSqlDdl } from './lib/io.js';

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function uid(prefix = 'x') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

/* ================================================================
   Main App
================================================================ */
// LocalStorage keys
const LS_THEME = "schemastudio.theme";
const LS_VIEW = "schemastudio.viewMode";
const LS_LINE = "schemastudio.lineStyle";
const LS_EDIT = "schemastudio.editMode";
const LS_LAYOUT = "schemastudio.layout";
const LS_DROPPED = "schemastudio.showDropped";
// The schema chosen on the start screen, so a return visit reopens it rather
// than asking again. Cleared by "Start over".
const LS_SCHEMA = "schemastudio.schema";

// localStorage throws outright in some private-browsing modes. Every preference
// stored here has a working default, so a failure should cost the preference and
// nothing else — never the whole app.
function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch { /* preference not persisted; the session still works */ }
}

// A remembered id can also outlive the entry it names, when the registry changes
// under it. Either way: no remembered schema, so the start screen opens.
function rememberedSchema() {
  return schemaById(lsGet(LS_SCHEMA));
}

const THEMES = [
  { id: "paper",    name: "Paper",    kind: "light", swatch: ["#f6f4ef", "#1a1814", "oklch(0.55 0.10 245)"] },
  { id: "frost",    name: "Frost",    kind: "light", swatch: ["#eef2f6", "#0d141c", "oklch(0.42 0.13 255)"] },
  { id: "mist",     name: "Mist",     kind: "light", swatch: ["#eef1f4", "#0f1419", "oklch(0.50 0.16 250)"] },
  { id: "sage",     name: "Sage",     kind: "light", swatch: ["#e9ede5", "#1a201a", "oklch(0.42 0.12 145)"] },
  { id: "slate",    name: "Slate",    kind: "dark",  swatch: ["#0f1216", "#e6e3da", "oklch(0.78 0.10 230)"] },
  { id: "midnight", name: "Midnight", kind: "dark",  swatch: ["#0d0c1a", "#e4e3ee", "oklch(0.78 0.13 285)"] },
  { id: "carbon",   name: "Carbon",   kind: "dark",  swatch: ["#131313", "#e8e6e1", "oklch(0.74 0.14 50)"] },
  { id: "pine",     name: "Pine",     kind: "dark",  swatch: ["#0e1614", "#dde6e1", "oklch(0.78 0.13 165)"] },
];

function App() {
  // ---------- theme & view mode ----------
  const [theme, setTheme] = useState(() => lsGet(LS_THEME) || "paper");
  const [viewMode, setViewMode] = useState(() => lsGet(LS_VIEW) || "core");
  const [lineStyle, setLineStyle] = useState(() => lsGet(LS_LINE) || "curved");
  const [editMode, setEditMode] = useState(() => lsGet(LS_EDIT) === "true");
  // Fields marked for deletion (field.drop) are hidden by default so the chart
  // reads as the target model. This is a VIEW preference only — the decision
  // itself lives on the field and is always exported.
  const [showDropped, setShowDropped] = useState(() => lsGet(LS_DROPPED) === "true");

  // Track latest editMode in a ref so callbacks see the live value
  const editModeRef = useRef(false);
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);

  useEffect(() => {
    lsSet(LS_EDIT, String(editMode));
    if (!editMode) {
      setPanelOpen(o => o && rightTab === 'review' ? o : false);
    }
  }, [editMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    lsSet(LS_THEME, theme);
  }, [theme]);

  useEffect(() => {
    lsSet(LS_VIEW, viewMode);
  }, [viewMode]);

  useEffect(() => {
    lsSet(LS_LINE, lineStyle);
  }, [lineStyle]);

  useEffect(() => {
    lsSet(LS_DROPPED, String(showDropped));
  }, [showDropped]);

  const selectGroup = useCallback((tableId, groupName) => {
    setSelection({ type: 'group', tableId, groupName });
    setRightTab('inspector');
    if (editModeRef.current) setPanelOpen(true);
  }, []);

  // ---------- schema state with undo/redo ----------
  const initialSchema = useMemo(() => {
    const remembered = rememberedSchema();
    return remembered ? clone(remembered.data) : clone(EMPTY_SCHEMA);
  }, []);
  const [schema, setSchema] = useState(initialSchema);

  // Domain vocabulary is whatever the loaded schema uses, not a fixed list.
  const domains = useMemo(() => domainsOf(schema.tables), [schema.tables]);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const pushHistory = useCallback((prev) => {
    undoStack.current.push(prev);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current.length = 0;
  }, []);
  const mutate = useCallback((updater) => {
    setSchema(prev => {
      const next = updater(clone(prev));
      pushHistory(prev);
      return next;
    });
  }, [pushHistory]);
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    setSchema(prev => {
      const back = undoStack.current.pop();
      redoStack.current.push(prev);
      return back;
    });
  }, []);
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    setSchema(prev => {
      const next = redoStack.current.pop();
      undoStack.current.push(prev);
      return next;
    });
  }, []);

  // ---------- selection & ui state ----------
  const [selection, setSelection] = useState(null); // {type:'table'|'field'|'group', tableId, fieldId, groupName}
  const [rightTab, setRightTab] = useState("inspector"); // 'inspector' | 'review'
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [hiddenDomains, setHiddenDomains] = useState(new Set());
  const [exportModal, setExportModal] = useState(null); // {kind, content}
  // Exactly one popover open at a time. These used to be four independent
  // booleans, plus two menu components holding their own private state, so
  // opening one closed only whichever others its handler happened to name and
  // two could sit open at once. One value makes that impossible.
  const [openMenu, setOpenMenu] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [activeSchemaId, setActiveSchemaId] = useState(() => rememberedSchema()?.id || null);
  // Open until a schema is chosen. A returning visitor has one already, so they
  // go straight to the canvas.
  const [startOpen, setStartOpen] = useState(() => !rememberedSchema());
  // Bumped whenever a whole model is swapped in — on mount with a remembered
  // schema, on picking a built-in, on importing a file. The effect below settles
  // the layout once the cards have actually been measured.
  const [layoutNonce, setLayoutNonce] = useState(() => (rememberedSchema() ? 1 : 0));
  // `variant` selects which walkthrough in the active schema's list is playing.
  const [walkthrough, setWalkthrough] = useState({ active: false, stepIndex: 0, variant: 0 });
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [rationaleVariant, setRationaleVariant] = useState(0);

  const closeMenus = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback(
    (name) => setOpenMenu(cur => (cur === name ? null : name)),
    [],
  );

  // One outside-click rule for all of them. Anything inside an element marked
  // data-menu-root counts as inside a menu: that is either the menu itself or
  // the button that owns it, and a click on another menu's button is left to
  // that button's own handler so it can swap which one is open.
  useEffect(() => {
    if (!openMenu) return undefined;
    const onDown = (e) => {
      if (e.target instanceof Element && e.target.closest('[data-menu-root]')) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  const schemaRef = useRef(schema);
  useEffect(() => { schemaRef.current = schema; });

  // ---------- pan/zoom ----------
  const hostRef = useRef(null);
  const clearSelection = useCallback(() => {
    setSelection(null);
    setPanelOpen(false);
  }, []);
  const [view, setView] = usePanZoom(hostRef, clearSelection);
  const [hostSize, setHostSize] = useState({ w: 1000, h: 700 });
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const ent of entries) {
        setHostSize({ w: ent.contentRect.width, h: ent.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- field DnD ----------
  const tableRefs = useRef(new Map());
  const [draggedField, setDraggedField] = useState(null); // {fromTableId, fieldId, ghost}
  const [dropTarget, setDropTarget] = useState(null);     // {tableId, index}
  const dragStart = useRef(null);

  const onFieldMouseDown = (e, tableId, fieldId) => {
    e.stopPropagation();
    e.preventDefault();
    // Select first
    setSelection({ type: 'field', tableId, fieldId });
    setRightTab('inspector');
    if (editModeRef.current) setPanelOpen(true);
    dragStart.current = { tableId, fieldId, x: e.clientX, y: e.clientY, started: false };
  };

  useEffect(() => {
    const onMove = (e) => {
      const ds = dragStart.current;
      if (!ds) return;
      if (!ds.started) {
        const dx = Math.abs(e.clientX - ds.x);
        const dy = Math.abs(e.clientY - ds.y);
        if (dx + dy > 5) {
          ds.started = true;
          setDraggedField({ fromTableId: ds.tableId, fieldId: ds.fieldId, x: e.clientX, y: e.clientY });
          hostRef.current?.classList.add('field-dragging');
        } else return;
      }
      setDraggedField(d => d ? { ...d, x: e.clientX, y: e.clientY } : null);

      // Find target table & insertion index by hit-testing
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const card = elUnder?.closest?.('.table-card');
      if (!card) { setDropTarget(null); return; }
      const tableId = card.getAttribute('data-table-id');
      const fieldRows = Array.from(card.querySelectorAll('[data-field-id]'));
      let index = fieldRows.length;
      for (let i = 0; i < fieldRows.length; i++) {
        const r = fieldRows[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { index = i; break; }
      }
      // Rendered rows are grouped, and hidden dropped fields aren't rendered at
      // all, so this index doesn't map onto the real fields array. Carry the id
      // of the row we're inserting above (null = end) and resolve it at commit.
      const beforeId = index < fieldRows.length
        ? fieldRows[index].getAttribute('data-field-id')
        : null;
      setDropTarget({ tableId, index, beforeId });
    };
    const onUp = (e) => {
      const ds = dragStart.current;
      dragStart.current = null;
      if (!ds || !ds.started) {
        setDraggedField(null);
        setDropTarget(null);
        return;
      }
      hostRef.current?.classList.remove('field-dragging');
      // Commit move
      const dt = dropTarget;
      setDraggedField(null);
      setDropTarget(null);
      if (!dt) return;
      // Use refs for stale closure safety
      moveFieldRef.current(ds.tableId, ds.fieldId, dt.tableId, dt.index, dt.beforeId);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dropTarget]);

  const moveField = useCallback((fromTableId, fieldId, toTableId, toIndex, beforeFieldId) => {
    // `toIndex` counts rendered rows, which is not the fields array (rows are
    // grouped, and hidden dropped fields aren't rendered). Prefer resolving the
    // "insert above this field" id; fall back to the raw index if it's gone.
    const resolveIndex = (fields) => {
      if (!beforeFieldId) return fields.length;
      const j = fields.findIndex(f => f.id === beforeFieldId);
      return j < 0 ? Math.min(toIndex, fields.length) : j;
    };
    if (fromTableId === toTableId) {
      // Reorder within table
      mutate(s => {
        const t = s.tables.find(x => x.id === fromTableId);
        if (!t) return s;
        const i = t.fields.findIndex(f => f.id === fieldId);
        if (i < 0) return s;
        const target = resolveIndex(t.fields);
        const [f] = t.fields.splice(i, 1);
        const adjusted = target > i ? target - 1 : target;
        t.fields.splice(adjusted, 0, f);
        return s;
      });
    } else {
      mutate(s => {
        const from = s.tables.find(x => x.id === fromTableId);
        const to = s.tables.find(x => x.id === toTableId);
        if (!from || !to) return s;
        const i = from.fields.findIndex(f => f.id === fieldId);
        if (i < 0) return s;
        const target = resolveIndex(to.fields);
        const [f] = from.fields.splice(i, 1);
        to.fields.splice(target, 0, f);
        // Any relationships pointing to this field stay valid (we don't change ids)
        // but FK definitions on the moved field referencing tables in *from* are still fine.
        // Update relationships where from.table was the source:
        for (const r of s.relationships) {
          if (r.from.field === fieldId && r.from.table === fromTableId) {
            r.from.table = toTableId;
          }
          if (r.to.field === fieldId && r.to.table === fromTableId) {
            r.to.table = toTableId;
          }
        }
        return s;
      });
    }
  }, [mutate]);

  const moveFieldRef = useRef(moveField);
  useEffect(() => { moveFieldRef.current = moveField; }, [moveField]);

  // ---------- table drag ----------
  const tableDrag = useRef(null);
  const onTableHeaderMouseDown = (e, tableId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelection({ type: 'table', tableId });
    setRightTab('inspector');
    if (editModeRef.current) setPanelOpen(true);
    const table = schema.tables.find(t => t.id === tableId);
    if (!table) return;
    tableDrag.current = {
      tableId,
      startX: e.clientX, startY: e.clientY,
      origX: table.x, origY: table.y,
    };
  };
  useEffect(() => {
    const onMove = (e) => {
      const td = tableDrag.current;
      if (!td) return;
      const dx = (e.clientX - td.startX) / view.k;
      const dy = (e.clientY - td.startY) / view.k;
      setSchema(prev => {
        const next = clone(prev);
        const t = next.tables.find(x => x.id === td.tableId);
        if (!t) return prev;
        t.x = Math.round((td.origX + dx) / 8) * 8;
        t.y = Math.round((td.origY + dy) / 8) * 8;
        return next;
      });
    };
    const onUp = () => {
      if (tableDrag.current) {
        // Push a history snapshot after drag ends
        undoStack.current.push(undoStack.current[undoStack.current.length - 1] || schema);
      }
      tableDrag.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [view.k, schema]);

  // ---------- tooltip ----------
  const tooltipTimer = useRef(null);
  const showTooltip = (data) => {
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(data), 350);
  };
  const hideTooltip = () => {
    clearTimeout(tooltipTimer.current);
    setTooltip(null);
  };

  const onTableHeaderMouseEnter = (e, tableId) => {
    if (draggedField || tableDrag.current) return;
    const t = schema.tables.find(x => x.id === tableId);
    if (!t) return;
    showTooltip({
      title: t.name,
      pill: dataClassOf(t.dataClass)?.label || null,
      description: t.description,
      purpose: t.purpose,
      ownership: t.owningDomain
        ? `Owned by ${domainMetaOf(domains, t.owningDomain)?.name}. Source of truth: ${t.sourceOfTruth || "—"}.`
        : null,
      conversationPoint: t.conversationPoint || null,
      warning: !t.owningDomain ? "No owning domain assigned. Decide which team owns this table's writes." : null,
      anchorX: e.clientX, anchorY: e.clientY,
    });
  };
  const onFieldMouseEnter = (e, tableId, fieldId) => {
    if (draggedField || tableDrag.current) return;
    const t = schema.tables.find(x => x.id === tableId);
    const f = t?.fields.find(x => x.id === fieldId);
    if (!f) return;
    const pill = f.pk ? "PK" : f.fk ? "FK" : f.unique ? "UQ" : f.indexed ? "IX" : null;
    showTooltip({
      title: `${t.name}.${f.name}`,
      pill,
      description: f.description,
      example: f.example,
      legacy: f.legacyField,
      warning: f.warning?.message,
      anchorX: e.clientX, anchorY: e.clientY,
    });
  };

  const onGroupMouseEnter = (e, tableId, groupName) => {
    if (draggedField || tableDrag.current) return;
    const t = schema.tables.find(x => x.id === tableId);
    if (!t) return;
    const groups = groupsOfTable(t);
    const g = groups.find(x => x.name === groupName);
    if (!g) return;
    const fieldNames = g.fields.map(f => f.name).join(", ");
    showTooltip({
      title: `${t.name} · ${groupName}`,
      pill: `${g.fields.length} fields`,
      description: `Fields in this area: ${fieldNames}`,
      anchorX: e.clientX, anchorY: e.clientY,
    });
  };

  // ---------- patches ----------
  const patchTable = (tableId, patch) => mutate(s => {
    const t = s.tables.find(x => x.id === tableId);
    if (!t) return s;
    Object.assign(t, patch);
    if (patch.domain && !t.owningDomain) t.owningDomain = patch.domain;
    return s;
  });
  const patchField = (tableId, fieldId, patch) => mutate(s => {
    const t = s.tables.find(x => x.id === tableId);
    if (!t) return s;
    const f = t.fields.find(x => x.id === fieldId);
    if (!f) return s;
    Object.assign(f, patch);
    // Keep relationships in sync with fk
    s.relationships = s.relationships.filter(r => !(r.from.table === tableId && r.from.field === fieldId));
    if (f.fk) {
      s.relationships.push({
        id: uid('r'),
        from: { table: tableId, field: fieldId },
        to:   { table: f.fk.table, field: f.fk.field },
        type: 'N:1',
      });
    }
    return s;
  });
  // Bulk mark/unmark a whole semantic group. Groups are derived, so resolve the
  // field ids against the live table rather than trusting anything passed in.
  // The table's own primary key is never dropped — losing it would orphan every
  // relationship that targets it.
  const setGroupDrop = (tableId, groupName, drop) => mutate(s => {
    const t = s.tables.find(x => x.id === tableId);
    if (!t) return s;
    const g = groupsOfTable(t).find(x => x.name === groupName);
    if (!g) return s;
    const ids = new Set(g.fields.filter(f => !f.pk).map(f => f.id));
    for (const f of t.fields) {
      if (ids.has(f.id)) f.drop = drop;
    }
    return s;
  });
  const deleteField = (tableId, fieldId) => mutate(s => {
    const t = s.tables.find(x => x.id === tableId);
    if (!t) return s;
    t.fields = t.fields.filter(f => f.id !== fieldId);
    s.relationships = s.relationships.filter(r =>
      !(r.from.table === tableId && r.from.field === fieldId) &&
      !(r.to.table === tableId && r.to.field === fieldId)
    );
    setSelection(null);
    return s;
  });
  const addField = (tableId) => mutate(s => {
    const t = s.tables.find(x => x.id === tableId);
    if (!t) return s;
    const f = {
      id: uid('f'),
      name: 'new_field',
      type: 'varchar(80)',
      pk: false, fk: null, unique: false, indexed: false, nullable: true,
      description: '', example: '', warning: null, drop: false,
    };
    t.fields.push(f);
    setSelection({ type: 'field', tableId, fieldId: f.id });
    return s;
  });
  const deleteTable = (tableId) => {
    if (!confirm('Delete this table and its relationships?')) return;
    mutate(s => {
      s.tables = s.tables.filter(t => t.id !== tableId);
      s.relationships = s.relationships.filter(r => r.from.table !== tableId && r.to.table !== tableId);
      setSelection(null);
      return s;
    });
  };
  const addTable = () => {
    const cx = (-view.x + hostSize.w / 2) / view.k - 130;
    const cy = (-view.y + hostSize.h / 2) / view.k - 80;
    mutate(s => {
      const id = uid('t');
      const t = {
        id, name: 'new_table',
        domain: 'unassigned',
        x: Math.round(cx / 8) * 8, y: Math.round(cy / 8) * 8,
        dataClass: null,
        description: '', purpose: '',
        owningDomain: null, consumingDomains: [],
        sourceOfTruth: null, syncDirection: null,
        writeOwner: null, readConsumers: [],
        changeFrequency: 'medium', sensitivity: 'internal',
        fields: [
          { id: uid('f'), name: 'id', type: 'uuid', pk: true, fk: null, unique: false, indexed: false, nullable: false, description: 'Primary key.', example: '' },
          { id: uid('f'), name: 'created_at', type: 'timestamptz', pk: false, fk: null, unique: false, indexed: false, nullable: false, description: 'Audit — creation time.', example: '' },
          { id: uid('f'), name: 'updated_at', type: 'timestamptz', pk: false, fk: null, unique: false, indexed: false, nullable: false, description: 'Audit — last update.', example: '' },
        ],
      };
      s.tables.push(t);
      setSelection({ type: 'table', tableId: id });
      return s;
    });
  };

  // ---------- disposition: marked for deletion + cascade ----------
  // Marked (a decision) vs orphaned (a consequence — its FK target is marked).
  // Derived, never stored: see lib/dropped.js for why. Declared here because
  // search, the canvas filter and the review panel all read it.
  const dropSets = useMemo(() => computeDropSets(schema.tables), [schema.tables]);

  // ---------- search ----------
  // Returns { tableNameHits: Set<tableId>, fieldHits: Set<fieldId>, tableHits: Set<tableId> }
  // tableHits = tables that should NOT be dimmed (name match OR contains field match)
  const search = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const empty = { q: "", tableNameHits: new Set(), fieldHits: new Set(), tableHits: new Set() };
    if (!q) return empty;
    const tableNameHits = new Set();
    const fieldHits = new Set();
    const tableHits = new Set();
    for (const t of schema.tables) {
      let nameMatch = false;
      if (t.name.toLowerCase().includes(q)) {
        nameMatch = true;
        tableNameHits.add(t.id);
        tableHits.add(t.id);
      }
      for (const f of t.fields) {
        // Skip fields hidden by the dropped filter — matching them would
        // un-dim a table whose visible rows show no hit at all.
        if (!showDropped && dropSets.hidden.has(f.id)) continue;
        if (f.name.toLowerCase().includes(q)) {
          fieldHits.add(f.id);
          tableHits.add(t.id);
        }
      }
    }
    return { q, tableNameHits, fieldHits, tableHits };
  }, [searchQ, schema.tables, showDropped]);

  // ---------- review findings ----------
  const findings = useMemo(() => analyzeSchema(schema.tables, schema.relationships), [schema]);
  const findingsCount = findings.length;
  const highCount = findings.filter(f => f.severity === 'high').length;

  // ---------- field positions for relationship lines ----------
  const [fieldPositions, setFieldPositions] = useState({});
  useLayoutEffect(() => {
    // measure after render — `showDropped` changes row counts, so card heights
    // and every field row offset move with it. Missing this dep leaves
    // relationship lines anchored to stale offsets after a toggle.
    const next = computeFieldPositions(schema.tables, tableRefs);
    setFieldPositions(next);
  }, [schema.tables, viewMode, showDropped]);

  // ---------- highlighted table for relationship emphasis ----------
  const highlightTableId = selection?.type === 'table' ? selection.tableId
                          : selection?.type === 'field' ? selection.tableId
                          : null;

  // Hovered table = under mouse for relationship emphasis
  const [hoveredTableId, setHoveredTableId] = useState(null);

  // ---------- card geometry ----------
  // One source of card size for every consumer that needs to reason about the
  // canvas in world units (fit, tidy, auto-arrange). The DOM is the only real
  // answer: height depends on viewMode — Core lists groups, Detail lists every
  // field — and on how many fields are hidden right now, so it can't be derived
  // from the field count.
  //
  // The estimate below is only reached when a card hasn't rendered yet, e.g. the
  // fit that runs immediately after loading a different schema. A detached
  // element reports 0, which correctly counts as unmeasured.
  const cardSize = useCallback((t) => {
    const el = tableRefs.current.get(t.id)?.el;
    if (el) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) return { w, h };
    }
    const groups = groupsOfTable(t).length;
    const h = viewMode === 'detail'
      // head + meta row + one label per group + one row per field + add-row
      ? 34 + 25 + groups * 20 + t.fields.length * 23 + 24
      // head + one row per group
      : 34 + groups * 28;
    return { w: 240, h };
  }, [viewMode]);

  // ---------- fit to screen ----------
  const fitToScreen = () => {
    if (schema.tables.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of schema.tables) {
      const { w, h } = cardSize(t);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + w);
      maxY = Math.max(maxY, t.y + h);
    }
    const pad = 80;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const k = Math.min(hostSize.w / w, hostSize.h / h, 1);
    setView({
      k,
      x: -minX * k + (hostSize.w - (maxX - minX) * k) / 2,
      y: -minY * k + (hostSize.h - (maxY - minY) * k) / 2,
    });
  };
  // Always points at the latest fitToScreen closure so async callbacks
  // (e.g. after switching schemas) see fresh state instead of stale tables.
  const fitToScreenRef = useRef(fitToScreen);
  useEffect(() => { fitToScreenRef.current = fitToScreen; });

  // Fit the view to a subset of tables (used by walkthrough focus + jump).
  // Padding leaves room around the focused cluster so it doesn't feel cramped.
  const fitToTables = useCallback((tableIds, opts = {}) => {
    const pad = opts.pad ?? 140;
    const subset = schema.tables.filter(t => tableIds.includes(t.id));
    if (subset.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of subset) {
      const { w: cw, h: ch } = cardSize(t);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + cw);
      maxY = Math.max(maxY, t.y + ch);
    }
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const k = Math.min(hostSize.w / w, hostSize.h / h, 1.4);
    setView({
      k,
      x: -minX * k + (hostSize.w - (maxX - minX) * k) / 2,
      y: -minY * k + (hostSize.h - (maxY - minY) * k) / 2,
    });
  }, [schema.tables, hostSize, setView, cardSize]);
  const fitToTablesRef = useRef(fitToTables);
  useEffect(() => { fitToTablesRef.current = fitToTables; });

  // ---------- panning the canvas to coordinates (from minimap) ----------
  const panTo = (worldX, worldY) => {
    setView(v => ({ ...v, x: -worldX * v.k, y: -worldY * v.k }));
  };

  // ---------- layout: tidy + auto-arrange ----------
  const measureSizes = useCallback(() => {
    const sizes = {};
    for (const t of schema.tables) {
      // Shared with fit — measures the live card, and falls back to a viewMode-
      // aware estimate instead of a flat 240×200 when there's nothing to measure.
      sizes[t.id] = cardSize(t);
    }
    return sizes;
  }, [schema.tables, cardSize]);

  const tidy = useCallback(() => {
    const sizes = measureSizes();
    const spaced = resolveOverlaps(schema.tables, sizes);
    const result = reduceCrossings(schema.tables, schema.relationships, sizes, spaced);
    mutate(s => {
      for (const t of s.tables) {
        const p = result[t.id];
        if (p) { t.x = p.x; t.y = p.y; }
      }
      return s;
    });
  }, [schema, mutate, measureSizes]);

  const autoArrange = useCallback(() => {
    const sizes = measureSizes();
    const result = computeAutoArrange(schema.tables, schema.relationships, sizes);
    mutate(s => {
      for (const t of s.tables) {
        const p = result[t.id];
        if (p) { t.x = p.x; t.y = p.y; }
      }
      return s;
    });
    setTimeout(fitToScreen, 100);
  }, [schema, mutate, measureSizes]);

  // Settle the layout whenever a whole model is loaded — on mount with a
  // remembered schema, and on every schema swap after that.
  //
  // The positions stored in a schema file were authored against some particular
  // card size, and the card size here depends on the view mode, the theme's type
  // and the current padding. So a file that looked fine when it was written can
  // open with its cards overlapping. Resolving overlaps against the cards as
  // actually measured, then fitting, means a schema is readable the moment it
  // appears rather than after the user finds the Tidy command.
  useEffect(() => {
    if (schema.tables.length === 0) return undefined;
    let raf2 = 0, timer = 0;
    // Two frames: one for the new cards to render, one for the measurement
    // pass that records their real size.
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const sizes = measureSizes();
        const current = schemaRef.current;
        const spaced = resolveOverlaps(current.tables, sizes, { pad: 44 });
        const settled = reduceCrossings(current.tables, current.relationships, sizes, spaced);
        setSchema(prev => {
          const next = clone(prev);
          for (const t of next.tables) {
            const pos = settled[t.id];
            if (pos) { t.x = pos.x; t.y = pos.y; }
          }
          return next;
        });
        timer = setTimeout(() => fitToScreenRef.current?.(), 50);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
    // Deliberately keyed on the nonce alone: this must run when a model is
    // swapped in, never on an ordinary field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutNonce]);

  // Auto-tidy when view mode changes (after card sizes are measured)
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current !== viewMode) {
      prevViewMode.current = viewMode;
      // Wait for the DOM to reflect the new card sizes
      const t = setTimeout(() => {
        const sizes = measureSizes();
        const result = resolveOverlaps(schema.tables, sizes);
        setSchema(prev => {
          const next = clone(prev);
          for (const tt of next.tables) {
            const p = result[tt.id];
            if (p) { tt.x = p.x; tt.y = p.y; }
          }
          return next;
        });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [viewMode, schema.tables, measureSizes]);

  // ---------- jump to finding ----------
  const jumpToFinding = (target) => {
    if (!target) return;
    setSelection({ type: target.field ? 'field' : 'table', tableId: target.table, fieldId: target.field });
    setRightTab('inspector');
    setPanelOpen(true);
    const t = schema.tables.find(x => x.id === target.table);
    if (!t) return;
    // Center
    const cx = t.x + 130, cy = t.y + 120;
    setView(v => ({ ...v, x: hostSize.w / 2 - cx * v.k, y: hostSize.h / 2 - cy * v.k }));
  };

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); document.querySelector('.search-wrap input')?.focus(); }
      else if (e.key === 'Escape') { setSelection(null); setOpenMenu(null); setExportModal(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---------- import / export ----------
  const exportJson = () => {
    const content = JSON.stringify(schema, null, 2);
    setExportModal({ kind: 'json', content });
  };
  const exportSql = () => setExportModal({ kind: 'sql', content: buildSqlDdl(schema) });
  const exportMd = () => setExportModal({ kind: 'md', content: buildMarkdownDoc(schema) });
  const exportMermaid = () => {
    const initialOptions = { includeComments: true };
    setExportModal({
      kind: 'mermaid',
      content: buildMermaid(schema, initialOptions),
      rebuild: (opts) => buildMermaid(schema, opts),
      initialOptions,
    });
  };
  const importSchema = (accept) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const isSqlByExt = /\.sql$/i.test(file.name);
      const r = new FileReader();
      r.onload = () => {
        const text = r.result;
        const trimmed = text.trim();
        const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
        try {
          if (!isSqlByExt && looksJson) {
            const parsed = JSON.parse(text);
            if (!parsed.tables || !parsed.relationships) throw new Error('invalid schema JSON shape');
            mutate(() => parsed);
            onSchemaReplaced(null);
          } else {
            const { schema: imported, warnings } = parseSqlDdl(text);
            mutate(() => imported);
            onSchemaReplaced(null);
            if (warnings.length > 0) {
              alert(
                `Imported ${imported.tables.length} tables, ${imported.relationships.length} relationships.\n\n` +
                `Warnings:\n - ${warnings.slice(0, 10).join('\n - ')}` +
                (warnings.length > 10 ? `\n …and ${warnings.length - 10} more` : '')
              );
            }
          }
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      r.readAsText(file);
    };
    inp.click();
  };
  const importJson = () => importSchema('.json,application/json');
  const importSql  = () => importSchema('.sql,application/sql,text/plain');
  const importAny  = () => importSchema('.json,.sql,application/json,application/sql,text/plain');

  // Shared by every path that swaps the whole model out — a built-in pick or a
  // file import. Resets the view state that belonged to the old schema and
  // records (or forgets) which built-in is showing.
  const onSchemaReplaced = (id) => {
    setActiveSchemaId(id);
    lsSet(LS_SCHEMA, id);
    setStartOpen(false);
    setSelection(null);
    setLayoutNonce(k => k + 1);
    setWalkthrough({ active: false, stepIndex: 0, variant: 0 });
    setRationaleOpen(false);
    setRationaleVariant(0);
    closeMenus();
    // Drop hidden-domain filters since the new schema may use different domains
    setHiddenDomains(new Set());
    // Layout and fit are handled by the settle effect, which waits for the new
    // cards to be measured first.
  };

  const loadBuiltin = (id) => {
    const entry = schemaById(id);
    if (!entry) return;
    mutate(() => clone(entry.data));
    onSchemaReplaced(id);
  };

  // Back to the start screen without discarding what is loaded.
  const openStart = () => {
    setStartOpen(true);
    closeMenus();
    closeMenus();
    closeMenus();
    closeMenus();
  };

  // ---------- walkthrough ----------
  // Each schema maps to a list of walkthroughs; `variant` picks the active one.
  const walkthroughList = (activeSchemaId && WALKTHROUGHS[activeSchemaId]) || null;
  const walkthroughScript = walkthroughList?.[walkthrough.variant] || null;

  // ---------- rationale ----------
  // Each schema maps to a list of rationale pages; `rationaleVariant` picks one.
  const rationaleList = (activeSchemaId && RATIONALES[activeSchemaId]) || null;
  const rationalePage = rationaleList?.[rationaleVariant] || null;
  const walkthroughStep = walkthrough.active && walkthroughScript
    ? walkthroughScript.steps[walkthrough.stepIndex] || null
    : null;

  // Apply the step's focus to the canvas: pan/zoom + close the right panel
  // so the narration card has the stage. Runs whenever the active step
  // changes.
  useEffect(() => {
    if (!walkthroughStep) return;
    setPanelOpen(false);
    setSelection(null);
    const focus = walkthroughStep.focus;
    const fit = fitToTablesRef.current;
    const allFit = fitToScreenRef.current;
    // Defer so any re-render from setPanelOpen/setSelection settles first.
    const t = setTimeout(() => {
      if (focus === 'all' || !Array.isArray(focus)) {
        allFit?.();
      } else {
        fit?.(focus);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [walkthrough.active, walkthrough.stepIndex, walkthroughStep]);

  const startWalkthrough = (variant = 0) => {
    if (!walkthroughList?.[variant]) return;
    closeMenus();
    setWalkthrough({ active: true, stepIndex: 0, variant });
  };
  const exitWalkthrough = () => {
    setWalkthrough(w => ({ ...w, active: false, stepIndex: 0 }));
    setTimeout(() => fitToScreenRef.current?.(), 30);
  };
  const stepNext = () => setWalkthrough(w => ({
    ...w,
    stepIndex: Math.min(w.stepIndex + 1, (walkthroughScript?.steps.length || 1) - 1),
  }));
  const stepPrev = () => setWalkthrough(w => ({
    ...w,
    stepIndex: Math.max(0, w.stepIndex - 1),
  }));
  const stepJump = (i) => setWalkthrough(w => ({ ...w, stepIndex: i }));

  // Click handler for entity links inside the rationale panel (Entity Catalog
  // page in particular). Closes the rationale overlay, selects the target
  // table, opens the inspector, and pans/zooms the canvas to it.
  const focusTableFromRationale = useCallback((tableId) => {
    const exists = schema.tables.some(t => t.id === tableId);
    if (!exists) return;
    setRationaleOpen(false);
    closeMenus();
    setSelection({ type: 'table', tableId });
    setPanelOpen(true);
    setTimeout(() => fitToTablesRef.current?.([tableId]), 60);
  }, [schema.tables]);

  // Focus set used by the canvas dim/highlight logic. Empty when inactive,
  // or contains the step's table ids. 'all' means "no dimming" — we encode
  // that as null.
  const walkthroughFocus = walkthroughStep
    ? (walkthroughStep.focus === 'all' || !Array.isArray(walkthroughStep.focus)
        ? null
        : new Set(walkthroughStep.focus))
    : undefined;  // undefined = walkthrough is off entirely

  const loadedSchemaName = activeSchemaId
    ? schemaById(activeSchemaId)?.name
    : schema.tables.length > 0 ? 'Imported schema' : 'No schema loaded';

  // ---------- counts for status bar ----------
  const stats = useMemo(() => {
    const fields = schema.tables.reduce((s, t) => s + t.fields.length, 0);
    const pks = schema.tables.reduce((s, t) => s + t.fields.filter(f => f.pk).length, 0);
    const fks = schema.tables.reduce((s, t) => s + t.fields.filter(f => f.fk).length, 0);
    return {
      tables: schema.tables.length,
      fields, pks, fks,
      rels: schema.relationships.length,
    };
  }, [schema]);

  // ---------- visible tables filtered by hidden domains + dropped fields ----------
  // The single seam every canvas consumer reads through: the table card, the
  // relationship layers and the minimap all take `visibleTables`, so filtering
  // here is enough. Semantic groups are derived from `table.fields` inside the
  // card, so groups left empty by hiding collapse on their own.
  // `droppedCount` rides along so the card header can admit what it's hiding.
  const visibleTables = useMemo(
    () => schema.tables
      .filter(t => !hiddenDomains.has(t.domain))
      .map(t => {
        const hideable = f => dropSets.hidden.has(f.id);
        const gone = t.fields.filter(hideable);
        if (gone.length === 0) return t;
        return {
          ...t,
          droppedCount: gone.length,
          orphanCount: gone.filter(f => dropSets.orphaned.has(f.id)).length,
          fields: showDropped ? t.fields : t.fields.filter(f => !hideable(f)),
        };
      }),
    [schema.tables, hiddenDomains, showDropped, dropSets]
  );

  // Counted across the whole schema, not just visible tables, so the toolbar
  // badge doesn't change meaning when a domain is hidden.
  const droppedTotal = dropSets.hidden.size;
  const orphanTotal = useMemo(
    () => [...dropSets.hidden].filter(id => dropSets.orphaned.has(id)).length,
    [dropSets]
  );
  const markedTotal = droppedTotal - orphanTotal;

  // Field ids with no rendered row right now. A relationship touching one would
  // otherwise fall back to anchoring at the card centre — a line emerging from
  // nowhere, which is the opposite of de-cluttering. Empty when showing dropped.
  const hiddenFieldIds = useMemo(
    () => (showDropped ? new Set() : dropSets.hidden),
    [dropSets, showDropped]
  );

  const toggleDomain = (d) => {
    setHiddenDomains(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  // ---------- render ----------
  return (
    <div className={`app ${panelOpen ? 'panel-open' : ''}`}>
      {/* ============ Top bar ============ */}
      <div className="topbar">
        <button
          type="button"
          className={`brand ${startOpen ? 'active' : ''}`}
          onClick={openStart}
          title={`${loadedSchemaName} — click to choose a different schema`}
          aria-label="Choose a different schema"
        >
          <div className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">Schema Studio</span>
          </div>
          <Icon.Chevron className="brand-caret" />
        </button>

        <div className="top-tools">
          <CanvasMenu
            open={openMenu === 'canvas'}
            onToggle={() => toggleMenu('canvas')}
            onClose={closeMenus}
            undo={undo}
            redo={redo}
            addTable={addTable}
            fitToScreen={fitToScreen}
            tidy={tidy}
            autoArrange={autoArrange}
            lineStyle={lineStyle}
            setLineStyle={setLineStyle}
          />
          <div className="segment" title="View density">
            <button className={viewMode === 'core' ? 'active' : ''} onClick={() => setViewMode('core')}>
              <Icon.Compact /> Core
            </button>
            <button className={viewMode === 'detail' ? 'active' : ''} onClick={() => setViewMode('detail')}>
              <Icon.Rows /> Detail
            </button>
          </div>
          <button
            className={`tool-btn ${showDropped ? 'active' : ''}`}
            onClick={() => setShowDropped(v => !v)}
            title={
              droppedTotal === 0 && dropSets.deadTableIds.size === 0
                ? "No fields are marked for deletion"
                : `${showDropped ? 'Hide' : 'Show'} ${droppedTotal} hidden field(s)`
                  + `\n  ${markedTotal} marked for deletion`
                  + (orphanTotal > 0
                      ? `\n  ${orphanTotal} orphaned (FK target is marked)`
                      : '')
                  + (dropSets.deadTableIds.size > 0
                      ? `\n  ${dropSets.deadTableIds.size} table(s) dead (identity marked) — struck out, not hidden`
                      : '')
            }
          >
            <Icon.Trash />
            <span className="tool-label">Dropped</span>
            {droppedTotal > 0 && <span className="tool-count">{droppedTotal}</span>}
          </button>
          <button
            className={`tool-btn ${editMode ? 'active' : ''}`}
            onClick={() => setEditMode(m => !m)}
            title={editMode ? "Exit edit mode" : "Enter edit mode — opens inspector on click"}
          >
            <Icon.Edit />
            <span className="tool-label">Edit</span>
          </button>
          <div style={{ position: 'relative' }} data-menu-root>
            <button
              className={`tool-btn collapsible ${walkthrough.active || openMenu === 'walkthrough' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (walkthrough.active) { exitWalkthrough(); return; }
                const count = walkthroughList?.length || 0;
                if (count === 0) return;
                if (count === 1) { startWalkthrough(0); return; }
                toggleMenu('walkthrough');
              }}
              disabled={!walkthroughList?.length}
              title={
                !walkthroughList?.length ? "No walkthrough for the loaded schema"
                : walkthrough.active ? "Exit walkthrough"
                : walkthroughList.length > 1 ? "Choose a walkthrough"
                : `Start ${walkthroughList[0].name}`
              }
            >
              <Icon.ChevronRight />
              <span className="tool-label">{walkthrough.active ? 'Exit walkthrough' : 'Walkthrough'}</span>
              {!walkthrough.active && walkthroughList?.length > 1 && <Icon.Chevron />}
            </button>
            {openMenu === 'walkthrough' && !walkthrough.active && walkthroughList?.length > 1 && (
              <div className="menu" style={{ left: 0, top: 36, minWidth: 300 }} onClick={(e) => e.stopPropagation()}>
                <div className="menu-label">Walkthroughs · {activeSchemaId && schemaById(activeSchemaId)?.name}</div>
                {walkthroughList.map((w, i) => (
                  <div
                    key={w.id}
                    className={`menu-item ${walkthrough.variant === i ? 'active' : ''}`}
                    title={w.description}
                    onClick={() => startWalkthrough(i)}
                  >
                    <Icon.ChevronRight />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span>{w.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.3 }}>
                        {w.steps.length} steps · {w.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }} data-menu-root>
            <button
              className={`tool-btn collapsible ${rationaleOpen || openMenu === 'rationale' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (rationaleOpen) { setRationaleOpen(false); return; }
                const count = rationaleList?.length || 0;
                if (count === 0) return;
                if (count === 1) { setRationaleVariant(0); setRationaleOpen(true); return; }
                toggleMenu('rationale');
              }}
              disabled={!rationaleList?.length}
              title={
                !rationaleList?.length ? "No rationale available for this schema"
                : rationaleOpen ? "Close rationale"
                : rationaleList.length > 1 ? "Choose a rationale page"
                : "Open rationale — why this schema looks like it does"
              }
            >
              <Icon.Info />
              <span className="tool-label">Rationale</span>
              {!rationaleOpen && rationaleList?.length > 1 && <Icon.Chevron />}
            </button>
            {openMenu === 'rationale' && !rationaleOpen && rationaleList?.length > 1 && (
              <div className="menu" style={{ right: 0, top: 36, minWidth: 300 }} onClick={(e) => e.stopPropagation()}>
                <div className="menu-label">Rationale pages · {activeSchemaId && schemaById(activeSchemaId)?.name}</div>
                {rationaleList.map((r, i) => (
                  <div
                    key={r.id}
                    className={`menu-item ${rationaleVariant === i ? 'active' : ''}`}
                    title={r.intent}
                    onClick={() => { setRationaleVariant(i); closeMenus(); setRationaleOpen(true); }}
                  >
                    <Icon.Info />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span>{r.name || r.title}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.3 }}>
                        {r.subtitle}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ThemeMenu
            theme={theme}
            setTheme={setTheme}
            open={openMenu === 'theme'}
            onToggle={() => toggleMenu('theme')}
            onClose={closeMenus}
          />
          <a
            className="tool-btn icon-only"
            href="site/guide.html"
            target="_blank"
            rel="noreferrer"
            title="Read the guide"
            aria-label="Read the guide"
          >
            <Icon.Help />
          </a>
        </div>

        <div className="top-spacer" />

        <div className="search-wrap">
          <Icon.Search />
          <input
            type="text"
            placeholder="Search tables and fields"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <span className="search-kbd">⌘F</span>
        </div>

        <div className="top-tools" style={{ position: 'relative' }}>
          <button
            className={`tool-btn ${panelOpen && rightTab === 'review' ? 'active' : ''}`}
            onClick={() => { setRightTab('review'); setPanelOpen(true); }}
            title="Schema Review"
          >
            <Icon.Warn />
            <span className="tool-label">Review</span>
            {findingsCount > 0 && (
              <span style={{
                marginLeft: 2,
                fontSize: 10,
                background: highCount > 0 ? 'var(--warn-bg)' : 'var(--surface-sunken)',
                color: highCount > 0 ? 'var(--warn)' : 'var(--ink-3)',
                padding: '1px 5px',
                borderRadius: 8,
                fontFamily: 'var(--mono)',
                fontWeight: 600,
              }}>{findingsCount}</span>
            )}
          </button>
          <div style={{ position: 'relative' }} data-menu-root>
            <button
              className={`tool-btn ${openMenu === 'import' ? 'active' : ''}`}
              onClick={() => toggleMenu('import')}
              title="Import schema"
            >
              <Icon.Import /><span className="tool-label">Import</span><Icon.Chevron />
            </button>
            {openMenu === 'import' && (
              <div className="menu" style={{ right: 0, top: 36, minWidth: 280 }} onClick={(e) => e.stopPropagation()}>
                <div className="menu-label">Bring your own</div>
                <div className="menu-item" onClick={() => { importJson(); closeMenus(); }}>
                  <Icon.Import /> Import JSON
                </div>
                <div className="menu-item" onClick={() => { importSql(); closeMenus(); }}>
                  <Icon.Import /> Import SQL DDL
                </div>
                {SCHEMA_GROUPS.map(g => (
                  <React.Fragment key={g.id}>
                    <div className="menu-sep" />
                    <div className="menu-label">{g.label}</div>
                    {schemasInGroup(g.id).map(entry => {
                      const st = schemaStats(entry);
                      return (
                        <div
                          key={entry.id}
                          className={`menu-item ${activeSchemaId === entry.id ? 'active' : ''}`}
                          title={entry.description}
                          onClick={() => { loadBuiltin(entry.id); closeMenus(); }}
                        >
                          <Icon.Layers />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{entry.name}</span>
                              {activeSchemaId === entry.id && <Icon.Check style={{ color: 'var(--accent)' }} />}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.3 }}>
                              {st.tables} tables · {st.fields} fields · {st.relationships} relationships
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }} data-menu-root>
          <button
            className={`tool-btn primary ${openMenu === 'export' ? 'active' : ''}`}
            onClick={() => toggleMenu('export')}
            title="Export the loaded schema"
          >
            <Icon.Export /><span className="tool-label">Export</span><Icon.Chevron />
          </button>
          {openMenu === 'export' && (
            <div className="menu" style={{ right: 0, top: 36 }} onClick={(e) => e.stopPropagation()}>
              <div className="menu-label">Schema</div>
              <div className="menu-item" onClick={() => { exportJson(); closeMenus(); }}>
                <Icon.Export /> Save schema as JSON
              </div>
              <div className="menu-item" onClick={() => { exportSql(); closeMenus(); }}>
                <Icon.Export /> Export SQL DDL
              </div>
              <div className="menu-item" onClick={() => { exportMd(); closeMenus(); }}>
                <Icon.Export /> Documentation (Markdown)
              </div>
              <div className="menu-sep" />
              <div className="menu-label">Diagram</div>
              <div className="menu-item" onClick={() => { exportMermaid(); closeMenus(); }}>
                <Icon.Export /> Mermaid (.mmd)
              </div>
              <div className="menu-item" onClick={() => { window.print(); closeMenus(); }}>
                <Icon.Export /> Print / Save as PDF
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ============ Main canvas ============ */}
      <div className="main">
        <div ref={hostRef} className="canvas-host">
          <div
            className="canvas-stage"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          >
            {(() => {
              const visibleRels = schema.relationships.filter(r => {
                const fromT = schema.tables.find(x => x.id === r.from.table);
                const toT = schema.tables.find(x => x.id === r.to.table);
                if (!fromT || !toT) return false;
                if (hiddenDomains.has(fromT.domain) || hiddenDomains.has(toT.domain)) return false;
                return !hiddenFieldIds.has(r.from.field) && !hiddenFieldIds.has(r.to.field);
              });
              return (
                <RelationshipsLayer
                  tables={visibleTables}
                  relationships={visibleRels}
                  positions={fieldPositions}
                  highlightTableId={highlightTableId}
                  hoveredTableId={hoveredTableId}
                  lineStyle={lineStyle}
                  mode="background"
                />
              );
            })()}

            {visibleTables.map(t => {
              const isSelected = selection?.tableId === t.id;
              const isTableNameHit = search.tableNameHits.has(t.id);
              const isTableHit = search.tableHits.has(t.id);
              const isDropTarget = dropTarget?.tableId === t.id;
              const isInWalkthroughFocus = walkthroughFocus instanceof Set && walkthroughFocus.has(t.id);
              const isHighlighted = !!highlightTableId && (
                highlightTableId === t.id ||
                schema.relationships.some(r =>
                  (r.from.table === highlightTableId && r.to.table === t.id) ||
                  (r.to.table === highlightTableId && r.from.table === t.id)
                )
              );
              // Walkthrough focus, when active, overrides selection/search-based dimming:
              // tables in the step's focus are highlighted, everything else is dimmed.
              // walkthroughFocus === null means "show everything" (overview steps).
              let dim, walkthroughHighlight = false;
              if (walkthroughFocus instanceof Set) {
                dim = !isInWalkthroughFocus;
                walkthroughHighlight = isInWalkthroughFocus;
              } else {
                dim = (highlightTableId && !isHighlighted) || (search.q && !isTableHit);
              }
              return (
                <TableCard
                  key={t.id}
                  table={t}
                  domainMeta={domainMetaOf(domains, t.domain)}
                  dimensions={tableRefs}
                  selected={isSelected}
                  dim={dim}
                  highlighted={(walkthroughHighlight || isHighlighted) && !isSelected}
                  isSearchHit={search.q && isTableNameHit}
                  searchFieldHits={search.fieldHits}
                  searchQ={search.q}
                  orphanedFieldIds={dropSets.orphaned}
                  dead={dropSets.deadTableIds.has(t.id)}
                  isDropTarget={isDropTarget}
                  dropIndicatorIndex={isDropTarget ? dropTarget.index : -1}
                  viewMode={viewMode}
                  selectedGroupKey={selection?.type === 'group' ? `${selection.tableId}::${selection.groupName}` : null}
                  onSelectGroup={selectGroup}
                  onGroupMouseEnter={onGroupMouseEnter}
                  onMouseDownHeader={onTableHeaderMouseDown}
                  onSelect={(id) => { setSelection({ type: 'table', tableId: id }); setRightTab('inspector'); if (editModeRef.current) setPanelOpen(true); }}
                  onFieldMouseDown={onFieldMouseDown}
                  onFieldMouseEnter={onFieldMouseEnter}
                  onFieldMouseLeave={hideTooltip}
                  onHeaderMouseEnter={onTableHeaderMouseEnter}
                  onHeaderMouseLeave={hideTooltip}
                  onAddField={addField}
                  onDelete={deleteTable}
                  draggedField={draggedField}
                  selectedFieldId={selection?.type === 'field' ? selection.fieldId : null}
                />
              );
            })}

            {/* Foreground relationships — only active line(s), rendered ABOVE
                the table cards so they can be traced end-to-end without
                disappearing behind any card they pass through. */}
            <RelationshipsLayer
              tables={visibleTables}
              relationships={schema.relationships.filter(r => {
                const fromT = schema.tables.find(x => x.id === r.from.table);
                const toT = schema.tables.find(x => x.id === r.to.table);
                if (!fromT || !toT) return false;
                if (hiddenDomains.has(fromT.domain) || hiddenDomains.has(toT.domain)) return false;
                return !hiddenFieldIds.has(r.from.field) && !hiddenFieldIds.has(r.to.field);
              })}
              positions={fieldPositions}
              highlightTableId={highlightTableId}
              hoveredTableId={hoveredTableId}
              lineStyle={lineStyle}
              mode="foreground"
            />
          </div>

          {/* Overlays */}
          <DomainLegend tables={schema.tables} hiddenDomains={hiddenDomains} onToggle={toggleDomain} />
          <Minimap tables={visibleTables} positions={fieldPositions} view={view} hostSize={hostSize} onPan={panTo} />
          <div className="zoom-controls">
            <button onClick={() => setView(v => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} title="Zoom in"><Icon.Plus /></button>
            <div className="zoom-level">{Math.round(view.k * 100)}%</div>
            <button onClick={() => setView(v => ({ ...v, k: Math.max(0.15, v.k / 1.2) }))} title="Zoom out"><Icon.Minus /></button>
            <button onClick={fitToScreen} title="Fit"><Icon.Fit /></button>
          </div>
        </div>

        {/* Drag ghost */}
        {draggedField && (() => {
          const t = schema.tables.find(x => x.id === draggedField.fromTableId);
          const f = t?.fields.find(x => x.id === draggedField.fieldId);
          if (!f) return null;
          return (
            <div style={{
              position: 'fixed', left: draggedField.x + 12, top: draggedField.y + 4,
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 4, padding: '4px 8px',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
              boxShadow: 'var(--shadow-pop)', pointerEvents: 'none', zIndex: 1000,
            }}>
              <span style={{ color: 'var(--accent)' }}>↪</span> {f.name} <span style={{ color: 'var(--ink-4)' }}>{f.type}</span>
            </div>
          );
        })()}
      </div>

      {/* ============ Right panel ============ */}
      <div className="right-panel">
        <div className="panel-tabs">
          <button className={`panel-tab ${rightTab === 'inspector' ? 'active' : ''}`} onClick={() => { setRightTab('inspector'); setPanelOpen(true); }}>
            Inspector
          </button>
          <button className={`panel-tab ${rightTab === 'review' ? 'active' : ''}`} onClick={() => { setRightTab('review'); setPanelOpen(true); }}>
            Schema Review
            <span className={`count ${findingsCount === 0 ? 'zero' : ''}`}>{findingsCount}</span>
          </button>
          <button className="panel-close" onClick={() => { setPanelOpen(false); setSelection(null); }} title="Close panel">
            <Icon.X />
          </button>
        </div>
        <div className="panel-body">
          {rightTab === 'inspector' ? (
            <InspectorPanel
              selection={selection}
              schema={schema}
              onPatchTable={patchTable}
              onPatchField={patchField}
              onDeleteField={deleteField}
              onSetGroupDrop={setGroupDrop}
            />
          ) : (
            <ReviewPanel findings={findings} onJump={jumpToFinding} />
          )}
        </div>
      </div>

      {startOpen && (
        <StartScreen
          activeSchemaId={activeSchemaId}
          canClose={schema.tables.length > 0}
          onPick={loadBuiltin}
          onImportJson={importJson}
          onImportSql={importSql}
          onClose={() => setStartOpen(false)}
        />
      )}

      {/* ============ Status bar ============ */}
      <div className="statusbar">
        <span className="seg schema-seg" title={loadedSchemaName}>{loadedSchemaName}</span>
        <span className="seg"><span className={`dot ${highCount > 0 ? 'warn-dot' : ''}`} />
          {highCount > 0 ? `${highCount} high-severity finding${highCount === 1 ? '' : 's'}` : 'schema healthy'}
        </span>
        <span className="statusbar-rule" />
        <span className="seg">tables <b>{stats.tables}</b></span>
        <span className="seg">fields <b>{stats.fields}</b></span>
        <span className="seg">PK <b>{stats.pks}</b></span>
        <span className="seg">FK <b>{stats.fks}</b></span>
        <span className="seg">relations <b>{stats.rels}</b></span>
        <div className="right">
          <span className="seg">zoom <b>{Math.round(view.k * 100)}%</b></span>
          <span className="seg">x <b>{Math.round(-view.x / view.k)}</b> y <b>{Math.round(-view.y / view.k)}</b></span>
          <span className="seg hint">scroll · drag to pan · ⌘+wheel to zoom</span>
        </div>
      </div>

      {/* Tooltip */}
      <Tooltip data={tooltip} />

      {/* Export modal */}
      {exportModal && (
        <ExportModal
          kind={exportModal.kind}
          content={exportModal.content}
          rebuild={exportModal.rebuild}
          initialOptions={exportModal.initialOptions}
          onClose={() => setExportModal(null)}
        />
      )}

      {/* Walkthrough overlay */}
      {walkthrough.active && walkthroughScript && (
        <WalkthroughOverlay
          name={walkthroughScript.name}
          steps={walkthroughScript.steps}
          stepIndex={walkthrough.stepIndex}
          onPrev={stepPrev}
          onNext={stepNext}
          onJump={stepJump}
          onExit={exitWalkthrough}
        />
      )}

      {/* Rationale panel */}
      {rationaleOpen && (
        <RationalePanel
          rationale={rationalePage}
          onClose={() => setRationaleOpen(false)}
          onSelectTable={focusTableFromRationale}
        />
      )}
    </div>
  );
}

export default App;

/* ================================================================
   CanvasMenu — single popover for low-frequency canvas operations
   (undo/redo, layout, line style). Keeps the top bar light.
================================================================ */
function CanvasMenu({
  undo, redo,
  addTable,
  fitToScreen, tidy, autoArrange,
  lineStyle, setLineStyle,
  open, onToggle, onClose,
}) {
  const ref = useRef(null);

  const kbd = (s) => (
    <span style={{
      marginLeft: 'auto',
      fontSize: 10,
      color: 'var(--ink-4)',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>{s}</span>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }} data-menu-root>
      <button
        className={`tool-btn ${open ? 'active' : ''}`}
        onClick={onToggle}
        title="Canvas tools — undo, layout, lines"
      >
        <Icon.Magic />
        <span>Canvas</span>
        <Icon.Chevron />
      </button>
      {open && (
        <div className="menu" style={{ left: 0, top: 36, minWidth: 260 }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-label">History</div>
          <div className="menu-item" onClick={() => { undo(); }}>
            <Icon.Undo /><span>Undo</span>{kbd('⌘Z')}
          </div>
          <div className="menu-item" onClick={() => { redo(); }}>
            <Icon.Redo /><span>Redo</span>{kbd('⌘⇧Z')}
          </div>
          <div className="menu-sep" />
          <div className="menu-label">Layout</div>
          <div className="menu-item" onClick={() => { addTable(); onClose(); }}>
            <Icon.Add /><span>Add table</span>
          </div>
          <div className="menu-item" onClick={() => { fitToScreen(); onClose(); }}>
            <Icon.Fit /><span>Fit to screen</span>
          </div>
          <div className="menu-item" onClick={() => { tidy(); onClose(); }}>
            <Icon.Tidy /><span>Tidy — resolve overlaps</span>
          </div>
          <div className="menu-item" onClick={() => { autoArrange(); onClose(); }}>
            <Icon.Magic /><span>Auto-arrange by domain</span>
          </div>
          <div className="menu-sep" />
          <div className="menu-label">Relationship lines</div>
          <div style={{ padding: '4px 10px 8px' }}>
            <div className="segment" style={{ width: '100%' }}>
              <button
                className={lineStyle === 'curved' ? 'active' : ''}
                onClick={() => setLineStyle('curved')}
                style={{ flex: 1, justifyContent: 'center' }}
              ><Icon.Curve /> Curved</button>
              <button
                className={lineStyle === 'angled' ? 'active' : ''}
                onClick={() => setLineStyle('angled')}
                style={{ flex: 1, justifyContent: 'center' }}
              ><Icon.Angle /> Angled</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   ThemeMenu — separate top-bar icon popover for picking a theme.
================================================================ */
function ThemeMenu({ theme, setTheme, open, onToggle, onClose }) {
  const ref = useRef(null);

  const light = THEMES.filter(t => t.kind === 'light');
  const dark  = THEMES.filter(t => t.kind === 'dark');

  const renderTheme = (t) => (
    <div
      key={t.id}
      className={`theme-tile ${theme === t.id ? 'active' : ''}`}
      onClick={() => { setTheme(t.id); onClose(); }}
      title={t.name}
    >
      <div
        className="theme-tile-swatch"
        style={{
          background: t.swatch[0],
          borderColor: t.kind === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ background: t.swatch[2] }} />
        <span style={{ background: t.swatch[1], opacity: 0.85 }} />
      </div>
      <div className="theme-tile-name">{t.name}</div>
      {theme === t.id && <div className="theme-tile-check"><Icon.Check /></div>}
    </div>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }} data-menu-root>
      <button
        className={`tool-btn icon-only ${open ? 'active' : ''}`}
        onClick={onToggle}
        title="Theme"
      >
        <Icon.Theme />
      </button>
      {open && (
        <div className="menu theme-menu" style={{ right: 0, top: 36 }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-label">Light</div>
          <div className="theme-grid">{light.map(renderTheme)}</div>
          <div className="menu-sep" />
          <div className="menu-label">Dark</div>
          <div className="theme-grid">{dark.map(renderTheme)}</div>
        </div>
      )}
    </div>
  );
}
