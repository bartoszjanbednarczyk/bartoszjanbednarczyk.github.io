/* =====================================================================
   Testy rdzenia aplikacji (bez przeglądarki):  node dedukcja/tests/core.test.js
   Formuły, reguły, weryfikacja, dowodzący, dowód słowny, układ obrazka
   oraz odporność na złośliwe dane (linki, localStorage).
   ===================================================================== */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

for (const f of ['formula', 'text', 'proof', 'rules', 'prover', 'explain', 'render', 'export', 'examples']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const { F, Proof, Rules, Prover, Explain, Render, Export, Examples } = globalThis.ND;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}

/* ---------- pomocnicze ---------- */

/** Deterministyczny generator liczb pseudolosowych (powtarzalne testy). */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function randomFormula(rand, depth) {
  if (depth === 0 || rand() < 0.25) {
    const leaves = [...F.VARS, 'a', 'T', 'F'];
    const x = leaves[Math.floor(rand() * leaves.length)];
    return x === 'T' ? F.TOP : x === 'F' ? F.BOT : F.V(x);
  }
  const k = rand();
  if (k < 0.2) return F.NOT(randomFormula(rand, depth - 1));
  const make = k < 0.47 ? F.AND : k < 0.74 ? F.OR : F.IMP;
  return make(randomFormula(rand, depth - 1), randomFormula(rand, depth - 1));
}
const proofOf = formula => {
  const pf = Prover.prove([], formula);
  return pf && Proof.fromPlain([Proof.toPlain(pf)], Rules.isRule)[0];
};
const exampleRoots = () => Examples.LIST.map(ex => (ex.proof ? ex.proof() : proofOf(F.parse(ex.formula))));

/* ---------- formuły ---------- */

test('wypisywanie i ponowne czytanie daje tę samą formułę (losowe formuły)', () => {
  const rand = rng(42);
  for (let i = 0; i < 500; i++) {
    const f = randomFormula(rand, 5);
    assert.ok(F.eq(F.parse(F.text(f)), f), F.text(f));
    assert.ok(F.eq(F.parse(F.key(f)), f), F.key(f));
  }
});

test('nawiasy tylko tam, gdzie trzeba', () => {
  const cases = { 'p -> q -> r': 'p ⇒ q ⇒ r', '(p -> q) -> r': '(p ⇒ q) ⇒ r', 'p & q | r': 'p ∧ q ∨ r', 'p & (q | r)': 'p ∧ (q ∨ r)', '~~p': '¬¬p', '~(p & q)': '¬(p ∧ q)', 'p | q | r': 'p ∨ q ∨ r', 'p | (q | r)': 'p ∨ (q ∨ r)' };
  for (const [src, out] of Object.entries(cases)) assert.equal(F.text(F.parse(src)), out);
});

test('parser: komunikaty błędów i limity', () => {
  const bad = ['', 'p &', '(p', 'p)', 'x', 'p q', '<img src=x onerror=alert(1)>', 'p'.repeat(700), Array(200).fill('p').join('&'), null, 42];
  for (const src of bad) assert.throws(() => F.parse(src), F.ParseError, String(src).slice(0, 20));
  assert.equal(F.text(F.parse('p => q /\\ r \\/ ~s')), 'p ⇒ q ∧ r ∨ ¬s');
  assert.equal(F.text(F.parse('1 & 0 > T')), '⊤ ∧ ⊥ ⇒ ⊤');
});

test('kontrprzykład i wynikanie', () => {
  assert.equal(F.countermodel([], F.parse('p | ~p')), null);
  const cm = F.countermodel([], F.parse('(p -> ~q) -> (q -> p)'));
  assert.ok(cm && cm.q === true && cm.p === false);
  assert.ok(F.entails([F.parse('p & q')], F.parse('q')));
});

/* ---------- reguły i weryfikacja ---------- */

test('dowodzący dowodzi wszystkich przykładów, a dowody są poprawne i kompletne', () => {
  for (const root of exampleRoots()) {
    assert.ok(root, 'brak dowodu');
    assert.equal(Rules.verify([root]).size, 0, F.text(root.f));
    assert.equal(Proof.openLeaves(root).length, 0, F.text(root.f));
  }
});

test('dowodzący: losowe tautologie mają poprawne dowody, a nie-tautologie — brak dowodu', () => {
  const rand = rng(7);
  let tautologies = 0;
  for (let i = 0; i < 300; i++) {
    const f = randomFormula(rand, 4);
    const pf = Prover.prove([], f);
    if (F.countermodel([], f)) { assert.equal(pf, null); continue; }
    if (!pf) continue;   // poza budżetem — dopuszczalne
    tautologies++;
    const root = Proof.fromPlain([Proof.toPlain(pf)], Rules.isRule)[0];
    assert.equal(Rules.verify([root]).size, 0, F.text(f));
  }
  assert.ok(tautologies > 20);
});

test('weryfikacja wykrywa każdą zepsutą przesłankę', () => {
  for (const root of exampleRoots()) {
    Proof.walk([root], n => {
      if (!n.prem.length || n.rule === 'hyp') return;
      const p = n.prem[0], saved = p.box ? p.a : p.f;
      const wrong = F.NOT(F.NOT(F.NOT(saved)));
      if (p.box) p.a = wrong; else p.f = wrong;
      assert.ok(!Rules.checkNode(n, []), `${n.rule} nie wykrył błędu`);
      if (p.box) p.a = saved; else p.f = saved;
    });
  }
});

test('stosowanie wstecz: przesłanki z reguły zawsze przechodzą weryfikację', () => {
  const goals = ['p & q', 'p | q', 'T', 'p -> q', '~p', 'F'].map(F.parse);
  const x = F.parse('r | s');
  for (const r of Rules.ALL) {
    for (const goal of goals) {
      if (Rules.backBlocked(r, goal)) continue;
      const param = r.back.param ? (r.back.param.check ? x : F.parse('r')) : undefined;
      const n = Proof.node(goal, r.id, Rules.materialize(r.back.premises(goal, param)));
      assert.ok(Rules.checkNode(n, []), `${r.id} dla ${F.text(goal)}`);
    }
  }
});

test('stosowanie w przód: wnioski z reguły przechodzą weryfikację', () => {
  const leaf = s => Proof.node(F.parse(s));
  const cases = [
    ['andI', ['p', 'q']], ['orI1', ['p'], 'q'], ['orI2', ['q'], 'p'], ['topI', []], ['impI', ['q'], 'p'],
    ['notI', ['F'], 'p'], ['andE1', ['p & q']], ['andE2', ['p & q']], ['impE', ['p -> q', 'p']],
    ['notE', ['~p', 'p']], ['botE', ['F'], 'r'], ['nnE', ['~~p']], ['orE', ['r', 'p | q', 'r']],
  ];
  for (const [id, prem, param] of cases) {
    const r = Rules.get(id), nodes = prem.map(leaf), formulas = nodes.map(n => n.f);
    assert.equal(Rules.fwdBlocked(r, formulas), null, id);
    const arranged = Rules.fwdArrange(r, formulas, nodes);
    const built = r.fwd.build(arranged.fs, arranged.nodes, param && F.parse(param));
    const n = Proof.node(built.f, id, Rules.enclose(built.prem));
    assert.ok(Rules.checkNode(n, []), id);
  }
  assert.ok(Rules.fwdBlocked(Rules.get('impE'), [F.parse('p'), F.parse('q -> r')]));
  assert.ok(Rules.fwdBlocked(Rules.get('andI'), [F.parse('p')]));
});

test('(∨e) w przód: gałęzie trafiają do okien według hipotez, nie kolejności kliknięć', () => {
  const branch = (hyp, impl) => Proof.node(F.parse('r'), 'impE', [Proof.node(F.parse(hyp)), Proof.node(F.parse(impl))]);
  const fromQ = branch('q', 'q -> r'), fromP = branch('p', 'p -> r'), disj = Proof.node(F.parse('p | q'));
  const r = Rules.get('orE');
  const { fs, nodes } = Rules.fwdArrange(r, [fromQ.f, fromP.f, disj.f], [fromQ, fromP, disj]);
  const built = r.fwd.build(fs, nodes);
  const root = Proof.node(built.f, 'orE', Rules.enclose(built.prem));
  assert.deepEqual(Proof.openFormulas(root).map(F.text).sort(), ['p ∨ q', 'p ⇒ r', 'q ⇒ r'].sort());
});

/* ---------- odczyt danych z zewnątrz ---------- */

test('odczyt odrzuca złośliwe i uszkodzone dane', () => {
  const nested = depth => { let o = { f: 'p', r: 'nnE' }; for (let i = 0; i < depth; i++) o = { f: 'p', r: 'nnE', p: [o] }; return o; };
  const bad = [
    'null', '{}', '"x"', '[1]', '[{"f":1}]', '[{"f":"p","r":"__proto__"}]', '[{"f":"p","r":"constructor"}]',
    '[{"f":"<script>"}]', '[{"f":"p","p":{"0":{"f":"q"}}}]', '[{"f":"p","p":[{"f":"q"}]}]',
    JSON.stringify([nested(Proof.LIMITS.depth + 5)]),
    JSON.stringify(Array(Proof.LIMITS.fragments + 1).fill({ f: 'p' })),
    JSON.stringify([{ f: 'p'.repeat(1000) }]),
  ];
  for (const json of bad) assert.throws(() => Proof.deserialize(json, Rules.isRule), json.slice(0, 40));
});

test('zapis i odczyt zachowują dowód (także w starym formacie kluczy)', () => {
  for (const root of exampleRoots()) {
    const json = Proof.serialize([root]);
    const back = Proof.deserialize(json, Rules.isRule);
    assert.equal(Proof.serialize(back), json);
  }
  const legacy = '[{"f":"(p>q)&p>q","r":"impI","p":[{"a":"(p>q)&p","b":{"f":"q"}}]}]';
  assert.equal(Proof.deserialize(legacy, Rules.isRule)[0].prem[0].body.f.t, 'v');
});

test('odczyt odrzuca użycie założenia z przesłankami (otwarłoby się jako cel z przesłankami)', () => {
  assert.throws(() => Proof.fromPlain([{ f: 'p', r: 'hyp', p: [{ f: 'p' }] }], Rules.isRule), Proof.FormatError);
});

test('(∨e) w przód: role fragmentów według hipotez także dla trzech takich samych formuł', () => {
  const r = Rules.get('orE'), t = s => F.parse(s);
  const make = () => [Proof.node(t('p | q')), Proof.node(t('p | q'), 'orI1', [Proof.node(t('p'))]), Proof.node(t('p | q'), 'orI2', [Proof.node(t('q'))])];
  for (const order of [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0]]) {
    const frags = make(), nodes = order.map(i => frags[i]);
    const a = Rules.fwdArrange(r, nodes.map(n => n.f), nodes);
    const built = r.fwd.build(a.fs, a.nodes);
    const root = Proof.node(built.f, 'orE', Rules.enclose(built.prem));
    assert.deepEqual(Proof.openFormulas(root).map(F.text), ['p ∨ q'], String(order));
  }
});

test('równoważność ⇔ dostaje zrozumiały komunikat', () => {
  assert.throws(() => F.parse('p <-> q'), /Równoważności ⇔ nie ma wśród spójników/);
});

test('duży dowód w limitach jest przetwarzany szybko (klucze formuł liczone raz)', () => {
  // łańcuch ¬i/¬e z dużą formułą: głęboko zagnieżdżone okna, wiele porównań z założeniami
  const P = F.parse(Array.from({ length: 30 }, (_, i) => 'pqrst'[i % 5]).join(' & '));
  let n = Proof.node(F.BOT, 'notE', [Proof.node(P, 'hyp'), Proof.node(F.NOT(P), 'hyp')]);
  for (let d = 0; d < 55; d++) {
    const neg = Proof.node(F.NOT(P), 'notI', [Proof.box(P, n)]);
    n = Proof.node(F.BOT, 'notE', [Proof.node(P, 'hyp'), neg]);
  }
  const root = Proof.node(F.NOT(P), 'notI', [Proof.box(P, n)]);
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) { Proof.index([root]); Rules.verify([root]); Proof.closeByScope([root]); Proof.reopenStrayHyps([root]); }
  assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  assert.ok(Proof.stats([root]).depth <= Proof.LIMITS.depth);
});

/* ---------- dowód słowny (semantyczny) ---------- */

test('dowód słowny: cel, dowolne wartościowanie σ, wniosek i ∎ — dla każdego przykładu', () => {
  for (const root of exampleRoots()) {
    const text = Render.proseText(Explain.prose(root), { rules: true });
    assert.ok(text.startsWith('Dowód. Rozważmy formułę φ = '), text.slice(0, 60));
    assert.match(text, /Aby pokazać, że φ jest tautologią, weźmy dowolne wartościowanie σ i pokażmy, że σ̂\(φ\) = T\./);
    assert.ok(text.trim().endsWith('Ponieważ wartościowanie σ było dowolne, formuła φ jest tautologią. ∎'), text.slice(-80));
    assert.ok(!/undefined|null|\[object|zachodzi /.test(text), text);
    const html = Render.proseHTML(Explain.prose(root), { rules: false });
    assert.ok(!/\(∧i\)|undefined/.test(html));
  }
});

test('dowód słowny: każdy krok dowodu ma swoje zdanie (prezentacja „od przesłanek”)', () => {
  for (const root of exampleRoots()) {
    const covered = new Set();
    for (const s of Explain.prose(root, { merge: false, skipKnown: false }).sentences) s.nodes.forEach(n => covered.add(n.id));
    Proof.walk([root], n => {
      if (n.rule !== 'hyp') assert.ok(covered.has(n.id), `${n.rule} w ${F.text(root.f)}`);
    });
  }
});

test('dowód słowny: okna to przypadki, a (⊥e) i (¬e) — niemożliwe przypadki', () => {
  const text = s => Render.proseText(Explain.prose(proofOf(F.parse(s))));
  assert.match(text('p -> p'), /Przypadek, gdy poprzednik jest fałszywy, jest trywialny: jeśli σ̂\(p\) = F, to z definicji implikacji σ̂\(φ\) = T\. Załóżmy teraz, że σ̂\(p\) = T\./);
  assert.match(text('(p | q) & (p -> r) & (q -> r) -> r'), /Przypadek 1: σ̂\(p\) = T\..*Przypadek 2: σ̂\(q\) = T\..*w obu przypadkach σ̂\(r\) = T/s);
  assert.match(text('F -> p'), /ten przypadek (jest niemożliwy|nie zachodzi) — w szczególności σ̂\(p\) = T/);
  assert.match(text('~(p & ~p)'), /Przypuśćmy, że σ̂\(p ∧ ¬p\) = T\./);
});

test('dowód słowny: przy każdym (⇒i) zaznaczony trywialny przypadek fałszywego poprzednika', () => {
  const text = s => Render.proseText(Explain.prose(proofOf(F.parse(s))));
  // łańcuch implikacji przy korzeniu
  assert.match(text('(p -> q) -> (~q -> ~p)'),
    /Przypadek, gdy któryś z poprzedników jest fałszywy, jest trywialny: jeśli σ̂\(p ⇒ q\) = F lub σ̂\(¬q\) = F, to z definicji implikacji σ̂\(φ\) = T\./);
  // (⇒i) głębiej w dowodzie i dwa razy w jednym dowodzie
  const nested = text('(p -> p) & (q -> q)');
  assert.equal(nested.match(/Przypadek, gdy poprzednik jest fałszywy, jest trywialny/g).length, 2);
  assert.match(nested, /trywialny: jeśli σ̂\(q\) = F, to z definicji implikacji σ̂\(q ⇒ q\) = T\./);
  assert.match(text('p & q -> (p -> q) | r'), /trywialny: jeśli σ̂\(p\) = F, to z definicji implikacji σ̂\(p ⇒ q\) = T/);
  // każdy kompletny dowód z (⇒i) — z przykładów — zawiera to zdanie
  for (const e of Examples.LIST) {
    const pf = e.proof ? e.proof() : proofOf(F.parse(e.formula));
    let imp = false;
    Proof.walk([pf], n => { if (n.rule === 'impI') imp = true; });
    if (imp) assert.match(Render.proseText(Explain.prose(pf)), /jest trywialny: jeśli /, e.title);
  }
});

test('dowód słowny jako LaTeX: symbole tylko w trybie matematycznym, T i F jak w skrypcie', () => {
  const extra = ['p -> T', 'F -> p', '~p -> p -> q'].map(s => proofOf(F.parse(s)));
  for (const root of [...exampleRoots(), ...extra]) {
    for (const rules of [false, true]) {
      const tex = Render.proseTeX(Explain.prose(root), { rules });
      const outside = tex.replace(/\$[^$]*\$/g, '');
      assert.ok(!/[⊤⊥¬∧∨⇒αβγσφ∎̂]/.test(outside), outside.match(/.{0,30}[⊤⊥¬∧∨⇒αβγσφ∎̂].{0,10}/)?.[0]);
      assert.match(tex, /\\hat\{\\sigma\}\(\\phi\) = \\mathsf\{T\}/);
      assert.ok(!/\\begin\{quote\}/.test(tex), 'okna jako \\leftskip, bez zagnieżdżonych list');
    }
  }
});

test('dowód słowny: sprzeczność dopisana do zdania nie ginie przy łączeniu (∧e)', () => {
  const t = s => F.parse(s);
  const pr = t('p & r');
  const body = Proof.node(t('F & r'), 'andI', [
    Proof.node(t('F'), 'notE', [Proof.node(t('p'), 'andE1', [Proof.node(pr, 'hyp')]), Proof.node(t('~p'), 'hyp')]),
    Proof.node(t('r'), 'andE2', [Proof.node(pr, 'hyp')]),
  ]);
  const root = Proof.node(t('~p -> (p & r -> F & r)'), 'impI', [Proof.box(t('~p'),
    Proof.node(t('p & r -> F & r'), 'impI', [Proof.box(pr, body)]))]);
  assert.equal(Rules.verify([root]).size, 0);
  const text = Render.proseText(Explain.prose(root), { rules: true });
  assert.match(text, /co przeczy założeniu σ̂\(¬p\) = T \(czyli σ̂\(p\) = F\) \(¬e\)/, text);
});

test('dowód słowny: zapowiedź „Teraz pokażemy” tylko dla formuł, których wartość nie jest jeszcze znana', () => {
  const text = Render.proseText(Explain.prose(proofOf(F.parse('(p & (p -> q)) & (q -> r) -> r & q'))));
  const announced = [...text.matchAll(/Teraz pokażemy, że (σ̂\([^)]*\) = T)/g)].map(m => m[1]);
  for (const claim of announced) {
    const before = text.slice(0, text.indexOf('Teraz pokażemy, że ' + claim));
    assert.ok(!before.includes(claim + ' (') && !before.includes(claim + '.') && !before.includes(claim + ','), claim);
  }
});

test('opisy kroków „od celu” istnieją dla każdej reguły', () => {
  for (const root of exampleRoots()) {
    Proof.walk([root], n => assert.ok(Explain.goalStep(n).length > 0, n.rule));
  }
});

test('teksty z formułami są bezpieczne w HTML', () => {
  const html = Render.segHTML(['<b>"x"</b> & ', F.parse('p & q')]);
  assert.ok(!html.includes('<b>"x"'));
  assert.ok(html.includes('&lt;b&gt;&quot;x&quot;'));
});

/* ---------- eksport ---------- */

test('układ obrazka: skończone liczby, ramki i kreski dla każdego przykładu; poprawny SVG', () => {
  for (const root of exampleRoots()) {
    const L = Export.layout(root, Export.approxMeasurer());
    assert.ok(Number.isFinite(L.w) && Number.isFinite(L.h) && L.w > 0 && L.h > 0);
    for (const it of L.items) for (const v of Object.values(it)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
    const svg = Export.toSVG(L, Export.THEMES.light);
    assert.equal((svg.match(/<text/g) || []).length, (svg.match(/<\/text>/g) || []).length);
    assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'));
  }
});

test('skala PNG nie przekracza limitów płótna', () => {
  const s = Export.fitScale({ w: 20000, h: 3000 }, 3);
  assert.ok(20000 * s <= 16000 && 20000 * s * 3000 * s <= 16e6 + 1);
});

test('LaTeX: zrównoważone nawiasy klamrowe', () => {
  for (const root of exampleRoots()) {
    const tex = Export.latex(root, { standalone: true });
    const open = (tex.match(/(?<!\\)\{/g) || []).length, close = (tex.match(/(?<!\\)\}/g) || []).length;
    assert.equal(open, close, F.text(root.f));
  }
});

/* ---------- podsumowanie ---------- */

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} z ${passed + failures.length} testów nie przeszło`);
  process.exit(1);
}
console.log(`✓ wszystkie testy przeszły (${passed})`);
