# Respaldo local de Demeter

Este repositorio en `/home/admin` respalda los materiales compartidos del
laboratorio: scripts, documentación, código auxiliar y metadatos de captura en
`demeter_lab/` y `demeter_recording/`. El producto `eyes_of_demeter/` mantiene
su propio repositorio Git y remoto.

Se excluyen streams RAW/PISP, estadísticas binarias, matrices NumPy, imágenes,
vídeos, builds y configuración privada del usuario. Los JSON, CSV y logs de
mision permanecen versionables. Las carpetas operacionales vacías se conservan
con `.gitkeep`; los archivos capturados permanecen locales.

El repositorio del home es local y todavía no tiene remoto configurado. No se
deben enviar estos metadatos a `Eyes_Of_Demeter` automáticamente: elegir un
remoto de respaldo separado antes de publicar este repositorio.

Consulta `demeter_lab/README.txt` y `demeter_recording/README.txt` para el mapa
de carpetas y el flujo de operación.