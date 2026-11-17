// logger.h - Escritor de la microSD: al arrancar solo deja lista la reserva; registra hacia archivos preasignados cuando se le ordena.
#pragma once
#include <stdint.h>

struct LoggerStats {
    uint8_t  state;                 // 0 sin iniciar, 1 iniciando, 2 registrando, 3 error, 4 detenido, 5 listo sin registrar
    char     name[40];              // archivo activo
    uint32_t fileIdx;
    uint32_t bytes;                 // bytes escritos en la sesion
    uint32_t writes, flushes;
    uint32_t writeMaxUs, flushMaxUs;
    uint32_t over20, over50, over100;   // escrituras que tardaron mas de 20/50/100 ms
    uint32_t badRecs, resyncs;
    uint32_t drops[4];              // descartes por anillo
    uint8_t  spareState;            // 0 no hay, 1 creando, 2 lista
    uint8_t  sparePct;
    uint8_t  preallocated;          // el archivo activo estaba preasignado
    uint32_t rollovers;
    uint32_t spareFails;            // intentos de reserva fallidos (a los 3 se deja de intentar; el registro sigue)
    uint32_t ioErrs;                // intentos de escritura cortos en SD (se reintentan; solo es grave si sube spareFails o state=3)
    uint32_t ioErrsDisk;            // de esas, con EIO (fallo real de disco; las demas son EBADF, CMD13 antes de escribir)
    int32_t  ioErrno;               // errno de la ultima
    uint32_t ioWrote;               // bytes que alcanzo a escribir la ultima
    uint32_t reopens;               // veces que se reabrio un archivo tras un error
    uint32_t eventsLost;            // incidentes que no cupieron para registrarlos
    uint32_t freeMB;                // libre en la SD al arrancar
    uint32_t filePos;               // bytes en el archivo activo
    uint32_t fileStartMs;           // cuando empezo a registrar en el
    const char *msg;
};

bool        loggerBegin(uint16_t rocketId, uint32_t missionId);   // lanza la tarea (nucleo 0)
LoggerStats loggerStats();
// Lo que se muestra del registro actual. pct y remainS: del bloque de 32 MB; sin datos aun, remainS sale del caudal tipico.
struct LoggerRecInfo { bool recording, prepared; const char *name; uint32_t elapsedS, pos, remainS; uint8_t pct; };
LoggerRecInfo loggerRecInfo();
void        loggerPrepare();                                       // abre el archivo y hace su primera escritura, la lenta (hasta ~400 ms): al armar
void        loggerRecord(bool on);                                 // empieza a registrar, o termina y cierra el archivo
void        loggerAllowPrealloc(bool allow);                       // false en vuelo: no crear archivos de reserva
bool        loggerStop(uint32_t timeoutMs);                        // cierra todo y termina la tarea; despues solo se sale reiniciando
