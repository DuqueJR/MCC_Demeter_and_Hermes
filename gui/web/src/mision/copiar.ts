// Copiar texto al portapapeles (T-625). Primero la API moderna; si no existe (página sin HTTPS, un
// navegador viejo) o la rechaza, el respaldo clásico con un `<textarea>` y `execCommand("copy")`.
// Devuelve el resultado: la interfaz avisa "copiado" o explica cómo copiar a mano. Nunca lanza.

export type ResultadoCopia = "copiado" | "fallo";

/** El respaldo clásico. Debe correr dentro del gesto del usuario (el toque del botón). */
function copiarConSeleccion(texto: string): boolean {
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  // Fuera de la vista y con 16 px: en iOS un campo menor a 16 px hace zoom al enfocarlo.
  area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, texto.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export async function copiarTexto(texto: string): Promise<ResultadoCopia> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return "copiado";
    }
  } catch {
    // Permiso denegado o contexto no seguro: se intenta el respaldo.
  }
  return copiarConSeleccion(texto) ? "copiado" : "fallo";
}
