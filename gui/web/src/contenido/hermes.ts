// Contenido de Hermes. PROVISIONAL: los textos reales son de T-623 (PEN-W02 y PEN-W03).
import parcheChico from "../assets/hermes/parche.png?w=128&format=webp";
import parcheGrande from "../assets/hermes/parche.png?w=512&format=webp";
import type { Contenido } from "./tipos";

export const hermes: Contenido = {
  provisional: true,
  mision: "hermes",
  nombre: "Hermes",
  lema: "El mensajero",
  frase: "Un cohete que es un mensaje que sube entre las nubes y cuenta cómo va, en vivo.",
  motor: "G80-7T",
  parcheChico,
  parcheGrande,
  fotos: [
    { src: null, alt: "El cohete Hermes", pie: "El cohete" },
    { src: null, alt: "El equipo de Hermes", pie: "El equipo" },
    { src: null, alt: "El CanSat de Hermes", pie: "El CanSat" },
  ],
  partes: [
    { id: "nariz", nombre: "Nariz", texto: "La punta del cohete. Corta el aire al subir." },
    { id: "cansat", nombre: "CanSat", texto: "La carga útil de la competencia, de 250 a 300 g." },
    { id: "motor", nombre: "Motor", texto: "G80-7T: empuja al cohete hacia el cielo." },
    {
      id: "paracaidas",
      nombre: "Paracaídas",
      texto: "Se abre con la carga de eyección del motor.",
    },
    { id: "aletas", nombre: "Aletas", texto: "Mantienen al cohete derecho mientras sube." },
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
