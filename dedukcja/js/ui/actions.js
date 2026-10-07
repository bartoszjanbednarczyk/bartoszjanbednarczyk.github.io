/* =====================================================================
   Akcje użytkownika: dostępność i stosowanie reguł w obu trybach,
   operacje na drzewie, nowe formuły, przykłady, nawigacja.
   Wszystkie zmiany dowodu idą przez store.commit().
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules, Render, Explain, Examples, Seg } = ND;
  const UI = (ND.UI ||= {});
  const { toast, copyText } = UI.kit;
  const S = UI.store, st = S.state;
  const { T } = Seg;

  /* ---------- zaznaczenie ---------- */

  /** Zaznaczone węzły z kontekstem z indeksu (w kolejności klikania). */
  const selection = () => st.sel.map(id => st.idx.get(id)).filter(Boolean);
  const isRoot = info => info.parent === null;
  /** Numer fragmentu, którego dotyczy polecenie: podany, ten z zaznaczeniem albo pierwszy. */
  function targetFragment(i) {
    if (Number.isInteger(i) && st.frags[i]) return i;
    const infos = selection();
    return infos.length ? infos[0].fi : 0;
  }

  /** Zaznaczenie po kroku „od celu”: pierwszy otwarty cel nad węzłem `id`, a gdy go brak — w jego fragmencie. */
  function nextOpenGoal(id) {
    const info = st.idx.get(id);
    if (!info || st.mode !== 'back') return [];
    const pick = Proof.openLeaves(info.n)[0] || Proof.openLeaves(st.frags[info.fi])[0];
    return pick ? [pick.id] : [];
  }

  /* ---------- dostępność reguł ---------- */

  /** Powód, dla którego reguły nie można teraz zastosować (null — można). */
  function blocked(id, infos = selection()) {
    if (id === 'hyp') {
      if (infos.length !== 1) return 'Zaznacz jeden otwarty cel';
      if (!Proof.isOpen(infos[0].n)) return 'Ta formuła ma już uzasadnienie';
      return Proof.inScope(infos[0].scope, infos[0].n.f) ? null : 'Ta formuła nie jest założeniem żadnego okna, w którym leży';
    }
    const r = Rules.get(id);
    if (st.mode === 'back') {
      if (infos.length !== 1) return 'Zaznacz jeden otwarty cel (przerywana ramka)';
      if (!Proof.isOpen(infos[0].n)) return 'Ta formuła ma już uzasadnienie — usuń je, aby wybrać inną regułę';
      return Rules.backBlocked(r, infos[0].n.f);
    }
    if (infos.some(i => !isRoot(i))) return 'W trybie „od przesłanek” zaznaczaj formuły na samym dole fragmentów';
    return Rules.fwdBlocked(r, infos.map(i => i.n.f));
  }

  /**
   * Dostępność wszystkich reguł dla bieżącego zaznaczenia (liczona raz na przerysowanie):
   * { reasons: Map id → powód|null, available: [id], natural: Set id }.
   */
  function availability() {
    const infos = selection();
    const reasons = new Map(Rules.ORDER.map(id => [id, blocked(id, infos)]));
    const available = Rules.ORDER.filter(id => !reasons.get(id));
    let natural;
    if (available.includes('hyp')) natural = new Set(['hyp']);
    else if (st.mode === 'fwd') natural = new Set(available);
    else natural = new Set(infos.length === 1 ? Rules.naturalFor(infos[0].n.f).filter(id => available.includes(id)) : []);
    return { reasons, available, natural };
  }

  /* ---------- parametry reguł (kreator formuł) ---------- */

  /** Formuły podsuwane w kreatorze: podformuły założeń w zasięgu, korzeni i otwartych celów. */
  function candidates(info) {
    const m = new Map();
    if (info) info.scope.forEach(a => F.subformulas(a, m));
    st.frags.forEach(r => {
      F.subformulas(r.f, m);
      Proof.openLeaves(r).forEach(l => F.subformulas(l.f, m));
    });
    return [...m.values()].sort((a, b) => F.key(a).length - F.key(b).length);
  }

  function openGoalFormulas() {
    const m = new Map();
    st.frags.forEach(r => Proof.openFormulas(r).forEach(f => m.set(F.key(f), f)));
    return [...m.values()];
  }

  const paramContext = info => ({ cands: candidates(info), openGoals: openGoalFormulas(), hypothesesOf: n => Proof.openFormulas(n) });
  const dialogTitle = r => `${r.title} (${r.label.text})`;

  /* ---------- stosowanie reguł ---------- */

  function apply(id) {
    const infos = selection();
    const why = blocked(id, infos);
    if (why) { toast(why); return; }
    if (id === 'hyp') closeByAssumption(infos[0]);
    else if (st.mode === 'back') applyBack(Rules.get(id), infos[0]);
    else applyFwd(Rules.get(id), infos);
  }

  /** Zastosowanie kroku podpowiedzi (z gotowym parametrem). */
  function applyStep(ruleId, info, arg) {
    if (ruleId === 'hyp') closeByAssumption(info);
    else applyBack(Rules.get(ruleId), info, arg);
  }

  function closeByAssumption(info) {
    const id = info.n.id;
    S.commit(() => {
      const cur = st.idx.get(id);
      if (!cur || !Proof.isOpen(cur.n) || !Proof.inScope(cur.scope, cur.n.f)) return false;
      cur.n.rule = 'hyp';
      return true;
    }, { celebrate: true, select: () => nextOpenGoal(id) });
  }

  /** „Od celu”: reguła dopisuje nad celem przesłanki (pyta o parametr, jeśli trzeba). */
  async function applyBack(r, info, preset) {
    const goalId = info.n.id, goal = info.n.f;
    let x;
    if (r.back.param) {
      const p = r.back.param;
      x = preset !== undefined ? preset : await UI.ask.ask({
        title: dialogTitle(r), desc: p.desc(goal), check: p.check || null,
        best: [...UI.hints.bestArgs(r.id, goalId), ...p.best(goal, paramContext(info))],
        sugg: p.onlyBest ? [] : candidates(info),
      });
      if (!x) { S.refresh(); return; }
    }
    S.commit(() => {
      const cur = st.idx.get(goalId);
      if (!cur || !Proof.isOpen(cur.n)) return false;         // stan zmienił się w międzyczasie
      cur.n.rule = r.id;
      cur.n.prem = Rules.materialize(r.back.premises(goal, x));
      return true;
    }, { celebrate: true, select: () => nextOpenGoal(goalId) });
  }

  /** „Od przesłanek”: reguła łączy zaznaczone fragmenty w nowy, z wnioskiem na dole. */
  async function applyFwd(r, infos) {
    const { fs, nodes } = Rules.fwdArrange(r, infos.map(i => i.n.f), infos.map(i => i.n));
    let x;
    if (r.fwd.param) {
      const p = r.fwd.param;
      x = await UI.ask.ask({ title: dialogTitle(r), desc: p.desc(fs), best: p.best(fs, paramContext(null), nodes), sugg: candidates(null) });
      if (!x) { S.refresh(); return; }
    }
    let rootId = null;
    S.commit(() => {
      if (!nodes.every(n => st.frags.includes(n))) return false;  // fragmenty zmieniły się w międzyczasie
      const { f, prem } = r.fwd.build(fs, nodes, x);
      const root = Proof.node(f, r.id, Rules.enclose(prem));
      const at = nodes.length ? Math.min(...nodes.map(n => st.frags.indexOf(n))) : st.frags.length;
      st.frags = st.frags.filter(n => !nodes.includes(n));
      st.frags.splice(Math.min(at, st.frags.length), 0, root);
      rootId = root.id;
      return true;
    }, { celebrate: true, select: () => [rootId] });
  }

  /* ---------- operacje na drzewie ---------- */

  /**
   * Operacje edycji: parts(infos) → dane operacji albo null (gdy nie pasuje do zaznaczenia).
   * Kolejność zaznaczenia nie ma znaczenia.
   */
  const OPS = {
    merge: {
      label: 'Wstaw fragment w cel',
      parts(infos) {
        if (infos.length !== 2) return null;
        const fits = (goal, frag) => Proof.isOpen(goal.n) && isRoot(frag) && !Proof.isOpen(frag.n)
          && goal.fi !== frag.fi && F.eq(goal.n.f, frag.n.f);
        const [x, y] = infos;
        return fits(x, y) ? { goal: x, fragment: y } : fits(y, x) ? { goal: y, fragment: x } : null;
      },
      run({ goal, fragment }) {
        S.commit(() => {
          const source = fragment.fi;   // indeks przed podmianą (cel może być korzeniem innego fragmentu)
          Proof.replaceAt(st.frags, goal, fragment.n);
          st.frags.splice(source, 1);
          return true;
        }, { celebrate: true, select: () => [] });
      },
    },
    clear: {
      label: 'Usuń uzasadnienie', title: 'Delete',
      // użycia założenia nie da się „otworzyć”, gdy cele są zamykane automatycznie
      parts: infos => (infos.length === 1 && !Proof.isOpen(infos[0].n) && !(infos[0].n.rule === 'hyp' && S.prefs.autoHyp) ? { info: infos[0] } : null),
      run({ info }) {
        S.commit(() => { info.n.rule = null; info.n.prem = []; return true; }, { select: () => [info.n.id] });
      },
    },
    detach: {
      label: 'Odłącz poddrzewo',
      parts: infos => (infos.length === 1 && !isRoot(infos[0]) && !Proof.isBareLeaf(infos[0].n) ? { info: infos[0] } : null),
      run({ info }) {
        S.commit(() => {
          Proof.replaceAt(st.frags, info, Proof.node(info.n.f));
          st.frags.splice(info.fi + 1, 0, info.n);
          return true;
        }, { select: () => [info.n.id] });
      },
    },
  };

  /** Operacje pasujące do bieżącego zaznaczenia: [[nazwa, operacja]]. */
  const offeredOps = () => { const infos = selection(); return Object.entries(OPS).filter(([, op]) => op.parts(infos)); };

  /** Wykonuje operację, jeśli pasuje do zaznaczenia; zwraca, czy ją wykonano. */
  function runOp(name) {
    const op = OPS[name], parts = op && op.parts(selection());
    if (parts) op.run(parts);
    return !!parts;
  }

  /* ---------- formuły, przykłady, fragmenty ---------- */

  /** Dodaje nowy fragment (cel, przesłankę, przykład) i przewija do niego; zwraca, czy się udało. */
  function addFragment(root, { select = false } = {}) {
    const ok = S.commit(() => { st.frags.push(root); return true; }, { select: () => (select ? [root.id] : []) });
    if (ok) UI.workspace.revealFragment(st.frags.length - 1);
    return ok;
  }

  async function newFormula() {
    const back = st.mode === 'back';
    const f = await UI.ask.ask({
      title: back ? 'Nowy cel' : 'Nowa przesłanka',
      desc: back ? T`Formuła, którą chcesz udowodnić (np. tautologia). Pojawi się jako otwarty cel.`
        : T`Formuła-hipoteza. Pozostaje otwarta, dopóki nie zamkniesz jej w oknie regułą (⇒i), (¬i) lub (∨e).`,
      sugg: st.frags.length ? candidates(null) : [],
      okLabel: back ? 'Dodaj cel' : 'Dodaj przesłankę',
    });
    if (!f) { S.refresh(); return; }
    addFragment(Proof.node(f), { select: true });
  }

  function loadExample(i) {
    const ex = Examples.LIST[i];
    if (!ex) return;
    if (ex.proof) addFragment(ex.proof());
    else {
      S.setMode('back');
      addFragment(Proof.node(F.parse(ex.formula)), { select: true });
    }
  }

  function deleteFragment(i) {
    if (S.commit(() => { if (!st.frags[i]) return false; st.frags.splice(i, 1); return true; }, { select: () => [] })) {
      toast('Usunięto — możesz to cofnąć');
    }
  }

  function clearAll() {
    if (S.commit(() => { if (!st.frags.length) return false; st.frags = []; return true; }, { select: () => [] })) {
      toast('Wyczyszczono — możesz to cofnąć');
    }
  }

  function copyProse(fi, format) {
    const root = st.frags[fi];
    if (!root || !S.status(root).complete) return;
    const prose = Explain.prose(root), opts = { rules: S.prefs.nlRules };
    if (format === 'tex') copyText(Render.proseTeX(prose, opts), 'Skopiowano dowód słowny jako LaTeX');
    else copyText(Render.proseText(prose, opts), 'Skopiowano dowód słowny');
  }

  /* ---------- zaznaczanie ---------- */

  /** Kliknięcie formuły: w trybie „od przesłanek” (albo z Shift/Ctrl/⌘) zaznaczenie wielokrotne. */
  function toggleSelect(id, additive) {
    if (st.mode === 'fwd' || additive) S.select(st.sel.includes(id) ? st.sel.filter(x => x !== id) : [...st.sel, id]);
    else S.select(st.sel.length === 1 && st.sel[0] === id ? [] : [id]);
  }

  function gotoNextOpen() {
    const all = [];
    st.frags.forEach(r => Proof.openLeaves(r).forEach(l => all.push(l.id)));
    if (!all.length) { toast('Brak otwartych celów'); return; }
    const cur = st.sel.length ? all.indexOf(st.sel[st.sel.length - 1]) : -1;
    const id = all[(cur + 1) % all.length];
    S.select([id]);
    UI.workspace.reveal(id);
  }

  UI.actions = Object.freeze({
    selection, isRoot, targetFragment, availability,
    apply, applyStep, offeredOps, runOp,
    addFragment, newFormula, loadExample, deleteFragment, clearAll, copyProse, toggleSelect, gotoNextOpen,
  });
})(globalThis.ND ||= {});
