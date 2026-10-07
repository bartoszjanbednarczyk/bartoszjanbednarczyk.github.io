/* =====================================================================
   Przykłady: rozdział 2.9 skryptu, zadanie 41, kolokwia i egzaminy
   oraz gotowe dowody ze skryptu (do oglądania i odtwarzania).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { V, NOT, AND, OR, IMP, BOT } = ND.F;
  const { node, box } = ND.Proof;

  const GROUPS = Object.freeze([
    { id: 's29', title: 'Rozdział 2.9' },
    { id: 'z41', title: 'Zadanie 41 — tautologie' },
    { id: 'kol', title: 'Kolokwia (sprawdzian nr 1)' },
    { id: 'egz', title: 'Egzaminy' },
    { id: 'demo', title: 'Gotowe dowody ze skryptu' },
  ]);

  /** Przykład 48 ze skryptu: ¬(p ∨ q) ⇒ ¬p ∧ ¬q. */
  function demo48() {
    const p = V('p'), q = V('q'), pq = OR(p, q), h = NOT(pq);
    const side = (x, rule) => node(NOT(x), 'notI', [box(x, node(BOT, 'notE', [node(pq, rule, [node(x, 'hyp')]), node(h, 'hyp')]))]);
    return node(IMP(h, AND(NOT(p), NOT(q))), 'impI', [box(h, node(AND(NOT(p), NOT(q)), 'andI', [side(p, 'orI1'), side(q, 'orI2')]))]);
  }

  /** Przykład 49 ze skryptu: p ∨ ¬p (schemat dowodu prawa wyłączonego środka). */
  function demo49() {
    const p = V('p'), lem = OR(p, NOT(p)), h = NOT(lem);
    const notP = node(NOT(p), 'notI', [box(p, node(BOT, 'notE', [node(lem, 'orI1', [node(p, 'hyp')]), node(h, 'hyp')]))]);
    return node(lem, 'nnE', [node(NOT(h), 'notI', [box(h, node(BOT, 'notE', [node(lem, 'orI2', [notP]), node(h, 'hyp')]))])]);
  }

  /** proof — funkcja budująca gotowy dowód (tylko w grupie „demo”). */
  const LIST = Object.freeze([
    { group: 's29', title: 'Przykład 48', formula: '~(p|q) -> ~p & ~q', note: 'prawo De Morgana' },
    { group: 's29', title: 'Przykład 49', formula: 'p | ~p', note: 'prawo wyłączonego środka' },
    { group: 's29', title: 'Zadanie 141', formula: '~(p&q) -> ~p | ~q', note: 'wymaga (¬¬e)' },
    { group: 's29', title: 'Zadanie 143', formula: '((p->q)->p)->p', note: 'prawo Peirce’a' },
    { group: 's29', title: 'Zadanie 144', formula: '(~q -> ~p) -> (p -> q)', note: 'kontrapozycja' },
    { group: 's29', title: 'Zadanie 145', formula: '(p->q) & (q->r) & ~r & (p|s) & (s->t) -> t', note: 'okulary pana Hilarego' },
    { group: 's29', title: 'Zadanie 146 (1)', formula: 'p | (q & r) -> (p | q) & (p | r)', note: 'rozdzielność · też kol. 2023' },
    { group: 's29', title: 'Zadanie 146 (2)', formula: '(p | q) & (p | r) -> p | (q & r)', note: 'rozdzielność' },
    { group: 's29', title: 'Str. 52', formula: 'p -> (p -> q) -> q', note: 'przykład w notacji sekwentowej' },

    { group: 'z41', title: '41.1', formula: '(p -> q) & p -> q', note: 'modus ponens' },
    { group: 'z41', title: '41.2', formula: '(p -> q) & ~q -> ~p', note: 'modus tollens' },
    { group: 'z41', title: '41.3', formula: '(p | q -> r) -> p -> r', note: 'prawo kompozycji · też egz. połówkowy 2011 i poprawka 2013' },
    { group: 'z41', title: '41.4', formula: '(p | q -> r) -> q -> r', note: 'prawo kompozycji' },
    { group: 'z41', title: '41.5', formula: 'p & q -> p', note: 'prawo symplifikacji' },
    { group: 'z41', title: '41.6', formula: 'q -> p | q', note: 'prawo symplifikacji' },
    { group: 'z41', title: '41.7', formula: 'p -> q -> p', note: 'prawo symplifikacji' },
    { group: 'z41', title: '41.8', formula: '~p -> p -> q', note: 'prawo Dunsa Szkota' },
    { group: 'z41', title: '41.9', formula: '(p -> r) & (q -> r) & (p | q) -> r', note: 'prawo dylematu konstrukcyjnego' },
    { group: 'z41', title: '41.10', formula: '(p & q -> r) -> p -> q -> r', note: 'prawo eksportacji · też kol. 2012 i 2022' },
    { group: 'z41', title: '41.11', formula: '(p -> q -> r) -> p & q -> r', note: 'prawo importacji · też kol. 2022' },
    { group: 'z41', title: '41.12', formula: '(p -> ~p) -> ~p', note: 'prawo redukcji do absurdu' },
    { group: 'z41', title: '41.13', formula: '~(p & ~p)', note: 'prawo sprzeczności' },
    { group: 'z41', title: '41.14', formula: 'p | ~p', note: 'prawo wyłączonego środka' },
    { group: 'z41', title: '41.15', formula: '(p -> q) -> (q -> r) -> p -> r', note: 'prawo sylogizmu hipotetycznego' },
    { group: 'z41', title: '41.16', formula: '((p -> q) -> p) -> p', note: 'prawo Peirce’a' },
    { group: 'z41', title: '41.17', formula: '(~p -> p) -> p', note: 'prawo Claviusa' },
    { group: 'z41', title: '41.18', formula: '(p -> p) & (p -> p)', note: 'prawo tożsamości: p ⇔ p jako skrót' },

    { group: 'kol', title: 'Kolokwium 1, 2011 (A)', formula: '(p -> q) -> (~q -> ~p)', note: 'zad. 2 · kontrapozycja' },
    { group: 'kol', title: 'Kolokwium 1, 2011 (C)', formula: '(~p -> F) -> p', note: 'zad. 2 · reguła dowodu nie wprost' },
    { group: 'kol', title: 'Kolokwium 1, 2013 (A)', formula: 'p & ~q -> ~(p -> q)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2013 (D)', formula: '(p -> q & r) -> (p -> q) & (p -> r)', note: 'zad. 3 · też egzamin 2014, zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2014 (A)', formula: '(p -> r) & (q -> r) -> (p | q -> r)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2014 (C)', formula: '(p -> q) & (p -> r) -> (p -> q & r)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2016 (A)', formula: '~p & ~q -> ~(p | q)', note: 'zad. 5 · prawo De Morgana' },
    { group: 'kol', title: 'Kolokwium 1, 2016 (D)', formula: '~p | ~q -> ~(p & q)', note: 'zad. 4 · prawo De Morgana' },
    { group: 'kol', title: 'Kolokwium 1, 2023 (D)', formula: 'p & (q | r) -> (p & q) | (p & r)', note: 'zad. 2 · rozdzielność' },
    { group: 'kol', title: 'Kolokwium 1, 2024 (A)', formula: '((p -> q) | r) & ~r -> (p -> q)', note: 'zad. 2' },
    { group: 'kol', title: 'Kolokwium 1, 2024 (D)', formula: '((p -> q) -> (q -> p)) -> (q -> p)', note: 'zad. 1' },

    { group: 'egz', title: 'Poprawka 2015', formula: '(p -> q) | (p -> r) -> (p -> q | r)', note: 'zad. 3' },
    { group: 'egz', title: 'Egzamin 2016', formula: '(a & b) | (~a & ~b) -> (a -> b)', note: 'zad. 6 · też poprawka 2023, zad. 5' },
    { group: 'egz', title: 'Poprawka 2016', formula: '(p -> q) & (p -> r) -> (p -> q | r)', note: 'zad. 3' },
    { group: 'egz', title: 'Egzamin 2017', formula: '~a & (b -> a) -> ~b', note: 'zad. 6 · modus tollens' },
    { group: 'egz', title: 'Poprawka 2017', formula: '(p -> q) & (q -> r) -> (p | q -> r)', note: 'zad. 3' },
    { group: 'egz', title: 'Egzamin 2018', formula: 'p -> (q & r) | p', note: 'zad. 6' },
    { group: 'egz', title: 'Poprawka 2018', formula: 'p & q -> (~p -> q)', note: 'zad. 5' },
    { group: 'egz', title: 'Egzamin 2020', formula: '(p -> ~q) -> (q -> ~p)', note: 'zad. 6' },
    { group: 'egz', title: 'Poprawka 2022', formula: 'p & (q -> r) -> (p & q -> p & r)', note: 'zad. 3' },
    { group: 'egz', title: 'Egzamin 2023', formula: '(a -> b) & (b -> a) -> (a & b) | (~a & ~b)', note: 'zad. 3 · wskazówka: a ∨ ¬a' },

    { group: 'demo', title: 'Przykład 48', formula: '~(p|q) -> ~p & ~q', note: 'gotowy dowód', proof: demo48 },
    { group: 'demo', title: 'Przykład 49', formula: 'p | ~p', note: 'gotowy dowód', proof: demo49 },
  ].map(Object.freeze));

  ND.Examples = Object.freeze({ GROUPS, LIST });
})(globalThis.ND ||= {});
