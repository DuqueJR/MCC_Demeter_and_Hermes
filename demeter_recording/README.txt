DEMETER RECORDING
=================

Directorio persistente de salida para las capturas operacionales. Mantiene
separado el producto nativo de rpicam del producto científico del recorder
Demeter. Las carpetas pueden crecer rápidamente; planificar espacio por misión.

ESTRUCTURA
----------
normal_rec/<timestamp>/
    Captura tradicional rpicam-raw: cam0.raw/cam1.raw, logs y session.json.
    No incluye PISP_FE_STATS indexado por frame para replay científico.

scientific_rec/raw/<timestamp>/
    Chunks del demeter_rec: COMP1 por cámara, stats FE binarias, metadata JSONL
    con offsets, pair_index, timestamps, exposición/ganancia y estado sync.
    Este es el archivo fuente para auditoría y revelado repetible.

scientific_rec/jpeg/<timestamp>/
    Frames revelados por Controller + PiSP BE, convertidos a JPEG calidad 95.

scientific_rec/png/<timestamp>/
    La misma salida RGB888 del BE guardada como PNG lossless de 8 bits.

OPERACION
---------
Captura científica actual:
    cd /home/admin/eyes_of_demeter
    ./build.sh
    ./demeter_flight.sh

La misión se activa por touchdown o al alcanzar MAX_TIME. El orquestador valida
que /mnt/ramcam sea tmpfs, copia chunks cerrados de RAM a la carpeta raw y lanza
el revelado en segundo plano. Los JPEG/PNG usan el mismo nombre de misión que el
RAW correspondiente.

Los scripts históricos con rpicam-raw apuntan a normal_rec, pero algunos son
prototipos con captura/productor incompleto. Revisar
/home/admin/demeter_lab/docs/recording_modes.md antes de seleccionar un modo.
No mezclar ni mover carpetas raw/png/jpeg entre IDs de misión.