/* =====================================================================
   Stan aplikacji: fragmenty dowodów, zaznaczenie, tryb, ustawienia,
   historia (cofnij/ponów) i zapis. Każda zmiana dowodu przechodzi przez
   commit(), który pilnuje limitów i spójności — to jedyne „drzwi” do stanu.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules } = ND;
  const UI = (ND.UI ||= {});
  const { toast, storage, plural } = UI.kit;

  const KEYS = Object.freeze({
    proof: 'nd-proof', backup: 'nd-proof-backup', mode: 'nd-mode', prefs: 'nd-prefs',
    legacyAuto: 'nd-auto', legacyFont: 'nd-fs',
  });
  const MAX_LINK = 300000;          // maks. długość danych w linku (#d=…)
  const HISTORY_LIMIT = 100;
  const UNSAVED = 'Ta przeglądarka nie pozwala zapisać pracy — po zamknięciu karty zniknie; zachowaj ją linkiem (przycisk z łańcuchem)';

  const state = {
    frags: [],          // korzenie fragmentów
    mode: 'back',       // 'back' (od celu) | 'fwd' (od przesłanek)
    sel: [],            // zaznaczone identyfikatory węzłów
    picks: [],          // zaznaczone założenia i wnioski okien: 'a:<okno>' | 'f:<okno>:<nr>' (okno — klucz z boxIndex)
    boxes: new Map(),   // klucz okna → { b, owner, i, fi, scope, boxes } (Proof.boxIndex)
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
    state.boxes = Proof.boxIndex(state.frags);
    state.errors = Rules.verify(state.frags);
    state.sel = state.sel.filter(id => state.idx.has(id));
    state.picks = state.picks.filter(k => resolvePick(k));
  }

  /* ---------- założenia i wnioski okien ---------- */

  /**
   * Zaznaczone założenie albo wniosek okna:
   * { key, kind: 'asm' | 'fact', box (z boxIndex), boxKey, k, f, fact } albo null, gdy już nie istnieje.
   */
  function resolvePick(key) {
    const m = /^(a|f):(\d+:\d+)(?::(\d+))?$/.exec(key);
    const box = m && state.boxes.get(m[2]);
    if (!box) return null;
    if (m[1] === 'a') return m[3] === undefined ? { key, kind: 'asm', box, boxKey: m[2], k: null, f: box.b.a, fact: null } : null;
    const fact = m[3] === undefined ? null : Proof.factsOf(box.b)[+m[3]];
    return fact ? { key, kind: 'fact', box, boxKey: m[2], k: +m[3], f: fact.f, fact } : null;
  }

  /** Usuwa wnioski, które przestały być poprawne (np. okno odłączone od założeń, z których wyciągnięto wniosek). */
  function pruneFacts(roots) {
    Proof.boxIndex(roots).forEach(({ b, scope }) => {
      if (!b.facts) return;
      const keep = b.facts.filter(w => Rules.validFact(w, scope));
      if (keep.length !== b.facts.length) b.facts = keep;
    });
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

  const plainKey = root => JSON.stringify(Proof.toPlain(root));
  /** Kompletne fragmenty (jako klucze) — zmiana, po której pojawia się nowy, zasługuje na fajerwerki. */
  const completeKeys = () => new Set(state.frags.filter(r => status(r).complete).map(plainKey));

  /* ---------- odczyt, porządki, limity ---------- */

  const snapshot = () => Proof.serialize(state.frags);

  /** Dodatkowe automatyczne zamykanie celów w wybranych fragmentach (samouczek), niezależne od ustawień. */
  let autoCloseAlso = null;
  const setAutoCloseFor = pred => { autoCloseAlso = pred; };
  /** Czy cele-założenia w tym fragmencie zamykają się same (ustawienie albo samouczek). */
  const autoCloses = root => prefs.autoHyp || !!(autoCloseAlso && autoCloseAlso(root));

  /** Porządki we fragmentach: założenia poza oknem otwarte, automatyczne zamykanie celów. */
  function normalizeRoots(roots) {
    Proof.reopenStrayHyps(roots);
    pruneFacts(roots);
    if (prefs.autoHyp) Proof.closeByScope(roots);
    else if (autoCloseAlso) Proof.closeByScope(roots.filter(autoCloseAlso));
  }

  /** Porządki po każdej zmianie i aktualny indeks. */
  function normalize() {
    normalizeRoots(state.frags);
    reindex();
  }

  /**
   * Odtwarza fragmenty z zapisu. Kopie z historii są zaufane (bez limitów rozmiaru);
   * dane z zewnątrz (trusted: false) rzucają FormatError — stan pozostaje wtedy bez zmian.
   */
  function restore(json, { trusted = true } = {}) {
    state.frags = Proof.deserialize(json, Rules.isRule, { trusted });
    state.sel = [];
    state.picks = [];
    state.hint = null;
    normalize();
    markSeen();
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

  let persistent = true, warned = false;

  /** Zapisuje pracę; zwraca, czy się udało (tryb prywatny, brak miejsca…). */
  function save(json = snapshot()) {
    persistent = storage.set(KEYS.proof, json) && storage.set(KEYS.mode, state.mode);
    return persistent;
  }

  /** Zapis po zmianie — z jednorazowym ostrzeżeniem, gdy przeglądarka nie pozwala zapisywać. */
  function persist(json) {
    if (!save(json) && !warned) {
      warned = true;
      toast(UNSAVED, { important: true });
    }
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

  /* ---------- historia ---------- */

  /** Wpis historii: dowód i ustawienie automatycznego zamykania celów (jego zmiana też jest krokiem). */
  const history = { undo: [], redo: [] };
  const entry = (proof = snapshot()) => ({ proof, autoHyp: prefs.autoHyp });

  function record(before) {
    history.undo.push(before);
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
  }

  function travel(from, to) {
    if (!from.length) return;
    const target = from.pop();
    to.push(entry());
    const prefChanged = target.autoHyp !== prefs.autoHyp;
    if (prefChanged) setPref('autoHyp', target.autoHyp);
    restore(target.proof);
    persist();
    notify();
    if (prefChanged) emit('prefs');
  }
  const undo = () => travel(history.undo, history.redo);
  const redo = () => travel(history.redo, history.undo);
  const canUndo = () => history.undo.length > 0;
  const canRedo = () => history.redo.length > 0;

  /* ---------- zmiany ---------- */

  /**
   * Zmienia dowód: fn modyfikuje state.frags (zwrot false = rezygnacja).
   * opcje: celebrate — świętuj, jeśli zmiana ukończyła dowód; select — zaznaczenie po zmianie.
   * Przekroczenie limitów lub wyjątek cofa zmianę. Zwraca true, jeśli dowód się zmienił.
   */
  function commit(fn, { celebrate = false, select = null } = {}) {
    const before = snapshot();
    const doneBefore = celebrate ? completeKeys() : null;
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
    if (select) {
      state.sel = select().filter(id => state.idx.has(id));
      state.picks = [];
    }
    const after = snapshot(), changed = after !== before;
    if (changed) {
      record(entry(before));
      persist(after);
    }
    notify();
    if (doneBefore && [...completeKeys()].some(k => !doneBefore.has(k))) emit('complete');
    return changed;
  }

  /** Włącza/wyłącza automatyczne zamykanie celów — jako krok historii (cofnięcie przywraca też ustawienie). */
  function setAutoHyp(on) {
    if (typeof on !== 'boolean' || on === prefs.autoHyp) return;
    const before = entry(), doneBefore = completeKeys();
    setPref('autoHyp', on);
    normalize();
    record(before);
    persist();
    notify();
    emit('prefs');
    if ([...completeKeys()].some(k => !doneBefore.has(k))) emit('complete');
  }

  function select(ids) {
    state.sel = ids;
    state.picks = [];
    refresh();
  }

  /** Zaznacza założenia/wnioski okien (zaznaczenie formuł dowodu znika). */
  function pick(keys) {
    state.picks = keys;
    state.sel = [];
    state.hint = null;
    refresh();
  }

  function setMode(mode) {
    if (mode !== 'back' && mode !== 'fwd') return;
    state.mode = mode;
    if (mode === 'back' && state.sel.length > 1) state.sel = state.sel.slice(-1);
    storage.set(KEYS.mode, mode);
  }

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

  /** Czy fragment adresu zawiera dowód (#d=…). Znaki doklejone na końcu (np. kropka z czatu) są pomijane. */
  const isLinkHash = hash => /^#d=/.test(hash);
  const LINK_DATA = /^#d=([\w-]+)/;

  /**
   * Dołącza fragmenty z linku do obszaru roboczego (nie nadpisuje pracy użytkownika).
   * Pomija fragmenty, które już są (ten sam link otwarty ponownie), oraz te, które nie mieszczą się w limitach.
   */
  function importLink(encoded) {
    if (encoded.length > MAX_LINK) throw new Proof.FormatError('link');
    const incoming = Proof.deserialize(unbase64url(encoded), Rules.isRule, { trusted: false });
    normalizeRoots(incoming);   // porównujemy z fragmentami po tych samych porządkach
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
    if (skipped) {
      parts.push(`${skipped} ${plural(skipped, 'fragment się nie zmieścił', 'fragmenty się nie zmieściły', 'fragmentów się nie zmieściło')}`
        + ' — usuń niepotrzebne i otwórz link ponownie');
    }
    return parts.join(' · ');
  }

  /** Wczytuje dowód z fragmentu adresu: { ok, message } albo null, gdy adres nie zawiera dowodu. */
  function importHash(hash) {
    if (!isLinkHash(hash)) return null;
    try {
      const m = hash.match(LINK_DATA);
      if (!m) throw new Proof.FormatError('link');
      return { ok: true, message: linkMessage(importLink(m[1])) };
    } catch (e) {
      const tooBig = e instanceof Proof.FormatError && ['link', 'rozmiar', 'fragmenty'].includes(e.message);
      return { ok: false, message: tooBig ? 'Dowód z linku jest za duży dla tej aplikacji' : 'Nie udało się odczytać dowodu z linku' };
    }
  }

  /** Link otwarty w działającej aplikacji (zmiana #d=… w adresie) — jako krok historii. */
  function openLink(hash) {
    const before = entry();
    const result = importHash(hash);
    if (!result) return null;
    if (snapshot() !== before.proof) {
      record(before);
      persist();
    }
    notify();
    return result;
  }

  /* ---------- inne karty ---------- */

  /**
   * Zapis zmieniony w innej karcie z tą aplikacją (np. otwartej „na pełnym ekranie”):
   * przejmujemy jej stan, zamiast nadpisać go przy najbliższej zmianie.
   */
  function onStorageEvent(e) {
    if (e.key === KEYS.prefs) { loadPrefs(); emit('prefs'); notify(); return; }
    if (e.key === KEYS.mode && (e.newValue === 'back' || e.newValue === 'fwd')) { state.mode = e.newValue; refresh(); return; }
    if (e.key !== KEYS.proof || typeof e.newValue !== 'string' || e.newValue === snapshot()) return;
    try {
      restore(e.newValue, { trusted: false });
    } catch (err) {
      return;
    }
    history.undo = [];
    history.redo = [];
    notify();
    emit('external');
    toast('Wczytano zmiany z innej karty z tą aplikacją', { important: true });
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
    const link = importHash(location.hash);
    if (link) {
      messages.push(link.message);
      if (link.ok) source = 'link';
    }
    if (!save()) { warned = true; messages.push(UNSAVED); }
    if (messages.length) toast(messages.join(' · '), { important: true });
    return source;
  }

  UI.store = Object.freeze({
    state, prefs, setPref, setAutoHyp, setAutoCloseFor, autoCloses, on, emit,
    status, completeNodes, isFresh,
    commit, refresh, select, pick, resolvePick, setMode,
    undo, redo, canUndo, canRedo,
    load, save, persistent: () => persistent, shareHash, isLinkHash, openLink, onStorageEvent,
  });
})(globalThis.ND ||= {});
