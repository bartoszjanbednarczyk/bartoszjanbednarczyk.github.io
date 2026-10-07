/* =====================================================================
   Prezentacja: odtwarzanie dowodu krok po kroku, dużą czcionką.
   Cały dowód jest rysowany od razu (stały układ — nic nie „skacze”),
   a kolejne kroki tylko odsłaniają jego części.
     „od celu”       — jak szuka się dowodu: reguła po regule, od korzenia w górę,
     „od przesłanek” — jak czyta się dowód: zdania dowodu słownego, od założeń do wniosku.
   Krok: { caption: segmenty, reveal: [klucze], focus: [klucze] }
   Klucze elementów: 'f:id' (formuła), 'r:id' (kreska i etykieta reguły), 'b:id:nr' (okno).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { Proof, Render, Explain, Seg } = ND;
  const UI = (ND.UI ||= {});
  const { $, icon, toast, overlay, perFrame, markChoice, reducedMotion } = UI.kit;
  const S = UI.store, st = S.state;
  const { T, rule } = Seg;

  const AUTOPLAY_MS = 2800;
  const BASE_FONT = 40;           // px — rozmiar, przy którym mierzymy dowód przed dopasowaniem
  const FONT_RANGE = [12, 72];

  let pv = null;   // { root, complete, order, steps, k, elements, justifiedAt, timer, celebrated, returnFocus }

  /* ---------- kroki ---------- */

  function goalSteps(root) {
    const steps = [{ caption: T`Cel: udowodnić ${root.f}.`, reveal: [`f:${root.id}`], focus: [`f:${root.id}`] }];
    const visit = n => {
      if (n.rule === null || n.rule === 'hyp') return;
      const reveal = [`r:${n.id}`], focus = [`f:${n.id}`, `r:${n.id}`];
      n.prem.forEach((p, i) => {
        const top = p.box ? p.body : p;
        if (p.box) reveal.push(`b:${n.id}:${i}`);
        reveal.push(`f:${top.id}`);
        focus.push(`f:${top.id}`);
      });
      steps.push({ caption: T`${rule(n.rule)} ${Explain.goalStep(n)}`, reveal, focus });
      Proof.children(n).forEach(visit);
    };
    visit(root);
    return steps;
  }

  /** Elementy dowodu odsłaniane przez zdanie dowodu słownego (okno, formuły, kreski z regułami). */
  function revealedBy(s) {
    if (s.event === 'assume') return [`b:${s.nodes[0].id}:${s.box}`];
    const reveal = [];
    for (const n of s.nodes) {
      reveal.push(`f:${n.id}`);
      if (s.event === 'hyp') continue;
      reveal.push(`r:${n.id}`);
      n.prem.forEach(p => { if (!p.box && Proof.isBareLeaf(p)) reveal.push(`f:${p.id}`); });
    }
    return reveal;
  }

  /**
   * Kroki „od przesłanek”: zdania dowodu słownego (semantycznego) w kolejności czytania.
   * Pierwsza nota (cel dowodu) jest krokiem zerowym, pozostałe noty dołączają do sąsiednich kroków.
   */
  function readingSteps(root) {
    const sentences = Explain.prose(root, { merge: false, skipKnown: false }).sentences;
    const steps = [];
    let notes = [];
    sentences.forEach((s, i) => {
      if (s.event !== 'note') {
        const reveal = revealedBy(s);
        steps.push({ caption: [...notes.flatMap(segs => [...segs, ' ']), ...s.segs], reveal, focus: reveal });
        notes = [];
      } else if (i === 0) steps.push({ caption: s.segs, reveal: [], focus: [] });
      else notes.push(s.segs);
    });
    if (notes.length && steps.length > 1) steps[steps.length - 1].caption.push(...notes.flatMap(segs => [' ', ...segs]));
    return steps;
  }

  /* ---------- stan kroku ---------- */

  /** Elementy odsłonięte do kroku k włącznie i te odsłonięte dokładnie w kroku k. */
  function revealedUpTo(k) {
    const visible = new Set(), fresh = new Set(pv.steps[k].reveal);
    for (let i = 0; i <= k; i++) pv.steps[i].reveal.forEach(key => visible.add(key));
    return { visible, fresh };
  }

  /** Otwarte cele w kroku k: odsłonięte formuły bez uzasadnienia. */
  function openAt(k, visible) {
    const open = new Set();
    Proof.walk([pv.root], n => {
      if (!visible.has(`f:${n.id}`)) return;
      if (n.rule === null) open.add(n.id);
      else if (n.rule !== 'hyp' && !(pv.justifiedAt.get(n.id) <= k)) open.add(n.id);
    });
    return open;
  }

  /** Formuły, których poddowód jest w kroku k w całości odsłonięty i uzasadniony. */
  const doneAt = (visible, open) => Proof.completeSubtrees(pv.root, n => visible.has(`f:${n.id}`) && !open.has(n.id) && n.rule !== null);

  function show(k, animate = true) {
    const last = pv.steps.length - 1;
    pv.k = Math.max(0, Math.min(last, k));
    const { visible, fresh } = revealedUpTo(pv.k);
    const focus = new Set(pv.steps[pv.k].focus);
    const open = openAt(pv.k, visible), done = doneAt(visible, open);
    for (const [key, list] of pv.elements) {
      const id = key.startsWith('f:') ? +key.slice(2) : null;
      for (const el of list) {
        el.classList.toggle('pv-off', !visible.has(key));
        el.classList.toggle('pv-new', animate && fresh.has(key));
        el.classList.toggle('pv-cur', focus.has(key));
        if (id !== null) {
          el.classList.toggle('open', open.has(id));
          el.classList.toggle('done', done.has(id));
        }
      }
    }
    $('pvCaption').innerHTML = Render.segHTML(pv.steps[pv.k].caption, { rules: true });
    $('pvCount').textContent = `${pv.k + 1} / ${pv.steps.length}`;
    $('pvBar').style.width = `${(100 * pv.k) / Math.max(1, last)}%`;
    const focused = document.activeElement;
    $('pvFirst').disabled = $('pvPrev').disabled = pv.k === 0;
    $('pvLast').disabled = $('pvNext').disabled = pv.k === last;
    // przycisk z fokusem właśnie się wyłączył (np. „Następny krok” na końcu) — fokus nie ginie
    if (focused && focused.disabled) $('pvPlay').focus({ preventScroll: true });
    keepInView();
    if (pv.k === last) {
      stopAutoplay();
      if (pv.complete && !pv.celebrated) { pv.celebrated = true; UI.fireworks.launch(); }
    }
  }

  /** Gdy dowód nie mieści się na scenie, przewija ją do części wyróżnionej w bieżącym kroku. */
  function keepInView({ instant = false } = {}) {
    const stage = $('pvStage');
    if (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) return;
    const marked = [...$('pvProof').querySelectorAll('.pv-cur')];
    if (!marked.length) return;
    const s = stage.getBoundingClientRect();
    const box = marked.map(el => el.getBoundingClientRect()).reduce((a, r) => ({
      left: Math.min(a.left, r.left), right: Math.max(a.right, r.right), top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom),
    }));
    const centre = (lo, hi, from, size) => lo - from + (hi - lo) / 2 - size / 2;
    stage.scrollTo({
      left: stage.scrollLeft + centre(box.left, box.right, s.left, stage.clientWidth),
      top: stage.scrollTop + centre(box.top, box.bottom, s.top, stage.clientHeight),
      behavior: instant || reducedMotion() ? 'auto' : 'smooth',
    });
  }

  /**
   * Podpis o stałej wysokości (najdłuższego podpisu w tej prezentacji, najwyżej 40% ekranu):
   * zmiana długości podpisu między krokami nie przesuwa ani nie przeskalowuje dowodu.
   */
  function stabilizeCaption() {
    const el = $('pvCaption');
    el.style.minHeight = '';
    let tallest = 0;
    for (const s of pv.steps) {
      el.innerHTML = Render.segHTML(s.caption, { rules: true });
      tallest = Math.max(tallest, el.offsetHeight);
    }
    el.style.minHeight = Math.min(tallest, 0.4 * window.innerHeight) + 'px';
    el.innerHTML = Render.segHTML(pv.steps[pv.k].caption, { rules: true });
  }

  /* ---------- budowa ---------- */

  function build() {
    pv.steps = pv.order === 'reading' ? readingSteps(pv.root) : goalSteps(pv.root);
    // węzeł jest uzasadniony od kroku, w którym pojawia się jego kreska z regułą
    pv.justifiedAt = new Map();
    pv.steps.forEach((s, i) => s.reveal.forEach(key => { if (key.startsWith('r:')) pv.justifiedAt.set(+key.slice(2), i); }));
    const proof = $('pvProof');
    proof.innerHTML = Render.proofHTML(pv.root);
    pv.elements = new Map();
    const add = (key, el) => { if (!pv.elements.has(key)) pv.elements.set(key, []); pv.elements.get(key).push(el); };
    proof.querySelectorAll('.fm[data-id]').forEach(el => add(`f:${el.dataset.id}`, el));
    proof.querySelectorAll('[data-of]').forEach(el => add(`r:${el.dataset.of}`, el));
    proof.querySelectorAll('[data-box]').forEach(el => add(`b:${el.dataset.box}`, el));
    markChoice('pvOrder', 'order', pv.order);
    document.querySelectorAll('#pvOrder button').forEach(b => {
      b.disabled = b.dataset.order === 'reading' && !pv.complete;
      b.title = b.disabled ? 'Dostępne dla kompletnych dowodów' : b.dataset.title;
    });
    pv.celebrated = false;
    pv.k = 0;
    stabilizeCaption();
    show(0, false);
    fit();
    keepInView({ instant: true });
  }

  /**
   * Dobiera rozmiar czcionki tak, by cały dowód mieścił się na scenie. Część odstępów
   * (ramki, marginesy w px) nie skaluje się z czcionką, więc wynik poprawiamy kilka razy.
   */
  function fit() {
    if (!pv) return;
    const stage = $('pvStage'), proof = $('pvProof');
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (availW <= 0 || availH <= 0) return;
    let size = BASE_FONT;
    for (let i = 0; i < 4; i++) {
      proof.style.setProperty('--pfs', size.toFixed(1) + 'px');
      const box = proof.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const ratio = Math.min(availW / box.width, availH / box.height);
      if (i > 0 && ratio >= 1 && ratio < 1.03) break;   // mieści się, z niewielkim zapasem
      const next = Math.max(FONT_RANGE[0], Math.min(FONT_RANGE[1], size * ratio * (i > 0 ? 0.995 : 1)));
      if (Math.abs(next - size) < 0.05) break;
      size = next;
    }
    proof.style.setProperty('--pfs', size.toFixed(1) + 'px');
  }

  /* ---------- sterowanie ---------- */

  function stopAutoplay() {
    if (!pv || !pv.timer) return;
    clearInterval(pv.timer);
    pv.timer = null;
    $('pvPlay').innerHTML = `${icon('play')}<span>Odtwarzaj</span>`;
  }

  function toggleAutoplay() {
    if (pv.timer) { stopAutoplay(); return; }
    if (pv.k === pv.steps.length - 1) show(0, false);
    pv.timer = setInterval(() => show(pv.k + 1), AUTOPLAY_MS);
    $('pvPlay').innerHTML = `${icon('pause')}<span>Pauza</span>`;
  }

  function toggleFullscreen() {
    const el = $('pv');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => toast('Pełny ekran nie jest tu dostępny'));
    else toast('Pełny ekran nie jest tu dostępny');
  }

  /** Przycisk pełnego ekranu pokazuje, czy pełny ekran jest włączony. */
  function syncFullscreenButton() {
    const on = !!document.fullscreenElement, b = $('pvFull');
    b.innerHTML = icon(on ? 'shrink' : 'expand');
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Wyjdź z pełnego ekranu (F)' : 'Pełny ekran (F)';
  }

  const step = d => { stopAutoplay(); show(pv.k + d, d > 0); };

  function open(i) {
    const root = st.frags[UI.actions.targetFragment(i)];
    if (!root) { toast('Najpierw zbuduj dowód'); return; }
    const status = S.status(root);
    if (status.errors) { toast('Ten dowód zawiera błędnie zastosowane reguły'); return; }
    if (root.rule === null) { toast('Zastosuj najpierw choć jedną regułę'); return; }
    pv = {
      root, complete: status.complete, k: 0, timer: null,
      order: status.complete ? S.prefs.presentOrder : 'goal',
      returnFocus: document.activeElement,
    };
    $('pvTitle').innerHTML = (status.complete ? '⊢ ' : '') + Render.math(root.f);
    $('pvTitle').title = (status.complete ? '⊢ ' : '') + ND.F.text(root.f);
    $('pv').hidden = false;
    syncFullscreenButton();
    document.documentElement.style.overflow = 'hidden';
    overlay('present', true);
    build();
    $('pvNext').focus({ preventScroll: true });
  }

  function close() {
    if (!pv) return;
    stopAutoplay();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $('pv').hidden = true;
    document.documentElement.style.overflow = '';
    const back = pv.returnFocus;
    pv = null;
    overlay('present', false);
    if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
  }

  /** Klawiatura podczas prezentacji (pozostałe skróty aplikacji są wtedy nieaktywne). */
  function onKey(e) {
    if (!pv) return;
    const keys = {
      ArrowRight: () => step(1), PageDown: () => step(1), Enter: () => step(1),
      ArrowLeft: () => step(-1), PageUp: () => step(-1), Backspace: () => step(-1),
      Home: () => { stopAutoplay(); show(0, false); },
      End: () => { stopAutoplay(); show(pv.steps.length - 1, false); },
      ' ': toggleAutoplay, Escape: close, f: toggleFullscreen, F: toggleFullscreen,
    };
    const handler = keys[e.key];
    if (!handler || e.ctrlKey || e.metaKey || e.altKey) return;
    // Enter na przycisku działa jak kliknięcie w niego; spacja zawsze włącza/wyłącza odtwarzanie
    if (e.key === 'Enter' && e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    handler();
  }

  function init() {
    $('pvClose').addEventListener('click', close);
    $('pvFull').addEventListener('click', toggleFullscreen);
    $('pvFirst').addEventListener('click', () => { stopAutoplay(); show(0, false); });
    $('pvLast').addEventListener('click', () => { stopAutoplay(); show(pv.steps.length - 1, false); });
    $('pvPrev').addEventListener('click', () => step(-1));
    $('pvNext').addEventListener('click', () => step(1));
    $('pvPlay').addEventListener('click', toggleAutoplay);
    document.querySelectorAll('#pvOrder button').forEach(b => {
      b.dataset.title = b.title;   // opis przywracany, gdy przycisk znów jest dostępny
      b.addEventListener('click', () => {
        if (!pv || b.disabled || pv.order === b.dataset.order) return;
        stopAutoplay();
        pv.order = b.dataset.order;
        S.setPref('presentOrder', pv.order);
        build();
      });
    });
    const refit = perFrame(() => { if (!pv) return; stabilizeCaption(); fit(); keepInView({ instant: true }); });
    window.addEventListener('resize', refit);
    document.addEventListener('fullscreenchange', () => { syncFullscreenButton(); refit(); });
  }

  UI.present = Object.freeze({ init, open, close, onKey, isOpen: () => !!pv });
})(globalThis.ND ||= {});
