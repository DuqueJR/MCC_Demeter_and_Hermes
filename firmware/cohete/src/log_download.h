// log_download.h - Descarga de logs por el USB serie, sin sacar la SD. Solo lectura. Lado PC: tools/tbget.py.
#pragma once

void logDownloadServe();       // detiene el logger y atiende comandos; no retorna: se sale reiniciando
