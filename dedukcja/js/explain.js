/* =====================================================================
   Wyjaśnienia po polsku:
     goalStep   — co robi reguła stosowana „od celu” (prezentacja, podpowiedzi),
     hintIdea   — delikatna wskazówka (1. poziom podpowiedzi),
     hintStep   — konkretny następny krok (2. poziom podpowiedzi),
     prose      — dowód w języku naturalnym: semantyczny, na wartościowaniach (okna → przypadki).
   Wynik to segmenty tekstu (ND.Seg) — renderery są w render.js.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, AND, NOT, IMP, META, key, eq, size } = ND.F;
  const { T, list, rule, sym, val, strong, QED } = ND.Seg;
  const Rules = ND.Rules;

  /** Dowód nie wprost: (¬¬e) zastosowane do (¬i) z oknem zakładającym ¬φ. */
  const isRAA = n => n.rule === 'nnE' && !!n.prem[0] && n.prem[0].rule === 'notI'
    && !!n.prem[0].prem[0] && !!n.prem[0].prem[0].box && eq(n.prem[0].prem[0].a, NOT(n.f));

  /* =====================================================================
     Opisy kroków „od celu”
     ===================================================================== */

  /** Co robi reguła zastosowana w węźle `n` — w 1. osobie liczby mnogiej. */
  function goalStep(n) {
    const f = n.f, x = Rules.paramOf(n);
    switch (n.rule) {
      case 'hyp': return T`${f} jest założeniem otaczającego okna.`;
      case 'topI': return T`Formułę ${TOP} dowodzimy bez żadnych przesłanek.`;
      case 'andI': return T`Dowodzimy osobno ${f.a} oraz ${f.b}.`;
      case 'orI1': return T`Wystarczy udowodnić lewy człon ${f.a}.`;
      case 'orI2': return T`Wystarczy udowodnić prawy człon ${f.b}.`;
      case 'impI': return T`W nowym oknie zakładamy ${f.a} i dowodzimy ${f.b}.`;
      case 'notI': return T`W nowym oknie zakładamy ${f.a} i wyprowadzamy sprzeczność ${BOT}.`;
      case 'andE1': return T`Cel wynika z koniunkcji ${AND(f, x)}.`;
      case 'andE2': return T`Cel wynika z koniunkcji ${AND(x, f)}.`;
      case 'impE': return T`Dowodzimy ${x} oraz ${IMP(x, f)} — cel wynika z nich na mocy modus ponens.`;
      case 'notE': return T`Dowodzimy ${x} oraz ${NOT(x)}.`;
      case 'botE': return T`Wystarczy wyprowadzić sprzeczność ${BOT} — wynika z niej dowolna formuła.`;
      case 'nnE': return isRAA(n)
        ? T`Dowód nie wprost: wystarczy udowodnić ${NOT(NOT(f))}, czyli założyć ${NOT(f)} i dojść do sprzeczności.`
        : T`Cel wynika z ${NOT(NOT(f))}.`;
      case 'orE': return T`Dowodzimy ${x}, a potem ${f} osobno przy założeniu ${x.a} i przy założeniu ${x.b}.`;
      default: return [];
    }
  }

  /** Założenie, z którego „pochodzi” przesłanka kroku (łańcuch eliminacji) — do wskazówek. */
  function sourceHypothesis(pf) {
    let x = pf.rule === 'impE' || pf.rule === 'notE' ? pf : pf.prem[0] || pf;
    while (x) {
      if (x.rule === 'hyp') return x.f;
      if (['andE1', 'andE2', 'nnE'].includes(x.rule)) x = x.prem[0];
      else if (x.rule === 'impE' || x.rule === 'notE') x = x.prem[1];
      else return null;
    }
    return null;
  }

  /** Pierwszy poziom podpowiedzi: od czego zacząć (bez zdradzania reguły). */
  function hintIdea(pf) {
    const src = sourceHypothesis(pf);
    const look = src ? T` Przyjrzyj się założeniu ${src}.` : [];
    switch (pf.rule) {
      case 'hyp': return T`Spójrz na założenia okien, w których leży ten cel.`;
      case 'topI': return T`Cel to stała ${TOP} — jedna z reguł dowodzi jej bez żadnych przesłanek.`;
      case 'andI': return T`Spójnik główny celu to ${sym('∧')}. Co trzeba wiedzieć, żeby wiedzieć, że koniunkcja jest prawdziwa?`;
      case 'impI': return T`Spójnik główny celu to ${sym('⇒')}. Jak zwykle dowodzi się implikacji?`;
      case 'notI': return T`Cel jest negacją. Spróbuj założyć to, co jest negowane, i dojść do sprzeczności.`;
      case 'orI1': case 'orI2': return T`Cel jest alternatywą. Zastanów się, który z jej członów wynika z dostępnych założeń.`;
      case 'andE1': case 'andE2': return T`Cel jest członem koniunkcji, którą da się uzyskać z założeń.${look}`;
      case 'impE': return T`Cel jest następnikiem implikacji, którą masz do dyspozycji. Pomyśl o modus ponens.${look}`;
      case 'notE': return T`Cel to ${BOT}, więc szukasz sprzeczności: formuły, którą umiesz udowodnić razem z jej negacją.${look}`;
      case 'botE': return T`Założenia w tym oknie są ze sobą sprzeczne — a ze sprzeczności wynika wszystko.`;
      case 'orE': return pf.prem[0].rule === 'hyp'
        ? T`Wśród założeń jest alternatywa ${pf.prem[0].f}. Rozważ oba przypadki osobno.`
        : T`Z założeń łatwo otrzymać alternatywę ${pf.prem[0].f}. Rozważ oba przypadki osobno.`;
      case 'nnE': return isRAA(pf)
        ? T`Wprost się nie uda. Spróbuj dowodu nie wprost: załóż negację celu i dojdź do sprzeczności.`
        : T`Cel kryje się pod podwójną negacją.${look}`;
      default: return [];
    }
  }

  /** Drugi poziom podpowiedzi: konkretna reguła (etykiety reguł zawsze widoczne). */
  function hintStep(pf) {
    if (pf.rule === 'hyp') return T`Zastosuj regułę ${strong('założenie')}: ${pf.f} jest założeniem otaczającego okna.`;
    if (isRAA(pf)) return T`Zastosuj ${rule('nnE')}, a potem ${rule('notI')}: w nowym oknie załóż ${NOT(pf.f)} i wyprowadź ${BOT}.`;
    return T`Zastosuj ${rule(pf.rule)}. ${goalStep(pf)}`;
  }

  /* =====================================================================
     Dowód w języku naturalnym — semantyczny, jak w rozdz. 2 skryptu.
     Pokazujemy, że dla dowolnego wartościowania σ zachodzi σ̂(φ) = T, idąc
     za strukturą dowodu formalnego:
       • okno reguły (⇒i) to przypadki σ̂(α) = F (trywialny: poprzednik fałszywy) i σ̂(α) = T,
       • okno reguły (¬i) to przypuszczenie σ̂(α) = T prowadzące do sprzeczności,
       • okna reguły (∨e) to przypadki σ̂(α) = T i σ̂(β) = T,
       • pozostałe kroki uzasadnia definicja σ̂ dla danego spójnika,
       • wyprowadzenie ⊥ znaczy, że rozważany przypadek jest niemożliwy (σ̂(⊥) = F).
     Blok: { items: [zdanie | blok] } — zagnieżdżony blok to treść okna (wcięcie).
     Zdanie: { segs, nodes, event, box, concl, how, contra, projection }
       event: 'assume' (otwarcie okna), 'infer' (wniosek), 'hyp' (użycie założenia), 'note' (komentarz).
       contra: zdanie kończy się sprzecznością; projection: dane do dołączania kolejnych (∧e).
     Wszystkie zdania (także noty) trafiają też do listy zdań w kolejności czytania
     — z niej korzysta prezentacja „od przesłanek”.
     ===================================================================== */

  /** Nazwa dowodzonej formuły w tekście dowodu. */
  const PHI = META('φ');

  /** Zamienniki słów otwierających, by kolejne zdania nie zaczynały się tak samo. */
  const OPENER_ALTERNATIVES = { Zatem: 'W rezultacie', Stąd: 'W takim razie', Wtedy: 'Wówczas' };
  const BY_CONJUNCTION = ' z definicji koniunkcji ';


  /** Elementy bez powtórzeń formuł (ta sama formuła wymieniona raz). */
  const uniqueBy = (items, formulaOf) => items.filter((x, i) => items.findIndex(y => key(formulaOf(y)) === key(formulaOf(x))) === i);

  /** Liczba kroków, które trzeba opisać w poddrzewie (bez użyć założeń). */
  const workIn = n => (n.rule === 'hyp' || n.rule === null ? 0 : 1)
    + n.prem.reduce((s, p) => s + workIn(p.box ? p.body : p), 0);

  class ProseWriter {
    /**
     * @param {object} opts
     *   merge      — łączenie zdań i spłaszczanie okien przy korzeniu (dowód do czytania),
     *   skipKnown  — nie powtarzaj uzasadnień wartości ustalonych już w tym przypadku.
     */
    constructor({ merge = true, skipKnown = true } = {}) {
      this.merge = merge;
      this.skipKnown = skipKnown;
      this.top = { items: [] };
      this.block = this.top;
      this.parents = [];
      this.scopes = [new Map()];
      this.last = null;       // wartości ustalone w ostatnim zdaniu bloku: { keys: Set, how: 'assume' | 'derive' }
      this.sentences = [];
      this.rootKey = null;    // klucz dowodzonej formuły — w wartościach σ̂(…) zastępuje ją nazwa φ
      this.renamed = new Map();
      this.announced = new Set();   // formuły, których dowód został już zapowiedziany („Pokażemy, że …”)
    }

    /* ---------- wartości logiczne ---------- */

    /** Formuła z dowodzoną formułą (także jako podformułą) zastąpioną nazwą φ. */
    rename(f) {
      if (this.rootKey === null) return f;
      const k = key(f);
      if (!this.renamed.has(k)) {
        let g = f;
        if (k === this.rootKey) g = PHI;
        else if (f.a) {
          const a = this.rename(f.a), b = f.b ? this.rename(f.b) : null;
          if (a !== f.a || b !== (f.b || null)) g = { ...f, a, ...(f.b ? { b } : {}) };
        }
        this.renamed.set(k, g);
      }
      return this.renamed.get(k);
    }

    is(f) { return val(this.rename(f), true); }
    isNot(f) { return val(this.rename(f), false); }

    /** Wniosek kroku: σ̂(φ) = T, a dla ⊥ — sprzeczność, bo σ̂(⊥) jest zawsze równe F. */
    outcome(f) { return f.t === 'F' ? T`${this.is(BOT)} — sprzeczność, bo zawsze ${this.isNot(BOT)}` : this.is(f); }

    /* ---------- bloki, zasięgi, zdania ---------- */

    open() {
      const b = { items: [] };
      this.block.items.push(b);
      this.parents.push(this.block);
      this.block = b;
      this.last = null;
    }

    close() {
      this.block = this.parents.pop();
      this.last = null;
    }

    known(k) {
      for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].has(k)) return this.scopes[i].get(k);
      return undefined;
    }

    learn(f, how) { this.scopes[this.scopes.length - 1].set(key(f), how); }

    say(segs, meta = {}) {
      const s = { segs: this.varied(segs), nodes: [], event: 'infer', ...meta };
      if (s.concl && s.concl.t === 'F') s.contra = true;
      this.block.items.push(s);
      this.sentences.push(s);
      if (s.concl) this.last = { keys: new Set([key(s.concl)]), how: s.how || 'derive' };
      return s;
    }

    /** Zamienia słowo otwierające zdanie, jeśli poprzednie zdanie bloku zaczyna się tak samo. */
    varied(segs) {
      const prev = this.lastSentence(), first = segs[0];
      if (!prev || typeof first !== 'string' || typeof prev.segs[0] !== 'string') return segs;
      const word = first.split(/[\s,]/)[0];
      if (!OPENER_ALTERNATIVES[word] || !prev.segs[0].startsWith(word)) return segs;
      return [OPENER_ALTERNATIVES[word] + first.slice(word.length), ...segs.slice(1)];
    }

    lastSentence() {
      const it = this.block.items[this.block.items.length - 1];
      return it && it.segs ? it : null;
    }

    /** Ostatnie zdanie z kropką na końcu bez kropki (do dopisania dalszej części). */
    static dropPeriod(s) {
      const end = s.segs[s.segs.length - 1];
      if (typeof end !== 'string' || !end.endsWith('.')) return false;
      if (end === '.') s.segs.pop(); else s.segs[s.segs.length - 1] = end.slice(0, -1);
      return true;
    }

    /**
     * Dopisuje `tail` (zaczynający się od przecinka) do ostatniego zdania, które ustaliło
     * wartość `f`. Rozszerzone zdanie jest „zamknięte” — kolejne (∧e) już się do niego nie dołączą.
     */
    extendLast(f, tail, n) {
      const s = this.lastSentence();
      if (!this.merge || !s || s.contra || !s.concl || !eq(s.concl, f) || !ProseWriter.dropPeriod(s)) return false;
      s.segs.push(...tail);
      s.nodes.push(n);
      s.contra = true;
      s.concl = n.f;
      s.projection = null;
      this.last = { keys: new Set([key(n.f)]), how: 'derive' };
      return true;
    }

    /* ---------- ustalanie wartości ---------- */

    /**
     * Zapewnia, że wartość formuły węzła `n` jest ustalona; zwraca sposób odwołania się do niej:
     * 'hyp' (założenie przypadku), 'known' (pokazana wcześniej), 'fresh' (właśnie pokazana).
     */
    establish(n) {
      if (n.rule === 'hyp') return { kind: 'hyp', f: n.f, n };
      const seen = this.skipKnown ? this.known(key(n.f)) : undefined;
      if (seen) return { kind: seen === 'hyp' ? 'hyp' : 'known', f: n.f, n };
      this.derive(n);
      this.learn(n.f, 'derived');
      return { kind: 'fresh', f: n.f, n };
    }

    isLastAssumption(ref) {
      return ref.kind === 'hyp' && !!this.last && this.last.how === 'assume' && this.last.keys.has(key(ref.f));
    }

    /** Czy wartość przesłanki ustaliło właśnie poprzednie zdanie (można napisać „Stąd”, „Zatem”). */
    isLastFact(ref) {
      return ref.kind !== 'hyp' && !!this.last && this.last.how === 'derive' && this.last.keys.has(key(ref.f));
    }

    /**
     * Przesłanka w zdaniu „Skoro …”: σ̂(α) = T, z dopiskiem przy założeniach — w wyliczeniu
     * przy każdym, a pojedynczo tylko przy wcześniejszych (o świeżym założeniu właśnie mowa).
     */
    fact(ref, { listed = false } = {}) {
      const annotate = ref.kind === 'hyp' && (listed || !this.isLastAssumption(ref));
      return annotate ? T`${this.is(ref.f)} (z założenia)` : this.is(ref.f);
    }

    /** Początek zdania wnioskującego z jednej przesłanki: „Stąd”, „Wtedy” albo „Skoro σ̂(α) = T, to”. */
    leadFor(ref) {
      if (this.isLastFact(ref)) return T`Stąd`;
      if (this.isLastAssumption(ref)) return T`Wtedy`;
      return T`Skoro ${this.fact(ref)}, to`;
    }

    /** Zdanie-wniosek: początek (skąd znamy przesłanki), uzasadnienie (definicja σ̂) i wartość wniosku. */
    infer(n, refs, why, concl = this.outcome(n.f)) {
      const unique = uniqueBy(refs, r => r.f);
      const lead = unique.length > 1 && unique.every(r => this.isLastFact(r)) ? T`Zatem`
        : unique.length === 1 ? this.leadFor(unique[0])
          : T`Skoro ${list(unique.map(r => this.fact(r, { listed: true })), ' i ')}, to`;
      return this.say(T`${lead} ${why} ${concl}${rule(n.rule)}.`, { nodes: [n], concl: n.f });
    }

    /* ---------- reguły ---------- */

    derive(n) {
      switch (n.rule) {
        case 'topI': return this.say(T`Z definicji ${this.is(n.f)}${rule('topI')}.`, { nodes: [n], concl: n.f });
        case 'andI': return this.conjunction(n);
        case 'orI1': case 'orI2': return this.infer(n, [this.establish(n.prem[0])], 'z definicji alternatywy');
        case 'andE1': case 'andE2': return this.projection(n);
        case 'nnE': return isRAA(n) ? this.byContradiction(n) : this.doubleNegation(n);
        case 'impE': return this.infer(n, [this.establish(n.prem[0]), this.establish(n.prem[1])], 'z definicji implikacji');
        case 'notE': return this.contradiction(n);
        case 'botE': return this.explosion(n);
        case 'impI': return this.implication(n);
        case 'notI': return this.negation(n);
        case 'orE': return this.cases(n);
        default: return this.say(T`${this.is(n.f)}.`, { nodes: [n], concl: n.f });
      }
    }

    doubleNegation(n) {
      const ref = this.establish(n.prem[0]);
      return this.infer(n, [ref], 'z definicji negacji', T`${this.isNot(NOT(n.f))}, a więc ${this.is(n.f)}`);
    }

    /**
     * (∧e) — kolejne eliminacje z tej samej koniunkcji („σ̂(α) = T oraz σ̂(β) = T”)
     * i łańcuchy eliminacji („σ̂(α ∧ β) = T, a stąd σ̂(α) = T”) łączą się w jedno zdanie.
     */
    projection(n) {
      const ref = this.establish(n.prem[0]);
      const prev = this.lastSentence(), pj = prev && prev.projection;
      const part = T`${this.outcome(n.f)}${rule(n.rule)}`;
      const same = !!pj && pj.mode === 'same' && ref.kind !== 'fresh' && pj.src === key(ref.f);
      const chained = !!pj && ref.kind === 'fresh' && eq(prev.concl, ref.f);
      if (this.merge && (same || chained)) {
        pj.parts.push([chained ? ', a stąd ' : ' oraz ', part]);
        if (chained) pj.mode = 'chain';
        prev.segs = T`${pj.lead}${BY_CONJUNCTION}${pj.parts.map(([glue, p], i) => (i ? [glue, p] : p))}.`;
        prev.nodes.push(n);
        prev.concl = n.f;
        if (n.f.t === 'F') prev.contra = true;
        this.last.keys.add(key(n.f));
        return prev;
      }
      const s = this.say(T`${this.leadFor(ref)}${BY_CONJUNCTION}${part}.`, { nodes: [n], concl: n.f });
      // początek zdania (po ewentualnej zmianie słowa otwierającego) — do późniejszego łączenia
      s.projection = { src: key(ref.f), lead: s.segs.slice(0, s.segs.indexOf(BY_CONJUNCTION)), parts: [['', part]], mode: 'same' };
      return s;
    }

    conjunction(n) {
      const [a, b] = n.prem;
      const heavy = x => x.rule !== 'hyp' && !(this.skipKnown && this.known(key(x.f))) && workIn(x) >= 3;
      const announce = this.merge && heavy(a) && heavy(b);
      if (announce) this.announce(a.f, T`Pokażemy najpierw, że ${this.is(a.f)}.`);
      const ra = this.establish(a);
      // druga część mogła zostać pokazana „po drodze” — wtedy nie zapowiadamy jej dowodu
      if (announce && heavy(b)) this.announce(b.f, T`Teraz pokażemy, że ${this.is(b.f)}.`);
      const rb = this.establish(b);
      return this.infer(n, [ra, rb], 'z definicji koniunkcji');
    }

    /** (¬e): wartości σ̂(α) = T i σ̂(¬α) = T są sprzeczne — rozważany przypadek jest niemożliwy. */
    contradiction(n) {
      const ra = this.establish(n.prem[0]), rn = this.establish(n.prem[1]);
      const a = ra.f, tag = rule('notE');
      const against = r => (r.kind === 'hyp' ? T`założeniu ${this.is(r.f)}` : T`temu, że ${this.is(r.f)}`);
      if (this.isLastFact(ra) && rn.kind !== 'fresh'
        && this.extendLast(a, T`, co przeczy ${against(rn)} (czyli ${this.isNot(a)})${tag}.`, n)) return;
      if (this.isLastFact(rn) && ra.kind !== 'fresh'
        && this.extendLast(rn.f, T`, czyli ${this.isNot(a)}, co przeczy ${against(ra)}${tag}.`, n)) return;
      const meta = { nodes: [n], concl: n.f, contra: true };
      if (ra.kind === 'hyp' && rn.kind === 'hyp') {
        this.say(T`Założenia ${this.is(a)} i ${this.is(rn.f)} są sprzeczne, bo z definicji negacji ${this.is(rn.f)} oznacza, że ${this.isNot(a)}${tag}.`, meta);
      } else {
        this.say(T`Mamy ${this.fact(ra, { listed: true })} oraz ${this.fact(rn, { listed: true })}, czyli ${this.isNot(a)} — sprzeczność${tag}.`, meta);
      }
    }

    /** Zapowiedź dowodu formuły (nota); kolejna zapowiedź tej samej formuły jest pomijana. */
    announce(f, segs) {
      this.announced.add(key(f));
      this.say(segs, { event: 'note' });
    }

    /** (⊥e): w niemożliwym przypadku każda formuła ma wartość T. */
    explosion(n) {
      const ref = this.establish(n.prem[0]), concl = T`${this.is(n.f)}${rule('botE')}`;
      const text = ref.kind !== 'hyp' ? T`Ten przypadek jest więc niemożliwy, a zatem w szczególności ${concl}.`
        : this.isLastAssumption(ref) ? T`To jednak niemożliwe, bo zawsze ${this.isNot(BOT)}, więc ten przypadek nie zachodzi — w szczególności ${concl}.`
          : T`Założenie ${this.is(BOT)} nie może zachodzić (zawsze ${this.isNot(BOT)}), więc ten przypadek jest niemożliwy — w szczególności ${concl}.`;
      return this.say(text, { nodes: [n], concl: n.f });
    }

    /** Cel okna (bez zdania otwierającego): jego dowód albo przypomnienie, skąd znamy jego wartość. */
    body(goal) {
      const ref = this.establish(goal);
      if (ref.kind === 'hyp') {
        const text = goal.f.t === 'F' ? T`To jednak niemożliwe, bo zawsze ${this.isNot(BOT)}.`
          : this.isLastAssumption(ref) ? T`Wtedy oczywiście ${this.is(goal.f)}.` : T`Wtedy z założenia ${this.is(goal.f)}.`;
        this.say(text, { event: 'hyp', nodes: [goal], concl: goal.f });
      } else if (ref.kind === 'known') {
        this.say(T`Jak już wiemy, ${this.is(goal.f)}.`, { event: 'note', concl: goal.f });
      }
    }

    /** „; trzeba wykazać, że σ̂(β) = T” — cel przypadku, gdy jego dowód nie jest natychmiastowy. */
    subgoal(goal) {
      if (workIn(goal) < 2) return [];
      return goal.f.t === 'F' ? T`; trzeba wykazać, że ten przypadek jest niemożliwy` : T`; trzeba wykazać, że ${this.is(goal.f)}`;
    }

    /**
     * Okno reguły: zdanie otwierające (założenie przypadku) i dowód wewnątrz. Okno to wcięty
     * blok, chyba że `flat` (okien przy korzeniu nie wcinamy). Zwraca, czy kończy się sprzecznością.
     */
    within(n, index, opening, flat = false) {
      const b = n.prem[index];
      if (!flat) this.open();
      this.scopes.push(new Map());
      this.say(opening, { event: 'assume', nodes: [n], box: index, concl: b.a, how: 'assume' });
      this.learn(b.a, 'hyp');
      this.body(b.body);
      const s = this.lastSentence();
      const contra = !!(s && s.contra);
      this.scopes.pop();
      if (!flat) this.close();
      return contra;
    }

    /** (⇒i): przypadek σ̂(α) = F jest oczywisty, w przypadku σ̂(α) = T dowodzimy σ̂(β) = T. */
    implication(n) {
      const box = n.prem[0], a = box.a;
      const intro = this.announced.has(key(n.f)) ? [] : T`Pokażemy, że ${this.is(n.f)}. `;
      this.say(T`${intro}Rozważmy dwa przypadki. Przypadek, gdy poprzednik jest fałszywy, jest trywialny.`, { event: 'note' });
      const contra = this.within(n, 0, T`Załóżmy teraz, że ${this.is(a)}${this.subgoal(box.body)}.`);
      return this.say(contra
        ? T`Przypadek ${this.is(a)} jest więc niemożliwy, zatem ${this.is(n.f)}${rule('impI')}.`
        : T`Zatem w obu przypadkach ${this.is(n.f)}${rule('impI')}.`, { nodes: [n], concl: n.f });
    }

    /** (¬i): przypuszczenie σ̂(α) = T prowadzi do sprzeczności, więc σ̂(α) = F. */
    negation(n, flat = false) {
      const a = n.prem[0].a;
      if (!flat && !this.announced.has(key(n.f))) this.say(T`Pokażemy, że ${this.is(n.f)}, czyli że ${this.isNot(a)}.`, { event: 'note' });
      const contra = this.within(n, 0, T`Przypuśćmy, że ${this.is(a)}.`, flat);
      const lead = contra ? T`Zatem` : T`Otrzymaliśmy sprzeczność, zatem`;
      return this.say(T`${lead} ${this.isNot(a)}, czyli z definicji negacji ${this.is(n.f)}${rule('notI')}.`, { nodes: [n], concl: n.f });
    }

    /** Dowód nie wprost: przypuszczenie σ̂(φ) = F, czyli σ̂(¬φ) = T, prowadzi do sprzeczności. */
    byContradiction(n, flat = false) {
      const inner = n.prem[0], f = n.f;
      this.within(inner, 0, T`Przypuśćmy nie wprost, że ${this.isNot(f)}, czyli ${this.is(NOT(f))}.`, flat);
      if (!this.merge) {
        this.say(T`Zatem ${this.isNot(NOT(f))}, czyli z definicji negacji ${this.is(NOT(NOT(f)))}${rule('notI')}.`, { nodes: [inner], concl: inner.f });
        return this.say(T`Stąd z definicji negacji ${this.is(f)}${rule('nnE')}.`, { nodes: [n], concl: n.f });
      }
      this.learn(inner.f, 'derived');
      return this.say(T`Zatem ${this.isNot(NOT(f))}${rule('notI')}, a więc z definicji negacji ${this.is(f)}${rule('nnE')}.`,
        { nodes: [inner, n], concl: n.f });
    }

    /** (∨e): z σ̂(α ∨ β) = T mamy σ̂(α) = T lub σ̂(β) = T — rozważamy oba przypadki. */
    cases(n) {
      const d = n.prem[0], D = d.f;
      const ref = this.establish(d);
      this.say(T`${this.leadFor(ref)} z definicji alternatywy ${this.is(D.a)} lub ${this.is(D.b)}. Rozważmy oba przypadki.`, { event: 'note' });
      this.within(n, 1, T`${strong('Przypadek 1:')} ${this.is(n.prem[1].a)}.`);
      this.within(n, 2, T`${strong('Przypadek 2:')} ${this.is(n.prem[2].a)}.`);
      return this.say(n.f.t === 'F'
        ? T`W obu przypadkach otrzymaliśmy sprzeczność${rule('orE')}.`
        : T`Zatem w obu przypadkach ${this.is(n.f)}${rule('orE')}.`, { nodes: [n], concl: n.f });
    }

    /* ---------- korzeń ---------- */

    /**
     * Cały dowód: cel (φ jest tautologią), dowolne wartościowanie σ, uzasadnienie σ̂(φ) = T
     * i wniosek. W dowodzie do czytania okna przy korzeniu są „spłaszczone”.
     */
    proveRoot(root) {
      if (size(root.f) > 1) this.rootKey = key(root.f);
      this.say(T`Rozważmy formułę ${PHI} = ${root.f}. Aby pokazać, że ${PHI} jest tautologią, weźmy dowolne wartościowanie ${sym('σ')} i pokażmy, że ${val(PHI)}.`, { event: 'note' });
      if (this.merge && root.rule === 'impI') this.implicationChain(root);
      else if (this.merge && root.rule === 'notI') this.negation(root, true);
      else if (this.merge && isRAA(root)) this.byContradiction(root, true);
      else this.establish(root);
      this.say(T`Ponieważ wartościowanie ${sym('σ')} było dowolne, formuła ${PHI} jest tautologią.`, { event: 'note' }).segs.push(' ', QED);
    }

    /** Łańcuch (⇒i) przy korzeniu: φ = α₁ ⇒ (α₂ ⇒ … ⇒ β) — wystarczy przypadek σ̂(αᵢ) = T dla wszystkich i. */
    implicationChain(root) {
      const chain = [];
      for (let n = root; n.rule === 'impI'; n = n.prem[0].body) chain.push(n);
      const goal = chain[chain.length - 1].prem[0].body;
      this.scopes.push(new Map());
      const single = chain.length === 1;
      this.say(single
        ? T`Rozważmy dwa przypadki. Przypadek, gdy poprzednik jest fałszywy, jest trywialny.`
        : T`Przypadek, gdy któryś z poprzedników jest fałszywy, jest trywialny.`, { event: 'note' });
      chain.forEach((c, i) => {
        const a = c.prem[0].a, last = i === chain.length - 1;
        const opening = i > 0 ? T`Załóżmy ponadto, że ${this.is(a)}` : single ? T`Załóżmy teraz, że ${this.is(a)}` : T`Załóżmy więc, że ${this.is(a)}`;
        this.say(T`${opening}${last ? this.subgoal(goal) : []}.`, { event: 'assume', nodes: [c], box: 0, concl: a, how: 'assume' });
        this.learn(a, 'hyp');
      });
      this.body(goal);
      const s = this.lastSentence(), contra = !!(s && s.contra), nodes = [...chain].reverse();
      const end = T`z definicji implikacji także w tym przypadku ${this.is(root.f)}${rule('impI')}`;
      if (contra) this.say(T`Ten przypadek jest więc niemożliwy, zatem zawsze ${this.is(root.f)}${rule('impI')}.`, { nodes, concl: root.f });
      // cel jest założeniem: „Wtedy z założenia σ̂(β) = T, a więc z definicji implikacji …”
      else if (s && s.event === 'hyp' && ProseWriter.dropPeriod(s)) { s.segs.push(...T`, a więc ${end}.`); s.nodes.push(...nodes); }
      else this.say(T`Zatem ${end}.`, { nodes, concl: root.f });
      this.scopes.pop();
    }
  }

  /**
   * Dowód w języku naturalnym (semantyczny) dla kompletnego, poprawnego dowodu.
   * Zwraca { blocks, sentences }: drzewo akapitów oraz wszystkie zdania w kolejności czytania
   * (zdania z węzłami opisują kroki dowodu, noty — komentarze między nimi).
   */
  function prose(root, opts) {
    const w = new ProseWriter(opts);
    w.proveRoot(root);
    return { blocks: w.top, sentences: w.sentences };
  }

  ND.Explain = Object.freeze({ goalStep, hintIdea, hintStep, prose, isRAA });
})(globalThis.ND ||= {});
