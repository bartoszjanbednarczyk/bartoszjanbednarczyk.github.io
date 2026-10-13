/* =====================================================================
   Rezolucja dla rachunku zdań (rozdz. 2.7 skryptu). Moduł czysty (bez DOM).
     literał:  { v: 'p', neg: false }        klauzula: { lits: [literał] } (pusta — ⊥)
   Klauzule p ∨ q i q ∨ p (oraz p ∨ p i p) są tą samą klauzulą (konwencja skryptu) — porównujemy
   je po kluczu (posortowane literały), a wypisujemy w kolejności literałów.
   Praca nad zadaniem: { initial: [klauzula], steps: [{ a, b, on, clause }], valuation: { p: true|false } }.
   Klauzule C₀, C₁, … to klauzule zbioru 𝓕, a po nich kolejne rezolwenty: krok dopisuje
   rezolwentę C_a i C_b względem zmiennej `on`. Cała lista to ciąg z Def. 47.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { V, NOT, OR, BOT, text, html } = ND.F;

  const LIMITS = Object.freeze({ chars: 2000, clauses: 40, literals: 16, vars: 12, steps: 300, search: 4000 });

  class ResError extends Error {}

  /* ---------- klauzule ---------- */

  const lit = (v, neg = false) => ({ v, neg });
  const litKey = l => (l.neg ? '~' : '') + l.v;

  /** Klauzula bez powtórzeń literałów (kolejność pierwszego wystąpienia). */
  function clause(lits) {
    const seen = new Set(), out = [];
    for (const l of lits) { const k = litKey(l); if (!seen.has(k)) { seen.add(k); out.push(l); } }
    return { lits: out };
  }

  const EMPTY = Object.freeze({ lits: Object.freeze([]) });
  const EMPTY_KEY = '⊥';
  /** Klucz klauzuli (jako zbioru literałów) — do porównań. */
  const key = c => (c.lits.length ? c.lits.map(litKey).sort().join('|') : EMPTY_KEY);
  /** Klucz zbioru klauzul (niezależny od kolejności). */
  const setKey = clauses => clauses.map(key).sort().join(' , ');
  const isEmpty = c => c.lits.length === 0;
  const has = (c, l) => c.lits.some(m => m.v === l.v && m.neg === l.neg);
  /** Klauzula prawdziwa zawsze (zawiera p i ¬p). */
  const isTautology = c => c.lits.some(l => !l.neg && has(c, lit(l.v, true)));

  /** Klauzula jako formuła (alternatywa literałów, ⊥ dla pustej) — do wypisywania i rysowania. */
  function formula(c) {
    if (!c.lits.length) return BOT;
    return c.lits.map(l => (l.neg ? NOT(V(l.v)) : V(l.v))).reduce((a, b) => OR(a, b));
  }
  const clauseText = c => text(formula(c));
  const clauseHTML = c => html(formula(c));

  /** Zmienne zbioru klauzul (posortowane). */
  function varsOf(clauses) {
    const s = new Set();
    clauses.forEach(c => c.lits.forEach(l => s.add(l.v)));
    return [...s].sort();
  }

  /* ---------- parser ---------- */

  const NEG = ['¬', '~', '!', '-'];
  const OR_TOKENS = ['∨', '\\/', '|'];
  const EMPTY_TOKENS = ['⊥', '□', '[]', 'F', '0'];

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  const symbolAt = (s, i) => `„${String.fromCodePoint(s.codePointAt(i))}”`;

  /** Jedna klauzula, np. „¬p ∨ q” albo „⊥”; `where` — początek komunikatu błędu (np. „Klauzula 2: ”). */
  function parseClause(src, where = '') {
    const fail = message => new ResError(where ? where + message : capitalize(message));
    const s = src.trim();
    if (!s) throw fail('pusta klauzula — klauzulę pustą zapisz jako ⊥');
    if (EMPTY_TOKENS.includes(s)) return EMPTY;
    const lits = [];
    let i = 0;
    const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    for (;;) {
      skip();
      let neg = false;
      while (i < s.length && NEG.includes(s[i])) { neg = !neg; i++; skip(); }
      const m = /^([a-z])(\d{0,2})/.exec(s.slice(i));
      if (!m) throw fail(`oczekiwano zmiennej (małej litery, np. p), a jest ${i < s.length ? symbolAt(s, i) : 'koniec'}`);
      lits.push(lit(m[0], neg));
      i += m[0].length;
      skip();
      if (i >= s.length) break;
      const op = OR_TOKENS.find(t => s.startsWith(t, i));
      if (!op) throw fail(`klauzula to alternatywa literałów — między literałami musi stać ∨ (albo |), a jest ${symbolAt(s, i)}`);
      i += op.length;
    }
    const c = clause(lits);
    if (c.lits.length > LIMITS.literals) throw fail(`za dużo literałów (maks. ${LIMITS.literals})`);
    return c;
  }

  /** Zbiór klauzul: „{¬p ∨ q, p, ¬q}” — oddzielone przecinkami, średnikami albo nowymi wierszami. */
  function parseClauses(src) {
    if (typeof src !== 'string') throw new ResError('Niepoprawny zbiór klauzul');
    if (src.length > LIMITS.chars) throw new ResError(`Za długi wpis (maks. ${LIMITS.chars} znaków)`);
    let s = src.trim();
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
    const parts = s.split(/[,;\n]/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) throw new ResError('Wpisz co najmniej jedną klauzulę');
    if (parts.length > LIMITS.clauses) throw new ResError(`Za dużo klauzul (maks. ${LIMITS.clauses})`);
    const out = [], seen = new Set();
    parts.forEach((p, i) => {
      const c = parseClause(p, parts.length > 1 ? `Klauzula ${i + 1}: ` : '');
      if (!seen.has(key(c))) { seen.add(key(c)); out.push(c); }
    });
    if (varsOf(out).length > LIMITS.vars) throw new ResError(`Za dużo zmiennych (maks. ${LIMITS.vars})`);
    return out;
  }

  /** Zapis klauzuli do linku/pamięci: „~p|q”, pusta — „F”. */
  const toPlain = c => (c.lits.length ? c.lits.map(litKey).join('|') : 'F');

  /* ---------- rezolwenty ---------- */

  /** Rezolwenta C i D względem zmiennej v (bez sprawdzania, czy v występuje przeciwnie). */
  const resolve = (C, D, v) => clause([...C.lits.filter(l => l.v !== v), ...D.lits.filter(l => l.v !== v)]);

  /** Czy `on` jest poprawną zmienną rezolucji C i D (w jednej klauzuli p, w drugiej ¬p). */
  const canResolve = (C, D, on) => (has(C, lit(on)) && has(D, lit(on, true))) || (has(C, lit(on, true)) && has(D, lit(on)));

  /**
   * Rezolwenty klauzul C i D (Def. 47): dla każdej zmiennej p, która występuje w jednej z nich
   * pozytywnie, a w drugiej negatywnie — klauzula z pozostałych literałów obu. [{ on, clause }]
   */
  const resolvents = (C, D) => varsOf([C, D]).filter(v => canResolve(C, D, v)).map(v => ({ on: v, clause: resolve(C, D, v) }));

  /* ---------- semantyka ---------- */

  /**
   * Wartość klauzuli przy (być może częściowym) wartościowaniu: true — spełniona,
   * false — niespełniona, null — jeszcze nie wiadomo (brak wartości niektórych zmiennych).
   */
  function valueOf(c, val) {
    let unknown = false;
    for (const l of c.lits) {
      if (!(l.v in val)) { unknown = true; continue; }
      if (val[l.v] !== l.neg) return true;
    }
    return unknown ? null : false;
  }

  /**
   * Wartościowanie spełniające wszystkie klauzule i zgodne z `fixed` (DPLL) albo null.
   * Zmienne bez znaczenia dla spełnienia też dostają wartość (najpierw T).
   */
  function satisfying(clauses, fixed = {}) {
    const names = varsOf(clauses);
    const rec = val => {
      let unit = null;
      for (const c of clauses) {
        const v = valueOf(c, val);
        if (v === false) return null;
        if (v === null && !unit) {
          const open = c.lits.filter(l => !(l.v in val));
          if (open.length === 1) unit = open[0];
        }
      }
      if (unit) return rec({ ...val, [unit.v]: !unit.neg });
      const next = names.find(n => !(n in val));
      if (!next) return val;
      return rec({ ...val, [next]: true }) || rec({ ...val, [next]: false });
    };
    return rec({ ...fixed });
  }

  const satisfiable = clauses => !!satisfying(clauses);

  /* ---------- poszukiwanie dowodu ---------- */

  /**
   * Rezolucyjny dowód sprzeczności z danych klauzul (przeszukiwanie wszerz — krótkie dowody).
   * Zwraca listę kroków { a, b, on, clause } (a, b — klucze klauzul) prowadzącą do ⊥, uporządkowaną
   * od liści, albo null, gdy zbiór jest spełnialny (albo przekroczono limit LIMITS.search klauzul).
   */
  function refutation(clauses) {
    const known = new Map();      // klucz → { clause, from: null | { a, b, on } }
    clauses.forEach(c => { if (!known.has(key(c))) known.set(key(c), { clause: c, from: null }); });
    if (known.has(EMPTY_KEY)) return [];
    let frontier = [...known.keys()];
    while (frontier.length) {
      const next = [], all = [...known.keys()];
      for (const ka of frontier) {
        for (const kb of all) {
          if (ka === kb) continue;
          for (const { on, clause: r } of resolvents(known.get(ka).clause, known.get(kb).clause)) {
            const kr = key(r);
            if (known.has(kr) || isTautology(r)) continue;
            known.set(kr, { clause: r, from: { a: ka, b: kb, on } });
            if (kr === EMPTY_KEY) return extract(known, kr);
            if (known.size >= LIMITS.search) return null;
            next.push(kr);
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  /** Kroki dowodu klauzuli `k` (od liści), bez powtórzeń. */
  function extract(known, k) {
    const steps = [], done = new Set();
    const rec = kk => {
      const e = known.get(kk);
      if (!e.from || done.has(kk)) return;
      rec(e.from.a);
      rec(e.from.b);
      done.add(kk);
      steps.push({ a: e.from.a, b: e.from.b, on: e.from.on, clause: e.clause });
    };
    rec(k);
    return steps;
  }

  /* ---------- praca nad zadaniem ---------- */

  /** Wszystkie klauzule pracy: zbiór 𝓕, a po nim rezolwenty kolejnych kroków. */
  const allClauses = work => [...work.initial, ...work.steps.map(s => s.clause)];

  /** Numer klauzuli w pracy o danym kluczu albo -1. */
  const indexOf = (work, k) => allClauses(work).findIndex(c => key(c) === k);

  /** Numer klauzuli pustej albo -1 (dowód sprzeczności jest gotowy, gdy ≥ 0). */
  const emptyIndex = work => indexOf(work, EMPTY_KEY);
  const refuted = work => emptyIndex(work) >= 0;

  /** Czy wartościowanie pracy spełnia wszystkie klauzule zbioru 𝓕. */
  const satisfied = work => work.initial.every(c => valueOf(c, work.valuation) === true);

  /**
   * Kroki pracy bez rezolwenty nr `i` i rezolwent, które z niej powstały (z przenumerowaniem):
   * { steps, removed } — removed to liczba usuniętych klauzul.
   */
  function withoutResolvent(work, i) {
    const n0 = work.initial.length, gone = new Set([i]), renumber = new Map(), steps = [];
    work.steps.forEach((s, k) => {
      const j = n0 + k;
      if (gone.has(j) || gone.has(s.a) || gone.has(s.b)) { gone.add(j); return; }
      const re = x => (x < n0 ? x : renumber.get(x));
      renumber.set(j, n0 + steps.length);
      steps.push({ ...s, a: re(s.a), b: re(s.b) });
    });
    return { steps, removed: gone.size };
  }

  /**
   * Drzewo dowodu klauzuli nr `i` (jak na rysunku w skrypcie): węzły { id, f, rule, prem } —
   * liście to klauzule zbioru 𝓕 (rule null), pozostałe — rezolwenty (rule 'res').
   */
  function tree(work, i) {
    const n0 = work.initial.length, all = allClauses(work);
    let id = 0;
    const rec = j => {
      const prem = j < n0 ? [] : [rec(work.steps[j - n0].a), rec(work.steps[j - n0].b)];
      return { id: ++id, f: formula(all[j]), rule: j < n0 ? null : 'res', prem };
    };
    return rec(i);
  }

  /** Klauzule użyte w dowodzie klauzuli nr `i` (numery, rosnąco) — ciąg C₀, …, Cₙ z Def. 47. */
  function usedIn(work, i) {
    const n0 = work.initial.length, out = new Set();
    const rec = j => { if (out.has(j)) return; out.add(j); if (j >= n0) { const s = work.steps[j - n0]; rec(s.a); rec(s.b); } };
    rec(i);
    return [...out].sort((x, y) => x - y);
  }

  /* ---------- podpowiedzi ---------- */

  /** Pierwszy krok krótkiego dowodu sprzeczności, którego wynik nie jest jeszcze na liście. */
  function nextStep(work) {
    const steps = refutation(allClauses(work)) || [];
    for (const s of steps) {
      const a = indexOf(work, s.a), b = indexOf(work, s.b);
      if (a >= 0 && b >= 0 && indexOf(work, key(s.clause)) < 0) return { kind: 'step', a, b, on: s.on, clause: s.clause };
    }
    return null;
  }

  /**
   * Następna wartość spełniającego wartościowania: najpierw zmienne z klauzul jeszcze
   * niespełnionych, w których zostało najmniej literałów bez wartości. Gdy obecnych wartości
   * nie da się uzupełnić — zmiana jednej z nich ('change') albo wyczyszczenie wszystkich ('reset').
   */
  function nextValue(work) {
    const val = work.valuation, ok = satisfying(work.initial, val);
    if (!ok) {
      const v = Object.keys(val).find(x => { const rest = { ...val }; delete rest[x]; return satisfying(work.initial, rest); });
      return v ? { kind: 'change', v, value: !val[v] } : { kind: 'reset' };
    }
    const free = c => c.lits.filter(l => !(l.v in val)).length;
    const [c] = work.initial.filter(d => valueOf(d, val) !== true).sort((d, e) => free(d) - free(e));
    const l = c && c.lits.find(x => !(x.v in val) && ok[x.v] !== x.neg);
    const v = l ? l.v : varsOf(work.initial).find(x => !(x in val));
    return v ? { kind: 'value', v, value: ok[v] } : null;
  }

  /**
   * Podpowiedź dla pracy: krok dowodu sprzeczności ('step'), gdy zbiór jest sprzeczny,
   * a w przeciwnym razie wartość zmiennej ('value', 'change' albo 'reset'); null — nic do podpowiedzenia.
   */
  const hint = work => (satisfiable(work.initial) ? nextValue(work) : nextStep(work));

  /* ---------- zapis ---------- */

  /** Postać do zapisu/linku: { c: ['~p|q', …], d: [[a, b, 'p'], …], s: { p: 1, … } }. */
  function serialize(work) {
    const s = {};
    Object.entries(work.valuation).forEach(([k, v]) => { s[k] = v ? 1 : 0; });
    return { c: work.initial.map(toPlain), d: work.steps.map(x => [x.a, x.b, x.on]), s };
  }

  /**
   * Odczyt ze ścisłą kontrolą (dane z linku albo localStorage): tylko prace, które da się
   * zbudować w aplikacji (bez powtórzeń klauzul i kroków po wyprowadzeniu ⊥). Rzuca ResError.
   */
  function deserialize(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.c) || !o.c.length || o.c.length > LIMITS.clauses) throw new ResError('zbiór');
    const initial = o.c.map(s => {
      if (typeof s !== 'string' || s.length > 5 * LIMITS.literals) throw new ResError('klauzula');   // „~p12|” na literał
      return parseClause(s.replace(/\|/g, ' ∨ '));
    });
    const keys = new Set(initial.map(key));
    if (keys.size !== initial.length) throw new ResError('zbiór');
    if (varsOf(initial).length > LIMITS.vars) throw new ResError('zmienne');
    const d = o.d === undefined ? [] : o.d;
    if (!Array.isArray(d) || d.length > LIMITS.steps) throw new ResError('kroki');
    const work = { initial, steps: [], valuation: {} };
    for (const st of d) {
      if (!Array.isArray(st) || st.length !== 3 || keys.has(EMPTY_KEY)) throw new ResError('krok');
      const [a, b, on] = st, all = allClauses(work);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || !all[a] || !all[b] || typeof on !== 'string' || !canResolve(all[a], all[b], on)) {
        throw new ResError('krok');
      }
      const r = resolve(all[a], all[b], on);
      if (keys.has(key(r))) throw new ResError('krok');
      keys.add(key(r));
      work.steps.push({ a, b, on, clause: r });
    }
    const names = new Set(varsOf(initial));
    if (o.s && typeof o.s === 'object' && !Array.isArray(o.s)) {
      Object.entries(o.s).forEach(([k, v]) => { if (names.has(k) && (v === 0 || v === 1)) work.valuation[k] = v === 1; });
    }
    return work;
  }

  ND.Res = Object.freeze({
    LIMITS, ResError, key, setKey, isEmpty, isTautology, formula, clauseText, clauseHTML, varsOf,
    parseClause, parseClauses, resolvents, resolve, canResolve, valueOf, satisfying, satisfiable, refutation,
    allClauses, indexOf, emptyIndex, refuted, satisfied, withoutResolvent, tree, usedIn, hint, serialize, deserialize,
  });
})(globalThis.ND ||= {});
