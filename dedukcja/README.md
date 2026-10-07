# Dedukcja naturalna — aplikacja

Statyczna aplikacja bez budowania: `index.html`, `css/app.css` i skrypty w `js/`.
Na stronie jest osadzona w ramce w `../dedukcja.html`.

## Struktura

Rdzeń bez DOM-u (`js/`, działa też w Node):

- `formula.js` — formuły: parser z limitami, wypisywanie (tekst, HTML, LaTeX), semantyka i kontrprzykłady,
- `text.js` — tekst z formułami jako segmenty, niezależny od formatu wyjściowego,
- `proof.js` — drzewa dowodów z oknami, zapis i ścisły odczyt (limity rozmiaru),
- `rules.js` — reguły (każda opisana jednym rekordem) i weryfikacja dowodu,
- `prover.js` — automatyczny dowodzący, z którego korzystają podpowiedzi,
- `explain.js` — opisy kroków, podpowiedzi i dowód w języku naturalnym,
- `render.js` — HTML/tekst/LaTeX z segmentów oraz rysunek dowodu,
- `export.js` — kod LaTeX, układ obrazka, SVG i PNG,
- `examples.js` — przykłady ze skryptu, kolokwiów i egzaminów.

Interfejs (`js/ui/`):

- `kit.js` — narzędzia (ikony, komunikaty, schowek, okna modalne, bezpieczny localStorage),
- `store.js` — stan, historia, zapis i linki; każda zmiana dowodu przechodzi przez `commit()`, który pilnuje limitów i w razie problemu cofa zmianę,
- `actions.js` — akcje użytkownika (reguły w obu trybach, edycja drzewa, przykłady),
- `workspace.js` — widok obszaru roboczego, tabeli reguł i paska akcji,
- `ask.js`, `hints.js`, `exporter.js`, `present.js`, `tutorial.js`, `fireworks.js` — kreator formuł, podpowiedzi, eksport, prezentacja, samouczek, fajerwerki,
- `main.js` — start aplikacji, motyw, ustawienia, skróty klawiszowe.

Skrypty to zwykłe pliki (bez modułów ES), które dzielą przestrzeń nazw `ND`,
więc kolejność znaczników `<script>` w `index.html` ma znaczenie.

## Testy

```
node dedukcja/tests/core.test.js
node dedukcja/tests/store.test.js
```

## Po każdej zmianie

Podbij parametr `?v=…` przy plikach w `index.html` oraz przy ramce w `../dedukcja.html`
(dwa miejsca) — inaczej przeglądarki mogą długo trzymać stare wersje plików.
