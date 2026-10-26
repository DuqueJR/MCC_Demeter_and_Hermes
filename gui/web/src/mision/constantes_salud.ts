// Constantes de firmware que la sección Salud necesita (T-625). Se replican de
// docs/02_requisitos/constantes.md con el MISMO nombre; `datos/constantes.ts` es solo de los `WEB_*`.
// Los marcados (P) son provisionales: se ajustan en constantes.md y aquí a la vez.

/**
 * Sección 4 de constantes.md (P): por debajo de este porcentaje la batería está "baja"
 * (protocolo_paquetes §3, bit 13 de `fallas`: "menos de BAT_MIN_ARM_PCT"). Es el umbral de ARM:
 * no hay otro umbral de batería en constantes.md.
 */
export const BAT_MIN_ARM_PCT = 60;
