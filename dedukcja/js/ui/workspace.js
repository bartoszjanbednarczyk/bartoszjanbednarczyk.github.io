/* =====================================================================
   Widok obszaru roboczego: fragmenty dowodów (z dowodem słownym),
   tabela reguł, pasek akcji, status i wskazówka; obsługa zdarzeń.
   Logika akcji jest w ui/actions.js.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules, Render, Explain, Examples } = ND;
  const UI = (ND.UI ||= {});
  const { $, icon, scrollToView, markChoice } = UI.kit;
  const S = UI.store, st = S.state;
  const A = UI.actions;

  /** Przyciski z data-act (pusty obszar roboczy, status). */
  const ACTS = { new: () => A.newFormula(), tutorial: () => UI.tutorial.start(), next: () => A.gotoNextOpen() };
  const runAct = el => { const fn = ACTS[el.dataset.act]; if (fn) fn(); };

  const goalsText = n => `${n} ${n === 1 ? 'otwarty cel' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'otwarte cele' : 'otwartych celów'}`;

  /* ---------- przewijanie ---------- */

  /** Przewija do formuły węzła (na środek okna). */
  function reveal(id) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.ws .fm[data-id="${id}"]`);
      if (el) scrollToView(el);
    });
  }

  /** Przewija do fragmentu: wyśrodkowuje go, a wysoki pokazuje od początku (pod nagłówkiem). */
  function revealFragment(i) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.ws .frag[data-fi="${i}"]`);
      if (el) scrollToView(el, el.offsetHeight > 0.6 * window.innerHeight ? 'start' : 'center');
    });
  }

  /* ---------- fragmenty ---------- */

  function sequentHTML(root, status) {
    const hyps = Proof.openFormulas(root);
    if (!hyps.length) return (status.errors ? '' : '⊢ ') + F.html(root.f);
    if (st.mode === 'back') return F.html(root.f);
    return hyps.map(F.html).join(', ') + ' ⊢ ' + F.html(root.f);
  }

  function nodeDecorator(root) {
    const done = S.completeNodes(root);
    return n => {
      const cls = [];
      const selected = st.sel.includes(n.id);
      if (selected) cls.push('sel');
      if (st.errors.has(n.id)) cls.push('err');
      if (S.isFresh(n.id)) cls.push('fresh');
      if (Proof.isOpen(n)) cls.push('open');
      else if (done.has(n.id)) cls.push('done');
      cls.push(...UI.hints.classesFor(n));
      const title = Proof.isOpen(n) ? 'otwarty cel — kliknij, aby wybrać regułę'
        : n.rule === 'hyp' ? 'użycie założenia' : (Rules.get(n.rule) || {}).name || '';
      return { cls: cls.join(' '), title, pressed: selected };
    };
  }

  /** Dowód słowny (HTML) — z pamięcią podręczną, bo fragmenty są przerysowywane przy każdym kliknięciu. */
  const proseCache = new Map();
  function proseHTML(root) {
    const cacheKey = JSON.stringify(Proof.toPlain(root)) + (S.prefs.nlRules ? '|r' : '');
    if (!proseCache.has(cacheKey)) {
      if (proseCache.size > 64) proseCache.clear();
      proseCache.set(cacheKey, Render.proseHTML(Explain.prose(root), { rules: S.prefs.nlRules }));
    }
    return `<details class="nl"${S.prefs.nlOpen ? ' open' : ''}>
      <summary>Dowód w języku naturalnym</summary>
      <div class="nl-tools">
        <label class="chk"><input type="checkbox" data-nlrules${S.prefs.nlRules ? ' checked' : ''}> pokaż nazwy reguł</label>
        <span class="sp"></span>
        <button type="button" class="btn" data-nlcopy="text">${icon('copy')}Kopiuj tekst</button>
        <button type="button" class="btn" data-nlcopy="tex">${icon('code')}Kopiuj LaTeX</button>
      </div>
      <div class="nl-text">${proseCache.get(cacheKey)}</div>
    </details>`;
  }

  function fragmentHTML(root, i, selectedFragments) {
    const s = S.status(root);
    const pill = s.errors ? `<span class="pill bad">błędy: ${s.errors}</span>`
      : s.open ? `<span class="pill">${goalsText(s.open)}</span>`
        : `<span class="pill ok">${icon('check')}dowód kompletny</span>`;
    const actions = [
      `<button type="button" class="btn ${s.complete ? '' : 'ghost'}" data-present="${i}" title="Odtwórz krok po kroku w trybie prezentacji (P)"${s.errors ? ' disabled' : ''}>${icon('play')}<span class="hide-sm">Odtwórz</span></button>`,
      `<button type="button" class="btn ghost" data-export="${i}" title="Eksport: obrazek PNG/SVG albo LaTeX">${icon('download')}<span class="hide-sm">Eksport</span></button>`,
      `<button type="button" class="btn icon danger" data-delfrag="${i}" title="Usuń ten fragment" aria-label="Usuń fragment">${icon('trash')}</button>`,
    ].join('');
    return `<section class="frag card${selectedFragments.has(i) ? ' has-sel' : ''}${s.complete ? ' done' : ''}" data-fi="${i}">
      <div class="fhead"><span class="num">${st.frags.length > 1 ? 'Fragment ' + (i + 1) : 'Dowód'}</span><span class="seq">${sequentHTML(root, s)}</span>${pill}<span class="sp"></span><div class="acts">${actions}</div></div>
      <div class="fbody"><div class="inner">${Render.proofHTML(root, { decorate: nodeDecorator(root), interactive: true })}</div></div>
      ${s.complete ? proseHTML(root) : ''}
    </section>`;
  }

  function emptyHTML() {
    const chips = Examples.LIST.map((e, i) => [e, i]).filter(([e]) => e.group === 's29').slice(0, 6)
      .map(([e, i]) => `<button type="button" data-ex="${i}" title="${Render.esc(`${e.title} — ${e.note}`)}">${F.html(F.parse(e.formula))}</button>`).join('');
    return `<div class="card empty">
      <div class="big">⊢ φ</div>
      <h2>Co chcesz udowodnić?</h2>
      <p>Wpisz formułę rachunku zdań i buduj jej dowód, klikając reguły dedukcji naturalnej. Aplikacja pilnuje poprawności każdego kroku i rysuje dowód z oknami, tak jak w skrypcie.</p>
      <div class="cta">
        <button type="button" class="btn primary lg" data-act="new">${icon('plus')}Wpisz formułę</button>
        <button type="button" class="btn lg" data-act="tutorial">${icon('play')}Samouczek (1 min)</button>
      </div>
      <div class="exchips"><span class="lab">albo zacznij od przykładu ze skryptu:</span>${chips}</div>
      <div class="modes">
        <div><b>↑ Od celu</b><span>Klikasz cel i regułę — nad celem pojawiają się przesłanki do udowodnienia. Najprostszy sposób na start.</span></div>
        <div><b>↓ Od przesłanek</b><span>Zaczynasz od hipotez i łączysz je regułami w coraz większe fragmenty, aż dojdziesz do celu.</span></div>
      </div>
    </div>`;
  }

  /** Selektor elementu z fokusem (do przywrócenia fokusu po przerysowaniu). */
  function focusSelector(el) {
    if (!el || !$('ws').contains(el)) return null;
    for (const attr of ['id', 'present', 'export', 'delfrag', 'nlcopy', 'nlrules', 'act', 'ex']) {
      if (el.dataset[attr] === undefined) continue;
      const frag = el.closest('[data-fi]');
      return `${frag ? `[data-fi="${frag.dataset.fi}"] ` : ''}[data-${attr}="${el.dataset[attr]}"]`;
    }
    return null;
  }

  /** Przerysowuje fragmenty, zachowując przewinięcie szerokich dowodów i fokus klawiatury. */
  function renderFragments() {
    const ws = $('ws');
    const scroll = new Map([...ws.querySelectorAll('.frag')].map(el => [el.dataset.fi, el.querySelector('.fbody').scrollLeft]));
    const focus = focusSelector(document.activeElement);
    if (!st.frags.length) ws.innerHTML = emptyHTML();
    else {
      const selectedFragments = new Set(A.selection().map(i => i.fi));
      ws.innerHTML = st.frags.map((root, i) => fragmentHTML(root, i, selectedFragments)).join('');
      ws.querySelectorAll('.frag').forEach(el => { const x = scroll.get(el.dataset.fi); if (x) el.querySelector('.fbody').scrollLeft = x; });
    }
    if (focus) { const el = ws.querySelector(focus); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- tabela reguł i pasek akcji ---------- */

  function renderRules(av) {
    const anySelected = st.sel.length > 0;
    const hinted = UI.hints.hintedRule();
    let usable = 0;
    document.querySelectorAll('.rcard').forEach(c => {
      const id = c.dataset.rule, why = av.reasons.get(id);
      const ok = !why && (anySelected || id === 'topI');
      if (ok) usable++;
      c.classList.toggle('ok', ok);
      c.classList.toggle('best', ok && av.natural.has(id));
      c.classList.toggle('hinted', hinted === id);
      c.classList.toggle('off', !!why && anySelected);
      c.setAttribute('aria-disabled', String(!!why && anySelected));
      const r = Rules.get(id);
      c.title = `(${r.label.text}) ${r.name}` + (why && anySelected ? ` — ${why}` : '');
    });
    $('rulesSub').textContent = anySelected
      ? (usable ? (st.mode === 'back' && av.natural.size ? 'Wypełniona karta to naturalny wybór dla tego celu; obramowane też pasują.' : `Pasujące reguły (${usable}) są obramowane.`)
        : 'Żadna reguła nie pasuje do tego zaznaczenia.')
      : (st.mode === 'back' ? 'Zaznacz otwarty cel, a podświetlą się reguły, które można do niego zastosować.' : 'Zaznacz formuły na dole fragmentów, a podświetlą się pasujące reguły.');
  }

  function chipHTML(id, natural, hinted) {
    const r = Rules.get(id);
    const label = id === 'hyp' ? 'założenie' : `<span class="math">(${r.label.html})</span>`;
    return `<button type="button" class="chip${natural ? ' best' : ''}${hinted ? ' hinted' : ''}" data-rule="${id}" title="${Render.esc(r.name)}">${label}</button>`;
  }

  function dockMessage(infos) {
    const n = infos.length === 1 ? infos[0].n : null;
    if (n && n.rule === 'hyp') return 'To użycie założenia otaczającego okna.';
    if (st.mode === 'back' && n && !Proof.isOpen(n)) return 'Ta formuła jest już uzasadniona.';
    if (st.mode === 'back' && infos.length > 1) return 'W trybie „od celu” reguły stosuje się do jednego celu naraz.';
    if (st.mode === 'fwd' && infos.some(i => !A.isRoot(i))) return 'W trybie „od przesłanek” zaznaczaj formuły na dole fragmentów.';
    return 'Żadna reguła nie pasuje do tego zaznaczenia.';
  }

  function renderDock(av) {
    const infos = A.selection(), dock = $('dock');
    dock.hidden = !infos.length;
    if (!infos.length) return;
    const n = infos.length === 1 ? infos[0].n : null;
    $('dockSel').innerHTML = n
      ? (Proof.isOpen(n) ? `${st.mode === 'back' ? 'Cel' : 'Hipoteza'}: ${Render.math(n.f)}`
        : n.rule === 'hyp' ? `Założenie: ${Render.math(n.f)}`
          : `${Render.math(n.f)} &nbsp;— z reguły <span class="math">(${Render.label(n.rule).html})</span>`)
      : 'Zaznaczone: ' + infos.map((info, k) => `<b>${k + 1}.</b>&nbsp;${Render.math(info.n.f)}`).join(' &nbsp; ');

    const hinted = UI.hints.hintedRule();
    let rules;
    if (av.available.length) {
      rules = '<span class="grp">Reguły</span>' + av.available.map(id => chipHTML(id, av.natural.has(id), id === hinted)).join('');
      if (st.mode === 'back' && n && Proof.isOpen(n) && !st.hint) {
        rules += `<button type="button" class="chip hintc" data-hintgo="start" title="Podpowiedź (H)">${icon('bulb')}Podpowiedź</button>`;
      }
    } else rules = `<span class="note">${dockMessage(infos)}</span>`;
    $('dockRules').innerHTML = rules;

    const ops = A.offeredOps().map(([name, op]) => `<button type="button" class="chip op" data-op="${name}"${op.title ? ` title="${op.title}"` : ''}>${op.label}</button>`);
    $('dockOps').innerHTML = ops.length ? '<span class="grp">Edycja</span>' + ops.join('') : '';
    $('dockOps').hidden = !ops.length;

    const hint = UI.hints.row(), box = $('dockHint');
    box.hidden = !hint;
    if (hint) { box.className = hint.cls; box.innerHTML = hint.html; }
  }

  /* ---------- status i wskazówka ---------- */

  function renderStatus() {
    const el = $('status');
    if (!st.frags.length) { el.innerHTML = ''; return; }
    const open = st.frags.reduce((s, r) => s + Proof.openLeaves(r).length, 0);
    el.innerHTML = open
      ? `<button type="button" class="btn ghost" data-act="next" title="Zaznacz następny otwarty cel (N)">${icon('arrow')}<span class="lbltxt hide-md">Następny cel</span><span class="pill">${open}</span></button>`
      : st.errors.size ? '<span class="pill bad">dowód zawiera błędy</span>'
        : `<span class="pill ok">${icon('check')}${st.frags.length === 1 ? 'dowód kompletny' : 'wszystkie fragmenty kompletne'}</span>`;
  }

  function infoText() {
    const infos = A.selection();
    if (st.errors.size) return 'Część reguł jest zastosowana błędnie (formuły w czerwonej ramce) — usuń ich uzasadnienie i spróbuj ponownie.';
    if (st.mode === 'fwd') {
      return infos.length ? 'Możesz zaznaczyć kolejne formuły albo wybrać regułę z paska na dole ekranu.'
        : 'Zaznacz <b>formuły na dole fragmentów</b> (kolejność kliknięć ma znaczenie) i wybierz regułę — pod spodem pojawi się wniosek. Przesłanki dodasz przyciskiem <b>Nowa przesłanka</b>.';
    }
    if (!st.frags.some(r => Proof.openLeaves(r).length)) {
      return '<b>Gotowe!</b> Wszystkie cele są zamknięte. Pod dowodem znajdziesz jego wersję słowną, przycisk <b>Odtwórz</b> pokaże go krok po kroku, a <b>Eksport</b> zapisze go jako obrazek lub kod LaTeX.';
    }
    if (!infos.length) return 'Kliknij <b>otwarty cel</b> (przerywana ramka) i wybierz regułę — nad celem pojawią się przesłanki. Utknąłeś? Naciśnij <b>Podpowiedź</b>.';
    if (infos.length === 1 && Proof.isOpen(infos[0].n)) {
      return Proof.inScope(infos[0].scope, infos[0].n.f)
        ? 'Ten cel jest założeniem otaczającego okna — zamknij go regułą <b>założenie</b>.'
        : 'Wybierz regułę z paska na dole ekranu albo z tabeli. Reguła wprowadzania pasująca do spójnika głównego jest wyróżniona.';
    }
    return 'Kliknij <b>otwarty cel</b>, aby kontynuować. Uzasadnioną formułę możesz edytować z paska na dole.';
  }

  function renderInfo() {
    const el = $('info');
    el.hidden = !st.frags.length;
    if (st.frags.length) el.innerHTML = icon('info') + '<div>' + infoText() + '</div>';
  }

  function render() {
    UI.hints.validate();
    markChoice('modeSeg', 'mode', st.mode);
    $('newGoalLabel').textContent = st.mode === 'back' ? 'Nowy cel' : 'Nowa przesłanka';
    const av = A.availability();
    renderFragments();
    renderRules(av);
    renderDock(av);
    renderStatus();
    renderInfo();
    $('undo').disabled = !S.canUndo();
    $('redo').disabled = !S.canRedo();
    $('reset').disabled = !st.frags.length;
  }

  /* ---------- budowa i zdarzenia ---------- */

  function buildRuleTable() {
    const card = id => `<div class="rcard${id === 'hyp' ? ' hypc' : ''}" data-rule="${id}" tabindex="0" role="button" aria-label="${Render.esc(Rules.get(id).name)}">${Render.schemaHTML(id)}</div>`;
    let html = '<span></span><span class="colh">wprowadzanie</span><span class="colh">eliminacja</span>';
    Rules.GROUPS.forEach(([con, intro, elim]) => {
      html += `<div class="con">${con}</div><div class="cell">${intro.map(card).join('')}</div><div class="cell">${elim.map(card).join('')}</div>`;
    });
    html += `<div class="rowsep"></div><div class="cell wide">${card('hyp')}</div>`;
    const table = $('rtable');
    table.innerHTML = html;
    table.addEventListener('click', e => { const c = e.target.closest('.rcard'); if (c) A.apply(c.dataset.rule); });
    table.addEventListener('keydown', e => {
      const c = e.target.closest('.rcard');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A.apply(c.dataset.rule); }
    });
  }

  function buildExamples() {
    const list = $('exList'), menu = $('exMenu');
    const item = (e, i) => `<button type="button" data-ex="${i}"><span class="t">${Render.esc(e.title)}<small>${Render.esc(e.note)}</small></span><span class="f">${F.html(F.parse(e.formula))}</span></button>`;
    list.innerHTML = Examples.GROUPS.map(g => `<div class="grp">${Render.esc(g.title)}</div>`
      + Examples.LIST.map((e, i) => (e.group === g.id ? item(e, i) : '')).join('')).join('');
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-ex]');
      if (b) { menu.open = false; A.loadExample(+b.dataset.ex); }
    });
    document.addEventListener('click', e => { if (!e.target.closest('#exMenu')) menu.open = false; });
  }

  /** Kliknięcia w obszarze roboczym (delegacja): akcje fragmentów, przykłady, zaznaczanie formuł. */
  function onWorkspaceClick(e) {
    const t = e.target;
    const action = t.closest('[data-act]');
    if (action) { runAct(action); return; }
    const button = t.closest('[data-present],[data-export],[data-delfrag],[data-ex],[data-nlcopy]');
    if (button) {
      const d = button.dataset;
      if (d.present !== undefined) UI.present.open(+d.present);
      else if (d.export !== undefined) UI.exporter.open(+d.export);
      else if (d.delfrag !== undefined) A.deleteFragment(+d.delfrag);
      else if (d.ex !== undefined) A.loadExample(+d.ex);
      else A.copyProse(+button.closest('[data-fi]').dataset.fi, d.nlcopy);
      return;
    }
    if (t.closest('.nl')) return;
    const formula = t.closest('[data-id]');
    if (formula) A.toggleSelect(+formula.dataset.id, e.shiftKey || e.ctrlKey || e.metaKey);
    else if (t.closest('.fbody') && st.sel.length) S.select([]);
  }

  /** Formuły są przyciskami: Enter/spacja działa jak kliknięcie. */
  function onWorkspaceKey(e) {
    const formula = e.target.closest && e.target.closest('.fm[data-id]');
    if (!formula || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    A.toggleSelect(+formula.dataset.id, e.shiftKey || e.ctrlKey || e.metaKey);
  }

  function init() {
    buildRuleTable();
    buildExamples();
    const ws = $('ws');
    ws.addEventListener('click', onWorkspaceClick);
    ws.addEventListener('keydown', onWorkspaceKey);
    ws.addEventListener('change', e => {
      if (e.target.matches('[data-nlrules]')) { S.setPref('nlRules', e.target.checked); S.refresh(); }
    });
    // „toggle” nie bąbelkuje — nasłuch w fazie przechwytywania
    ws.addEventListener('toggle', e => { if (e.target.matches('details.nl')) S.setPref('nlOpen', e.target.open); }, true);
    $('status').addEventListener('click', e => { const action = e.target.closest('[data-act]'); if (action) runAct(action); });
    $('dock').addEventListener('click', e => {
      const h = e.target.closest('[data-hintgo]');
      if (h) { UI.hints.act(h.dataset.hintgo); return; }
      const r = e.target.closest('[data-rule]');
      if (r) { A.apply(r.dataset.rule); return; }
      const o = e.target.closest('[data-op]');
      if (o) A.runOp(o.dataset.op);
    });
    $('dockClose').addEventListener('click', () => S.select([]));
    document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => { S.setMode(b.dataset.mode); S.refresh(); }));
    $('newGoal').addEventListener('click', () => A.newFormula());
    $('hintBtn').addEventListener('click', () => UI.hints.press());
    $('undo').addEventListener('click', () => S.undo());
    $('redo').addEventListener('click', () => S.redo());
    $('reset').addEventListener('click', () => A.clearAll());
    S.on('render', render);
  }

  UI.workspace = Object.freeze({ init, reveal, revealFragment });
})(globalThis.ND ||= {});
