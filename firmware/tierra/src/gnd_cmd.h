// gnd_cmd.h - Comandos por el monitor USB: los firma, los reintenta y muestra la respuesta del cohete.
// Formato de texto provisional, hasta la envoltura USB del contrato con el dashboard.
#pragma once
#include <stdint.h>
#include <net_proto.h>

void gndCmdBegin();
void gndCmdLoop();
bool gndCmdToSend(net::Cmd &c);                  // hay un comando por transmitir en la proxima ranura de comandos
void gndCmdSent();
void gndCmdOnResp(const net::CmdResp &r);
