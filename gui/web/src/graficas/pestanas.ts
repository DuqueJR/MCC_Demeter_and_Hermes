// Navegación por teclado de las pestañas (patrón WAI-ARIA "tabs" con activación automática):
// flechas izquierda/derecha (con vuelta), Inicio y Fin. Función pura.

/** El índice al que se pasa con `tecla`, o `null` si la tecla no mueve las pestañas. */
export function pestanaConTecla(actual: number, tecla: string, total: number): number | null {
  if (total <= 0) return null;
  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return (actual + 1) % total;
    case "ArrowLeft":
    case "ArrowUp":
      return (actual - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}
