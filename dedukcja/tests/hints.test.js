/* =====================================================================
   Testy podpowiedzi (bez przeglądarki):  node dedukcja/tests/hints.test.js
   Zadania przykładowe: podpowiedzi prowadzą do końca dowodu. Zadania ze skryptu
   i własne formuły: podpowiedź się nie włącza. Dowód z samouczka: działa.
   Komunikaty, localStorage i elementy strony są zastąpione atrapami.
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
const button = {   // atrapa przycisku „Podpowiedź” z górnego paska
  cls: new Set(), attrs: {}, title: '',
  classList: { toggle(c, on) { if (on) button.cls.add(c); else button.cls.delete(c); } },
  setAttribute(k, v) { button.attrs[k] = v; },
};
globalThis.ND.UI.kit = {
  ...globalThis.ND.UI.kit,
  $: id => (id === 'hintBtn' ? button : null),
  toast: m => toasts.push(m),
  storage: { get: k => (memory.has(k) ? memory.get(k) : null), set: (k, v) => { memory.set(k, String(v)); return true; }, available: () => true },
};
js('ui/store');
js('ui/hints');
js('ui/actions');
const ND = globalThis.ND;
ND.UI.workspace = { reveal() {}, revealFragment() {} };
const TUTORIAL = ND.F.parse('p & q -> q & p');
ND.UI.tutorial = { isTutorialProof: root => ND.F.eq(root.f, TUTORIAL) };   // jak w ui/tutorial.js
const { F, Proof, Rules, Prover, Examples } = ND;
const S = ND.UI.store, A = ND.UI.actions, H = ND.UI.hints, st = S.state;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}

const LOCKED = /tylko w zadaniach przykładowych/;
const byGroup = g => Examples.LIST.map((e, i) => [e, i]).filter(([e]) => e.group === g);
const SAMPLES = byGroup('przyk');

function reset({ mode = 'back', autoHyp = true } = {}) {
  S.setAutoHyp(autoHyp);
  S.setMode(mode);
  S.commit(() => { st.frags = []; return true; }, { select: () => [] });
  st.hint = null;
  toasts.length = 0;
}
const addGoal = text => A.addFragment(Proof.node(F.parse(text)), { select: false });
const complete = i => S.status(st.frags[i]).complete;

/** Naciska H aż do końca dowodu (albo do limitu); zwraca liczbę naciśnięć. */
function solveWithHints(limit = 400) {
  let presses = 0;
  while (st.frags.some(r => Proof.openLeaves(r).length) && presses < limit) {
    H.press();
    presses++;
    assert.ok(!st.hint || !st.hint.dead, 'podpowiedź nie może prowadzić w ślepy zaułek');
    assert.ok(!st.hint || !st.hint.fail, 'dowodzący musi znaleźć podpowiedź');
  }
  return presses;
}

/* ---------- lista zadań przykładowych ---------- */

test('jest dokładnie 10 zadań przykładowych, a ich grupa jest pierwsza w menu', () => {
  assert.equal(SAMPLES.length, 10);
  assert.equal(Examples.GROUPS[0].id, 'przyk');
  assert.equal(Examples.SAMPLES.length, 10);
});

test('zadania przykładowe pochodzą z kolokwiów i egzaminów', () => {
  SAMPLES.forEach(([e]) => assert.match(e.title, /^(Kolokwium|Egzamin|Poprawka) /, e.title));
});

test('zadania przykładowe są różne, nie powtarzają się w innych grupach i nie są zadaniami ze skryptu', () => {
  const keys = SAMPLES.map(([e]) => F.key(F.parse(e.formula)));
  assert.equal(new Set(keys).size, 10);
  Examples.LIST.filter(e => e.group !== 'przyk').forEach(e => {
    assert.equal(Examples.isSample(F.parse(e.formula)), false, `${e.title} (${e.group}) nie może mieć podpowiedzi`);
  });
});

test('zadania przykładowe są tautologiami, a dowodzący znajduje dla nich poprawne dowody', () => {
  SAMPLES.forEach(([e]) => {
    const f = F.parse(e.formula);
    assert.equal(F.countermodel([], f), null, e.title);
    const pf = Prover.prove([], f);
    assert.ok(pf, `brak dowodu: ${e.title}`);
    assert.equal(Rules.verify([Proof.fromPlain([Proof.toPlain(pf)], Rules.isRule)[0]]).size, 0, `błędny dowód: ${e.title}`);
  });
});

/* ---------- podpowiedzi działają w zadaniach przykładowych ---------- */

for (const autoHyp of [true, false]) {
  test(`każde zadanie przykładowe da się rozwiązać samymi podpowiedziami (autoHyp: ${autoHyp})`, () => {
    SAMPLES.forEach(([e, i]) => {
      reset({ autoHyp });
      A.loadExample(i);
      solveWithHints();
      assert.equal(st.frags.length, 1, e.title);
      assert.ok(complete(0), `niekompletny dowód: ${e.title}`);
      assert.equal(st.errors.size, 0, e.title);
      assert.ok(!toasts.some(t => LOCKED.test(t)), e.title);
    });
  });
}

test('trzy poziomy: wskazówka → reguła → wykonanie kroku', () => {
  reset();
  A.loadExample(SAMPLES[1][1]);
  const root = st.frags[0];
  H.press();
  assert.equal(st.hint.level, 1);
  assert.equal(H.hintedRule(), null);
  H.press();
  assert.equal(st.hint.level, 2);
  assert.equal(H.hintedRule(), 'impI');
  H.press();
  assert.equal(root.rule, 'impI');
});

test('przycisk jest aktywny, gdy w obszarze jest zadanie przykładowe (także po wpisaniu jego formuły ręcznie)', () => {
  reset();
  addGoal(SAMPLES[0][0].formula);
  H.syncButton();
  assert.equal(button.cls.has('off'), false);
  assert.equal(button.attrs['aria-disabled'], 'false');
  H.press();
  assert.ok(st.hint && st.hint.step);
});

/* ---------- podpowiedzi nie działają w zadaniach ze skryptu ---------- */

test('zadania ze skryptu (rozdział 2.9, zadanie 41): podpowiedź się nie włącza', () => {
  [...byGroup('s29'), ...byGroup('z41')].forEach(([e, i]) => {
    reset();
    A.loadExample(i);
    const before = JSON.stringify(st.frags.map(Proof.toPlain));
    H.press(); H.press(); H.press();
    assert.equal(st.hint, null, e.title);
    assert.equal(JSON.stringify(st.frags.map(Proof.toPlain)), before, `podpowiedź zmieniła dowód: ${e.title}`);
    assert.match(toasts.join(' '), LOCKED, e.title);
    H.syncButton();
    assert.ok(button.cls.has('off'), e.title);
    assert.equal(button.attrs['aria-disabled'], 'true');
    assert.match(button.title, LOCKED);
  });
});

test('pozostałe zadania z kolokwiów i egzaminów oraz gotowe dowody: bez podpowiedzi', () => {
  [...byGroup('kol'), ...byGroup('egz'), ...byGroup('demo')].forEach(([e, i]) => {
    reset();
    A.loadExample(i);
    assert.equal(H.available(), false, e.title);
  });
  reset();
  A.loadExample(byGroup('kol')[0][1]);
  H.press();
  assert.equal(st.hint, null);
});

test('własna formuła: bez podpowiedzi', () => {
  reset();
  addGoal('p -> p');
  H.press();
  assert.equal(st.hint, null);
  assert.match(toasts.join(' '), LOCKED);
});

test('w trybie „od przesłanek” zablokowana podpowiedź nie przełącza trybu', () => {
  reset({ mode: 'fwd' });
  addGoal(byGroup('s29')[0][0].formula);
  H.press();
  assert.equal(st.mode, 'fwd');
  assert.equal(st.hint, null);
});

test('zadanie ze skryptu i przykładowe naraz: bez zaznaczenia podpowiedź trafia do przykładowego', () => {
  reset();
  addGoal(byGroup('s29')[0][0].formula);
  addGoal(SAMPLES[2][0].formula);
  H.press();
  assert.ok(st.hint && st.hint.step);
  assert.equal(st.idx.get(st.hint.goalId).fi, 1);
  // zaznaczony cel w zadaniu ze skryptu — odmowa
  S.select([st.frags[0].id]);
  toasts.length = 0;
  H.press();
  assert.equal(st.hint, null);
  assert.equal(st.frags[0].rule, null);
  assert.match(toasts.join(' '), LOCKED);
  // rozwiązanie podpowiedziami kończy tylko zadanie przykładowe
  S.select([]);
  toasts.length = 0;
  solveWithHints();
  assert.ok(complete(1));
  assert.equal(st.frags[0].rule, null);
  assert.match(toasts.join(' '), LOCKED);
});

test('pasek akcji proponuje podpowiedź tylko dla celu z zadania przykładowego', () => {
  reset();
  addGoal(byGroup('z41')[0][0].formula);
  addGoal(SAMPLES[0][0].formula);
  assert.equal(H.allowedFor(st.idx.get(st.frags[0].id)), false);
  assert.equal(H.allowedFor(st.idx.get(st.frags[1].id)), true);
});

test('dowód z samouczka ma podpowiedzi', () => {
  reset();
  addGoal('p & q -> q & p');
  solveWithHints();
  assert.ok(complete(0));
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy podpowiedzi przeszły (${passed})`);
