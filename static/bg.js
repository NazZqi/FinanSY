// FinanSY: fondo de todas las pantallas. Un amanecer en la cordillera dibujado con caracteres
// en un <canvas>, escrito para este proyecto (sin dependencias). Es decoración: si falla,
// queda el degradado de .site-bg. Paleta de noche o de día según prefers-color-scheme.
(function () {
  "use strict";

  const CW = 11, CH = 18, FPS = 12; // tamaño de celda en px y cuadros por segundo
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const pal = (p) => ({
    sky: p.sky.map(hex), sun: hex(p.sun), glow: hex(p.glow), bird: hex(p.bird),
    ridges: p.ridges.map((r) => r.map(hex)), // [borde, cuerpo], de la más lejana a la más cercana
    ink: p.ink, // cuánto se aclara (+) u oscurece (−) el carácter respecto de su celda
  });
  const PALETTES = {
    dark: pal({
      sky: ["#1b1f4d", "#3f3a7a", "#8a4f86", "#d9637a", "#f59a5f", "#ffd27f"],
      sun: "#fff6cf", glow: "#ffc15e", bird: "#1c1530", ink: 0.3,
      ridges: [["#ffd9c4", "#b08aae"], ["#f2b8a8", "#7a5f99"], ["#d9928e", "#4a3c78"], ["#a8687a", "#272452"], ["#6e4660", "#0d0f26"]],
    }),
    light: pal({
      sky: ["#cfd3ff", "#e3c8ee", "#f6c3d4", "#ffd0b8", "#ffe3b0", "#fff1cf"],
      sun: "#fffbe6", glow: "#ffc15e", bird: "#4a3c78", ink: -0.16,
      ridges: [["#fff1e6", "#e2c4dc"], ["#ffe0d6", "#c9a9d6"], ["#f6c9c4", "#a98fc4"], ["#e0a9b8", "#8672b0"], ["#c08aa6", "#5f4f92"]],
    }),
  };
  const RIDGES = [ // línea base (0 arriba, 1 abajo), amplitud, frecuencia, velocidad
    [0.52, 0.07, 3.0, 0.004], [0.6, 0.08, 4.1, 0.007], [0.68, 0.09, 5.3, 0.011], [0.78, 0.1, 6.7, 0.016], [0.88, 0.1, 8.2, 0.022],
  ];
  const HORIZON = 0.74, SUN = [0.7, 0.44, 0.12];
  const GLYPHS = "  ..:-=+*#%^";

  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  const noise = (x) => Math.sin(x) * 0.5 + Math.sin(x * 2.3 + 1.7) * 0.3 + Math.sin(x * 5.1 + 4.2) * 0.2;

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const stillQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Dibujar miles de caracteres por cuadro es caro. Por eso el color de cada celda va en una
  // imagen de 1 px por celda (`cells`), que se estira sin suavizado, y los caracteres van en
  // una capa fija (`glyphs`) que se pinta una vez por tamaño y por paleta.
  const cells = document.createElement("canvas"), glyphs = document.createElement("canvas");
  let canvas = null, ctx = null, cellCtx = null, image = null, cols = 0, rows = 0, last = 0, drawnStill = false, glyphsDark = null;

  // hx-boost reemplaza el <canvas> en cada navegación: se vuelve a buscar y a medir.
  function attach() {
    const el = document.getElementById("site-bg");
    if (!el) return false;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return false;
    if (el === canvas && el.width === w && el.height === h) return true;
    canvas = el;
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext("2d");
    cols = Math.ceil(w / CW);
    rows = Math.ceil(h / CH);
    cells.width = cols;
    cells.height = rows;
    cellCtx = cells.getContext("2d");
    image = cellCtx.createImageData(cols, rows);
    drawnStill = false;
    glyphsDark = null;
    return true;
  }

  function paintGlyphs(dark, p) {
    glyphs.width = cols * CW;
    glyphs.height = rows * CH;
    const g = glyphs.getContext("2d");
    g.font = `${CH - 3}px ui-monospace, Consolas, Menlo, monospace`;
    g.textBaseline = "top";
    g.fillStyle = p.ink > 0 ? `rgba(255,255,255,${p.ink})` : `rgba(27,31,77,${-p.ink})`;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const ch = GLYPHS[(hash(x, y) * GLYPHS.length) | 0];
      if (ch !== " ") g.fillText(ch, x * CW + 1, y * CH + 2);
    }
    glyphsDark = dark;
  }

  function draw(t) {
    const dark = darkQuery.matches, p = dark ? PALETTES.dark : PALETTES.light;
    if (glyphsDark !== dark) paintGlyphs(dark, p);
    const aspect = canvas.width / canvas.height;
    const sunR = SUN[2] * (1 + 0.03 * Math.sin(t * 0.8));
    const data = image.data;

    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const tops = RIDGES.map((r, i) => r[0] + r[1] * noise(u * r[2] + t * r[3] * 10 + i * 7.3));
      for (let y = 0; y < rows; y++) {
        const v = y / rows;
        let color, ridge = -1;
        for (let i = RIDGES.length - 1; i >= 0; i--) if (v > tops[i]) { ridge = i; break; }
        if (ridge >= 0) {
          color = mix(p.ridges[ridge][0], p.ridges[ridge][1], Math.min(1, (v - tops[ridge]) / 0.08));
        } else {
          const k = Math.min(1, v / HORIZON) * (p.sky.length - 1);
          const i = Math.min(p.sky.length - 2, k | 0);
          color = mix(p.sky[i], p.sky[i + 1], k - i);
          const d = Math.hypot((u - SUN[0]) * aspect, v - SUN[1]);
          color = d < sunR ? p.sun : mix(color, p.glow, Math.max(0, 1 - d / (sunR * 3.2)) * 0.55);
        }
        const o = (y * cols + x) * 4;
        data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; data[o + 3] = 255;
      }
    }
    cellCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cells, 0, 0, cols * CW, rows * CH);
    ctx.drawImage(glyphs, 0, 0);

    ctx.font = `${CH - 3}px ui-monospace, Consolas, Menlo, monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = `rgb(${p.bird})`;
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 0.012 * (i + 2) + i * 0.31) % 1) * cols;
      const by = (0.16 + 0.07 * i + 0.012 * Math.sin(t * 0.9 + i * 2)) * rows;
      ctx.fillText(Math.sin(t * 3 + i) > 0 ? "v" : "~", (bx | 0) * CW + 1, (by | 0) * CH + 2);
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (now - last < 1000 / FPS) return;
    last = now;
    if (!attach()) return;
    if (stillQuery.matches) { // sin animación: un solo cuadro por tamaño y por paleta
      if (!drawnStill) { draw(0); drawnStill = true; }
      return;
    }
    draw(now / 1000);
  }

  darkQuery.addEventListener("change", () => { drawnStill = false; });
  requestAnimationFrame(tick);
})();
