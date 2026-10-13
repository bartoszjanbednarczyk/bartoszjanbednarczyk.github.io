/* =====================================================================
   Testy rezolucji (bez przeglądarki):  node dedukcja/tests/res.test.js
   Klauzule, parser zbiorów, rezolwenty, spełnialność, szukanie dowodu
   sprzeczności, podpowiedzi, praca nad zadaniem (usuwanie rezolwent) i jej zapis.
   ===================================================================== */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

for (const f of ['formula', 'text', 'proof', 'rules', 'render', 'export', 'resolution', 'examples']) require(path.join(__dirname, '..', 'js', f + '.js'));
const { Res, Examples, Export, Proof } = globalThis.ND;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}
const C = s => Res.parseClause(s);
const set = s => Res.parseClauses(s);
const txt = c => Res.clauseText(c);

/** Czy kroki tworzą poprawny dowód sprzeczności zbioru `clauses` (każdy krok to rezolwenta znanych klauzul). */
function checkRefutation(clauses, steps) {
  const known = new Map(clauses.map(c => [Res.key(c), c]));
  for (const s of steps) {
    const a = known.get(s.a), b = known.get(s.b);
    assert.ok(a && b, 'przesłanki kroku są znane');
    assert.ok(Res.canResolve(a, b, s.on));
    assert.equal(Res.key(Res.resolve(a, b, s.on)), Res.key(s.clause));
    known.set(Res.key(s.clause), s.clause);
  }
  assert.ok(known.has('⊥'));
}

test('klauzule: zapis jak w skrypcie, klauzule jako zbiory literałów', () => {
  assert.equal(txt(C('¬p ∨ q ∨ ¬r')), '¬p ∨ q ∨ ¬r');
  assert.equal(txt(C('~p | q')), '¬p ∨ q');
  assert.equal(txt(C('p \\/ !q')), 'p ∨ ¬q');
  assert.equal(Res.key(C('p ∨ q')), Res.key(C('q ∨ p')));
  assert.equal(Res.key(C('p ∨ p')), Res.key(C('p')));
  assert.ok(Res.isEmpty(C('⊥')));
  assert.equal(txt(C('⊥')), '⊥');
  assert.ok(Res.isTautology(C('p ∨ ¬p ∨ q')));
});

test('zbiory klauzul: nawiasy klamrowe, przecinki, wiersze; błędy po polsku', () => {
  assert.equal(set('{¬p ∨ q, ¬p ∨ ¬r ∨ s, ¬q ∨ r, p, ¬s}').length, 5);
  assert.equal(set('p ∨ q\n¬p\n¬q').length, 3);
  assert.equal(set('{p, q ∨ p, p ∨ q}').length, 2);                      // powtórzenia raz
  for (const [src, re] of [['p q', /Klauzula to alternatywa .* musi stać ∨/], ['p ∨', /Oczekiwano zmiennej/], ['{}', /co najmniej jedną/],
    ['P ∨ q', /Oczekiwano zmiennej/], ['p, q r', /Klauzula 2: klauzula to alternatywa/]]) {
    assert.throws(() => set(src), re, src);
  }
  // limit literałów liczy się po usunięciu powtórzeń
  assert.equal(set(Array(20).fill('p').join(' ∨ ')).length, 1);
  assert.throws(() => set('p ∨ q ∨ r ∨ s ∨ t ∨ u ∨ v ∨ w ∨ x ∨ y ∨ z ∨ a ∨ b ∨ c ∨ d ∨ e ∨ f'), /za dużo literałów/i);
});

test('rezolwenty (Def. 47): po jednej dla każdej pary przeciwnych literałów', () => {
  const rs = Res.resolvents(C('p ∨ q'), C('¬p ∨ ¬q'));
  assert.deepEqual(rs.map(r => [r.on, txt(r.clause)]), [['p', 'q ∨ ¬q'], ['q', 'p ∨ ¬p']]);
  assert.deepEqual(Res.resolvents(C('p ∨ q'), C('¬p ∨ q')).map(r => txt(r.clause)), ['q']);
  assert.deepEqual(Res.resolvents(C('p'), C('q')), []);
  assert.ok(Res.isEmpty(Res.resolve(C('p'), C('¬p'), 'p')));
  assert.ok(Res.canResolve(C('¬p'), C('p ∨ r'), 'p'));
  assert.ok(!Res.canResolve(C('p'), C('p ∨ r'), 'p'));
});

test('spełnialność: wartościowanie spełnia wszystkie klauzule; zgodność z wybranymi wartościami', () => {
  for (const e of Examples.RES.LIST) {
    const cs = set(e.clauses), val = Res.satisfying(cs);
    if (val) assert.ok(cs.every(c => Res.valueOf(c, val) === true), e.title);
    const ref = Res.refutation(cs);
    assert.equal(!!ref, !val, `${e.title}: dokładnie jedno z dwojga`);
    if (ref) checkRefutation(cs, ref);
  }
  const cs = set('{p ∨ q, ¬p ∨ r, ¬q ∨ ¬r, q ∨ r}');
  assert.equal(Res.satisfying(cs, { p: true, q: true }), null);
  assert.ok(Res.satisfying(cs, { p: true }));
  assert.equal(Res.valueOf(C('p ∨ q'), { p: false }), null);
  assert.equal(Res.valueOf(C('p ∨ q'), { p: false, q: false }), false);
});

test('zadanie 133: zbiory 1 i 2 są sprzeczne, zbiór 3 — nie', () => {
  const kinds = Examples.RES.LIST.filter(e => e.group === 'r133').map(e => Res.satisfiable(set(e.clauses)));
  assert.deepEqual(kinds, [false, false, true]);
  // przykład ze str. 43: dowód z trzech kroków
  assert.equal(Res.refutation(set(Examples.RES.LIST[0].clauses)).length, 3);
});

test('praca nad zadaniem: drzewo dowodu, ciąg z Def. 47, zapis i ścisły odczyt', () => {
  const initial = set('{p ∨ q, ¬p ∨ q, p ∨ ¬q, ¬p ∨ ¬q}');
  const work = { initial, steps: [], valuation: { p: true } };
  const add = (a, b, on) => { const all = Res.allClauses(work); work.steps.push({ a, b, on, clause: Res.resolve(all[a], all[b], on) }); };
  add(0, 1, 'p'); add(2, 3, 'p'); add(4, 5, 'q');
  assert.ok(Res.refuted(work));
  assert.ok(!Res.satisfied(work));
  assert.equal(Res.emptyIndex(work), 6);
  const tree = Res.tree(work, 6);
  assert.equal(tree.rule, 'res');
  assert.equal(tree.prem.length, 2);
  let leaves = 0;
  Proof.walk([tree], n => { if (!n.prem.length) leaves++; });
  assert.equal(leaves, 4);
  assert.deepEqual(Res.usedIn(work, 6), [0, 1, 2, 3, 4, 5, 6]);
  const o = Res.serialize(work);
  assert.deepEqual(o.d, [[0, 1, 'p'], [2, 3, 'p'], [4, 5, 'q']]);
  const back = Res.deserialize(JSON.parse(JSON.stringify(o)));
  assert.equal(JSON.stringify(Res.serialize(back)), JSON.stringify(o));
  // niepoprawne kroki i dane są odrzucane
  const bad = [
    { ...o, d: [[0, 0, 'p']] }, { ...o, d: [[0, 1, 'q']] }, { ...o, d: [[0, 9, 'p']] }, { c: [] }, { c: ['p q'] }, null,
    { c: ['p', 'p', '~p'] },                                     // powtórzona klauzula zbioru
    { ...o, d: [[0, 1, 'p'], [0, 1, 'p']] },                     // powtórzona rezolwenta
    { ...o, d: [...o.d, [0, 1, 'p']] },                          // krok po wyprowadzeniu ⊥
  ];
  for (const b of bad) assert.throws(() => Res.deserialize(b), Res.ResError, JSON.stringify(b));
  // wartości zmiennych spoza zbioru są pomijane
  assert.deepEqual(Res.deserialize({ c: ['p'], s: { p: 1, z: 0, q: 2 } }).valuation, { p: true });
});

test('usunięcie rezolwenty usuwa też rezolwenty, które z niej powstały, i przenumerowuje resztę', () => {
  const initial = set('{p ∨ q, ¬p ∨ q, p ∨ ¬q, ¬p ∨ ¬q}');
  const work = { initial, steps: [], valuation: {} };
  const add = (a, b, on) => { const all = Res.allClauses(work); work.steps.push({ a, b, on, clause: Res.resolve(all[a], all[b], on) }); };
  add(0, 1, 'p'); add(2, 3, 'p'); add(4, 5, 'q'); add(0, 2, 'q');   // C₄ = q, C₅ = ¬q, C₆ = ⊥, C₇ = p
  const r = Res.withoutResolvent(work, 5);
  assert.equal(r.removed, 2);                                      // ¬q i ⊥
  assert.deepEqual(r.steps.map(s => [s.a, s.b, s.on, txt(s.clause)]), [[0, 1, 'p', 'q'], [0, 2, 'q', 'p']]);
  assert.equal(Res.withoutResolvent(work, 7).removed, 1);
});

test('podpowiedzi: krok dowodu sprzeczności albo wartość spełniającego wartościowania', () => {
  const refute = { initial: set('{p, ¬p ∨ q, ¬q}'), steps: [], valuation: {} };
  for (let k = 0; k < 5 && !Res.refuted(refute); k++) {
    const h = Res.hint(refute), all = Res.allClauses(refute);
    assert.equal(h.kind, 'step');
    assert.ok(Res.canResolve(all[h.a], all[h.b], h.on));
    refute.steps.push({ a: h.a, b: h.b, on: h.on, clause: h.clause });
  }
  assert.ok(Res.refuted(refute));
  const sat = { initial: set('{p ∨ q, ¬p ∨ r, ¬q ∨ ¬r, q ∨ r}'), steps: [], valuation: {} };
  for (let k = 0; k < 10 && !Res.satisfied(sat); k++) {
    const h = Res.hint(sat);
    assert.equal(h.kind, 'value');
    sat.valuation[h.v] = h.value;
  }
  assert.ok(Res.satisfied(sat));
  // zła wartość: zmiana jednej zmiennej albo (gdy to nie wystarczy) wyczyszczenie wartościowania
  assert.deepEqual(Res.hint({ initial: set('{p, q ∨ r}'), steps: [], valuation: { p: false } }), { kind: 'change', v: 'p', value: true });
  assert.deepEqual(Res.hint({ initial: set('{¬p, ¬q}'), steps: [], valuation: { p: true, q: true } }), { kind: 'reset' });
});

test('eksport drzewa rezolucji: bez etykiet reguł, LaTeX bez ostrzeżeń', () => {
  const work = { initial: set('{p, ¬p}'), steps: [], valuation: {} };
  work.steps.push({ a: 0, b: 1, on: 'p', clause: Res.resolve(work.initial[0], work.initial[1], 'p') });
  const tree = Res.tree(work, 2);
  const tex = Export.latex(tree, { check: false });
  assert.match(tex, /\\infer\{\\bot\}\{%/);
  assert.ok(!/UWAGA/.test(tex));
  const L = Export.layout(tree, Export.approxMeasurer());
  assert.ok(!L.items.some(i => i.type === 'text' && i.runs.some(r => r.t.startsWith('('))));
});

test('przykłady z podpowiedziami: tylko grupa „z podpowiedziami”', () => {
  for (const e of Examples.RES.LIST) assert.equal(Examples.RES.isSample(set(e.clauses)), e.group === 'rprzyk', e.title);
  assert.ok(Examples.RES.isSample(set('{¬p ∨ ¬q, p ∨ ¬q, ¬p ∨ q, q ∨ p}')));   // kolejność nie ma znaczenia
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy rezolucji przeszły (${passed})`);
