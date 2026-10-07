/* =====================================================================
   Automatyczny dowodzący dla systemu ze skryptu (źródło podpowiedzi).
   Szuka dowodów „jak człowiek”: najpierw odwracalne reguły wprowadzania,
   potem eliminacje z założeń, rozpatrywanie przypadków, modus ponens,
   a na końcu dowód nie wprost. Zwraca drzewo { f, rule, prem } bez id.
   Pracuje w ograniczonym budżecie wywołań i czasu — nigdy nie zawiesza strony.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, NOT, key, entails } = ND.F;

  const BUDGET = Object.freeze({ calls: 300000, ms: 900, depth: 16 });

  /* Dowody budowane przez dowodzącego mają kształt węzłów (ND.Proof), tylko bez identyfikatorów. */
  const inference = (f, rule, prem = []) => ({ f, rule, prem });
  const windowed = (a, body) => ({ box: true, a, body });
  const hyp = f => inference(f, 'hyp');

  class OutOfBudget extends Error {}

  /* Wiedza: mapa klucz formuły → jej dowód z bieżących założeń. */

  const learn = (K, f, proof) => { const k = key(f); if (!K.has(k)) K.set(k, proof); };

  /** Domyka wiedzę eliminacjami, które nie wymagają nowych celów: ∧e, ⇒e, ¬e, ¬¬e. */
  function saturate(K) {
    for (let changed = true; changed;) {
      changed = false;
      for (const proof of [...K.values()]) {
        const f = proof.f, before = K.size;
        if (f.t === 'and') {
          learn(K, f.a, inference(f.a, 'andE1', [proof]));
          learn(K, f.b, inference(f.b, 'andE2', [proof]));
        } else if (f.t === 'imp') {
          const a = K.get(key(f.a));
          if (a) learn(K, f.b, inference(f.b, 'impE', [a, proof]));
        } else if (f.t === 'not') {
          const a = K.get(key(f.a));
          if (a) learn(K, BOT, inference(BOT, 'notE', [a, proof]));
          if (f.a.t === 'not') learn(K, f.a.a, inference(f.a.a, 'nnE', [proof]));
        }
        if (K.size !== before) changed = true;
      }
    }
    return K;
  }

  const extend = (K, f, proof) => { const K2 = new Map(K); learn(K2, f, proof); return saturate(K2); };
  const assume = (K, f) => extend(K, f, hyp(f));

  /** Szuka dowodu `goal` z wiedzy K (H — formuły założeń, do testów semantycznych). */
  function search(K, H, goal, depth, st) {
    const b = st.budget;
    if (++b.calls > BUDGET.calls || (b.calls % 256 === 0 && Date.now() > b.deadline)) throw new OutOfBudget();
    const k = key(goal);
    if (K.has(k)) return K.get(k);
    if (goal.t === 'T') return inference(TOP, 'topI');
    if (K.has(key(BOT))) return inference(goal, 'botE', [K.get(key(BOT))]);
    const memo = k + '|' + [...K.keys()].sort().join(',');
    if (st.stack.has(memo)) return null;
    st.stack.add(memo);
    try {
      /* reguły wprowadzania odwracalne — zawsze bezpieczne */
      if (goal.t === 'imp') {
        const r = search(assume(K, goal.a), [...H, goal.a], goal.b, depth, st);
        return r && inference(goal, 'impI', [windowed(goal.a, r)]);
      }
      if (goal.t === 'and') {
        const a = search(K, H, goal.a, depth, st);
        const b = a && search(K, H, goal.b, depth, st);
        return b && inference(goal, 'andI', [a, b]);
      }
      if (goal.t === 'not') {
        const r = search(assume(K, goal.a), [...H, goal.a], BOT, depth, st);
        return r && inference(goal, 'notI', [windowed(goal.a, r)]);
      }
      if (depth <= 0) return null;

      /* alternatywa: człon, który wynika z założeń */
      if (goal.t === 'or') {
        for (const [side, rule] of [['a', 'orI1'], ['b', 'orI2']]) {
          if (!entails(H, goal[side])) continue;
          const r = search(K, H, goal[side], depth - 1, st);
          if (r) return inference(goal, rule, [r]);
        }
      }
      /* sprzeczność: α oraz znane ¬α */
      if (goal.t === 'F') {
        for (const negation of [...K.values()]) {
          const g = negation.f;
          if (g.t !== 'not' || !entails(H, g.a)) continue;
          const r = search(K, H, g.a, depth - 1, st);
          if (r) return inference(BOT, 'notE', [r, negation]);
        }
      }
      /* rozpatrywanie przypadków dla znanej alternatywy */
      for (const [dk, disjunction] of [...K]) {
        const g = disjunction.f;
        if (g.t !== 'or' || st.usedOr.has(dk)) continue;
        st.usedOr.add(dk);
        try {
          const r1 = search(assume(K, g.a), [...H, g.a], goal, depth - 1, st);
          const r2 = r1 && search(assume(K, g.b), [...H, g.b], goal, depth - 1, st);
          if (r2) return inference(goal, 'orE', [disjunction, windowed(g.a, r1), windowed(g.b, r2)]);
        } finally { st.usedOr.delete(dk); }
      }
      /* modus ponens z poprzednikiem, który trzeba najpierw udowodnić */
      for (const implication of [...K.values()]) {
        const g = implication.f;
        if (g.t !== 'imp' || K.has(key(g.b)) || K.has(key(g.a)) || !entails(H, g.a)) continue;
        const ra = search(K, H, g.a, depth - 1, st);
        if (!ra) continue;
        const r = search(extend(K, g.b, inference(g.b, 'impE', [ra, implication])), H, goal, depth - 1, st);
        if (r) return r;
      }
      if (goal.t !== 'F') {
        /* sprzeczne założenia */
        if (entails(H, BOT)) {
          const r = search(K, H, BOT, depth - 1, st);
          if (r) return inference(goal, 'botE', [r]);
        }
        /* dowód nie wprost: (¬¬e) po (¬i) */
        if (!st.raa.has(k)) {
          st.raa.add(k);
          try {
            const n = NOT(goal);
            const r = search(assume(K, n), [...H, n], BOT, depth - 1, st);
            if (r) return inference(goal, 'nnE', [inference(NOT(n), 'notI', [windowed(n, r)])]);
          } finally { st.raa.delete(k); }
        }
      }
      return null;
    } finally {
      st.stack.delete(memo);
    }
  }

  /**
   * Dowód `goal` z założeń `premises` albo null (brak wynikania lub wyczerpany budżet).
   * Pogłębia przeszukiwanie iteracyjnie, więc znajduje możliwie płytkie dowody.
   */
  function prove(premises, goal) {
    if (!entails(premises, goal)) return null;
    const K = new Map();
    premises.forEach(g => learn(K, g, hyp(g)));
    saturate(K);
    const budget = { calls: 0, deadline: Date.now() + BUDGET.ms };
    try {
      for (let depth = 0; depth <= BUDGET.depth; depth++) {
        const r = search(K, premises, goal, depth, { budget, stack: new Set(), usedOr: new Set(), raa: new Set() });
        if (r) return r;
      }
    } catch (e) {
      if (!(e instanceof OutOfBudget)) throw e;
    }
    return null;
  }

  ND.Prover = Object.freeze({ prove, BUDGET });
})(globalThis.ND ||= {});
