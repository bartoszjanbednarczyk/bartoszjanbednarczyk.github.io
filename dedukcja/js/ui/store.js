/* =====================================================================
   Stan aplikacji: fragmenty dowodów, zaznaczenie, tryb, ustawienia,
   historia (cofnij/ponów) i zapis. Każda zmiana dowodu przechodzi przez
   commit(), który pilnuje limitów i spójności — to jedyne „drzwi” do stanu.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules } = ND;
  const UI = (ND.UI ||= {});
  const { toast, storage } = UI.kit;

  const KEYS = Object.freeze({
    proof: 'nd-proof', backup: 'nd-proof-backup', mode: 'nd-mode', prefs: 'nd-prefs',
    legacyAuto: 'nd-auto', legacyFont: 'nd-fs',
  });
  const MAX_LINK = 300000;          // maks. długość danych w linku (#d=…)
  const HISTORY_LIMIT = 100;

  const state = {
    frags: [],          // korzenie fragmentów
    mode: 'back',       // 'back' (od celu) | 'fwd' (od przesłanek)
    sel: [],            // zaznaczone identyfikatory węzłów
    hint: null,         // bieżąca podpowiedź (ui/hints.js)
    idx: new Map(),     // id → { n, fi, parent, slot, scope, up, depth }
    errors: new Set(),  // id węzłów z błędnie zastosowaną regułą
  };

  /* ---------- ustawienia (z walidacją wartości z localStorage) ---------- */

  const isBool = v => typeof v === 'boolean';
  const PREFS = {
    autoHyp: [true, isBool],
    colors: [true, isBool],
    fireworks: [true, isBool],
    fontSize: [20, v => Number.isFinite(v) && v >= 12 && v <= 34],
    nlOpen: [true, isBool],
    nlRules: [false, isBool],
    exportTab: ['image', v => v === 'image' || v === 'latex'],
    exportBg: [null, v => v === null || ['light', 'dark', 'transparent'].includes(v)],
    exportScale: [2, v => [1, 2, 3].includes(v)],
    texStandalone: [true, isBool],
    presentOrder: ['goal', v => v === 'goal' || v === 'reading'],
  };
  const prefs = Object.seal(Object.fromEntries(Object.entries(PREFS).map(([k, [d]]) => [k, d])));

  function setPref(k, v) {
    if (!PREFS[k] || !PREFS[k][1](v)) return;
    prefs[k] = v;
    storage.set(KEYS.prefs, JSON.stringify(prefs));
  }

  function loadPrefs() {
    let saved = null;
    try { saved = JSON.parse(storage.get(KEYS.prefs) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(PREFS)) if (PREFS[k][1](saved[k])) prefs[k] = saved[k];
    } else {
      // starsze klucze (sprzed pliku ustawień)
      const auto = storage.get(KEYS.legacyAuto), fs = Number(storage.get(KEYS.legacyFont));
      if (auto === '0' || auto === '1') prefs.autoHyp = auto === '1';
      if (PREFS.fontSize[1](fs)) prefs.fontSize = fs;
    }
  }

  /* ---------- zdarzenia ---------- */

  const listeners = {};
  const on = (event, fn) => (listeners[event] ||= []).push(fn);
  const emit = (event, data) => (listeners[event] || []).forEach(fn => fn(data));

  /* ---------- indeks, stan fragmentów ---------- */

  let seenId = 0;
  /** Węzły o id większym niż ostatnio narysowane są „nowe” (krótka animacja). */
  const isFresh = id => id > seenId;
  const markSeen = () => { seenId = Proof.latestId(); };

  function reindex() {
    state.idx = Proof.index(state.frags);
    state.errors = Rules.verify(state.frags);
    state.sel = state.sel.filter(id => state.idx.has(id));
  }

  /** Stan fragmentu: liczba otwartych celów i błędów, kompletność. */
  function status(root) {
    const open = Proof.openLeaves(root).length;
    let errors = 0;
    Proof.walk([root], n => { if (state.errors.has(n.id)) errors++; });
    return { open, errors, complete: !open && !errors };
  }

  /** Węzły, których cały poddowód jest uzasadniony i poprawny (kolorowanie na zielono). */
  const completeNodes = root => Proof.completeSubtrees(root, n => n.rule !== null && !state.errors.has(n.id));

  const completeCount = () => state.frags.filter(r => status(r).complete).length;

  /* ---------- odczyt, porządki, limity ---------- */

  const snapshot = () => Proof.serialize(state.frags);

  /**
   * Odtwarza fragmenty z zapisu. Kopie z historii są zaufane (bez limitów rozmiaru);
   * dane z zewnątrz (trusted: false) rzucają FormatError — stan pozostaje wtedy bez zmian.
   */
  function restore(json, { trusted = true } = {}) {
    state.frags = Proof.deserialize(json, Rules.isRule, { trusted });
    state.sel = [];
    state.hint = null;
    normalize();
    markSeen();
  }

  /** Porządki po każdej zmianie: założenia poza oknem otwarte, automatyczne zamykanie, indeks. */
  function normalize() {
    Proof.reopenStrayHyps(state.frags);
    if (prefs.autoHyp) Proof.closeByScope(state.frags);
    reindex();
  }

  function limitViolation() {
    if (state.frags.length > Proof.LIMITS.fragments) return `Za dużo fragmentów (maks. ${Proof.LIMITS.fragments}) — usuń niepotrzebne`;
    const s = Proof.stats(state.frags);
    if (s.nodes > Proof.LIMITS.nodes) return 'Dowód byłby za duży — ten krok cofnięto';
    if (s.depth > Proof.LIMITS.depth) return 'Dowód byłby za głęboki — ten krok cofnięto';
    if (s.formula > F.LIMITS.size) return 'Powstałaby zbyt duża formuła — ten krok cofnięto';
    return null;
  }

  /* ---------- zapis i powiadamianie ---------- */

  function save(json = snapshot()) {
    storage.set(KEYS.proof, json);
    storage.set(KEYS.mode, state.mode);
  }

  /** Powiadamia widoki (indeks musi być aktualny). */
  function notify() {
    emit('render');
    markSeen();
  }

  /** Przerysowanie bez zmiany dowodu (np. po zmianie zaznaczenia albo podpowiedzi). */
  function refresh() {
    reindex();
    notify();
  }

  /* ---------- zmiany ---------- */

  /**
   * Zmienia dowód: fn modyfikuje state.frags (zwrot false = rezygnacja).
   * opcje: celebrate — świętuj, jeśli zmiana ukończyła dowód; select — zaznaczenie po zmianie.
   * Przekroczenie limitów lub wyjątek cofa zmianę. Zwraca true, jeśli dowód się zmienił.
   */
  function commit(fn, { celebrate = false, select = null } = {}) {
    const before = snapshot();
    const completeBefore = celebrate ? completeCount() : 0;
    let result;
    try {
      result = fn();
    } catch (e) {
      restore(before);
      notify();
      throw e;
    }
    if (result === false) { refresh(); return false; }
    normalize();
    const violation = limitViolation();
    if (violation) {
      restore(before);
      toast(violation);
      notify();
      return false;
    }
    if (select) state.sel = select().filter(id => state.idx.has(id));
    const after = snapshot(), changed = after !== before;
    if (changed) {
      history.undo.push(before);
      if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
      history.redo = [];
      save(after);
    }
    notify();
    if (celebrate && completeCount() > completeBefore) emit('complete');
    return changed;
  }

  function select(ids) {
    state.sel = ids;
    refresh();
  }

  function setMode(mode) {
    if (mode !== 'back' && mode !== 'fwd') return;
    state.mode = mode;
    if (mode === 'back' && state.sel.length > 1) state.sel = state.sel.slice(-1);
    storage.set(KEYS.mode, mode);
  }

  /* ---------- historia ---------- */

  const history = { undo: [], redo: [] };
  function travel(from, to) {
    if (!from.length) return;
    const target = from.pop(), current = snapshot();
    restore(target);
    to.push(current);
    save();
    notify();
  }
  const undo = () => travel(history.undo, history.redo);
  const redo = () => travel(history.redo, history.undo);
  const canUndo = () => history.undo.length > 0;
  const canRedo = () => history.redo.length > 0;

  /* ---------- linki ---------- */

  function base64url(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const unbase64url = s => new TextDecoder('utf-8', { fatal: true })
    .decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

  /** Fragment adresu z bieżącymi dowodami (#d=…) albo null, gdy dowód jest za duży na link. */
  function shareHash() {
    const data = base64url(snapshot());
    return data.length > MAX_LINK ? null : '#d=' + data;
  }

  const plainKey = root => JSON.stringify(Proof.toPlain(root));

  /**
   * Dołącza fragmenty z linku do obszaru roboczego (nie nadpisuje pracy użytkownika).
   * Pomija fragmenty, które już są (ten sam link otwarty ponownie), oraz te, które nie mieszczą się w limitach.
   */
  function importLink(encoded) {
    if (encoded.length > MAX_LINK) throw new Proof.FormatError('link');
    const incoming = Proof.deserialize(unbase64url(encoded), Rules.isRule, { trusted: false });
    const have = new Set(state.frags.map(plainKey));
    const result = { added: 0, duplicates: 0, skipped: 0, total: incoming.length };
    for (const root of incoming) {
      const k = plainKey(root);
      if (have.has(k)) { result.duplicates++; continue; }
      state.frags.push(root);
      if (limitViolation()) { state.frags.pop(); result.skipped++; continue; }
      have.add(k);
      result.added++;
    }
    normalize();
    markSeen();
    return result;
  }

  function linkMessage({ added, duplicates, skipped, total }) {
    if (!total) return 'Link nie zawiera dowodu';
    const parts = [];
    if (added) parts.push('Wczytano dowód z linku');
    else if (duplicates) parts.push('Dowód z linku jest już w obszarze roboczym');
    if (skipped) parts.push(`${skipped} ${skipped === 1 ? 'fragment się nie zmieścił' : 'fragmenty się nie zmieściły'} — usuń niepotrzebne i otwórz link ponownie`);
    return parts.join(' · ');
  }

  /* ---------- start ---------- */

  /**
   * Odczyt na starcie: ustawienia, zapisana praca, ewentualny dowód z linku.
   * Nieczytelny zapis nie przepada — trafia pod osobny klucz (kopia zapasowa).
   * Zwraca 'link', 'saved' albo 'empty'.
   */
  function load() {
    loadPrefs();
    const mode = storage.get(KEYS.mode);
    if (mode === 'back' || mode === 'fwd') state.mode = mode;
    const messages = [];
    let source = 'empty';
    const saved = storage.get(KEYS.proof);
    if (saved) {
      try {
        restore(saved, { trusted: false });
        if (state.frags.length) source = 'saved';
      } catch (e) {
        storage.set(KEYS.backup, saved);
        state.frags = [];
        reindex();
        messages.push('Nie udało się odczytać zapisanej pracy — jej kopia została zachowana');
      }
    }
    const m = location.hash.match(/^#d=([\w-]+)$/);
    if (m) {
      try {
        messages.push(linkMessage(importLink(m[1])));
        source = 'link';
      } catch (e) {
        messages.push('Nie udało się odczytać dowodu z linku');
      }
    }
    save();
    if (messages.length) toast(messages.join(' · '));
    return source;
  }

  UI.store = Object.freeze({
    state, prefs, setPref, on, emit,
    status, completeNodes, isFresh,
    commit, refresh, select, setMode,
    undo, redo, canUndo, canRedo,
    load, save, shareHash,
  });
})(globalThis.ND ||= {});
