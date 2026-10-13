/* =====================================================================
   Reguły dedukcji naturalnej (rozdz. 2.9 skryptu) i reguły dla kwantyfikatorów (rozdz. 3.3).
   Każda reguła jest opisana dokładnie raz — jednym rekordem:
     back     stosowanie „od celu”: wymagany spójnik celu, parametr, kształty przesłanek,
              odczyt parametru z gotowego węzła (z tego korzysta też weryfikacja),
     fwd      stosowanie „od przesłanek”: liczba przesłanek, ich kolejność, budowa wniosku,
     schema   przesłanki i wniosek do karty w tabeli reguł.
     verify   (opcjonalnie) własne sprawdzenie węzła — reguły z kwantyfikatorami (świeże zmienne, podstawienia).
   Kształt przesłanki: formuła albo okno { box, assume, goal, fresh } (fresh — świeża zmienna okna).
   W funkcjach „od przesłanek” `fs` to formuły zaznaczonych korzeni, `nodes` — ich węzły.
   Kontekst `ctx` (reguły z kwantyfikatorami): fresh(base) — świeża zmienna dla bieżącego fragmentu,
   used — nazwy zmiennych zajęte we fragmencie.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, META, NOT, AND, OR, IMP, ALL: FORALL, EX: EXISTS, VAR, MSUB, eq, subst, match, isFree, freeVars, isVarName, freshVar, text, key, isTerm, termsOf, allVars, FO } = ND.F;
  const { T } = ND.Seg;
  const P = ND.Proof;

  const α = META('α'), β = META('β'), γ = META('γ');

  const CONNECTIVES = {
    and: { sym: '∧', tex: '\\land' },
    or: { sym: '∨', tex: '\\lor' },
    imp: { sym: '⇒', tex: '\\Rightarrow' },
    not: { sym: '¬', tex: '\\neg' },
    nn: { sym: '¬¬', tex: '\\neg\\neg' },
    T: { sym: '⊤', tex: '\\top' },
    F: { sym: '⊥', tex: '\\bot' },
    all: { sym: '∀', tex: '\\forall' },
    ex: { sym: '∃', tex: '\\exists' },
  };
  const SUBSCRIPT = { 1: '₁', 2: '₂' };

  const GOAL_MESSAGES = {
    and: 'Cel nie jest koniunkcją',
    or: 'Cel nie jest alternatywą',
    imp: 'Cel nie jest implikacją',
    not: 'Cel nie jest negacją',
    T: 'Cel nie jest stałą ⊤',
    F: 'Cel nie jest stałą ⊥',
    all: 'Cel nie zaczyna się od kwantyfikatora ∀',
    ex: 'Cel nie zaczyna się od kwantyfikatora ∃',
  };

  /** Przesłanka-okno: w oknie z założeniem `assume` (i świeżą zmienną `fresh`) trzeba udowodnić `goal`. */
  const boxed = (assume, goal, fresh = null) => ({ box: true, assume, goal, fresh });
  /** Pierwsza przesłanka węzła, o ile nie jest oknem. */
  const firstFormula = n => (n.prem[0] && !n.prem[0].box ? n.prem[0].f : null);
  /** Kolejność „jak zaznaczono”, o ile formuły spełniają warunek. */
  const ordered = ok => fs => (ok(fs) ? fs.map((_, i) => i) : null);
  /** Kolejność dla par (α, X), gdzie X zależy od α (np. α ⇒ β albo ¬α) — zaznaczać można w dowolnej kolejności. */
  const pairWith = depends => fs => (depends(fs[1], fs[0]) ? [0, 1] : depends(fs[0], fs[1]) ? [1, 0] : null);

  const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  /**
   * Kolejność dla (∨e): alternatywa α ∨ β, potem gałąź do okna z α i gałąź do okna z β.
   * Role fragmentów dopasowujemy po ich otwartych hipotezach, a nie po kolejności kliknięć:
   * gałąź „α” zakłada α, gałąź „β” zakłada β, a sama alternatywa nie zakłada żadnej z nich
   * (ważne, gdy wszystkie trzy zaznaczone formuły są takie same).
   */
  function caseOrder(fs, nodes) {
    const valid = PERMUTATIONS.filter(([d, x, y]) => fs[d].t === 'or' && eq(fs[x], fs[y]));
    if (!valid.length || !nodes) return valid[0] || null;
    const assumes = (i, a) => P.openFormulas(nodes[i]).some(h => eq(h, a));
    const score = ([d, x, y]) => {
      const D = fs[d];
      return 2 * (assumes(x, D.a) + assumes(y, D.b)) - assumes(x, D.b) - assumes(y, D.a)
        - (assumes(d, D.a) || assumes(d, D.b) ? 1 : 0);
    };
    return valid.reduce((best, p) => (score(p) > score(best) ? p : best));
  }

  /** Parametr reguł z oknem stosowanych „od przesłanek”: założenie okna (result — wniosek zależny od fs). */
  const windowParam = result => ({
    desc: fs => T`Fragment trafi do okna z założeniem ${α}, a otwarte hipotezy równe ${α} zostaną w nim zamknięte. Wynik: ${result(fs)}. Jakie jest założenie ${α}?`,
    best: (fs, ctx, [m]) => ctx.hypothesesOf(m),
  });

  /* ---------- kwantyfikatory: świeże zmienne i podstawienia ---------- */

  const X = 'x', X0 = 'x0', TERM_T = VAR('t');   // metazmienne schematów: x, x₀ i term t

  /**
   * Warunek świeżości zmiennej okna `y` (reguły (∀i) i (∃e)): to zmienna, która nie jest już
   * zmienną otaczającego okna i nie występuje wolno w założeniach okien ani w formułach `fs`
   * (wniosek reguły, formuła z kwantyfikatorem). Zwraca powód albo null.
   */
  function freshProblem(y, ctx, fs) {
    if (!isVarName(y)) return 'Świeża zmienna musi być zmienną (u–z)';
    if ((ctx.vars || []).includes(y)) return `Zmienna ${text(VAR(y))} jest już zmienną otaczającego okna`;
    const inScope = (ctx.scope || []).find(a => isFree(y, a));
    if (inScope) return `Zmienna ${text(VAR(y))} występuje wolno w założeniu ${text(inScope)}`;
    const inF = fs.find(f => isFree(y, f));
    return inF ? `Zmienna ${text(VAR(y))} występuje wolno w ${text(inF)}` : null;
  }

  /** Nazwy zmiennych zajęte w drzewie dowodu (formuły, założenia i świeże zmienne okien) — do wyboru świeżej zmiennej. */
  function usedVars(root, acc = new Set()) {
    P.walk([root], n => {
      allVars(n.f, acc);
      n.prem.forEach(p => {
        if (!p.box) return;
        if (p.a) allVars(p.a, acc);
        if (p.x) acc.add(p.x);
        P.factsOf(p).forEach(w => usedVars(w, acc));
      });
    });
    return acc;
  }

  /** Kontekst świeżych zmiennych dla zbioru zajętych nazw. */
  const freshContext = used => ({ used, fresh: base => { const y = freshVar(base, used); used.add(y); return y; } });

  /**
   * Przemianowanie zmiennych okien (w miejscu): okna drzewa `root`, których świeża zmienna należy
   * do `avoid`, dostają nową zmienną z kontekstu `ctx` — razem z jej wolnymi wystąpieniami w oknie
   * (w założeniu, dowodzie i wnioskach). Potrzebne, gdy fragment trafia w nowe otoczenie (wstawienie
   * w cel, nowe okno „od przesłanek”): zmienna okna musi być świeża także względem okien i założeń,
   * które go teraz otaczają.
   */
  function renameWindows(root, avoid, ctx) {
    const rename = (f, ren) => [...ren].reduce((g, [x, y]) => subst(g, x, VAR(y)) || g, f);
    const rec = (n, ren) => {
      if (ren.size) n.f = rename(n.f, ren);
      n.prem.forEach(p => {
        if (!p.box) { rec(p, ren); return; }
        let inner = ren;
        if (p.x && avoid.has(p.x)) {
          const y = ctx.fresh(p.x);
          inner = new Map(ren).set(p.x, y);
          p.x = y;
        }
        if (p.a && inner.size) p.a = rename(p.a, inner);
        rec(p.body, inner);
        P.factsOf(p).forEach(w => rec(w, inner));
      });
    };
    rec(root, new Map());
  }

  /** α z t zastąpionym zmienną x (poza miejscami, gdzie zmienna termu t jest związana). */
  function abstract(f, t, x) {
    const k = key(t), tv = freeVars(t);
    const rec = (g, blocked) => {
      if (isTerm(g)) {
        if (!blocked && key(g) === k) return VAR(x);
        return g.args && g.args.length ? { ...g, args: g.args.map(a => rec(a, blocked)) } : g;
      }
      switch (g.t) {
        case 'v': return g.args && g.args.length ? { ...g, args: g.args.map(a => rec(a, blocked)) } : g;
        case 'all': case 'ex': return { ...g, a: rec(g.a, blocked || tv.includes(g.x)) };
        case 'not': return { ...g, a: rec(g.a, blocked) };
        case 'and': case 'or': case 'imp': return { ...g, a: rec(g.a, blocked), b: rec(g.b, blocked) };
        default: return g;
      }
    };
    return rec(f, false);
  }

  /**
   * Podpowiedzi „od przesłanek” dla (∃i) i (∀i): formuły Q x α, dla których A = α[x/t],
   * otrzymane przez zastąpienie wszystkich wystąpień termu t z A zmienną (dla ∀i tylko zmienne wolne).
   */
  function generalizations(A, Q, onlyVars = false) {
    const out = [], seen = new Set(), names = allVars(A);
    const spare = FO.vars.find(n => !names.has(n)) || freshVar('x', names);
    for (const t of termsOf(A).values()) {
      if (t.t === 'var' ? !isFree(t.n, A) : onlyVars) continue;
      const x = t.t === 'var' ? t.n : spare;
      const g = Q(x, t.t === 'var' ? A : abstract(A, t, x));
      if (!match(g.a, g.x, A) || seen.has(key(g))) continue;
      seen.add(key(g));
      out.push(g);
    }
    return out;
  }

  /** Zmienna `y`, przy której α[x/y] jest jedną z hipotez `hyps` (do (∃e) „od przesłanek”). */
  function witnessIn(D, hyps) {
    for (const h of hyps) {
      const m = match(D.a, D.x, h);
      if (m && m.t && m.t.t === 'var') return { y: m.t.n, h };
    }
    return null;
  }

  /** Sprawdzenie (∃e) „od przesłanek”: { y, assume } albo { reason }. `m` — węzeł fragmentu z wnioskiem β. */
  function existsWindow(D, m, ctx) {
    const beta = m.f, hyps = P.openFormulas(m);
    const hit = witnessIn(D, hyps);
    if (hit) {
      const others = hyps.filter(h => !eq(h, hit.h));
      const why = freshProblem(hit.y, { scope: others }, [beta, D]);
      if (!why) return { y: hit.y, assume: hit.h };
    }
    const y = ctx.fresh(D.x);
    return { y, assume: subst(D.a, D.x, VAR(y)) };
  }

  const DEFINITIONS = [
    {
      id: 'andI', con: 'and', kind: 'i',
      title: 'Wprowadzanie koniunkcji', name: 'wprowadzanie koniunkcji',
      schema: { prem: [α, β], concl: AND(α, β) },
      back: { goal: 'and', premises: f => [f.a, f.b] },
      fwd: { arity: 2, build: ([A, B], [m, n]) => ({ f: AND(A, B), prem: [m, n] }) },
    },
    {
      id: 'orI1', con: 'or', kind: 'i', sub: 1,
      title: 'Wprowadzanie alternatywy', name: 'wprowadzanie alternatywy (lewy człon)',
      schema: { prem: [α], concl: OR(α, β) },
      back: { goal: 'or', premises: f => [f.a] },
      fwd: {
        arity: 1,
        param: {
          desc: ([A]) => T`Z ${A} wyprowadzimy ${OR(A, β)}. Jaka jest formuła ${β}?`,
          best: ([A], ctx) => ctx.openGoals.filter(g => g.t === 'or' && eq(g.a, A)).map(g => g.b),
        },
        build: ([A], [m], x) => ({ f: OR(A, x), prem: [m] }),
      },
    },
    {
      id: 'orI2', con: 'or', kind: 'i', sub: 2,
      title: 'Wprowadzanie alternatywy', name: 'wprowadzanie alternatywy (prawy człon)',
      schema: { prem: [β], concl: OR(α, β) },
      back: { goal: 'or', premises: f => [f.b] },
      fwd: {
        arity: 1,
        param: {
          desc: ([B]) => T`Z ${B} wyprowadzimy ${OR(α, B)}. Jaka jest formuła ${α}?`,
          best: ([B], ctx) => ctx.openGoals.filter(g => g.t === 'or' && eq(g.b, B)).map(g => g.a),
        },
        build: ([B], [m], x) => ({ f: OR(x, B), prem: [m] }),
      },
    },
    {
      id: 'topI', con: 'T', kind: 'i',
      title: 'Wprowadzanie prawdy', name: 'wprowadzanie prawdy',
      schema: { prem: [], concl: TOP },
      back: { goal: 'T', premises: () => [] },
      fwd: { arity: 0, build: () => ({ f: TOP, prem: [] }) },
    },
    {
      id: 'impI', con: 'imp', kind: 'i',
      title: 'Wprowadzanie implikacji', name: 'wprowadzanie implikacji',
      schema: { prem: [boxed(α, β)], concl: IMP(α, β) },
      back: { goal: 'imp', premises: f => [boxed(f.a, f.b)] },
      fwd: {
        arity: 1,
        param: windowParam(([A]) => IMP(α, A)),
        build: ([A], [m], x) => ({ f: IMP(x, A), prem: [{ assume: x, sub: m }] }),
      },
    },
    {
      id: 'notI', con: 'not', kind: 'i',
      title: 'Wprowadzanie negacji', name: 'wprowadzanie negacji',
      schema: { prem: [boxed(α, BOT)], concl: NOT(α) },
      back: { goal: 'not', premises: f => [boxed(f.a, BOT)] },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'F'), reject: 'Potrzebny fragment kończący się ⊥',
        param: windowParam(() => NOT(α)),
        build: (fs, [m], x) => ({ f: NOT(x), prem: [{ assume: x, sub: m }] }),
      },
    },
    {
      id: 'andE1', con: 'and', kind: 'e', sub: 1,
      title: 'Eliminacja koniunkcji', name: 'eliminacja koniunkcji (lewy człon)',
      schema: { prem: [AND(α, β)], concl: α },
      back: {
        param: {
          desc: f => T`Wyprowadzimy ${f} z koniunkcji ${AND(f, β)}. Jaka jest formuła ${β}?`,
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'and' && eq(c.a, f)).map(c => c.b),
        },
        premises: (f, x) => [AND(f, x)],
        paramOf: n => { const c = firstFormula(n); return c && c.t === 'and' ? c.b : null; },
      },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'and'), reject: 'Potrzebna koniunkcja',
        build: ([A], [m]) => ({ f: A.a, prem: [m] }),
      },
    },
    {
      id: 'andE2', con: 'and', kind: 'e', sub: 2,
      title: 'Eliminacja koniunkcji', name: 'eliminacja koniunkcji (prawy człon)',
      schema: { prem: [AND(α, β)], concl: β },
      back: {
        param: {
          desc: f => T`Wyprowadzimy ${f} z koniunkcji ${AND(α, f)}. Jaka jest formuła ${α}?`,
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'and' && eq(c.b, f)).map(c => c.a),
        },
        premises: (f, x) => [AND(x, f)],
        paramOf: n => { const c = firstFormula(n); return c && c.t === 'and' ? c.a : null; },
      },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'and'), reject: 'Potrzebna koniunkcja',
        build: ([A], [m]) => ({ f: A.b, prem: [m] }),
      },
    },
    {
      id: 'impE', con: 'imp', kind: 'e',
      title: 'Modus ponens', name: 'eliminacja implikacji (modus ponens)',
      schema: { prem: [α, IMP(α, β)], concl: β },
      back: {
        param: {
          desc: f => T`Wyprowadzimy ${f} z przesłanek ${α} oraz ${IMP(α, f)}. Jaka jest formuła ${α}?`,
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'imp' && eq(c.b, f)).map(c => c.a),
        },
        premises: (f, x) => [x, IMP(x, f)],
        paramOf: firstFormula,
      },
      fwd: {
        arity: 2, order: pairWith((x, a) => x.t === 'imp' && eq(x.a, a)), reject: 'Potrzebne α oraz α ⇒ β',
        build: ([, I], [m, n]) => ({ f: I.b, prem: [m, n] }),
      },
    },
    {
      id: 'notE', con: 'not', kind: 'e',
      title: 'Sprzeczność', name: 'eliminacja negacji (sprzeczność)',
      schema: { prem: [α, NOT(α)], concl: BOT },
      back: {
        goal: 'F',
        param: {
          desc: () => T`Wyprowadzimy ${BOT} z przesłanek ${α} oraz ${NOT(α)}. Jaka jest formuła ${α}?`,
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'not').map(c => c.a),
        },
        premises: (f, x) => [x, NOT(x)],
        paramOf: firstFormula,
      },
      fwd: {
        arity: 2, order: pairWith((x, a) => x.t === 'not' && eq(x.a, a)), reject: 'Potrzebne α oraz ¬α',
        build: (fs, [m, n]) => ({ f: BOT, prem: [m, n] }),
      },
    },
    {
      id: 'botE', con: 'F', kind: 'e',
      title: 'Eliminacja fałszu', name: 'eliminacja fałszu',
      schema: { prem: [BOT], concl: α },
      back: { premises: () => [BOT] },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'F'), reject: 'Potrzebne ⊥',
        param: { desc: () => T`Z ${BOT} wynika dowolna formuła. Którą wyprowadzić?`, best: (fs, ctx) => ctx.openGoals },
        build: (fs, [m], x) => ({ f: x, prem: [m] }),
      },
    },
    {
      id: 'nnE', con: 'nn', kind: 'e',
      title: 'Eliminacja podwójnej negacji', name: 'eliminacja podwójnej negacji',
      schema: { prem: [NOT(NOT(α))], concl: α },
      back: { premises: f => [NOT(NOT(f))] },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'not' && A.a.t === 'not'), reject: 'Potrzebna formuła postaci ¬¬α',
        build: ([A], [m]) => ({ f: A.a.a, prem: [m] }),
      },
    },
    {
      id: 'orE', con: 'or', kind: 'e',
      title: 'Rozpatrywanie przypadków', name: 'eliminacja alternatywy (rozpatrywanie przypadków)',
      schema: { prem: [OR(α, β), boxed(α, γ), boxed(β, γ)], concl: γ },
      back: {
        param: {
          desc: f => T`Udowodnimy alternatywę ${OR(α, β)}, a potem ${f} osobno w oknie z założeniem ${α} i w oknie z założeniem ${β}. Jaka to alternatywa?`,
          check: g => (g.t === 'or' ? null : 'Ta formuła musi być alternatywą (spójnik główny ∨)'),
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'or'),
          onlyBest: true,
        },
        premises: (f, D) => [D, boxed(D.a, f), boxed(D.b, f)],
        paramOf: firstFormula,
      },
      fwd: {
        arity: 3, order: caseOrder, reject: 'Potrzebne α ∨ β oraz dwa fragmenty z tym samym wnioskiem γ',
        build: ([D, C], [d, m, n]) => ({ f: C, prem: [d, { assume: D.a, sub: m }, { assume: D.b, sub: n }] }),
      },
    },

    /* ---------- kwantyfikatory (rozdz. 3.3) ---------- */
    {
      id: 'allI', con: 'all', kind: 'i', fo: true,
      title: 'Wprowadzanie kwantyfikatora ogólnego', name: 'wprowadzanie kwantyfikatora ogólnego',
      schema: { prem: [boxed(null, MSUB(α, X, VAR(X0)), X0)], concl: FORALL(X, α) },
      back: {
        goal: 'all',
        premises: (f, x, ctx) => { const y = ctx.fresh(f.x); return [boxed(null, subst(f.a, f.x, VAR(y)), y)]; },
      },
      verify(n, ctx) {
        const [b] = n.prem;
        if (n.f.t !== 'all' || n.prem.length !== 1 || !b.box || b.a || !b.x) return false;
        const body = subst(n.f.a, n.f.x, VAR(b.x));
        return !!body && eq(b.body.f, body) && !freshProblem(b.x, ctx, [n.f]);
      },
      fwd: {
        arity: 1,
        param: {
          desc: ([A]) => T`Fragment z wnioskiem ${A} trafi do okna ze świeżą zmienną, a wnioskiem będzie formuła ${FORALL(X, α)}, dla której ${A} = ${MSUB(α, X, VAR(X0))}. Jaka to formuła?`,
          check: (g, [A], [m]) => {
            if (g.t !== 'all') return 'Wynik musi zaczynać się od kwantyfikatora ∀';
            const r = match(g.a, g.x, A);
            if (!r) return `${text(A)} nie jest postaci α[${g.x}/x₀] dla tej formuły`;
            if (r.t && r.t.t !== 'var') return `W miejscu ${g.x} stoi term ${text(r.t)}, a nie zmienna`;
            return r.t ? freshProblem(r.t.n, { scope: P.openFormulas(m) }, [g]) : null;
          },
          best: ([A], ctx, [m]) => generalizations(A, FORALL, true).filter(g => { const r = match(g.a, g.x, A); return !freshProblem(r.t.n, { scope: P.openFormulas(m) }, [g]); }),
          onlyBest: true,
        },
        build: ([A], [m], g, ctx) => {
          const r = match(g.a, g.x, A);
          allVars(g, ctx.used);
          const y = r.t ? r.t.n : ctx.fresh(g.x);
          return { f: g, prem: [{ assume: null, fresh: y, sub: m }] };
        },
      },
    },
    {
      id: 'allE', con: 'all', kind: 'e', fo: true,
      title: 'Eliminacja kwantyfikatora ogólnego', name: 'eliminacja kwantyfikatora ogólnego',
      schema: { prem: [FORALL(X, α)], concl: MSUB(α, X, TERM_T) },
      back: {
        param: {
          desc: f => T`Wyprowadzimy ${f} z formuły ${FORALL(X, α)}, podstawiając term za ${VAR(X)}: ${f} = ${MSUB(α, X, TERM_T)}. Jaka jest formuła ${FORALL(X, α)}?`,
          check: (g, f) => (g.t !== 'all' ? 'Ta formuła musi zaczynać się od kwantyfikatora ∀'
            : match(g.a, g.x, f) ? null : `Cel nie jest postaci α[${g.x}/t] — żadne dopuszczalne podstawienie nie daje ${text(f)}`),
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'all' && match(c.a, c.x, f)),
        },
        premises: (f, D) => [D],
        paramOf: n => { const c = firstFormula(n); return c && c.t === 'all' ? c : null; },
      },
      verify(n) {
        const D = firstFormula(n);
        return n.prem.length === 1 && !!D && D.t === 'all' && !!match(D.a, D.x, n.f);
      },
      fwd: {
        arity: 1, order: ordered(([A]) => A.t === 'all'), reject: 'Potrzebna formuła postaci ∀x α',
        param: {
          kind: 'term',
          desc: ([A]) => T`Z ${A} wyprowadzimy ${MSUB(A.a, A.x, TERM_T)}. Jaki jest term ${TERM_T}?`,
          check: (t, [A]) => (subst(A.a, A.x, t) ? null : 'Tego podstawienia nie wolno wykonać — zmienna termu zostałaby związana kwantyfikatorem'),
          best: (fs, ctx) => ctx.terms,
        },
        build: ([A], [m], t) => ({ f: subst(A.a, A.x, t), prem: [m] }),
      },
    },
    {
      id: 'exI', con: 'ex', kind: 'i', fo: true,
      title: 'Wprowadzanie kwantyfikatora egzystencjalnego', name: 'wprowadzanie kwantyfikatora egzystencjalnego',
      schema: { prem: [MSUB(α, X, TERM_T)], concl: EXISTS(X, α) },
      back: {
        goal: 'ex',
        param: {
          kind: 'term',
          desc: f => T`Wystarczy udowodnić ${MSUB(f.a, f.x, TERM_T)} dla pewnego termu ${TERM_T}. Jaki jest term ${TERM_T}?`,
          check: (t, f) => (subst(f.a, f.x, t) ? null : 'Tego podstawienia nie wolno wykonać — zmienna termu zostałaby związana kwantyfikatorem'),
          best: (f, ctx) => ctx.terms,
        },
        premises: (f, t) => [subst(f.a, f.x, t)],
        paramOf: n => {
          const c = firstFormula(n), r = c && n.f.t === 'ex' ? match(n.f.a, n.f.x, c) : null;
          return r ? r.t || VAR(n.f.x) : null;
        },
      },
      verify(n) {
        const c = firstFormula(n);
        return n.f.t === 'ex' && n.prem.length === 1 && !!c && !!match(n.f.a, n.f.x, c);
      },
      fwd: {
        arity: 1,
        param: {
          desc: ([A]) => T`Z ${A} wyprowadzimy formułę ${EXISTS(X, α)}, dla której ${A} = ${MSUB(α, X, TERM_T)}. Jaka to formuła?`,
          check: (g, [A]) => (g.t !== 'ex' ? 'Wynik musi zaczynać się od kwantyfikatora ∃'
            : match(g.a, g.x, A) ? null : `${text(A)} nie jest postaci α[${g.x}/t] dla tej formuły`),
          best: ([A], ctx) => [...ctx.openGoals.filter(g => g.t === 'ex' && match(g.a, g.x, A)), ...generalizations(A, EXISTS)],
          onlyBest: true,
        },
        build: (fs, [m], g) => ({ f: g, prem: [m] }),
      },
    },
    {
      id: 'exE', con: 'ex', kind: 'e', fo: true,
      title: 'Eliminacja kwantyfikatora egzystencjalnego', name: 'eliminacja kwantyfikatora egzystencjalnego',
      schema: { prem: [EXISTS(X, α), boxed(MSUB(α, X, VAR(X0)), β, X0)], concl: β },
      back: {
        param: {
          desc: f => T`Udowodnimy formułę ${EXISTS(X, α)}, a potem ${f} w oknie ze świeżą zmienną ${VAR(X0)} i założeniem ${MSUB(α, X, VAR(X0))}. Jaka jest formuła ${EXISTS(X, α)}?`,
          check: g => (g.t === 'ex' ? null : 'Ta formuła musi zaczynać się od kwantyfikatora ∃'),
          best: (f, ctx) => ctx.cands.filter(c => c.t === 'ex'),
          onlyBest: true,
        },
        // zmienna okna nie może występować w D (wpisanym przez użytkownika, więc spoza fragmentu)
        premises: (f, D, ctx) => { allVars(D, ctx.used); const y = ctx.fresh(D.x); return [D, boxed(subst(D.a, D.x, VAR(y)), f, y)]; },
        paramOf: n => { const c = firstFormula(n); return c && c.t === 'ex' ? c : null; },
      },
      verify(n, ctx) {
        const D = firstFormula(n), b = n.prem[1];
        if (n.prem.length !== 2 || !D || D.t !== 'ex' || !b.box || !b.x || !b.a) return false;
        const a = subst(D.a, D.x, VAR(b.x));
        return !!a && eq(b.a, a) && eq(b.body.f, n.f) && !freshProblem(b.x, ctx, [n.f, D]);
      },
      fwd: {
        arity: 2,
        order: (fs, nodes) => {
          const ok = [[0, 1], [1, 0]].filter(([d]) => fs[d].t === 'ex');
          if (!ok.length || !nodes) return ok[0] || null;
          return ok.find(([d, m]) => witnessIn(fs[d], P.openFormulas(nodes[m]))) || ok[0];
        },
        reject: 'Potrzebne ∃x α oraz fragment z wnioskiem β i założeniem α[x/x₀]',
        build: ([D, B], [d, m], x, ctx) => {
          const w = existsWindow(D, m, ctx);
          return { f: B, prem: [d, { assume: w.assume, fresh: w.y, sub: m }] };
        },
      },
    },
  ];

  /* ---------- etykiety ---------- */

  function labelOf({ con, kind, sub }) {
    const c = CONNECTIVES[con];
    return Object.freeze({
      text: c.sym + kind + (sub ? SUBSCRIPT[sub] : ''),
      html: c.sym + kind + (sub ? `<sub>${sub}</sub>` : ''),
      tex: `${c.tex}\\mathrm{${kind}}${sub ? '_' + sub : ''}`,
    });
  }

  const RULES = new Map(DEFINITIONS.map(d => [d.id, Object.freeze({ ...d, label: labelOf(d) })]));

  /** Pseudoreguła: użycie założenia otaczającego okna. */
  const HYP = Object.freeze({
    id: 'hyp', title: 'Założenie', name: 'użycie założenia otaczającego okna',
    label: Object.freeze({ text: 'założenie', html: 'założenie', tex: '\\textrm{zał.}' }),
  });

  const get = id => (id === 'hyp' ? HYP : RULES.get(id));
  const isRule = id => id === 'hyp' || RULES.has(id);
  const ALL = [...RULES.values()];
  /** Kolejność na pasku akcji: założenie, wprowadzanie, eliminacja (rachunek kwantyfikatorów — wszystkie reguły). */
  const ORDER_FO = ['hyp', ...ALL.filter(r => r.kind === 'i').map(r => r.id), ...ALL.filter(r => r.kind === 'e').map(r => r.id)];
  const ORDER = ORDER_FO.filter(id => id === 'hyp' || !RULES.get(id).fo);
  /** Układ tabeli reguł: spójnik, reguły wprowadzania, reguły eliminacji. */
  const GROUPS = [
    ['∧', ['andI'], ['andE1', 'andE2']],
    ['∨', ['orI1', 'orI2'], ['orE']],
    ['⇒', ['impI'], ['impE']],
    ['¬', ['notI'], ['notE', 'nnE']],
    ['⊤⊥', ['topI'], ['botE']],
  ];
  const GROUPS_FO = [...GROUPS, ['∀', ['allI'], ['allE']], ['∃', ['exI'], ['exE']]];
  /** Reguły dostępne w danym rachunku: { order, groups }. */
  const forLogic = logic => (logic === 'fo' ? { order: ORDER_FO, groups: GROUPS_FO } : { order: ORDER, groups: GROUPS });

  /* ---------- stosowanie „od celu” ---------- */

  /** Powód, dla którego reguły nie można zastosować do celu `f` (null — można). */
  const backBlocked = (r, f) => (r.back.goal && f.t !== r.back.goal ? GOAL_MESSAGES[r.back.goal] : null);

  /** Węzły przesłanek z kształtów (okna z pustym celem w środku). */
  const materialize = shapes => shapes.map(s => (s.box ? P.box(s.assume || null, P.node(s.goal), [], s.fresh || null) : P.node(s)));

  /* ---------- stosowanie „od przesłanek” ---------- */

  function fwdBlocked(r, fs) {
    const need = r.fwd.arity, k = fs.length;
    if (need === 0) return k === 0 ? null : `(${r.label.text}) nie potrzebuje przesłanek — odznacz wszystko`;
    if (k < need) return `Zaznacz ${need} ${need === 1 ? 'formułę' : 'formuły'}`;
    if (k > need) return `Za dużo zaznaczonych formuł (potrzeba ${need})`;
    return r.fwd.order && !r.fwd.order(fs) ? r.fwd.reject : null;
  }

  /** Ustawia zaznaczone formuły i węzły w kolejności wymaganej przez regułę. */
  function fwdArrange(r, fs, nodes) {
    const ord = r.fwd.order ? r.fwd.order(fs, nodes) : fs.map((_, i) => i);
    return { fs: ord.map(i => fs[i]), nodes: ord.map(i => nodes[i]) };
  }

  /**
   * Zamienia przesłanki { assume, fresh, sub } na okna, zamykając w nich hipotezy równe założeniu.
   * Z kontekstem `ctx` okna wewnątrz fragmentu, których zmienna przestałaby być świeża (to zmienna
   * nowego okna albo zmienna wolna w jego założeniu), dostają nową zmienną.
   */
  const enclose = (prem, ctx = null) => prem.map(p => {
    if (!p.sub) return p;
    if (ctx) {
      const avoid = new Set(p.assume ? freeVars(p.assume) : []);
      if (p.fresh) avoid.add(p.fresh);
      if (avoid.size) renameWindows(p.sub, avoid, ctx);
    }
    if (p.assume) P.discharge(p.sub, p.assume);
    return P.box(p.assume || null, p.sub, [], p.fresh || null);
  });

  /* ---------- wnioski z założeń (w oknach) ---------- */

  /**
   * Reguły, którymi wyciąga się wnioski z założeń i wcześniejszych wniosków okna — te,
   * które z gotowych formuł robią nową bez otwierania okna (jak „od przesłanek”).
   */
  const FACT_RULES = Object.freeze(['andE1', 'andE2', 'impE', 'notE', 'nnE', 'botE', 'andI', 'orI1', 'orI2', 'allE', 'exI']);

  /** Powód, dla którego reguły nie można zastosować do zaznaczonych założeń/wniosków `fs` (null — można). */
  function factBlocked(r, fs) {
    if (!FACT_RULES.includes(r.id)) {
      return r.id === 'hyp' ? 'To już jest założenie albo wniosek tego okna'
        : `Reguła (${r.label.text}) potrzebuje celu albo okna — wnioski wyciąga się regułami eliminacji oraz (∧i), (∨i)${r.fo ? ' i (∃i)' : ''}`;
    }
    return fwdBlocked(r, fs);
  }

  /** Wniosek: węzeł reguły `r` nad przesłankami `nodes` (gotowe wyprowadzenia zaznaczonych formuł). */
  function buildFact(r, fs, nodes, x, ctx) {
    const arranged = fwdArrange(r, fs, nodes);
    const { f, prem } = r.fwd.build(arranged.fs, arranged.nodes, x, ctx);
    return P.node(f, r.id, prem);
  }

  /** Czy wniosek jest kompletnym, poprawnym wyprowadzeniem z założeń `scope`. */
  function validFact(fact, scope) {
    let ok = true;
    P.walk([fact], (n, ctx) => { if (n.rule === null || !checkNode(n, ctx.scope, ctx.vars)) ok = false; }, scope);
    return ok;
  }

  /* ---------- weryfikacja ---------- */

  const sameShape = (prem, shapes) => prem.length === shapes.length && prem.every((p, i) => {
    const s = shapes[i];
    if (!s.box) return !p.box && eq(p.f, s);
    return !!p.box && (s.assume ? !!p.a && eq(p.a, s.assume) : !p.a) && eq(p.body.f, s.goal) && (p.x || null) === (s.fresh || null);
  });

  /** Parametr reguły odczytany z gotowego węzła (np. α dla modus ponens); undefined, gdy reguła go nie ma. */
  function paramOf(n) {
    const r = RULES.get(n.rule);
    return r && r.back.param ? r.back.paramOf(n) : undefined;
  }

  /**
   * Czy węzeł jest poprawnym zastosowaniem swojej reguły
   * (scope — założenia otaczających okien, vars — ich świeże zmienne).
   */
  function checkNode(n, scope, vars = []) {
    if (n.rule === null) return n.prem.length === 0;
    if (n.rule === 'hyp') return n.prem.length === 0 && P.inScope(scope, n.f);
    const r = RULES.get(n.rule);
    if (!r || backBlocked(r, n.f)) return false;
    if (r.verify) return r.verify(n, { scope, vars });
    const x = paramOf(n);
    if (r.back.param && (!x || (r.back.param.check && r.back.param.check(x, n.f)))) return false;
    return sameShape(n.prem, r.back.premises(n.f, x));
  }

  /** Zbiór identyfikatorów węzłów z błędnie zastosowaną regułą. */
  function verify(roots) {
    const bad = new Set();
    P.walk(roots, (n, ctx) => { if (!checkNode(n, ctx.scope, ctx.vars)) bad.add(n.id); });
    return bad;
  }

  ND.Rules = Object.freeze({
    ALL, forLogic, get, isRule,
    backBlocked, materialize, fwdBlocked, fwdArrange, enclose,
    paramOf, checkNode, verify, FACT_RULES, factBlocked, buildFact, validFact,
    usedVars, freshContext, renameWindows,
  });
})(globalThis.ND ||= {});
