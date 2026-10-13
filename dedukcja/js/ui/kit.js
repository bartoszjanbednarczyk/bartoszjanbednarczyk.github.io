/* =====================================================================
   Narzędzia interfejsu: ikony, komunikaty, schowek, pliki, bezpieczny
   localStorage, historia zmian, kodowanie linków i okna modalne.
   ===================================================================== */
(function (ND) {
  'use strict';
  const UI = (ND.UI ||= {});

  const $ = id => document.getElementById(id);

  /* ---------- ikony (zestaw w stylu Lucide) ---------- */
  const ICONS = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    first: '<path d="M18 19 10 12l8-7z"/><path d="M6 5v14"/>',
    last: '<path d="m6 5 8 7-8 7z"/><path d="M18 5v14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  };
  const icon = name => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  /** Zamienia znaczniki <i data-ic="…"> w HTML strony na ikony SVG. */
  const hydrateIcons = (root = document) => root.querySelectorAll('i[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic); });

  /** Odmiana po polsku: plural(1, 'cel', 'cele', 'celów') → „cel”, 3 → „cele”, 5 lub 12 → „celów”. */
  function plural(n, one, few, many) {
    if (n === 1) return one;
    const d = n % 10, dd = n % 100;
    return d >= 2 && d <= 4 && (dd < 10 || dd >= 20) ? few : many;
  }

  /* ---------- komunikaty ---------- */
  const TOAST_MS = 2600, IMPORTANT_MS = 6500;
  /** Ile ważnych komunikatów naraz (dłuższa lista zasłoniłaby ekran telefonu). */
  const TOAST_PARTS = 2;
  let toastTimer = 0, importantUntil = 0, deferred = null, shown = [];

  /**
   * Krótki komunikat u góry ekranu. Ważne komunikaty (important: true — np. o utracie pracy)
   * są widoczne dłużej, a zwykłe pojawiają się dopiero po nich, zamiast je zasłonić;
   * kolejny ważny komunikat dopisuje się do widocznego (bez powtórzeń, najwyżej dwa naraz).
   */
  function toast(message, { important = false } = {}) {
    const busy = Date.now() < importantUntil;
    if (!important && busy) { deferred = message; return; }
    const t = $('toast'), ms = important ? IMPORTANT_MS : TOAST_MS;
    shown = important && busy ? [...shown.filter(m => m !== message), message].slice(-TOAST_PARTS) : [message];
    t.textContent = shown.join(' · ');
    t.classList.add('show');
    importantUntil = important ? Date.now() + ms : 0;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      importantUntil = 0;
      if (deferred !== null) { const next = deferred; deferred = null; toast(next); }
    }, ms);
  }

  /* ---------- localStorage: bywa wyłączony, pełny albo zablokowany ---------- */
  const storage = Object.freeze({
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    /** Czy zapis w ogóle działa (np. nie w trybie prywatnym z blokadą). */
    available() { try { localStorage.setItem('nd-probe', '1'); localStorage.removeItem('nd-probe'); return true; } catch (e) { return false; } },
  });

  /* ---------- historia zmian (cofnij / ponów) ---------- */

  const HISTORY_LIMIT = 100;

  /**
   * Historia z ograniczoną liczbą kroków; wpisy to dowolne migawki stanu.
   * back/forward odkładają bieżącą migawkę na drugi stos i zwracają migawkę do odtworzenia (albo null).
   */
  function createHistory(limit = HISTORY_LIMIT) {
    let undo = [], redo = [];
    const step = (from, to, current) => {
      if (!from.length) return null;
      to.push(current);
      return from.pop();
    };
    return Object.freeze({
      record(entry) {
        undo.push(entry);
        if (undo.length > limit) undo.shift();
        redo = [];
      },
      back: current => step(undo, redo, current),
      forward: current => step(redo, undo, current),
      canUndo: () => undo.length > 0,
      canRedo: () => redo.length > 0,
      clear() { undo = []; redo = []; },
      /** Stosy do odłożenia (np. przy przełączeniu rachunku) i ich przywrócenie. */
      park: () => ({ undo, redo }),
      unpark(stacks) { undo = stacks ? stacks.undo : []; redo = stacks ? stacks.redo : []; },
    });
  }

  /* ---------- linki: dane w adresie jako base64url ---------- */

  /** Maks. długość danych w linku (#d=…, #q=…, #r=…). */
  const LINK_LIMIT = 300000;

  function encodeLink(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  /** Odwrotność encodeLink; rzuca wyjątek dla niepoprawnych danych. */
  const decodeLink = s => new TextDecoder('utf-8', { fatal: true })
    .decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

  /* ---------- wygląd i ruch ---------- */
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /**
   * Wysokości przyklejonego nagłówka (--head) i paska akcji na dole (--dock) jako zmienne CSS:
   * marginesy przewijania i dolny odstęp strony, by nic nie chowało się pod nimi.
   */
  function syncBars() {
    const root = document.documentElement, head = document.querySelector('header.top'), dock = $('dock');
    if (head) root.style.setProperty('--head', head.offsetHeight + 'px');
    if (dock) root.style.setProperty('--dock', dock.offsetHeight + 'px');
  }

  /** Przewija element do widoku (bez animacji, gdy system prosi o ograniczenie ruchu), z aktualnymi marginesami. */
  function scrollToView(el, block = 'center') {
    syncBars();
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block, inline: 'nearest' });
  }

  /**
   * Grupa przycisków-opcji: wyróżnia ten, którego data-`attr` ma wartość `value`
   * (aria-checked dla role="radio", aria-selected dla zakładek role="tab").
   */
  function markChoice(groupId, attr, value, aria = 'aria-checked') {
    document.querySelectorAll(`#${groupId} button`).forEach(b => {
      const on = b.dataset[attr] === value;
      b.classList.toggle('on', on);
      b.setAttribute(aria, String(on));
    });
  }

  /* ---------- warstwy nad aplikacją (okna modalne, prezentacja) ---------- */
  const overlays = new Set();
  const overlayWatchers = new Set();
  /**
   * Otwiera/zamyka warstwę. Gdy jakakolwiek jest otwarta, tło aplikacji ([data-background])
   * jest „inert” — niedostępne dla myszy, klawiatury i czytników ekranu.
   */
  function overlay(name, open) {
    if (open) overlays.add(name); else overlays.delete(name);
    document.querySelectorAll('[data-background]').forEach(el => { el.inert = overlays.size > 0; });
    overlayWatchers.forEach(fn => fn());
  }
  const anyOverlay = () => overlays.size > 0;
  const watchOverlays = fn => overlayWatchers.add(fn);

  /* ---------- schowek i pliki ---------- */
  function copyText(text, okMessage) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? okMessage : 'Nie udało się skopiować');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMessage), fallback);
    else fallback();
  }

  /** Kopiuje obrazek. Obietnica z danymi musi powstać w obsłudze kliknięcia (wymóg Safari). */
  function copyImage(blobPromise, okMessage) {
    if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
      blobPromise.catch(() => {});
      toast('Ta przeglądarka nie kopiuje obrazków — użyj „Pobierz PNG”');
      return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
      .then(() => toast(okMessage), () => toast('Nie udało się skopiować obrazka — użyj „Pobierz PNG”'));
  }

  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /** Czy element jest w dokumencie i widoczny (ukryty element z fokusem przeglądarka zaraz „gubi”). */
  const isShown = el => !!el && el.isConnected && el.getClientRects().length > 0;

  /**
   * Przerysowanie bez gubienia fokusu klawiatury: element z fokusem (w jednym z kontenerów o id z `ids`)
   * odnajdujemy po nowym narysowaniu po atrybutach data-… z listy `keys`; gdy zniknął albo jest ukryty,
   * fokus trafia na pierwszy widoczny element z selektorów `fallbacks`.
   */
  function keepFocus(ids, keys, redraw, fallbacks = []) {
    const active = document.activeElement;
    const container = active && ids.map($).find(c => c && c.contains(active));
    const attrs = container ? keys.filter(k => active.dataset[k] !== undefined) : [];
    const selector = attrs.map(k => `[data-${k}="${CSS.escape(active.dataset[k])}"]`).join('');
    redraw();
    const now = document.activeElement;
    if (!container || (now !== document.body && isShown(now))) return;
    const el = [selector && container.querySelector(selector), ...fallbacks.map(s => document.querySelector(s))].find(isShown);
    if (el) el.focus({ preventScroll: true });
  }

  /** Wywołuje fn co najwyżej raz na klatkę animacji. */
  function perFrame(fn) {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    };
  }

  /* ---------- okna modalne ---------- */
  const Modal = (() => {
    const stack = [];
    const onCloseHooks = new Map();
    const returnFocus = new WeakMap();

    const openedAt = new Map();
    /** Kliknięcie tła tuż po otwarciu to zwykle drugie kliknięcie podwójnego kliknięcia przycisku. */
    const GHOST_CLICK_MS = 450;
    /** Pole w oknie dostaje fokus chwilę po otwarciu (gdy okno jest już widoczne). */
    const FOCUS_DELAY_MS = 30;

    /** Otwiera okno; `focus` — element, który ma dostać fokus (domyślnie samo okno). */
    function open(id, { focus = null } = {}) {
      if (stack.includes(id)) return;
      const bg = $(id);
      returnFocus.set(bg, document.activeElement);
      openedAt.set(id, Date.now());
      bg.classList.add('show');
      stack.push(id);
      overlay('modal:' + id, true);
      const dialog = bg.querySelector('.modal');
      if (dialog) { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
      if (focus) setTimeout(() => { if (stack.includes(id)) focus.focus(); }, FOCUS_DELAY_MS);
    }

    function close(id) {
      const i = stack.indexOf(id);
      if (i < 0) return;
      stack.splice(i, 1);
      const bg = $(id);
      bg.classList.remove('show');
      overlay('modal:' + id, false);
      const hook = onCloseHooks.get(id);
      if (hook) hook();
      const back = returnFocus.get(bg);
      if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
    }

    function init() {
      document.querySelectorAll('.modal-bg').forEach(bg => {
        let downOnBackdrop = false;
        bg.addEventListener('mousedown', e => { downOnBackdrop = e.target === bg; });
        bg.addEventListener('click', e => {
          const ghost = e.detail > 1 || Date.now() - (openedAt.get(bg.id) || 0) < GHOST_CLICK_MS;
          if (e.target === bg && downOnBackdrop && !ghost) close(bg.id);
          downOnBackdrop = false;
        });
        bg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(bg.id)));
      });
    }

    return Object.freeze({
      init, open, close,
      top: () => stack[stack.length - 1] || null,
      isOpen: id => stack.includes(id),
      anyOpen: () => stack.length > 0,
      onClose: (id, fn) => onCloseHooks.set(id, fn),
    });
  })();

  /** Menu rozwijane (details.menu) zamykają się po kliknięciu gdziekolwiek poza nimi. */
  function closeMenusOnOutsideClick() {
    document.addEventListener('click', e => {
      document.querySelectorAll('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
    });
  }

  UI.kit = Object.freeze({
    $, icon, hydrateIcons, plural, toast, storage, createHistory, LINK_LIMIT, encodeLink, decodeLink,
    theme, reducedMotion, syncBars, scrollToView, markChoice, isShown, keepFocus,
    copyText, copyImage, download, perFrame, overlay, anyOverlay, watchOverlays, closeMenusOnOutsideClick, Modal,
  });
})(globalThis.ND ||= {});
