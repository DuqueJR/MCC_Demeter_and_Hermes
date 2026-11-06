// Contenido de Deméter.
// Dónde se apoya cada cifra:
// - Motor H135W-8: `MOTORES` de docs/02_requisitos/constantes.md.
// - CanSat de 250 a 300 g: `CANSAT_MASA_G` de constantes.md (es el rango del reglamento, no una medida).
// - Apogeo de unos 670 m sobre la rampa, combustión de unos 2 s, eyección a los 10 s de vuelo
//   (1,5 s antes del apogeo) y bajada de unos 9 m/s: docs/02_requisitos/perfiles_vuelo.md §1, que es
//   la simulación de OpenRocket (669 m AGL; 2,07 s; 10,07 s; -9,2 m/s). No son mediciones.
// - Recuperación solo por la carga de eyección del motor, sin despliegue electrónico: constantes.md.
// - VisionPack (Raspberry Pi 5 y 2 cámaras): docs/04_diseno/visionpack_integracion.md y 03 §3.9.
// El tono (se tutea, cercano, números exactos con su unidad) sale de 02_identidad_visual §9.

import cohete from "../assets/demeter/cohete.png?w=1000&format=webp";
import equipo from "../assets/demeter/equipo.jpg?w=1400&format=webp";
import iconoAletas from "../assets/demeter/iconos/aletas.png?w=96&format=webp";
import iconoCansat from "../assets/demeter/iconos/cansat.png?w=96&format=webp";
import iconoMotor from "../assets/demeter/iconos/motor.png?w=96&format=webp";
import iconoNariz from "../assets/demeter/iconos/nariz.png?w=96&format=webp";
import iconoParacaidas from "../assets/demeter/iconos/paracaidas.png?w=96&format=webp";
import iconoVisionpack from "../assets/demeter/iconos/visionpack.png?w=96&format=webp";
import parcheChico from "../assets/demeter/parche.png?w=128&format=webp";
import parcheGrande from "../assets/demeter/parche.png?w=512&format=webp";
import type { Contenido } from "./tipos";

export const demeter: Contenido = {
  mision: "demeter",
  nombre: "Deméter",
  lema: "La tierra que mira",
  frase:
    "Deméter sube con dos cámaras a bordo que graban el vuelo, mientras su CanSat cuenta por radio, en vivo, cómo va.",
  motor: "H135W-8",
  // Su guion sale de la simulación de OpenRocket (perfiles_vuelo.md §1).
  simulacion: {
    nota: "Mira cómo se verá esta página durante el vuelo, con un vuelo simulado de OpenRocket. No son datos reales.",
    banner: "Simulación: así será el vuelo",
  },
  parcheChico,
  parcheGrande,
  // Carrusel de Inicio: solo el cohete. La foto del equipo va en la sección Equipo (T-646).
  fotos: [{ src: cohete, alt: "El cohete Deméter", pie: "El cohete Deméter", contener: true }],
  fotoEquipo: { src: equipo, alt: "El equipo de Deméter", pie: "El equipo de Deméter" },
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
      id: "visionpack",
      nombre: "VisionPack",
      icono: iconoVisionpack,
      texto:
        "Los ojos de Deméter: una computadora Raspberry Pi 5 con dos cámaras. Está pensada para grabar la subida y, al llegar arriba, capturar imágenes del descenso.",
    },
    {
      id: "motor",
      nombre: "Motor",
      icono: iconoMotor,
      texto:
        "H135W-8: el motor que impulsa a Deméter. En la simulación empuja unos 2 segundos y el cohete sigue subiendo por inercia hasta unos 670 m sobre la rampa.",
    },
    {
      id: "paracaidas",
      nombre: "Paracaídas",
      icono: iconoParacaidas,
      texto:
        "Lo abre la carga de eyección del motor, sin electrónica de por medio. En la simulación ocurre a los 10 segundos de vuelo, un poco antes del punto más alto, y el cohete baja a unos 9 m/s.",
    },
    {
      id: "aletas",
      nombre: "Aletas",
      icono: iconoAletas,
      texto: "Mantienen al cohete derecho mientras sube, como las plumas de una flecha.",
    },
  ],
  integrantes: [
    { apellido: "Álvarez", nombre: null, rol: null },
    { apellido: "Arboleda", nombre: null, rol: null },
    { apellido: "Céspedes", nombre: null, rol: null },
    { apellido: "Tilano", nombre: null, rol: null },
    { apellido: "Duque", nombre: null, rol: null },
    { apellido: "Restrepo", nombre: null, rol: null },
  ],
  otra: { nombre: "Hermes", href: "/hermes/" },
};
