// Corre Python 3 desde la raíz del repo, igual en Windows y en macOS (T-614).
// En Windows el comando suele ser `python` (o `py`); en macOS y Linux, `python3`.
// Uso: node scripts/python.mjs <argumentos de python>
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATOS = [["python3"], ["python"], ["py", "-3"]];

// Un candidato sirve si responde y es Python 3 (descarta el atajo vacío de la Tienda de Windows).
function esPython3([cmd, ...previos]) {
  const r = spawnSync(
    cmd,
    [...previos, "-c", "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)"],
    { stdio: "ignore" },
  );
  return r.status === 0;
}

const elegido = CANDIDATOS.find(esPython3);
if (!elegido) {
  console.error(
    "No encontré Python 3 (probé python3, python y py -3). Instálalo desde https://www.python.org/ y reabre la terminal.",
  );
  process.exit(1);
}
const [cmd, ...previos] = elegido;
const r = spawnSync(cmd, [...previos, ...process.argv.slice(2)], { cwd: raiz, stdio: "inherit" });
process.exit(r.status ?? 1);
