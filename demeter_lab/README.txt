DEMETER LAB - INDICE DEL HOME
=============================

Esta carpeta agrupa los archivos técnicos que antes estaban sueltos en
/home/admin. El código y los metadatos se respaldan en el repositorio Git raíz;
los streams RAW, archivos PISP, imágenes y vídeos permanecen solo en disco.

ESTRUCTURA
----------
docs/                 Informes de arquitectura, onboarding y revisión.
scripts/flight/       Scripts de captura e ingestión históricos.
scripts/develop/      Reveladores OpenCV y análisis de Bayer.
tools/source/         Fuentes auxiliares pisp_formats y praw_probe.
tools/bin/            Utilidad pisp_formats compilada.
host/                 Plantillas no secretas de systemd y configuración del Pi.
data/calibration/     Archivos PISP de calibración.
data/raw/             Capturas PISP/RAW y muestras de prueba.
data/rendered/        PNG de prueba y salidas de los experimentos.
data/recording_examples/ Manifiestos y logs ligeros de los formatos antiguos.
docs/recording_modes.md Comparación histórica de formas de captura.

Los informes de docs/ son snapshots con fecha: pueden describir estados previos
del pipeline. Para el estado operativo actual, la fuente canonica es
/home/admin/eyes_of_demeter/README.md y DEMETER_PROYECTO.txt.

PROYECTOS Y DATOS QUE SE CONSERVAN APARTE
-----------------------------------------
eyes_of_demeter/      Proyecto principal versionado en GitHub; contiene el
                      recorder dual, build reproducible y postprocesado.
demeter_recording/    Salidas operacionales: normal_rec y scientific_rec.
libpisp/              Checkout externo retirado; build.sh obtiene las fuentes
                      fijadas dentro de eyes_of_demeter/.build/sources.
pi/ y fotos/          Eliminados permanentemente de forma manual por el usuario
                      el 2026-10-10; no forman parte del respaldo.

COMANDOS HABITUALES
-------------------
Comparar reveladores sobre la muestra fija:
  /home/admin/demeter_lab/scripts/demeter_compare.sh

Probar modos del descompresor libpisp:
  /home/admin/demeter_lab/scripts/develop/test_modes.sh

Pipeline de vuelo/revelado actual:
  cd /home/admin/eyes_of_demeter
  ./build.sh
  ./demeter_flight.sh

Compatibilidad de rutas: los scripts demeter_compare.sh y test_modes.sh se
actualizaron para leer data/raw y escribir data/rendered. Los demás scripts
mantienen sus nombres y se ejecutan desde sus nuevas ubicaciones. Los archivos
ocultos de configuración de Linux/VS Code se excluyen del repo de respaldo.
`eyes_of_demeter/` conserva su repositorio independiente.
