#include "LoRaBoards.h"
#include "gnd_rx.h"
#include "gnd_time.h"
#include <fw_build.h>

void setup() {
    setupBoards();
    Serial.printf("[boot] tbeam_tierra %s %s compilado %s\n", FW_ENV, FW_GIT, __DATE__);
    gndTimeBegin();
    gndRxBegin();
}

void loop() {
    gndTimeLoop();
    gndRxLoop();
}
