#include "LoRaBoards.h"
#include "gnd_rx.h"
#include "gnd_time.h"

void setup() {
    setupBoards();
    Serial.println("[boot] tbeam_tierra receptor con hora propia");
    gndTimeBegin();
    gndRxBegin();
}

void loop() {
    gndTimeLoop();
    gndRxLoop();
}
