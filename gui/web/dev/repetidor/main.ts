// Línea de comandos del repetidor de desarrollo (T-630).
//   npm run repetidor -- demeter nominal
//   npm run repetidor -- todas lkp_descenso --velocidad 5
// Ver el README.md de esta carpeta. Escucha en http://127.0.0.1:8787 (REPETIDOR_PUERTO).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Mision } from "../../src/contrato/tipos.ts";
import { REPETIDOR_HOST, REPETIDOR_PUERTO } from "./constantes.ts";
import { crearRepetidor } from "./servidor.ts";

const MISIONES: readonly Mision[] = ["demeter", "hermes"];
const CARPETA_DATOS = join(import.meta.dirname, "..", "datos");

const AYUDA = `Repetidor de desarrollo de la web (T-630): sirve snapshot y stream (SSE) desde un JSONL de dev/datos/.

Uso: npm run repetidor -- [mision] [escenario] [opciones]
  mision      demeter | hermes | todas   (por defecto: todas)
  escenario   nominal, lkp_descenso, descenso_rapido, backfill, espera_rampa, relay_caido
              (por defecto: nominal)
Opciones:
  --puerto N      puerto (por defecto ${REPETIDOR_PUERTO})
  --host H        dirección (por defecto ${REPETIDOR_HOST}; 0.0.0.0 para un celular en la misma red)
  --velocidad X   factor del tiempo (por defecto 1; 10 = diez veces más rápido)
  --datos CARPETA carpeta de los .jsonl (por defecto dev/datos)
`;

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    puerto: { type: "string", default: String(REPETIDOR_PUERTO) },
    host: { type: "string", default: REPETIDOR_HOST },
    velocidad: { type: "string", default: "1" },
    datos: { type: "string", default: CARPETA_DATOS },
    ayuda: { type: "boolean", default: false },
  },
});
if (values.ayuda) {
  console.log(AYUDA);
  process.exit(0);
}

const [misionArg = "todas", escenario = "nominal"] = positionals;
if (misionArg !== "todas" && !MISIONES.includes(misionArg as Mision)) {
  salir(`Misión "${misionArg}" no válida: demeter, hermes o todas.\n\n${AYUDA}`);
}
const puerto = Number(values.puerto);
const velocidad = Number(values.velocidad);
if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535)
  salir(`Puerto no válido: ${values.puerto}`);
if (!(velocidad > 0)) salir(`Velocidad no válida: ${values.velocidad}`);

const archivos: Parameters<typeof crearRepetidor>[0]["archivos"] = {};
for (const m of misionArg === "todas" ? MISIONES : [misionArg as Mision]) {
  const ruta = join(values.datos, `${m}_${escenario}.jsonl`);
  if (!existsSync(ruta)) {
    const hay = existsSync(values.datos)
      ? readdirSync(values.datos).filter((f) => f.startsWith(`${m}_`) && f.endsWith(".jsonl"))
      : [];
    salir(
      `No existe ${ruta}\nEscenarios de ${m}: ${hay.map((f) => f.slice(m.length + 1, -6)).join(", ") || "(ninguno)"}`,
    );
  }
  archivos[m] = { escenario, ruta };
}

const repetidor = crearRepetidor({ archivos, velocidad });
try {
  await repetidor.escuchar(puerto, values.host);
} catch (e) {
  const err = e as NodeJS.ErrnoException;
  salir(
    err.code === "EADDRINUSE"
      ? `El puerto ${puerto} ya está en uso (¿otro repetidor?). Usa --puerto.`
      : `No pude escuchar en ${values.host}:${puerto}: ${err.message}`,
  );
}

for (const [m, r] of repetidor.reproductores) {
  console.log(
    `${m}/${escenario}: ${r.totalMensajes} mensajes, vuelta de ${(r.periodoMs / 1000).toFixed(1)} s` +
      (velocidad === 1 ? "" : ` (a ${velocidad}x)`),
  );
}
console.log(
  `Repetidor en http://${values.host}:${puerto}/api/v1/{mision}/snapshot | stream | /api/v1/salud`,
);
console.log("Ctrl+C para salir.");

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.once(senal, () => {
    void repetidor.cerrar().then(() => process.exit(0));
  });
}
