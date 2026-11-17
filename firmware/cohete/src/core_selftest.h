#pragma once
void coreSelftestBegin();    // arranca bus, GNSS y un consumidor de prueba del anillo
void coreSelftestReport();   // llamar una vez por segundo
void coreEkfStream();        // llamar en cada vuelta de loop(): lineas @E a 25 Hz mientras el dashboard las pida ('E')
