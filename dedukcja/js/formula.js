/* =====================================================================
   Formuły rachunku zdań: drzewo składniowe, wypisywanie, parser, semantyka.
   Moduł czysty (bez DOM) — działa też w Node (testy).
   ===================================================================== */
(function (ND) {
  'use strict';

  /** Zmienne na palecie kreatora; parser przyjmuje też a–d (występują w zadaniach egzaminacyjnych). */
  const VARS = Object.freeze(['p', 'q', 'r', 's', 't']);
  const ALL_VARS = Object.freeze([...VARS, 'a', 'b', 'c', 'd']);

  /** Limity chroniące aplikację przed formułami-potworami (wpisanymi, z linku albo z reguł). */
  const LIMITS = Object.freeze({ chars: 600, size: 150 });

  /* ---------- konstruktory ---------- */

  const TOP = Object.freeze({ t: 'T' });
  const BOT = Object.freeze({ t: 'F' });
  const V = n => ({ t: 'v', n });
  /** Metazmienna (α, β, γ) — tylko w opisach reguł, nigdy w dowodzie. */
  const META = n => ({ t: 'meta', n });
  const NOT = a => ({ t: 'not', a });
  const AND = (a, b) => ({ t: 'and', a, b });
  const OR = (a, b) => ({ t: 'or', a, b });
  const IMP = (a, b) => ({ t: 'imp', a, b });

  const isFormula = x => !!x && typeof x === 'object' && typeof x.t === 'string';

  /**
   * Pamięć wyników dla funkcji formuły. Formuły są niezmienne (nikt nie modyfikuje
   * ich pól), więc wynik dla danego obiektu można policzyć raz — to ważne przy
   * dużych dowodach, gdzie te same formuły porównuje się tysiące razy.
   */
  function memo(fn) {
    const cache = new WeakMap();
    return f => {
      let v = cache.get(f);
      if (v === undefined) { v = fn(f); cache.set(f, v); }
      return v;
    };
  }

  /** Liczba węzłów drzewa formuły. */
  const size = memo(f => 1 + (f.a ? size(f.a) : 0) + (f.b ? size(f.b) : 0));

  /* ---------- wypisywanie ---------- */

  /** Siła wiązania: ¬ najsilniej, potem ∧, ∨, ⇒. */
  const PREC = { imp: 1, or: 2, and: 3, not: 4, v: 5, meta: 5, T: 5, F: 5 };

  /**
   * Tworzy funkcję wypisującą formułę dla danego zestawu symboli.
   * ∧ i ∨ łączą w lewo, ⇒ w prawo — nawiasy tylko tam, gdzie są potrzebne.
   */
  function printer(sym) {
    const go = f => {
      switch (f.t) {
        case 'v': return sym.v(f.n);
        case 'meta': return sym.meta(f.n);
        case 'T': return sym.T;
        case 'F': return sym.F;
        case 'not': return sym.not + wrap(f.a, PREC[f.a.t] < PREC.not);
        default: {
          const p = PREC[f.t];
          const left = PREC[f.a.t] < p || (f.t === 'imp' && PREC[f.a.t] === p);
          const right = PREC[f.b.t] < p || (f.t !== 'imp' && PREC[f.b.t] === p);
          return wrap(f.a, left) + sym[f.t] + wrap(f.b, right);
        }
      }
    };
    const wrap = (g, paren) => (paren ? sym.lp + go(g) + sym.rp : go(g));
    return go;
  }

  const same = n => n;
  const italic = n => `<i>${n}</i>`;
  const TEX_GREEK = { α: '\\alpha', β: '\\beta', γ: '\\gamma', φ: '\\phi' };
  const UNICODE = { T: '⊤', F: '⊥', not: '¬', and: ' ∧ ', or: ' ∨ ', imp: ' ⇒ ', lp: '(', rp: ')' };

  /** Klucz: zwarta, jednoznaczna postać — do porównań, map i zapisu (zgodna ze starszymi linkami). */
  const key = memo(printer({ v: same, meta: n => '?' + n, T: 'T', F: 'F', not: '~', and: '&', or: '|', imp: '>', lp: '(', rp: ')' }));
  /** Zwykły tekst (Unicode). */
  const text = printer({ ...UNICODE, v: same, meta: same });
  /** HTML: zmienne kursywą. Bezpieczne — litery zmiennych pochodzą z białej listy parsera. */
  const html = printer({ ...UNICODE, v: italic, meta: italic });
  /** LaTeX (tryb matematyczny). */
  const tex = printer({ v: same, meta: n => TEX_GREEK[n] || n, T: '\\top', F: '\\bot', not: '\\neg ',
    and: ' \\land ', or: ' \\lor ', imp: ' \\Rightarrow ', lp: '(', rp: ')' });

  /** Formuła jako fragmenty tekstu z informacją o kursywie (do rysowania SVG/PNG). */
  const runs = f => text(f).match(/[a-zα-ω]+|[^a-zα-ω]+/g)
    .map(t => ({ t, italic: /^[a-zα-ω]/.test(t) }));

  const eq = (a, b) => key(a) === key(b);

  /* ---------- parser ---------- */

  class ParseError extends Error {}

  /** Kolejność ma znaczenie: dłuższe symbole przed ich prefiksami (np. „->” przed „-”). */
  const TOKENS = [
    ['->', 'imp'], ['=>', 'imp'], ['/\\', 'and'], ['\\/', 'or'], ['⇒', 'imp'], ['→', 'imp'], ['>', 'imp'],
    ['∧', 'and'], ['&', 'and'], ['^', 'and'], ['∨', 'or'], ['|', 'or'],
    ['¬', 'not'], ['~', 'not'], ['!', 'not'], ['-', 'not'],
    ['⊤', 'T'], ['⊥', 'F'], ['(', 'lp'], [')', 'rp'],
  ];
  const CONSTANTS = { T: 'T', 1: 'T', F: 'F', 0: 'F' };
  /** Równoważności nie ma wśród spójników systemu (rozdz. 2.9 traktuje ją jako skrót). */
  const IFF = ['<->', '<=>', '⇔', '↔'];

  function tokenize(src) {
    const out = [];
    for (let i = 0; i < src.length;) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (IFF.some(lit => src.startsWith(lit, i))) {
        throw new ParseError('Równoważności ⇔ nie ma wśród spójników — zapisz φ ⇔ ψ jako (φ ⇒ ψ) ∧ (ψ ⇒ φ)');
      }
      const hit = TOKENS.find(([lit]) => src.startsWith(lit, i));
      if (hit) { out.push({ t: hit[1] }); i += hit[0].length; continue; }
      if (ALL_VARS.includes(c)) { out.push({ t: 'v', n: c }); i++; continue; }
      if (CONSTANTS[c]) { out.push({ t: CONSTANTS[c] }); i++; continue; }
      const shown = String.fromCodePoint(src.codePointAt(i));
      throw new ParseError(`Niedozwolony znak „${shown}” — dostępne zmienne to ${ALL_VARS.join(', ')}`);
    }
    return out;
  }

  /** Czyta formułę; rzuca ParseError z komunikatem po polsku. Pilnuje limitów rozmiaru. */
  function parse(src) {
    if (typeof src !== 'string') throw new ParseError('Niepoprawna formuła');
    if (src.length > LIMITS.chars) throw new ParseError(`Formuła jest za długa (maks. ${LIMITS.chars} znaków)`);
    const toks = tokenize(src);
    if (!toks.length) throw new ParseError('Pusta formuła');
    // Każdy token daje co najwyżej jeden węzeł, więc ten limit ogranicza też głębokość rekurencji.
    if (toks.filter(t => t.t !== 'lp' && t.t !== 'rp').length > LIMITS.size) {
      throw new ParseError(`Formuła jest za duża (maks. ${LIMITS.size} symboli)`);
    }
    let k = 0;
    const eat = t => (toks[k] && toks[k].t === t ? toks[k++] : null);
    const imp = () => { const a = or(); return eat('imp') ? IMP(a, imp()) : a; };
    const or = () => { let a = and(); while (eat('or')) a = OR(a, and()); return a; };
    const and = () => { let a = unary(); while (eat('and')) a = AND(a, unary()); return a; };
    const unary = () => (eat('not') ? NOT(unary()) : atom());
    function atom() {
      const x = toks[k];
      if (!x) throw new ParseError('Formuła jest niedokończona — brakuje argumentu na końcu');
      if (x.t === 'v') { k++; return V(x.n); }
      if (x.t === 'T') { k++; return TOP; }
      if (x.t === 'F') { k++; return BOT; }
      if (x.t === 'lp') {
        k++;
        const f = imp();
        if (!eat('rp')) throw new ParseError('Brakuje nawiasu zamykającego');
        return f;
      }
      throw new ParseError('Nieoczekiwany symbol — brakuje argumentu spójnika');
    }
    const f = imp();
    if (k < toks.length) {
      throw new ParseError(toks[k].t === 'rp' ? 'Nadmiarowy nawias zamykający' : 'Nieoczekiwany symbol — może brakuje spójnika?');
    }
    return f;
  }

  /* ---------- podformuły i semantyka ---------- */

  /** Dopisuje do mapy (klucz → formuła) wszystkie podformuły `f`. */
  function subformulas(f, acc = new Map()) {
    acc.set(key(f), f);
    if (f.a) subformulas(f.a, acc);
    if (f.b) subformulas(f.b, acc);
    return acc;
  }

  function vars(f, acc = new Set()) {
    if (f.t === 'v') acc.add(f.n);
    if (f.a) vars(f.a, acc);
    if (f.b) vars(f.b, acc);
    return acc;
  }

  function evaluate(f, val) {
    switch (f.t) {
      case 'v': return !!val[f.n];
      case 'T': return true;
      case 'F': return false;
      case 'not': return !evaluate(f.a, val);
      case 'and': return evaluate(f.a, val) && evaluate(f.b, val);
      case 'or': return evaluate(f.a, val) || evaluate(f.b, val);
      case 'imp': return !evaluate(f.a, val) || evaluate(f.b, val);
      default: throw new Error('evaluate: ' + f.t);
    }
  }

  const cmCache = new Map();
  /**
   * Kontrprzykład dla Γ ⊨ φ: wartościowanie, przy którym wszystkie przesłanki są prawdziwe,
   * a φ fałszywa; null, gdy wynikanie zachodzi. Co najwyżej 2^9 wartościowań (biała lista zmiennych).
   */
  function countermodel(premises, goal) {
    const k = premises.map(key).sort().join(',') + '⊢' + key(goal);
    if (cmCache.has(k)) return cmCache.get(k);
    const names = new Set();
    premises.forEach(g => vars(g, names));
    vars(goal, names);
    const xs = [...names].sort();
    let found = null;
    for (let m = 0; m < 1 << xs.length && !found; m++) {
      const val = Object.fromEntries(xs.map((x, i) => [x, !!((m >> i) & 1)]));
      if (premises.every(g => evaluate(g, val)) && !evaluate(goal, val)) found = val;
    }
    if (cmCache.size > 20000) cmCache.clear();
    cmCache.set(k, found);
    return found;
  }
  const entails = (premises, goal) => !countermodel(premises, goal);

  ND.F = Object.freeze({
    VARS, ALL_VARS, LIMITS, TOP, BOT, V, META, NOT, AND, OR, IMP,
    isFormula, size, key, text, html, tex, runs, eq,
    ParseError, parse, subformulas, vars, evaluate, countermodel, entails,
  });
})(globalThis.ND ||= {});
