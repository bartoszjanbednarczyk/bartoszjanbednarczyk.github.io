# Dedukcja naturalna — aplikacja

Statyczna aplikacja bez budowania: `index.html`, `css/app.css` i skrypty w `js/`.
Na stronie jest osadzona w ramce w `../dedukcja.html`.

Trzy działy (zakładki pod nagłówkiem):

- **Rachunek zdań** — dedukcja naturalna z rozdz. 2.9 skryptu (link `#d=…`),
- **Rachunek kwantyfikatorów** — dedukcja naturalna z rozdz. 3.3: termy z funkcjami, reguły (∀i), (∀e), (∃i), (∃e),
  okna ze świeżymi zmiennymi, dowód słowny ze strukturą 𝔄 i wartościowaniami (link `#q=…`);
  aplikacja zakłada, że dowodzone formuły są tautologiami (bez kontrprzykładów),
- **Rezolucja** — rezolucyjne dowody sprzeczności dla rachunku zdań z rozdz. 2.7 (link `#r=…`):
  albo wyprowadzenie klauzuli pustej ⊥, albo wartościowanie spełniające wszystkie klauzule.

Każdy dział ma osobny zapis w localStorage i osobną historię; podpowiedzi działają tylko w zadaniach przykładowych.

## Struktura

Rdzeń bez DOM-u (`js/`, działa też w Node):

- `formula.js` — formuły: parser z limitami, wypisywanie (tekst, HTML, LaTeX), semantyka i kontrprzykłady,
- `text.js` — tekst z formułami jako segmenty, niezależny od formatu wyjściowego,
- `proof.js` — drzewa dowodów z oknami (i wnioskami wyciągniętymi w oknach z założeń), zapis i ścisły odczyt (limity rozmiaru),
- `rules.js` — reguły (każda opisana jednym rekordem) i weryfikacja dowodu,
- `prover.js` — automatyczny dowodzący, z którego korzystają podpowiedzi,
- `prover-fo.js` — heurystyczny dowodzący dla rachunku kwantyfikatorów (ograniczony budżet; podpowiedzi w przykładach z rozdz. 3.3),
- `explain.js` — opisy kroków, podpowiedzi i dowód w języku naturalnym (semantyczny: wartościowanie σ, okna jako przypadki),
- `render.js` — HTML/tekst/LaTeX z segmentów oraz rysunek dowodu,
- `export.js` — kod LaTeX, układ obrazka, SVG i PNG,
- `resolution.js` — klauzule, rezolwenty (Def. 47), spełnialność (DPLL), szukanie dowodu sprzeczności, podpowiedzi, praca nad zadaniem (usuwanie rezolwent, drzewo dowodu), zapis i ścisły odczyt,
- `examples.js` — przykłady każdego działu jako `{ GROUPS, LIST, isSample }`: `Examples.PROP` (skrypt, kolokwia, egzaminy; podpowiedzi tylko w dziesięciu zadaniach przykładowych z grupy `przyk` i w dowodzie z samouczka), `Examples.FO` (rozdz. 3.3, wszystkie z podpowiedziami) i `Examples.RES` (zbiory klauzul; podpowiedzi tylko w grupie `rprzyk`).

Interfejs (`js/ui/`):

- `kit.js` — narzędzia (ikony, komunikaty, schowek, okna modalne, bezpieczny localStorage, historia cofnij/ponów, kodowanie linków),
- `store.js` — stan, historia, zapis i linki; każda zmiana dowodu przechodzi przez `commit()`, który pilnuje limitów i w razie problemu cofa zmianę,
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
