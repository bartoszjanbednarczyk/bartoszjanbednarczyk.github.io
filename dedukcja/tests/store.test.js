/* =====================================================================
   Testy modułu stanu (bez przeglądarki):  node dedukcja/tests/store.test.js
   commit() z limitami i wycofywaniem, historia, odczyt zapisu i linków.
   Komunikaty, localStorage i adres strony są zastąpione prostymi atrapami.
   ===================================================================== */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

const memory = new Map();
const toasts = [];
let storageWorks = true;
globalThis.location = { hash: '' };
globalThis.ND = {};
for (const f of ['formula', 'text', 'proof', 'rules']) require(path.join(__dirname, '..', 'js', f + '.js'));
require(path.join(__dirname, '..', 'js', 'ui', 'kit.js'));
// prawdziwe narzędzia, ale komunikaty i localStorage zastąpione atrapami
globalThis.ND.UI.kit = {
  ...globalThis.ND.UI.kit,
  toast: m => toasts.push(m),
  storage: {
    get: k => (memory.has(k) ? memory.get(k) : null),
    set: (k, v) => { if (!storageWorks) return false; memory.set(k, String(v)); return true; },
    available: () => storageWorks,
  },
};
require(path.join(__dirname, '..', 'js', 'ui', 'store.js'));
const ND = globalThis.ND;
const { F, Proof } = ND;
const S = globalThis.ND.UI.store, st = S.state;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}
const reset = () => { st.frags = []; st.sel = []; memory.clear(); toasts.length = 0; location.hash = ''; storageWorks = true; S.refresh(); };
const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Fragment-łańcuch o n węzłach: p ⇐(¬¬e) ¬¬p ⇐(¬¬e) ¬¬¬¬p ⇐ …; ostatni liść jest otwartym celem. */
function plainChain(n) {
  let o = { f: '~~'.repeat(n - 1) + 'p' };
  for (let i = n - 2; i >= 0; i--) o = { f: '~~'.repeat(i) + 'p', r: 'nnE', p: [o] };
  return o;
}

test('linki działów: #d=, #q=, #r= (znaki doklejone na końcu pomijane), inne adresy to nie linki', () => {
  assert.deepEqual(S.parseLink('#d=abc.'), { system: 'prop', data: 'abc' });
  assert.deepEqual(S.parseLink('#q=x-y_z'), { system: 'fo', data: 'x-y_z' });
  assert.deepEqual(S.parseLink('#r=!!!'), { system: 'res', data: null });
  for (const h of ['', '#', '#x=abc', '#top', '#dd=abc']) assert.equal(S.parseLink(h), null, h);
  assert.match(S.linkHash('res', '{"c":["p"]}'), /^#r=[\w-]+$/);
});

test('przełączanie działów zachowuje dowody i historię każdego rachunku osobno', () => {
  reset();
  S.setSystem('prop');
  S.commit(() => { st.frags.push(Proof.node(F.parse('p -> p'))); return true; });
  S.setSystem('fo');
  assert.equal(S.logic(), 'fo');
  assert.equal(st.frags.length, 0);
  assert.equal(S.canUndo(), false);
  S.commit(() => { st.frags.push(Proof.node(F.parse('Ax p(x) -> p(a)', { logic: 'fo' }))); return true; });
  S.setSystem('res');
  assert.equal(S.logic(), 'fo', 'rezolucja nie zmienia rachunku dedukcji');
  S.setSystem('prop');
  assert.deepEqual(st.frags.map(r => F.text(r.f)), ['p ⇒ p']);
  S.undo();
  assert.equal(st.frags.length, 0);
  S.setSystem('fo');
  assert.deepEqual(st.frags.map(r => F.text(r.f)), ['(∀x p(x)) ⇒ p(a)']);
  assert.ok(memory.get('nd-fo-proof').includes('p(a)'));
  S.setSystem('prop');
});

test('commit zapisuje zmianę w historii; cofnij/ponów odtwarzają stan', () => {
  reset();
  assert.ok(S.commit(() => { st.frags.push(Proof.node(F.parse('p -> p'))); return true; }));
  assert.equal(st.frags.length, 1);
  S.undo();
  assert.equal(st.frags.length, 0);
  S.redo();
  assert.equal(st.frags.length, 1);
});

test('przekroczenie limitu fragmentów cofa zmianę i nie psuje historii', () => {
  reset();
  S.commit(() => { st.frags.push(Proof.node(F.parse('p'))); return true; });
  const changed = S.commit(() => { for (let i = 0; i < Proof.LIMITS.fragments + 5; i++) st.frags.push(Proof.node(F.parse('q'))); return true; });
  assert.equal(changed, false);
  assert.equal(st.frags.length, 1);
  assert.match(toasts.join(' '), /Za dużo fragmentów/);
  S.undo();
  assert.equal(st.frags.length, 0);
});

test('zbyt duża formuła z reguły cofa krok', () => {
  reset();
  let big = F.V('p');
  for (let i = 0; i < 80; i++) big = F.AND(big, F.V('q'));
  const changed = S.commit(() => { st.frags.push(Proof.node(big)); return true; });
  assert.equal(changed, false);
  assert.equal(st.frags.length, 0);
});

test('wyjątek w trakcie zmiany przywraca poprzedni stan', () => {
  reset();
  S.commit(() => { st.frags.push(Proof.node(F.parse('p'))); return true; });
  assert.throws(() => S.commit(() => { st.frags = []; throw new Error('boom'); }));
  assert.equal(st.frags.length, 1);
});

test('link dołącza tylko to, co mieści się w limitach (bez przekroczenia i utraty pracy)', () => {
  reset();
  const fragments = Array.from({ length: 36 }, () => plainChain(40));          // 1440 węzłów
  memory.set('nd-proof', JSON.stringify(fragments));
  location.hash = '#d=' + b64(JSON.stringify([plainChain(70), plainChain(10)]));   // 70 się nie zmieści, 10 tak
  const source = S.load();
  assert.equal(source, 'link');
  assert.equal(st.frags.length, 37);
  assert.ok(Proof.stats(st.frags).nodes <= Proof.LIMITS.nodes);
  assert.match(toasts.join(' '), /nie zmieścił/);
  // po przeładowaniu zapis wciąż jest czytelny
  location.hash = '';
  S.load();
  assert.equal(st.frags.length, 37);
});

test('ponowne otwarcie tego samego linku nie dubluje fragmentów', () => {
  reset();
  location.hash = '#d=' + b64('[{"f":"q>q"}]');
  S.load();
  S.load();
  assert.equal(st.frags.length, 1);
  location.hash = '';
});

test('nieczytelny zapis trafia do kopii zapasowej zamiast przepaść', () => {
  reset();
  memory.set('nd-proof', '[{"f":"p","r":"nieznana"}]');
  const source = S.load();
  assert.equal(source, 'empty');
  assert.equal(memory.get('nd-proof-backup'), '[{"f":"p","r":"nieznana"}]');
  assert.match(toasts.join(' '), /kopię zapasową/);
});

test('łańcuchy z testów są poprawnymi (otwartymi) dowodami', () => {
  reset();
  st.frags = Proof.fromPlain([plainChain(5)], ND.Rules.isRule);
  S.refresh();
  assert.equal(st.errors.size, 0);
  assert.equal(Proof.openLeaves(st.frags[0]).length, 1);
});

test('zbyt długi link nie powstaje — shareHash zwraca null zamiast linku, którego nie da się otworzyć', () => {
  reset();
  const big = F.parse(Array.from({ length: 70 }, (_, i) => 'pqrst'[i % 5]).join(' & '));
  st.frags = Array.from({ length: 2500 }, () => Proof.node(big));     // stan ustawiony z pominięciem limitów
  assert.equal(S.shareHash(), null);
  st.frags = [Proof.node(big)];
  assert.match(S.shareHash(), /^#d=[\w-]+$/);
});

test('włączenie automatycznego zamykania celów jest krokiem historii (cofnięcie przywraca cele i ustawienie)', () => {
  reset();
  S.setPref('autoHyp', false);
  const p = F.parse('p');
  S.commit(() => { st.frags.push(Proof.node(F.parse('p -> p'), 'impI', [Proof.box(p, Proof.node(p))])); return true; });
  assert.equal(Proof.openLeaves(st.frags[0]).length, 1);
  const events = [];
  S.on('prefs', () => events.push(S.prefs.autoHyp));
  S.setAutoHyp(true);
  assert.equal(Proof.openLeaves(st.frags[0]).length, 0);
  S.undo();
  assert.equal(S.prefs.autoHyp, false);
  assert.equal(Proof.openLeaves(st.frags[0]).length, 1);
  S.redo();
  assert.equal(S.prefs.autoHyp, true);
  assert.equal(Proof.openLeaves(st.frags[0]).length, 0);
  assert.deepEqual(events, [true, false, true]);
});

test('ten sam link otwarty dwa razy nie dubluje fragmentu, także gdy cel zamyka się automatycznie', () => {
  reset();
  S.setPref('autoHyp', true);
  location.hash = '#d=' + b64('[{"f":"p>p","r":"impI","p":[{"a":"p","b":{"f":"p"}}]}]');
  S.load();
  S.load();
  assert.equal(st.frags.length, 1);
  assert.equal(S.status(st.frags[0]).complete, true);
});

test('link z doklejonymi znakami (np. kropką z czatu) jest wczytywany', () => {
  reset();
  location.hash = '#d=' + b64('[{"f":"q>q"}]') + '.';
  assert.equal(S.load(), 'link');
  assert.equal(st.frags.length, 1);
});

test('link otwarty w działającej aplikacji można cofnąć', () => {
  reset();
  S.commit(() => { st.frags.push(Proof.node(F.parse('p'))); return true; });
  const result = S.openLink('#d=' + b64('[{"f":"q"}]'));
  assert.equal(result.ok, true);
  assert.equal(st.frags.length, 2);
  S.undo();
  assert.equal(st.frags.length, 1);
  assert.equal(S.openLink('#x'), null);
  assert.equal(S.openLink('#d=%%%').ok, false);
});

test('wstawienie kompletnego fragmentu w ostatni cel świętuje ukończenie dowodu', () => {
  reset();
  let celebrated = 0;
  S.on('complete', () => celebrated++);
  const q = F.parse('q -> q');
  S.commit(() => {
    st.frags.push(Proof.node(F.parse('(q -> q) & T'), 'andI', [Proof.node(q), Proof.node(F.TOP, 'topI')]));
    st.frags.push(Proof.node(q, 'impI', [Proof.box(F.parse('q'), Proof.node(F.parse('q'), 'hyp'))]));
    return true;
  });
  const goal = st.idx.get(st.frags[0].prem[0].id);
  S.commit(() => { Proof.replaceAt(st.frags, goal, st.frags[1]); st.frags.splice(1, 1); return true; }, { celebrate: true });
  assert.equal(st.frags.length, 1);
  assert.equal(celebrated, 1);
});

test('gdy przeglądarka nie zapisuje pracy, użytkownik dostaje jedno ostrzeżenie', () => {
  reset();
  storageWorks = false;
  S.commit(() => { st.frags.push(Proof.node(F.parse('p'))); return true; });
  S.commit(() => { st.frags.push(Proof.node(F.parse('q'))); return true; });
  assert.equal(S.persistent(), false);
  assert.equal(toasts.filter(t => /nie pozwala zapisać/.test(t)).length, 1);
  storageWorks = true;
  S.commit(() => { st.frags.push(Proof.node(F.parse('r'))); return true; });
  assert.equal(S.persistent(), true);
});

test('zmiana zapisu w innej karcie jest przejmowana (zamiast nadpisania przy następnej zmianie)', () => {
  reset();
  S.commit(() => { st.frags.push(Proof.node(F.parse('p'))); return true; });
  const other = '[{"f":"p"},{"f":"q>q"}]';
  S.onStorageEvent({ key: 'nd-proof', newValue: other });
  assert.equal(st.frags.length, 2);
  assert.equal(S.canUndo(), false);
  assert.match(toasts.join(' '), /innej karcie/);
  S.onStorageEvent({ key: 'nd-proof', newValue: '[{"f":"p","r":"nieznana"}]' });   // nieczytelny zapis — bez zmian
  assert.equal(st.frags.length, 2);
});

test('rachunek kwantyfikatorów: krok, po którym zapisu nie dałoby się odczytać, jest cofany', () => {
  reset();
  S.setSystem('fo');
  try {
    const FO = s => F.parse(s, { logic: 'fo' });
    S.commit(() => { st.frags = [Proof.node(FO('p(a)'))]; return true; });
    // (⇒e) z α = p dla celu p(a): przesłanka p ⇒ p(a) ma symbol p z różną liczbą argumentów
    const before = Proof.serialize(st.frags);
    assert.equal(S.commit(() => { const g = st.frags[0]; g.rule = 'impE'; g.prem = [Proof.node(F.ATOM('p')), Proof.node(F.IMP(F.ATOM('p'), g.f))]; return true; }), false);
    assert.equal(Proof.serialize(st.frags), before);
    assert.match(toasts.join(' '), /Symbol p miałby w jednym dowodzie różną liczbę argumentów/);
    // kolizja w osobnych formułach jednego fragmentu też jest odrzucana: (∨e) z alternatywą p ∨ q dla celu p(a)
    toasts.length = 0;
    const orE = ND.Rules.get('orE');
    assert.equal(S.commit(() => { const g = st.frags[0]; g.rule = 'orE'; g.prem = ND.Rules.materialize(orE.back.premises(g.f, F.OR(F.ATOM('p'), F.ATOM('q')))); return true; }), false);
    assert.match(toasts.join(' '), /Symbol p/);
    assert.equal(Proof.serialize(st.frags), before);
    // formuła mieszcząca się w limicie węzłów, ale nie w limicie parsera (kwantyfikator to dwa symbole)
    toasts.length = 0;
    const deep = FO('Ax0 '.repeat(70) + 'p(x0)');
    assert.equal(S.commit(() => { st.frags.push(Proof.node(F.AND(deep, deep))); return true; }), false);
    assert.match(toasts.join(' '), /zbyt duża formuła/);
    // wszystko, co zostało zapisane, daje się odczytać
    assert.ok(Proof.deserialize(memory.get('nd-fo-proof'), ND.Rules.isRule, { logic: 'fo' }));
  } finally { S.setSystem('prop'); }
});

test('starszy zapis z kolizją liczby argumentów wczytuje się, a kolejne kroki działają', () => {
  reset();
  S.onStorageEvent({ key: 'nd-fo-proof', newValue: '[{"f":"p>p(a)"}]' });   // odłożona praca zmieniona gdzie indziej
  memory.set('nd-fo-proof', '[{"f":"p>p(a)"}]');
  S.setSystem('fo');
  try {
    assert.equal(st.frags.length, 1);
    assert.ok(S.commit(() => { st.frags.push(Proof.node(F.parse('q', { logic: 'fo' }))); return true; }));
    S.undo();
    assert.equal(st.frags.length, 1);
  } finally { S.setSystem('prop'); }
});

test('link z danymi w złym formacie: komunikat o nieczytelnym linku (nie „za duży”)', () => {
  reset();
  for (const data of ['{"f":"p"}', 'null', '"x"']) {
    const r = S.openLink('#d=' + b64(data));
    assert.equal(r.ok, false);
    assert.match(r.message, /Nie udało się odczytać/, data);
  }
});

test('wynik zapisu osobno dla dedukcji i rezolucji', () => {
  reset();
  S.noteSaved(false, 'nd');
  S.noteSaved(true, 'res');
  assert.equal(S.persistent(), false);
  assert.equal(S.persistent('res'), true);
  S.noteSaved(true);
  assert.equal(S.persistent(), true);
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy stanu przeszły (${passed})`);
