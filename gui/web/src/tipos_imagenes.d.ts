// Importaciones de imágenes con parámetros de vite-imagetools (`?w=512&format=webp`): devuelven la URL.
declare module "*&format=webp" {
  const url: string;
  export default url;
}
