// FinanSY: mejoras progresivas de los formularios. Sin JavaScript todo sigue funcionando:
// el servidor valida y calcula; aquí solo se adelanta lo que el usuario verá.
// Los eventos van delegados en `document` para sobrevivir a la navegación con hx-boost.
(function () {
  "use strict";

  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 0;
  const clp = (n) => "$" + Math.round(n).toLocaleString("es-CL");
  const longDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} de ${MONTHS[m - 1]} de ${y}`;
  };
  const pct = (part, whole) => (whole > 0 && part > 0 ? Math.min(100, Math.floor((part * 100) / whole)) : 0);

  // Montos con separador de miles mientras se escribe («1200000» → «1.200.000»).
  function formatMoney(input) {
    const n = digits(input.value);
    const formatted = n ? n.toLocaleString("es-CL") : "";
    if (input.value !== formatted) input.value = formatted;
  }

  // «Crear un jarrón»: la tarjeta de la derecha refleja lo que se va escribiendo.
  function updateNewJar(form) {
    const name = form.querySelector('[name="name"]').value.trim();
    const goal = digits(form.querySelector('[name="goal"]').value);
    const date = form.querySelector('[name="target_date"]').value;
    const trip = form.querySelector('[name="category"]').value === "viaje";
    form.querySelector('[data-show="name"]').textContent = name || "Tu nuevo jarrón";
    form.querySelector('[data-show="goal"]').textContent = clp(goal);
    form.querySelector('[data-show="date"]').textContent = date
      ? (trip ? "Nos vamos el " : "Meta para el ") + longDate(date)
      : "Elige una fecha para la meta";
  }

  // «Registrar ahorro»: botón, montos sugeridos y «Así quedará el jarrón».
  function updateContribute(root) {
    const goal = Number(root.dataset.goal);
    const total = Number(root.dataset.total);
    const mine = Number(root.dataset.mine);
    const amount = digits(root.querySelector("[data-amount]").value);
    const next = total + amount;
    root.querySelector("[data-proj-total]").textContent = clp(next);
    root.querySelector("[data-proj-pct]").textContent = pct(next, goal) + "%";
    root.querySelector("[data-proj-mine]").textContent = clp(mine + amount);
    root.querySelector("[data-submit-label]").textContent = amount ? "Registrar " + clp(amount) : "Registrar ahorro";
    root.querySelectorAll("[data-set-amount]").forEach((b) => b.classList.toggle("is-selected", Number(b.dataset.setAmount) === amount));

    const text = root.querySelector("[data-proj-text]");
    const group = root.hasAttribute("data-group");
    if (!amount) {
      text.textContent = "Escribe un monto para ver cuánto avanza" + (group ? " el jarrón." : " tu meta.");
      return;
    }
    const points = pct(next, goal) - pct(total, goal);
    const reached = next >= goal;
    const sum = points > 0
      ? `Tu registro suma ${points} punto${points === 1 ? "" : "s"} ${group ? "al avance de todos" : "a tu meta"}.`
      : `Tu registro suma ${group ? "al avance de todos" : "a tu meta"}.`;
    text.textContent = sum + (reached ? (group ? " ¡Llegan a la meta!" : " ¡Llegas a la meta!") : " ¡La meta está cada vez más cerca!");
  }

  function updateCounter(textarea) {
    const counter = textarea.parentElement.querySelector("[data-counter]");
    if (counter) counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
  }

  function refresh(target) {
    const newJar = target.closest("[data-new-jar]");
    if (newJar) updateNewJar(newJar);
    const contribute = target.closest("[data-contribute]");
    if (contribute) updateContribute(contribute);
  }

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-money]")) formatMoney(t);
    if (t.matches("[data-count]")) updateCounter(t);
    refresh(t);
  });
  document.addEventListener("change", (e) => refresh(e.target));

  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-set-amount]");
    if (!chip) return;
    const input = chip.closest("[data-contribute]").querySelector("[data-amount]");
    input.value = Number(chip.dataset.setAmount).toLocaleString("es-CL");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });

  // Fondo animado de la portada: la pieza ASCII tiene columnas y filas fijas y se dibuja a 12 px;
  // se escala con transform para cubrir todo el contenedor (como background-size: cover),
  // sin reiniciar la animación al cambiar el tamaño de la ventana.
  let charRatio = 0;
  function coverArt(box) {
    const art = box.querySelector("[data-cover]");
    if (!art) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && !art.hasAttribute("still")) art.setAttribute("still", "");
    const fit = () => {
      if (!charRatio) {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = '100px Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
        charRatio = ctx.measureText("M").width / 100 || 0.6;
      }
      const base = 12, cols = Number(art.dataset.cols), rows = Number(art.dataset.rows);
      const k = Math.max(box.clientWidth / (cols * charRatio * base), box.clientHeight / (rows * base)) * 1.02;
      art.style.transform = `translate(-50%, -50%) scale(${k.toFixed(3)})`;
    };
    fit();
    if (!box.coverObserver) {
      box.coverObserver = new ResizeObserver(fit);
      box.coverObserver.observe(box);
    }
  }

  function init() {
    document.querySelectorAll("[data-cover-box]").forEach(coverArt);
    document.querySelectorAll("[data-new-jar]").forEach(updateNewJar);
    document.querySelectorAll("[data-contribute]").forEach(updateContribute);
    document.querySelectorAll("[data-count]").forEach(updateCounter);
  }
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("htmx:afterSettle", init);
})();
