# datos/

Datos de entrada del proyecto: simulaciones, y más adelante los logs de prueba de referencia. **Los archivos originales no se editan.** Si hace falta una versión procesada (remuestreada, con ruido), la genera una herramienta de `tools/` y se guarda aparte con el sufijo `_proc`.

## Catálogo

| Archivo | Cohete | Motor | Sitio | Fuente | Fecha | Análisis |
| --- | --- | --- | --- | --- | --- | --- |
| [`simulaciones/openrocket/demeter_H135W-8_santa-fe-antioquia_sim2.csv`](simulaciones/openrocket/demeter_H135W-8_santa-fe-antioquia_sim2.csv) | Demeter | H135W-8 (el retardo de 8 s se deduce de BURNOUT a 2,07 s y EJECTION_CHARGE a 10,07 s) | Santa Fe de Antioquia (6,582° N, −75,823° E, 510 m s.n.m.) | OpenRocket, "Simulation 2", exportación completa (58 variables, 454 puntos), entregada por el usuario | 2026-10-24 | [perfiles_vuelo.md](../docs/02_requisitos/perfiles_vuelo.md) |
| *(falta)* `simulaciones/openrocket/hermes_*.csv` | Hermes | G80-7T (por confirmar) | Santa Fe de Antioquia | Equipo de Hermes | — | — |

## Formato de las exportaciones de OpenRocket

- CSV separado por comas, **con decimal en punto**, codificado en UTF-8. Las líneas de comentario empiezan con `#`.
- **La cabecera de columnas es la línea `# Tiempo (s),…`.** Los nombres vienen en español, con unidades y algunos caracteres invisibles (U+200B en las columnas adimensionales).
- **Los eventos** van como comentarios: `# Event <NOMBRE> occurred at t=<s> seconds`. Son IGNITION, LAUNCH, LIFTOFF, LAUNCHROD, BURNOUT, EJECTION_CHARGE, APOGEE, RECOVERY_DEVICE_DEPLOYMENT y GROUND_HIT.
- **El paso de tiempo es variable** (de 0,004 a 0,5 s). Para el replay hay que **remuestrear** a la tasa de los sensores y agregar ruido (T-304).
- `NaN` significa que no hay dato (por ejemplo, la estabilidad después del apogeo).

## Exportar la simulación de Hermes

Ese archivo es el que falta, así que conviene exportarlo **igual**: en OpenRocket, "Export data" con todas las variables y los comentarios de eventos, con el sitio en Santa Fe de Antioquia y el motor real. Se guarda como `simulaciones/openrocket/hermes_<motor>_santa-fe-antioquia_simN.csv`.
