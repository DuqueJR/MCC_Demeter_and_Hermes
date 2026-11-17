// prueba_tierra.cpp - Prueba en el PC de las ordenes de texto de tierra (T-413): compila el gnd_cmd.cpp REAL contra stubs, le escribe lineas por el
// "Serial" y mira el Cmd que sale por gndCmdToSend. Cubre "<d|h> buzzer on|off", "<d|h> pi encender", los errores de formato y el ciclo
// NO_APTO -> "si" con el motivo 21. Sale con 0 si todo pasa.
#include <Arduino.h>
#include <esp_timer.h>
#include <Preferences.h>
#include <stdio.h>
#include <stdarg.h>
#include <string>
#include <net_proto.h>
#include "gnd_cmd.h"
#include "gnd_time.h"
#include <mbedtls/md.h>

using namespace net;

// ---------- Stubs ----------
static int64_t g_nowUs = 1000000;
int64_t esp_timer_get_time() { return g_nowUs; }
uint32_t millis() { return (uint32_t)(g_nowUs / 1000); }
bool Preferences::begin(const char *, bool) { return true; }
uint32_t Preferences::getULong(const char *, uint32_t d) { return d; }
void Preferences::putULong(const char *, uint32_t) {}
bool gndTimeUtc(int64_t t, int64_t &utc) { utc = t; return true; }
const mbedtls_md_info_t *mbedtls_md_info_from_type(mbedtls_md_type_t) { return nullptr; }
int mbedtls_md_hmac(const mbedtls_md_info_t *, const unsigned char *, size_t, const unsigned char *, size_t, unsigned char *out) { memset(out, 0xAB, 32); return 0; }

HardwareSerial Serial;
EspClass ESP;
static std::string g_in, g_out;
int HardwareSerial::available() { return (int)g_in.size(); }
int HardwareSerial::read() { const int c = (unsigned char)g_in[0]; g_in.erase(0, 1); return c; }
void HardwareSerial::flush() {}
void HardwareSerial::println(const char *s) { g_out += s; g_out += "\n"; }
int HardwareSerial::printf(const char *f, ...) {
    char b[400]; va_list a; va_start(a, f); const int n = vsnprintf(b, sizeof(b), f, a); va_end(a); g_out += b; return n;
}
void EspClass::restart() {}

static int g_fallas = 0;
#define CHECK(cond, msg) do { const bool ok_ = (cond); printf("  [%s] %s\n", ok_ ? "OK" : "FALLA", msg); if (!ok_) g_fallas++; } while (0)

static void escribir(const char *linea) { g_in = std::string(linea) + "\n"; g_out.clear(); gndCmdLoop(); }
static bool saca(Cmd &c) { if (!gndCmdToSend(c)) return false; gndCmdSent(); return true; }
static void termina() {                                          // sin respuesta: agota los reintentos y vence cualquier confirmacion
    Cmd c;
    for (int i = 0; i < 6; i++) { g_nowUs += 2000000; if (gndCmdToSend(c)) gndCmdSent(); gndCmdLoop(); }
    g_nowUs += 20000000; gndCmdLoop();
}

int main() {
    gndCmdBegin();
    Cmd c;

    printf("Tierra: ordenes de T-413\n");
    escribir("d buzzer on");
    CHECK(saca(c) && c.type == P_CMD && c.target == DEMETER && c.op == OP_BUZZER && c.arg == 1, "d buzzer on -> Cmd a Demeter, op 10, arg 1");
    CHECK(c.tag[0] == 0xAB, "el comando sale firmado (authTag)");
    termina();

    escribir("h buzzer off");
    CHECK(saca(c) && c.target == HERMES && c.op == OP_BUZZER && c.arg == 0, "h buzzer off -> Cmd a Hermes, op 10, arg 0");
    termina();

    escribir("d buzzer");
    CHECK(!saca(c) && g_out.find("on u off") != std::string::npos, "buzzer sin argumento: mensaje y no transmite");
    escribir("d buzzer sonar");
    CHECK(!saca(c) && g_out.find("on u off") != std::string::npos, "buzzer con argumento malo: mensaje y no transmite");

    escribir("d pi encender");
    CHECK(saca(c) && c.target == DEMETER && c.op == OP_PI_POWER && c.arg == 0, "d pi encender -> Cmd a Demeter, op 11");
    const uint32_t cnt = c.counter;

    // Respuesta del cohete: NO_APTO con el motivo 21 -> tierra pregunta y, con "si", manda la confirmacion con los mismos motivos
    CmdResp r; memset(&r, 0, sizeof(r));
    r.type = P_CMD_RESP; r.rocket_id = DEMETER; r.op = OP_PI_POWER; r.arg = 0; r.result = CR_NO_APTO; r.state = ST_TIERRA; r.counter = cnt; r.reasons = 1u << RZ_PI_DESCONOCIDA;
    g_out.clear();
    gndCmdOnResp(r);
    CHECK(g_out.find("NO APTO") != std::string::npos && g_out.find(reasonText(RZ_PI_DESCONOCIDA)) != std::string::npos, "muestra NO APTO y el texto del motivo 21");
    CHECK(g_out.find("escribe si o no") != std::string::npos, "y pregunta si se fuerza");
    escribir("si");
    CHECK(saca(c) && c.op == (OP_PI_POWER | OP_CONFIRM) && c.target == DEMETER && c.reasons == (1u << RZ_PI_DESCONOCIDA) && c.counter == cnt + 1,
          "si -> confirmacion: op 11 | CONFIRM, reasons = bit 21, contador siguiente");
    termina();

    escribir("d pi apagar");
    CHECK(!saca(c) && g_out.find("pi solo admite") != std::string::npos, "pi apagar no existe: mensaje y no transmite");
    escribir("d pi");
    CHECK(!saca(c) && g_out.find("pi solo admite") != std::string::npos, "pi sin argumento: mensaje y no transmite");

    escribir("d ping");
    CHECK(saca(c) && c.op == OP_PING, "las ordenes que ya existian siguen funcionando (ping)");
    termina();
    escribir("d estado fly");
    CHECK(saca(c) && c.op == OP_SET_STATE && c.arg == ST_FLY, "y estado fly");
    termina();

    printf("tierra: %s\n", g_fallas ? "FALLA" : "OK");
    return g_fallas ? 1 : 0;
}
