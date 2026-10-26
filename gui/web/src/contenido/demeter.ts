// Contenido de Deméter. PROVISIONAL: los textos reales son de T-623 (PEN-W02 y PEN-W03).
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
  provisional: true,
  mision: "demeter",
  nombre: "Deméter",
  lema: "La tierra que mira",
  frase: "Un cohete que sube con una carga útil que mira: dos cámaras que graban el vuelo.",
  motor: "H135W-8",
  parcheChico,
  parcheGrande,
  fotos: [
    { src: null, alt: "El cohete Deméter", pie: "El cohete" },
    { src: null, alt: "El equipo de Deméter", pie: "El equipo" },
    { src: null, alt: "El CanSat de Deméter", pie: "El CanSat" },
    { src: null, alt: "El VisionPack de Deméter", pie: "El VisionPack" },
  ],
  partes: [
    {
      id: "nariz",
      nombre: "Nariz",
      icono: iconoNariz,
      texto: "La punta del cohete. Corta el aire al subir.",
    },
    {
      id: "cansat",
      nombre: "CanSat",
      icono: iconoCansat,
      texto: "La carga útil de la competencia, de 250 a 300 g.",
    },
    {
      id: "visionpack",
      nombre: "VisionPack",
      icono: iconoVisionpack,
      texto: "Los ojos de Deméter: las cámaras que graban el vuelo.",
    },
    {
      id: "motor",
      nombre: "Motor",
      icono: iconoMotor,
      texto: "H135W-8: empuja al cohete hasta cerca de 670 m.",
    },
    {
      id: "paracaidas",
      nombre: "Paracaídas",
      icono: iconoParacaidas,
      texto: "Se abre con la carga de eyección del motor.",
    },
    {
      id: "aletas",
      nombre: "Aletas",
      icono: iconoAletas,
      texto: "Mantienen al cohete derecho mientras sube.",
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
