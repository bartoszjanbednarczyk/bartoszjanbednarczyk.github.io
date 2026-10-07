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
  assert.match(toasts.join(' '), /kopia/);
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
  assert.match(toasts.join(' '), /innej karty/);
  S.onStorageEvent({ key: 'nd-proof', newValue: '[{"f":"p","r":"nieznana"}]' });   // nieczytelny zapis — bez zmian
  assert.equal(st.frags.length, 2);
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy stanu przeszły (${passed})`);
