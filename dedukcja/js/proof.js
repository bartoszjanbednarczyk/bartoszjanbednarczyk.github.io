/* =====================================================================
   Drzewa dowodów: węzły, okna, przechodzenie, zapis i odczyt.
     węzeł: { id, f, rule, prem: [węzeł | okno] }   rule === null → otwarty cel
     okno:  { box: true, a, body }                    a — założenie, body — poddowód
   Moduł czysty (bez DOM).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { eq, key, parse, size } = ND.F;

  /**
   * Limity całego obszaru roboczego (pilnowane centralnie przy każdej zmianie).
   * Głębokość: każdy poziom dowodu to ok. 3 zagnieżdżone elementy HTML, a parser HTML
   * przeglądarek nie zagnieżdża więcej niż 512 elementów — 120 poziomów zostawia zapas.
   */
  const LIMITS = Object.freeze({ nodes: 1500, fragments: 40, depth: 120 });

  let lastId = 0;
  const node = (f, rule = null, prem = []) => ({ id: ++lastId, f, rule, prem });
  const box = (a, body) => ({ box: true, a, body });
  /** Ostatni nadany identyfikator — węzły o większym id są „nowe” (do animacji). */
  const latestId = () => lastId;

  const isOpen = n => n.rule === null;
  /** Liść rysowany jako sama formuła: otwarty cel albo użycie założenia. */
  const isBareLeaf = n => n.prem.length === 0 && (n.rule === null || n.rule === 'hyp');
  /** Bezpośrednie poddrzewa (ciała okien zamiast samych okien). */
  const children = n => n.prem.map(p => (p.box ? p.body : p));

  /**
   * Odwiedza wszystkie węzły fragmentów. Kontekst:
   *   fi — numer fragmentu, parent/slot — miejsce w rodzicu (do podmiany),
   *   scope — założenia otaczających okien, up — id węzła-rodzica, depth — głębokość.
   */
  function walk(roots, visit) {
    const rec = (n, ctx) => {
      visit(n, ctx);
      n.prem.forEach((p, i) => (p.box
        ? rec(p.body, { fi: ctx.fi, parent: p, slot: 'body', scope: [...ctx.scope, p.a], up: n.id, depth: ctx.depth + 1 })
        : rec(p, { fi: ctx.fi, parent: n, slot: i, scope: ctx.scope, up: n.id, depth: ctx.depth + 1 })));
    };
    roots.forEach((r, fi) => rec(r, { fi, parent: null, slot: null, scope: [], up: null, depth: 0 }));
  }

  /** Mapa id → { n, ...kontekst }. */
  function index(roots) {
    const m = new Map();
    walk(roots, (n, ctx) => m.set(n.id, { n, ...ctx }));
    return m;
  }

  function openLeaves(root) {
    const out = [];
    walk([root], n => { if (isOpen(n)) out.push(n); });
    return out;
  }

  /** Formuły otwartych liści bez powtórzeń (np. hipotezy Γ w sekwencie Γ ⊢ φ). */
  function openFormulas(root) {
    const m = new Map();
    openLeaves(root).forEach(l => m.set(key(l.f), l.f));
    return [...m.values()];
  }

  /** Węzły, których cały poddowód spełnia warunek `ok` (np. „uzasadniony i poprawny”). */
  function completeSubtrees(root, ok) {
    const done = new Set();
    const rec = n => {
      const kids = children(n).map(rec);
      const good = ok(n) && kids.every(Boolean);
      if (good) done.add(n.id);
      return good;
    };
    rec(root);
    return done;
  }

  /** Rozmiar obszaru roboczego: liczba węzłów, głębokość i największa formuła (do limitów). */
  function stats(roots) {
    let nodes = 0, depth = 0, formula = 0;
    walk(roots, (n, ctx) => {
      nodes++;
      depth = Math.max(depth, ctx.depth);
      formula = Math.max(formula, size(n.f), ...n.prem.filter(p => p.box).map(p => size(p.a)));
    });
    return { nodes, depth, formula };
  }

  const inScope = (scope, f) => scope.some(a => eq(a, f));

  /** Wstawia `replacement` w miejsce węzła opisanego przez `info` (z index()). */
  function replaceAt(roots, info, replacement) {
    if (info.parent === null) roots[info.fi] = replacement;
    else if (info.parent.box) info.parent.body = replacement;
    else info.parent.prem[info.slot] = replacement;
  }

  /** Zamyka jako użycia założenia otwarte liście równe `a` w poddrzewie `n`. */
  function discharge(n, a) {
    walk([n], m => { if (isOpen(m) && eq(m.f, a)) m.rule = 'hyp'; });
  }

  /** Zamyka otwarte cele, które są założeniami otaczających okien. */
  function closeByScope(roots) {
    walk(roots, (n, ctx) => { if (isOpen(n) && inScope(ctx.scope, n.f)) n.rule = 'hyp'; });
  }

  /** Otwiera użycia założeń, które znalazły się poza swoim oknem (np. po odłączeniu poddrzewa). */
  function reopenStrayHyps(roots) {
    walk(roots, (n, ctx) => {
      if (n.rule === 'hyp' && !inScope(ctx.scope, n.f)) { n.rule = null; n.prem = []; }
    });
  }

  /* ---------- zapis i odczyt ---------- */

  /** Postać do zapisu: { f, r?, p? }, okno: { a, b }. Formuły jako klucze (krótkie linki). */
  function toPlain(n) {
    const o = { f: key(n.f) };
    if (n.rule) o.r = n.rule;
    if (n.prem.length) o.p = n.prem.map(p => (p.box ? { a: key(p.a), b: toPlain(p.body) } : toPlain(p)));
    return o;
  }

  class FormatError extends Error {}

  /**
   * Odczyt ze ścisłą kontrolą typów i nazw reguł (isRule pochodzi z modułu reguł).
   * Dane z zewnątrz (link, localStorage) podlegają też limitom rozmiaru; własne kopie
   * z historii zmian (trusted) — nie, bo powstały z poprawnego stanu.
   */
  function fromPlain(list, isRule, { trusted = false } = {}) {
    if (!Array.isArray(list) || (!trusted && list.length > LIMITS.fragments)) throw new FormatError('fragmenty');
    let nodes = 0;
    const formula = s => {
      if (typeof s !== 'string') throw new FormatError('formuła');
      return parse(s);
    };
    const rec = (o, depth) => {
      if (!trusted && (++nodes > LIMITS.nodes || depth > LIMITS.depth)) throw new FormatError('rozmiar');
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new FormatError('węzeł');
      if (o.r !== undefined && !(typeof o.r === 'string' && isRule(o.r))) throw new FormatError('reguła');
      if (o.p !== undefined && !Array.isArray(o.p)) throw new FormatError('przesłanki');
      const n = node(formula(o.f), o.r || null);
      n.prem = (o.p || []).map(p => (p && typeof p === 'object' && 'a' in p
        ? box(formula(p.a), rec(p.b, depth + 1))
        : rec(p, depth + 1)));
      if ((n.rule === null || n.rule === 'hyp') && n.prem.length) throw new FormatError('liść z przesłankami');
      return n;
    };
    return list.map(o => rec(o, 0));
  }

  const serialize = roots => JSON.stringify(roots.map(toPlain));
  const deserialize = (json, isRule, opts) => fromPlain(JSON.parse(json), isRule, opts);

  ND.Proof = Object.freeze({
    LIMITS, node, box, latestId, isOpen, isBareLeaf, children, walk, index, openLeaves, openFormulas,
    completeSubtrees, stats, inScope, replaceAt, discharge, closeByScope, reopenStrayHyps,
    toPlain, fromPlain, serialize, deserialize, FormatError,
  });
})(globalThis.ND ||= {});
