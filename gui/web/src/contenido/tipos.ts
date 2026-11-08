// Forma del contenido de una misión. T-622 la define y T-623 la llena con los textos reales.
// Todo lo que cambia entre misiones (textos, fotos, integrantes) vive aquí, no en los componentes.
import type { Mision } from "../contrato/tipos";

export interface Parte {
  id: string;
  nombre: string;
  /** URL del ícono ilustrativo de la misión (T-621, D-W20). Sin ícono, el chip solo lleva el texto. */
  icono?: string;
  /** De 1 a 3 frases (03 §3.1, PEN-W03). */
  texto: string;
}

export interface Foto {
  /** URL de la imagen; `null` muestra el placeholder digno (PEN-W01). */
  src: string | null;
  /** Texto alternativo (02 §10). */
  alt: string;
  pie: string;
  /** `true` para fotos con fondo transparente (el cohete): se ven completas, sin recortar. */
  contener?: boolean;
}

export interface Integrante {
  /** Como sale en el parche. */
  apellido: string;
  /** Nombre completo y rol: pendientes (PEN-W02). */
  nombre: string | null;
  rol: string | null;
}

/**
 * Lo que la página dice de su simulación (T-635, T-637). Es texto de la misión porque NO es igual:
 * la de Deméter sale de OpenRocket y la de Hermes es un vuelo de ejemplo con datos sintéticos.
 */
export interface TextoSimulacion {
  /** Aviso junto al botón "Ver la simulación del vuelo": de dónde salen los datos y que no son reales. */
  nota: string;
  /** Texto del banner fijo mientras corre la simulación (siempre empieza con "Simulación:"). */
  banner: string;
}

export interface Contenido {
  mision: Mision;
  nombre: string;
  lema: string;
  /** Una frase de qué hace la misión (03 §3.1). */
  frase: string;
  /** Según `MOTORES` de constantes.md. */
  motor: string;
  /** Los textos de la simulación para el público (botón y banner). */
  simulacion: TextoSimulacion;
  /** Parche pequeño (barra de misión) y grande (Equipo). */
  /** La miniatura del cohete (128 px, con transparencia) para la vista 3D del mapa (T-656). */
  coheteMapa?: string;
  parcheChico: string;
  parcheGrande: string;
  /** Carrusel de Inicio: las fotos del cohete (la del equipo va aparte, en `fotoEquipo`; T-646). */
  fotos: Foto[];
  /** La foto del equipo, en la sección Equipo junto al parche (T-646). */
  fotoEquipo: Foto;
  partes: Parte[];
  integrantes: Integrante[];
  /** El enlace del pie: solo navega, no precarga nada de la otra misión (03 §3.11). */
  otra: { nombre: string; href: string };
}
