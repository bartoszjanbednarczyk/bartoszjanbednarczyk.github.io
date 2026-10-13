/* =====================================================================
   Testy rachunku kwantyfikatorów (bez przeglądarki):  node dedukcja/tests/fo.test.js
   Składnia (termy, kwantyfikatory), podstawienia, reguły (∀i), (∀e), (∃i), (∃e)
   z warunkami świeżości, dowodzący dla przykładów, dowód słowny, zapis i eksport.
   ===================================================================== */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

for (const f of ['formula', 'text', 'proof', 'rules', 'prover', 'prover-fo', 'explain', 'render', 'export', 'resolution', 'examples']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const { F, Proof, Rules, ProverFO, Explain, Render, Export, Examples } = globalThis.ND;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}
const P = s => F.parse(s, { logic: 'fo' });
const T = s => F.parseTerm(s);
const fo = { logic: 'fo' };
const roundtrip = pf => Proof.fromPlain([Proof.toPlain(pf)], Rules.isRule, fo)[0];
const proofOf = (goal, premises = []) => { const pf = ProverFO.prove(premises, goal); return pf && roundtrip(pf); };
const check = (n, scope = [], vars = []) => Rules.checkNode(n, scope, vars);

/** Deterministyczny generator losowych formuł rachunku kwantyfikatorów. */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function randomTerm(rand, depth) {
  const k = rand();
  if (depth <= 0 || k < 0.45) return F.VAR(['x', 'y', 'z', 'x0'][Math.floor(rand() * 4)]);
  if (k < 0.55) return F.FN(['a', 'b', 'c'][Math.floor(rand() * 3)]);
  if (k < 0.65) return F.FN(['0', '1', '42'][Math.floor(rand() * 3)]);
  return F.FN(rand() < 0.5 ? 'f' : 'g', [randomTerm(rand, depth - 1)]);
}
function randomFormula(rand, depth) {
  if (depth === 0 || rand() < 0.2) {
    const k = rand();
    if (k < 0.1) return F.TOP;
    if (k < 0.2) return F.BOT;
    if (k < 0.3) return F.ATOM('φ');
    if (k < 0.45) return F.ATOM(['=', '<', '>', '≤', '≥'][Math.floor(rand() * 5)], [randomTerm(rand, 1), randomTerm(rand, 1)]);
    if (k < 0.5) return F.ATOM('R', [randomTerm(rand, 1), randomTerm(rand, 1)]);
    return F.ATOM(rand() < 0.5 ? 'p' : 'r', rand() < 0.5 ? [randomTerm(rand, 2)] : [randomTerm(rand, 1), randomTerm(rand, 1)]).args.length === 2
      ? F.ATOM('r', [randomTerm(rand, 1), randomTerm(rand, 1)]) : F.ATOM('p', [randomTerm(rand, 2)]);
  }
  const k = rand();
  if (k < 0.15) return F.NOT(randomFormula(rand, depth - 1));
  if (k < 0.35) return (rand() < 0.5 ? F.ALL : F.EX)(['x', 'y', 'z'][Math.floor(rand() * 3)], randomFormula(rand, depth - 1));
  const make = k < 0.55 ? F.AND : k < 0.75 ? F.OR : F.IMP;
  return make(randomFormula(rand, depth - 1), randomFormula(rand, depth - 1));
}

/* ---------- składnia ---------- */

test('wypisywanie i ponowne czytanie daje tę samą formułę (losowe formuły z kwantyfikatorami i relacjami)', () => {
  const rand = rng(7);
  for (let i = 0; i < 2000; i++) {
    const f = randomFormula(rand, 5);
    assert.ok(F.eq(P(F.text(f)), f), F.text(f));
    assert.ok(F.eq(P(F.key(f)), f), F.key(f));
    assert.ok(!/<(?!\/?(i|sub)>)/.test(F.html(f)), F.html(f));          // w HTML tylko znaczniki <i> i <sub>
  }
});

test('kwantyfikator wiąże jak negacja, kropka rozciąga zasięg', () => {
  // kwantyfikator, po którym coś jeszcze stoi, wypisujemy w nawiasach — na kolokwiach zasięg sięga do nawiasu
  const cases = {
    'Ax p(x) -> q': '(∀x p(x)) ⇒ q', 'Ax (p(x) -> q)': '∀x (p(x) ⇒ q)', 'Ax. p(x) -> q': '∀x (p(x) ⇒ q)',
    '∀x∃y r(x, y)': '∀x ∃y r(x, y)', 'forall x exists y r(x,y)': '∀x ∃y r(x, y)', '~Ax ~p(x)': '¬∀x ¬p(x)',
    'p(f(a), x_0) & q(x₁)': 'p(f(a), x₀) ∧ q(x₁)', 'φ(x) | ψ': 'φ(x) ∨ ψ',
    '~Ax p(x) & q': '¬(∀x p(x)) ∧ q', 'q -> Ax p(x)': 'q ⇒ ∀x p(x)', 'p & Ax q(x) -> r': 'p ∧ (∀x q(x)) ⇒ r',
    '(Ex p(x)) -> ~Ax ~p(x)': '(∃x p(x)) ⇒ ¬∀x ¬p(x)', 'Ax Ay r(x, y) -> Ax Ey r(x, y)': '(∀x ∀y r(x, y)) ⇒ ∀x ∃y r(x, y)',
  };
  for (const [src, out] of Object.entries(cases)) assert.equal(F.text(P(src)), out, src);
  // klucz (zapis i linki) pozostaje zwięzły — bez dodatkowych nawiasów
  assert.equal(F.key(P('Ax p(x) -> q')), 'Ax p(x)>q');
});

test('relacje między termami, stałe liczbowe i duże litery (jak w zadaniach z kolokwiów)', () => {
  const cases = {
    'f(x) > 0 -> g(x) > 0': 'f(x) > 0 ⇒ g(x) > 0', 'f(x)>0⇒g(x)>0': 'f(x) > 0 ⇒ g(x) > 0', 'x = y': 'x = y',
    'x != y': '¬(x = y)', 'x ≠ y': '¬(x = y)', 'x <= 42 & y >= 007': 'x ≤ 42 ∧ y ≥ 7', 'x < y | x ≤ y': 'x < y ∨ x ≤ y',
    '~(f(z) = y)': '¬(f(z) = y)', 'Ex f(x) = y': '∃x f(x) = y', 'R(x, x) -> S(x)': 'R(x, x) ⇒ S(x)', 'P & Q(a)': 'P ∧ Q(a)',
    'p > q': 'p ⇒ q', 'x > y > q': 'x > y ⇒ q', 'p(0, 1)': 'p(0, 1)', 'T & ~F': '⊤ ∧ ¬⊥',
  };
  for (const [src, out] of Object.entries(cases)) {
    const f = P(src);
    assert.equal(F.text(f), out, src);
    assert.ok(F.eq(P(F.key(f)), f), `klucz: ${src}`);
    assert.ok(F.eq(P(F.text(f)), f), `tekst: ${src}`);
  }
  // ≠ to skrót: ¬(x = y)
  assert.ok(F.eq(P('x != y'), F.NOT(P('x = y'))));
  // HTML bezpieczny, LaTeX z \leq, \geq; liczby prosto (bez indeksu i kursywy)
  assert.equal(F.html(P('x < 10')), '<i>x</i> &lt; 10');
  assert.equal(F.tex(P('x <= 1 & y >= 0')), 'x \\leq 1 \\land y \\geq 0');
  assert.deepEqual(F.runs(P('f(x) > 10 & R(x)')).map(r => [r.t, r.italic]), [['f', true], ['(', false], ['x', true], [') > 10 ∧ ', false], ['R', true], ['(', false], ['x', true], [')', false]]);
  // błędy
  const bad = { '1234567890 = x': /Za długa liczba/, 'x = ': /Oczekiwano termu/, 'x = y = z': /Nieoczekiwany symbol/, '42': /jest stałą, a nie formułą/, 'T(x)': /Nieoczekiwany/ };
  for (const [src, re] of Object.entries(bad)) assert.throws(() => P(src), re, src);
  // w rachunku zdań bez zmian: 0 i 1 to ⊥ i ⊤, „=” nie jest symbolem
  assert.equal(F.text(F.parse('p > 0')), 'p ⇒ ⊥');
  assert.throws(() => F.parse('p = q'), F.ParseError);
});

test('stała liczba argumentów symboli: w formule i w całym dowodzie (arityClash)', () => {
  assert.equal(F.arityClash([P('p(a)'), P('q')]), null);
  assert.equal(F.arityClash([P('p(a)'), P('p')]), 'p');
  assert.equal(F.arityClash([P('f(a) = b'), P('q(f(a, b))')]), 'f');
  assert.throws(() => P('p & p(x)'), /różną liczbą argumentów/);
  // odczyt z zapisu nie sprawdza liczby argumentów (starsze wersje przepuszczały takie formuły)
  assert.ok(Proof.deserialize('[{"f":"p>p(a)"}]', Rules.isRule, fo)[0]);
});

test('błędy składni mają zrozumiałe komunikaty', () => {
  const cases = {
    x: /jest zmienną, a nie formułą/, 'p(x) & p': /różną liczbą argumentów/, 'p(f)': /podaj argumenty/,
    'A p': /nie jest zmienną/, 'p(a(x))': /jest stałą/, 'k(x)': /Nieznany symbol/, 'p(x': /nawiasu/,
  };
  for (const [src, re] of Object.entries(cases)) assert.throws(() => P(src), re, src);
  // rachunek zdań nie przyjmuje kwantyfikatorów
  assert.throws(() => F.parse('Ax p(x)'), F.ParseError);
});

test('podstawienia: dopuszczalność (Def. 52) i dopasowanie α[x/t] = β', () => {
  const a = P('Ey r(x, y)');
  assert.equal(F.text(F.subst(a, 'x', T('f(z)'))), '∃y r(f(z), y)');
  assert.equal(F.subst(a, 'x', T('y')), null);                     // y zostałoby związane
  assert.equal(F.text(F.subst(P('p(x) & Ax q(x)'), 'x', T('a'))), 'p(a) ∧ ∀x q(x)');
  assert.equal(F.text(F.match(P('r(x, f(x))'), 'x', P('r(g(a), f(g(a)))')).t), 'g(a)');
  assert.equal(F.match(P('r(x, f(x))'), 'x', P('r(a, f(b))')), null);
  assert.deepEqual(F.match(P('p(c)'), 'x', P('p(c)')), { t: null });
  assert.equal(F.match(P('Ey r(x, y)'), 'x', P('Ey r(y, y)')), null);   // niedopuszczalne
  assert.deepEqual(F.freeVars(P('Ax r(x, y) & p(z)')), ['y', 'z']);
  assert.equal(F.freshVar('x', new Set(['x0', 'x1'])), 'x2');
});

/* ---------- reguły ---------- */

test('reguły dla kwantyfikatorów „od celu” dają węzły, które przechodzą weryfikację', () => {
  const ctx = () => Rules.freshContext(new Set(['x', 'y']));
  const cases = [
    ['allI', 'Ax p(x)', undefined], ['exI', 'Ex p(x)', T('f(a)')],
    ['allE', 'p(f(a))', P('Ax p(x)')], ['exE', 'q', P('Ex p(x)')],
  ];
  for (const [id, goal, x] of cases) {
    const r = Rules.get(id), g = P(goal);
    const n = Proof.node(g, id, Rules.materialize(r.back.premises(g, x, ctx())));
    assert.ok(check(n), id);
    if (r.back.param) assert.ok(F.eq(Rules.paramOf(n), x), `${id}: parametr`);
  }
});

test('warunki świeżości: zmienna okna nie może być wolna w założeniach, wniosku ani w formule ∃x α', () => {
  const box = (a, body, x) => Proof.box(a ? P(a) : null, Proof.node(P(body)), [], x);
  // (∀i) ze zmienną y, która jest wolna w założeniu otaczającego okna
  const allI = Proof.node(P('Ax p(x)'), 'allI', [box(null, 'p(y)', 'y')]);
  assert.ok(check(allI, [P('q')]));
  assert.ok(!check(allI, [P('p(y)')]));
  assert.ok(!check(allI, [], ['y']));                                        // już zmienna otaczającego okna
  assert.ok(!check(Proof.node(P('Ax r(x, y)'), 'allI', [box(null, 'r(y, y)', 'y')])));   // wolna we wniosku
  assert.ok(!check(Proof.node(P('Ax p(x)'), 'allI', [box(null, 'p(z)', 'y')])));          // zła formuła w oknie
  // (∃e): zmienna wolna w β albo w ∃x α
  const exE = (concl, D, a, x) => Proof.node(P(concl), 'exE', [Proof.node(P(D)), Proof.box(P(a), Proof.node(P(concl)), [], x)]);
  assert.ok(check(exE('q', 'Ex p(x)', 'p(y)', 'y')));
  assert.ok(!check(exE('q(y)', 'Ex p(x)', 'p(y)', 'y')));
  assert.ok(!check(exE('q', 'Ex r(x, y)', 'r(y, y)', 'y')));
  assert.ok(!check(exE('q', 'Ex p(x)', 'p(z)', 'y')));
  // (∀e) i (∃i): tylko dopuszczalne podstawienia
  assert.ok(check(Proof.node(P('p(f(a))'), 'allE', [Proof.node(P('Ax p(x)'))])));
  assert.ok(!check(Proof.node(P('Ey r(y, y)'), 'allE', [Proof.node(P('Ax Ey r(x, y)'))])));
  assert.ok(check(Proof.node(P('Ex p(x)'), 'exI', [Proof.node(P('p(c)'))])));
  assert.ok(!check(Proof.node(P('Ex p(x)'), 'exI', [Proof.node(P('q(c)'))])));
});

test('reguły dla kwantyfikatorów „od przesłanek” budują poprawne wnioski', () => {
  const ctx = () => Rules.freshContext(new Set());
  const build = (id, fs, x) => {
    const r = Rules.get(id), nodes = fs.map(s => Proof.node(P(s)));
    const arranged = Rules.fwdArrange(r, nodes.map(n => n.f), nodes);
    const { f, prem } = r.fwd.build(arranged.fs, arranged.nodes, x, ctx());
    return Proof.node(f, id, Rules.enclose(prem));
  };
  // (∀i): fragment p(y) z hipotezą ∀x p(x) (y nie jest w niej wolna) — wolno uogólnić y
  const viaAll = Proof.node(P('p(y)'), 'allE', [Proof.node(P('Ax p(x)'))]);
  const allIr = Rules.get('allI');
  assert.equal(allIr.fwd.param.check(P('Ax p(x)'), [viaAll.f], [viaAll]), null);
  const { f: gf, prem: gp } = allIr.fwd.build([viaAll.f], [viaAll], P('Ax p(x)'), ctx());
  const allI = Proof.node(gf, 'allI', Rules.enclose(gp));
  assert.equal(allI.prem[0].x, 'y');
  assert.equal(Rules.verify([allI]).size, 0);
  // z hipotezy p(y) nie wolno wnioskować ∀x p(x)
  assert.match(allIr.fwd.param.check(P('Ax p(x)'), [P('p(y)')], [Proof.node(P('p(y)'))]), /występuje wolno w założeniu p\(y\)/);
  assert.match(allIr.fwd.param.check(P('Ax r(x, y)'), [P('r(y, y)')], [viaAll]), /występuje wolno w ∀x r\(x, y\)/);
  assert.ok(check(build('allE', ['Ax p(x)'], T('f(a)'))));
  assert.ok(check(build('exI', ['p(c)'], P('Ex p(x)'))));
  // (∃e): fragment z hipotezą p(y) — zostaje w oknie ze świeżą zmienną y i zamknięta
  const m = Proof.node(P('Ex p(x)'), 'exI', [Proof.node(P('p(y)'))]);
  const r = Rules.get('exE'), d = Proof.node(P('Ex p(x)'));
  const { f, prem } = r.fwd.build([d.f, m.f], [d, m], undefined, ctx());
  const exE = Proof.node(f, 'exE', Rules.enclose(prem));
  assert.equal(exE.prem[1].x, 'y');
  assert.equal(Proof.openLeaves(exE).length, 1);                             // tylko ∃x p(x)
  assert.ok(Rules.verify([exE]).size === 0);
});

/* ---------- przykłady, dowodzący, dowód słowny ---------- */

test('każdy przykład (kolokwia, egzaminy, skrypt) ma dowód, który przechodzi weryfikację', () => {
  for (const e of Examples.FO.LIST) {
    const root = proofOf(P(e.formula));
    assert.ok(root, e.title);
    assert.equal(Rules.verify([root]).size, 0, e.title);
    assert.equal(Proof.openLeaves(root).length, 0, e.title);
  }
});

test('podpowiedzi tylko w 5–10 zadaniach przykładowych z kolokwiów i egzaminów (z opublikowanymi rozwiązaniami)', () => {
  const samples = Examples.FO.LIST.filter(e => e.group === 'qprzyk');
  assert.equal(Examples.FO.GROUPS[0].id, 'qprzyk');
  assert.ok(samples.length >= 5 && samples.length <= 10);
  assert.equal(Examples.FO.SAMPLES.length, samples.length);
  samples.forEach(e => assert.match(e.title, /^(Kolokwium 2,|Egzamin|Poprawka) /, e.title));
  for (const e of Examples.FO.LIST) assert.equal(Examples.FO.isSample(P(e.formula)), e.group === 'qprzyk', e.title);
  assert.ok(!Examples.FO.isSample(P('Ax q(x) -> q(a)')));
  // każda formuła występuje w menu raz
  assert.equal(new Set(Examples.FO.LIST.map(e => F.key(P(e.formula)))).size, Examples.FO.LIST.length);
});

test('dowodzący działa także w środku dowodu (założenia i świeże zmienne okien)', () => {
  const pf = ProverFO.prove([P('Ax (p(x) -> q(x))'), P('p(x0)')], P('Ey q(y)'), { used: new Set(['x0']), terms: [F.VAR('x0')] });
  assert.ok(pf);
  const root = roundtrip(pf);
  let ok = true;
  Proof.walk([root], (n, c) => { if (!Rules.checkNode(n, [P('Ax (p(x) -> q(x))'), P('p(x0)'), ...c.scope], c.vars)) ok = false; });
  assert.ok(ok);
});

test('świeże zmienne dowodzącego są takie jak w aplikacji: x₀, x₁, …', () => {
  for (const e of Examples.FO.LIST) {
    const root = proofOf(P(e.formula));
    Proof.walk([root], n => n.prem.forEach(p => { if (p.x) assert.match(p.x, /^[xyz][01]$/, e.title); }));
  }
});

test('dowód słowny: struktura 𝔄, wartościowania i elementy uniwersum', () => {
  for (const e of Examples.FO.LIST) {
    const root = proofOf(P(e.formula));
    const prose = Explain.prose(root, { logic: 'fo' });
    const text = Render.proseText(prose, { rules: true });
    assert.match(text, /weźmy dowolną strukturę 𝔄 o uniwersum A oraz dowolne wartościowanie v : V → A/, e.title);
    assert.match(text, /formuła [φθ] jest tautologią\. ∎$/, e.title);
    assert.ok(!/undefined|\[object/.test(text), e.title);
    if (/allI/.test(JSON.stringify(Proof.toPlain(root)))) assert.match(text, /Z dowolności wyboru elementu a₁/, e.title);
    const tex = Render.proseTeX(prose, { rules: true });
    assert.ok(tex.includes('\\mathfrak{A} \\models'), e.title);
    assert.ok(!/\$\$/.test(tex), e.title);                                   // żadnych przyklejonych wzorów
    // kroki prezentacji „od przesłanek”: zdania z węzłami
    const steps = Explain.prose(root, { logic: 'fo', merge: false, skipKnown: false }).sentences.filter(s => s.nodes.length);
    assert.ok(steps.length >= 2, e.title);
  }
});

test('dowodzona formuła z symbolem φ nazywa się w tekście θ', () => {
  const text = Render.proseText(Explain.prose(proofOf(P('Ax φ(x) -> Ex φ(x)')), { logic: 'fo' }));
  assert.match(text, /^Dowód\. Rozważmy formułę θ = /);
  assert.match(Render.proseText(Explain.prose(proofOf(P('Ax p(x) -> Ex p(x)')), { logic: 'fo' })), /^Dowód\. Rozważmy formułę φ = /);
});

test('opisy kroków i podpowiedzi dla reguł z kwantyfikatorami', () => {
  const root = proofOf(P('(Ex p(x)) -> ~Ax ~p(x)'));
  const seen = new Set();
  Proof.walk([root], n => {
    if (!n.rule || n.rule === 'hyp') return;
    seen.add(n.rule);
    assert.ok(Render.segText(Explain.goalStep(n)).length > 10, n.rule);
    assert.ok(Render.segText(Explain.hintIdea(n)).length > 10, n.rule);
  });
  assert.ok(['exE', 'allE'].every(r => seen.has(r)));
  let allI = null;
  Proof.walk([proofOf(P('Ax (p(x) & q(x)) -> Ax p(x)'))], n => { if (n.rule === 'allI') allI = n; });
  assert.match(Render.segText(Explain.goalStep(allI)), /świeżą zmienną x₀ i dowodzimy p\(x₀\)/);
});

/* ---------- zapis, odczyt, eksport ---------- */

test('zapis i odczyt dowodów z oknami ze świeżymi zmiennymi', () => {
  for (const e of Examples.FO.LIST.slice(0, 12)) {
    const root = proofOf(P(e.formula));
    const json = Proof.serialize([root]);
    const back = Proof.deserialize(json, Rules.isRule, fo);
    assert.equal(Proof.serialize(back), json, e.title);
  }
  const bad = [
    '[{"f":"Ax p(x)","r":"allI","p":[{"x":"p","b":{"f":"p(p)"}}]}]',      // zmienna okna nie jest zmienną
    '[{"f":"Ax p(x)","r":"allI","p":[{"b":{"f":"p(x0)"}}]}]',              // okno bez założenia i bez zmiennej
  ];
  for (const json of bad) assert.throws(() => Proof.deserialize(json, Rules.isRule, fo), /./, json);
  // zapis rachunku zdań czytany jako rachunek zdań
  assert.throws(() => Proof.deserialize('[{"f":"Ax p(x)"}]', Rules.isRule), F.ParseError);
  // zmienna okna z długim indeksem (dopuszczalna w parserze) też przechodzi zapis i odczyt
  const long = '[{"f":"Ax1234 (p(x1234) -> p(x1234))","r":"allI","p":[{"x":"x1234","b":{"f":"p(x1234) -> p(x1234)","r":"impI","p":[{"a":"p(x1234)","b":{"f":"p(x1234)","r":"hyp"}}]}}]}]';
  const roots = Proof.deserialize(long, Rules.isRule, fo);
  assert.equal(Rules.verify(roots).size, 0);
  assert.equal(Proof.serialize(roots), Proof.serialize(Proof.deserialize(Proof.serialize(roots), Rules.isRule, fo)));
});

test('eksport: LaTeX z oknem ze świeżą zmienną i rysunek', () => {
  const root = proofOf(P('(Ex p(x)) -> ~Ax ~p(x)'));
  const tex = Export.latex(root);
  assert.match(tex, /\\oknoh\{x_0\\quad\\mbox\{świeża zmienna\};\\ p\(x_0\)\\quad\\mbox\{założenie\}\}/);
  assert.match(tex, /\\infer\[\(\\exists\\mathrm\{e\}\)\]/);
  assert.ok(!/UWAGA/.test(tex));
  const L = Export.layout(root, Export.approxMeasurer());
  const words = L.items.filter(i => i.type === 'text').map(i => i.runs.map(r => r.t).join(''));
  assert.ok(words.includes('świeża zmienna'));
  assert.ok(words.includes('x₀'));
  assert.ok(Export.toSVG(L, Export.THEMES.light).includes('świeża zmienna'));
});

test('podpowiedzi „od przesłanek”: uogólnienia dla (∃i) i (∀i) są poprawnymi wnioskami', () => {
  const A = P('p(g(a, y)) ∧ ∀x q(x, y)');
  const ex = Rules.get('exI').fwd.param.best([A], { openGoals: [] }).map(F.text);
  assert.deepEqual(ex, ['∃z (p(z) ∧ ∀x q(x, y))', '∃z (p(g(z, y)) ∧ ∀x q(x, y))', '∃y (p(g(a, y)) ∧ ∀x q(x, y))']);
  // ∀i: zmienna nie może być wolna w otwartym założeniu (samodzielny fragment jest założeniem)
  const al = Rules.get('allI').fwd.param;
  assert.deepEqual(al.best([A], {}, [Proof.node(A)]), []);
  const inst = Proof.node(P('p(y)'), 'allE', [Proof.node(P('∀x p(x)'))]);
  assert.deepEqual(al.best([inst.f], {}, [inst]).map(F.text), ['∀y p(y)']);
  // każda podpowiedź dla (∃i) przechodzi sprawdzenie reguły
  for (const g of Rules.get('exI').fwd.param.best([A], { openGoals: [] })) assert.equal(Rules.get('exI').fwd.param.check(g, [A]), null);
});

/* ---------- poprawki błędów (testy regresji) ---------- */

test('(∃e) „od celu”: zmienna okna jest świeża także względem wpisanej formuły ∃x α', () => {
  const goal = Proof.node(P('q')), D = P('Ex r(x, x0)');
  goal.rule = 'exE';
  goal.prem = Rules.materialize(Rules.get('exE').back.premises(goal.f, D, Rules.freshContext(Rules.usedVars(goal))));
  assert.equal(goal.prem[1].x, 'x1');
  assert.equal(F.text(goal.prem[1].a), 'r(x₁, x₀)');
  assert.ok(check(goal));
});

test('dowód słowny nie przenosi wartości formuł z wolną zmienną okna spoza okna', () => {
  const json = '[{"f":"(Ax p(x)) > (Ez p(z)) & Ay p(y)","r":"impI","p":[{"a":"Ax p(x)","b":{"f":"(Ez p(z)) & Ay p(y)","r":"andI","p":[{"f":"Ez p(z)","r":"exI","p":[{"f":"p(y0)","r":"allE","p":[{"f":"Ax p(x)","r":"hyp"}]}]},{"f":"Ay p(y)","r":"allI","p":[{"x":"y0","b":{"f":"p(y0)","r":"allE","p":[{"f":"Ax p(x)","r":"hyp"}]}}]}]}}]}]';
  const [root] = Proof.deserialize(json, Rules.isRule, fo);
  assert.equal(Rules.verify([root]).size, 0);
  const text = Render.proseText(Explain.prose(root, fo));
  assert.doesNotMatch(text, /Jak już wiemy, 𝔄 ⊨ p\(y₀\)\[v₁\]/);
  assert.match(text, /𝔄 ⊨ p\(y₀\)\[v₁\]/);                                   // pokazane od nowa w oknie
});

test('dowód słowny korzenia (∀i) nie zapowiada celu dwa razy', () => {
  const text = Render.proseText(Explain.prose(proofOf(P('Ax (p(x) -> p(x))')), fo));
  assert.doesNotMatch(text, /pokażmy, że 𝔄 ⊨ φ\[v\]\. Pokażemy, że 𝔄 ⊨ φ\[v\]\./);
});

test('dowód słowny: relacja między termami w nawiasach („𝔄 ⊨ (f(x₀) = y)[v₁]”), nazwy bez kolizji', () => {
  const text = Render.proseText(Explain.prose(proofOf(P('(Ex f(x) = y) -> ~Az ~(f(z) = y)')), fo));
  assert.match(text, /𝔄 ⊨ \(f\([xz]₀\) = y\)\[v₁\]/);
  assert.doesNotMatch(text, /undefined|\[object/);
  // zmienne v, v₁ i stała a₁ w dowodzie: wartościowania i elementy dostają inne litery
  const clash = Render.proseText(Explain.prose(proofOf(P('(Av p(v, a1)) -> Ev1 p(v1, a1)')), fo));
  assert.match(clash, /dowolne wartościowanie w : V → A/);
  assert.doesNotMatch(clash, /wartościowanie v /);
});

test('dowodzący: (∀e) także bez termów w formule; nazwy świeżych zmiennych jak w aplikacji', () => {
  for (const s of ['Ax q -> q', '(Ax φ) -> φ', 'Ax (q & s) -> s', '(Ax q) -> Ex q']) assert.ok(proofOf(P(s)), s);
  const scope = [P('Ex p(x)'), P('Ex q(x)')], goal = P('Ey q(y)');
  const used = Rules.usedVars(Proof.node(P('(Ex p(x)) & (Ex q(x)) -> Ey q(y)')));
  const pf = ProverFO.prove(scope, goal, { used, terms: [] });
  const app = Rules.get('exE').back.premises(goal, Rules.paramOf(pf), Rules.freshContext(new Set(used)));
  assert.equal(pf.prem[1].x, app[1].fresh);
});

test('wstawienie fragmentu i nowe okno „od przesłanek”: zmienne okien wewnątrz zostają świeże', () => {
  // fragment z oknem (∀i) o zmiennej x₀ trafia do okna, które też ma zmienną x₀
  const inner = proofOf(P('(Ax (q(x) & r(x))) -> Ax q(x)'));
  assert.ok(JSON.stringify(Proof.toPlain(inner)).includes('"x":"x0"'));
  const outer = Proof.node(P('Ax ((Ax (q(x) & r(x))) -> Ax q(x))'), 'allI', [Proof.box(null, Proof.node(P('(Ax (q(x) & r(x))) -> Ax q(x)')), [], 'x0')]);
  Rules.renameWindows(inner, new Set(['x0']), Rules.freshContext(Rules.usedVars(outer, Rules.usedVars(inner))));
  outer.prem[0].body = inner;
  assert.equal(Rules.verify([outer]).size, 0);
  assert.ok(!JSON.stringify(Proof.toPlain(inner)).includes('"x":"x0"'));
  // (⇒i) „od przesłanek” z założeniem, w którym jest wolna zmienna okna z wnętrza fragmentu
  const m = proofOf(P('Ax (p(x) -> p(x))'));                                   // okno ze zmienną x₀
  const ctx = Rules.freshContext(Rules.usedVars(m));
  const r = Rules.get('impI'), { f, prem } = r.fwd.build([m.f], [m], P('q(x0)'), ctx);
  const root = Proof.node(f, 'impI', Rules.enclose(prem, ctx));
  assert.equal(Rules.verify([root]).size, 0);
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy rachunku kwantyfikatorów przeszły (${passed})`);
