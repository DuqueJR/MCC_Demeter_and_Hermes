// T-636: el botón de la simulación también en "Cargando" y "Sin servidor" mientras no haya relay
// (interruptor TEMPORAL `SIMULACION_SIEMPRE_VISIBLE`, datos/parametros.ts).
//
// - La regla pura se prueba con los DOS valores del interruptor (se pasa por argumento).
// - Las pruebas con signals y control usan el valor real del archivo: las de "interruptor activo" se
//   omiten si alguien lo pone en `false`, y las de "interruptor apagado" se omiten si está en `true`.
//   Así revertirlo no obliga a tocar las pruebas.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RUTA_DESTINO } from "../scripts/generar-simulacion.mjs";
import {
  estacionEjemplo,
  estadoEjemplo,
  saludEjemplo,
  snapshotEjemplo,
  snapshotVacioEjemplo,
} from "../src/contrato/ejemplos";
import * as api from "../src/datos/api";
import { SIMULACION_SIEMPRE_VISIBLE } from "../src/datos/parametros";
import { faseSimulacion, iniciarSimulacion, salirDeSimulacion } from "../src/simulacion/control";
import { simulacionDisponible, simulacionOfrecida } from "../src/simulacion/disponible";
import type { Guion } from "../src/simulacion/guion";
import { limpiarEstado, TiempoFalso } from "./ayuda_cliente";

const guionReal = JSON.parse(readFileSync(RUTA_DESTINO, "utf8")) as Guion;
const sinPlano = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const PRINCIPALES = [
  "cargando",
  "sin_transmision",
  "en_vivo",
  "senal_debil",
  "sin_senal",
  "sin_servidor",
] as const;

describe("simulacionDisponible (regla pura)", () => {
  it("interruptor apagado: exactamente T-635, solo en 'sin transmisión'", () => {
    for (const principal of PRINCIPALES) {
      for (const hayDatoReal of [false, true]) {
        expect(simulacionDisponible({ principal, hayDatoReal }, false)).toBe(
          principal === "sin_transmision",
        );
      }
    }
  });

  it("interruptor activo, sin datos reales: 'cargando', 'sin servidor' y 'sin transmisión'", () => {
    const ofrece = PRINCIPALES.filter((principal) =>
      simulacionDisponible({ principal, hayDatoReal: false }, true),
    );
    expect(ofrece).toEqual(["cargando", "sin_transmision", "sin_servidor"]);
  });

  it("interruptor activo, con datos reales: nunca en 'cargando' ni 'sin servidor'", () => {
    expect(simulacionDisponible({ principal: "cargando", hayDatoReal: true }, true)).toBe(false);
    expect(simulacionDisponible({ principal: "sin_servidor", hayDatoReal: true }, true)).toBe(
      false,
    );
  });

  it("nunca en en_vivo, señal débil ni sin señal, con cualquier interruptor y dato", () => {
    for (const principal of ["en_vivo", "senal_debil", "sin_senal"] as const) {
      for (const siempre of [false, true]) {
        for (const hayDatoReal of [false, true]) {
          expect(simulacionDisponible({ principal, hayDatoReal }, siempre)).toBe(false);
        }
      }
    }
  });

  it("el valor por defecto es el del interruptor del archivo", () => {
    for (const principal of PRINCIPALES) {
      expect(simulacionDisponible({ principal, hayDatoReal: false })).toBe(
        simulacionDisponible({ principal, hayDatoReal: false }, SIMULACION_SIEMPRE_VISIBLE),
      );
    }
  });
});

describe("el botón y el control con las signals reales", () => {
  let tiempo: TiempoFalso;
  const entorno = () => ({ ahoraMs: () => tiempo.ahora, programar: tiempo.programar });
  const cargarOk = async () => guionReal;

  beforeEach(() => {
    salirDeSimulacion();
    limpiarEstado();
    tiempo = new TiempoFalso();
    tiempo.ahora = 1000;
  });
  afterEach(() => {
    salirDeSimulacion();
  });

  it("recién abierta la página ('cargando'), sin datos", () => {
    expect(api.estadoPagina.value.principal).toBe("cargando");
    expect(simulacionOfrecida.value).toBe(SIMULACION_SIEMPRE_VISIBLE);
  });

  it("sin servidor y sin datos (relay sin desplegar)", () => {
    api.alimentar.conexion("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    expect(simulacionOfrecida.value).toBe(SIMULACION_SIEMPRE_VISIBLE);
  });

  it("'sin transmisión' siempre la ofrece, con el interruptor que sea", () => {
    api.alimentar.snapshot(sinPlano(snapshotVacioEjemplo), tiempo.ahora);
    api.alimentar.conexion("conectado");
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
    expect(simulacionOfrecida.value).toBe(true);
  });

  it("un latido vacío de la estación (sin paquete del cohete) no cuenta como dato real", () => {
    api.alimentar.conexion("reconectando");
    api.alimentar.estacion({ ...estacionEjemplo, ultimo_paquete_hace_ms: null }, tiempo.ahora);
    expect(simulacionOfrecida.value).toBe(SIMULACION_SIEMPRE_VISIBLE);
  });

  it("con datos del cohete y el servidor caído, no la ofrece (el último dato se conserva)", () => {
    api.alimentar.snapshot(sinPlano(snapshotEjemplo), tiempo.ahora);
    api.alimentar.conexion("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    expect(simulacionOfrecida.value).toBe(false);
  });

  it("un solo estado, una sola salud o un solo evento bastan para no ofrecerla", () => {
    api.alimentar.conexion("reconectando");
    api.alimentar.salud(saludEjemplo);
    expect(simulacionOfrecida.value).toBe(false);
    limpiarEstado();
    api.alimentar.conexion("cargando");
    api.alimentar.estado(estadoEjemplo);
    expect(simulacionOfrecida.value).toBe(false);
  });

  it("con datos en vivo (en_vivo, señal débil, sin señal) nunca la ofrece", () => {
    api.alimentar.snapshot(sinPlano(snapshotEjemplo), tiempo.ahora);
    api.alimentar.conexion("conectado");
    for (const edadMs of [0, 3000, 38_000]) {
      api.alimentar.estacion({ ...estacionEjemplo, ultimo_paquete_hace_ms: edadMs }, tiempo.ahora);
      api.alimentar.reloj(tiempo.ahora);
      expect(api.estadoPagina.value.principal).not.toBe("sin_transmision");
      expect(simulacionOfrecida.value).toBe(false);
    }
  });

  it.skipIf(!SIMULACION_SIEMPRE_VISIBLE)(
    "en 'sin servidor' sin datos: arranca, vuelve a 'sin servidor' al salir y se puede repetir",
    async () => {
      api.alimentar.conexion("reconectando");
      await iniciarSimulacion(cargarOk, entorno());
      expect(faseSimulacion.value).toBe("corriendo");
      expect(api.meta.value?.modo).toBe("simulacion");
      expect(api.estadoPagina.value.simulacion).toBe(true);
      expect(api.estadoPagina.value.principal).not.toBe("sin_servidor");

      salirDeSimulacion();
      expect(faseSimulacion.value).toBe("inactiva");
      expect(api.estado.value).toBeNull();
      expect(api.meta.value).toBeNull();
      expect(api.estadoPagina.value.principal).toBe("sin_servidor");
      expect(api.estadoPagina.value.simulacion).toBe(false);
      expect(simulacionOfrecida.value).toBe(true);
      expect(tiempo.pendientes).toBe(0);

      await iniciarSimulacion(cargarOk, entorno());
      expect(faseSimulacion.value).toBe("corriendo");
    },
  );

  it.skipIf(!SIMULACION_SIEMPRE_VISIBLE)(
    "en 'cargando' sin datos: arranca la simulación y al salir sigue 'cargando'",
    async () => {
      await iniciarSimulacion(cargarOk, entorno());
      expect(faseSimulacion.value).toBe("corriendo");
      salirDeSimulacion();
      expect(api.estadoPagina.value.principal).toBe("cargando");
      expect(simulacionOfrecida.value).toBe(true);
    },
  );

  it.skipIf(!SIMULACION_SIEMPRE_VISIBLE)(
    "si mientras descarga llega un dato real con el servidor caído, no se simula nada",
    async () => {
      api.alimentar.conexion("reconectando");
      let liberar: () => void = () => {};
      const lenta = () =>
        new Promise<Guion>((resolver) => {
          liberar = () => resolver(guionReal);
        });
      const promesa = iniciarSimulacion(lenta, entorno());
      api.alimentar.estado(estadoEjemplo); // llegó un dato real (T-636: el cohete ya transmite)
      liberar();
      await promesa;
      expect(faseSimulacion.value).toBe("inactiva");
      expect(api.estadoPagina.value.simulacion).toBe(false);
    },
  );

  it.skipIf(SIMULACION_SIEMPRE_VISIBLE)(
    "interruptor apagado ('cargando' y 'sin servidor'): ni se ofrece ni arranca (T-635)",
    async () => {
      expect(simulacionOfrecida.value).toBe(false);
      await iniciarSimulacion(cargarOk, entorno());
      expect(faseSimulacion.value).toBe("inactiva");
      api.alimentar.conexion("reconectando");
      expect(simulacionOfrecida.value).toBe(false);
    },
  );
});
