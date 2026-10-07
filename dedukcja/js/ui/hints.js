/* =====================================================================
   Podpowiedzi: trzy poziomy (wskazówka → reguła → wykonanie kroku),
   a gdy cel nie wynika z założeń — kontrprzykład i wskazanie kroku,
   który zaprowadził w ślepy zaułek.
     stan: { goalId, level, step: { rule, arg }, idea, next }
         | { goalId, dead: true, valuation, culprit } | { goalId, fail: true }
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules, Prover, Explain, Render, Seg } = ND;
  const UI = (ND.UI ||= {});
  const { icon, toast, anyOverlay } = UI.kit;
  const S = UI.store, st = S.state;
  const { T, rule } = Seg;

  /** Podpowiedź dla otwartego celu `info` (z indeksu). */
  function compute(info) {
    const goal = info.n.f, assumptions = info.scope;
    const valuation = F.countermodel(assumptions, goal);
    if (valuation) {
      let culprit = null;
      for (let up = info.up; up !== null;) {
        const u = st.idx.get(up);
        if (!F.countermodel(u.scope, u.n.f)) { culprit = up; break; }
        up = u.up;
      }
      return { goalId: info.n.id, dead: true, valuation, culprit };
    }
    const proof = Prover.prove(assumptions, goal);
    if (!proof) return { goalId: info.n.id, fail: true };
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
    const stale = !g || !Proof.isOpen(g.n) || st.mode !== 'back' || st.sel.length !== 1 || st.sel[0] !== h.goalId
      || (h.culprit != null && !st.idx.has(h.culprit));
    if (stale) st.hint = null;
  }

  /** Cel podpowiedzi: zaznaczony otwarty cel albo pierwszy otwarty cel (najpierw we fragmencie zaznaczenia). */
  function target() {
    const cur = st.sel.length ? st.idx.get(st.sel[st.sel.length - 1]) : null;
    if (cur && st.sel.length === 1 && Proof.isOpen(cur.n)) return cur;
    const order = cur ? [st.frags[cur.fi], ...st.frags.filter((_, i) => i !== cur.fi)] : st.frags;
    for (const root of order) {
      const leaf = Proof.openLeaves(root)[0];
      if (leaf) return st.idx.get(leaf.id);
    }
    return null;
  }

  /** Klawisz H / przycisk „Podpowiedź”: kolejne naciśnięcia odsłaniają kolejne poziomy. */
  function press() {
    if (anyOverlay()) return;
    if (!st.frags.length) { toast('Najpierw dodaj cel do udowodnienia'); return; }
    if (st.mode === 'fwd') { S.setMode('back'); toast('Podpowiedzi działają w trybie „od celu” — przełączono'); }
    const t = target();
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
      toast('Usunięto krok prowadzący do ślepego zaułka');
    }
  }

  /* ---------- wygląd ---------- */

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

  const valuationHTML = v => {
    const pairs = Object.entries(v);
    return pairs.length ? pairs.map(([x, b]) => `<span class="math"><i>${x}</i></span> = ${b ? 1 : 0}`).join(', ') : 'dowolnego wartościowania';
  };
  const labelled = segs => Render.segHTML(segs, { rules: true });

  /** Wiersz podpowiedzi na pasku akcji: { cls, html } albo null. */
  function row() {
    const h = st.hint;
    if (!h) return null;
    const goal = st.idx.get(h.goalId);
    if (h.dead) {
      const where = goal.scope.length ? 'wszystkie założenia dostępne w tym miejscu są prawdziwe, a ' : '';
      let text = `<span class="hlev">Ślepy zaułek</span>Tego celu nie da się tu udowodnić: dla ${valuationHTML(h.valuation)} ${where}cel ${Render.math(goal.n.f)} jest fałszywy.`;
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

  UI.hints = Object.freeze({ press, act, validate, classesFor, hintedRule, bestArgs, row });
})(globalThis.ND ||= {});
