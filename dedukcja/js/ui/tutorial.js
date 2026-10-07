/* =====================================================================
   Samouczek: prowadzi przez pierwszy dowód (p ∧ q ⇒ q ∧ p).
   Kroki z warunkiem `done` czekają na ruch użytkownika (sprawdzany po każdej
   zmianie stanu), pozostałe przechodzą dalej przyciskiem. Podświetlenie to
   „dziura” w przyciemnieniu — nie blokuje kliknięć w aplikację.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Render, Seg } = ND;
  const UI = (ND.UI ||= {});
  const { $, toast, storage, perFrame, anyOverlay, watchOverlays, scrollToView, Modal } = UI.kit;
  const S = UI.store, st = S.state;
  const { T, rule } = Seg;

  const SEEN_KEY = 'nd-tutorial';
  const GOAL = F.parse('p & q -> q & p');
  const [P, Q] = [F.V('p'), F.V('q')];

  let tour = null;   // { index, settle, restoreAutoHyp }

  /** Części dowodu z samouczka (szukane po formule — identyfikatory zmieniają się przy cofaniu). */
  function parts() {
    const root = [...st.frags].reverse().find(r => F.eq(r.f, GOAL));
    if (!root) return null;
    const body = root.rule === 'impI' ? root.prem[0].body : null;
    const split = body && body.rule === 'andI';
    return { root, body, left: split ? body.prem[0] : null, right: split ? body.prem[1] : null, complete: S.status(root).complete };
  }

  const query = sel => document.querySelector(sel);
  const formulaEl = n => (n ? query(`.ws .fm[data-id="${n.id}"]`) : null);
  const fragmentEl = (p, sel = '') => { const i = st.frags.indexOf(p.root); return i < 0 ? null : query(`.frag[data-fi="${i}"] ${sel}`.trim()); };
  const ruleEl = id => query(`#dock:not([hidden]) .chip[data-rule="${id}"]`) || query(`.rcard[data-rule="${id}"]`);
  const otherRule = (n, id) => (n && n.rule && n.rule !== 'hyp' && n.rule !== id ? `To inna reguła — cofnij ją (Ctrl+Z albo ↶) i wybierz (${ND.Rules.get(id).label.text}).` : null);

  /** Pole wyboru ustawienia i samo ustawienie (samouczek włącza na chwilę automatyczne zamykanie celów). */
  function setAutoHyp(on) {
    S.setPref('autoHyp', on);
    $('optAutoHyp').checked = on;
  }

  function begin() {
    S.setMode('back');
    if (!S.prefs.autoHyp) { tour.restoreAutoHyp = true; setAutoHyp(true); }
    UI.actions.addFragment(Proof.node(GOAL));
  }

  const STEPS = [
    {
      title: 'Samouczek — pierwszy dowód',
      text: () => T`W kilku krokach zbudujemy razem dowód formuły ${GOAL}. To zajmie około minuty — w każdej chwili możesz przerwać.`,
      next: 'Zaczynamy', onNext: begin,
    },
    {
      title: 'Otwarty cel',
      target: p => formulaEl(p.root),
      text: () => T`To cel do udowodnienia. ${S.prefs.colors ? 'Czerwona przerywana' : 'Przerywana'} ramka oznacza otwarty cel — formułę, której jeszcze nie uzasadniliśmy. Kliknij go.`,
      done: p => st.sel.includes(p.root.id) || p.root.rule !== null,
    },
    {
      title: 'Wybierz regułę',
      target: () => ruleEl('impI'),
      text: () => T`Spójnikiem głównym celu jest ⇒, więc naturalnym wyborem jest wprowadzanie implikacji ${rule('impI')}. Kliknij je na pasku na dole albo w tabeli reguł.`,
      done: p => p.root.rule === 'impI',
      wrong: p => otherRule(p.root, 'impI'),
    },
    {
      title: 'Okno z założeniem',
      target: p => formulaEl(p.body),
      text: () => T`Reguła ${rule('impI')} otworzyła okno z założeniem ${GOAL.a} — wewnątrz okna wolno z niego korzystać. Nowy cel ${GOAL.b} jest już zaznaczony: zastosuj do niego ${rule('andI')}.`,
      done: p => !!p.body && p.body.rule === 'andI',
      wrong: p => otherRule(p.body, 'andI'),
    },
    {
      title: 'Podpowiedź',
      target: () => $('hintBtn'),
      text: () => T`Zostały dwa cele: ${Q} oraz ${P}. Oba wynikają z założenia ${GOAL.a}. Zamiast szukać reguły samemu, poproś o podpowiedź — przyciskiem albo klawiszem H.`,
      done: p => !!st.hint || (!!p.left && p.left.rule !== null),
    },
    {
      title: 'Trzy poziomy podpowiedzi',
      target: () => ($('dockHint').hidden ? $('hintBtn') : $('dockHint')),
      text: () => T`Podpowiedź odsłania się stopniowo: najpierw wskazówka, potem konkretna reguła, a na końcu wykonanie kroku. Naciskaj „Podpowiedź” albo przyciski w żółtej ramce, aż cel ${Q} zostanie udowodniony.`,
      done: p => !!p.left && p.left.rule !== null,
    },
    {
      title: 'Ostatni cel — samodzielnie',
      target: p => formulaEl(p.right),
      text: () => T`Został cel ${P} — jest już zaznaczony. Wybierz ${rule('andE1')} i w okienku podaj ${F.META('β')} = ${Q} (pasująca formuła jest wyróżniona).`,
      done: p => p.complete,
      wrong: p => otherRule(p.right, 'andE1'),
    },
    {
      title: 'Brawo — dowód kompletny!', finished: true,
      target: p => fragmentEl(p, '.fbody'),
      text: () => T`${S.prefs.colors ? 'Każda formuła jest teraz zielona: wszystkie' : 'Wszystkie'} poddowody są ukończone. Pod rysunkiem znajdziesz ten sam dowód opisany słowami.`,
    },
    {
      title: 'Prezentacja',
      target: p => fragmentEl(p, '[data-present]'),
      text: () => T`Przycisk „Odtwórz” pokazuje dowód krok po kroku dużą czcionką — np. na zajęciach. Kroki można odtwarzać „od celu” albo „od przesłanek”.`,
    },
    {
      title: 'Eksport',
      target: p => fragmentEl(p, '[data-export]'),
      text: () => T`„Eksport” zapisze dowód jako obrazek PNG lub SVG — do notatek albo na Discorda — albo jako kod LaTeX.`,
    },
    {
      title: 'Dalej już samodzielnie',
      target: () => $('modeSeg'),
      text: () => T`Dowody można też budować od przesłanek — przełączysz to tutaj. Zadania ze skryptu, kolokwiów i egzaminów są w menu „Przykłady”, a samouczek uruchomisz ponownie z pomocy (?).`,
      next: 'Zakończ', last: true,
    },
  ];

  const FINISHED = STEPS.findIndex(s => s.finished);

  /* ---------- silnik ---------- */

  function start() {
    storage.set(SEEN_KEY, '1');
    Modal.close('helpModal');
    tour = { index: 0 };
    $('tutorial').hidden = false;
    update();
  }

  function stop() {
    if (tour && tour.restoreAutoHyp) setAutoHyp(false);
    tour = null;
    $('tutorial').hidden = true;
  }

  function next() {
    const step = STEPS[tour.index];
    if (step.onNext) step.onNext();
    if (!tour) return;
    if (step.last) { stop(); return; }
    tour.index++;
    update(true);
  }

  function currentTarget(p) {
    const step = STEPS[tour.index];
    const el = step.target ? step.target(p) : null;
    return el && el.getClientRects().length ? el : null;
  }

  function update(scroll = false) {
    if (!tour) return;
    const p = tour.index > 0 ? parts() : null;
    if (tour.index > 0 && !p) { stop(); toast('Samouczek przerwany — jego dowód został usunięty'); return; }
    if (p && p.complete && tour.index < FINISHED) { tour.index = FINISHED; scroll = true; }   // dowód ukończony inną drogą
    while (STEPS[tour.index].done && STEPS[tour.index].done(p)) { tour.index++; scroll = true; }
    const layer = $('tutorial');
    layer.hidden = anyOverlay();
    if (layer.hidden) return;
    renderBubble(STEPS[tour.index], p);
    const target = currentTarget(p);
    if (scroll && target) scrollToView(target);
    position(target);
    // po przewinięciu i krótkich animacjach wejścia (pasek akcji, podpowiedź) element jest już na miejscu
    clearTimeout(tour.settle);
    tour.settle = setTimeout(reposition, scroll ? 480 : 220);
  }

  const reposition = perFrame(() => {
    if (!tour || $('tutorial').hidden) return;
    const p = tour.index > 0 ? parts() : null;
    if (tour.index === 0 || p) position(currentTarget(p));
  });

  function renderBubble(step, p) {
    const warn = step.wrong ? step.wrong(p) : null;
    const waiting = step.done && !warn ? '<span class="tut-wait">czekam na Twój ruch…</span>' : '';
    const nextButton = step.done ? '' : `<button type="button" class="btn primary" data-tut="next">${step.next || 'Dalej'}</button>`;
    const skipButton = step.last ? '' : `<button type="button" class="btn ghost" data-tut="skip">${tour.index === 0 ? 'Nie teraz' : 'Zakończ'}</button>`;
    $('tutBubble').innerHTML = `<h3 id="tutTitle">${Render.esc(step.title)}</h3>`
      + `<p>${Render.segHTML(step.text(p), { rules: true })}</p>${warn ? `<p class="warn">${Render.esc(warn)}</p>` : ''}`
      + `<div class="tut-foot"><span class="count">${tour.index + 1} / ${STEPS.length}</span>${waiting}<span class="sp"></span>${skipButton}${nextButton}</div>`;
  }

  /** Ustawia podświetlenie na elemencie i dymek obok niego (w granicach okna). */
  function position(target) {
    const hole = $('tutHole'), bubble = $('tutBubble');
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6, gap = 12, margin = 8;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    if (!target) {
      hole.classList.add('none');
      Object.assign(hole.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px' });
      Object.assign(bubble.style, { left: Math.max(margin, (vw - bw) / 2) + 'px', top: Math.max(margin, (vh - bh) / 2) + 'px' });
      return;
    }
    const r = target.getBoundingClientRect();
    hole.classList.remove('none');
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
    let top = r.bottom + pad + gap;
    if (top + bh > vh - margin) top = r.top - pad - gap - bh;
    top = Math.max(margin, Math.min(vh - bh - margin, top));
    const left = Math.max(margin, Math.min(vw - bw - margin, r.left + r.width / 2 - bw / 2));
    Object.assign(bubble.style, { left: left + 'px', top: top + 'px' });
  }

  function init() {
    $('tutBubble').addEventListener('click', e => {
      const b = e.target.closest('[data-tut]');
      if (!b || !tour) return;
      if (b.dataset.tut === 'next') next();
      else stop();
    });
    $('tutorialStart').addEventListener('click', start);
    S.on('render', () => update());
    watchOverlays(() => update());
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
  }

  /** Czy samouczek powinien sam wystartować: pierwsza wizyta (i działający zapis — inaczej startowałby za każdym razem). */
  const shouldAutostart = () => storage.available() && !storage.get(SEEN_KEY);

  UI.tutorial = Object.freeze({ init, start, stop, shouldAutostart, isActive: () => !!tour });
})(globalThis.ND ||= {});
