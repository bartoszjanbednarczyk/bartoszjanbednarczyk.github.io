/* =====================================================================
   Stan aplikacji: fragmenty dowodów, zaznaczenie, tryb, ustawienia,
   historia (cofnij/ponów) i zapis. Każda zmiana dowodu przechodzi przez
   commit(), który pilnuje limitów i spójności — to jedyne „drzwi” do stanu.
   Aplikacja ma trzy działy: dedukcja naturalna dla rachunku zdań ('prop') i dla rachunku
   kwantyfikatorów ('fo') — oba w tym stanie, każdy z własnymi dowodami, historią i zapisem —
   oraz rezolucję ('res', osobny moduł ui/res.js). Bieżący dział: system(); składnia formuł: logic().
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Rules } = ND;
  const UI = (ND.UI ||= {});
  const { toast, storage, plural, createHistory, LINK_LIMIT, encodeLink, decodeLink } = UI.kit;

  const KEYS = Object.freeze({
    prefs: 'nd-prefs', system: 'nd-system', logic: 'nd-logic',
    legacyAuto: 'nd-auto', legacyFont: 'nd-fs',
  });
  /** Klucze zapisu każdego rachunku. */
  const LOGICS = Object.freeze({
    prop: Object.freeze({ proof: 'nd-proof', backup: 'nd-proof-backup', mode: 'nd-mode' }),
    fo: Object.freeze({ proof: 'nd-fo-proof', backup: 'nd-fo-proof-backup', mode: 'nd-fo-mode' }),
  });
  /** Działy i znaczniki ich linków: #d=… — rachunek zdań, #q=… — kwantyfikatory, #r=… — rezolucja. */
  const LINK_TAGS = Object.freeze({ prop: 'd', fo: 'q', res: 'r' });
  const SYSTEMS = Object.freeze(Object.keys(LINK_TAGS));
  let logic = 'prop', system = 'prop';
  const keys = () => LOGICS[logic];
  const UNSAVED = 'Ta przeglądarka nie pozwala zapisać pracy — zniknie ona po zamknięciu karty. Aby ją zachować, skopiuj link (przycisk z łańcuchem)';
  const UNREADABLE = 'Nie udało się odczytać zapisanej pracy — zachowano jej kopię zapasową';

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
    state.frags = Proof.deserialize(json, Rules.isRule, { trusted, logic });
    state.sel = [];
    state.picks = [];
    state.hint = null;
    normalize();
    markSeen();
  }

  const TOO_BIG = 'Powstałaby zbyt duża formuła — ten krok cofnięto';

  function limitViolation() {
    if (state.frags.length > Proof.LIMITS.fragments) return `Za dużo fragmentów (maks. ${Proof.LIMITS.fragments}) — usuń niepotrzebne`;
    const s = Proof.stats(state.frags);
    if (s.nodes > Proof.LIMITS.nodes) return 'Dowód byłby za duży — ten krok cofnięto';
    if (s.depth > Proof.LIMITS.depth) return 'Dowód byłby za głęboki — ten krok cofnięto';
    if (s.formula > F.LIMITS.size) return TOO_BIG;
    return null;
  }

  /* ---------- czy zapis da się odczytać ---------- */

  const allFormulas = () => state.frags.flatMap(Proof.formulas);
  /** Symbole, które w którymś fragmencie mają różną liczbę argumentów (np. p i p(a)). */
  const clashingSymbols = () => new Set(state.frags.map(r => F.arityClash(Proof.formulas(r))).filter(Boolean));
  /** Stan przed zmianą: klucze formuł i symbole z kolizjami (starsze zapisy bywają nimi obciążone). */
  const readability = () => ({ keys: new Set(allFormulas().map(F.key)), clashes: clashingSymbols() });

  /**
   * Zapis musi się dać odczytać (z localStorage i z linku czyta się go ściśle): każda nowa formuła
   * przechodzi ścisły odczyt (limity parsera, stała liczba argumentów symboli), a w żadnym fragmencie
   * nie pojawia się nowa kolizja liczby argumentów. Zwraca komunikat albo null.
   */
  function unreadableChange(before) {
    const arity = n => `Symbol ${F.plainName(n)} miałby w jednym dowodzie różną liczbę argumentów — ten krok cofnięto`;
    for (const f of allFormulas()) {
      const k = F.key(f);
      if (before.keys.has(k)) continue;
      try { F.parse(k, { logic }); } catch (e) {
        const n = F.arityClash([f]);
        return n ? arity(n) : TOO_BIG;
      }
    }
    const fresh = [...clashingSymbols()].find(n => !before.clashes.has(n));
    return fresh ? arity(fresh) : null;
  }

  /* ---------- zapis i powiadamianie ---------- */

  /** Czy ostatni zapis się udał — osobno dla dedukcji naturalnej ('nd') i rezolucji ('res'). */
  const saved = { nd: true, res: true };
  let warned = false;

  /** Zapisuje pracę; zwraca, czy się udało (tryb prywatny, brak miejsca…). */
  function save(json = snapshot()) {
    saved.nd = storage.set(keys().proof, json) && storage.set(keys().mode, state.mode);
    return saved.nd;
  }

  /** Wynik zapisu po zmianie (channel: 'nd' albo 'res') — z jednorazowym ostrzeżeniem, gdy się nie udał. */
  function noteSaved(ok, channel = 'nd') {
    saved[channel] = ok;
    if (!ok && !warned) {
      warned = true;
      toast(UNSAVED, { important: true });
    }
  }

  const persist = json => noteSaved(save(json));

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
  const history = createHistory();
  const entry = (proof = snapshot()) => ({ proof, autoHyp: prefs.autoHyp });
  const record = before => history.record(before);

  function travel(target) {
    if (!target) return;
    const prefChanged = target.autoHyp !== prefs.autoHyp;
    if (prefChanged) setPref('autoHyp', target.autoHyp);
    restore(target.proof);
    persist();
    notify();
    if (prefChanged) emit('prefs');
  }
  const undo = () => travel(history.back(entry()));
  const redo = () => travel(history.forward(entry()));

  /* ---------- zmiany ---------- */

  /**
   * Zmienia dowód: fn modyfikuje state.frags (zwrot false = rezygnacja).
   * opcje: celebrate — świętuj, jeśli zmiana ukończyła dowód; select — zaznaczenie po zmianie.
   * Przekroczenie limitów lub wyjątek cofa zmianę. Zwraca true, jeśli dowód się zmienił.
   */
  function commit(fn, { celebrate = false, select = null } = {}) {
    const before = snapshot(), readableBefore = readability();
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
    const violation = limitViolation() || unreadableChange(readableBefore);
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
    storage.set(keys().mode, mode);
  }

  /* ---------- działy: rachunek zdań, rachunek kwantyfikatorów, rezolucja ---------- */

  /** Odłożona praca drugiego rachunku: { proof, history, mode } (wraca po przełączeniu). */
  const parked = {};
  const savedMode = l => { const m = storage.get(LOGICS[l].mode); return m === 'back' || m === 'fwd' ? m : 'back'; };

  /** Przełącza stan na dowody innego rachunku (bieżące odkłada razem z historią). */
  function switchLogic(to) {
    if (to === logic || !LOGICS[to]) return;
    parked[logic] = { proof: snapshot(), history: history.park(), mode: state.mode };
    logic = to;
    storage.set(KEYS.logic, to);
    const p = parked[to];
    delete parked[to];
    history.unpark(p && p.history);
    state.mode = p ? p.mode : savedMode(to);
    try {
      restore(p ? p.proof : storage.get(keys().proof) || '[]', { trusted: !!p });
    } catch (e) {
      // odłożona kopia czyta się zawsze (trusted), więc tu trafia tylko nieczytelny zapis z przeglądarki
      storage.set(keys().backup, storage.get(keys().proof) || '');
      state.frags = [];
      reindex();
      toast(UNREADABLE, { important: true });
    }
  }

  /** Zmienia dział aplikacji ('prop' | 'fo' | 'res'). */
  function setSystem(to) {
    if (!SYSTEMS.includes(to) || to === system) return;
    if (to !== 'res') switchLogic(to);
    system = to;
    storage.set(KEYS.system, to);
    state.sel = [];
    state.picks = [];
    state.hint = null;
    emit('system');
    refresh();
  }

  /* ---------- linki ---------- */

  /** Fragment adresu z danymi działu `sys` (#d=…, #q=…, #r=…) albo null, gdy dane są za długie na link. */
  function linkHash(sys, json) {
    const data = encodeLink(json);
    return data.length > LINK_LIMIT ? null : `#${LINK_TAGS[sys]}=${data}`;
  }

  /** Fragment adresu z bieżącymi dowodami albo null, gdy dowód jest za duży na link. */
  const shareHash = () => linkHash(logic, snapshot());

  /**
   * Link z danymi działu: { system, data } albo null, gdy adres nie zawiera linku.
   * data to zakodowane dane (null — nieczytelne); znaki doklejone na końcu (np. kropka z czatu) są pomijane.
   */
  function parseLink(hash) {
    const m = /^#([a-z])=([\w-]*)/.exec(hash);
    const sys = m && SYSTEMS.find(s => LINK_TAGS[s] === m[1]);
    return sys ? { system: sys, data: m[2] || null } : null;
  }
  const isLinkHash = hash => !!parseLink(hash);

  /**
   * Dołącza fragmenty z linku do obszaru roboczego (nie nadpisuje pracy użytkownika).
   * Pomija fragmenty, które już są (ten sam link otwarty ponownie), oraz te, które nie mieszczą się w limitach.
   */
  function importLink(encoded) {
    if (encoded.length > LINK_LIMIT) throw new Proof.FormatError('rozmiar');
    const incoming = Proof.deserialize(decodeLink(encoded), Rules.isRule, { trusted: false, logic });
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
    else if (duplicates) parts.push('Dowód z linku jest już otwarty');
    if (skipped) {
      parts.push(`${skipped} ${plural(skipped, 'fragment się nie zmieścił', 'fragmenty się nie zmieściły', 'fragmentów się nie zmieściło')}`
        + ' — usuń niepotrzebne i otwórz link ponownie');
    }
    return parts.join(' · ');
  }

  /** Czy link dotyczy dowodów dedukcji naturalnej (a nie rezolucji). */
  const ndLink = link => !!link && !!LOGICS[link.system];

  /** Wczytuje dowód z fragmentu adresu: { ok, message } albo null, gdy adres nie zawiera dowodu (dedukcji). */
  function importHash(hash) {
    const link = parseLink(hash);
    if (!ndLink(link)) return null;
    if (link.system !== logic) switchLogic(link.system);
    try {
      if (!link.data) throw new Proof.FormatError('link');
      return { ok: true, message: linkMessage(importLink(link.data)) };
    } catch (e) {
      const tooBig = e instanceof Proof.FormatError && ['rozmiar', 'fragmenty'].includes(e.message);
      return { ok: false, message: tooBig ? 'Dowód z linku jest za duży dla tej aplikacji' : 'Nie udało się odczytać dowodu z linku' };
    }
  }

  /** Link otwarty w działającej aplikacji (zmiana #d=… w adresie) — jako krok historii (w dziale z linku). */
  function openLink(hash) {
    const link = parseLink(hash);
    if (!ndLink(link)) return null;
    setSystem(link.system);
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
    if (e.key === keys().mode && (e.newValue === 'back' || e.newValue === 'fwd')) { state.mode = e.newValue; refresh(); return; }
    // praca odłożonego rachunku zmieniona gdzie indziej — po przełączeniu wczytamy ją z zapisu
    const other = Object.keys(LOGICS).find(l => l !== logic && e.key === LOGICS[l].proof);
    if (other) { delete parked[other]; return; }
    if (e.key !== keys().proof || typeof e.newValue !== 'string' || e.newValue === snapshot()) return;
    try {
      restore(e.newValue, { trusted: false });
    } catch (err) {
      return;
    }
    history.clear();
    notify();
    emit('external');
    toast('Wczytano zmiany wprowadzone w innej karcie', { important: true });
  }

  /* ---------- start ---------- */

  /**
   * Odczyt na starcie: ustawienia, zapisana praca, ewentualny dowód z linku.
   * Nieczytelny zapis nie przepada — trafia pod osobny klucz (kopia zapasowa).
   * Zwraca 'link', 'saved' albo 'empty'.
   */
  function load() {
    loadPrefs();
    // dział: z linku, z zapisu albo rachunek zdań; rachunek dedukcji — ostatnio używany
    const savedSystem = storage.get(KEYS.system), savedLogic = storage.get(KEYS.logic);
    const link = parseLink(location.hash);
    system = link ? link.system : SYSTEMS.includes(savedSystem) ? savedSystem : 'prop';
    logic = system !== 'res' ? system : LOGICS[savedLogic] ? savedLogic : 'prop';
    state.mode = savedMode(logic);
    const messages = [];
    let source = 'empty';
    const saved = storage.get(keys().proof);
    if (saved) {
      try {
        restore(saved, { trusted: false });
        if (state.frags.length) source = 'saved';
      } catch (e) {
        storage.set(keys().backup, saved);
        state.frags = [];
        reindex();
        messages.push(UNREADABLE);
      }
    }
    const imported = importHash(location.hash);
    if (imported) {
      messages.push(imported.message);
      if (imported.ok) source = 'link';
    }
    if (!save()) { warned = true; messages.push(UNSAVED); }
    if (messages.length) toast(messages.join(' · '), { important: true });
    return source;
  }

  UI.store = Object.freeze({
    state, prefs, setPref, setAutoHyp, setAutoCloseFor, autoCloses, on, emit,
    logic: () => logic, system: () => system, setSystem,
    status, completeNodes, isFresh,
    commit, refresh, select, pick, resolvePick, setMode,
    undo, redo, canUndo: history.canUndo, canRedo: history.canRedo,
    load, save, noteSaved, persistent: (channel = 'nd') => saved[channel],
    linkHash, shareHash, parseLink, isLinkHash, openLink, onStorageEvent,
  });
})(globalThis.ND ||= {});
