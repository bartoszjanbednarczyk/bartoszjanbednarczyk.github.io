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
  const TEX_SYMBOLS = { '∧': '\\land', '∨': '\\lor', '⇒': '\\Rightarrow', '¬': '\\neg', '⊤': '\\top', '⊥': '\\bot', 'σ': '\\sigma' };
  /** Wartościowanie formuł σ̂ (σ z daszkiem) i wartości logiczne T, F — jak w rozdz. 2 skryptu. */
  const SIGMA_HAT = 'σ\u0302';
  const truth = value => (value ? 'T' : 'F');

  const math = f => `<span class="math">${F.html(f)}</span>`;
  const UNKNOWN_LABEL = Object.freeze({ text: '?', html: '?', tex: '?' });
  const label = id => (Rules.get(id) || {}).label || UNKNOWN_LABEL;

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
      if (F.isFormula(s)) out += fmt.formula(s);
      else if (s.rule) out += (spaced ? '' : ' ') + fmt.rule(label(s.rule));
      else if (s.sym) out += fmt.sym(s.sym);
      else if (s.val) out += fmt.val(s.val, s.value);
      else if (s.strong) out += fmt.strong(s.strong);
      else if (s.qed) out += fmt.qed;
      spaced = false;
    }
    return out;
  };

  const segHTML = segRenderer({
    str: esc, formula: math, rule: l => `<span class="rl">(${l.html})</span>`, sym: s => `<span class="math">${esc(s)}</span>`,
    val: (f, v) => `<span class="math">${SIGMA_HAT}(${F.html(f)}) = <span class="tv">${truth(v)}</span></span>`,
    strong: s => `<b>${esc(s)}</b>`, qed: '<span class="qed" aria-label="koniec dowodu">∎</span>',
  });
  const segText = segRenderer({
    str: s => s, formula: F.text, rule: l => `(${l.text})`, sym: s => s,
    val: (f, v) => `${SIGMA_HAT}(${F.text(f)}) = ${truth(v)}`, strong: s => s, qed: '∎',
  });
  const segTeX = segRenderer({
    str: texEsc, formula: f => `$${F.tex(f)}$`, rule: l => `$(${l.tex})$`, sym: s => `$${TEX_SYMBOLS[s] || texEsc(s)}$`,
    val: (f, v) => `$\\hat{\\sigma}(${F.tex(f)}) = \\mathsf{${truth(v)}}$`,
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
   *   interactive — formuły jako przyciski dostępne z klawiatury.
   * Atrybuty: data-id (formuła węzła), data-of (kreska i etykieta reguły węzła), data-box="id:nr" (okno).
   */
  function proofHTML(root, { decorate = () => null, interactive = false } = {}) {
    const formula = n => {
      const d = decorate(n) || {};
      const attrs = (d.cls ? ` class="fm ${d.cls}"` : ' class="fm"') + ` data-id="${n.id}"`
        + (d.title ? ` title="${esc(d.title)}"` : '')
        + (interactive ? ` tabindex="0" role="button" aria-pressed="${d.pressed ? 'true' : 'false'}"` : '');
      return `<span${attrs}>${F.html(n.f)}</span>`;
    };
    const windowHTML = (owner, b, i) => `<div class="box" data-box="${owner.id}:${i}">`
      + `<div class="bhead"><span class="math">${F.html(b.a)}</span><span class="zal">założenie</span></div>${rec(b.body)}</div>`;
    const rec = n => {
      if (Proof.isBareLeaf(n)) return formula(n);
      const prem = n.prem.map((p, i) => (p.box ? windowHTML(n, p, i) : rec(p))).join('');
      return `<div class="inf"><div class="prem">${prem}</div><div class="bar" data-of="${n.id}"></div>`
        + `<div class="lbl" data-of="${n.id}">(${label(n.rule).html})</div><div class="concl">${formula(n)}</div></div>`;
    };
    return rec(root);
  }

  /** Schemat reguły do karty w tabeli (metazmienne α, β, γ; okna z kropkami). */
  function schemaHTML(id) {
    const dots = (top, bottom) => `<div class="box sch"><div class="dots">${top}<span class="v">⋮</span>${bottom}</div></div>`;
    if (id === 'hyp') return dots(`<span class="math"><i>α</i>&nbsp;&nbsp;założenie</span>`, math(F.META('α')));
    const r = Rules.get(id);
    const part = s => (s.assume ? dots(math(s.assume), math(s.goal)) : math(s));
    return `<div class="inf"><div class="prem">${r.schema.prem.map(part).join('')}</div><div class="bar"></div>`
      + `<div class="lbl">(${r.label.html})</div><div class="concl">${math(r.schema.concl)}</div></div>`;
  }

  ND.Render = Object.freeze({
    esc, math, label, segHTML, segText, segTeX, proseHTML, proseText, proseTeX, proofHTML, schemaHTML,
  });
})(globalThis.ND ||= {});
