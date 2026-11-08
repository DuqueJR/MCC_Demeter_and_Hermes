// Los tipos mínimos de `pngjs` que usan las pruebas e2e (T-656): la biblioteca no trae los suyos.
declare module "pngjs" {
  export const PNG: {
    sync: { read(buffer: Buffer): { width: number; height: number; data: Uint8Array } };
  };
}
