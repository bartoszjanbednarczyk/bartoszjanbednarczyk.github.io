/* =====================================================================
   Samouczek: prowadzi przez pierwszy dowód (p ∧ q ⇒ q ∧ p).
   Kroki z warunkiem `done` czekają na ruch użytkownika: bieżący krok wynika ze
   stanu dowodu (cofnięcie ruchu cofa też samouczek), pozostałe przechodzą dalej
   przyciskiem. Podświetlenie to „dziura” w przyciemnieniu — nie blokuje kliknięć.
   Okno samouczka można przeciągnąć za pasek tytułu (mysz, dotyk, strzałki), by odsłonić
   dowód — zostaje wtedy tam, gdzie je odłożono (dwuklik na uchwycie: z powrotem automatycznie).
   Cele dowodu z samouczka zamykają się automatycznie, gdy są założeniami — bez
   zmiany ustawień użytkownika i bez wpływu na jego inne dowody.
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

  let tour = null;   // { index, settle, html, pinned: { left, top } | null — miejsce wybrane przez użytkownika }

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
  const otherRule = (n, id) => (n && n.rule && n.rule !== 'hyp' && n.rule !== id ? `To inna reguła — cofnij ją przyciskiem „Cofnij krok” na pasku na dole (albo Ctrl+Z) i wybierz (${ND.Rules.get(id).label.text}).` : null);

  const isTutorialProof = root => F.eq(root.f, GOAL);

  /** Dodaje dowód samouczka; false, gdy się nie zmieścił (komunikat o limicie pokazuje commit). */
  function begin() {
    S.setMode('back');
    return UI.actions.addFragment(Proof.node(GOAL));
  }

  const STEPS = [
    {
      title: 'Samouczek — pierwszy dowód',
      text: () => T`W kilku krokach zbudujemy razem dowód formuły ${GOAL}. To zajmie około minuty — w każdej chwili możesz przerwać. Jeśli to okno zasłania dowód, przesuń je, chwytając za pasek tytułu (⠿).`,
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
      text: () => T`Dowody można też budować od przesłanek — przełączysz to tutaj. Zadania ze skryptu, kolokwiów i egzaminów są w menu „Przykłady” — podpowiedzi działają w nich tylko dla zadań przykładowych (na górze menu). Samouczek uruchomisz ponownie z pomocy (?).`,
      next: 'Zakończ', last: true,
    },
  ];

  const FIRST_TASK = STEPS.findIndex(s => s.done);      // pierwszy krok czekający na ruch użytkownika
  const FINISHED = STEPS.findIndex(s => s.finished);

  /* ---------- silnik ---------- */

  function start() {
    storage.set(SEEN_KEY, '1');
    Modal.close('helpModal');
    tour = { index: 0, html: '', pinned: null };
    S.setAutoCloseFor(isTutorialProof);
    $('tutorial').hidden = false;
    update();
    focusBubble();
  }

  function stop() {
    S.setAutoCloseFor(null);
    tour = null;
    $('tutorial').hidden = true;
  }

  function next() {
    const step = STEPS[tour.index];
    if (step.onNext && step.onNext() === false) { stop(); return; }
    if (!tour) return;
    if (step.last) { stop(); return; }
    tour.index++;
    update(true);
    focusBubble();
  }

  /** Klawiatura: fokus na przycisku dymka (o ile krok go ma — inaczej użytkownik działa w aplikacji). */
  function focusBubble() {
    const button = tour && $('tutBubble').querySelector('[data-tut="next"]');
    if (button) button.focus({ preventScroll: true });
  }

  /**
   * Krok wynikający ze stanu dowodu: pierwszy niewykonany. Dzięki temu cofnięcie ruchu
   * (Ctrl+Z) cofa samouczek, a dowód ukończony inną drogą przenosi do podsumowania.
   */
  function stepFor(p) {
    if (p.complete) return Math.max(FINISHED, tour.index);
    for (let i = FIRST_TASK; i < FINISHED; i++) if (!STEPS[i].done(p)) return i;
    return FINISHED;
  }

  function currentTarget(p) {
    const step = STEPS[tour.index];
    const el = step.target ? step.target(p) : null;
    return el && el.getClientRects().length ? el : null;
  }

  function update(scroll = false) {
    if (!tour) return;
    const p = tour.index > 0 ? parts() : null;
    if (tour.index > 0) {
      if (!p) { stop(); toast('Samouczek przerwany — jego dowód został usunięty albo przebudowany'); return; }
      const index = stepFor(p);
      if (index !== tour.index) { tour.index = index; scroll = true; }
    }
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

  /** Treść dymka — podmieniana tylko przy zmianie (czytniki ekranu ogłaszają każdą podmianę). */
  function renderBubble(step, p) {
    const warn = step.wrong ? step.wrong(p) : null;
    const waiting = step.done && !warn ? '<span class="tut-wait">czekam na Twój ruch…</span>' : '';
    const nextButton = step.done ? '' : `<button type="button" class="btn primary" data-tut="next">${step.next || 'Dalej'}</button>`;
    const skipButton = step.last ? '' : `<button type="button" class="btn ghost" data-tut="skip">${tour.index === 0 ? 'Nie teraz' : 'Zakończ'}</button>`;
    const html = `<div class="tut-head" data-tut-drag title="Przeciągnij, aby przesunąć okno (dwuklik — z powrotem na miejsce)">`
      + `<button type="button" class="tut-grip" data-tut-grip aria-label="Przesuń okno samouczka (strzałki; Enter — z powrotem na miejsce)">⠿</button>`
      + `<h3 id="tutTitle">${Render.esc(step.title)}</h3></div>`
      + `<p>${Render.segHTML(step.text(p), { rules: true })}</p>${warn ? `<p class="warn">${Render.esc(warn)}</p>` : ''}`
      + `<div class="tut-foot"><span class="count">${tour.index + 1} / ${STEPS.length}</span>${waiting}<span class="sp"></span>${skipButton}${nextButton}</div>`;
    if (html === tour.html) return;
    tour.html = html;
    $('tutBubble').innerHTML = html;
  }

  /**
   * Ustawia podświetlenie na elemencie i dymek obok niego (w granicach okna, nad paskiem akcji,
   * bo tam użytkownik wybiera reguły). Gdy dymek nie mieści się ani nad, ani pod elementem,
   * dostaje przewijanie — nigdy go nie zasłania.
   */
  function position(target) {
    const hole = $('tutHole'), bubble = $('tutBubble'), dock = $('dock');
    const dockTop = !dock.hidden && !(target && dock.contains(target)) ? dock.getBoundingClientRect().top : Infinity;
    const vw = window.innerWidth, vh = Math.min(window.innerHeight, dockTop), pad = 6, gap = 12, margin = 8, minHeight = 96;
    bubble.style.maxHeight = '';
    const bw = bubble.offsetWidth;
    let bh = bubble.offsetHeight;
    if (target) {
      const r = target.getBoundingClientRect();
      hole.classList.remove('none');
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
    }
    if (tour.pinned) {
      if (!target) hole.classList.add('none');
      placePinned();
      return;
    }
    if (!target) {
      hole.classList.add('none');
      Object.assign(hole.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px' });
      Object.assign(bubble.style, { left: Math.max(margin, (vw - bw) / 2) + 'px', top: Math.max(margin, (vh - bh) / 2) + 'px' });
      return;
    }
    const r = target.getBoundingClientRect();
    const below = vh - margin - (r.bottom + pad + gap), above = r.top - pad - gap - margin;
    let top;
    if (bh <= below) top = r.bottom + pad + gap;
    else if (bh <= above) top = r.top - pad - gap - bh;
    else {
      bubble.style.maxHeight = Math.max(minHeight, below, above) + 'px';
      bh = bubble.offsetHeight;
      top = below >= above ? r.bottom + pad + gap : r.top - pad - gap - bh;
    }
    top = Math.max(margin, Math.min(vh - bh - margin, top));
    const left = Math.max(margin, Math.min(vw - bw - margin, r.left + r.width / 2 - bw / 2));
    Object.assign(bubble.style, { left: left + 'px', top: top + 'px' });
  }

  /* ---------- przesuwanie okna ---------- */

  const MARGIN = 8;

  /**
   * Okno w miejscu wybranym przez użytkownika — zawsze w granicach ekranu (np. po obrocie telefonu)
   * i nad paskiem akcji, bo tam są przyciski, o które prosi samouczek.
   */
  function placePinned() {
    const bubble = $('tutBubble'), dock = $('dock'), vw = window.innerWidth;
    const vh = Math.min(window.innerHeight, dock.hidden ? Infinity : dock.getBoundingClientRect().top);
    bubble.style.maxHeight = Math.max(96, vh - 2 * MARGIN) + 'px';
    const left = Math.max(MARGIN, Math.min(vw - bubble.offsetWidth - MARGIN, tour.pinned.left));
    const top = Math.max(MARGIN, Math.min(vh - bubble.offsetHeight - MARGIN, tour.pinned.top));
    tour.pinned = { left, top };
    Object.assign(bubble.style, { left: left + 'px', top: top + 'px' });
  }

  function pinAt(left, top) {
    if (!tour) return;
    tour.pinned = { left, top };
    placePinned();
  }

  function unpin() {
    if (!tour) return;
    tour.pinned = null;
    reposition();
  }

  /** Przeciąganie za pasek tytułu (mysz i dotyk — pointer events). */
  function initDrag() {
    const bubble = $('tutBubble');
    let drag = null, lastDown = null;
    bubble.addEventListener('pointerdown', e => {
      const head = e.target.closest('[data-tut-drag]');
      if (!head || !tour || e.button > 0) return;
      e.preventDefault();
      // dwa szybkie naciśnięcia paska tytułu (dwuklik, dwa stuknięcia): z powrotem automatyczne miejsce.
      // Zdarzenie dblclick się tu nie nadaje — przy przechwyceniu wskaźnika trafia do całego okna.
      const now = Date.now(), near = lastDown && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 8;
      if (near && now - lastDown.t < 400) { lastDown = null; unpin(); return; }
      lastDown = { t: now, x: e.clientX, y: e.clientY };
      const r = bubble.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { bubble.setPointerCapture(e.pointerId); } catch (err) { /* wskaźnik już nieaktywny — przeciąganie i tak działa */ }
      bubble.classList.add('dragging');
    });
    bubble.addEventListener('pointermove', e => {
      if (drag && e.pointerId === drag.id) pinAt(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      bubble.classList.remove('dragging');
    };
    bubble.addEventListener('pointerup', end);
    bubble.addEventListener('pointercancel', end);
    // klawiatura: strzałki na uchwycie przesuwają okno, Enter/spacja przywraca automatyczne miejsce
    bubble.addEventListener('keydown', e => {
      if (!e.target.closest('[data-tut-grip]') || !tour) return;
      const step = e.shiftKey ? 80 : 24;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        const r = bubble.getBoundingClientRect();
        pinAt(r.left + moves[e.key][0], r.top + moves[e.key][1]);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter' || e.key === ' ') {
        unpin();
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  function init() {
    initDrag();
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

  UI.tutorial = Object.freeze({ init, start, stop, shouldAutostart, isTutorialProof, isActive: () => !!tour, isPinned: () => !!(tour && tour.pinned) });
})(globalThis.ND ||= {});
