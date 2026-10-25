---
id: perfiles_vuelo
estado: vivo (Demeter: simulación recibida; Hermes: pendiente)
actualizado: 2026-10-24
fuentes: [datos/simulaciones/openrocket/demeter_H135W-8_santa-fe-antioquia_sim2.csv]
depende_de: [constantes, maquina_estados]
---
# Perfiles de vuelo simulados

Son los números de referencia para calibrar la máquina de estados, el estimador, el log y las pruebas de replay (P-03). Salen de la exportación de OpenRocket ([catálogo de `datos/`](../../datos/README.md)).
**No son mediciones:** sirven como orden de magnitud y como banco de pruebas.

## 1. Demeter: H135W-8 en Santa Fe de Antioquia (OpenRocket "Simulation 2")

### Condiciones

| Parámetro | Valor |
| --- | --- |
| Rampa | 6,582° N, −75,823° E, **510 m s.n.m.** |
| Atmósfera simulada | 31 °C, **1014,9 mbar en la rampa** (⚠️ ver §3), viento de 2,4 m/s desde 90° |
| Masa al despegue / final | **1468,7 g** / 1386,7 g, es decir, 82 g de propelente |
| Referencia aerodinámica | Diámetro de 8 cm, área de 50,27 cm² |

### Eventos

| Evento | t (s) | Notas |
| --- | --- | --- |
| Despegue (LIFTOFF) | 0,029 | |
| Salida del riel (LAUNCHROD) | 0,231 | **68 km/h** (mínimo del reglamento: 55). Estabilidad de **1,98 calibres** (⚠️ ver §3). |
| Velocidad máxima | 1,80 | **129 m/s**, Mach 0,37 |
| Fin de la combustión (BURNOUT) | **2,072** | |
| **Eyección (EJECTION_CHARGE)** | **10,072** | 8 s después del fin de la combustión. Está **a 659 m, subiendo a 14 m/s**: **1,46 s antes del apogeo** |
| **Apogeo** | **11,536** | **669 m AGL** (1179 m s.n.m.) |
| Despliegue del paracaídas en la sim. | 11,537 | ⚠️ En la sim. se configuró "al apogeo". En el vuelo real se abre con la eyección (10,07 s). |
| Aterrizaje (GROUND_HIT) | **85,08** | Deriva de 83 m hacia el oeste |

### Magnitudes para el diseño

| Magnitud | Valor sim. | Qué afecta | Estado |
| --- | --- | --- | --- |
| Aceleración máxima | ~10,1 g (99 m/s², en t = 0,014 s); empuje pico de 160 N; T/W máximo de 11,1 | Rango del acelerómetro: ±32 g sobra; se descarta ±16 g por los picos y la eyección | ✅ D-018 |
| Aceleración específica en el impulso | De unos 5 a 11 g | `LAUNCH_ACC_G` = 3 g, con margen amplio | ✅ |
| Desaceleración en la fase de inercia | Aceleración vertical de −2,4 a −1,0 g; es decir, el acelerómetro marca de −1,4 g a 0 g en el eje | `BURNOUT_ACC_G` = 0,5 g: cruza claro | ✅ |
| Impulso total / empuje medio | **229 N·s** / 112 N; combustión de 2,04 s | Referencia para caracterizar el motor (D-021) | ✅ |
| Velocidad vertical en la eyección | **+14 m/s** (subiendo) | **Valida la rama T10:** COAST → E1 → APOGEE → DESCENT, sin pasar por FREE_FALL | ✅ D-014 |
| Tiempo al apogeo | 11,5 s | El watchdog de ascenso de la Pi (15 s desde START_ASCENT) alcanza **si START_ASCENT se manda en BOOST** | ✅ D-023 |
| Descenso bajo el paracaídas | **−9,2 m/s** de media | ≤ 11 m/s (reglamento) ✅. **La alarma de 10 m/s queda a solo 0,8 m/s del valor nominal:** ver §4 | ⚠️ |
| Tiempo de vuelo | 85 s | Volumen del log: unos 85 s × 55 kB/s ≈ 4,7 MB a tasa completa. Backfill: unos 850 registros NAV (≈ 1,5 min) | ✅ |
| Rotación (roll) | ≈ 0 °/s | La simulación no modela giro: **no sirve para validar el rango del giroscopio** | — |

## 2. Hermes

**Motor: G80-7T (confirmado el 2026-10-24). Falta la simulación** (PEN-07).

## 3. Observaciones para el equipo de cohete (no son nuestras; las reportamos)

1. **La estabilidad al salir del riel es de 1,979 calibres, y el reglamento pide ≥ 2,0.** Está en el límite.
2. **La masa al despegue es de 1468,7 g.** La ficha de la Categoría 3 dice "masa máxima de 1200 g (con G80-7T)". Hay que confirmar cuál es el límite con el H135W.
3. **El despliegue del paracaídas está configurado "al apogeo"**, pero el reglamento solo permite la eyección del motor. Conviene configurarlo "con la carga de eyección" para que el descenso simulado sea realista: el paracaídas se abre 1,5 s antes, subiendo a 14 m/s.
4. **La presión en la rampa es de 1014,9 mbar a 510 m s.n.m.** La atmósfera estándar daría unos 955 hPa. Parece que se fijó la presión a nivel del mar como si fuera la del sitio. No cambia mucho la trayectoria, pero **los valores absolutos de presión de la sim. no se deben usar** para probar el barómetro: hay que usar las diferencias de altitud.

## 4. Implicaciones para nuestros contratos

- **La máquina de estados no cambia.** El caso "eyección antes del apogeo" ya está cubierto por D-014 y T10, y ahora es el **caso nominal de Demeter**. P-03 debe incluirlo como el primer caso.
- **`ALARMA_DESCENSO_MS`:** con un descenso nominal de 9,2 m/s, una alarma a 10 m/s puede dispararse por ráfagas o por ruido. **Propuesta:** subirla a 11 m/s, que es justo el límite del reglamento, con una ventana de 2 s. Es una decisión abierta: está en [pendientes](../05_plan/pendientes.md).
- **Sitio:** `SITIO` en las constantes pasa a 510 m s.n.m., con las coordenadas de la simulación.
- **T-304** (generador sintético) **debe aceptar esta exportación como entrada**: remuestrear, convertir al marco del cuerpo, agregar el ruido de los sensores según sus fichas y la gravedad, e inyectar el pico de la eyección y el de presión, porque OpenRocket no los modela.
