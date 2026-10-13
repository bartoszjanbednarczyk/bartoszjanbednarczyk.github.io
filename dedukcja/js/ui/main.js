/* =====================================================================
   Start aplikacji: odczyt stanu, inicjalizacja modułów, motyw, powiększenie, działy,
   ustawienia, osadzenie w stronie (ramka), udostępnianie, pasek akcji i skróty klawiszowe.
   ===================================================================== */
(function (ND) {
  'use strict';
  const UI = ND.UI;
  const { $, icon, hydrateIcons, toast, storage, copyText, markChoice, syncBars, closeMenusOnOutsideClick, Modal } = UI.kit;
  const S = UI.store, st = S.state;

  const THEME_KEY = 'nd-theme';
  const FONT_STEP = 2;

  /* ---------- motyw ---------- */

  /** Białe tło domyślnie (niezależnie od ustawień systemu); czarne tylko z wyboru użytkownika. */
  function initTheme() {
    const root = document.documentElement;
    const sync = () => markChoice('themeSeg', 'themeChoice', root.getAttribute('data-theme'));
    document.querySelectorAll('#themeSeg button').forEach(b => b.addEventListener('click', () => {
      root.setAttribute('data-theme', b.dataset.themeChoice);
      storage.set(THEME_KEY, b.dataset.themeChoice);
      sync();
    }));
    sync();
  }

  /** Zmienne CSS z wysokościami nagłówka i paska akcji, aktualne po każdej zmianie ich rozmiaru. */
  function trackBars() {
    syncBars();
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(syncBars);
      [document.querySelector('header.top'), $('dock')].forEach(el => observer.observe(el));
    }
  }

  /* ---------- powiększenie i ustawienia ---------- */

  const applyZoom = () => document.documentElement.style.setProperty('--fs', S.prefs.fontSize + 'px');
  const applyColors = () => document.documentElement.classList.toggle('colors-off', !S.prefs.colors);

  /** Przyciski powiększenia (data-zoom="1" albo "-1") w każdym dziale. */
  function initZoom() {
    const zoom = d => { S.setPref('fontSize', Math.max(12, Math.min(34, S.prefs.fontSize + d))); applyZoom(); };
    document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => zoom(FONT_STEP * +b.dataset.zoom)));
    applyZoom();
  }

  /* ---------- działy: rachunek zdań, rachunek kwantyfikatorów, rezolucja ---------- */

  const SYSTEM_TEXT = {
    prop: ['Dedukcja naturalna', 'rachunek zdań · dowody z oknami, jak w rozdz. 2.9 skryptu'],
    fo: ['Dedukcja naturalna', 'rachunek kwantyfikatorów · dowody z oknami, jak w rozdz. 3.3 skryptu'],
    res: ['Rezolucja', 'rachunek zdań · rezolucyjne dowody sprzeczności, jak w rozdz. 2.7 skryptu'],
  };

  const isRes = () => S.system() === 'res';

  /** Wygląd zgodny z bieżącym działem: zakładki, tytuł, widoczne części, pomoc. */
  function applySystem() {
    const sys = S.system(), nd = sys !== 'res';
    markChoice('sysTabs', 'sys', sys, 'aria-selected');
    document.documentElement.dataset.system = sys;
    document.title = SYSTEM_TEXT[sys][0];
    $('appTitle').textContent = SYSTEM_TEXT[sys][0];
    $('appSub').textContent = SYSTEM_TEXT[sys][1];
    $('ndApp').hidden = !nd;
    $('resApp').hidden = nd;
    $('modeSeg').hidden = !nd;
    $('dock').hidden = true;
    document.querySelectorAll('#helpModal [data-for]').forEach(el => {
      const who = el.dataset.for.split(' ');
      el.hidden = !(who.includes(sys) || (nd && who.includes('nd')));
    });
    $('share').title = sys === 'res' ? 'Kopiuj link do bieżącego zbioru klauzul' : 'Kopiuj link do bieżącego dowodu';
    if (UI.tutorial.isActive() && sys !== 'prop') UI.tutorial.stop();
    if (!nd) UI.res.render();
    syncBars();
  }

  function initSystems() {
    document.querySelectorAll('#sysTabs button').forEach(b => b.addEventListener('click', () => S.setSystem(b.dataset.sys)));
    S.on('system', applySystem);
    applySystem();
  }

  /** Pola wyboru ustawień ↔ ustawienia (automatyczne zamykanie celów jest krokiem historii). */
  const OPTIONS = { optAutoHyp: 'autoHyp', optColors: 'colors', optFireworks: 'fireworks' };

  /** Wygląd zgodny z ustawieniami (także po cofnięciu zmiany albo zmianie w innej karcie). */
  function syncOptions() {
    Object.entries(OPTIONS).forEach(([id, pref]) => { $(id).checked = S.prefs[pref]; });
    applyColors();
    applyZoom();
  }

  function initOptions() {
    Object.entries(OPTIONS).forEach(([id, pref]) => {
      const box = $(id);
      box.addEventListener('change', () => {
        if (pref === 'autoHyp') S.setAutoHyp(box.checked);
        else { S.setPref(pref, box.checked); syncOptions(); }
      });
    });
    S.on('prefs', syncOptions);
    syncOptions();
  }

  /* ---------- osadzenie w stronie (ramka na bartoszjanbednarczyk.github.io/dedukcja.html) ---------- */

  function initEmbed() {
    const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
    const full = $('fullBtn');
    if (embedded) {
      document.documentElement.classList.add('embed');
      full.hidden = false;
      full.href = location.href.split('#')[0];
    } else if (/\/dedukcja\/(index\.html)?$/.test(location.pathname)) $('homeBtn').hidden = false;

    // strona-rodzic udostępnia zwijanie swojego menu bocznego
    const parentApi = () => { try { const p = window.parent; return p !== window && typeof p.ndToggleSidebar === 'function' ? p : null; } catch (e) { return null; } };
    const foldable = () => { const p = parentApi(); try { return !!p && p.innerWidth >= 992; } catch (e) { return false; } };
    window.ndSidebarState = folded => {
      if (!foldable()) {
        full.innerHTML = icon('expand');
        full.title = 'Otwórz na pełnym ekranie (w nowej karcie)';
        full.setAttribute('aria-label', 'Pełny ekran');
        full.removeAttribute('aria-pressed');
        return;
      }
      full.innerHTML = icon(folded ? 'shrink' : 'expand');
      full.title = folded ? 'Pokaż menu strony' : 'Zwiń menu strony — więcej miejsca na dowód';
      full.setAttribute('aria-label', full.title);
      full.setAttribute('aria-pressed', String(folded));
    };
    full.addEventListener('click', e => {
      S.save();
      const p = parentApi();
      if (p && foldable()) { e.preventDefault(); p.ndToggleSidebar(); }
    });
    if (embedded) {
      const sync = () => { const p = parentApi(); window.ndSidebarState(!!p && typeof p.ndSidebarFolded === 'function' && p.ndSidebarFolded()); };
      sync();
      window.addEventListener('resize', sync);
    }
    return embedded;
  }

  /** Usuwa #d=… z adresu (także strony-rodzica), by odświeżenie nie wczytywało dowodu ponownie. */
  function forgetLinkHash(embedded) {
    const clean = w => { try { if (S.isLinkHash(w.location.hash)) w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) { /* inna domena */ } };
    clean(window);
    if (embedded) clean(window.top);
  }

  /**
   * Link z dowodem: po wczytaniu znika z adresu — chyba że przeglądarka nie zapisała pracy działu
   * z linku, bo wtedy tylko link pozwoli ją odtworzyć po odświeżeniu. Nieczytelny link znika zawsze.
   */
  const settleLinkHash = (ok, embedded, sys) => { if (!ok || S.persistent(sys === 'res' ? 'res' : 'nd')) forgetLinkHash(embedded); };

  /**
   * Link otwarty, gdy aplikacja już działa (zmiana adresu w tej samej karcie). Otwarte okna
   * i prezentacja dotyczą poprzedniej pracy (np. eksport, kreator formuły) — zamykamy je.
   */
  function initLinkNavigation(embedded) {
    window.addEventListener('hashchange', () => {
      const link = S.parseLink(location.hash);
      if (!link) return;
      while (Modal.top()) Modal.close(Modal.top());
      if (UI.present.isOpen()) UI.present.close();
      if (link.system === 'res') S.setSystem('res');
      const result = link.system === 'res' ? UI.res.openLink(location.hash) : S.openLink(location.hash);
      toast(result.message, { important: !result.ok });
      settleLinkHash(result.ok, embedded, link.system);
    });
  }

  function initShare(embedded) {
    $('share').addEventListener('click', () => {
      const res = isRes();
      if (res ? !UI.res.hasWork() : !st.frags.length) { toast('Nie ma jeszcze czego udostępnić'); return; }
      const hash = res ? UI.res.shareHash() : S.shareHash();
      if (!hash) { toast('Dowód jest za duży na link — użyj eksportu'); return; }
      let base = location.href;
      if (embedded) { try { base = window.top.location.href; } catch (e) { /* zostaje adres ramki */ } }
      copyText(base.split('#')[0] + hash, res ? 'Skopiowano link do bieżącego zbioru klauzul' : 'Skopiowano link do bieżącego dowodu');
    });
  }

  /* ---------- pasek akcji (wspólny dla działów) ---------- */

  function initDock() {
    $('dock').addEventListener('click', e => {
      if (e.detail > 1) return;   // pasek przerysowuje się pod kursorem — drugie kliknięcie trafiłoby w inny przycisk
      if (isRes()) UI.res.onDockClick(e);
      else UI.workspace.onDockClick(e);
    });
    $('dockClose').addEventListener('click', () => (isRes() ? UI.res.deselect() : S.select([])));
  }

  /* ---------- klawiatura ---------- */

  /** Pola, w których klawisze służą do pisania (pola wyboru nie blokują skrótów). */
  const TEXT_ENTRY = 'textarea, select, [contenteditable], input:not([type=checkbox]):not([type=radio]):not([type=button])';

  /**
   * Przytrzymany Enter/spacja na przycisku nie może go „klikać” wielokrotnie
   * (np. stosować podpowiedzi aż do końca dowodu albo usuwać kolejne fragmenty).
   */
  function blockKeyRepeat(e) {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && e.target.closest
      && e.target.closest('button, summary, [role="button"]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onKey(e) {
    if (UI.present.isOpen()) { UI.present.onKey(e); return; }
    if (Modal.anyOpen()) { if (e.key === 'Escape') Modal.close(Modal.top()); return; }
    if (e.key === 'Escape' && UI.tutorial.isActive() && e.target.closest && e.target.closest('#tutorial')) { UI.tutorial.stop(); return; }
    if (e.target.closest && e.target.closest(TEXT_ENTRY)) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); (isRes() ? UI.res.undo : S.undo)(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); (isRes() ? UI.res.redo : S.redo)(); return; }
    if (mod || e.altKey) return;
    // przytrzymany klawisz nie może „wyklikać” całego dowodu podpowiedziami ani go rozebrać
    if (e.repeat && (k === 'h' || k === 'p' || e.key === 'Delete' || e.key === 'Backspace')) return;
    if (e.key === 'Escape') {
      const menu = document.querySelector('details.menu[open]');
      if (menu) { menu.open = false; return; }
    }
    if (isRes()) { UI.res.onKey(e); return; }
    // Delete: cofnij krok; Shift+Delete: cofnij całe poddrzewo (gdy nad formułą jest tylko jeden krok — to samo)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (UI.actions.runOp(e.shiftKey ? 'clear' : 'step') || (e.shiftKey && UI.actions.runOp('step'))) e.preventDefault();
    } else if (e.key === 'Escape') {
      if (st.sel.length || st.picks.length) S.select([]);
    } else if (k === 'n') UI.actions.gotoNextOpen();
    else if (k === 'h') UI.hints.press();
    else if (k === 'p') UI.present.open();
  }

  /* ---------- start ---------- */

  function boot() {
    hydrateIcons();
    trackBars();
    Modal.init();
    const hadLink = S.isLinkHash(location.hash);
    const source = S.load();
    UI.res.init();
    const resLink = UI.res.load();
    UI.ask.init();
    UI.workspace.init();
    UI.exporter.init();
    UI.present.init();
    UI.tutorial.init();
    initTheme();
    initZoom();
    initOptions();
    const embedded = initEmbed();
    initShare(embedded);
    if (hadLink) settleLinkHash(source === 'link' || !!(resLink && resLink.ok), embedded, resLink ? 'res' : 'nd');
    initSystems();
    initDock();
    closeMenusOnOutsideClick();
    initLinkNavigation(embedded);
    window.addEventListener('storage', e => { S.onStorageEvent(e); UI.res.onStorageEvent(e); });
    document.addEventListener('keydown', blockKeyRepeat, true);
    document.addEventListener('keydown', onKey);
    $('helpOpen').addEventListener('click', () => Modal.open('helpModal'));
    $('exportOpen').addEventListener('click', () => UI.exporter.open());
    S.on('complete', () => { toast('Dowód kompletny!'); UI.fireworks.launch(); });
    S.refresh();
    if (source === 'empty' && S.system() === 'prop' && UI.tutorial.shouldAutostart()) UI.tutorial.start();
  }

  boot();
})(globalThis.ND ||= {});
