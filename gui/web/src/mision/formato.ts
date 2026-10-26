// Formato de números y tiempos de la web (02 §5): coma decimal, sin separador de miles.
const SEGUNDOS_POR_MIN = 60;
const SEGUNDOS_POR_HORA = 3600;
const MS_POR_S = 1000;

/** `9.2` -> `"9,2"`. Un valor que redondea a cero no lleva signo (`−0,0` no existe). */
export function numero(valor: number, decimales = 0): string {
  const redondeado = Number(valor.toFixed(decimales));
  return (redondeado === 0 ? 0 : valor).toFixed(decimales).replace(".", ",").replace("-", "−");
}

const dos = (n: number) => String(n).padStart(2, "0");

/** T+ en `mm:ss` (o `h:mm:ss` pasada la hora); `--:--` si aún no hay despegue. */
export function tMas(segundos: number | null): string {
  if (segundos === null || segundos < 0) return "T+ --:--";
  const s = Math.floor(segundos);
  const horas = Math.floor(s / SEGUNDOS_POR_HORA);
  const min = Math.floor((s % SEGUNDOS_POR_HORA) / SEGUNDOS_POR_MIN);
  const seg = s % SEGUNDOS_POR_MIN;
  return horas > 0 ? `T+ ${horas}:${dos(min)}:${dos(seg)}` : `T+ ${dos(min)}:${dos(seg)}`;
}

/** Antigüedad legible: `"hace 38 s"`. */
export function hace(ms: number): string {
  const s = Math.max(0, Math.floor(ms / MS_POR_S));
  if (s < SEGUNDOS_POR_MIN) return `hace ${s} s`;
  return `hace ${Math.floor(s / SEGUNDOS_POR_MIN)} min`;
}
