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
}

export interface Integrante {
  /** Como sale en el parche. */
  apellido: string;
  /** Nombre completo y rol: pendientes (PEN-W02). */
  nombre: string | null;
  rol: string | null;
}

export interface Contenido {
  /** `true` mientras los textos no los revise el usuario (T-623, PEN-W02 y PEN-W03). */
  provisional: boolean;
  mision: Mision;
  nombre: string;
  lema: string;
  /** Una frase de qué hace la misión (03 §3.1). */
  frase: string;
  /** Según `MOTORES` de constantes.md. */
  motor: string;
  /** Parche pequeño (barra de misión) y grande (Equipo). */
  parcheChico: string;
  parcheGrande: string;
  fotos: Foto[];
  partes: Parte[];
  integrantes: Integrante[];
  /** El enlace del pie: solo navega, no precarga nada de la otra misión (03 §3.11). */
  otra: { nombre: string; href: string };
}
