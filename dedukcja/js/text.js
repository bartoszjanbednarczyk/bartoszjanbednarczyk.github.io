/* =====================================================================
   Tekst z formułami: lista segmentów niezależna od formatu wyjściowego.
     segment: string | formuła | term | { rule: id } | { sym: '∧' } | { val: formuła, value, v? } | { m: { text, html, tex } }
              | { strong: string } | { qed: true }
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
  /**
   * Wartość logiczna formuły przy wartościowaniu σ: val(φ) → „σ̂(φ) = T”, val(φ, false) → „σ̂(φ) = F”.
   * W rachunku kwantyfikatorów (v — nazwa wartościowania, np. 'v1', albo jego zapis jako segment m,
   * np. v_x^a): „𝔄 ⊨ φ[v₁]” albo „𝔄 ⊭ φ[v₁]”.
   */
  const val = (f, value = true, v = null) => (v ? { val: f, value, v } : { val: f, value });
  /** Dowolny zapis matematyczny w trzech postaciach (np. wartościowanie v_x^a). */
  const m = (text, html, tex) => ({ m: { text, html, tex } });
  const strong = s => ({ strong: s });
  const QED = Object.freeze({ qed: true });

  ND.Seg = Object.freeze({ T, list, rule, sym, val, m, strong, QED });
})(globalThis.ND ||= {});
