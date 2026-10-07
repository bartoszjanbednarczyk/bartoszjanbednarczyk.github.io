/* =====================================================================
   Start aplikacji: odczyt stanu, inicjalizacja modułów, motyw, powiększenie,
   ustawienia, osadzenie w stronie (ramka), udostępnianie i skróty klawiszowe.
   ===================================================================== */
(function (ND) {
  'use strict';
  const UI = ND.UI;
  const { $, icon, hydrateIcons, toast, storage, copyText, markChoice, Modal } = UI.kit;
  const S = UI.store, st = S.state;

  const THEME_KEY = 'nd-theme';
  const FONT_STEP = 2;

  /* ---------- motyw ---------- */

  function initTheme() {
    const root = document.documentElement;
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const chosen = () => { const t = storage.get(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; };
    const sync = () => markChoice('themeSeg', 'themeChoice', root.getAttribute('data-theme'));
    document.querySelectorAll('#themeSeg button').forEach(b => b.addEventListener('click', () => {
      root.setAttribute('data-theme', b.dataset.themeChoice);
      storage.set(THEME_KEY, b.dataset.themeChoice);
      sync();
    }));
    if (system.addEventListener) {
      system.addEventListener('change', () => { if (!chosen()) { root.setAttribute('data-theme', system.matches ? 'dark' : 'light'); sync(); } });
    }
    sync();
  }

  /** Wysokość przyklejonego nagłówka (--head) — margines przewijania, by nic nie chowało się pod nim. */
  function trackHeader() {
    const head = document.querySelector('header.top');
    const update = () => document.documentElement.style.setProperty('--head', head.offsetHeight + 'px');
    update();
    if (window.ResizeObserver) new ResizeObserver(update).observe(head);
  }

  /* ---------- powiększenie i ustawienia ---------- */

  function initZoom() {
    const apply = () => document.documentElement.style.setProperty('--fs', S.prefs.fontSize + 'px');
    const zoom = d => { S.setPref('fontSize', Math.max(12, Math.min(34, S.prefs.fontSize + d))); apply(); };
    $('zoomIn').addEventListener('click', () => zoom(FONT_STEP));
    $('zoomOut').addEventListener('click', () => zoom(-FONT_STEP));
    apply();
  }

  function initOptions() {
    const applyColors = () => document.documentElement.classList.toggle('colors-off', !S.prefs.colors);
    const options = {
      optAutoHyp: ['autoHyp', on => { if (on) S.commit(() => true); }],   // włączenie zamyka pasujące cele (można cofnąć)
      optColors: ['colors', applyColors],
      optFireworks: ['fireworks', () => {}],
    };
    Object.entries(options).forEach(([id, [pref, effect]]) => {
      const box = $(id);
      box.checked = S.prefs[pref];
      box.addEventListener('change', () => { S.setPref(pref, box.checked); effect(box.checked); });
    });
    applyColors();
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

  /** Po wczytaniu dowodu z linku usuwa #d=… z adresu, by odświeżenie nie wczytywało go ponownie. */
  function forgetLinkHash(embedded) {
    const clean = w => { try { if (/^#d=/.test(w.location.hash)) w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) { /* inna domena */ } };
    clean(window);
    if (embedded) clean(window.top);
  }

  function initShare(embedded) {
    $('share').addEventListener('click', () => {
      if (!st.frags.length) { toast('Nie ma jeszcze czego udostępnić'); return; }
      const hash = S.shareHash();
      if (!hash) { toast('Dowód jest za duży na link — użyj eksportu'); return; }
      let base = location.href;
      if (embedded) { try { base = window.top.location.href; } catch (e) { /* zostaje adres ramki */ } }
      copyText(base.split('#')[0] + hash, 'Skopiowano link do bieżącego dowodu');
    });
  }

  /* ---------- klawiatura ---------- */

  function onKey(e) {
    if (UI.present.isOpen()) { UI.present.onKey(e); return; }
    if (Modal.anyOpen()) { if (e.key === 'Escape') Modal.close(Modal.top()); return; }
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); S.undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); S.redo(); return; }
    if (mod || e.altKey) return;
    // przytrzymany klawisz nie może „wyklikać” całego dowodu podpowiedziami
    if (e.repeat && (k === 'h' || k === 'p')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (UI.actions.runOp('clear')) e.preventDefault(); }
    else if (e.key === 'Escape') {
      if ($('exMenu').open) $('exMenu').open = false;
      else if (st.sel.length) S.select([]);
    } else if (k === 'n') UI.actions.gotoNextOpen();
    else if (k === 'h') UI.hints.press();
    else if (k === 'p') UI.present.open();
  }

  /* ---------- start ---------- */

  function boot() {
    hydrateIcons();
    trackHeader();
    Modal.init();
    const source = S.load();
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
    if (source === 'link') forgetLinkHash(embedded);
    document.addEventListener('keydown', onKey);
    $('helpOpen').addEventListener('click', () => Modal.open('helpModal'));
    $('exportOpen').addEventListener('click', () => UI.exporter.open());
    S.on('complete', () => { toast('Dowód kompletny!'); UI.fireworks.launch(); });
    S.refresh();
    if (source === 'empty' && UI.tutorial.shouldAutostart()) UI.tutorial.start();
  }

  boot();
})(globalThis.ND ||= {});
