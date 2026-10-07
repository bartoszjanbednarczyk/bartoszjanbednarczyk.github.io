/* =====================================================================
   Eksport dowodu: LaTeX (pakiet proof) oraz obrazki SVG/PNG.
   Obrazek powstaje z własnego układu (layout → lista prymitywów), który
   rysują dwa niezależne „backendy”: SVG (tekst) i canvas (PNG).
   Układ jest czysty — pomiar tekstu dostaje z zewnątrz.
   ===================================================================== */
(function (ND) {
  'use strict';
  const F = ND.F, Proof = ND.Proof, Render = ND.Render;

  /* =====================================================================
     LaTeX
     ===================================================================== */

  const TEX_PREAMBLE = String.raw`\usepackage[T1]{fontenc}
\usepackage{proof}
% okno (pudełko) z założeniem, jak w skrypcie; zerowanie przesunięć proof.sty,
% aby kreska pod oknem obejmowała całe okno
\makeatletter
\newcommand{\okno}[2]{\raisebox{\depth}{\fbox{$\begin{array}{@{}c@{}}#1\quad\mbox{założenie}\\[5pt]#2\end{array}$}}%
  \global\@LeftOffset=0pt\global\@RightOffset=0pt}
\makeatother`;

  function texTree(n, depth) {
    const pad = '  '.repeat(depth);
    if (Proof.isBareLeaf(n)) return pad + F.tex(n.f);
    const prem = n.prem.map(p => (p.box
      ? `${pad}  \\okno{${F.tex(p.a)}}{%\n${texTree(p.body, depth + 2)}%\n${pad}  }`
      : texTree(p, depth + 1))).join(`\n${pad}  &\n`);
    return `${pad}\\infer[(${Render.label(n.rule).tex})]{${F.tex(n.f)}}{%\n${prem}${n.prem.length ? '%\n' : ''}${pad}}`;
  }

  /** Kod LaTeX dowodu: pełny dokument standalone albo fragment do wklejenia (z preambułą w komentarzu). */
  function latex(root, { standalone = true } = {}) {
    const open = Proof.openLeaves(root).length;
    const warn = open ? `% UWAGA: dowód niekompletny (otwarte cele: ${open})\n` : '';
    if (!standalone) {
      const pre = TEX_PREAMBLE.split('\n').map(l => '%   ' + l).join('\n');
      return `% w preambule:\n${pre}\n\n${warn}\\[\n${texTree(root, 1)}\n\\]\n`;
    }
    return `\\documentclass[border=10pt]{standalone}\n${TEX_PREAMBLE}\n\\begin{document}\n${warn}$\\displaystyle\n${texTree(root, 1)}\n$\n\\end{document}\n`;
  }

  /* =====================================================================
     Układ obrazka (dwa przejścia: wymiary, potem rozmieszczenie)
     Prymitywy (px, y tekstu = linia bazowa):
       { type: 'text', x, y, runs, size, w, muted } | { type: 'line', x1, y1, x2, y2 } | { type: 'rect', x, y, w, h }
     ===================================================================== */

  /** Domyślne fonty formuł (aplikacja podaje własne z CSS, gdy są dostępne). */
  const MATH_FONT = '"Latin Modern Math", "STIX Two Math", "Cambria Math", "STIX Two Text", "Times New Roman", serif';

  /** Wymiary w em (względem rozmiaru formuł) — jak w aplikacji i w skrypcie. */
  const STYLE = Object.freeze({
    size: 22, lineHeight: 1.3, labelScale: 0.76,
    premGap: 1.3, premPad: 0.2, emptyRow: 0.35,
    barAbove: 0.16, barBelow: 0.1, labelGap: 0.3,
    boxPad: [0.35, 0.7, 0.45], boxGap: 0.45, headGap: 0.8,
    stroke: 0.06, margin: 0.9,
  });

  /**
   * Układ dowodu jako lista prymitywów.
   * measure: { width(runs, sizePx), metrics(sizePx) → { ascent, descent } }.
   */
  function layout(root, measure, style = STYLE) {
    const em = style.size, labelSize = em * style.labelScale;
    const gap = style.premGap * em, pad = style.premPad * em, labelGap = style.labelGap * em;
    const [padTop, padSide, padBottom] = style.boxPad.map(v => v * em);
    const WORD = [{ t: 'założenie', italic: false }];

    /** Linia tekstu: szerokość, wysokość i położenie linii bazowej od góry. */
    const line = (runs, size) => {
      const { ascent, descent } = measure.metrics(size), h = style.lineHeight * size;
      return { runs, size, w: measure.width(runs, size), h, base: (h - ascent - descent) / 2 + ascent };
    };

    /* --- 1. wymiary (zapamiętane dla każdego węzła i okna) --- */
    const dims = new Map();

    function measureTree(n) {
      const concl = line(F.runs(n.f), em);
      let d;
      if (Proof.isBareLeaf(n)) d = { w: concl.w, h: concl.h, concl };
      else {
        const prem = n.prem.map(p => (p.box ? measureBox(p) : measureTree(p)));
        const rowW = prem.length ? prem.reduce((s, b) => s + b.w, 0) + gap * (prem.length - 1) + 2 * pad : 0;
        const rowH = prem.length ? Math.max(...prem.map(b => b.h)) : style.emptyRow * em;
        const colW = Math.max(rowW, concl.w);
        const label = line([{ t: `(${Render.label(n.rule).text})`, italic: false }], labelSize);
        const barY = rowH + style.barAbove * em, conclY = barY + style.barBelow * em;
        d = { w: colW + labelGap + label.w, h: conclY + concl.h, concl, prem, rowW, rowH, colW, label, barY, conclY };
      }
      dims.set(n, d);
      return d;
    }

    function measureBox(b) {
      const head = line(F.runs(b.a), em), word = line(WORD, em);
      const headW = head.w + style.headGap * em + word.w;
      const body = measureTree(b.body);
      const inner = Math.max(headW, body.w);
      const d = { w: inner + 2 * padSide, h: padTop + head.h + style.boxGap * em + body.h + padBottom, head, word, headW, inner, body };
      dims.set(b, d);
      return d;
    }

    /* --- 2. rozmieszczenie --- */
    const items = [];
    const text = (l, x, top, muted = false) => items.push({ type: 'text', x, y: top + l.base, runs: l.runs, size: l.size, w: l.w, muted });

    function placeTree(n, x, y) {
      const d = dims.get(n);
      if (!d.prem) { text(d.concl, x, y); return; }
      let px = x + (d.colW - d.rowW) / 2 + pad;
      n.prem.forEach((p, i) => {
        (p.box ? placeBox : placeTree)(p, px, y + d.rowH - d.prem[i].h);
        px += d.prem[i].w + gap;
      });
      items.push({ type: 'line', x1: x, y1: y + d.barY, x2: x + d.colW, y2: y + d.barY });
      text(d.label, x + d.colW + labelGap, y + d.barY - d.label.h / 2);
      text(d.concl, x + (d.colW - d.concl.w) / 2, y + d.conclY);
    }

    function placeBox(b, x, y) {
      const d = dims.get(b);
      const hx = x + padSide + (d.inner - d.headW) / 2;
      items.push({ type: 'rect', x, y, w: d.w, h: d.h });
      text(d.head, hx, y + padTop);
      text(d.word, hx + d.head.w + style.headGap * em, y + padTop, true);
      placeTree(b.body, x + padSide + (d.inner - d.body.w) / 2, y + padTop + d.head.h + style.boxGap * em);
    }

    const size = measureTree(root), margin = style.margin * em;
    placeTree(root, margin, margin);
    return { w: size.w + 2 * margin, h: size.h + 2 * margin, stroke: style.stroke * em, items };
  }

  /* =====================================================================
     Rysowanie: SVG i canvas
     ===================================================================== */

  const THEMES = Object.freeze({
    light: Object.freeze({ bg: '#ffffff', ink: '#1a1c1e', muted: '#4a4f55' }),
    dark: Object.freeze({ bg: '#111214', ink: '#f2f2ef', muted: '#c4c7ca' }),
  });

  const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const xml = s => String(s).replace(/[&<>"]/g, c => XML_ESCAPES[c]);
  const num = v => String(Math.round(v * 100) / 100);

  /** SVG jako tekst. colors: { bg (null = przezroczyste), ink, muted }. */
  function toSVG(L, colors, font = MATH_FONT) {
    const W = Math.ceil(L.w), H = Math.ceil(L.h);
    const texts = [], shapes = [];
    for (const it of L.items) {
      if (it.type === 'line') shapes.push(`<line x1="${num(it.x1)}" y1="${num(it.y1)}" x2="${num(it.x2)}" y2="${num(it.y2)}"/>`);
      else if (it.type === 'rect') shapes.push(`<rect x="${num(it.x)}" y="${num(it.y)}" width="${num(it.w)}" height="${num(it.h)}"/>`);
      else {
        const runs = it.runs.map(r => (r.italic ? `<tspan font-style="italic">${xml(r.t)}</tspan>` : xml(r.t))).join('');
        texts.push(`<text x="${num(it.x)}" y="${num(it.y)}" font-size="${num(it.size)}" textLength="${num(it.w)}" lengthAdjust="spacingAndGlyphs"`
          + `${it.muted ? ` fill="${colors.muted}"` : ''}>${runs}</text>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`
      + `<style>text{font-family:${xml(font.replace(/"/g, "'"))};white-space:pre}</style>\n`
      + (colors.bg ? `<rect width="100%" height="100%" fill="${colors.bg}"/>\n` : '')
      + `<g fill="none" stroke="${colors.ink}" stroke-width="${num(L.stroke)}">\n${shapes.join('\n')}\n</g>\n`
      + `<g fill="${colors.ink}">\n${texts.join('\n')}\n</g>\n</svg>\n`;
  }

  /** Największa skala PNG mieszcząca się w limitach płótna przeglądarek (także iOS). */
  const CANVAS_LIMITS = Object.freeze({ side: 16000, area: 16e6 });
  function fitScale(L, wanted) {
    const bySide = CANVAS_LIMITS.side / Math.max(L.w, L.h);
    const byArea = Math.sqrt(CANVAS_LIMITS.area / (L.w * L.h));
    return Math.min(wanted, bySide, byArea);
  }

  const canvasFont = (font, italic, size) => `${italic ? 'italic ' : ''}${size}px ${font}`;

  /** Pomiar tekstu przez canvas (te same fonty, które narysują PNG i — zwykle — SVG). */
  function canvasMeasurer({ font = MATH_FONT, doc = globalThis.document } = {}) {
    const g = doc.createElement('canvas').getContext('2d');
    if (!g) throw new Error('Brak obsługi płótna (canvas)');
    const metrics = new Map();
    return {
      width(runs, size) {
        return runs.reduce((w, r) => { g.font = canvasFont(font, r.italic, size); return w + g.measureText(r.t).width; }, 0);
      },
      metrics(size) {
        if (!metrics.has(size)) {
          g.font = canvasFont(font, false, size);
          const m = g.measureText('Hxgjp(⇒∧)');
          metrics.set(size, {
            ascent: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 0.8 * size,
            descent: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || 0.25 * size,
          });
        }
        return metrics.get(size);
      },
    };
  }

  /** Pomiar przybliżony (średnia szerokość znaku) — gdy płótno jest niedostępne, oraz w testach. */
  const approxMeasurer = () => Object.freeze({
    width: (runs, size) => runs.reduce((w, r) => w + [...r.t].length * 0.55 * size, 0),
    metrics: size => ({ ascent: 0.8 * size, descent: 0.25 * size }),
  });

  /** Rysuje układ na nowym płótnie w danej skali. */
  function toCanvas(L, colors, scale, { font = MATH_FONT, doc = globalThis.document } = {}) {
    const c = doc.createElement('canvas');
    c.width = Math.ceil(L.w * scale);
    c.height = Math.ceil(L.h * scale);
    const g = c.getContext('2d');
    if (!g) throw new Error('Brak obsługi płótna (canvas)');
    g.scale(scale, scale);
    if (colors.bg) { g.fillStyle = colors.bg; g.fillRect(0, 0, L.w, L.h); }
    g.strokeStyle = colors.ink;
    g.lineWidth = L.stroke;
    g.textBaseline = 'alphabetic';
    for (const it of L.items) {
      if (it.type === 'line') { g.beginPath(); g.moveTo(it.x1, it.y1); g.lineTo(it.x2, it.y2); g.stroke(); }
      else if (it.type === 'rect') g.strokeRect(it.x, it.y, it.w, it.h);
      else {
        g.fillStyle = it.muted ? colors.muted : colors.ink;
        let x = it.x;
        for (const r of it.runs) {
          g.font = canvasFont(font, r.italic, it.size);
          g.fillText(r.t, x, it.y);
          x += g.measureText(r.t).width;
        }
      }
    }
    return c;
  }

  ND.Export = Object.freeze({
    latex, TEX_PREAMBLE, MATH_FONT, STYLE, THEMES, layout, toSVG, toCanvas, canvasMeasurer, approxMeasurer, fitScale,
  });
})(globalThis.ND ||= {});
