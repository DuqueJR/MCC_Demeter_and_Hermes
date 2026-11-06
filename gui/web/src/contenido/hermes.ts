// Contenido de Hermes.
// Dónde se apoya cada cifra:
// - Motor G80-7T: `MOTORES` de docs/02_requisitos/constantes.md.
// - CanSat de 250 a 300 g: `CANSAT_MASA_G` de constantes.md (es el rango del reglamento, no una medida).
// - Recuperación solo por la carga de eyección del motor, sin despliegue electrónico: constantes.md.
// - NO hay altura ni tiempos de vuelo de Hermes: docs/02_requisitos/perfiles_vuelo.md §2 dice que
//   falta la simulación del G80-7T (PEN-07, PEN-W04). Cuando exista, se agrega la altura al texto
//   del motor; hasta entonces no se inventa ninguna cifra.
// El tono (se tutea, cercano, números exactos con su unidad) sale de 02_identidad_visual §9.

import cohete from "../assets/hermes/cohete.png?w=1000&format=webp";
import equipo from "../assets/hermes/equipo.jpg?w=1400&format=webp";
import iconoAletas from "../assets/hermes/iconos/aletas.png?w=96&format=webp";
import iconoCansat from "../assets/hermes/iconos/cansat.png?w=96&format=webp";
import iconoMotor from "../assets/hermes/iconos/motor.png?w=96&format=webp";
import iconoNariz from "../assets/hermes/iconos/nariz.png?w=96&format=webp";
import iconoParacaidas from "../assets/hermes/iconos/paracaidas.png?w=96&format=webp";
import parcheChico from "../assets/hermes/parche.png?w=128&format=webp";
import parcheGrande from "../assets/hermes/parche.png?w=512&format=webp";
import type { Contenido } from "./tipos";

export const hermes: Contenido = {
  mision: "hermes",
  nombre: "Hermes",
  lema: "El mensajero",
  frase:
    "Hermes sube con un CanSat que mide el vuelo y lo cuenta por radio, en vivo, mientras el cohete se eleva.",
  motor: "G80-7T",
  // Su guion es SINTÉTICO (T-637): no hay simulación del G80-7T (PEN-07, PEN-W04), así que no se
  // dice "OpenRocket" ni "así será el vuelo", y no se da ninguna altura ni tiempo de Hermes.
  simulacion: {
    nota: "Mira cómo se verá esta página durante el vuelo, con un vuelo de ejemplo hecho con datos de muestra (sintéticos). No es un cálculo del motor G80-7T y no son datos reales: las alturas y los tiempos que verás no son los de Hermes.",
    banner: "Simulación: vuelo de ejemplo con datos de muestra",
  },
  parcheChico,
  parcheGrande,
  // Carrusel de Inicio: solo el cohete. La foto del equipo va en la sección Equipo (T-646).
  fotos: [{ src: cohete, alt: "El cohete Hermes", pie: "El cohete Hermes", contener: true }],
  fotoEquipo: { src: equipo, alt: "El equipo de Hermes", pie: "El equipo de Hermes" },
  partes: [
    {
      id: "nariz",
      nombre: "Nariz",
      icono: iconoNariz,
      texto: "La punta del cohete. Abre paso al aire para que la subida sea más fácil.",
    },
    {
      id: "cansat",
      nombre: "CanSat",
      icono: iconoCansat,
      texto:
        "La carga útil de la competencia: un pequeño computador de vuelo que mide la altura, el movimiento y la posición por GPS. Manda esos datos por radio a la estación en tierra. Por reglamento pesa entre 250 y 300 g.",
    },
    {
      id: "motor",
      nombre: "Motor",
      icono: iconoMotor,
      texto:
        "G80-7T: el motor que impulsa a Hermes hacia el cielo. Cuando se le acaba el empuje, el cohete sigue subiendo por inercia hasta el punto más alto.",
    },
    {
      id: "paracaidas",
      nombre: "Paracaídas",
      icono: iconoParacaidas,
      texto:
        "Lo abre la carga de eyección del motor, sin electrónica de por medio. Así lo exige el reglamento, y es lo que baja a Hermes y a su CanSat juntos.",
    },
    {
      id: "aletas",
      nombre: "Aletas",
      icono: iconoAletas,
      texto: "Mantienen al cohete derecho mientras sube, como las plumas de una flecha.",
    },
  ],
  integrantes: [
    { apellido: "Aristizábal", nombre: null, rol: null },
    { apellido: "Alzate", nombre: null, rol: null },
    { apellido: "Ferrin", nombre: null, rol: null },
    { apellido: "Jaramillo", nombre: null, rol: null },
    { apellido: "Londoño", nombre: null, rol: null },
    { apellido: "Naranjo", nombre: null, rol: null },
    { apellido: "Ramos", nombre: null, rol: null },
  ],
  otra: { nombre: "Deméter", href: "/demeter/" },
};
