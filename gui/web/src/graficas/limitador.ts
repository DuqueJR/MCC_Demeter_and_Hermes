// Limitador de refresco (T-633): la primera llamada corre al instante y las que lleguen mientras
// corre el tiempo de espera se juntan en UNA sola, al terminar la espera. Así la gráfica se
// redibuja a lo más cada `ms`, sin perder la última novedad. Los temporizadores se inyectan para
// probarlo sin esperar.

export interface Limitador {
  /** Pide una ejecución (ahora, o al final de la espera en curso). */
  llamar(): void;
  /** Cancela la espera y lo pendiente. */
  cancelar(): void;
}

type Programar = (fn: () => void, ms: number) => unknown;
type Cancelar = (id: unknown) => void;

export function limitar(
  fn: () => void,
  ms: number,
  programar: Programar = (f, m) => setTimeout(f, m),
  cancelar: Cancelar = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
): Limitador {
  let espera: unknown = null;
  let pendiente = false;

  const fin = () => {
    espera = null;
    if (!pendiente) return;
    pendiente = false;
    fn();
    espera = programar(fin, ms);
  };

  return {
    llamar() {
      if (espera !== null) {
        pendiente = true;
        return;
      }
      fn();
      espera = programar(fin, ms);
    },
    cancelar() {
      if (espera !== null) cancelar(espera);
      espera = null;
      pendiente = false;
    },
  };
}
