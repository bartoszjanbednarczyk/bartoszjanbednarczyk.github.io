/* =====================================================================
   Wyjaśnienia po polsku:
     goalStep   — co robi reguła stosowana „od celu” (prezentacja, podpowiedzi),
     hintIdea   — delikatna wskazówka (1. poziom podpowiedzi),
     hintStep   — konkretny następny krok (2. poziom podpowiedzi),
     prose      — dowód w języku naturalnym (okna → wcięte akapity).
   Wynik to segmenty tekstu (ND.Seg) — renderery są w render.js.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { TOP, BOT, AND, NOT, IMP, key, eq } = ND.F;
  const { T, list, rule, sym, strong, QED } = ND.Seg;
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
      case 'topI': return T`Formuła ${TOP} jest prawdziwa bez żadnych przesłanek.`;
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
      case 'topI': return T`Formuła ${TOP} jest zawsze prawdziwa.`;
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
        ? T`Wprost się nie uda. Spróbuj dowodu nie wprost: załóż, że cel jest fałszywy, i dojdź do sprzeczności.`
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
     Dowód w języku naturalnym
     Blok: { items: [zdanie | blok] } — zagnieżdżony blok to treść okna.
     Zdanie: { segs, nodes, event, box, concl, how, contra, projection }
       event: 'assume' (otwarcie okna), 'infer' (wniosek), 'hyp' (użycie założenia), 'note' (komentarz).
       projection: dane do dołączania kolejnych (∧e) — tylko dopóki zdanie nie zostało rozszerzone.
     Każde zdanie z węzłami trafia też do listy kroków (dla prezentacji).
     ===================================================================== */

  /** Zamienniki słów otwierających, by kolejne zdania nie zaczynały się tak samo. */
  const OPENER_ALTERNATIVES = { Zatem: 'W rezultacie', Stąd: 'W takim razie', Wtedy: 'Wówczas' };
  const PROJECTION_VERB = ' w szczególności ';

  /** „zachodzi φ”, a dla ⊥ — „otrzymujemy sprzeczność”. */
  const holds = f => (f.t === 'F' ? T`otrzymujemy sprzeczność` : T`zachodzi ${f}`);

  /** Elementy bez powtórzeń formuł (ta sama formuła wymieniona raz). */
  const uniqueBy = (items, formulaOf) => items.filter((x, i) => items.findIndex(y => key(formulaOf(y)) === key(formulaOf(x))) === i);

  /** Liczba kroków, które trzeba opisać w poddrzewie (bez użyć założeń). */
  const workIn = n => (n.rule === 'hyp' || n.rule === null ? 0 : 1)
    + n.prem.reduce((s, p) => s + workIn(p.box ? p.body : p), 0);

  class ProseWriter {
    /**
     * @param {object} opts
     *   merge      — łączenie zdań i spłaszczanie okien przy korzeniu (dowód do czytania),
     *   skipKnown  — nie powtarzaj wyprowadzeń formuł już udowodnionych w zasięgu.
     */
    constructor({ merge = true, skipKnown = true } = {}) {
      this.merge = merge;
      this.skipKnown = skipKnown;
      this.root = { items: [] };
      this.block = this.root;
      this.parents = [];
      this.scopes = [new Map()];
      this.last = null;     // ostatnio ustalony fakt w bloku: { key, how: 'assume' | 'derive' }
      this.steps = [];
    }

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
      if (s.event !== 'note') this.steps.push(s);
      if (s.concl) this.last = { key: key(s.concl), how: s.how || 'derive' };
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
     * Dopisuje `tail` (zaczynający się od przecinka) do ostatniego zdania, które ustaliło `f`.
     * Rozszerzone zdanie jest „zamknięte” — kolejne (∧e) już się do niego nie dołączą.
     */
    extendLast(f, tail, n) {
      const s = this.lastSentence();
      if (!this.merge || !s || s.contra || !s.concl || !eq(s.concl, f) || !ProseWriter.dropPeriod(s)) return false;
      s.segs.push(...tail);
      s.nodes.push(n);
      s.contra = true;
      s.concl = n.f;
      s.projection = null;
      this.last = { key: key(n.f), how: 'derive' };
      return true;
    }

    /* ---------- ustalanie faktów ---------- */

    /**
     * Zapewnia, że formuła węzła `n` jest ustalona; zwraca sposób odwołania się do niej:
     * 'hyp' (założenie), 'known' (udowodniona wcześniej), 'fresh' (właśnie wyprowadzona).
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
      return ref.kind === 'hyp' && !!this.last && this.last.how === 'assume' && this.last.key === key(ref.f);
    }

    /** Odwołanie do przesłanek, które nie zostały właśnie wyprowadzone: „α”, „założenia α”, „założeń α oraz β”. */
    refList(refs) {
      const facts = refs.filter(r => r.kind !== 'hyp').map(r => r.f);
      const hyps = refs.filter(r => r.kind === 'hyp').map(r => r.f);
      const parts = [];
      if (facts.length) parts.push(list(facts));
      if (hyps.length) parts.push(hyps.length === 1 ? T`założenia ${hyps[0]}` : T`założeń ${list(hyps)}`);
      return list(parts);
    }

    /**
     * Początek zdania mówiący, skąd wiadomo przesłanki:
     * „Wtedy” (świeże założenie), „Stąd”/„Zatem” (właśnie wyprowadzone),
     * „Stąd, wobec założenia α,” (mieszane), „Z założeń α oraz β” (wcześniejsze).
     * plain — czy po początku można dopisać „na mocy modus ponens”.
     */
    from(refs) {
      const fresh = uniqueBy(refs.filter(r => r.kind === 'fresh'), r => r.f);
      const freshKeys = new Set(fresh.map(r => key(r.f)));
      let rest = uniqueBy(refs.filter(r => r.kind !== 'fresh' && !freshKeys.has(key(r.f))), r => r.f);
      let lead = fresh.length > 1 ? 'Zatem' : fresh.length ? 'Stąd' : null;
      const assumed = rest.find(r => this.isLastAssumption(r));
      if (!lead && assumed) { lead = 'Wtedy'; rest = rest.filter(r => r !== assumed); }
      if (!rest.length) return { lead: T`${lead}`, plain: true };
      if (lead) return { lead: T`${lead}, wobec ${this.refList(rest)},`, plain: false };
      return { lead: T`Z ${this.refList(rest)}`, plain: true };
    }

    /* ---------- reguły ---------- */

    derive(n) {
      switch (n.rule) {
        case 'topI': return this.say(T`Formuła ${TOP} jest zawsze prawdziwa${rule('topI')}.`, { nodes: [n], concl: n.f });
        case 'andI': return this.conjunction(n);
        case 'orI1': case 'orI2': return this.oneStep(n, 'tym bardziej');
        case 'andE1': case 'andE2': return this.projection(n);
        case 'nnE': return isRAA(n) ? this.byContradiction(n) : this.oneStep(n, '');
        case 'impE': return this.modusPonens(n);
        case 'notE': return this.contradiction(n);
        case 'botE': return this.explosion(n);
        case 'impI': return this.implication(n);
        case 'notI': return this.negation(n);
        case 'orE': return this.cases(n);
        default: return this.say(T`Zachodzi ${n.f}.`, { nodes: [n], concl: n.f });
      }
    }

    oneStep(n, adverb) {
      const ref = this.establish(n.prem[0]);
      this.say(T`${this.from([ref]).lead}${adverb ? ' ' + adverb : ''} ${holds(n.f)}${rule(n.rule)}.`, { nodes: [n], concl: n.f });
    }

    /**
     * (∧e) — kolejne eliminacje z tej samej koniunkcji („zachodzą α oraz β”)
     * i łańcuchy eliminacji („zachodzą kolejno α, β oraz γ”) łączą się w jedno zdanie.
     */
    projection(n) {
      const ref = this.establish(n.prem[0]);
      const prev = this.lastSentence(), pj = prev && prev.projection;
      const src = key(ref.f);
      const sameSource = !!pj && ref.kind !== 'fresh' && pj.src === src;
      const chained = !!pj && ref.kind === 'fresh' && eq(prev.concl, ref.f);
      if (this.merge && (sameSource || chained)) {
        pj.parts.push([n.f, n.rule]);
        pj.chain = pj.chain || chained;
        const items = list(pj.parts.map(([f, r]) => T`${f}${rule(r)}`));
        prev.segs = T`${pj.lead}${PROJECTION_VERB}zachodzą${pj.chain ? ' kolejno' : ''} ${items}.`;
        prev.nodes.push(n);
        prev.concl = n.f;
        this.last = { key: key(n.f), how: 'derive' };
        return;
      }
      const s = this.say(T`${this.from([ref]).lead}${PROJECTION_VERB}${holds(n.f)}${rule(n.rule)}.`, { nodes: [n], concl: n.f });
      // początek zdania (po ewentualnej zmianie słowa otwierającego) — do późniejszego łączenia
      s.projection = { src, lead: s.segs.slice(0, s.segs.indexOf(PROJECTION_VERB)), parts: [[n.f, n.rule]] };
    }

    conjunction(n) {
      const [a, b] = n.prem;
      const heavy = x => x.rule !== 'hyp' && !(this.skipKnown && this.known(key(x.f))) && workIn(x) >= 3;
      const announce = this.merge && heavy(a) && heavy(b);
      if (announce) this.say(T`Udowodnimy najpierw, że zachodzi ${a.f}.`, { event: 'note' });
      const ra = this.establish(a);
      if (announce) this.say(T`Teraz udowodnimy, że zachodzi ${b.f}.`, { event: 'note' });
      const rb = this.establish(b);
      this.say(T`${this.from([ra, rb]).lead} zachodzi ${n.f}${rule('andI')}.`, { nodes: [n], concl: n.f });
    }

    modusPonens(n) {
      const ra = this.establish(n.prem[0]), ri = this.establish(n.prem[1]);
      const { lead, plain } = this.from([ra, ri]);
      this.say(T`${lead}${plain ? ' na mocy modus ponens' : ''} ${holds(n.f)}${rule('impE')}.`, { nodes: [n], concl: n.f });
    }

    contradiction(n) {
      const ra = this.establish(n.prem[0]), rn = this.establish(n.prem[1]);
      const tag = rule('notE');
      const fresh = [ra, rn].filter(r => r.kind === 'fresh');
      const meta = { nodes: [n], concl: n.f, contra: true };
      if (fresh.length === 1) {
        const other = fresh[0] === ra ? rn : ra;
        const against = other.kind === 'hyp' ? T`założeniu ${other.f}` : T`formule ${other.f}`;
        if (this.extendLast(fresh[0].f, T`, co przeczy ${against}${tag}.`, n)) return;
        this.say(T`Formuła ${fresh[0].f} przeczy ${against}${tag}.`, meta);
      } else if (fresh.length === 2) {
        this.say(T`Otrzymaliśmy sprzeczność: zachodzą zarówno ${ra.f}, jak i ${rn.f}${tag}.`, meta);
      } else if (ra.kind === 'hyp' && rn.kind === 'hyp') {
        this.say(T`Założenia ${ra.f} oraz ${rn.f} są ze sobą sprzeczne${tag}.`, meta);
      } else {
        this.say(T`Formuły ${ra.f} oraz ${rn.f} są ze sobą sprzeczne${tag}.`, meta);
      }
    }

    explosion(n) {
      const ref = this.establish(n.prem[0]);
      const src = ref.kind === 'hyp' ? T`Z założenia ${BOT}` : T`Ze sprzeczności`;
      this.say(T`${src} wynika dowolna formuła, w szczególności ${n.f}${rule('botE')}.`, { nodes: [n], concl: n.f });
    }

    /** Cel okna (bez zdania otwierającego): jego dowód i ewentualne przypomnienie, skąd go znamy. */
    body(goal) {
      const ref = this.establish(goal);
      if (ref.kind === 'hyp') {
        const text = this.isLastAssumption(ref) ? T`Wtedy oczywiście zachodzi ${goal.f}.` : T`Na mocy założenia zachodzi ${goal.f}.`;
        this.say(text, { event: 'hyp', nodes: [goal], concl: goal.f });
      } else if (ref.kind === 'known') {
        this.say(T`Jak już wiemy, zachodzi ${goal.f}.`, { event: 'note', concl: goal.f });
      }
    }

    /**
     * Okno reguły: zdanie otwierające (założenie) i dowód wewnątrz. Okno to wcięty blok,
     * chyba że `flat` (okna przy korzeniu dowodu nie wcinamy). Zwraca, czy kończy się sprzecznością.
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

    implication(n) {
      this.within(n, 0, T`Załóżmy, że zachodzi ${n.prem[0].a}.`);
      return this.say(T`Zatem zachodzi ${n.f}${rule('impI')}.`, { nodes: [n], concl: n.f });
    }

    negation(n, flat = false) {
      const contra = this.within(n, 0, T`Przypuśćmy, że zachodzi ${n.prem[0].a}.`, flat);
      const lead = contra ? T`Zatem` : T`Otrzymaliśmy sprzeczność, zatem`;
      return this.say(T`${lead} zachodzi ${n.f}${rule('notI')}.`, { nodes: [n], concl: n.f });
    }

    byContradiction(n, flat = false) {
      const inner = n.prem[0];
      this.within(inner, 0, T`Przypuśćmy nie wprost, że zachodzi ${inner.prem[0].a}.`, flat);
      if (!this.merge) {
        this.say(T`Doszliśmy do sprzeczności, zatem zachodzi ${inner.f}${rule('notI')}.`, { nodes: [inner], concl: inner.f });
        return this.say(T`Stąd zachodzi ${n.f}${rule('nnE')}.`, { nodes: [n], concl: n.f });
      }
      this.learn(inner.f, 'derived');
      return this.say(T`Doszliśmy do sprzeczności, zatem zachodzi ${inner.f}${rule('notI')}, a więc i ${n.f}${rule('nnE')}.`,
        { nodes: [inner, n], concl: n.f });
    }

    cases(n) {
      const d = n.prem[0];
      const ref = this.establish(d);
      const intro = ref.kind === 'fresh' || this.isLastAssumption(ref) ? T`Rozważmy dwa przypadki.`
        : ref.kind === 'hyp' ? T`Z założenia zachodzi ${d.f}. Rozważmy dwa przypadki.`
          : T`Wiemy, że zachodzi ${d.f}. Rozważmy dwa przypadki.`;
      this.say(intro, { event: 'note' });
      this.within(n, 1, T`${strong('Przypadek 1:')} zachodzi ${n.prem[1].a}.`);
      this.within(n, 2, T`${strong('Przypadek 2:')} zachodzi ${n.prem[2].a}.`);
      this.say(n.f.t === 'F' ? T`W obu przypadkach otrzymaliśmy sprzeczność${rule('orE')}.` : T`W obu przypadkach zachodzi ${n.f}${rule('orE')}.`,
        { nodes: [n], concl: n.f });
    }

    /* ---------- korzeń ---------- */

    /**
     * Korzeń dowodu. W dowodzie do czytania okna przy korzeniu są „spłaszczone”:
     * łańcuch (⇒i) daje „Załóżmy, że α₁. Załóżmy ponadto, że α₂. …”, a ostatnie zdanie kończy dowód.
     */
    proveRoot(root) {
      if (!this.merge) this.establish(root);
      else if (root.rule === 'impI') this.implicationChain(root);
      else if (root.rule === 'notI') this.finish(this.negation(root, true));
      else if (isRAA(root)) this.finish(this.byContradiction(root, true));
      else this.establish(root);
      const items = this.root.items, end = items[items.length - 1];
      if (end && end.segs) end.segs.push(' ', QED);
      else items.push({ segs: [QED], nodes: [], event: 'note' });
    }

    implicationChain(root) {
      const chain = [];
      for (let n = root; n.rule === 'impI'; n = n.prem[0].body) chain.push(n);
      const goal = chain[chain.length - 1].prem[0].body;
      this.scopes.push(new Map());
      chain.forEach((c, i) => {
        const a = c.prem[0].a;
        this.say(i ? T`Załóżmy ponadto, że zachodzi ${a}.` : T`Załóżmy, że zachodzi ${a}.`,
          { event: 'assume', nodes: [c], box: 0, concl: a, how: 'assume' });
        this.learn(a, 'hyp');
      });
      this.body(goal);
      const assumptions = uniqueBy(chain.map(c => c.prem[0].a), f => f);
      const from = assumptions.length > 1 ? T`z założeń ${list(assumptions)}` : T`z założenia ${assumptions[0]}`;
      this.say(T`Pokazaliśmy, że ${from} wynika ${goal.f}, co kończy dowód ${chain.length > 1 ? 'formuły' : 'implikacji'} ${root.f}${rule('impI')}.`,
        { nodes: [...chain].reverse(), concl: root.f });
      this.scopes.pop();
    }

    /** Domyka ostatnie zdanie słowami „co kończy dowód”. */
    finish(s) {
      if (ProseWriter.dropPeriod(s)) s.segs.push(', co kończy dowód.');
    }
  }

  /**
   * Dowód w języku naturalnym dla kompletnego, poprawnego dowodu.
   * Zwraca { blocks, steps }: drzewo akapitów oraz zdania przypisane węzłom (kolejność czytania).
   */
  function prose(root, opts) {
    const w = new ProseWriter(opts);
    w.proveRoot(root);
    return { blocks: w.root, steps: w.steps };
  }

  ND.Explain = Object.freeze({ goalStep, hintIdea, hintStep, prose, isRAA });
})(globalThis.ND ||= {});
