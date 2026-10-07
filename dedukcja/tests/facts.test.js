/* =====================================================================
   Testy wniosków z założeń (bez przeglądarki):  node dedukcja/tests/facts.test.js
   Klik w założenie okna → reguła → wniosek w nagłówku okna; cele równe wnioskowi
   zamykają się kopią jego wyprowadzenia (dowód zostaje dowodem w systemie ze skryptu).
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
let answer = null;   // odpowiedź kreatora formuł (parametr reguły)
ND.UI.ask = { ask: async () => answer };
const { F, Proof, Rules, Explain, Render } = ND;
const S = ND.UI.store, A = ND.UI.actions, st = S.state;

let passed = 0;
const failures = [];
const tests = [];   // wykonywane po kolei (część testów czeka na kreator formuł)
const test = (name, fn) => tests.push([name, fn]);

function start(text, { autoHyp = true, mode = 'back' } = {}) {
  S.setAutoHyp(autoHyp);
  S.setMode(mode);
  S.commit(() => { st.frags = [Proof.node(F.parse(text))]; return true; }, { select: () => [] });
  toasts.length = 0;
}
/** Stosuje regułę „od celu” do pierwszego otwartego celu o danej formule. */
function back(goal, rule, arg) {
  const g = F.parse(goal);
  const info = [...st.idx.values()].find(i => Proof.isOpen(i.n) && F.eq(i.n.f, g));
  assert.ok(info, `brak otwartego celu ${goal}`);
  A.applyStep(rule, info, arg === undefined ? undefined : F.parse(arg));
}
/** Klucz okna o danym założeniu (n-te w kolejności przechodzenia). */
function boxKey(assumption, nth = 0) {
  const a = F.parse(assumption);
  const keys = [...st.boxes].filter(([, b]) => F.eq(b.b.a, a)).map(([k]) => k);
  assert.ok(keys[nth], `brak okna z założeniem ${assumption}`);
  return keys[nth];
}
const factsIn = k => Proof.factsOf(st.boxes.get(k).b).map(w => F.text(w.f));
const factKey = (k, text) => `f:${k}:${Proof.factsOf(st.boxes.get(k).b).findIndex(w => F.eq(w.f, F.parse(text)))}`;
const complete = (i = 0) => S.status(st.frags[i]).complete;
const plain = () => JSON.stringify(st.frags.map(Proof.toPlain));

/* ---------- podstawowy przypadek z prośby: z p ∧ q wnioski p oraz q ---------- */

test('z założenia p ∧ q powstają wnioski p (∧e₁) i q (∧e₂), a cele p i q zamykają się same', () => {
  start('p & q -> q & p');
  back('p & q -> q & p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  const av = A.availability();
  assert.deepEqual(av.available.sort(), ['andE1', 'andE2', 'orI1', 'orI2'].sort());
  A.apply('andE1');
  A.apply('andE2');                                   // zaznaczenie zostaje — drugi wniosek od razu
  assert.deepEqual(factsIn(k), ['p', 'q']);
  assert.deepEqual(st.picks, [`a:${k}`]);
  assert.match(toasts.join(' '), /Nowy wniosek: p/);
  back('q & p', 'andI');
  assert.ok(complete(), 'cele q i p zamknięte wnioskami');
  assert.equal(st.errors.size, 0);
  // w dowodzie są prawdziwe kroki (∧e) nad założeniem — to nadal dowód w systemie ze skryptu
  const tree = Proof.toPlain(st.frags[0]);
  assert.deepEqual(tree.p[0].b.p.map(x => [x.f, x.r, x.p[0].r]), [['q', 'andE2', 'hyp'], ['p', 'andE1', 'hyp']]);
  assert.equal(Rules.verify(st.frags).size, 0);
  assert.match(Render.proseText(Explain.prose(st.frags[0])), /z definicji koniunkcji/);
});

test('bez automatycznego zamykania: cel równy wnioskowi zamyka reguła „założenie”', () => {
  start('p & q -> q & p', { autoHyp: false });
  back('p & q -> q & p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  back('q & p', 'andI');
  assert.ok(!complete());
  const goalP = [...st.idx.values()].find(i => Proof.isOpen(i.n) && F.eq(i.n.f, F.parse('p')));
  S.select([goalP.n.id]);
  assert.equal(st.picks.length, 0, 'zaznaczenie celu kasuje zaznaczenie założeń');
  assert.equal(A.availability().reasons.get('hyp'), null);
  A.apply('hyp');
  assert.equal(st.idx.get(goalP.n.id).n.rule, 'andE1');
  const goalQ = [...st.idx.values()].find(i => Proof.isOpen(i.n));
  S.select([goalQ.n.id]);
  assert.match(A.availability().reasons.get('hyp'), /nie jest założeniem ani wnioskiem/);
});

/* ---------- reguły z dwiema przesłankami, łańcuchy wniosków ---------- */

test('(⇒e) z dwóch wniosków: z (p ⇒ q) ∧ p najpierw p ⇒ q i p, potem q', () => {
  start('(p -> q) & p -> q');
  back('(p -> q) & p -> q', 'impI');
  const k = boxKey('(p -> q) & p');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  A.apply('andE2');
  S.pick([factKey(k, 'p -> q'), factKey(k, 'p')]);
  assert.ok(A.availability().available.includes('impE'));
  A.apply('impE');
  assert.deepEqual(factsIn(k), ['p ⇒ q', 'p', 'q']);
  assert.ok(complete(), 'cel q zamknął wniosek');
  assert.equal(st.errors.size, 0);
  const q = Proof.factsOf(st.boxes.get(k).b)[2];
  assert.equal(q.rule, 'impE');
  assert.deepEqual(q.prem.map(n => n.rule), ['andE2', 'andE1']);   // kolejność jak w regule: α, α ⇒ β
});

test('(¬e) i (⊥e): z p i ¬p wniosek ⊥, a z niego dowolna formuła (parametr z kreatora)', async () => {
  start('p & ~p -> q');
  back('p & ~p -> q', 'impI');
  const k = boxKey('p & ~p');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  A.apply('andE2');
  S.pick([factKey(k, '~p'), factKey(k, 'p')]);
  A.apply('notE');
  S.pick([factKey(k, 'F')]);
  answer = F.parse('q');
  await A.apply('botE');
  answer = null;
  assert.deepEqual(factsIn(k), ['p', '¬p', '⊥', 'q']);
  assert.ok(complete());
  assert.equal(st.errors.size, 0);
});

test('okna zagnieżdżone: z założeń obu okien wniosek trafia do wewnętrznego', () => {
  start('p -> q -> p & q');
  back('p -> q -> p & q', 'impI');
  back('q -> p & q', 'impI');
  const outer = boxKey('p'), inner = boxKey('q');
  S.pick([`a:${outer}`, `a:${inner}`]);
  A.apply('andI');
  assert.deepEqual(factsIn(inner), ['p ∧ q']);
  assert.deepEqual(factsIn(outer), []);
  assert.ok(complete());
});

test('formuły z sąsiednich okien: odmowa z wyjaśnieniem', () => {
  start('(p -> p) & (q -> q)');
  back('(p -> p) & (q -> q)', 'andI');
  back('p -> p', 'impI');
  back('q -> q', 'impI');
  S.pick([`a:${boxKey('p')}`, `a:${boxKey('q')}`]);
  const av = A.availability();
  assert.deepEqual(av.available, []);
  assert.match(av.reasons.get('andI'), /różnych oknach/);
});

test('reguły z oknem lub celem nie służą do wniosków; powtórzony wniosek jest odrzucany', () => {
  start('p & q -> p');
  back('p & q -> p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  const av = A.availability();
  for (const id of ['impI', 'notI', 'orE', 'topI', 'hyp']) assert.ok(av.reasons.get(id), id);
  A.apply('andE2');
  const before = plain();
  A.apply('andE2');
  assert.equal(plain(), before);
  assert.match(toasts.join(' '), /jest już założeniem albo wnioskiem/);
});

test('(∨i) z parametrem; wniosek z wniosku', async () => {
  start('p & q -> (r | q)');
  back('p & q -> r | q', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  A.apply('andE2');
  S.pick([factKey(k, 'q')]);
  answer = F.parse('r');
  await A.apply('orI2');
  answer = null;
  assert.deepEqual(factsIn(k), ['q', 'r ∨ q']);
  assert.ok(complete());
  assert.equal(st.errors.size, 0);
});

/* ---------- zapis, historia, porządki ---------- */

test('wnioski są w zapisie (link, autozapis) i w historii', () => {
  start('p & q -> q & p');
  back('p & q -> q & p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  const saved = plain();
  assert.match(saved, /"w":\[\{"f":"p","r":"andE1"/);
  const back2 = Proof.fromPlain(JSON.parse(saved), Rules.isRule);
  assert.deepEqual(Proof.factsOf(back2[0].prem[0]).map(w => F.text(w.f)), ['p']);
  S.undo();
  assert.deepEqual(factsIn(boxKey('p & q')), []);
  S.redo();
  assert.deepEqual(factsIn(boxKey('p & q')), ['p']);
});

test('niepoprawne wnioski (np. z linku) są usuwane, poprawne zostają', () => {
  S.setAutoHyp(true);
  const data = [{ f: 'p&q->q&p', r: 'impI', p: [{ a: 'p&q', b: { f: 'q&p' }, w: [
    { f: 'q', r: 'andE2', p: [{ f: 'p&q', r: 'hyp' }] },
    { f: 'r', r: 'andE1', p: [{ f: 'r&q', r: 'hyp' }] },     // r ∧ q nie jest założeniem
    { f: 'p' },                                               // brak wyprowadzenia
  ] }] }];
  S.commit(() => { st.frags = Proof.fromPlain(data, Rules.isRule); return true; }, { select: () => [] });
  assert.deepEqual(factsIn(boxKey('p & q')), ['q']);
  assert.throws(() => Proof.fromPlain([{ f: 'p->p', r: 'impI', p: [{ a: 'p', b: { f: 'p', r: 'hyp' }, w: 'x' }] }], Rules.isRule), Proof.FormatError);
});

test('okno odcięte od założenia, z którego powstał wniosek: wniosek znika', () => {
  start('p -> q -> p & q');
  back('p -> q -> p & q', 'impI');
  back('q -> p & q', 'impI');
  S.pick([`a:${boxKey('p')}`, `a:${boxKey('q')}`]);
  A.apply('andI');
  assert.ok(complete());
  // cofnięcie zewnętrznego (⇒i): wnętrze zostaje osobnym fragmentem, bez założenia p
  S.select([st.frags[0].id]);
  assert.ok(A.runOp('step'));
  const k = boxKey('q');
  assert.deepEqual(factsIn(k), [], 'wniosek p ∧ q korzystał z założenia p');
  assert.equal(st.errors.size, 0);
});

test('usuwanie wniosku (Delete przy zaznaczonym wniosku), cele zostają uzasadnione', () => {
  start('p & q -> p');
  back('p & q -> p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  assert.ok(complete());
  S.pick([factKey(k, 'p')]);
  assert.deepEqual(A.offeredOps().map(o => o.name), ['dropFact']);
  assert.ok(A.runOp('step'));
  assert.deepEqual(factsIn(k), []);
  assert.ok(complete(), 'cel zamknięty wcześniej ma nadal swoje wyprowadzenie');
  assert.equal(st.picks.length, 0);
});

test('„Cofnij krok” przy celu zamkniętym wnioskiem cofa krok, z którego cel powstał', () => {
  start('p & q -> q & p');
  back('p & q -> q & p', 'impI');
  const k = boxKey('p & q');
  S.pick([`a:${k}`]);
  A.apply('andE1');
  A.apply('andE2');
  back('q & p', 'andI');
  const q = [...st.idx.values()].find(i => i.n.rule === 'andE2');
  S.select([q.n.id]);
  const [step] = A.offeredOps();
  assert.equal(step.name, 'step');
  assert.equal(st.idx.get(step.target).n.rule, 'andI');
  // także z liścia-założenia wewnątrz wstawionego wyprowadzenia
  const leaf = [...st.idx.values()].find(i => i.n.rule === 'hyp');
  S.select([leaf.n.id]);
  assert.equal(st.idx.get(A.offeredOps()[0].target).n.rule, 'andI');
});

test('wnioski liczą się do limitów rozmiaru', () => {
  start('p & q -> p');
  back('p & q -> p', 'impI');
  const before = Proof.stats(st.frags).nodes;
  S.pick([`a:${boxKey('p & q')}`]);
  A.apply('andE2');
  assert.equal(Proof.stats(st.frags).nodes, before + 2);
});

test('wnioski działają też w trybie „od przesłanek” (w oknach fragmentów)', () => {
  start('p & q -> q', { mode: 'back' });
  back('p & q -> q', 'impI');
  S.setMode('fwd');
  S.pick([`a:${boxKey('p & q')}`]);
  A.apply('andE2');
  assert.ok(complete());
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
  }
  if (failures.length) {
    console.error(failures.join('\n\n'));
    console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
    process.exit(1);
  }
  console.log(`✓ wszystkie testy wniosków przeszły (${passed})`);
})();
