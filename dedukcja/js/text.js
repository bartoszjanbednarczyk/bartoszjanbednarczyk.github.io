/* =====================================================================
   Tekst z formułami: lista segmentów niezależna od formatu wyjściowego.
     segment: string | formuła | { rule: id } | { sym: '∧' } | { strong: string } | { qed: true }
   Renderery (HTML, zwykły tekst, LaTeX) są w render.js.
   ===================================================================== */
(function (ND) {
  'use strict';

  function append(out, v) {
    if (v === null || v === undefined || v === false || v === '') return;
    if (Array.isArray(v)) v.forEach(x => append(out, x));
    else out.push(v);
  }

  /**
   * Szablon tekstu z formułami: T`Załóżmy, że zachodzi ${f}.` → ['Załóżmy, że zachodzi ', f, '.'].
   * Wstawiać można formuły, napisy, znaczniki i całe listy segmentów.
   */
  function T(strings, ...values) {
    const out = [];
    strings.forEach((s, i) => {
      append(out, s);
      if (i < values.length) append(out, values[i]);
    });
    return out;
  }

  /** Wyliczenie po polsku: „α”, „α oraz β”, „α, β oraz γ”. */
  const list = (parts, last = ' oraz ') => parts.flatMap((p, i) =>
    (i === 0 ? [].concat(p) : [i === parts.length - 1 ? last : ', ', ...[].concat(p)]));

  /** Etykieta reguły (wyświetlana, gdy renderer ma włączone nazwy reguł). */
  const rule = id => ({ rule: id });
  /** Symbol spójnika w tekście (pisany jak w formułach). */
  const sym = s => ({ sym: s });
  const strong = s => ({ strong: s });
  const QED = Object.freeze({ qed: true });

  ND.Seg = Object.freeze({ T, list, rule, sym, strong, QED });
})(globalThis.ND ||= {});
