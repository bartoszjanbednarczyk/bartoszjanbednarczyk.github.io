/* =====================================================================
   Reguły dedukcji naturalnej (rozdz. 2.9 skryptu).
   Każda reguła jest opisana dokładnie raz — jednym rekordem:
     back     stosowanie „od celu”: wymagany spójnik celu, parametr, kształty przesłanek,
              odczyt parametru z gotowego węzła (z tego korzysta też weryfikacja),
     fwd      stosowanie „od przesłanek”: liczba przesłanek, ich kolejność, budowa wniosku,
     schema   przesłanki i wniosek do karty w tabeli reguł.
   Kształt przesłanki: formuła albo okno { assume, goal }.
   W funkcjach „od przesłanek” `fs` to formuły zaznaczonych korzeni, `nodes` — ich węzły.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, META, NOT, AND, OR, IMP, eq } = ND.F;
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
  };
  const SUBSCRIPT = { 1: '₁', 2: '₂' };

  const GOAL_MESSAGES = {
    and: 'Cel nie jest koniunkcją',
    or: 'Cel nie jest alternatywą',
    imp: 'Cel nie jest implikacją',
    not: 'Cel nie jest negacją',
    T: 'Cel nie jest stałą ⊤',
    F: 'Cel nie jest stałą ⊥',
  };

  /** Przesłanka-okno: w oknie z założeniem `assume` trzeba udowodnić `goal`. */
  const boxed = (assume, goal) => ({ assume, goal });
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
  /** Kolejność na pasku akcji: założenie, wprowadzanie, eliminacja. */
  const ORDER = ['hyp', ...ALL.filter(r => r.kind === 'i').map(r => r.id), ...ALL.filter(r => r.kind === 'e').map(r => r.id)];
  /** Układ tabeli reguł: spójnik, reguły wprowadzania, reguły eliminacji. */
  const GROUPS = [
    ['∧', ['andI'], ['andE1', 'andE2']],
    ['∨', ['orI1', 'orI2'], ['orE']],
    ['⇒', ['impI'], ['impE']],
    ['¬', ['notI'], ['notE', 'nnE']],
    ['⊤⊥', ['topI'], ['botE']],
  ];

  /** Reguły, których wniosek ma spójnik główny celu — „naturalny” wybór dla tego celu. */
  const naturalFor = f => ALL.filter(r => r.back.goal === f.t).map(r => r.id);

  /* ---------- stosowanie „od celu” ---------- */

  /** Powód, dla którego reguły nie można zastosować do celu `f` (null — można). */
  const backBlocked = (r, f) => (r.back.goal && f.t !== r.back.goal ? GOAL_MESSAGES[r.back.goal] : null);

  /** Węzły przesłanek z kształtów (okna z pustym celem w środku). */
  const materialize = shapes => shapes.map(s => (s.assume ? P.box(s.assume, P.node(s.goal)) : P.node(s)));

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

  /** Zamienia przesłanki { assume, sub } na okna, zamykając w nich hipotezy równe założeniu. */
  const enclose = prem => prem.map(p => {
    if (!p.assume) return p;
    P.discharge(p.sub, p.assume);
    return P.box(p.assume, p.sub);
  });

  /* ---------- weryfikacja ---------- */

  const sameShape = (prem, shapes) => prem.length === shapes.length && prem.every((p, i) => {
    const s = shapes[i];
    return s.assume ? !!p.box && eq(p.a, s.assume) && eq(p.body.f, s.goal) : !p.box && eq(p.f, s);
  });

  /** Parametr reguły odczytany z gotowego węzła (np. α dla modus ponens); undefined, gdy reguła go nie ma. */
  function paramOf(n) {
    const r = RULES.get(n.rule);
    return r && r.back.param ? r.back.paramOf(n) : undefined;
  }

  /** Czy węzeł jest poprawnym zastosowaniem swojej reguły (scope — założenia otaczających okien). */
  function checkNode(n, scope) {
    if (n.rule === null) return n.prem.length === 0;
    if (n.rule === 'hyp') return n.prem.length === 0 && P.inScope(scope, n.f);
    const r = RULES.get(n.rule);
    if (!r || backBlocked(r, n.f)) return false;
    const x = paramOf(n);
    if (r.back.param && (!x || (r.back.param.check && r.back.param.check(x)))) return false;
    return sameShape(n.prem, r.back.premises(n.f, x));
  }

  /** Zbiór identyfikatorów węzłów z błędnie zastosowaną regułą. */
  function verify(roots) {
    const bad = new Set();
    P.walk(roots, (n, ctx) => { if (!checkNode(n, ctx.scope)) bad.add(n.id); });
    return bad;
  }

  ND.Rules = Object.freeze({
    ALL, ORDER, GROUPS, get, isRule, naturalFor,
    backBlocked, materialize, fwdBlocked, fwdArrange, enclose,
    paramOf, checkNode, verify,
  });
})(globalThis.ND ||= {});
