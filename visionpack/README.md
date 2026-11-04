# Demeter VisionPack

Este repositorio respalda el ecosistema de misión que rodea el pipeline
`Eyes_Of_Demeter`: scripts de captura, telemetría y comunicaciones, integración
con LilyGO, configuración de la Raspberry Pi, documentación y metadatos de
captura en `demeter_lab/` y `demeter_recording/`. El pipeline de imagen mantiene
su propio repositorio, `eyes_of_demeter/`, y no se anida ni duplica aquí.

Se excluyen streams RAW/PISP, estadísticas binarias, matrices NumPy, imágenes,
vídeos, builds y configuración privada del usuario. Los JSON, CSV y logs de
mision permanecen versionables. Las carpetas operacionales vacías se conservan
con `.gitkeep`; los archivos capturados permanecen locales.

Este repositorio se publica por separado en
`https://github.com/ptilanom/Demeter_VisionPack`; no enviar su contenido al
remoto de `Eyes_Of_Demeter`.

Consulta `demeter_lab/README.txt` y `demeter_recording/README.txt` para el mapa
de carpetas y el flujo de operación.