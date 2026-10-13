/* =====================================================================
   Przykłady: zadania przykładowe (wybrane z kolokwiów i egzaminów — tylko
   w nich działa przycisk „Podpowiedź”), rozdział 2.9 skryptu, zadanie 41,
   pozostałe zadania z kolokwiów i egzaminów oraz gotowe dowody ze skryptu;
   przykłady dla rachunku kwantyfikatorów (rozdz. 3.3) i zbiory klauzul do rezolucji (rozdz. 2.7).
   Każdy dział ma { GROUPS, LIST, isSample } — podpowiedzi działają tylko w przykładach, dla których
   isSample zwraca true. Wymaga modułów formula.js i proof.js (resolution.js — dopiero przy sprawdzaniu
   zbiorów klauzul, więc testy bez rezolucji mogą wczytać ten moduł).
   ===================================================================== */
(function (ND) {
  'use strict';
  const { V, NOT, AND, OR, IMP, BOT } = ND.F;
  const { node, box } = ND.Proof;

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
   * Grupa „przyk” (zadania przykładowe, uporządkowane od najłatwiejszego) to jedyne zadania,
   * w których działają podpowiedzi; pozostałe uczniowie rozwiązują samodzielnie.
   */
  const LIST = Object.freeze([
    { group: 'przyk', title: 'Egzamin 2018', formula: 'p -> (q & r) | p', note: 'zad. 6' },
    { group: 'przyk', title: 'Kolokwium 1, 2014 (C)', formula: '(p -> q) & (p -> r) -> (p -> q & r)', note: 'zad. 4' },
    { group: 'przyk', title: 'Kolokwium 1, 2011 (A)', formula: '(p -> q) -> (~q -> ~p)', note: 'zad. 2 · kontrapozycja' },
    { group: 'przyk', title: 'Kolokwium 1, 2016 (A)', formula: '~p & ~q -> ~(p | q)', note: 'zad. 5 · prawo De Morgana' },
    { group: 'przyk', title: 'Kolokwium 1, 2013 (A)', formula: 'p & ~q -> ~(p -> q)', note: 'zad. 4' },
    { group: 'przyk', title: 'Kolokwium 1, 2023 (D)', formula: 'p & (q | r) -> (p & q) | (p & r)', note: 'zad. 2 · rozdzielność' },
    { group: 'przyk', title: 'Poprawka 2015', formula: '(p -> q) | (p -> r) -> (p -> q | r)', note: 'zad. 3' },
    { group: 'przyk', title: 'Kolokwium 1, 2024 (D)', formula: '((p -> q) -> (q -> p)) -> (q -> p)', note: 'zad. 1' },
    { group: 'przyk', title: 'Kolokwium 1, 2011 (C)', formula: '(~p -> F) -> p', note: 'zad. 2 · reguła dowodu nie wprost' },
    { group: 'przyk', title: 'Egzamin 2023', formula: '(a -> b) & (b -> a) -> (a & b) | (~a & ~b)', note: 'zad. 3 · wskazówka: a ∨ ¬a' },

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

    { group: 'kol', title: 'Kolokwium 1, 2013 (D)', formula: '(p -> q & r) -> (p -> q) & (p -> r)', note: 'zad. 3 · też egzamin 2014, zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2014 (A)', formula: '(p -> r) & (q -> r) -> (p | q -> r)', note: 'zad. 4' },
    { group: 'kol', title: 'Kolokwium 1, 2016 (D)', formula: '~p | ~q -> ~(p & q)', note: 'zad. 4 · prawo De Morgana' },
    { group: 'kol', title: 'Kolokwium 1, 2024 (A)', formula: '((p -> q) | r) & ~r -> (p -> q)', note: 'zad. 2' },

    { group: 'egz', title: 'Egzamin 2016', formula: '(a & b) | (~a & ~b) -> (a -> b)', note: 'zad. 6 · też poprawka 2023, zad. 5' },
    { group: 'egz', title: 'Poprawka 2016', formula: '(p -> q) & (p -> r) -> (p -> q | r)', note: 'zad. 3' },
    { group: 'egz', title: 'Egzamin 2017', formula: '~a & (b -> a) -> ~b', note: 'zad. 6 · modus tollens' },
    { group: 'egz', title: 'Poprawka 2017', formula: '(p -> q) & (q -> r) -> (p | q -> r)', note: 'zad. 3' },
    { group: 'egz', title: 'Poprawka 2018', formula: 'p & q -> (~p -> q)', note: 'zad. 5' },
    { group: 'egz', title: 'Egzamin 2020', formula: '(p -> ~q) -> (q -> ~p)', note: 'zad. 6' },
    { group: 'egz', title: 'Poprawka 2022', formula: 'p & (q -> r) -> (p & q -> p & r)', note: 'zad. 3' },

    { group: 'demo', title: 'Przykład 48', formula: '~(p|q) -> ~p & ~q', note: 'gotowy dowód', proof: demo48 },
    { group: 'demo', title: 'Przykład 49', formula: 'p | ~p', note: 'gotowy dowód', proof: demo49 },
  ].map(Object.freeze));

  /** Formuły zadań przykładowych — tylko dla nich działają podpowiedzi. */
  const SAMPLES = Object.freeze(LIST.filter(e => e.group === 'przyk').map(e => ND.F.parse(e.formula)));

  /** Czy formuła (korzeń dowodu) jest zadaniem przykładowym. */
  const isSample = f => SAMPLES.some(g => ND.F.eq(f, g));

  /* =====================================================================
     Rachunek kwantyfikatorów (rozdz. 3.3): przykłady i zadania ze skryptu — same prawa
     rachunku kwantyfikatorów. Schematy φ, ψ z zadań zapisujemy jako symbole relacyjne:
     φ(x), ψ(x) — formuły, w których x może występować wolno, φ — formuła bez wolnego x.
     Podpowiedzi działają we wszystkich tych przykładach (i tylko w nich).
     ===================================================================== */

  const FO_GROUPS = Object.freeze([
    { id: 'q33', title: 'Rozdział 3.3 — przykłady' },
    { id: 'q149', title: 'Zadania 149–169' },
    { id: 'q170', title: 'Zadania 170–179 (x nie występuje wolno w φ)' },
    { id: 'q53', title: 'Prawa z przykładów 53–55' },
    { id: 'qterm', title: 'Z termami i stałymi' },
  ]);

  const FO_LIST = Object.freeze([
    { group: 'q33', title: 'Przykład 56', formula: 'Ax (φ(x) & ψ(x)) -> (Ax φ(x)) & (Ax ψ(x))', note: 'też zadanie 154' },
    { group: 'q33', title: 'Prawo De Morgana', formula: '~(Ex φ(x)) -> Ax ~φ(x)', note: 'schemat dowodu ze str. 58' },
    { group: 'q33', title: 'Przykład 57', formula: '(Ex p(x)) -> ~Ax ~p(x)', note: 'reguła (∃e)' },

    { group: 'q149', title: 'Zadanie 149', formula: '(Ax ~φ(x)) -> ~Ex φ(x)', note: 'druga implikacja prawa De Morgana' },
    { group: 'q149', title: 'Zadanie 150', formula: '(Ex ~φ(x)) -> ~Ax φ(x)', note: 'prawo De Morgana' },
    { group: 'q149', title: 'Zadanie 151', formula: '~(Ax φ(x)) -> Ex ~φ(x)', note: 'wymaga (¬¬e)' },
    { group: 'q149', title: 'Zadanie 153', formula: '(Ax φ(x)) | (Ax ψ(x)) -> Ax (φ(x) | ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 157', formula: '((Ex φ(x)) -> Ax ψ(x)) -> Ax (φ(x) -> ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 159', formula: '(Ex (φ(x) & ψ(x))) -> (Ex φ(x)) & (Ex ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 160', formula: '((Ex φ(x)) -> Ex ψ(x)) -> Ex (φ(x) -> ψ(x))', note: 'prawo · wymaga (¬¬e)' },
    { group: 'q149', title: 'Zadanie 162', formula: '(Ax φ(x)) -> (Ex ψ(x)) -> Ex (φ(x) -> ψ(x))', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 163', formula: '(Ex (φ(x) -> ψ(x))) -> (Ax φ(x)) -> Ex ψ(x)', note: 'prawo' },
    { group: 'q149', title: 'Zadanie 166', formula: '(Ax φ(x)) -> Ex φ(x)', note: 'uniwersum jest niepuste' },
    { group: 'q149', title: 'Zadanie 169', formula: '(Ey Ax φ(x, y)) -> Ax Ey φ(x, y)', note: 'prawo (odwrotna implikacja — zad. 168 — nie jest)' },

    { group: 'q170', title: 'Zadanie 170 (⇒)', formula: '(Ax (φ -> ψ(x))) -> (φ -> Ax ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 170 (⇐)', formula: '(φ -> Ax ψ(x)) -> Ax (φ -> ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 171', formula: '(Ax (φ -> ψ(x))) -> (φ -> Ex ψ(x))', note: 'tylko ta implikacja' },
    { group: 'q170', title: 'Zadanie 172', formula: '(Ax (ψ(x) -> φ)) -> ((Ax ψ(x)) -> φ)', note: 'tylko ta implikacja' },
    { group: 'q170', title: 'Zadanie 173 (⇒)', formula: '(Ax (ψ(x) -> φ)) -> ((Ex ψ(x)) -> φ)', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 173 (⇐)', formula: '((Ex ψ(x)) -> φ) -> Ax (ψ(x) -> φ)', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 176 (⇒)', formula: '(Ex (φ -> ψ(x))) -> (φ -> Ex ψ(x))', note: 'formuły są równoważne' },
    { group: 'q170', title: 'Zadanie 176 (⇐)', formula: '(φ -> Ex ψ(x)) -> Ex (φ -> ψ(x))', note: 'formuły są równoważne · wymaga (¬¬e)' },
    { group: 'q170', title: 'Zadanie 177', formula: '(φ -> Ax ψ(x)) -> Ex (φ -> ψ(x))', note: 'tylko ta implikacja' },
    { group: 'q170', title: 'Zadanie 178', formula: '((Ex ψ(x)) -> φ) -> Ex (ψ(x) -> φ)', note: 'tylko ta implikacja' },
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

  const FO_FORMULAS = Object.freeze(FO_LIST.map(e => ND.F.parse(e.formula, { logic: 'fo' })));
  /** Podpowiedzi w rachunku kwantyfikatorów działają we wszystkich przykładach (i tylko w nich). */
  const isFoSample = f => FO_FORMULAS.some(g => ND.F.eq(f, g));

  /* =====================================================================
     Rezolucja (rozdz. 2.7): zbiory klauzul. Podpowiedzi tylko w grupie „z podpowiedziami”.
     ===================================================================== */

  const RES_GROUPS = Object.freeze([
    { id: 'rprzyk', title: 'Przykładowe zbiory — z podpowiedziami' },
    { id: 'r133', title: 'Zadanie 133' },
    { id: 'rinne', title: 'Inne zbiory klauzul' },
  ]);

  const RES_LIST = Object.freeze([
    { group: 'rprzyk', title: 'Przykład ze str. 43', clauses: '{p ∨ q, ¬p ∨ q, p ∨ ¬q, ¬p ∨ ¬q}', note: 'dowód sprzeczności narysowany w skrypcie' },
    { group: 'rprzyk', title: 'Okulary pana Hilarego', clauses: '{¬p ∨ q, ¬q ∨ r, ¬r, p ∨ s, ¬s ∨ t, ¬t}', note: 'zadanie 145 jako zbiór klauzul (z zaprzeczonym wnioskiem)' },
    { group: 'rprzyk', title: 'Zbiór spełnialny', clauses: '{p ∨ q, ¬p ∨ r, ¬q ∨ ¬r, q ∨ r}', note: 'wskaż wartościowanie' },

    { group: 'r133', title: 'Zadanie 133.1', clauses: '{¬p ∨ q, ¬p ∨ ¬r ∨ s, ¬q ∨ r, p, ¬s}', note: 'sprzeczny?' },
    { group: 'r133', title: 'Zadanie 133.2', clauses: '{p ∨ r, ¬r ∨ ¬s, q ∨ s, q ∨ r, ¬p ∨ ¬q, s ∨ p}', note: 'sprzeczny?' },
    { group: 'r133', title: 'Zadanie 133.3', clauses: '{p ∨ q ∨ r, ¬r ∨ ¬q ∨ ¬p, ¬q ∨ r, ¬r ∨ p}', note: 'sprzeczny?' },

    { group: 'rinne', title: 'Modus ponens', clauses: '{p, ¬p ∨ q, ¬q}', note: 'p, p ⇒ q i zaprzeczenie q' },
    { group: 'rinne', title: 'Dylemat konstrukcyjny', clauses: '{p ∨ q, ¬p ∨ r, ¬q ∨ r, ¬r}', note: 'zadanie 41.9 z zaprzeczonym wnioskiem' },
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
  const FO = Object.freeze({ GROUPS: FO_GROUPS, LIST: FO_LIST, isSample: isFoSample });
  const RES = Object.freeze({ GROUPS: RES_GROUPS, LIST: RES_LIST, isSample: isResSample });

  /** Przykłady dedukcji naturalnej dla rachunku ('prop' | 'fo'). */
  const forLogic = logic => (logic === 'fo' ? FO : PROP);

  ND.Examples = Object.freeze({ PROP, FO, RES, forLogic });
})(globalThis.ND ||= {});
