/* =====================================================================
   Dział „Rezolucja” (rozdz. 2.7 skryptu): czy zbiór klauzul jest sprzeczny?
   Student albo wyprowadza klauzulę pustą ⊥ (rezolucyjny dowód sprzeczności,
   Def. 47), albo wskazuje wartościowanie spełniające wszystkie klauzule.
   Klauzule C₀, C₁, … to elementy zbioru 𝓕, a po nich kolejne rezolwenty —
   cała lista jest ciągiem z definicji 47. Logika jest w resolution.js; tu stan
   widoku, historia, zapis i link (#r=…). Wspólne z dedukcją naturalną są nagłówek,
   pasek akcji na dole (main.js przekazuje tu jego zdarzenia), eksport i ustawienia.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Res, Render, Examples } = ND;
  const UI = (ND.UI ||= {});
  const { $, icon, toast, storage, plural, scrollToView, keepFocus, Modal, anyOverlay, createHistory, decodeLink, LINK_LIMIT } = UI.kit;
  const S = UI.store;

  const KEYS = Object.freeze({ work: 'nd-res', backup: 'nd-res-backup' });
  const LOCKED = 'Podpowiedzi działają tylko w zbiorach przykładowych z kolokwiów i egzaminów — znajdziesz je na górze menu „Przykłady”';
  const TREE_TOO_BIG = 'Drzewo tego dowodu jest za duże, by je narysować — rezolwenty użyte wiele razy trzeba by w nim powtarzać. Dowodem sprzeczności jest ciąg klauzul poniżej.';
  const EMPTY_CHIPS = 5;        // przykłady na pustym ekranie

  let work = null;              // { initial, steps, valuation } albo null (brak zbioru)
  let sel = [];                 // zaznaczone numery klauzul (najwyżej dwie, w kolejności klikania)
  let hint = null;              // Res.hint(…) z poziomem: { level: 1 | 2, kind, … }
  let fresh = -1;               // numer klauzuli dodanej ostatnio (krótka animacja)
  const history = createHistory();

  const active = () => S.system() === 'res';
  const all = () => (work ? Res.allClauses(work) : []);
  const isDerived = i => !!work && i >= work.initial.length;

  /* ---------- zapis i historia ---------- */

  const snapshot = () => JSON.stringify(work ? Res.serialize(work) : null);

  function restore(json) {
    const o = JSON.parse(json);
    work = o ? Res.deserialize(o) : null;
    sel = [];
    hint = null;
  }

  const save = () => S.noteSaved(storage.set(KEYS.work, snapshot()), 'res');

  /** Stan rozwiązania: 'refuted' (jest ⊥), 'satisfied' (σ spełnia 𝓕) albo null. */
  const solved = () => (!work ? null : Res.refuted(work) ? 'refuted' : Res.satisfied(work) ? 'satisfied' : null);

  /**
   * Zmienia pracę: fn modyfikuje `work` (zwrot false — rezygnacja). Zapisuje krok historii,
   * zapamiętuje i przerysowuje; wyjątek cofa zmianę. celebrate — świętuj, jeśli zmiana rozwiązała zadanie.
   */
  function commit(fn, { celebrate = false } = {}) {
    const before = snapshot(), wasSolved = solved();
    let result;
    try {
      result = fn();
    } catch (e) {
      restore(before);
      render();
      throw e;
    }
    const changed = result !== false && snapshot() !== before;
    if (changed) {
      history.record(before);
      save();
      hint = null;
    }
    render();
    if (changed && celebrate) celebrateIfSolved(wasSolved);
    return changed;
  }

  function celebrateIfSolved(wasSolved) {
    const now = solved();
    if (!now || now === wasSolved) return;
    toast(now === 'refuted' ? 'Klauzula pusta ⊥ — zbiór jest sprzeczny!' : 'Wartościowanie spełnia wszystkie klauzule — zbiór nie jest sprzeczny!');
    UI.fireworks.launch();
  }

  function travel(target) {
    if (target === null) return;
    restore(target);
    save();
    render();
  }
  const undo = () => travel(history.back(snapshot()));
  const redo = () => travel(history.forward(snapshot()));

  /* ---------- operacje ---------- */

  /** Nowy zbiór klauzul (zastępuje bieżący — można to cofnąć). */
  function setClauses(initial) {
    commit(() => { work = { initial, steps: [], valuation: {} }; sel = []; fresh = -1; });
  }

  /** Dopisuje rezolwentę zaznaczonych klauzul względem zmiennej `on`. */
  function addResolvent(on) {
    if (sel.length !== 2) return;
    if (Res.refuted(work)) { toast('Klauzula pusta już jest na liście — dowód sprzeczności jest gotowy'); return; }
    const [a, b] = sel, list = all();
    if (!Res.canResolve(list[a], list[b], on)) return;
    const r = Res.resolve(list[a], list[b], on), dup = Res.indexOf(work, Res.key(r));
    if (dup >= 0) {
      toast(`Ta rezolwenta już jest na liście: ${F.plainName('C' + dup)} = ${Res.clauseText(r)}`);
      sel = [dup];
      render();
      revealClause(dup);
      return;
    }
    if (work.steps.length >= Res.LIMITS.steps) { toast('Za dużo rezolwent — usuń niepotrzebne'); return; }
    commit(() => { work.steps.push({ a, b, on, clause: r }); sel = []; fresh = list.length; }, { celebrate: true });
    revealClause(list.length);
  }

  /** Usuwa rezolwentę nr `i` razem z rezolwentami, które z niej powstały. */
  function removeResolvent(i) {
    if (!isDerived(i)) { toast('To klauzula zbioru 𝓕 — usunąć można tylko rezolwenty'); return; }
    const { steps, removed } = Res.withoutResolvent(work, i);
    commit(() => { work.steps = steps; sel = []; });
    toast(removed > 1 ? `Usunięto ${removed} ${plural(removed, 'rezolwentę', 'rezolwenty', 'rezolwent')} — możesz to cofnąć` : 'Usunięto rezolwentę — możesz to cofnąć');
  }

  /** Ustawia σ(v) na `value` albo usuwa wartość (null). */
  function setValue(v, value) {
    commit(() => {
      if (value === null) delete work.valuation[v];
      else work.valuation[v] = value;
    }, { celebrate: true });
  }

  const clearValuation = () => commit(() => { work.valuation = {}; });

  function clearAll() {
    if (!work) return;
    commit(() => { work = null; sel = []; });
    toast('Usunięto zbiór klauzul — możesz to cofnąć');
  }

  function toggleSelect(i) {
    sel = sel.includes(i) ? sel.filter(j => j !== i) : [...sel, i].slice(-2);
    if (hint && hint.kind === 'step' && hint.level < 2) hint = null;
    render();
    if (sel.includes(i)) revealClause(i);      // nad paskiem akcji, który właśnie się pojawił
  }

  function deselect() {
    if (!sel.length && !hint) return;
    sel = [];
    hint = null;
    render();
  }

  /* ---------- podpowiedzi ---------- */

  const hintsAllowed = () => !!work && Examples.RES.isSample(work.initial);

  /** Klawisz H / przycisk „Podpowiedź”: wskazówka → konkretny krok → wykonanie. */
  function pressHint() {
    if (anyOverlay()) return;
    if (!work) { toast('Najpierw wpisz zbiór klauzul albo wybierz przykład'); return; }
    if (!hintsAllowed()) { toast(LOCKED); return; }
    if (solved()) { toast('Zadanie jest rozwiązane'); return; }
    if (hint && hint.level === 2) { doHint(); return; }
    if (hint) hint.level = 2;
    else {
      const h = Res.hint(work);
      if (!h) { toast('Nie udało mi się znaleźć podpowiedzi'); return; }
      hint = { level: 1, ...h };
    }
    if (hint.kind === 'step' && hint.level === 2) sel = [hint.a, hint.b];
    render();
    if (hint.kind === 'step' && hint.level === 2) revealClause(hint.b);
  }

  function doHint() {
    const h = hint;
    if (!h) return;
    hint = null;
    if (h.kind === 'step') { sel = [h.a, h.b]; addResolvent(h.on); }
    else if (h.kind === 'reset') clearValuation();
    else setValue(h.v, h.value);
  }

  /* ---------- zapis matematyczny ---------- */

  const math = s => `<span class="math">${s}</span>`;
  const numHTML = i => math(F.htmlName('C' + i));                // C₀, C₁, …
  const clauseHTML = c => Render.math(Res.formula(c));
  const sigmaHTML = v => math(`σ(${F.htmlName(v)})`);
  const truthHTML = b => `<span class="tv">${b ? 'T' : 'F'}</span>`;
  const IN_F = `<span class="cwhy in">∈ ${math('𝓕')}</span>`;

  /** Pochodzenie klauzuli nr `i`: „∈ 𝓕” albo „rezolwenta Cₐ i C_b względem p”; `name` numeruje przesłanki. */
  function originHTML(i, { name = numHTML, on = true } = {}) {
    if (!isDerived(i)) return IN_F;
    const s = work.steps[i - work.initial.length];
    return `<span class="cwhy derived">rezolwenta ${name(s.a)} i ${name(s.b)}${on ? ` względem ${math(F.htmlName(s.on))}` : ''}</span>`;
  }

  function hintHTML() {
    const h = hint, first = h.level === 1;
    const v = h.v && sigmaHTML(h.v), p = h.on && math(F.htmlName(h.on));
    const TEXTS = {
      step: () => (first ? `Spróbuj wyeliminować zmienną ${p}: weź klauzulę zawierającą ${p} i klauzulę zawierającą ${math('¬' + F.htmlName(h.on))}.`
        : `Weź rezolwentę ${numHTML(h.a)} i ${numHTML(h.b)} względem ${p} — otrzymasz ${clauseHTML(h.clause)}.`),
      value: () => (first ? 'Ten zbiór nie jest sprzeczny — dobierz wartościowanie, przy którym w każdej klauzuli jest prawdziwy literał. Zacznij od klauzul, w których została tylko jedna zmienna bez wartości.'
        : `Ustaw ${v} = ${truthHTML(h.value)}.`),
      change: () => (first ? 'Ustawionych wartości nie da się uzupełnić do wartościowania spełniającego wszystkie klauzule — zmień wartość jednej ze zmiennych.'
        : `Zmień ${v} na ${truthHTML(h.value)}.`),
      reset: () => (first ? 'Ustawionych wartości nie da się uzupełnić do wartościowania spełniającego wszystkie klauzule — nie wystarczy zmienić jednej z nich.'
        : 'Wyczyść wartościowanie i zacznij od nowa.'),
    };
    const button = first ? '<button type="button" class="btn" data-hintgo="more">Pokaż krok</button>'
      : '<button type="button" class="btn primary" data-hintgo="do">Wykonaj ten krok</button>';
    return `${icon('bulb')}<div class="htext"><span class="hlev">${first ? 'Wskazówka' : 'Następny krok'}</span>${TEXTS[h.kind]()}</div><div class="hbtns">${button}</div>`;
  }

  /* ---------- rysowanie ---------- */

  /** Ocena klauzuli przy wartościowaniu σ (bez ocen, dopóki σ jest puste). */
  function valueHTML(c) {
    const v = Object.keys(work.valuation).length ? Res.valueOf(c, work.valuation) : null;
    if (v === true) return `<span class="cval yes" title="spełniona przy wartościowaniu σ">${icon('check')}</span>`;
    if (v === false) return `<span class="cval no" title="niespełniona przy wartościowaniu σ">${icon('x')}</span>`;
    return '<span class="cval"></span>';
  }

  function emptyHTML() {
    const chips = Examples.RES.LIST.map((e, i) => [e, i]).filter(([e]) => e.group !== 'rinne').slice(0, EMPTY_CHIPS)
      .map(([e, i]) => `<button type="button" class="txt" data-ex="${i}" title="${Render.esc(`${e.title} — ${e.note}`)}">${Render.esc(e.title)}</button>`).join('');
    return `<div class="card empty">
      <div class="big">⊥</div>
      <h2>Czy ten zbiór klauzul jest sprzeczny?</h2>
      <p>Wpisz zbiór klauzul i rozstrzygnij: wyprowadź z niego klauzulę pustą ${math('⊥')} regułą rezolucji — albo wskaż wartościowanie, które spełnia wszystkie klauzule. Tak jak w zadaniu 133 ze skryptu.</p>
      <div class="cta"><button type="button" class="btn primary lg" data-act="new">${icon('plus')}Wpisz zbiór klauzul</button></div>
      <div class="exchips"><span class="lab">albo zacznij od przykładu:</span>${chips}</div>
    </div>`;
  }

  /** Drzewo dowodu sprzeczności (jak na str. 43) i ciąg C₀, …, Cₙ z Def. 47 (tylko klauzule potrzebne do ⊥). */
  function refutationHTML() {
    const list = all(), empty = Res.emptyIndex(work), used = Res.usedIn(work, empty);
    const renumbered = j => numHTML(used.indexOf(j));
    const seq = used.map((j, k) => `<li>${numHTML(k)} = ${clauseHTML(list[j])} ${originHTML(j, { name: renumbered, on: false })}</li>`).join('');
    const root = Res.tree(work, empty);
    const tree = root ? `<div class="fbody"><div class="inner">${Render.proofHTML(root, { decorate: () => ({ cls: 'done' }) })}</div></div>`
      : `<p class="rnote">${TREE_TOO_BIG}</p>`;
    const exportButton = root ? `<div class="acts"><button type="button" class="btn ghost" data-act="export" title="Eksport: obrazek PNG/SVG albo LaTeX">${icon('download')}<span class="hide-sm">Eksport</span></button></div>` : '';
    return `<section class="card frag done rtree">
      <div class="fhead"><span class="num">Rezolucyjny dowód sprzeczności</span><span class="pill ok">${icon('check')}zbiór jest sprzeczny</span><span class="sp"></span>${exportButton}</div>
      ${tree}
      <div class="rseq"><p>Ten dowód jako ciąg klauzul (Def. 47), tylko z klauzulami potrzebnymi do wyprowadzenia ${math('⊥')}:</p><ol>${seq}</ol></div>
    </section>`;
  }

  function satisfiedHTML() {
    const values = Object.entries(work.valuation).sort(([a], [b]) => a.localeCompare(b))
      .map(([v, b]) => `${sigmaHTML(v)} = ${truthHTML(b)}`).join(', ');
    return `<section class="card frag done rsat">
      <div class="fhead"><span class="num">Zbiór nie jest sprzeczny</span><span class="pill ok">${icon('check')}σ spełnia 𝓕</span></div>
      <p>Wartościowanie ${values} spełnia wszystkie klauzule zbioru ${math('𝓕')}, więc zbiór jest spełnialny, a zatem nie jest sprzeczny.</p>
    </section>`;
  }

  function workHTML() {
    const list = all(), n0 = work.initial.length, state = solved();
    const used = state === 'refuted' ? new Set(Res.usedIn(work, Res.emptyIndex(work))) : null;
    const hinted = i => !!hint && hint.kind === 'step' && hint.level === 2 && (i === hint.a || i === hint.b);
    const rows = list.map((c, i) => {
      const cls = ['crow', sel.includes(i) && 'sel', i === fresh && 'fresh', i === n0 && 'first-derived', used && !used.has(i) && 'unused', hinted(i) && 'hinted']
        .filter(Boolean).join(' ');
      return `<div class="${cls}" data-ci="${i}" tabindex="0" role="button" aria-pressed="${sel.includes(i)}">`
        + `<span class="cnum">${numHTML(i)}</span><span class="cform">${clauseHTML(c)}</span>${originHTML(i)}${valueHTML(c)}</div>`;
    }).join('');
    const pill = state === 'refuted' ? `<span class="pill ok">${icon('check')}sprzeczny</span>`
      : state === 'satisfied' ? `<span class="pill ok">${icon('check')}spełnialny</span>`
        : `<span class="pill neutral">${list.length} ${plural(list.length, 'klauzula', 'klauzule', 'klauzul')}</span>`;
    return `<section class="card frag rset${state ? ' done' : ''}">
      <div class="fhead"><span class="num">Zbiór klauzul</span><span class="seq">${math(`𝓕 = {${work.initial.map(Res.clauseHTML).join(', ')}}`)}</span>${pill}<span class="sp"></span>
        <div class="acts"><button type="button" class="btn icon danger" data-act="reset" title="Usuń zbiór klauzul" aria-label="Usuń zbiór klauzul">${icon('trash')}</button></div></div>
      <div class="clist">${rows}</div>
    </section>
    ${state === 'refuted' ? refutationHTML() : ''}${state === 'satisfied' ? satisfiedHTML() : ''}`;
  }

  function renderValuation() {
    const names = work ? Res.varsOf(work.initial) : [];
    $('resValSub').textContent = work ? 'Kliknij T albo F przy zmiennej (drugie kliknięcie usuwa wartość). Przy klauzulach widać, czy są spełnione.'
      : 'Tu ustawisz wartościowanie zmiennych zbioru klauzul.';
    const choice = (v, value) => {
      const on = work.valuation[v] === value;
      return `<button type="button" data-var="${v}" data-value="${value}" class="${on ? 'on' : ''}" aria-pressed="${on}">${value ? 'T' : 'F'}</button>`;
    };
    $('resVars').innerHTML = names.map(v => `<div class="rvar">${sigmaHTML(v)}<div class="tseg">${choice(v, true)}${choice(v, false)}</div></div>`).join('')
      + (names.length && Object.keys(work.valuation).length ? '<button type="button" class="btn ghost" data-var="*">Wyczyść wartościowanie</button>' : '');
  }

  function infoHTML() {
    if (!work) return '';
    const state = solved();
    if (state === 'refuted') return '<b>Gotowe!</b> Wyprowadzono klauzulę pustą — zbiór jest sprzeczny. Lista klauzul to rezolucyjny dowód sprzeczności (Def. 47); klauzule niepotrzebne są wyszarzone.';
    if (state === 'satisfied') return '<b>Gotowe!</b> Wartościowanie z panelu po lewej spełnia wszystkie klauzule zbioru — zbiór nie jest sprzeczny.';
    if (sel.length === 1) return 'Kliknij drugą klauzulę — na dolnym pasku pojawią się ich rezolwenty.';
    if (sel.length === 2) return 'Wybierz rezolwentę z dolnego paska — trafi na koniec listy.';
    return `Rozstrzygnij, czy zbiór jest sprzeczny: kliknij <b>dwie klauzule</b>, aby dopisać ich rezolwentę (cel: klauzula pusta ${math('⊥')}), albo ustaw w panelu po lewej <b>wartościowanie</b>, które spełni wszystkie klauzule.`
      + (hintsAllowed() ? ' Utknąłeś? Naciśnij <b>Podpowiedź</b>.' : '');
  }

  function renderDock() {
    const dock = $('dock');
    dock.hidden = !work || (!sel.length && !hint);
    if (dock.hidden) return;
    const list = all(), named = i => `${numHTML(i)} = ${clauseHTML(list[i])}`;
    $('dockSel').innerHTML = sel.length === 1 ? `Klauzula ${named(sel[0])}`
      : sel.length === 2 ? `Zaznaczone: ${named(sel[0])} &nbsp; ${named(sel[1])}` : 'Podpowiedź';
    let rules = '';
    if (sel.length === 2) {
      const rs = Res.resolvents(list[sel[0]], list[sel[1]]);
      // podpowiedź dotyczy tej pary klauzul (w dowolnej kolejności) i tej zmiennej
      const hintedPair = !!hint && hint.kind === 'step' && hint.level === 2 && sel.includes(hint.a) && sel.includes(hint.b);
      const hinted = r => hintedPair && hint.on === r.on;
      rules = rs.length
        ? '<span class="grp">Rezolwenty</span>' + rs.map(r => `<button type="button" class="chip${hinted(r) ? ' hinted' : ''}" data-resolve="${r.on}" title="Rezolwenta względem ${F.plainName(r.on)}">`
          + `<span>względem ${math(F.htmlName(r.on))}: ${clauseHTML(r.clause)}</span></button>`).join('')
        : `<span class="note">Te klauzule nie mają pary przeciwnych literałów (${math('<i>p</i>')} w jednej i ${math('¬<i>p</i>')} w drugiej) — nie mają rezolwenty.</span>`;
    } else if (sel.length === 1) rules = '<span class="note">Kliknij drugą klauzulę, aby zobaczyć rezolwenty.</span>';
    $('dockRules').innerHTML = rules;
    $('dockRules').hidden = !rules;
    const removable = sel.length === 1 && isDerived(sel[0]);
    $('dockOps').innerHTML = removable ? `<span class="grp">Edycja</span><button type="button" class="chip op" data-op="remove" title="Usuwa tę rezolwentę i rezolwenty, które z niej powstały (Delete)">${icon('trash')}Usuń rezolwentę</button>` : '';
    $('dockOps').hidden = !removable;
    const box = $('dockHint');
    box.hidden = !hint;
    if (hint) { box.className = 'dock-hint'; box.innerHTML = hintHTML(); }
  }

  /** Fokus klawiatury po przerysowaniu: ten sam przycisk albo klauzula (po atrybutach), a gdy zniknął — najbliższy sensowny. */
  const FOCUS_KEYS = ['ci', 'var', 'value', 'resolve', 'hintgo', 'op', 'act', 'ex'];
  const FOCUS_FALLBACKS = ['#resWs .crow.sel', '#resWs .crow.fresh', '#dock [data-resolve]', '#resWs .crow'];

  function render() {
    if (!active()) return;
    keepFocus(['resWs', 'resVars', 'dock'], FOCUS_KEYS, draw, FOCUS_FALLBACKS);
    fresh = -1;
  }

  function draw() {
    $('resWs').innerHTML = work ? workHTML() : emptyHTML();
    renderValuation();
    const info = infoHTML();
    $('resInfo').hidden = !info;
    if (info) $('resInfo').innerHTML = `${icon('info')}<div>${info}</div>`;
    const state = solved();
    $('resStatus').innerHTML = state ? `<span class="pill ok">${icon('check')}${state === 'refuted' ? 'zbiór sprzeczny' : 'zbiór spełnialny'}</span>` : '';
    const hb = $('resHint'), on = hintsAllowed();
    hb.classList.toggle('off', !on);
    hb.setAttribute('aria-disabled', String(!on));
    hb.title = on ? 'Podpowiedź (H)' : LOCKED;
    $('resUndo').disabled = !history.canUndo();
    $('resRedo').disabled = !history.canRedo();
    $('resReset').disabled = !work;
    renderDock();
  }

  function revealClause(i) {
    requestAnimationFrame(() => {
      const el = $('resWs').querySelector(`[data-ci="${i}"]`);
      if (el) scrollToView(el, 'nearest');
    });
  }

  /* ---------- nowy zbiór klauzul ---------- */

  /** Paleta okna nowego zbioru: wiersze [etykieta, symbole] (symbol wstawiany dosłownie). */
  const PALETTE = [['zmienne', ['p', 'q', 'r', 's', 't']], ['symbole', ['¬', ' ∨ ', ', ', '⊥', '{', '}']]];
  const SYMBOLS = PALETTE.flatMap(([, row]) => row);

  function previewSet() {
    const v = $('resAskInput').value, out = $('resAskPreview');
    let set = null;
    if (!v.trim()) out.innerHTML = '<span class="muted">Tu pojawi się podgląd zbioru klauzul.</span>';
    else {
      try {
        set = Res.parseClauses(v);
        out.innerHTML = `<span class="ok">✓</span> ${math(`𝓕 = {${set.map(Res.clauseHTML).join(', ')}}`)}`;
      } catch (e) {
        out.innerHTML = `<span class="bad">${Render.esc(e instanceof Res.ResError ? e.message : 'Błąd składni')}</span>`;
      }
    }
    $('resAskOk').disabled = !set;
    return set;
  }

  /** Bieżący zbiór jako wpis do pola: jak w skrypcie, a gdy się nie zmieści — zwięźlej (~p|q, …). */
  function currentSetText() {
    if (!work) return '';
    const pretty = work.initial.map(Res.clauseText).join(', ');
    return pretty.length <= Res.LIMITS.chars ? pretty : work.initial.map(Res.plainText).join(',');
  }

  function askSet() {
    $('resAskInput').value = currentSetText();
    previewSet();
    Modal.open('resAskModal', { focus: $('resAskInput') });
  }

  function acceptSet() {
    const set = previewSet();
    if (!set) return;
    Modal.close('resAskModal');
    setClauses(set);
  }

  /** Wstawia symbol z palety w miejscu kursora. */
  function insertSymbol(s) {
    const inp = $('resAskInput'), a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
    inp.value = inp.value.slice(0, a) + s + inp.value.slice(z);
    inp.setSelectionRange(a + s.length, a + s.length);
    inp.focus();
    previewSet();
  }

  function loadExample(i) {
    const e = Examples.RES.LIST[i];
    if (!e) return;
    setClauses(Res.parseClauses(e.clauses));
    toast(`${e.title}: ${Examples.RES.isSample(work.initial) ? 'podpowiedzi są dostępne' : 'rozwiąż samodzielnie'}`);
  }

  /* ---------- link i eksport ---------- */

  /** Fragment adresu z bieżącym zbiorem (#r=…) albo null. */
  const shareHash = () => (work ? S.linkHash('res', snapshot()) : null);

  /** Wczytuje zbiór z linku #r=… (jako krok historii): { ok, message } albo null, gdy to nie link rezolucji. */
  function openLink(hash) {
    const link = S.parseLink(hash);
    if (!link || link.system !== 'res') return null;
    const fail = { ok: false, message: 'Nie udało się odczytać zbioru klauzul z linku' };
    if (!link.data || link.data.length > LINK_LIMIT) return fail;
    let incoming;
    try { incoming = Res.deserialize(JSON.parse(decodeLink(link.data))); } catch (e) { return fail; }
    if (work && snapshot() === JSON.stringify(Res.serialize(incoming))) return { ok: true, message: 'Ten zbiór klauzul jest już otwarty' };
    commit(() => { work = incoming; sel = []; });
    return { ok: true, message: 'Wczytano zbiór klauzul z linku' };
  }

  /**
   * Dowód do eksportu: { title, root }, { problem } (drzewo za duże do narysowania)
   * albo null (gdy nie ma jeszcze klauzuli pustej).
   */
  function exportSource() {
    if (!work || !Res.refuted(work)) return null;
    const root = Res.tree(work, Res.emptyIndex(work));
    return root ? { title: `𝓕 = {${work.initial.map(Res.clauseText).join(', ')}}`, root } : { problem: 'Drzewo tego dowodu jest za duże, by je narysować' };
  }

  /* ---------- klawiatura i pasek akcji (zdarzenia przekazuje main.js) ---------- */

  /** Skróty działu (cofnij/ponów obsługuje main.js): Delete, Esc, H. */
  function onKey(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (sel.length === 1 && isDerived(sel[0])) { e.preventDefault(); removeResolvent(sel[0]); }
    } else if (e.key === 'Escape') deselect();
    else if (e.key.toLowerCase() === 'h') pressHint();
  }

  function onDockClick(e) {
    const r = e.target.closest('[data-resolve]');
    if (r) { addResolvent(r.dataset.resolve); return; }
    const h = e.target.closest('[data-hintgo]');
    if (h) { if (h.dataset.hintgo === 'do') doHint(); else pressHint(); return; }
    if (e.target.closest('[data-op="remove"]') && sel.length === 1) removeResolvent(sel[0]);
  }

  /* ---------- inne karty, start ---------- */

  /** Zapis zmieniony w innej karcie z tą aplikacją — przejmujemy go (jak w dedukcji naturalnej). */
  function onStorageEvent(e) {
    if (e.key !== KEYS.work || typeof e.newValue !== 'string' || e.newValue === snapshot()) return;
    try { restore(e.newValue); } catch (err) { return; }
    history.clear();
    render();
    if (!active()) return;
    UI.exporter.sync();
    toast('Wczytano zmiany wprowadzone w innej karcie', { important: true });
  }

  /** Odczyt na starcie (zapis i ewentualny link #r=…); komunikaty jak w store.load(). Zwraca wynik linku albo null. */
  function load() {
    const saved = storage.get(KEYS.work);
    if (saved) {
      try { restore(saved); } catch (e) {
        work = null;
        storage.set(KEYS.backup, saved);
        toast('Nie udało się odczytać zapisanego zbioru klauzul — zachowano jego kopię zapasową', { important: true });
      }
    }
    const link = openLink(location.hash);
    history.clear();            // stan sprzed wczytania linku nie jest krokiem do cofnięcia przy starcie
    if (link) toast(link.message, { important: !link.ok });
    return link;
  }

  function init() {
    $('resWs').addEventListener('click', e => {
      if (e.detail > 1) return;
      const act = e.target.closest('[data-act]');
      if (act) {
        ({ new: askSet, reset: clearAll, export: () => UI.exporter.open() })[act.dataset.act]();
        return;
      }
      const ex = e.target.closest('[data-ex]');
      if (ex) { loadExample(+ex.dataset.ex); return; }
      const row = e.target.closest('[data-ci]');
      if (row) toggleSelect(+row.dataset.ci);
      else if (!e.target.closest('.rtree')) deselect();
    });
    $('resWs').addEventListener('keydown', e => {
      const row = e.target.closest && e.target.closest('[data-ci]');
      if (!row || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (!e.repeat) toggleSelect(+row.dataset.ci);
    });
    $('resVars').addEventListener('click', e => {
      const b = e.target.closest('[data-var]');
      if (!b || !work) return;
      if (b.dataset.var === '*') { clearValuation(); return; }
      const v = b.dataset.var, value = b.dataset.value === 'true';
      setValue(v, work.valuation[v] === value ? null : value);
    });
    $('resNew').addEventListener('click', askSet);
    $('resHint').addEventListener('click', pressHint);
    $('resUndo').addEventListener('click', undo);
    $('resRedo').addEventListener('click', redo);
    $('resReset').addEventListener('click', clearAll);
    // menu przykładów
    $('resExList').innerHTML = Examples.RES.GROUPS.map(g => `<div class="grp">${Render.esc(g.title)}</div>`
      + Examples.RES.LIST.map((e, i) => (e.group !== g.id ? ''
        : `<button type="button" data-ex="${i}"><span class="t">${Render.esc(e.title)}<small>${Render.esc(e.note)}</small></span><span class="f">${Render.esc(e.clauses)}</span></button>`)).join('')).join('');
    $('resExList').addEventListener('click', e => {
      const b = e.target.closest('[data-ex]');
      if (b) { $('resExMenu').open = false; loadExample(+b.dataset.ex); }
    });
    // okno nowego zbioru
    const pal = $('resAskPalette');
    pal.innerHTML = PALETTE.map(([label, row]) => `<div class="prow"><span class="plab">${label}</span><div class="pbtns">${row.map(s =>
      `<button type="button" data-ins="${SYMBOLS.indexOf(s)}">${/^[a-z]$/.test(s) ? `<i>${s}</i>` : Render.esc(s.trim())}</button>`).join('')}</div></div>`).join('');
    pal.addEventListener('mousedown', e => e.preventDefault());     // fokus zostaje w polu
    pal.addEventListener('click', e => { const b = e.target.closest('[data-ins]'); if (b) insertSymbol(SYMBOLS[+b.dataset.ins]); });
    const input = $('resAskInput');
    input.maxLength = Res.LIMITS.chars;
    input.addEventListener('input', previewSet);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); acceptSet(); } });
    $('resAskOk').addEventListener('click', acceptSet);
    // opuszczony dział nie zostawia zaznaczenia (jak w dedukcji naturalnej)
    S.on('system', () => { if (!active()) { sel = []; hint = null; } });
  }

  UI.res = Object.freeze({
    init, load, render, undo, redo, onKey, onDockClick, deselect, onStorageEvent, openLink, shareHash, exportSource,
    hasWork: () => !!work,
  });
})(globalThis.ND ||= {});
