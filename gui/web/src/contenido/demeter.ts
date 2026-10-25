// Contenido de Deméter. PROVISIONAL: los textos reales son de T-623 (PEN-W02 y PEN-W03).
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
    { id: "nariz", nombre: "Nariz", texto: "La punta del cohete. Corta el aire al subir." },
    { id: "cansat", nombre: "CanSat", texto: "La carga útil de la competencia, de 250 a 300 g." },
    {
      id: "visionpack",
      nombre: "VisionPack",
      texto: "Los ojos de Deméter: las cámaras que graban el vuelo.",
    },
    { id: "motor", nombre: "Motor", texto: "H135W-8: empuja al cohete hasta cerca de 670 m." },
    {
      id: "paracaidas",
      nombre: "Paracaídas",
      texto: "Se abre con la carga de eyección del motor.",
    },
    { id: "aletas", nombre: "Aletas", texto: "Mantienen al cohete derecho mientras sube." },
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
