/* =====================================================================
   Fajerwerki po ukończeniu dowodu: kilka rakiet wybuchających w górnej
   części ekranu (~2,5 s). Płótno nie przechwytuje kliknięć i znika samo.
   Pomijane, gdy użytkownik wyłączył je w ustawieniach albo system prosi
   o ograniczenie animacji.
   ===================================================================== */
(function (ND) {
  'use strict';
  const UI = (ND.UI ||= {});
  const S = UI.store;
  const { theme, reducedMotion } = UI.kit;

  const PALETTES = {
    light: ['#03b877', '#f08c00', '#e5484d', '#1f63d6', '#8e44ad', '#0aa5a5'],
    dark: ['#2fd99a', '#ffc44d', '#ff6b6b', '#5aa9ff', '#c77dff', '#ffffff'],
  };
  const ROCKETS = 6, LAUNCH_EVERY = 11;     // klatki między startami rakiet
  const GRAVITY = 0.055, DRAG = 0.986;

  let running = false;

  const pick = list => list[Math.floor(Math.random() * list.length)];

  function launch() {
    if (running || !S.prefs.fireworks || reducedMotion()) return;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    if (!g) return;
    running = true;
    const colors = PALETTES[theme()];
    canvas.className = 'fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; };
    size();
    window.addEventListener('resize', size);

    const rockets = [], sparks = [];
    let frame = 0, launched = 0;

    const rocket = () => {
      const w = window.innerWidth, h = window.innerHeight;
      rockets.push({
        x: w * (0.15 + 0.7 * Math.random()), y: h + 8, vx: (Math.random() - 0.5) * 1.6,
        vy: -(7 + h * 0.012 + Math.random() * 2.5), apex: h * (0.12 + 0.3 * Math.random()), color: pick(colors),
      });
    };

    const burst = (x, y, color) => {
      const n = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 1.2 + Math.random() * 4.2;
        sparks.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1, decay: 0.011 + Math.random() * 0.012, color: Math.random() < 0.2 ? pick(colors) : color });
      }
    };

    function tick() {
      frame++;
      if (launched < ROCKETS && frame % LAUNCH_EVERY === 1) { rocket(); launched++; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      g.lineCap = 'round';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.vy += GRAVITY * 2;
        r.x += r.vx;
        r.y += r.vy;
        g.strokeStyle = r.color;
        g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - r.vx * 2.5, r.y - r.vy * 2.5); g.stroke();
        if (r.y <= r.apex || r.vy >= -0.5) { burst(r.x, r.y, r.color); rockets.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.px = s.x; s.py = s.y;
        s.vx *= DRAG; s.vy = s.vy * DRAG + GRAVITY;
        s.x += s.vx; s.y += s.vy;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, s.life * 1.4);
        g.strokeStyle = s.color;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(s.px, s.py); g.lineTo(s.x, s.y); g.stroke();
      }
      g.globalAlpha = 1;
      if (launched < ROCKETS || rockets.length || sparks.length) requestAnimationFrame(tick);
      else {
        window.removeEventListener('resize', size);
        canvas.remove();
        running = false;
      }
    }
    requestAnimationFrame(tick);
  }

  UI.fireworks = Object.freeze({ launch });
})(globalThis.ND ||= {});
