/* =====================================================================
   Kreator formuł: okno z polem, paletą symboli, podglądem i podpowiedziami.
   ask() zwraca obietnicę formuły (null — anulowano).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Render } = ND;
  const UI = (ND.UI ||= {});
  const { $, Modal } = UI.kit;

  const MAX_SUGGESTIONS = 18;

  /** Paleta: zmienne, spójniki i przyciski edycji (act — działanie zamiast wstawienia). */
  const PALETTE = [
    ['zmienne', F.VARS.map(v => ({ insert: v, label: `<i>${v}</i>`, title: v }))],
    ['spójniki', ['¬', '∧', '∨', '⇒', '⊤', '⊥'].map(s => ({ insert: s, label: s, title: s }))],
    ['edycja', [
      { insert: '(', label: '(', title: 'nawias otwierający' },
      { insert: ')', label: ')', title: 'nawias zamykający' },
      { act: 'left', label: '←', title: 'kursor w lewo' },
      { act: 'right', label: '→', title: 'kursor w prawo' },
      { act: 'back', label: '⌫', title: 'usuń znak' },
      { act: 'clear', label: 'wyczyść', title: 'wyczyść' },
    ]],
  ];

  let pending = null;   // { resolve, check }
  const input = () => $('askInput');

  function buildPalette() {
    const pal = $('askPalette');
    PALETTE.forEach(([title, buttons]) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.innerHTML = `<span class="plab">${title}</span><div class="pbtns"></div>`;
      const box = row.querySelector('.pbtns');
      buttons.forEach(item => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = item.label;
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
    if (!v.trim()) html = '<span class="muted">Tu pojawi się podgląd formuły.</span>';
    else {
      try {
        f = F.parse(v);
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
  function ask({ title, desc = [], check = null, best = [], sugg = [], okLabel = 'Zatwierdź' }) {
    settle(null);
    $('askTitle').textContent = title;
    $('askDesc').innerHTML = Render.segHTML(desc);
    $('askOk').textContent = okLabel;
    input().value = '';
    suggestions(best, sugg);
    return new Promise(resolve => {
      pending = { resolve, check };
      Modal.open('askModal');
      preview();
      setTimeout(() => input().focus(), 30);
    });
  }

  function init() {
    buildPalette();
    const inp = input();
    inp.maxLength = F.LIMITS.chars;
    inp.addEventListener('input', preview);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });
    $('askOk').addEventListener('click', accept);
    Modal.onClose('askModal', () => settle(null));
  }

  UI.ask = Object.freeze({ init, ask });
})(globalThis.ND ||= {});
