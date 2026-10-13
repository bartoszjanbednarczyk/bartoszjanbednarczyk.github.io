/* =====================================================================
   Kreator formuł: okno z polem, paletą symboli, podglądem i podpowiedziami.
   ask() zwraca obietnicę formuły albo termu (kind: 'term'; null — anulowano).
   Składnia (rachunek zdań albo kwantyfikatorów) zależy od bieżącego działu.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Render } = ND;
  const UI = (ND.UI ||= {});
  const { $, Modal } = UI.kit;

  const MAX_SUGGESTIONS = 18;

  /** Palety: zmienne/symbole, spójniki i przyciski edycji (act — działanie zamiast wstawienia). */
  const sym = (insert, label = insert, title = insert) => ({ insert, label, title });
  const italic = (insert, label, title) => sym(insert, `<i>${label}</i>${insert.endsWith('(') ? '(' : ''}`, title);
  const EDIT = ['edycja', [
    sym('(', '(', 'nawias otwierający'),
    sym(')', ')', 'nawias zamykający'),
    { act: 'left', label: '←', title: 'kursor w lewo' },
    { act: 'right', label: '→', title: 'kursor w prawo' },
    { act: 'back', label: '⌫', title: 'usuń znak' },
    { act: 'clear', label: 'wyczyść', title: 'wyczyść' },
  ]];
  const TERMS = [
    ['zmienne', [...F.FO.vars.map(v => italic(v, v, `zmienna ${v}`)), sym('₀', '<i>x</i>₀', 'indeks dolny 0 (np. x₀)')]],
    ['stałe i funkcje', [...F.FO.consts.map(c => italic(c, c, `stała ${c}`)), ...F.FO.fns.map(f => italic(f + '(', f, `symbol funkcyjny ${f}`)), sym(', ', ',', 'przecinek między argumentami')]],
  ];
  const PALETTES = {
    prop: [
      ['zmienne', F.VARS.map(v => italic(v, v, v))],
      ['spójniki', ['¬', '∧', '∨', '⇒', '⊤', '⊥'].map(s => sym(s))],
      EDIT,
    ],
    fo: [
      ['relacje', F.FO.rels.map(r => italic(r + '(', r, `symbol relacyjny ${r}`))],
      ...TERMS,
      ['spójniki', ['∀', '∃', '¬', '∧', '∨', '⇒', '⊤', '⊥'].map(s => sym(s))],
      EDIT,
    ],
    term: [...TERMS, EDIT],
  };

  let pending = null;   // { resolve, check, kind }
  let palette = null;   // nazwa narysowanej palety
  const input = () => $('askInput');

  function buildPalette(name) {
    if (palette === name) return;
    palette = name;
    const pal = $('askPalette');
    pal.innerHTML = '';
    PALETTES[name].forEach(([title, buttons]) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.innerHTML = `<span class="plab">${title}</span><div class="pbtns"></div>`;
      const box = row.querySelector('.pbtns');
      buttons.forEach(item => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span>${item.label}</span>`;   // jedna linia: etykieta bywa złożona (np. „p(”, „x₀”)
        b.title = item.title;
        if (item.act) b.className = 'ui';
        b.addEventListener('mousedown', e => e.preventDefault());   // nie zabieraj fokusu polu
        b.addEventListener('click', () => press(item));
        box.appendChild(b);
      });
      pal.appendChild(row);
    });
  }

  /** Działanie przycisku palety na polu tekstowym (z zachowaniem kursora). */
  function press(item) {
    const inp = input(), v = inp.value;
    let a = inp.selectionStart ?? v.length;
    const z = inp.selectionEnd ?? a;
    switch (item.act) {
      case 'clear': inp.value = ''; a = 0; break;
      case 'left': a = Math.max(0, a - 1); break;
      case 'right': a = Math.min(v.length, z + 1); break;
      case 'back':
        if (a !== z) inp.value = v.slice(0, a) + v.slice(z);
        else if (a > 0) {
          const cut = / [∧∨⇒] $/.test(v.slice(0, a)) ? 3 : 1;   // spójnik wstawiony ze spacjami
          inp.value = v.slice(0, a - cut) + v.slice(a);
          a -= cut;
        }
        break;
      default: {
        const text = /[∧∨⇒]/.test(item.insert) ? ` ${item.insert} ` : item.insert;
        if (v.length - (z - a) + text.length > F.LIMITS.chars) return;
        inp.value = v.slice(0, a) + text + v.slice(z);
        a += text.length;
      }
    }
    inp.setSelectionRange(a, a);
    inp.focus();
    preview();
  }

  /** Odświeża podgląd; zwraca formułę albo null, gdy wpis jest niepoprawny. */
  function preview() {
    const v = input().value, out = $('askPreview');
    let f = null, html;
    const term = pending && pending.kind === 'term';
    if (!v.trim()) html = `<span class="muted">Tu pojawi się podgląd ${term ? 'termu' : 'formuły'}.</span>`;
    else {
      try {
        f = term ? F.parseTerm(v) : F.parse(v, { logic: UI.store.logic() });
        const problem = pending && pending.check ? pending.check(f) : null;
        if (problem) { html = `<span class="bad">${Render.esc(problem)}</span>`; f = null; }
        else html = `<span class="ok">✓</span> ${Render.math(f)}`;
      } catch (e) {
        html = `<span class="bad">${Render.esc(e instanceof F.ParseError ? e.message : 'Błąd składni')}</span>`;
      }
    }
    out.innerHTML = html;
    $('askOk').disabled = !f;
    return f;
  }

  function suggestions(best, rest) {
    const seen = new Set(), list = [];
    const add = (f, isBest) => { const k = F.key(f); if (!seen.has(k)) { seen.add(k); list.push([f, isBest]); } };
    best.forEach(f => add(f, true));
    rest.forEach(f => add(f, false));
    const box = $('askSuggest');
    box.innerHTML = '';
    list.slice(0, MAX_SUGGESTIONS).forEach(([f, isBest]) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.innerHTML = F.html(f);
      if (isBest) { c.className = 'best'; c.title = 'pasuje do tej reguły'; }
      c.addEventListener('click', () => { input().value = F.text(f); preview(); input().focus(); });
      box.appendChild(c);
    });
    $('askSuggestWrap').hidden = !list.length;
  }

  /** Rozstrzyga bieżące pytanie (null — anulowano). */
  function settle(value) {
    const p = pending;
    pending = null;
    if (p) p.resolve(value);
  }

  function accept() {
    const f = preview();
    if (!f) return;
    settle(f);                  // najpierw odpowiedź — zamknięcie okna rozstrzyga już tylko „anulowano”
    Modal.close('askModal');
  }

  /**
   * Pyta o formułę. desc — segmenty tekstu; check(f) → komunikat albo null;
   * best — formuły pasujące (wyróżnione), sugg — pozostałe podpowiedzi.
   */
  function ask({ title, desc = [], kind = 'formula', check = null, best = [], sugg = [], okLabel = 'Zatwierdź' }) {
    settle(null);
    buildPalette(kind === 'term' ? 'term' : UI.store.logic());
    input().setAttribute('aria-label', kind === 'term' ? 'Term' : 'Formuła');
    $('askTitle').textContent = title;
    $('askDesc').innerHTML = Render.segHTML(desc);
    $('askOk').textContent = okLabel;
    input().value = '';
    suggestions(best, sugg);
    return new Promise(resolve => {
      pending = { resolve, check, kind };
      Modal.open('askModal', { focus: input() });
      preview();
    });
  }

  function init() {
    const inp = input();
    inp.maxLength = F.LIMITS.chars;
    inp.addEventListener('input', preview);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });
    $('askOk').addEventListener('click', accept);
    Modal.onClose('askModal', () => settle(null));
  }

  UI.ask = Object.freeze({ init, ask });
})(globalThis.ND ||= {});
