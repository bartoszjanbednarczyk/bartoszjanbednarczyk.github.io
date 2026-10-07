/* =====================================================================
   Podpowiedzi: trzy poziomy (wskazówka → reguła → wykonanie kroku),
   a gdy cel nie wynika z założeń — kontrprzykład i wskazanie kroku,
   który zaprowadził w ślepy zaułek. Podpowiedzi działają tylko w zadaniach
   przykładowych (Examples.isSample) i w dowodzie z samouczka — zadania ze
   skryptu i pozostałe formuły trzeba rozwiązywać samodzielnie.
     stan: { goalId, level, step: { rule, arg }, idea, next }
         | { goalId, dead: true, valuation, culprit } | { goalId, fail: true }
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules, Prover, Explain, Render, Seg, Examples } = ND;
  const UI = (ND.UI ||= {});
  const { $, icon, toast, anyOverlay } = UI.kit;
  const S = UI.store, st = S.state;
  const { T, rule } = Seg;

  /* ---------- gdzie wolno podpowiadać ---------- */

  const LOCKED = 'Podpowiedzi działają tylko w zadaniach przykładowych — wybierz je z menu „Przykłady”';

  /** Czy we fragmencie o tym korzeniu działają podpowiedzi (zadanie przykładowe albo dowód z samouczka). */
  const allowedRoot = root => !!root && (Examples.isSample(root.f)
    || !!(UI.tutorial && UI.tutorial.isTutorialProof && UI.tutorial.isTutorialProof(root)));

  /** Czy podpowiedź działa dla węzła (wpisu indeksu) — rozstrzyga korzeń jego fragmentu. */
  const allowedFor = info => !!info && allowedRoot(st.frags[info.fi]);

  /** Czy w obszarze roboczym jest choć jeden fragment, w którym działają podpowiedzi. */
  const available = () => st.frags.some(allowedRoot);

  /* ---------- plany: dowody, z których pochodzą kolejne podpowiedzi ---------- */

  /**
   * id celu → dowód zaplanowany dla tego celu (z dowodzącego). Gdy do celu zastosowano
   * regułę zgodną z planem, cele-przesłanki dziedziczą jego poddowody — kolejne podpowiedzi
   * prowadzą więc jednym dowodem do końca. (Liczenie dowodu od nowa dla każdego celu potrafi
   * się zapętlić, np. ⇒e i ⇒i na przemian dla ((p ⇒ q) ⇒ (q ⇒ p)) ⇒ (q ⇒ p).)
   */
  const plans = new Map();
  const MAX_PLANS = 5000;

  function remember(id, plan) {
    if (plans.size >= MAX_PLANS) plans.clear();
    plans.set(id, plan);
  }

  /** Czy węzeł ma regułę i przesłanki (formuły, okna) takie jak w planie. */
  const followsPlan = (n, plan) => n.rule === plan.rule && n.prem.length === plan.prem.length
    && n.prem.every((p, i) => {
      const q = plan.prem[i];
      return p.box ? !!q.box && F.eq(p.a, q.a) && F.eq(p.body.f, q.body.f) : !q.box && F.eq(p.f, q.f);
    });

  /** Czy plan jest poprawny w danym zasięgu założeń (np. po odłączeniu poddrzewa może nie być). */
  const fitsScope = (plan, scope) => (plan.rule === 'hyp' ? Proof.inScope(scope, plan.f)
    : plan.prem.every(p => (p.box ? fitsScope(p.body, [...scope, p.a]) : fitsScope(p, scope))));

  /** Poddowód odziedziczony po planie rodzica — o ile rodzic został uzasadniony zgodnie z planem. */
  function inheritedPlan(info) {
    if (info.up === null) return null;
    const parent = st.idx.get(info.up), plan = plans.get(info.up);
    if (!parent || !plan || !followsPlan(parent.n, plan)) return null;
    const step = plan.prem[info.parent.box ? parent.n.prem.indexOf(info.parent) : info.slot];
    const sub = step && (step.box ? step.body : step);
    return sub && F.eq(sub.f, info.n.f) && fitsScope(sub, info.scope) ? sub : null;
  }

  /* ---------- obliczanie podpowiedzi ---------- */

  /** Podpowiedź dla otwartego celu `info` (z indeksu). */
  function compute(info) {
    const goal = info.n.f, assumptions = info.scope;
    const planned = inheritedPlan(info);
    const valuation = planned ? null : F.countermodel(assumptions, goal);
    if (valuation) {
      let culprit = null;
      for (let up = info.up; up !== null;) {
        const u = st.idx.get(up);
        if (!F.countermodel(u.scope, u.n.f)) { culprit = up; break; }
        up = u.up;
      }
      return { goalId: info.n.id, dead: true, valuation, culprit };
    }
    const proof = planned || Prover.prove(assumptions, goal);
    if (!proof) return { goalId: info.n.id, fail: true };
    remember(info.n.id, proof);
    return {
      goalId: info.n.id, level: 1,
      step: { rule: proof.rule, arg: Rules.paramOf(proof) },
      idea: Explain.hintIdea(proof), next: Explain.hintStep(proof),
    };
  }

  /** Podpowiedź traci ważność, gdy jej cel zniknął, został uzasadniony albo zmieniło się zaznaczenie. */
  function validate() {
    const h = st.hint;
    if (!h) return;
    const g = st.idx.get(h.goalId);
    const stale = !g || !Proof.isOpen(g.n) || !allowedFor(g) || st.mode !== 'back' || st.sel.length !== 1 || st.sel[0] !== h.goalId
      || (h.culprit != null && !st.idx.has(h.culprit));
    if (stale) st.hint = null;
  }

  /**
   * Cel podpowiedzi: zaznaczony otwarty cel albo pierwszy otwarty cel (najpierw we fragmencie
   * zaznaczenia), pomijając fragmenty bez podpowiedzi. 'locked' — są otwarte cele, ale żaden
   * (albo zaznaczony) nie leży w zadaniu przykładowym; null — wszystkie cele są zamknięte.
   */
  function target() {
    const cur = st.sel.length ? st.idx.get(st.sel[st.sel.length - 1]) : null;
    if (cur && st.sel.length === 1 && Proof.isOpen(cur.n)) return allowedFor(cur) ? cur : 'locked';
    const order = cur ? [st.frags[cur.fi], ...st.frags.filter((_, i) => i !== cur.fi)] : st.frags;
    let locked = false;
    for (const root of order) {
      const leaf = Proof.openLeaves(root)[0];
      if (!leaf) continue;
      if (allowedRoot(root)) return st.idx.get(leaf.id);
      locked = true;
    }
    return locked ? 'locked' : null;
  }

  /** Klawisz H / przycisk „Podpowiedź”: kolejne naciśnięcia odsłaniają kolejne poziomy. */
  function press() {
    if (anyOverlay()) return;
    if (!st.frags.length) { toast('Najpierw dodaj cel do udowodnienia'); return; }
    if (target() === 'locked') { st.hint = null; S.refresh(); toast(LOCKED); return; }
    if (st.mode === 'fwd') { S.setMode('back'); toast('Podpowiedzi działają w trybie „od celu” — przełączono'); }
    const t = target();
    if (t === 'locked') { st.hint = null; S.refresh(); toast(LOCKED); return; }
    if (!t) { st.hint = null; S.refresh(); toast('Wszystkie cele są zamknięte — dowód jest kompletny'); return; }
    const h = st.hint;
    if (h && h.goalId === t.n.id && st.sel.length === 1 && st.sel[0] === t.n.id) {
      if (h.step && h.level === 1) { h.level = 2; S.refresh(); return; }
      if (h.step) { act('do'); return; }
      if (h.dead && h.culprit !== null) { act('undo'); return; }
      return;
    }
    st.sel = [t.n.id];
    st.hint = compute(t);
    S.refresh();
    UI.workspace.reveal(t.n.id);
  }

  function act(action) {
    const h = st.hint;
    if (action === 'start') { press(); return; }
    if (!h) return;
    if (action === 'more' && h.step) { h.level = 2; S.refresh(); return; }
    if (action === 'do' && h.step) {
      st.hint = null;
      const info = st.idx.get(h.goalId);
      if (!info || !Proof.isOpen(info.n)) { S.refresh(); return; }
      UI.actions.applyStep(h.step.rule, info, h.step.arg);
      return;
    }
    if (action === 'undo' && h.culprit !== null) {
      const culprit = h.culprit;
      st.hint = null;
      S.commit(() => {
        const c = st.idx.get(culprit);
        if (!c) return false;
        c.n.rule = null;
        c.n.prem = [];
        return true;
      }, { select: () => [culprit] });
      toast('Cofnięto krok prowadzący do ślepego zaułka — razem ze wszystkim nad nim');
    }
  }

  /* ---------- wygląd ---------- */

  /** Przycisk „Podpowiedź” na górnym pasku: wyszarzony, gdy w obszarze roboczym nie ma zadania przykładowego. */
  function syncButton() {
    const b = $('hintBtn');
    if (!b) return;
    const on = available();
    b.classList.toggle('off', !on);
    b.setAttribute('aria-disabled', String(!on));
    b.title = on ? 'Podpowiedź dla zaznaczonego lub następnego celu (H)' : LOCKED;
  }

  /** Klasy formuły węzła wynikające z podpowiedzi. */
  function classesFor(n) {
    const h = st.hint;
    if (!h) return [];
    const cls = [];
    if (h.dead && h.goalId === n.id) cls.push('dead');
    if (h.culprit === n.id) cls.push('culprit');
    return cls;
  }

  /** Reguła wskazana przez podpowiedź (pulsuje na pasku i w tabeli). */
  const hintedRule = () => (st.hint && st.hint.step && st.hint.level >= 2 ? st.hint.step.rule : null);

  /** Formuła-parametr podpowiedzi dla reguły zastosowanej do celu (wyróżniona w kreatorze). */
  function bestArgs(ruleId, goalId) {
    const h = st.hint;
    return h && h.step && h.goalId === goalId && h.step.rule === ruleId && h.step.arg ? [h.step.arg] : [];
  }

  /** Wartościowanie zmiennych jak w skrypcie: „σ(p) = F, σ(q) = T”. */
  const assignmentHTML = v => Object.entries(v)
    .map(([x, b]) => `<span class="math">σ(<i>${Render.esc(x)}</i>) = <span class="tv">${b ? 'T' : 'F'}</span></span>`).join(', ');
  const labelled = segs => Render.segHTML(segs, { rules: true });

  /** Wiersz podpowiedzi na pasku akcji: { cls, html } albo null. */
  function row() {
    const h = st.hint;
    if (!h) return null;
    const goal = st.idx.get(h.goalId);
    if (h.dead) {
      const which = Object.keys(h.valuation).length ? `dla wartościowania ${assignmentHTML(h.valuation)}` : 'dla każdego wartościowania';
      const where = goal.scope.length ? 'wszystkie założenia dostępne w tym miejscu są spełnione, a ' : '';
      let text = `<span class="hlev">Ślepy zaułek</span>Tego celu nie da się tu udowodnić: ${which} ${where}cel ${Render.math(goal.n.f)} nie jest spełniony.`;
      let buttons = '';
      if (h.culprit !== null) {
        const c = st.idx.get(h.culprit);
        text += ` Błąd nastąpił wcześniej: ${labelled(T`reguła ${rule(c.n.rule)} zastosowana do ${c.n.f} dała przesłankę nie do udowodnienia.`)}`;
        buttons = `<button type="button" class="btn" data-hintgo="undo">${icon('undo')}Cofnij ten krok</button>`;
      } else text += ' Ta formuła nie jest tautologią, więc nie ma dowodu.';
      return { cls: 'dock-hint dead', html: `${icon('alert')}<div class="htext">${text}</div><div class="hbtns">${buttons}</div>` };
    }
    if (h.fail) {
      return {
        cls: 'dock-hint',
        html: `${icon('bulb')}<div class="htext"><span class="hlev">Podpowiedź</span>`
          + labelled(T`Nie udało mi się znaleźć podpowiedzi dla tego celu. Spróbuj dowodu nie wprost: ${rule('nnE')}, a potem ${rule('notI')}.`) + '</div>',
      };
    }
    const first = h.level === 1;
    const button = first
      ? '<button type="button" class="btn" data-hintgo="more">Pokaż regułę</button>'
      : '<button type="button" class="btn primary" data-hintgo="do">Wykonaj ten krok</button>';
    return {
      cls: 'dock-hint',
      html: `${icon('bulb')}<div class="htext"><span class="hlev">${first ? 'Wskazówka' : 'Następny krok'}</span>`
        + `${labelled(first ? h.idea : h.next)}</div><div class="hbtns">${button}</div>`,
    };
  }

  UI.hints = Object.freeze({ press, act, validate, classesFor, hintedRule, bestArgs, row, allowedRoot, allowedFor, available, syncButton });
})(globalThis.ND ||= {});
