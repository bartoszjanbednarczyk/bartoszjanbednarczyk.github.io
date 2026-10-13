/* =====================================================================
   Formuły rachunku zdań i rachunku kwantyfikatorów (rozdz. 2 i 3 skryptu):
   drzewo składniowe, termy, wypisywanie, parser, podstawienia, semantyka
   rachunku zdań. Moduł czysty (bez DOM) — działa też w Node (testy).

   Węzły formuł:  { t: 'v', n, args? }        — zmienna zdaniowa / formuła atomowa p(t₁, …, tₙ)
                  { t: 'T' } | { t: 'F' }       — ⊤, ⊥
                  { t: 'not', a } | { t: 'and' | 'or' | 'imp', a, b }
                  { t: 'all' | 'ex', x, a }     — ∀x α, ∃x α (x — nazwa zmiennej)
                  { t: 'meta', n } | { t: 'msub', a, x, s }   — tylko w schematach reguł: α, α[x/t]
   Termy:         { t: 'var', n } | { t: 'fn', n, args }     — stała to symbol funkcyjny bez argumentów
   Nazwy z cyframi (x0, f1) są wypisywane z indeksem dolnym (x₀).
   ===================================================================== */
(function (ND) {
  'use strict';

  /** Zmienne na palecie kreatora; parser przyjmuje też a–d (występują w zadaniach egzaminacyjnych). */
  const VARS = Object.freeze(['p', 'q', 'r', 's', 't']);
  const ALL_VARS = Object.freeze([...VARS, 'a', 'b', 'c', 'd']);

  /**
   * Rachunek kwantyfikatorów: rodzaj symbolu wynika z pierwszej litery nazwy (jak w skrypcie):
   * zmienne u–z, stałe a–e, symbole funkcyjne f–h, symbole relacyjne p–t oraz φ, ψ, χ.
   * Po literze mogą stać cyfry (indeks dolny): x0, x₀, x_0 to ta sama zmienna.
   */
  const FO_CLASSES = Object.freeze({ var: 'uvwxyz', const: 'abcde', fn: 'fgh', rel: 'pqrstφψχ' });
  const FO = Object.freeze({
    vars: ['x', 'y', 'z'], consts: ['a', 'b', 'c'], fns: ['f', 'g'], rels: ['p', 'q', 'r', 'φ', 'ψ'],
  });
  const classOf = name => Object.keys(FO_CLASSES).find(k => FO_CLASSES[k].includes(name[0])) || null;
  /** Czy napis jest nazwą zmiennej rachunku kwantyfikatorów (np. x, y₀ zapisane jako y0) — jak w parserze. */
  const isVarName = n => typeof n === 'string' && /^[a-z]\d*$/.test(n) && classOf(n) === 'var';

  /** Limity chroniące aplikację przed formułami-potworami (wpisanymi, z linku albo z reguł). */
  const LIMITS = Object.freeze({ chars: 600, size: 150 });

  /* ---------- konstruktory ---------- */

  const TOP = Object.freeze({ t: 'T' });
  const BOT = Object.freeze({ t: 'F' });
  const V = n => ({ t: 'v', n });
  /** Formuła atomowa p(t₁, …, tₙ); bez argumentów — zmienna zdaniowa (symbol relacyjny 0-argumentowy). */
  const ATOM = (n, args = []) => (args.length ? { t: 'v', n, args } : { t: 'v', n });
  /** Metazmienna (α, β, γ) — tylko w opisach reguł, nigdy w dowodzie. */
  const META = n => ({ t: 'meta', n });
  const NOT = a => ({ t: 'not', a });
  const AND = (a, b) => ({ t: 'and', a, b });
  const OR = (a, b) => ({ t: 'or', a, b });
  const IMP = (a, b) => ({ t: 'imp', a, b });
  const ALL = (x, a) => ({ t: 'all', x, a });
  const EX = (x, a) => ({ t: 'ex', x, a });
  const VAR = n => ({ t: 'var', n });
  const FN = (n, args = []) => ({ t: 'fn', n, args });
  /** Schemat α[x/t] (tylko w opisach reguł). */
  const MSUB = (a, x, s) => ({ t: 'msub', a, x, s });

  const TERM_TYPES = new Set(['var', 'fn']);
  const isTerm = x => !!x && typeof x === 'object' && TERM_TYPES.has(x.t);
  const isFormula = x => !!x && typeof x === 'object' && typeof x.t === 'string' && !TERM_TYPES.has(x.t);
  /** Formuła albo term — wszystko, co da się wypisać. */
  const isPrintable = x => !!x && typeof x === 'object' && typeof x.t === 'string';
  const isQuant = f => f.t === 'all' || f.t === 'ex';

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

  /** Liczba węzłów drzewa formuły (z termami). */
  const size = memo(f => 1 + (f.a ? size(f.a) : 0) + (f.b ? size(f.b) : 0) + (f.args ? f.args.reduce((s, x) => s + size(x), 0) : 0));

  /* ---------- wypisywanie ---------- */

  /** Siła wiązania: ¬ i kwantyfikatory najsilniej, potem ∧, ∨, ⇒. */
  const PREC = { imp: 1, or: 2, and: 3, not: 4, all: 4, ex: 4, v: 5, meta: 5, msub: 5, T: 5, F: 5 };

  /** Nazwa z cyframi na końcu: { base, digits } (x0 → x, 0). */
  const splitName = n => { const m = /^(.*?)(\d*)$/.exec(n); return { base: m[1], digits: m[2] }; };
  const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
  const subDigits = d => [...d].map(c => SUBSCRIPT_DIGITS[+c]).join('');

  /**
   * Tworzy funkcję wypisującą formułę (albo term) dla danego zestawu symboli.
   * ∧ i ∨ łączą w lewo, ⇒ w prawo — nawiasy tylko tam, gdzie są potrzebne.
   */
  function printer(sym) {
    const args = xs => sym.lp + xs.map(go).join(sym.comma) + sym.rp;
    const go = f => {
      switch (f.t) {
        case 'v': return sym.name(f.n) + (f.args && f.args.length ? args(f.args) : '');
        case 'var': return sym.name(f.n);
        case 'fn': return sym.name(f.n) + (f.args.length ? args(f.args) : '');
        case 'meta': return sym.meta(f.n);
        case 'msub': return wrap(f.a, PREC[f.a.t] < PREC.msub) + sym.subst(sym.name(f.x), go(f.s));
        case 'T': return sym.T;
        case 'F': return sym.F;
        case 'not': return sym.not + wrap(f.a, PREC[f.a.t] < PREC.not);
        case 'all': case 'ex': return sym[f.t] + sym.name(f.x) + sym.qsep + wrap(f.a, PREC[f.a.t] < PREC.not);
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

  const TEX_GREEK = { α: '\\alpha', β: '\\beta', γ: '\\gamma', φ: '\\phi', ψ: '\\psi', χ: '\\chi', θ: '\\theta' };
  const UNICODE = { T: '⊤', F: '⊥', not: '¬', and: ' ∧ ', or: ' ∨ ', imp: ' ⇒ ', all: '∀', ex: '∃', qsep: ' ', lp: '(', rp: ')', comma: ', ' };
  const plainName = n => { const { base, digits } = splitName(n); return base + subDigits(digits); };
  const htmlName = n => { const { base, digits } = splitName(n); return `<i>${base}</i>${digits ? `<sub>${digits}</sub>` : ''}`; };
  const texName = n => {
    const { base, digits } = splitName(n);
    const b = TEX_GREEK[base] || base;
    return b + (digits ? (digits.length > 1 ? `_{${digits}}` : '_' + digits) : '');
  };

  /** Klucz: zwarta, jednoznaczna postać — do porównań, map i zapisu (zgodna ze starszymi linkami). */
  const key = memo(printer({
    name: n => n, meta: n => '?' + n, T: 'T', F: 'F', not: '~', and: '&', or: '|', imp: '>', all: 'A', ex: 'E', qsep: ' ',
    lp: '(', rp: ')', comma: ',', subst: (x, t) => `[${x}/${t}]`,
  }));
  /** Zwykły tekst (Unicode). */
  const text = printer({ ...UNICODE, name: plainName, meta: n => n, subst: (x, t) => `[${x}/${t}]` });
  /** HTML: nazwy kursywą. Bezpieczne — nazwy pochodzą z białej listy parsera. */
  const html = printer({ ...UNICODE, name: htmlName, meta: n => `<i>${n}</i>`, subst: (x, t) => `[${x}/${t}]` });
  /** LaTeX (tryb matematyczny). */
  const tex = printer({
    name: texName, meta: n => TEX_GREEK[n] || n, T: '\\top', F: '\\bot', not: '\\neg ',
    and: ' \\land ', or: ' \\lor ', imp: ' \\Rightarrow ', all: '\\forall ', ex: '\\exists ', qsep: '\\, ',
    lp: '(', rp: ')', comma: ', ', subst: (x, t) => `[${x}/${t}]`,
  });

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
  const FO_TOKENS = [['∀', 'all'], ['∃', 'ex'], [',', 'comma'], ['.', 'dot']];
  const CONSTANTS = { T: 'T', 1: 'T', F: 'F', 0: 'F' };
  /** Równoważności nie ma wśród spójników systemu (rozdz. 2.9 traktuje ją jako skrót). */
  const IFF = ['<->', '<=>', '⇔', '↔'];
  const SUB_INPUT = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

  /** Nazwa w rachunku kwantyfikatorów: litera, a po niej cyfry (także ₀–₉ albo _0). */
  function readName(src, i) {
    const m = /^([a-zφψχ])((?:_?[0-9₀-₉])*)/u.exec(src.slice(i));
    if (!m) return null;
    const digits = [...m[2]].filter(c => c !== '_').map(c => SUB_INPUT[c] || c).join('');
    return { name: m[1] + digits, len: m[0].length };
  }

  const keywordAt = (src, i, word) => src.startsWith(word, i) && !/[a-z0-9]/i.test(src[i + word.length] || '');

  function tokenize(src, fo) {
    const out = [];
    for (let i = 0; i < src.length;) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (IFF.some(lit => src.startsWith(lit, i))) {
        throw new ParseError('Równoważności ⇔ nie ma wśród spójników — zapisz φ ⇔ ψ jako (φ ⇒ ψ) ∧ (ψ ⇒ φ)');
      }
      if (fo) {
        const q = keywordAt(src, i, 'forall') ? ['all', 6] : keywordAt(src, i, 'exists') ? ['ex', 6]
          : c === 'A' ? ['all', 1] : c === 'E' ? ['ex', 1] : null;
        if (q) { out.push({ t: q[0] }); i += q[1]; continue; }
        const hit = FO_TOKENS.find(([lit]) => src.startsWith(lit, i));
        if (hit) { out.push({ t: hit[1] }); i += hit[0].length; continue; }
      }
      const hit = TOKENS.find(([lit]) => src.startsWith(lit, i));
      if (hit) { out.push({ t: hit[1] }); i += hit[0].length; continue; }
      if (fo) {
        const nm = readName(src, i);
        if (nm) { out.push({ t: 'id', n: nm.name }); i += nm.len; continue; }
      } else if (ALL_VARS.includes(c)) { out.push({ t: 'v', n: c }); i++; continue; }
      if (CONSTANTS[c]) { out.push({ t: CONSTANTS[c] }); i++; continue; }
      const shown = String.fromCodePoint(src.codePointAt(i));
      throw new ParseError(fo
        ? `Niedozwolony znak „${shown}” — zmienne to u–z, stałe a–e, symbole funkcyjne f–h, relacyjne p–t, φ, ψ`
        : `Niedozwolony znak „${shown}” — dostępne zmienne to ${ALL_VARS.join(', ')}`);
    }
    return out;
  }

  /** Sprawdza, że każdy symbol ma w całej formule tę samą liczbę argumentów. */
  function checkArities(f) {
    const seen = new Map();
    const note = (n, k) => {
      if (!seen.has(n)) seen.set(n, k);
      else if (seen.get(n) !== k) throw new ParseError(`Symbol ${plainName(n)} występuje w formule z różną liczbą argumentów`);
    };
    const rec = g => {
      if (g.t === 'v') note(g.n, (g.args || []).length);
      if (g.t === 'fn') note(g.n, g.args.length);
      if (g.args) g.args.forEach(rec);
      if (g.a) rec(g.a);
      if (g.b) rec(g.b);
    };
    rec(f);
  }

  /**
   * Parser rekurencyjny. Wariant `fo` (rachunek kwantyfikatorów) przyjmuje termy, formuły
   * atomowe z argumentami i kwantyfikatory: ∀x α, ∃x α (także A x, E x, forall, exists);
   * kwantyfikator wiąże jak negacja, a kropka (∀x. α) rozciąga jego zasięg maksymalnie w prawo.
   */
  function makeParser(toks, fo) {
    let k = 0;
    const peek = () => toks[k];
    const eat = t => (toks[k] && toks[k].t === t ? toks[k++] : null);
    const imp = () => { const a = or(); return eat('imp') ? IMP(a, imp()) : a; };
    const or = () => { let a = and(); while (eat('or')) a = OR(a, and()); return a; };
    const and = () => { let a = unary(); while (eat('and')) a = AND(a, unary()); return a; };
    function unary() {
      if (eat('not')) return NOT(unary());
      const q = peek() && (peek().t === 'all' || peek().t === 'ex') ? toks[k++] : null;
      if (q) {
        const v = toks[k];
        if (!v || v.t !== 'id') throw new ParseError('Po kwantyfikatorze musi stać zmienna, np. ∀x');
        if (classOf(v.n) !== 'var') throw new ParseError(`${plainName(v.n)} nie jest zmienną — zmienne to u, v, w, x, y, z (np. x₀)`);
        k++;
        const body = eat('dot') ? imp() : unary();
        return q.t === 'all' ? ALL(v.n, body) : EX(v.n, body);
      }
      return atom();
    }
    function termList() {
      const out = [];
      if (!eat('lp')) return out;
      if (eat('rp')) throw new ParseError('Puste nawiasy — podaj argumenty');
      do out.push(term()); while (eat('comma'));
      if (!eat('rp')) throw new ParseError('Brakuje nawiasu zamykającego listę argumentów');
      return out;
    }
    function term() {
      const x = toks[k];
      if (!x || x.t !== 'id') throw new ParseError('Oczekiwano termu (zmiennej, stałej albo symbolu funkcyjnego)');
      k++;
      const cls = classOf(x.n);
      const hasArgs = peek() && peek().t === 'lp';
      if (cls === 'var') {
        if (hasArgs) throw new ParseError(`${plainName(x.n)} jest zmienną — nie ma argumentów`);
        return VAR(x.n);
      }
      if (cls === 'const') {
        if (hasArgs) throw new ParseError(`${plainName(x.n)} jest stałą — symbole funkcyjne to f, g, h`);
        return FN(x.n);
      }
      if (cls === 'fn') {
        if (!hasArgs) throw new ParseError(`${plainName(x.n)} jest symbolem funkcyjnym — podaj argumenty, np. ${plainName(x.n)}(x)`);
        return FN(x.n, termList());
      }
      throw new ParseError(`${plainName(x.n)} jest symbolem relacyjnym — w termie użyj zmiennej, stałej albo funkcji`);
    }
    function atom() {
      const x = toks[k];
      if (!x) throw new ParseError('Formuła jest niedokończona — brakuje argumentu na końcu');
      if (x.t === 'v') { k++; return V(x.n); }
      if (x.t === 'T') { k++; return TOP; }
      if (x.t === 'F') { k++; return BOT; }
      if (x.t === 'id') {
        const cls = classOf(x.n);
        if (cls !== 'rel') {
          const what = { var: 'zmienną', const: 'stałą', fn: 'symbolem funkcyjnym' }[cls];
          throw new ParseError(what ? `${plainName(x.n)} jest ${what}, a nie formułą — formuła atomowa zaczyna się od symbolu relacyjnego (p–t, φ, ψ), np. p(${plainName(x.n)}${cls === 'fn' ? '(x)' : ''})`
            : `Nieznany symbol ${plainName(x.n)} — zmienne to u–z, stałe a–e, symbole funkcyjne f–h, relacyjne p–t, φ, ψ`);
        }
        k++;
        return ATOM(x.n, termList());
      }
      if (x.t === 'lp') {
        k++;
        const f = imp();
        if (!eat('rp')) throw new ParseError('Brakuje nawiasu zamykającego');
        return f;
      }
      throw new ParseError('Nieoczekiwany symbol — brakuje argumentu spójnika');
    }
    const done = () => {
      if (k < toks.length) {
        throw new ParseError(toks[k].t === 'rp' ? 'Nadmiarowy nawias zamykający' : 'Nieoczekiwany symbol — może brakuje spójnika?');
      }
    };
    return { formula: () => { const f = imp(); done(); return f; }, term: () => { const t = term(); done(); return t; } };
  }

  function prepare(src) {
    if (typeof src !== 'string') throw new ParseError('Niepoprawna formuła');
    if (src.length > LIMITS.chars) throw new ParseError(`Formuła jest za długa (maks. ${LIMITS.chars} znaków)`);
  }

  function checkSize(toks) {
    if (!toks.length) throw new ParseError('Pusta formuła');
    // Każdy token daje co najwyżej jeden węzeł, więc ten limit ogranicza też głębokość rekurencji.
    if (toks.filter(t => !['lp', 'rp', 'comma', 'dot'].includes(t.t)).length > LIMITS.size) {
      throw new ParseError(`Formuła jest za duża (maks. ${LIMITS.size} symboli)`);
    }
  }

  /**
   * Czyta formułę; rzuca ParseError z komunikatem po polsku. Pilnuje limitów rozmiaru.
   * logic: 'prop' (rachunek zdań, domyślnie) albo 'fo' (rachunek kwantyfikatorów).
   */
  function parse(src, { logic = 'prop' } = {}) {
    prepare(src);
    const fo = logic === 'fo';
    const toks = tokenize(src, fo);
    checkSize(toks);
    const f = makeParser(toks, fo).formula();
    if (fo) checkArities(f);
    return f;
  }

  /** Czyta term rachunku kwantyfikatorów (np. parametr reguły (∃i)). */
  function parseTerm(src) {
    prepare(src);
    const toks = tokenize(src, true);
    if (!toks.length) throw new ParseError('Pusty term');
    checkSize(toks);
    const t = makeParser(toks, true).term();
    checkArities(t);
    return t;
  }

  /* ---------- zmienne, termy, podstawienia ---------- */

  /** Zmienne wolne formuły albo termu (posortowana tablica nazw). */
  const freeVars = memo(f => {
    const acc = new Set();
    const rec = (g, bound) => {
      if (g.t === 'var') { if (!bound.has(g.n)) acc.add(g.n); return; }
      if (g.args) g.args.forEach(x => rec(x, bound));
      if (isQuant(g)) { rec(g.a, new Set([...bound, g.x])); return; }
      if (g.a) rec(g.a, bound);
      if (g.b) rec(g.b, bound);
    };
    rec(f, new Set());
    return [...acc].sort();
  });
  const isFree = (x, f) => freeVars(f).includes(x);

  /** Wszystkie nazwy zmiennych występujące w formule (wolne, związane i wiązane). */
  function allVars(f, acc = new Set()) {
    if (f.t === 'var') acc.add(f.n);
    if (isQuant(f)) acc.add(f.x);
    if (f.args) f.args.forEach(x => allVars(x, acc));
    if (f.a) allVars(f.a, acc);
    if (f.b) allVars(f.b, acc);
    return acc;
  }

  /**
   * Podstawienie α[x/t] — termu t za wolne wystąpienia zmiennej x. Zwraca null, gdy podstawienie
   * nie jest dopuszczalne (zmienna termu zostałaby związana — Def. 52 skryptu).
   */
  function subst(f, x, t) {
    const tv = freeVars(t);
    let ok = true;
    const rec = (g, bound) => {
      if (!ok) return g;
      switch (g.t) {
        case 'var':
          if (g.n !== x) return g;
          if (tv.some(v => bound.has(v))) { ok = false; return g; }
          return t;
        case 'fn': case 'v':
          return g.args && g.args.length ? { ...g, args: g.args.map(a => rec(a, bound)) } : g;
        case 'all': case 'ex':
          if (g.x === x) return g;                       // x jest tu związana — brak wolnych wystąpień
          return isFree(x, g.a) ? { ...g, a: rec(g.a, new Set([...bound, g.x])) } : g;
        case 'not': return { ...g, a: rec(g.a, bound) };
        case 'and': case 'or': case 'imp': return { ...g, a: rec(g.a, bound), b: rec(g.b, bound) };
        default: return g;
      }
    };
    const out = isFree(x, f) ? rec(f, new Set()) : f;
    return ok ? out : null;
  }

  /**
   * Dopasowanie: term t, dla którego α[x/t] = β (i podstawienie jest dopuszczalne).
   * Zwraca { t } (t === null, gdy x nie występuje wolno w α i α = β) albo null.
   */
  function match(alpha, x, beta) {
    let found = null, ok = true;
    const rec = (g, h, bound) => {
      if (!ok) return;
      if (g.t === 'var' && g.n === x && !bound.has(x)) {
        if (!isTerm(h)) { ok = false; return; }
        if (found === null) found = h;
        else if (key(found) !== key(h)) ok = false;
        return;
      }
      if (g.t !== h.t) { ok = false; return; }
      switch (g.t) {
        case 'var': if (g.n !== h.n) ok = false; return;
        case 'fn': case 'v': {
          const ga = g.args || [], ha = h.args || [];
          if (g.n !== h.n || ga.length !== ha.length) { ok = false; return; }
          ga.forEach((a, i) => rec(a, ha[i], bound));
          return;
        }
        case 'all': case 'ex':
          if (g.x !== h.x) { ok = false; return; }
          rec(g.a, h.a, g.x === x ? new Set([...bound, x]) : bound);
          return;
        case 'not': rec(g.a, h.a, bound); return;
        case 'and': case 'or': case 'imp': rec(g.a, h.a, bound); rec(g.b, h.b, bound); return;
        default: if (key(g) !== key(h)) ok = false;
      }
    };
    rec(alpha, beta, new Set());
    if (!ok) return null;
    if (found === null) return eq(alpha, beta) ? { t: null } : null;
    const s = subst(alpha, x, found);
    return s && eq(s, beta) ? { t: found } : null;
  }

  /** Świeża zmienna: litera `base` (np. x) z najmniejszym indeksem spoza zbioru `used` — x₀, x₁, … */
  function freshVar(base, used) {
    const letter = base && classOf(base) === 'var' ? splitName(base).base : 'x';
    for (let k = 0; ; k++) if (!used.has(letter + k)) return letter + k;
  }

  /** Termy występujące w formule (bez powtórzeń, od najmniejszych). */
  function termsOf(f, acc = new Map()) {
    const rec = g => {
      if (isTerm(g)) { acc.set(key(g), g); if (g.args) g.args.forEach(rec); return; }
      if (g.args) g.args.forEach(rec);
      if (g.a) rec(g.a);
      if (g.b) rec(g.b);
    };
    rec(f);
    return acc;
  }

  /* ---------- podformuły i semantyka rachunku zdań ---------- */

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
   * Kontrprzykład dla Γ ⊨ φ (rachunek zdań): wartościowanie, przy którym wszystkie przesłanki są
   * prawdziwe, a φ fałszywa; null, gdy wynikanie zachodzi. Co najwyżej 2^9 wartościowań (biała lista zmiennych).
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
    VARS, ALL_VARS, FO, LIMITS, TOP, BOT, V, ATOM, META, NOT, AND, OR, IMP, ALL, EX, VAR, FN, MSUB,
    isFormula, isTerm, isPrintable, isQuant, size, key, text, html, tex, runs, eq, plainName, htmlName, texName,
    ParseError, parse, parseTerm, classOf,
    freeVars, isFree, allVars, subst, match, freshVar, termsOf, isVarName,
    subformulas, vars, evaluate, countermodel, entails,
  });
})(globalThis.ND ||= {});
