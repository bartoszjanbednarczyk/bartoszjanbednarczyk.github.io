/* =====================================================================
   Renderowanie: segmenty tekstu (HTML / tekst / LaTeX), dowód słowny,
   drzewo dowodu i schematy reguł w HTML.
   Wszystko, co trafia do innerHTML, przechodzi przez esc() albo przez
   drukarkę formuł (litery zmiennych z białej listy parsera).
   ===================================================================== */
(function (ND) {
  'use strict';
  const F = ND.F, Proof = ND.Proof, Rules = ND.Rules;

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ESCAPES[c]);

  const TEX_ESCAPES = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '%': '\\%', _: '\\_', '^': '\\^{}', '~': '\\~{}' };
  const texEsc = s => String(s).replace(/[\\{}$&#%_^~]/g, c => TEX_ESCAPES[c]);
  const TEX_SYMBOLS = { '∧': '\\land', '∨': '\\lor', '⇒': '\\Rightarrow', '¬': '\\neg', '⊤': '\\top', '⊥': '\\bot', 'σ': '\\sigma', '∀': '\\forall', '∃': '\\exists' };
  /** Wartościowanie formuł σ̂ (σ z daszkiem) i wartości logiczne T, F — jak w rozdz. 2 skryptu. */
  const SIGMA_HAT = 'σ\u0302';
  const truth = value => (value ? 'T' : 'F');
  /** Rachunek kwantyfikatorów: „𝔄 ⊨ α[v]” (Def. 190 skryptu); formuła złożona w nawiasach, jak w skrypcie. */
  const FRAK = '𝔄';
  const atomic = f => ['v', 'T', 'F', 'meta'].includes(f.t);
  const sat = (fmt, f, v, value) => `${fmt.frak} ${value ? fmt.models : fmt.notModels} ${atomic(f) ? fmt.f(f) : `(${fmt.f(f)})`}[${fmt.name(v)}]`;
  /** Wartościowanie: nazwa (v, v₁, …) albo gotowy zapis — segment m (np. v z indeksami, v_x^a). */
  const valuation = (name, format) => v => (typeof v === 'string' ? name(v) : v.m[format]);
  const SAT_HTML = { frak: FRAK, models: '⊨', notModels: '⊭', f: f => F.html(f), name: valuation(F.htmlName, 'html') };
  const SAT_TEXT = { frak: FRAK, models: '⊨', notModels: '⊭', f: f => F.text(f), name: valuation(F.plainName, 'text') };
  const SAT_TEX = { frak: '\\mathfrak{A}', models: '\\models', notModels: '\\not\\models', f: f => F.tex(f), name: valuation(F.texName, 'tex') };

  const math = f => `<span class="math">${F.html(f)}</span>`;
  const UNKNOWN_LABEL = Object.freeze({ text: '?', html: '?', tex: '?' });
  /** Krok rezolucji rysujemy bez etykiety — jak w skrypcie (str. 43). */
  const NO_LABEL = Object.freeze({ text: '', html: '', tex: '' });
  const label = id => (id === 'res' ? NO_LABEL : (Rules.get(id) || {}).label || UNKNOWN_LABEL);

  /* ---------- segmenty ---------- */

  /**
   * Renderer segmentów dla danego formatu (napis, formuła, etykieta reguły, symbol, wartość σ̂, wyróżnienie, ∎).
   * Etykieta reguły dostaje spację przed sobą, chyba że tekst już się nią kończy.
   */
  const segRenderer = fmt => (segs, { rules = false } = {}) => {
    let out = '', spaced = true;
    for (const s of segs) {
      if (typeof s === 'string') {
        out += fmt.str(s);
        if (s) spaced = /\s$/.test(s);
        continue;
      }
      if (s.rule && !rules) continue;
      if (F.isPrintable(s)) out += fmt.formula(s);
      else if (s.rule) out += (spaced ? '' : ' ') + fmt.rule(label(s.rule));
      else if (s.sym) out += fmt.sym(s.sym);
      else if (s.val) out += fmt.val(s.val, s.value, s.v);
      else if (s.m) out += fmt.m(s.m);
      else if (s.strong) out += fmt.strong(s.strong);
      else if (s.qed) out += fmt.qed;
      spaced = false;
    }
    return out;
  };

  const segHTML = segRenderer({
    str: esc, formula: math, rule: l => `<span class="rl">(${l.html})</span>`, sym: s => `<span class="math">${esc(s)}</span>`,
    val: (f, value, v) => `<span class="math">${v ? sat(SAT_HTML, f, v, value) : `${SIGMA_HAT}(${F.html(f)}) = <span class="tv">${truth(value)}</span>`}</span>`,
    m: x => `<span class="math">${x.html}</span>`,
    strong: s => `<b>${esc(s)}</b>`, qed: '<span class="qed" aria-label="koniec dowodu">∎</span>',
  });
  const segText = segRenderer({
    str: s => s, formula: F.text, rule: l => `(${l.text})`, sym: s => s,
    val: (f, value, v) => (v ? sat(SAT_TEXT, f, v, value) : `${SIGMA_HAT}(${F.text(f)}) = ${truth(value)}`), m: x => x.text, strong: s => s, qed: '∎',
  });
  const segTeX = segRenderer({
    str: texEsc, formula: f => `$${F.tex(f)}$`, rule: l => `$(${l.tex})$`, sym: s => `$${TEX_SYMBOLS[s] || texEsc(s)}$`,
    val: (f, value, v) => `$${v ? sat(SAT_TEX, f, v, value) : `\\hat{\\sigma}(${F.tex(f)}) = \\mathsf{${truth(value)}}`}$`,
    m: x => `$${x.tex}$`,
    strong: s => `\\textbf{${texEsc(s)}}`, qed: '',
  });

  /* ---------- dowód słowny ---------- */

  /**
   * Wspólny obchód akapitów dowodu słownego: kolejne zdania bloku tworzą akapit,
   * zagnieżdżony blok (okno) to wcięcie. Pierwszy akapit zaczyna się od „Dowód.”.
   */
  function walkProse(blocks, { sentence, paragraph, nested, lead }) {
    let pending = lead;
    const take = () => { const l = pending; pending = ''; return l; };
    const rec = (b, depth) => {
      const out = [];
      let para = [];
      const flush = () => { if (para.length) out.push(paragraph(take(), para, depth)); para = []; };
      for (const it of b.items) {
        if (it.items) {
          flush();
          if (pending) out.push(paragraph(take(), [], depth));
          out.push(nested(rec(it, depth + 1), depth));
        } else para.push(sentence(it.segs));
      }
      flush();
      return out;
    };
    return rec(blocks, 0);
  }

  const proseHTML = (p, opts) => walkProse(p.blocks, {
    lead: '<span class="nl-lead">Dowód.</span>',
    sentence: segs => segHTML(segs, opts),
    paragraph: (lead, ss) => `<p>${[lead, ...ss].filter(Boolean).join(' ')}</p>`,
    nested: inner => `<div class="nl-sub">${inner.join('')}</div>`,
  }).join('');

  const proseText = (p, opts) => walkProse(p.blocks, {
    lead: 'Dowód.',
    sentence: segs => segText(segs, opts),
    paragraph: (lead, ss, depth) => '    '.repeat(depth) + [lead, ...ss].filter(Boolean).join(' '),
    nested: inner => inner.join('\n'),
  }).join('\n');

  /**
   * Okna jako wcięte akapity: grupa z powiększonym \leftskip zamiast środowiska quote
   * (LaTeX zagnieżdża najwyżej 6 list — głębszy dowód by się nie skompilował).
   */
  const proseTeX = (p, opts) => '\\begin{proof}\n' + walkProse(p.blocks, {
    lead: '',
    sentence: segs => segTeX(segs, opts),
    paragraph: (lead, ss) => ss.join('\n'),
    nested: inner => `\\begingroup\\advance\\leftskip by 1.5em\n${inner.join('\n\n')}\n\\par\\endgroup`,
  }).join('\n\n') + '\n\\end{proof}';

  /* ---------- drzewo dowodu ---------- */

  /**
   * HTML dowodu w stylu skryptu (okna jako ramki).
   *   decorate(n) → { cls, title, pressed } — wygląd formuły węzła (zaznaczenie, błąd, podpowiedź…),
   *   interactive — formuły jako przyciski dostępne z klawiatury,
   *   facts — { picked: Set } — założenia okien do klikania i wnioski okien (tylko obszar roboczy).
   * Atrybuty: data-id (formuła węzła), data-of (kreska i etykieta reguły węzła), data-box="id:nr" (okno),
   *   data-asm="a:id:nr" (założenie okna), data-fact="f:id:nr:k" (wniosek okna).
   */
  function proofHTML(root, { decorate = () => null, interactive = false, facts = null } = {}) {
    const pickable = (key, cls, title, inner) => {
      const on = facts.picked.has(key);
      return `<span class="${cls}${on ? ' picked' : ''}" data-${key[0] === 'a' ? 'asm' : 'fact'}="${key}" tabindex="0" role="button"`
        + ` aria-pressed="${on}" title="${esc(title)}">${inner}</span>`;
    };
    const assumption = (k, b) => (facts
      ? pickable(`a:${k}`, 'math asm', 'Założenie okna — kliknij, aby wyciągać z niego wnioski', F.html(b.a))
      : `<span class="math">${F.html(b.a)}</span>`);
    const factsHTML = (k, b) => {
      const list = Proof.factsOf(b);
      if (!facts || !list.length) return '';
      return `<div class="bfacts"><span class="wl">wnioski:</span>${list.map((w, j) => pickable(`f:${k}:${j}`, 'fact',
        `Wniosek z reguły (${label(w.rule).text}) — kliknij, aby wyciągać z niego dalsze wnioski`,
        `<span class="math">${F.html(w.f)}</span><span class="frule">(${label(w.rule).html})</span>`)).join('')}</div>`;
    };
    const formula = n => {
      const d = decorate(n) || {};
      const attrs = (d.cls ? ` class="fm ${d.cls}"` : ' class="fm"') + ` data-id="${n.id}"`
        + (d.title ? ` title="${esc(d.title)}"` : '')
        + (interactive ? ` tabindex="0" role="button" aria-pressed="${d.pressed ? 'true' : 'false'}"` : '');
      return `<span${attrs}>${F.html(n.f)}</span>`;
    };
    /** Nagłówek okna: świeża zmienna (reguły (∀i), (∃e)) i założenie — jak w skrypcie: „x₀ świeża zmienna; α założenie”. */
    const headHTML = (k, b) => [
      b.x ? `<span class="math">${F.htmlName(b.x)}</span><span class="zal">świeża zmienna</span>` : '',
      b.x && b.a ? '<span class="zal sep">;</span>' : '',
      b.a ? `${assumption(k, b)}<span class="zal">założenie</span>` : '',
    ].join('');
    const windowHTML = (owner, b, i) => `<div class="box" data-box="${owner.id}:${i}">`
      + `<div class="bhead">${headHTML(`${owner.id}:${i}`, b)}</div>${factsHTML(`${owner.id}:${i}`, b)}${rec(b.body)}</div>`;
    const rec = n => {
      if (Proof.isBareLeaf(n)) return formula(n);
      const prem = n.prem.map((p, i) => (p.box ? windowHTML(n, p, i) : rec(p))).join('');
      const l = label(n.rule).html;
      return `<div class="inf"><div class="prem">${prem}</div><div class="bar" data-of="${n.id}"></div>`
        + (l ? `<div class="lbl" data-of="${n.id}">(${l})</div>` : '') + `<div class="concl">${formula(n)}</div></div>`;
    };
    return rec(root);
  }

  /** Schemat reguły do karty w tabeli (metazmienne α, β, γ; okna z kropkami). */
  function schemaHTML(id) {
    const dots = (top, bottom) => `<div class="box sch"><div class="dots">${top}<span class="v">⋮</span>${bottom}</div></div>`;
    if (id === 'hyp') return dots(`<span class="math"><i>α</i>&nbsp;&nbsp;założenie</span>`, math(F.META('α')));
    const r = Rules.get(id);
    const head = s => [s.fresh ? math(F.VAR(s.fresh)) : '', s.assume ? math(s.assume) : ''].filter(Boolean).join('&nbsp;&nbsp;');
    const part = s => (s.box ? dots(head(s), math(s.goal)) : math(s));
    return `<div class="inf"><div class="prem">${r.schema.prem.map(part).join('')}</div><div class="bar"></div>`
      + `<div class="lbl">(${r.label.html})</div><div class="concl">${math(r.schema.concl)}</div></div>`;
  }

  ND.Render = Object.freeze({
    esc, math, label, segHTML, segText, segTeX, proseHTML, proseText, proseTeX, proofHTML, schemaHTML,
  });
})(globalThis.ND ||= {});
