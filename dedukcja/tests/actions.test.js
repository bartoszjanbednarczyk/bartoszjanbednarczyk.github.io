/* =====================================================================
   Testy akcji edycji (bez przeglądarki):  node dedukcja/tests/actions.test.js
   Cofanie kroku i całego poddrzewa w obu trybach, operacje na pasku akcji.
   Komunikaty i localStorage są zastąpione atrapami, widok — pustymi funkcjami.
   ===================================================================== */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

const toasts = [];
globalThis.location = { hash: '' };
globalThis.ND = {};
const js = f => require(path.join(__dirname, '..', 'js', f + '.js'));
['formula', 'text', 'proof', 'rules', 'prover', 'explain', 'render', 'examples'].forEach(js);
js('ui/kit');
const memory = new Map();
globalThis.ND.UI.kit = {
  ...globalThis.ND.UI.kit,
  toast: m => toasts.push(m),
  storage: { get: k => (memory.has(k) ? memory.get(k) : null), set: (k, v) => { memory.set(k, String(v)); return true; }, available: () => true },
};
js('ui/store');
js('ui/actions');
const ND = globalThis.ND;
ND.UI.workspace = { reveal() {}, revealFragment() {} };
ND.UI.hints = { bestArgs: () => [] };
const { F, Proof, Rules } = ND;
const S = ND.UI.store, A = ND.UI.actions, st = S.state;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}

/** Wczytuje fragmenty z postaci zapisu (jak w linku) i ustawia tryb. */
function load(plain, { mode = 'back', autoHyp = true } = {}) {
  S.setAutoHyp(autoHyp);
  S.setMode(mode);
  S.commit(() => { st.frags = Proof.fromPlain(plain, Rules.isRule); return true; }, { select: () => [] });
  toasts.length = 0;
}
/** Id pierwszego węzła (w kolejności przechodzenia) o danej formule i — opcjonalnie — regule. */
function find(text, rule) {
  const f = F.parse(text);
  let id = null;
  Proof.walk(st.frags, n => { if (id === null && F.eq(n.f, f) && (rule === undefined || n.rule === rule)) id = n.id; });
  assert.notEqual(id, null, `brak węzła ${text}`);
  return id;
}
const pick = (text, rule) => { const id = find(text, rule); S.select([id]); return id; };
const ops = () => A.offeredOps().map(o => o.name);
const plainOf = () => st.frags.map(Proof.toPlain);
const complete = i => S.status(st.frags[i]).complete;

// p ∧ q ⇒ q ∧ p: (⇒i) z oknem [p ∧ q], w nim (∧i) z przesłankami q (∧e₂) i p (∧e₁)
const SWAP = [{
  f: 'p&q->q&p', r: 'impI',
  p: [{ a: 'p&q', b: { f: 'q&p', r: 'andI', p: [{ f: 'q', r: 'andE2', p: [{ f: 'p&q', r: 'hyp' }] }, { f: 'p', r: 'andE1', p: [{ f: 'p&q', r: 'hyp' }] }] } }],
}];

test('„Cofnij krok” zachowuje gotowe dowody przesłanek jako osobne fragmenty', () => {
  load(SWAP);
  const id = pick('q&p');
  assert.deepEqual(ops(), ['step', 'clear', 'detach']);
  assert.ok(A.runOp('step'));
  assert.equal(st.frags.length, 3);
  assert.equal(st.idx.get(id).n.rule, null);                 // q ∧ p znów otwartym celem
  assert.deepEqual(st.sel, [id]);
  // przesłanki z dowodem są osobno, a użycia założenia spoza okna stały się otwartymi celami
  assert.deepEqual(st.frags.slice(1).map(r => F.text(r.f)), ['q', 'p']);
  assert.deepEqual(st.frags.slice(1).map(r => Proof.openFormulas(r).map(F.text)), [['p ∧ q'], ['p ∧ q']]);
  assert.match(toasts.join(' '), /Cofnięto krok \(∧i\)\. Dowody przesłanek zostały zachowane/);
  S.undo();
  assert.equal(st.frags.length, 1);
  assert.ok(complete(0));
});

test('zachowane fragmenty można wstawić z powrotem po ponownym zastosowaniu reguły', () => {
  load(SWAP);
  pick('q&p');
  A.runOp('step');
  pick('q&p');
  A.apply('andI');
  assert.equal(st.frags.length, 3);
  // sam cel: „Wstaw fragment 2” (fragment dowodzący tej samej formuły jest znajdowany sam)
  S.select([find('q', null)]);
  const [merge] = A.offeredOps();
  assert.equal(merge.name, 'merge');
  assert.equal(merge.label, 'Wstaw fragment 2');
  A.runOp('merge');
  // cel i fragment zaznaczone razem
  S.select([find('p', null), st.frags[1].id]);
  assert.equal(A.offeredOps()[0].label, 'Wstaw fragment w cel');
  A.runOp('merge');
  assert.equal(st.frags.length, 1);
  assert.ok(complete(0), 'po wstawieniu założenia w oknie zamykają się same');
});

test('„Cofnij całe poddrzewo” usuwa wszystko nad formułą', () => {
  load(SWAP);
  const id = pick('q&p');
  assert.ok(A.runOp('clear'));
  assert.equal(st.frags.length, 1);
  assert.equal(st.idx.get(id).n.rule, null);
  assert.equal(Proof.stats(st.frags).nodes, 2);
  S.undo();
  assert.ok(complete(0));
});

test('na szczycie gałęzi jest tylko „Cofnij krok” i nie zostawia fragmentów', () => {
  load(SWAP);
  pick('q', 'andE2');
  assert.deepEqual(ops(), ['step', 'detach']);
  assert.equal(A.runOp('clear'), false);
  assert.ok(A.runOp('step'));
  assert.equal(st.frags.length, 1);
  assert.equal(Proof.openLeaves(st.frags[0]).map(n => F.text(n.f)).join(), 'q');
});

test('przy otwartym celu cofany jest krok, z którego cel powstał', () => {
  load([{ f: 'p&q->q&p', r: 'impI', p: [{ a: 'p&q', b: { f: 'q&p', r: 'andI', p: [{ f: 'q' }, { f: 'p' }] } }] }]);
  const goal = pick('q');
  const [step] = A.offeredOps();
  assert.equal(step.name, 'step');
  assert.equal(step.target, find('q&p'));
  assert.match(step.label, /Cofnij krok .*∧i/);
  assert.match(step.title, /zastosowaną do q ∧ p — z niej powstała ta formuła/);
  A.runOp('step');
  assert.equal(st.idx.has(goal), false);
  assert.deepEqual(st.sel, [find('q&p')]);
  // kolejne naciśnięcia schodzą w dół drzewa, aż do celu bez kroku pod spodem
  A.runOp('step');
  assert.equal(Proof.stats(st.frags).nodes, 1);
  assert.equal(A.runOp('step'), false);
});

test('założenie zamknięte automatycznie wskazuje krok pod nim; ręcznie zamknięte — samo siebie', () => {
  load(SWAP);
  S.select([find('p&q', 'hyp')]);
  assert.equal(A.offeredOps()[0].target, find('q', 'andE2'));
  load(SWAP, { autoHyp: false });
  const hyp = find('p&q', 'hyp');
  S.select([hyp]);
  assert.equal(A.offeredOps()[0].target, hyp);
  assert.match(A.offeredOps()[0].label, /założenie/);
  A.runOp('step');
  assert.equal(st.idx.get(hyp).n.rule, null);
  S.setAutoHyp(true);
});

test('w dowodzie samouczka założenia zamykają się same także przy wyłączonym ustawieniu', () => {
  load(SWAP, { autoHyp: false });
  S.setAutoCloseFor(root => F.eq(root.f, F.parse('p&q->q&p')));
  S.select([find('p&q', 'hyp')]);
  assert.equal(A.offeredOps()[0].target, find('q', 'andE2'));
  S.setAutoCloseFor(null);
  S.refresh();
  assert.equal(A.offeredOps()[0].target, find('p&q', 'hyp'));
  S.setAutoHyp(true);
});

test('„od przesłanek”: cofnięcie kroku na dole fragmentu rozdziela go na przesłanki', () => {
  load([{ f: 'p&q', r: 'andI', p: [{ f: 'p' }, { f: 'q' }] }, { f: 'r' }], { mode: 'fwd' });
  pick('p&q');
  assert.deepEqual(ops(), ['step']);
  A.runOp('step');
  assert.deepEqual(st.frags.map(r => F.text(r.f)), ['p', 'q', 'r']);
  assert.deepEqual(st.sel, [st.frags[0].id, st.frags[1].id]);   // gotowe do ponownego użycia, w tej samej kolejności
});

test('„od przesłanek”: okno znika, a zamknięte w nim hipotezy znów są otwarte', () => {
  load([{ f: 'p->p', r: 'impI', p: [{ a: 'p', b: { f: 'p', r: 'hyp' } }] }], { mode: 'fwd' });
  pick('p->p');
  A.runOp('step');
  assert.deepEqual(plainOf(), [{ f: 'p' }]);
  load([{ f: 'T', r: 'topI' }], { mode: 'fwd' });
  pick('T');
  A.runOp('step');
  assert.equal(st.frags.length, 0);
});

test('„od przesłanek” w środku drzewa: wniosek staje się hipotezą, przesłanki wracają jako fragmenty', () => {
  load([{ f: 'p', r: 'andE1', p: [{ f: 'p&q', r: 'andI', p: [{ f: 'p' }, { f: 'q' }] }] }], { mode: 'fwd' });
  const mid = pick('p&q');
  A.runOp('step');
  assert.deepEqual(st.frags.map(r => F.text(r.f)), ['p', 'p', 'q']);
  assert.equal(st.idx.get(mid).n.rule, null);
  assert.match(toasts.join(' '), /wniosek jest teraz hipotezą/);
});

test('cofnięcie, które przekroczyłoby limit fragmentów, nic nie zmienia', () => {
  const filler = Array.from({ length: Proof.LIMITS.fragments - 1 }, () => ({ f: 'r' }));
  load([...SWAP, ...filler]);
  pick('q&p');
  const before = JSON.stringify(plainOf());
  assert.equal(A.runOp('step'), true);   // operacja pasowała, ale commit ją wycofał
  assert.equal(JSON.stringify(plainOf()), before);
  assert.match(toasts.join(' '), /Za dużo fragmentów/);
});

test('bez zaznaczenia albo przy kilku formułach nie ma cofania', () => {
  load(SWAP);
  S.select([]);
  assert.deepEqual(ops(), []);
  S.select([find('q', 'andE2'), find('p', 'andE1')]);
  assert.equal(A.runOp('step'), false);
  S.select([st.frags[0].id]);
  assert.deepEqual(ops(), ['step', 'clear']);
});

test('reguła już uzasadnionej formuły: komunikat wskazuje cofnięcie kroku', () => {
  load(SWAP);
  pick('q&p');
  assert.match(A.availability().reasons.get('andI'), /cofnij ten krok/);
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy akcji przeszły (${passed})`);
