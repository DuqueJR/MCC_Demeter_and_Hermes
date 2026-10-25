// Página de desarrollo de tokens (T-613): lee los tokens del CSS calculado y los muestra.
// No es código de producción ni entra al dist/.

const TEMAS = ["demeter", "hermes"];
const raiz = document.documentElement;

const COLORES = [
  "fondo",
  "superficie",
  "superficie-2",
  "linea",
  "texto",
  "texto-2",
  "acento",
  "marca-1",
  "marca-2",
  "marca-3",
];
// Tokens de texto/dato con contraste esperado en 02 §2 y §4.
const CONTRASTE = [
  "texto",
  "texto-2",
  "acento",
  "marca-2",
  "marca-3",
  "estado-ok",
  "estado-aviso",
  "estado-alarma",
  "estado-sin-dato",
  "estado-info",
];
const ESPACIOS = [1, 2, 3, 4, 5, 6, 7, 8];

const leer = (token) => getComputedStyle(raiz).getPropertyValue(`--${token}`).trim();

function luminancia(hex) {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const coma = (n) => n.toFixed(1).replace(".", ",");

function pintar() {
  const colores = document.getElementById("colores");
  colores.replaceChildren(
    ...COLORES.map((t) => {
      const d = document.createElement("div");
      d.className = "muestra";
      d.innerHTML = `<div class="cuadro" style="background: var(--${t})"></div>--${t}<small>${leer(t)}</small>`;
      return d;
    }),
  );

  const fondo = leer("fondo");
  const superficie = leer("superficie");
  document.querySelector("#contraste tbody").replaceChildren(
    ...CONTRASTE.map((t) => {
      const v = leer(t);
      const f = contraste(v, fondo);
      const s = contraste(v, superficie);
      const tr = document.createElement("tr");
      // La capa de Hermes (marca-3) está documentada como sin contraste: solo ilustración.
      tr.innerHTML = `<td style="color: var(--${t})">--${t}</td><td>${v}</td><td>${coma(f)}${f < 4.5 ? " ✗" : ""}</td><td>${coma(s)}${s < 4.5 ? " ✗" : ""}</td>`;
      return tr;
    }),
  );

  for (const [id, token] of [
    ["v-eia-teal", "eia-teal"],
    ["v-eia-cian", "eia-cian"],
    ["v-radio", "radio"],
    ["v-radio-tarjeta", "radio-tarjeta"],
    ["v-dur-rapida", "dur-rapida"],
    ["v-dur-media", "dur-media"],
    ["v-curva", "curva"],
    ["v-toque", "toque-min"],
  ]) {
    document.getElementById(id).textContent = leer(token);
  }
  document.getElementById("fuente-display").textContent = leer("fuente-display");
  document.getElementById("fuente-texto").textContent = leer("fuente-texto");

  document.getElementById("espacios").replaceChildren(
    ...ESPACIOS.map((n) => {
      const d = document.createElement("div");
      d.innerHTML = `<i style="width: var(--e-${n}); height: var(--e-${n})"></i>--e-${n}<br>${leer(`e-${n}`)}`;
      return d;
    }),
  );
}

function elegir(tema) {
  if (!TEMAS.includes(tema)) return;
  raiz.dataset.mision = tema;
  for (const b of document.querySelectorAll("[data-elegir]")) {
    b.setAttribute("aria-pressed", String(b.dataset.elegir === tema));
  }
  pintar();
}

for (const b of document.querySelectorAll("[data-elegir]")) {
  b.addEventListener("click", () => elegir(b.dataset.elegir));
}
document.getElementById("mover").addEventListener("click", () => {
  for (const p of document.querySelectorAll(".pista")) p.classList.toggle("corre");
});

elegir(new URLSearchParams(location.search).get("mision") ?? "demeter");
