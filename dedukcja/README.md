# Dedukcja naturalna — aplikacja

Statyczna aplikacja bez budowania: `index.html`, `css/app.css` i skrypty w `js/`.
Na stronie jest osadzona w ramce w `../dedukcja.html`.

Trzy działy (zakładki pod nagłówkiem):

- **Rachunek zdań** — dedukcja naturalna z rozdz. 2.9 skryptu, uzupełniona o regułę (wś) — prawo wyłączonego środka α ∨ ¬α bez przesłanek (w tabeli reguł obok „założenia”; dostępna też w rachunku kwantyfikatorów, ale dowodzący i podpowiedzi z niej nie korzystają) (link `#d=…`),
- **Rachunek kwantyfikatorów** — dedukcja naturalna z rozdz. 3.3: termy z funkcjami (także stałe liczbowe 0, 42),
  relacje pisane między argumentami (=, <, >, ≤, ≥, ≠ jako skrót ¬(x = y)), symbole relacyjne p–t, P–S, φ, ψ,
  reguły (∀i), (∀e), (∃i), (∃e), okna ze świeżymi zmiennymi, dowód słowny ze strukturą 𝔄 i wartościowaniami
  (link `#q=…`); aplikacja zakłada, że dowodzone formuły są tautologiami (bez kontrprzykładów),
- **Rezolucja** — rezolucyjne dowody sprzeczności dla rachunku zdań z rozdz. 2.7 (link `#r=…`):
  albo wyprowadzenie klauzuli pustej ⊥, albo wartościowanie spełniające wszystkie klauzule.

Każdy dział ma osobny zapis w localStorage i osobną historię. Podpowiedzi działają tylko w zadaniach przykładowych —
w każdym dziale to 5–10 zadań z kolokwiów i egzaminów, do których opublikowano rozwiązania (pierwsza grupa menu
„Przykłady”); pozostałe zadania z kolokwiów i egzaminów oraz zadania ze skryptu rozwiązuje się samodzielnie.

## Struktura

Rdzeń bez DOM-u (`js/`, działa też w Node):

- `formula.js` — formuły: parser z limitami, wypisywanie (tekst, HTML, LaTeX — kwantyfikator, po którym coś stoi,
  w nawiasach, bo na kolokwiach zasięg sięga do nawiasu), semantyka i kontrprzykłady,
- `text.js` — tekst z formułami jako segmenty, niezależny od formatu wyjściowego,
- `proof.js` — drzewa dowodów z oknami (i wnioskami wyciągniętymi w oknach z założeń), zapis i ścisły odczyt (limity rozmiaru),
- `rules.js` — reguły (każda opisana jednym rekordem) i weryfikacja dowodu,
- `prover.js` — automatyczny dowodzący, z którego korzystają podpowiedzi,
- `prover-fo.js` — heurystyczny dowodzący dla rachunku kwantyfikatorów (ograniczony budżet; źródło podpowiedzi),
- `explain.js` — opisy kroków, podpowiedzi i dowód w języku naturalnym (semantyczny: wartościowanie σ, okna jako przypadki),
- `render.js` — HTML/tekst/LaTeX z segmentów oraz rysunek dowodu,
- `export.js` — kod LaTeX, układ obrazka, SVG i PNG,
- `resolution.js` — klauzule, rezolwenty (Def. 47), spełnialność (DPLL), szukanie dowodu sprzeczności, podpowiedzi, praca nad zadaniem (usuwanie rezolwent, drzewo dowodu), zapis i ścisły odczyt,
- `examples.js` — przykłady każdego działu jako `{ GROUPS, LIST, isSample }`: `Examples.PROP`, `Examples.FO` i `Examples.RES`
  (zadania przykładowe z podpowiedziami w grupach `przyk`, `qprzyk`, `rprzyk`; dalej kolokwia, egzaminy i skrypt).
  Zadanie z kolokwium lub egzaminu, które powtarza się w innym źródle, jest w menu raz (z dopiskiem „też …”).

Interfejs (`js/ui/`):

- `kit.js` — narzędzia (ikony, komunikaty, schowek, okna modalne, bezpieczny localStorage, historia cofnij/ponów, kodowanie linków),
- `store.js` — stan, historia, zapis i linki; każda zmiana dowodu przechodzi przez `commit()`, który pilnuje limitów
  (także tego, by zapis dał się odczytać: limity parsera, stała liczba argumentów symboli) i w razie problemu cofa zmianę,
- `actions.js` — akcje użytkownika (reguły w obu trybach, edycja drzewa — m.in. cofanie kroku i całego poddrzewa, przykłady),
- `workspace.js` — widok obszaru roboczego, tabeli reguł i paska akcji,
- `ask.js`, `hints.js`, `exporter.js`, `present.js`, `tutorial.js`, `fireworks.js` — kreator formuł, podpowiedzi, eksport, prezentacja, samouczek, fajerwerki,
- `res.js` — widok działu „Rezolucja” (lista klauzul, wartościowanie, podpowiedzi, drzewo dowodu, własna historia, zapis i link),
- `main.js` — start aplikacji, zakładki działów, motyw, ustawienia, wspólny pasek akcji i skróty klawiszowe (przekazywane do bieżącego działu).

Skrypty to zwykłe pliki (bez modułów ES), które dzielą przestrzeń nazw `ND`,
więc kolejność znaczników `<script>` w `index.html` ma znaczenie.

## Testy

```
node dedukcja/tests/core.test.js
node dedukcja/tests/store.test.js
node dedukcja/tests/actions.test.js
node dedukcja/tests/hints.test.js
node dedukcja/tests/facts.test.js
node dedukcja/tests/fo.test.js
node dedukcja/tests/res.test.js
```

## Po każdej zmianie

Podbij parametr `?v=…` przy plikach w `index.html` oraz przy ramce w `../dedukcja.html`
(dwa miejsca) — inaczej przeglądarki mogą długo trzymać stare wersje plików.
