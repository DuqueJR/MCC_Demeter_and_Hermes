// core_sleep.h - Sueno profundo con despertar por iman (IO21). Dormido no hay radio: solo se despierta con el iman o con RST.
#pragma once

bool coreSleepEnter();         // llamar desde el bucle principal, dueno de la PMU. Si duerme no retorna; false si hay un iman presente
const char *coreWakeCause();   // "iman" o "reset"
