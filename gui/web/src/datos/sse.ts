// Analizador de `text/event-stream` (SSE) por trozos. T-631.
// Se usa `fetch` en vez de `EventSource` porque `EventSource` no deja ver el 503 ni su `Retry-After`,
// y reconecta a su ritmo. Aquí solo se lee el formato; la reconexión es de `cliente.ts`.
//
// Reglas de la especificación que se respetan:
//   - fin de línea: `\n`, `\r` o `\r\n` (aunque el `\r\n` llegue partido entre dos trozos);
//   - una línea que empieza con `:` es un comentario (el `: ping` del latido) y se ignora;
//   - `data:` se acumula con `\n`; un evento se despacha en la línea vacía;
//   - se quita un solo espacio después de los dos puntos;
//   - un BOM al inicio del flujo se ignora.
// Lo que NO se usa: `retry:` (el cliente tiene su propio retroceso, 03 §4).

export interface EventoSse {
  /** Solo si el evento trajo su propio `id:`. `null` no mueve el cursor de `Last-Event-ID`. */
  id: string | null;
  /** El nombre de `event:`; vacío si no vino. */
  evento: string;
  datos: string;
}

export class AnalizadorSse {
  private resto = "";
  private inicio = true;
  /** Un `\r` cerró la línea al final del trozo: si el siguiente empieza con `\n`, es parte del mismo fin. */
  private saltarLf = false;
  private id: string | null = null;
  private evento = "";
  private datos: string[] = [];

  /** Procesa un trozo de texto (ya decodificado) y devuelve los eventos que quedaron completos. */
  alimentar(texto: string): EventoSse[] {
    let buf = this.resto + texto;
    this.resto = "";
    if (this.saltarLf && buf.length > 0) {
      this.saltarLf = false;
      if (buf[0] === "\n") buf = buf.slice(1);
    }
    if (this.inicio && buf.length > 0) {
      this.inicio = false;
      if (buf.charCodeAt(0) === 0xfeff) buf = buf.slice(1);
    }
    const salida: EventoSse[] = [];
    let desde = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c !== "\n" && c !== "\r") continue;
      const linea = buf.slice(desde, i);
      if (c === "\r") {
        // `\r\n` es un solo fin de línea; si el `\n` llega en el trozo siguiente, se salta allá.
        if (buf[i + 1] === "\n") i++;
        else if (i === buf.length - 1) this.saltarLf = true;
      }
      desde = i + 1;
      this.procesar(linea, salida);
    }
    this.resto = buf.slice(desde);
    return salida;
  }

  private procesar(linea: string, salida: EventoSse[]): void {
    if (linea === "") {
      // Un bloque con solo `id:` (sin datos) sirve para mover el cursor.
      if (this.datos.length > 0 || this.id !== null) {
        salida.push({ id: this.id, evento: this.evento, datos: this.datos.join("\n") });
      }
      this.id = null;
      this.evento = "";
      this.datos = [];
      return;
    }
    if (linea.startsWith(":")) return;
    const dosPuntos = linea.indexOf(":");
    const campo = dosPuntos < 0 ? linea : linea.slice(0, dosPuntos);
    let valor = dosPuntos < 0 ? "" : linea.slice(dosPuntos + 1);
    if (valor.startsWith(" ")) valor = valor.slice(1);
    switch (campo) {
      case "id":
        // Con un NUL el `id` se ignora (especificación). Es opaco: nunca se interpreta (D-W18).
        if (!valor.includes("\0")) this.id = valor;
        break;
      case "event":
        this.evento = valor;
        break;
      case "data":
        this.datos.push(valor);
        break;
      default:
        break; // `retry:` y campos desconocidos
    }
  }
}
