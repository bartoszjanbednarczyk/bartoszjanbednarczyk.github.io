/* =====================================================================
   Dowodzący dla rachunku kwantyfikatorów (źródło podpowiedzi w zadaniach
   przykładowych z kolokwiów i egzaminów). Rachunek kwantyfikatorów jest nierozstrzygalny,
   więc to przeszukiwanie heurystyczne w ograniczonym budżecie: reguły odwracalne
   (⇒i, ∧i, ¬i, ∀i ze świeżą zmienną), eliminacje z wiedzy (∀e dla termów z kontekstu),
   (∃e) ze świeżą zmienną, (∨e), (∃i) dla termów z kontekstu, modus ponens
   i na końcu dowód nie wprost. Zwraca drzewo { f, rule, prem } bez id albo null.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, NOT, VAR, key, subst, freshVar, termsOf, allVars } = ND.F;

  /** Limity przeszukiwania: wywołania, czas, głębokość, termy do podstawień, świadkowie (∃i), rozmiar wiedzy. */
  const BUDGET = Object.freeze({ calls: 200000, ms: 1500, depth: 14, poolTerms: 12, witnesses: 24, knowledge: 400 });

  const inference = (f, rule, prem = []) => ({ f, rule, prem });
  const windowed = (a, body, x = null) => (x ? { box: true, a, body, x } : { box: true, a, body });
  const hyp = f => inference(f, 'hyp');

  class OutOfBudget extends Error {}

  /* Wiedza: mapa klucz formuły → jej dowód z bieżących założeń; pula: termy do podstawień. */

  const learn = (K, f, proof) => { const k = key(f); if (!K.has(k)) { K.set(k, proof); return true; } return false; };

  /**
   * Domyka wiedzę eliminacjami bez nowych celów: ∧e, ⇒e, ¬e, ¬¬e oraz ∀e dla termów z puli
   * (gdy pula jest pusta — dla samej zmiennej kwantyfikatora, np. z ∀x q wynika q).
   */
  function saturate(K, pool) {
    const instantiated = new Set();
    for (let changed = true; changed;) {
      changed = false;
      for (const proof of [...K.values()]) {
        const f = proof.f;
        if (f.t === 'and') {
          changed = learn(K, f.a, inference(f.a, 'andE1', [proof])) || changed;
          changed = learn(K, f.b, inference(f.b, 'andE2', [proof])) || changed;
        } else if (f.t === 'imp') {
          const a = K.get(key(f.a));
          if (a) changed = learn(K, f.b, inference(f.b, 'impE', [a, proof])) || changed;
        } else if (f.t === 'not') {
          const a = K.get(key(f.a));
          if (a) changed = learn(K, BOT, inference(BOT, 'notE', [a, proof])) || changed;
          if (f.a.t === 'not') changed = learn(K, f.a.a, inference(f.a.a, 'nnE', [proof])) || changed;
        } else if (f.t === 'all') {
          for (const t of (pool.size ? pool.values() : [VAR(f.x)])) {
            const tag = key(f) + '@' + key(t);
            if (instantiated.has(tag)) continue;
            instantiated.add(tag);
            const g = subst(f.a, f.x, t);
            if (g && K.size < BUDGET.knowledge) changed = learn(K, g, inference(g, 'allE', [proof])) || changed;
          }
        }
      }
    }
    return K;
  }

  /** Pula termów do podstawień w (∀e): termy z formuł wiedzy i celu (najmniejsze; może być pusta). */
  function poolFor(formulas, extra = []) {
    const m = new Map();
    extra.forEach(t => m.set(key(t), t));
    formulas.forEach(f => termsOf(f, m));
    const sorted = [...m.values()].sort((a, b) => key(a).length - key(b).length).slice(0, BUDGET.poolTerms);
    return new Map(sorted.map(t => [key(t), t]));
  }

  /**
   * Szuka dowodu; nazwy świeżych zmiennych z nieudanych prób wracają do puli, więc zmienne
   * okien nazywają się tak, jak nadałaby je aplikacja (x₀, x₁, … — kolejno w całym dowodzie).
   */
  function search(K, pool, goal, depth, st) {
    const saved = new Set(st.used);
    const r = attempt(K, pool, goal, depth, st);
    if (!r) st.used = saved;
    return r;
  }

  function attempt(K, pool, goal, depth, st) {
    const b = st.budget;
    if (++b.calls > BUDGET.calls || (b.calls % 256 === 0 && Date.now() > b.deadline)) throw new OutOfBudget();
    const k = key(goal);
    if (K.has(k)) return K.get(k);
    if (goal.t === 'T') return inference(TOP, 'topI');
    if (K.has(key(BOT))) return inference(goal, 'botE', [K.get(key(BOT))]);
    const memo = k + '|' + [...K.keys()].sort().join(',');
    if (st.stack.has(memo)) return null;
    st.stack.add(memo);
    const fresh = base => { const y = freshVar(base, st.used); st.used.add(y); return y; };
    /** Wiedza i pula rozszerzone o nowe założenie (i ewentualnie nową zmienną). */
    const assume = (f, y = null) => {
      const P2 = new Map(pool);
      if (y) P2.set(y, VAR(y));
      const K2 = new Map(K);
      learn(K2, f, hyp(f));
      termsOf(f, P2);
      return { K: saturate(K2, P2), pool: P2 };
    };
    try {
      /* reguły odwracalne — zawsze bezpieczne */
      if (goal.t === 'imp') {
        const s = assume(goal.a);
        const r = search(s.K, s.pool, goal.b, depth, st);
        return r && inference(goal, 'impI', [windowed(goal.a, r)]);
      }
      if (goal.t === 'and') {
        const a = search(K, pool, goal.a, depth, st);
        const c = a && search(K, pool, goal.b, depth, st);
        return c && inference(goal, 'andI', [a, c]);
      }
      if (goal.t === 'not') {
        const s = assume(goal.a);
        const r = search(s.K, s.pool, BOT, depth, st);
        return r && inference(goal, 'notI', [windowed(goal.a, r)]);
      }
      if (goal.t === 'all') {
        const y = fresh(goal.x), body = subst(goal.a, goal.x, VAR(y));
        const P2 = new Map(pool).set(y, VAR(y));
        const r = body && search(saturate(new Map(K), P2), P2, body, depth, st);
        return r && inference(goal, 'allI', [windowed(null, r, y)]);
      }
      if (depth <= 0) return null;

      /* alternatywa: jeden z członów */
      if (goal.t === 'or') {
        for (const [side, rule] of [['a', 'orI1'], ['b', 'orI2']]) {
          const r = search(K, pool, goal[side], depth - 1, st);
          if (r) return inference(goal, rule, [r]);
        }
      }
      /* kwantyfikator egzystencjalny: świadek z puli termów */
      if (goal.t === 'ex') {
        // świadkowie: termy z puli i z formuł znanych w tym miejscu (np. f(a) z q(f(a)))
        const known = new Map(pool);
        for (const proof of K.values()) termsOf(proof.f, known);
        const terms = known.size ? [...known.values()].sort((u, v) => key(u).length - key(v).length).slice(0, BUDGET.witnesses) : [VAR(goal.x)];
        for (const t of terms) {
          const g = subst(goal.a, goal.x, t);
          const r = g && search(K, pool, g, depth - 1, st);
          if (r) return inference(goal, 'exI', [r]);
        }
      }
      /* sprzeczność: α oraz znane ¬α */
      if (goal.t === 'F') {
        for (const negation of [...K.values()]) {
          if (negation.f.t !== 'not') continue;
          const r = search(K, pool, negation.f.a, depth - 1, st);
          if (r) return inference(BOT, 'notE', [r, negation]);
        }
      }
      /* (∃e): świadek znanej formuły ∃x α jako świeża zmienna */
      for (const [dk, ex] of [...K]) {
        if (ex.f.t !== 'ex' || st.usedEx.has(dk)) continue;
        st.usedEx.add(dk);
        const names = new Set(st.used);     // nieudana próba oddaje nazwę świeżej zmiennej
        try {
          const D = ex.f, y = fresh(D.x), a = subst(D.a, D.x, VAR(y));
          const s = a && assume(a, y);
          const r = s && search(s.K, s.pool, goal, depth - 1, st);
          if (r) return inference(goal, 'exE', [ex, windowed(a, r, y)]);
          st.used = names;
        } finally { st.usedEx.delete(dk); }
      }
      /* rozpatrywanie przypadków dla znanej alternatywy */
      for (const [dk, disjunction] of [...K]) {
        const g = disjunction.f;
        if (g.t !== 'or' || st.usedOr.has(dk)) continue;
        st.usedOr.add(dk);
        try {
          const s1 = assume(g.a);
          const r1 = search(s1.K, s1.pool, goal, depth - 1, st);
          const s2 = r1 && assume(g.b);
          const r2 = s2 && search(s2.K, s2.pool, goal, depth - 1, st);
          if (r2) return inference(goal, 'orE', [disjunction, windowed(g.a, r1), windowed(g.b, r2)]);
        } finally { st.usedOr.delete(dk); }
      }
      /* modus ponens z poprzednikiem, który trzeba najpierw udowodnić */
      for (const implication of [...K.values()]) {
        const g = implication.f;
        if (g.t !== 'imp' || K.has(key(g.b)) || K.has(key(g.a))) continue;
        const ra = search(K, pool, g.a, depth - 1, st);
        if (!ra) continue;
        const K2 = new Map(K);
        learn(K2, g.b, inference(g.b, 'impE', [ra, implication]));
        const r = search(saturate(K2, pool), pool, goal, depth - 1, st);
        if (r) return r;
      }
      /* dowód nie wprost: (¬¬e) po (¬i) */
      if (goal.t !== 'F' && !st.raa.has(k)) {
        st.raa.add(k);
        try {
          const n = NOT(goal), s = assume(n);
          const r = search(s.K, s.pool, BOT, depth - 1, st);
          if (r) return inference(goal, 'nnE', [inference(NOT(n), 'notI', [windowed(n, r)])]);
        } finally { st.raa.delete(k); }
      }
      return null;
    } finally {
      st.stack.delete(memo);
    }
  }

  /**
   * Dowód `goal` z założeń `premises` albo null (nie znaleziono w budżecie).
   * opts: used — nazwy zmiennych zajęte w dowodzie (świeże zmienne nie mogą z nimi kolidować),
   *       terms — dodatkowe termy do podstawień (np. świeże zmienne otaczających okien).
   * Pogłębia przeszukiwanie iteracyjnie, więc znajduje możliwie płytkie dowody.
   */
  function prove(premises, goal, { used = new Set(), terms = [] } = {}) {
    const names = new Set(used);
    [...premises, goal].forEach(f => allVars(f, names));
    const pool = poolFor([...premises, goal], terms);
    const budget = { calls: 0, deadline: Date.now() + BUDGET.ms };
    try {
      for (let depth = 0; depth <= BUDGET.depth; depth++) {
        const K = new Map();
        premises.forEach(g => learn(K, g, hyp(g)));
        saturate(K, pool);
        const st = { budget, stack: new Set(), usedOr: new Set(), usedEx: new Set(), raa: new Set(), used: new Set(names) };
        const r = search(K, pool, goal, depth, st);
        if (r) return r;
      }
    } catch (e) {
      if (!(e instanceof OutOfBudget)) throw e;
    }
    return null;
  }

  ND.ProverFO = Object.freeze({ prove, BUDGET });
})(globalThis.ND ||= {});
