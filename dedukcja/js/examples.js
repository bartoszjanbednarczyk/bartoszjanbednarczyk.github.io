/* =====================================================================
   Przykłady dla trzech działów: dedukcja naturalna w rachunku zdań i w rachunku kwantyfikatorów
   oraz zbiory klauzul do rezolucji. Każdy dział ma { GROUPS, LIST, isSample }.
   Podpowiedzi działają tylko w zadaniach przykładowych (pierwsza grupa każdego działu, isSample):
   to kilka zadań z kolokwiów i egzaminów, do których opublikowano rozwiązania (wybrane_rozwiazania).
   Pozostałe zadania z kolokwiów i egzaminów oraz zadania ze skryptu rozwiązuje się samodzielnie.
   Zadanie identyczne z zadaniem przykładowym występuje w menu raz — przy zadaniu przykładowym
   (np. „też przykład 57 ze skryptu”), bo podpowiedzi zależą od formuły, a nie od pozycji w menu.
   Wymaga modułów formula.js i proof.js (resolution.js — dopiero przy sprawdzaniu zbiorów klauzul,
   więc testy bez rezolucji mogą wczytać ten moduł).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { V, NOT, AND, OR, IMP, BOT } = ND.F;
  const { node, box } = ND.Proof;

  /* =====================================================================
     Rachunek zdań (rozdz. 2.9)
     ===================================================================== */

  const GROUPS = Object.freeze([
    { id: 'przyk', title: 'Przykładowe zadania — z podpowiedziami' },
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

  /**
   * proof — funkcja budująca gotowy dowód (tylko w grupie „demo”).
   * Grupa „przyk” (od najłatwiejszego): wszystkie zadania z dedukcji naturalnej w rachunku zdań,
   * których rozwiązania opublikowano — tylko w nich działają podpowiedzi.
   */
  const LIST = Object.freeze([
    { group: 'przyk', title: 'Kolokwium 1, 2024 (A)', formula: '((p -> q) | r) & ~r -> (p -> q)', note: 'zad. 2' },
    { group: 'przyk', title: 'Kolokwium 1, 2023 (D)', formula: 'p & (q | r) -> (p & q) | (p & r)', note: 'zad. 2 · rozdzielność' },
    { group: 'przyk', title: 'Kolokwium 1, 2023 (A)', formula: 'p | (q & r) -> (p | q) & (p | r)', note: 'zad. 4 · rozdzielność · też zadanie 146 (1) ze skryptu' },
    { group: 'przyk', title: 'Kolokwium 1, 2024 (D)', formula: '((p -> q) -> (q -> p)) -> (q -> p)', note: 'zad. 1' },
    { group: 'przyk', title: 'Kolokwium 1, 2011 (C)', formula: '(~p -> F) -> p', note: 'zad. 2 · reguła dowodu nie wprost' },

    { group: 's29', title: 'Przykład 48', formula: '~(p|q) -> ~p & ~q', note: 'prawo De Morgana' },
    { group: 's29', title: 'Przykład 49', formula: 'p | ~p', note: 'prawo wyłączonego środka' },
    { group: 's29', title: 'Zadanie 141', formula: '~(p&q) -> ~p | ~q', note: 'wymaga (¬¬e)' },
    { group: 's29', title: 'Zadanie 143', formula: '((p->q)->p)->p', note: 'prawo Peirce’a' },
    { group: 's29', title: 'Zadanie 144', formula: '(~q -> ~p) -> (p -> q)', note: 'kontrapozycja' },
    { group: 's29', title: 'Zadanie 145', formula: '(p->q) & (q->r) & ~r & (p|s) & (s->t) -> t', note: 'okulary pana Hilarego' },
    { group: 's29', title: 'Zadanie 146 (2)', formula: '(p | q) & (p | r) -> p | (q & r)', note: 'rozdzielność · zadanie 146 (1) — wśród przykładowych' },
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
    { group: 'kol', title: 'Kolokwium 1, 2013 (A)', formula: 'p & ~q -> ~(p -> q)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2013 (D)', formula: '(p -> q & r) -> (p -> q) & (p -> r)', note: 'zad. 3 · też egzamin 2014, zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2014 (A)', formula: '(p -> r) & (q -> r) -> (p | q -> r)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2014 (C)', formula: '(p -> q) & (p -> r) -> (p -> q & r)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2016 (A)', formula: '~p & ~q -> ~(p | q)', note: 'zad. 5 · prawo De Morgana' },
    { group: 'kol', title: 'Kolokwium 1, 2016 (D)', formula: '~p | ~q -> ~(p & q)', note: 'zad. 4 · prawo De Morgana' },

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

  /** Formuły zadań przykładowych — tylko dla nich działają podpowiedzi. */
  const SAMPLES = Object.freeze(LIST.filter(e => e.group === 'przyk').map(e => ND.F.parse(e.formula)));

  /** Czy formuła (korzeń dowodu) jest zadaniem przykładowym. */
  const isSample = f => SAMPLES.some(g => ND.F.eq(f, g));

  /* =====================================================================
     Rachunek kwantyfikatorów (rozdz. 3.3): zadania z kolokwiów i egzaminów oraz przykłady i zadania
     ze skryptu — same prawa rachunku kwantyfikatorów. Schematy φ, ψ zapisujemy jako symbole relacyjne:
     φ(x), ψ(x) — formuły, w których x może występować wolno, φ — formuła bez wolnego x.
     Na kolokwiach i egzaminach zasięg kwantyfikatora sięga do nawiasu zamykającego
     („(∀x p(x) ⇒ q(x))” to ∀x (p(x) ⇒ q(x))) — tu zapisujemy to nawiasami (składnia aplikacji).
     ===================================================================== */

  const FO_GROUPS = Object.freeze([
    { id: 'qprzyk', title: 'Przykładowe zadania — z podpowiedziami' },
    { id: 'qkol', title: 'Kolokwia (sprawdzian nr 2)' },
    { id: 'qegz', title: 'Egzaminy' },
    { id: 'q33', title: 'Rozdział 3.3 — przykłady' },
    { id: 'q149', title: 'Zadania 149–169' },
    { id: 'q170', title: 'Zadania 170–179 (x nie występuje wolno w φ)' },
    { id: 'q53', title: 'Prawa z przykładów 53–55' },
    { id: 'qterm', title: 'Z termami i stałymi' },
  ]);

  const FO_LIST = Object.freeze([
    { group: 'qprzyk', title: 'Kolokwium 2, 2011 (C)', formula: '(Ex (φ(x) & ψ(x))) -> Ex φ(x)', note: 'zad. 2' },
    { group: 'qprzyk', title: 'Kolokwium 2, 2011 (A)', formula: '(Ex φ(x)) -> Ex (φ(x) | ψ(x))', note: 'zad. 2' },
    { group: 'qprzyk', title: 'Poprawka 2019', formula: '(Ex p(x)) -> ~Ax ~p(x)', note: 'zad. 8 · też przykład 57 ze skryptu' },
    { group: 'qprzyk', title: 'Kolokwium 2, 2023 (A)', formula: '(Ex f(x) = y) -> ~Az ~(f(z) = y)', note: 'zad. 4 · relacja =' },
    { group: 'qprzyk', title: 'Kolokwium 2, 2023 (D)', formula: '(Ax ~(f(x) = y)) -> ~Ez f(z) = y', note: 'zad. 2 · relacja =' },
    { group: 'qprzyk', title: 'Kolokwium 2, 2022 (A)', formula: '(Ax (φ(x) & ψ(x))) -> (Ex φ(x)) | (Ex ψ(x))', note: 'zad. 1 · luki uzupełnione jak w rozwiązaniu' },
    { group: 'qprzyk', title: 'Kolokwium 2, 2022 (D)', formula: '(Ax (φ(x) | ψ(x))) -> (Ex φ(x)) | (Ex ψ(x))', note: 'zad. 4 · luki uzupełnione jak w rozwiązaniu' },
    { group: 'qprzyk', title: 'Egzamin 2025', formula: '(Ax (f(x) > 0 -> g(x) > 0)) -> (Ey f(y) > 0) -> Ez g(z) > 0', note: 'zad. 6 · relacja > i stała 0' },

    { group: 'qkol', title: 'Kolokwium 2, 2017 (A)', formula: '(Ex (p(x) -> q(x))) -> (Ax p(x)) -> Ex q(x)', note: 'zad. 1' },
    { group: 'qkol', title: 'Kolokwium 2, 2017 (D)', formula: '(Ex p(x)) -> (Ax (p(x) -> q(x))) -> Ex q(x)', note: 'zad. 3 · na kartce (∀x p(x) ⇒ q(x)) — zasięg ∀x do nawiasu' },
    { group: 'qkol', title: 'Kolokwium 2, 2018 (A)', formula: '(Ax (p(x) -> ~q(x))) -> Ax (q(x) -> ~p(x))', note: 'zad. 4' },
    { group: 'qkol', title: 'Kolokwium 2, 2018 (D)', formula: '(Ax (~p(x) -> q(x))) -> Ax (~q(x) -> p(x))', note: 'zad. 5 · wymaga (¬¬e)' },
    { group: 'qkol', title: 'Kolokwium 2, 2019 (A)', formula: '(Ax (p(x) -> q)) -> (Ex p(x)) -> q', note: 'zad. 1 · q — symbol bez argumentów' },
    { group: 'qkol', title: 'Kolokwium 2, 2019 (D)', formula: '((Ex p(x)) -> q) -> Ax (p(x) -> q)', note: 'zad. 3 · q — symbol bez argumentów' },

    { group: 'qegz', title: 'Egzamin 2013', formula: '(Ax (φ(x) & ψ(x))) -> Ax ψ(x)', note: 'zad. 8 · na kartce (∀x φ ∧ ψ) ⇒ (∀x ψ) — zasięg ∀x do nawiasu' },
    { group: 'qegz', title: 'Poprawka 2014', formula: '(Ax (p(x) -> q(x))) -> (Ax p(x)) -> Ex q(x)', note: 'zad. 5' },
    { group: 'qegz', title: 'Egzamin 2015', formula: '(Ax (φ(x) & ψ(x))) -> Ax φ(x)', note: 'zad. 7 · na kartce (∀x φ(x) ∧ ψ(x)) ⇒ ∀x φ(x)' },
    { group: 'qegz', title: 'Egzamin 2022', formula: '(Ax Ay p(x, y)) -> Ax Ey p(x, y)', note: 'zad. 9' },
    { group: 'qegz', title: 'Poprawka 2025', formula: '(Ex (R(x, x) -> S(x))) -> (Ay R(y, y)) -> Ez S(z)', note: 'zad. 5 · symbole relacyjne R, S' },

    { group: 'q33', title: 'Przykład 56', formula: 'Ax (φ(x) & ψ(x)) -> (Ax φ(x)) & (Ax ψ(x))', note: 'też zadanie 154' },
    { group: 'q33', title: 'Prawo De Morgana', formula: '~(Ex φ(x)) -> Ax ~φ(x)', note: 'schemat dowodu ze str. 58' },

    { group: 'q149', title: 'Zadanie 149', formula: '(Ax ~φ(x)) -> ~Ex φ(x)', note: 'druga implikacja prawa De Morgana' },
    { group: 'q149', title: 'Zadanie 150', formula: '(Ex ~φ(x)) -> ~Ax φ(x)', note: 'prawo De Morgana' },
    { group: 'q149', title: 'Zadanie 151', formula: '~(Ax φ(x)) -> Ex ~φ(x)', note: 'wymaga (¬¬e)' },
    { group: 'q149', title: 'Zadanie 153', formula: '(Ax φ(x)) | (Ax ψ(x)) -> Ax (φ(x) | ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 157', formula: '((Ex φ(x)) -> Ax ψ(x)) -> Ax (φ(x) -> ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 159', formula: '(Ex (φ(x) & ψ(x))) -> (Ex φ(x)) & (Ex ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 160', formula: '((Ex φ(x)) -> Ex ψ(x)) -> Ex (φ(x) -> ψ(x))', note: 'prawo · wymaga (¬¬e)' },
    { group: 'q149', title: 'Zadanie 162', formula: '(Ax φ(x)) -> (Ex ψ(x)) -> Ex (φ(x) -> ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 163', formula: '(Ex (φ(x) -> ψ(x))) -> (Ax φ(x)) -> Ex ψ(x)', note: 'prawo · też poprawka 2024, zad. 5' },
    { group: 'q149', title: 'Zadanie 166', formula: '(Ax φ(x)) -> Ex φ(x)', note: 'uniwersum jest niepuste' },
    { group: 'q149', title: 'Zadanie 169', formula: '(Ey Ax φ(x, y)) -> Ax Ey φ(x, y)', note: 'prawo; implikacja odwrotna (zad. 168) nie jest prawem' },

    { group: 'q170', title: 'Zadanie 170 (⇒)', formula: '(Ax (φ -> ψ(x))) -> (φ -> Ax ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 170 (⇐)', formula: '(φ -> Ax ψ(x)) -> Ax (φ -> ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 171', formula: '(Ax (φ -> ψ(x))) -> (φ -> Ex ψ(x))', note: 'tylko w tę stronę' },
    { group: 'q170', title: 'Zadanie 172', formula: '(Ax (ψ(x) -> φ)) -> ((Ax ψ(x)) -> φ)', note: 'tylko w tę stronę' },
    { group: 'q170', title: 'Zadanie 173 (⇒)', formula: '(Ax (ψ(x) -> φ)) -> ((Ex ψ(x)) -> φ)', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 173 (⇐)', formula: '((Ex ψ(x)) -> φ) -> Ax (ψ(x) -> φ)', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 176 (⇒)', formula: '(Ex (φ -> ψ(x))) -> (φ -> Ex ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 176 (⇐)', formula: '(φ -> Ex ψ(x)) -> Ex (φ -> ψ(x))', note: 'formuły są równoważne · wymaga (¬¬e)' },
    { group: 'q170', title: 'Zadanie 177', formula: '(φ -> Ax ψ(x)) -> Ex (φ -> ψ(x))', note: 'tylko w tę stronę' },
    { group: 'q170', title: 'Zadanie 178', formula: '((Ex ψ(x)) -> φ) -> Ex (ψ(x) -> φ)', note: 'tylko w tę stronę' },
    { group: 'q170', title: 'Zadanie 179 (⇒)', formula: '(Ex (ψ(x) -> φ)) -> ((Ax ψ(x)) -> φ)', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 179 (⇐)', formula: '((Ax ψ(x)) -> φ) -> Ex (ψ(x) -> φ)', note: 'formuły są równoważne · wymaga (¬¬e)' },

    { group: 'q53', title: 'Przykład 54 (∀, ⇐)', formula: '(Ax φ(x)) & (Ax ψ(x)) -> Ax (φ(x) & ψ(x))', note: 'rozdzielność ∀ względem ∧' },
    { group: 'q53', title: 'Przykład 54 (∃, ⇒)', formula: '(Ex (φ(x) | ψ(x))) -> (Ex φ(x)) | (Ex ψ(x))', note: 'rozdzielność ∃ względem ∨' },
    { group: 'q53', title: 'Przykład 54 (∃, ⇐)', formula: '(Ex φ(x)) | (Ex ψ(x)) -> Ex (φ(x) | ψ(x))', note: 'rozdzielność ∃ względem ∨' },
    { group: 'q53', title: 'Przykład 55 (∀, ∨)', formula: '(Ax (φ | ψ(x))) -> φ | Ax ψ(x)', note: 'wymaga (¬¬e)' },
    { group: 'q53', title: 'Przykład 55 (∀, ∨, ⇐)', formula: 'φ | (Ax ψ(x)) -> Ax (φ | ψ(x))', note: 'wyłączanie φ spod kwantyfikatora' },
    { group: 'q53', title: 'Przykład 55 (∀, ∧)', formula: '(Ax (φ & ψ(x))) -> φ & Ax ψ(x)', note: 'wyłączanie φ spod kwantyfikatora' },
    { group: 'q53', title: 'Przykład 55 (∃, ∧)', formula: '(Ex (φ & ψ(x))) -> φ & Ex ψ(x)', note: 'wyłączanie φ spod kwantyfikatora' },
    { group: 'q53', title: 'Przykład 55 (∃, ∧, ⇐)', formula: 'φ & (Ex ψ(x)) -> Ex (φ & ψ(x))', note: 'wyłączanie φ spod kwantyfikatora' },
    { group: 'q53', title: 'Przykład 55 (∃, ∨)', formula: '(Ex (φ | ψ(x))) -> φ | Ex ψ(x)', note: 'wyłączanie φ spod kwantyfikatora' },

    { group: 'qterm', title: 'Sokrates', formula: '(Ax (p(x) -> q(x))) & p(c) -> q(c)', note: 'każdy człowiek jest śmiertelny…' },
    { group: 'qterm', title: 'Podstawienie termu', formula: '(Ax p(x)) -> p(f(a))', note: 'reguła (∀e) z termem f(a)' },
    { group: 'qterm', title: 'Świadek z funkcji', formula: '(Ax (p(x) -> q(f(x)))) & p(a) -> Ey q(y)', note: 'świadkiem jest f(a)' },
    { group: 'qterm', title: 'Zamiana kwantyfikatorów', formula: '(Ax Ay r(x, y)) -> Ay Ax r(x, y)', note: 'dwa okna ze świeżymi zmiennymi' },
    { group: 'qterm', title: 'Monotoniczność ∀', formula: '(Ax (p(x) -> q(x))) -> (Ax p(x)) -> Ax q(x)', note: 'jedno okno ze świeżą zmienną' },
    { group: 'qterm', title: 'Monotoniczność ∃', formula: '(Ax (p(x) -> q(x))) -> (Ex p(x)) -> Ex q(x)', note: '(∀e) dla świadka z (∃e)' },
    { group: 'qterm', title: 'Paradoks pijaka', formula: 'Ex (p(x) -> Ay p(y))', note: 'trudne · wymaga (¬¬e)' },
  ].map(Object.freeze));

  /** Formuły zadań przykładowych rachunku kwantyfikatorów — tylko dla nich działają podpowiedzi. */
  const FO_SAMPLES = Object.freeze(FO_LIST.filter(e => e.group === 'qprzyk').map(e => ND.F.parse(e.formula, { logic: 'fo' })));
  const isFoSample = f => FO_SAMPLES.some(g => ND.F.eq(f, g));

  /* =====================================================================
     Rezolucja (rozdz. 2.7): zbiory klauzul z kolokwiów i egzaminów (zapis jak na kartce) oraz ze skryptu.
     Zbiór pojawiający się w kilku zadaniach występuje raz (z dopiskiem „też …”).
     ===================================================================== */

  const RES_GROUPS = Object.freeze([
    { id: 'rprzyk', title: 'Przykładowe zbiory — z podpowiedziami' },
    { id: 'rkol', title: 'Kolokwia (sprawdzian nr 1)' },
    { id: 'regz', title: 'Egzaminy' },
    { id: 'rskr', title: 'Ze skryptu' },
    { id: 'rinne', title: 'Inne zbiory klauzul' },
  ]);

  const RES_LIST = Object.freeze([
    { group: 'rprzyk', title: 'Egzamin 2017', clauses: '{¬p ∨ r, ¬r ∨ s, p ∨ ¬s, ¬r}', note: 'zad. 7' },
    { group: 'rprzyk', title: 'Poprawka 2020', clauses: '{r ∨ p, ¬p ∨ ¬q, ¬r ∨ q, ¬r}', note: 'zad. 7' },
    { group: 'rprzyk', title: 'Egzamin 2020', clauses: '{r ∨ p, ¬q, ¬p ∨ q, ¬r ∨ q, r ∨ p}', note: 'zad. 7 · klauzula r ∨ p jest na kartce dwa razy' },
    { group: 'rprzyk', title: 'Kolokwium 1, 2014 (A)', clauses: '{¬p ∨ r, ¬q ∨ p, s ∨ q, ¬r ∨ ¬p, ¬s ∨ q}', note: 'zad. 3' },
    { group: 'rprzyk', title: 'Egzamin 2011', clauses: '{¬s ∨ r, ¬q ∨ s, p ∨ q, ¬r ∨ ¬s, ¬p ∨ q}', note: 'zad. 11' },
    { group: 'rprzyk', title: 'Poprawka 2011', clauses: '{s ∨ r, ¬q ∨ s, p ∨ q, ¬r ∨ ¬s, ¬p ∨ q}', note: 'zad. 19 · jeden literał inaczej niż na egzaminie' },
    { group: 'rprzyk', title: 'Egzamin 2023', clauses: '{¬p ∨ ¬q ∨ r, ¬p ∨ q, ¬r ∨ ¬s, ¬r ∨ s}', note: 'zad. 2 · też egzamin 2010, zad. 12' },
    { group: 'rprzyk', title: 'Poprawka 2023', clauses: '{¬p ∨ ¬q ∨ r, ¬p ∨ q, ¬r ∨ ¬s, ¬r ∨ s, p}', note: 'zad. 2 · zbiór z egzaminu i klauzula p' },

    { group: 'rkol', title: 'Kolokwium 1, 2014 (C)', clauses: '{s ∨ q, ¬r ∨ s, p ∨ r, ¬q ∨ ¬s, ¬p ∨ r}', note: 'zad. 2' },
    { group: 'rkol', title: 'Kolokwium 1, 2015 (A)', clauses: '{¬q ∨ p, s ∨ q, ¬r ∨ ¬p, ¬s ∨ q}', note: 'zad. 3' },
    { group: 'rkol', title: 'Kolokwium 1, 2015 (D)', clauses: '{¬p ∨ q, ¬r ∨ s, ¬q ∨ ¬s, ¬p ∨ r}', note: 'zad. 4' },
    { group: 'rkol', title: 'Kolokwium 1, 2017 (A)', clauses: '{¬p ∨ q, ¬q ∨ ¬r, p ∨ s, s ∨ r, ¬s ∨ p}', note: 'zad. 1' },
    { group: 'rkol', title: 'Kolokwium 1, 2017 (D)', clauses: '{¬p ∨ r, ¬q ∨ r, p ∨ q, ¬s ∨ ¬r, ¬r ∨ s}', note: 'zad. 3 · też egzamin 2009, zad. 17' },
    { group: 'rkol', title: 'Kolokwium 1, 2018 (A)', clauses: '{¬p ∨ q, p ∨ ¬q, q ∨ r, ¬r, ¬q}', note: 'zad. 1' },
    { group: 'rkol', title: 'Kolokwium 1, 2018 (D)', clauses: '{¬p ∨ ¬r, ¬p ∨ q, q, ¬q ∨ ¬r}', note: 'zad. 3' },
    { group: 'rkol', title: 'Kolokwium 1, 2019 (A)', clauses: '{¬q, ¬r ∨ ¬s, q ∨ s, r ∨ q}', note: 'zad. 3 (a) · też egzamin 2007, zad. 8 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2019 (A)', clauses: '{q, ¬r ∨ ¬s, q ∨ s, r ∨ q}', note: 'zad. 3 (b) · też egzamin 2007, zad. 8 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2019 (D)', clauses: '{¬p ∨ r, r ∨ ¬q, q ∨ r, r ∨ p}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2019 (D)', clauses: '{¬p ∨ r, ¬r ∨ ¬q, q ∨ ¬r, r ∨ p}', note: 'zad. 5 (b) · też kolokwium 2021 (D), zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2021 (A)', clauses: '{¬q ∨ r, ¬r ∨ ¬s, q ∨ s, r ∨ q, s ∨ ¬q}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2021 (A)', clauses: '{q ∨ ¬s, ¬r ∨ ¬q, q ∨ s, r ∨ q}', note: 'zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2021 (D)', clauses: '{¬p ∨ r, ¬r ∨ ¬q, q ∨ r, r ∨ p}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2022 (A)', clauses: '{p ∨ q ∨ r, ¬p ∨ ¬q, q ∨ ¬r, p ∨ ¬q, ¬p ∨ q}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2022 (A)', clauses: '{p ∨ q ∨ r, ¬p ∨ ¬q, ¬q ∨ ¬r, p ∨ ¬q, ¬p ∨ q}', note: 'zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2022 (D)', clauses: '{p ∨ q ∨ r, ¬q ∨ ¬r, ¬r ∨ ¬p, q ∨ ¬r, ¬q ∨ r}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2022 (D)', clauses: '{p ∨ q ∨ r, ¬q ∨ ¬r, r ∨ ¬p, q ∨ ¬r, ¬q ∨ r}', note: 'zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2023 (A)', clauses: '{p ∨ q ∨ r, p ∨ ¬q ∨ r, p ∨ ¬r, ¬p ∨ r, ¬p ∨ ¬r}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2023 (A)', clauses: '{p ∨ q ∨ r, p ∨ ¬q ∨ r, p ∨ ¬q, ¬p ∨ r, ¬p ∨ ¬r}', note: 'zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2023 (D)', clauses: '{p ∨ q ∨ r, q ∨ ¬r, ¬p ∨ q ∨ r, ¬p ∨ r, ¬q ∨ ¬r}', note: 'zad. 5 (a)' },
    { group: 'rkol', title: 'Kolokwium 1, 2023 (D)', clauses: '{p ∨ q ∨ r, q ∨ ¬r, ¬p ∨ q ∨ r, ¬q ∨ r, ¬q ∨ ¬r}', note: 'zad. 5 (b)' },
    { group: 'rkol', title: 'Kolokwium 1, 2024 (A)', clauses: '{p ∨ q, r ∨ s, ¬p ∨ ¬q ∨ r, ¬s, ¬p ∨ ¬r ∨ ¬q}', note: 'zad. 1' },
    { group: 'rkol', title: 'Kolokwium 1, 2024 (D)', clauses: '{p ∨ ¬q, ¬r ∨ s, ¬p ∨ q ∨ ¬r, ¬p ∨ q ∨ r, ¬s}', note: 'zad. 3' },

    { group: 'regz', title: 'Egzamin 2008', clauses: '{¬p ∨ ¬q ∨ r, ¬s ∨ q, s, ¬r}', note: 'zad. 7 (a)' },
    { group: 'regz', title: 'Poprawka 2008', clauses: '{¬p ∨ ¬q ∨ r, ¬s ∨ q, s, ¬r, p}', note: 'zad. 7 (a)' },
    { group: 'regz', title: 'Poprawka 2009', clauses: '{¬p ∨ ¬q ∨ r, ¬p ∨ ¬q ∨ s, ¬p ∨ q, p, ¬r ∨ ¬s}', note: 'zad. 17' },
    { group: 'regz', title: 'Egzamin 2010', clauses: '{¬s ∨ r, ¬q ∨ r, s ∨ q, ¬r ∨ ¬p, ¬r ∨ p}', note: 'zad. 11' },
    { group: 'regz', title: 'Poprawka 2010', clauses: '{¬q ∨ p, ¬r ∨ ¬s, q ∨ s, r ∨ q, ¬q ∨ ¬p}', note: 'zad. 17' },
    { group: 'regz', title: 'Egzamin 2013', clauses: '{¬p ∨ q, ¬q ∨ r, p, ¬r ∨ ¬p}', note: 'zad. 3 · też poprawka 2025, zad. 3' },
    { group: 'regz', title: 'Poprawka 2013', clauses: '{¬s ∨ ¬q, ¬q ∨ s, p ∨ q, ¬r ∨ ¬s, ¬p ∨ q}', note: 'zad. 3' },
    { group: 'regz', title: 'Egzamin 2014', clauses: '{p, ¬q ∨ ¬r, ¬p ∨ q, ¬p ∨ r}', note: 'zad. 5 · też poprawka 2016, zad. 7' },
    { group: 'regz', title: 'Poprawka 2014', clauses: '{¬p ∨ q, ¬p ∨ r, p ∨ s, ¬q ∨ s, ¬r ∨ ¬s ∨ t, ¬s ∨ p}', note: 'zad. 7' },
    { group: 'regz', title: 'Egzamin 2015', clauses: '{¬p ∨ q, ¬q ∨ ¬r, p ∨ q, p ∨ r, ¬p ∨ ¬q}', note: 'zad. 8' },
    { group: 'regz', title: 'Poprawka 2015', clauses: '{¬p ∨ q ∨ ¬r, p ∨ ¬r, q ∨ r, ¬q}', note: 'zad. 7' },
    { group: 'regz', title: 'Egzamin 2016', clauses: '{¬p ∨ r, ¬q ∨ r, p ∨ q, ¬r}', note: 'zad. 7 · dylemat konstrukcyjny (zadanie 41.9) z zaprzeczonym wnioskiem' },
    { group: 'regz', title: 'Poprawka 2017', clauses: '{¬p ∨ q, ¬q ∨ r, p ∨ q, ¬q ∨ ¬r}', note: 'zad. 7' },
    { group: 'regz', title: 'Poprawka 2018', clauses: '{¬a ∨ ¬d, ¬c ∨ d, ¬c ∨ a, d ∨ c, ¬d ∨ c}', note: 'zad. 3' },
    { group: 'regz', title: 'Egzamin 2022', clauses: '{p ∨ ¬q, q ∨ r, p ∨ ¬r, ¬p ∨ q, ¬q ∨ ¬p}', note: 'zad. 6' },
    { group: 'regz', title: 'Poprawka 2022', clauses: '{q ∨ ¬r, r ∨ p, q ∨ ¬p, ¬q ∨ r, ¬r ∨ ¬q}', note: 'zad. 6' },

    { group: 'rskr', title: 'Przykład ze str. 43', clauses: '{p ∨ q, ¬p ∨ q, p ∨ ¬q, ¬p ∨ ¬q}', note: 'dowód sprzeczności narysowany w skrypcie' },
    { group: 'rskr', title: 'Okulary pana Hilarego', clauses: '{¬p ∨ q, ¬q ∨ r, ¬r, p ∨ s, ¬s ∨ t, ¬t}', note: 'zadanie 145 jako zbiór klauzul (z zaprzeczonym wnioskiem)' },
    { group: 'rskr', title: 'Zadanie 133.1', clauses: '{¬p ∨ q, ¬p ∨ ¬r ∨ s, ¬q ∨ r, p, ¬s}', note: 'sprzeczny?' },
    { group: 'rskr', title: 'Zadanie 133.2', clauses: '{p ∨ r, ¬r ∨ ¬s, q ∨ s, q ∨ r, ¬p ∨ ¬q, s ∨ p}', note: 'sprzeczny?' },
    { group: 'rskr', title: 'Zadanie 133.3', clauses: '{p ∨ q ∨ r, ¬r ∨ ¬q ∨ ¬p, ¬q ∨ r, ¬r ∨ p}', note: 'sprzeczny?' },

    { group: 'rinne', title: 'Zbiór spełnialny', clauses: '{p ∨ q, ¬p ∨ r, ¬q ∨ ¬r, q ∨ r}', note: 'wskaż wartościowanie' },
    { group: 'rinne', title: 'Modus ponens', clauses: '{p, ¬p ∨ q, ¬q}', note: 'p, p ⇒ q i zaprzeczenie q' },
    { group: 'rinne', title: 'Trzy zmienne', clauses: '{p ∨ q ∨ r, ¬p ∨ q, ¬q ∨ r, ¬r ∨ p, ¬p ∨ ¬q ∨ ¬r}', note: 'sprzeczny?' },
    { group: 'rinne', title: 'Cztery klauzule', clauses: '{p ∨ ¬q, q ∨ ¬r, r ∨ ¬p, p ∨ q ∨ r}', note: 'sprzeczny?' },
  ].map(Object.freeze));

  let resSamples = null;   // klucze zbiorów z podpowiedziami — liczone przy pierwszym użyciu
  /** Czy zbiór klauzul (w dowolnej kolejności) jest zbiorem przykładowym z podpowiedziami. */
  const isResSample = clauses => {
    resSamples ||= RES_LIST.filter(e => e.group === 'rprzyk').map(e => ND.Res.setKey(ND.Res.parseClauses(e.clauses)));
    return resSamples.includes(ND.Res.setKey(clauses));
  };

  const PROP = Object.freeze({ GROUPS, LIST, SAMPLES, isSample });
  const FO = Object.freeze({ GROUPS: FO_GROUPS, LIST: FO_LIST, SAMPLES: FO_SAMPLES, isSample: isFoSample });
  const RES = Object.freeze({ GROUPS: RES_GROUPS, LIST: RES_LIST, isSample: isResSample });

  /** Przykłady dedukcji naturalnej dla rachunku ('prop' | 'fo'). */
  const forLogic = logic => (logic === 'fo' ? FO : PROP);

  ND.Examples = Object.freeze({ PROP, FO, RES, forLogic });
})(globalThis.ND ||= {});
