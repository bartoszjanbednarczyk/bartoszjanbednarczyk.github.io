/* =====================================================================
   Okno eksportu: obrazek (podgląd SVG, pobieranie SVG/PNG, kopiowanie PNG)
   oraz kod LaTeX — dla wybranego fragmentu.
   ===================================================================== */
(function (ND) {
  'use strict';
  const { F, Proof, Export, Render } = ND;
  const UI = (ND.UI ||= {});
  const { $, toast, copyText, copyImage, download, theme, markChoice, Modal } = UI.kit;
  const S = UI.store, st = S.state;

  const MIN_PNG_SCALE = 0.5;
  let fi = 0;
  let measurer = null;

  const root = () => st.frags[fi];
  const background = () => S.prefs.exportBg || theme();
  /** Fonty formuł — te same co w aplikacji (zmienna --math w CSS). */
  const mathFont = () => getComputedStyle(document.documentElement).getPropertyValue('--math').trim() || Export.MATH_FONT;

  /** Kolory obrazka; przy przezroczystym tle kolor tuszu zgodny z motywem aplikacji. */
  function colors() {
    const bg = background();
    return bg === 'transparent' ? { ...Export.THEMES[theme()], bg: null } : Export.THEMES[bg];
  }

  function layout() {
    if (!measurer) {
      try { measurer = Export.canvasMeasurer({ font: mathFont() }); } catch (e) { measurer = Export.approxMeasurer(); }
    }
    return Export.layout(root(), measurer);
  }

  const pngScale = L => Export.fitScale(L, S.prefs.exportScale);
  const fileName = ext => `dowod-${fi + 1}.${ext}`;
  const decimal = x => x.toFixed(1).replace('.', ',');

  /** PNG jako obietnica Bloba (skala dopasowana do limitów płótna). */
  function pngBlob() {
    return new Promise((resolve, reject) => {
      const L = layout(), scale = pngScale(L);
      if (scale < MIN_PNG_SCALE) { reject(new Error('Dowód jest za duży na obrazek PNG — pobierz SVG')); return; }
      Export.toCanvas(L, colors(), scale, { font: mathFont() })
        .toBlob(b => (b ? resolve(b) : reject(new Error('Nie udało się utworzyć PNG — pobierz SVG'))), 'image/png');
    });
  }

  /* ---------- zawartość okna ---------- */

  function incompleteNote() {
    const open = Proof.openLeaves(root()).length;
    return open ? `Dowód nie jest jeszcze kompletny (otwarte cele: ${open}).` : '';
  }

  function renderImage() {
    const L = layout();
    const preview = $('expPreview');
    preview.innerHTML = Export.toSVG(L, colors(), mathFont());
    preview.classList.toggle('checker', background() === 'transparent');
    const scale = pngScale(L);
    const sizeNote = scale >= S.prefs.exportScale ? ''
      : scale < MIN_PNG_SCALE ? 'Za duży na PNG — użyj SVG.' : `PNG zostanie zmniejszony do skali ${decimal(scale)}×.`;
    $('expNote').textContent = [incompleteNote(), sizeNote].filter(Boolean).join(' ');
  }

  const latexCode = () => Export.latex(root(), { standalone: S.prefs.texStandalone });

  function renderLatex() {
    $('tex').value = latexCode();
    $('texNote').textContent = incompleteNote();
  }

  function render() {
    const tab = S.prefs.exportTab;
    markChoice('expTabs', 'tab', tab);
    $('expImagePane').hidden = tab !== 'image';
    $('expLatexPane').hidden = tab !== 'latex';
    const select = $('expFrag');
    select.innerHTML = st.frags.map((r, i) => `<option value="${i}">${st.frags.length > 1 ? (i + 1) + '. ' : ''}${Render.esc(F.text(r.f))}`
      + `${Proof.openLeaves(r).length ? ' (niekompletny)' : ''}</option>`).join('');
    select.value = String(fi);
    select.hidden = st.frags.length < 2;
    $('expBg').value = background();
    $('expScale').value = String(S.prefs.exportScale);
    $('texFull').checked = S.prefs.texStandalone;
    if (tab === 'image') renderImage(); else renderLatex();
  }

  function open(i) {
    if (!st.frags.length) { toast('Najpierw zbuduj dowód'); return; }
    fi = UI.actions.targetFragment(i);
    render();
    Modal.open('exportModal');
  }

  function init() {
    document.querySelectorAll('#expTabs button').forEach(b => b.addEventListener('click', () => { S.setPref('exportTab', b.dataset.tab); render(); }));
    $('expFrag').addEventListener('change', e => { fi = +e.target.value; render(); });
    $('expBg').addEventListener('change', e => { S.setPref('exportBg', e.target.value); render(); });
    $('expScale').addEventListener('change', e => { S.setPref('exportScale', +e.target.value); render(); });
    $('texFull').addEventListener('change', e => { S.setPref('texStandalone', e.target.checked); render(); });
    $('expSvg').addEventListener('click', () => {
      download(fileName('svg'), Export.toSVG(layout(), colors(), mathFont()), 'image/svg+xml');
      toast('Pobrano obrazek SVG');
    });
    $('expPng').addEventListener('click', () => {
      pngBlob().then(b => { download(fileName('png'), b); toast('Pobrano obrazek PNG'); }, e => toast(e.message));
    });
    $('expCopyPng').addEventListener('click', () => {
      if (pngScale(layout()) < MIN_PNG_SCALE) { toast('Dowód jest za duży na obrazek PNG — pobierz SVG'); return; }
      copyImage(pngBlob(), 'Skopiowano obrazek — wklej go np. na Discordzie');
    });
    $('texCopy').addEventListener('click', () => copyText($('tex').value, 'Skopiowano kod LaTeX'));
    $('texDownload').addEventListener('click', () => {
      download(fileName('tex'), latexCode(), 'application/x-tex');
      toast('Pobrano plik .tex');
    });
  }

  UI.exporter = Object.freeze({ init, open });
})(globalThis.ND ||= {});
