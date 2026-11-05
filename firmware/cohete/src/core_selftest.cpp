// core_selftest.cpp - Prueba del nucleo: tiempo + GNSS + anillo de registro + logger en SD.
#include "core_selftest.h"
#include <stdio.h>
#include "core_bus.h"
#include "gnss_m10s.h"
#include "logger.h"
#include "in_imu.h"
#include "in_i2c.h"
#include "in_mag.h"
#include "in_bar.h"
#include "net_radio.h"
#include "log_download.h"
#include "ext_drv.h"
#include "ext_act.h"
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "ext_mmc.h"
#include "core_sleep.h"
#include "mission.h"
#include "ext_pi.h"
#include "amb_temp.h"
#include "cal_onboard.h"
#include "pi_plan.h"
#include <fw_build.h>

#ifndef ROCKET_ID
#define ROCKET_ID 1
#endif
#ifndef MISSION_ID
#define MISSION_ID 0
#endif

void coreSelftestBegin() {
    extActBegin();                 // lo primero: buzzer (IO46) y encendido de la Pi (IO45) en bajo
    extDrvBegin();
    bus_begin();
    gnssBegin();
    loggerBegin(ROCKET_ID, MISSION_ID);
    imuBegin();
    extLsmBegin();
    i2cBegin();
    ambBegin();                    // temperatura del suelo: antes de la mision, que la usa para la altura
    calBegin(ROCKET_ID);           // calibracion activa en NVS (D-059)
    missionBegin(ROCKET_ID);
    piBegin(ROCKET_ID);            // UART con la Pi (solo Demeter)
    netBegin(ROCKET_ID, MISSION_ID);
}

void coreSelftestReport() {
    static uint32_t lastPvt = 0, lastMs = 0, lastMag = 0, lastBar = 0, lastTx = 0;
    static uint8_t dlMatch = 0;
    static const char DL_KEY[] = "TBDL";                 // la envia tools/tbget.py: pasa al modo de descarga de logs
    static const char CAL_KEY[] = "TBCAL";               // la envia estacion/cal_blob.py: carga una calibracion por USB (D-059)
    static uint8_t calMatch = 0;
    while (Serial.available()) {                         // prueba: 'f' alterna 2 Hz / 10 Hz hasta que exista la deteccion de vuelo
        const int c = Serial.read();                     // 'g' deja de anclar la hora al GNSS, para probar la hora por baliza
        if (c == 'f') netSetFlying(!netFlying());
        else if (c == 'g') gnssSetAnchors(!gnssAnchors());
        else if (c == 's' && !coreSleepEnter()) Serial.println("[sleep] no duerme: hay un iman presente, retiralo");   // 's': prueba, luego sera un comando de tierra
        dlMatch = (c == DL_KEY[dlMatch]) ? (uint8_t)(dlMatch + 1) : (uint8_t)(c == DL_KEY[0] ? 1 : 0);
        if (DL_KEY[dlMatch] == 0) logDownloadServe();
        calMatch = (c == CAL_KEY[calMatch]) ? (uint8_t)(calMatch + 1) : (uint8_t)(c == CAL_KEY[0] ? 1 : 0);
        if (CAL_KEY[calMatch] == 0) { calMatch = 0; calUsbRecibir(); }
    }
    if (missionTakeReset()) { loggerStop(5000); ESP.restart(); }
    if (missionTakeSleep() && !coreSleepEnter()) Serial.println("[sleep] no duerme: hay un iman presente, retiralo");
    const NetStats nt = netStats();
    const GnssStats g = gnssStats();
    const MagStats mg = magStats();
    const BarStats br = barStats();
    const I2cStats ic = i2cStats();
    const uint32_t now = millis();
    const float k = lastMs ? 1000.0f / (now - lastMs) : 0.0f;
    const float rate = (g.pvt - lastPvt) * k, magHz = (mg.samples - lastMag) * k, barHz = (br.samples - lastBar) * k, txHz = (nt.tx - lastTx) * k;
    lastPvt = g.pvt; lastMag = mg.samples; lastBar = br.samples; lastTx = nt.tx; lastMs = now;

    GnssSample gs; memset(&gs, 0, sizeof(gs)); g_gnss.get(gs);
    Serial.printf("[gnss] init=%s fix=%u sv=%u tAcc=%lu ns pvt/s=%.1f gaps=%lu (ult %ld ms) ckerr=%lu\n",
                  g.stat, g.fix, g.nsv, (unsigned long)gs.tacc_ns, rate, (unsigned long)g.gaps, (long)g.lastGapMs, (unsigned long)g.ckerr);

    TimeModel m;
    if (time_snapshot(m) && m.valid()) {
        const int64_t t = time_local_now();
        const int64_t utc = m.toUtcUs(t);
        const int64_t sod = (utc / 1000000LL) % 86400LL;
        Serial.printf("[time] q=%u src=%u err=%.1f us deriva=%+.2f ppm UTC=%02d:%02d:%02d.%03d anclas=%lu/%lu\n",
                      m.quality(t), m.source(), m.errEstUs(t), m.driftPpm(),
                      (int)(sod / 3600), (int)((sod / 60) % 60), (int)(sod % 60), (int)((utc / 1000) % 1000),
                      (unsigned long)g.anchors, (unsigned long)g.edges);
    } else {
        Serial.println("[time] sin hora (q=3)");
    }

    const LoggerStats l = loggerStats();
    Serial.printf("[sd  ] %s | %s | %lu KB esc=%lu fl=%lu lat_max=%lu us flush_max=%lu us >20:%lu >50:%lu >100:%lu | reserva=%u/%u%% fallos=%lu rollovers=%lu | err=%lu (eio=%lu) errno=%ld w=%lu reab=%lu libre=%lu MB\n",
                  l.msg, l.name, (unsigned long)(l.bytes / 1024), (unsigned long)l.writes, (unsigned long)l.flushes,
                  (unsigned long)l.writeMaxUs, (unsigned long)l.flushMaxUs,
                  (unsigned long)l.over20, (unsigned long)l.over50, (unsigned long)l.over100,
                  l.spareState, l.sparePct, (unsigned long)l.spareFails, (unsigned long)l.rollovers,
                  (unsigned long)l.ioErrs, (unsigned long)l.ioErrsDisk, (long)l.ioErrno, (unsigned long)l.ioWrote, (unsigned long)l.reopens, (unsigned long)l.freeMB);
    const LoggerRecInfo ri = loggerRecInfo();
    Serial.printf("[log ] %s archivo=%s tiempo=%lu s lleno=%u %% restante=%lu s reserva=%u/%u%%\n", ri.recording ? "REGISTRANDO" : (ri.prepared ? "PREPARADO" : "sin registrar"), ri.name[0] ? ri.name : "-",
                  (unsigned long)ri.elapsedS, ri.pct, (unsigned long)ri.remainS, l.spareState, l.sparePct);
    const ImuStats im = imuStats();
    Serial.printf("[imu ] %s | lotes=%lu muestras=%lu perdidas=%lu isr=%lu odr=%.2f Hz (T=%.2f us) rms=%.1f us lect_prom=%lu max=%lu us ventana_prom=%lu max=%lu us timeouts=%lu llenos=%lu vacios=%lu rech=%lu reset=%lu mutex=%lu cmdfail=%lu\n",
                  im.msg, (unsigned long)im.batches, (unsigned long)im.samples, (unsigned long)im.lost, (unsigned long)im.isr, im.odrHz, im.periodUs, im.rmsUs,
                  (unsigned long)im.readAvgUs, (unsigned long)im.readMaxUs, (unsigned long)im.windowAvgUs, (unsigned long)im.windowMaxUs,
                  (unsigned long)im.timeouts, (unsigned long)im.full,
                  (unsigned long)im.empty, (unsigned long)im.estRejects, (unsigned long)im.estResets, (unsigned long)im.mutexFail, (unsigned long)im.cmdFail);
    Serial.printf("[mag ] %s id=0x%02X | muestras=%lu %.1f Hz |B|=%.3f G sat=%lu err=%lu inits=%lu gap_max=%lu us\n",
                  ic.magUp ? "ok" : "CAIDO", mg.id, (unsigned long)mg.samples, magHz, mg.normG, (unsigned long)mg.ovfl,
                  (unsigned long)mg.errs, (unsigned long)mg.inits, (unsigned long)mg.gapMaxUs);
    Serial.printf("[bar ] %s 0x%02X | muestras=%lu %.1f Hz P=%.1f Pa T=%.2f C H=%.1f %% err=%lu tmo=%lu inits=%lu med_max=%lu us | bus_resets=%lu\n",
                  ic.barUp ? "ok" : "CAIDO", br.addr, (unsigned long)br.samples, barHz, br.press_pa, br.temp_c, br.hum_pct,
                  (unsigned long)br.errs, (unsigned long)br.timeouts, (unsigned long)br.inits, (unsigned long)br.measMaxUs,
                  (unsigned long)ic.busResets);
    static uint32_t lastLsm = 0, lastBmp = 0;
    const ExtLsmStats xl = extLsmStats();
    const ExtBmpStats xb = extBmpStats();
    ImuSample xs; memset(&xs, 0, sizeof(xs));
    const bool xsOk = g_ext_imu.get(xs);
    const float xa = xsOk ? sqrtf((float)xs.a[0] * xs.a[0] + (float)xs.a[1] * xs.a[1] + (float)xs.a[2] * xs.a[2]) / xs.acc_lsb_per_g : 0.0f;
    Serial.printf("[lsm ] %s who=0x%02X spi=%lu kHz whoerr=%lu freq_fine=%d (%.1f Hz) | muestras=%lu %.1f Hz odr=%.2f Hz rms=%.1f us perdidas=%lu sobrescr=%lu tag_malos=%lu | lect_prom=%lu max=%lu us lotes=%lu isr=%lu sondeo=%lu marcas=%lu | |a|=%.3f g giro=%.1f %.1f %.1f dps\n",
                  xl.msg, xl.who, (unsigned long)xl.spiKhz, (unsigned long)xl.whoErrs, xl.freqFine, 1666.67f * (1.0f + 0.0015f * xl.freqFine), (unsigned long)xl.samples, (xl.samples - lastLsm) * k, xl.odrHz, xl.rmsUs,
                  (unsigned long)xl.lost, (unsigned long)xl.overruns, (unsigned long)xl.badTags, (unsigned long)xl.readAvgUs, (unsigned long)xl.readMaxUs,
                  (unsigned long)xl.batches, (unsigned long)xl.isr, (unsigned long)xl.polled, (unsigned long)xl.tsWords, xa,
                  xsOk ? xs.g[0] / xs.gyr_lsb_per_dps : 0.0f, xsOk ? xs.g[1] / xs.gyr_lsb_per_dps : 0.0f, xsOk ? xs.g[2] / xs.gyr_lsb_per_dps : 0.0f);
    Serial.printf("[bmp ] %s paso=%s hub=0x%02X id=0x%02X st=0x%02X osr=0x%02X | muestras=%lu %.1f Hz P=%.1f Pa T=%.2f C nack=%lu malas=%lu\n",
                  xl.hubOk ? "ok" : "SIN CONFIGURAR", xb.step ? xb.step : "-", xl.hubSt, xb.chipId, xb.status, xb.effOsr, (unsigned long)xb.samples, (xb.samples - lastBmp) * k, xb.press_pa, xb.temp_c, (unsigned long)xb.nacks, (unsigned long)xb.bad);
    lastLsm = xl.samples; lastBmp = xb.samples;
    static uint32_t lastMmc = 0;
    const ExtMmcStats xm = extMmcStats();
    Serial.printf("[mmc ] %s id=0x%02X | muestras=%lu %.1f Hz |B|=%.3f G sat=%lu err=%lu inits=%lu gap_max=%lu us | set/reset: |H|=%.3f G offset=%.1f %.1f %.1f mG\n",
                  ic.mmcUp ? "ok" : "CAIDO", xm.id, (unsigned long)xm.samples, (xm.samples - lastMmc) * k, xm.normG, (unsigned long)xm.sat, (unsigned long)xm.errs,
                  (unsigned long)xm.inits, (unsigned long)xm.gapMaxUs, xm.fieldG, xm.offsetMg[0], xm.offsetMg[1], xm.offsetMg[2]);
    lastMmc = xm.samples;
    const DrvStats dr = extDrvStats();
    Serial.printf("[drv ] iman=%d detecciones=%lu despertar=%s\n", dr.magnet ? 1 : 0, (unsigned long)dr.detections, coreWakeCause());
    Serial.printf("[rx  ] balizas=%lu malas=%lu otros=%lu ventanas_saltadas=%lu residuo=%ld us anclar_gnss=%d\n",
                  (unsigned long)nt.rx, (unsigned long)nt.rxBad, (unsigned long)nt.rxOther, (unsigned long)nt.rxSkipped,
                  (long)nt.lastResUs, gnssAnchors() ? 1 : 0);
    Serial.printf("[net ] id=%u fw=%s %s %d dBm %s %s | tx=%lu %.1f Hz balizas=%lu err=%lu saltadas=%lu tarde_max=%lu us fin_max=%lu us aire=%lu us\n",
                  (unsigned)ROCKET_ID, FW_ENV, FW_GIT, NET_TX_DBM, !nt.radioOk ? "SIN RADIO" : (nt.slotted ? "ranuras" : "baliza"), netFlying() ? "vuelo" : "tierra",
                  (unsigned long)nt.tx, txHz, (unsigned long)nt.beacons, (unsigned long)nt.txErr, (unsigned long)nt.skipped,
                  (unsigned long)nt.lateMaxUs, (unsigned long)nt.endMaxUs, (unsigned long)nt.airUs);
    static const char *const STATE_NAME[5] = {"-", "TIERRA", "ARMED", "FLY", "RECOVERY"};
    static const char *const MOMENT_NAME[8] = {"-", "LAUNCH", "BOOST", "COAST", "APOGEO", "CAIDA", "PARACAIDAS", "ATERRIZAJE"};
    const MissionStats ms = missionStats();
    Serial.printf("[mis ] estado=%s momento=%s flags=0x%02X alt=%.1f m vz=%.1f m/s baro=%s | cmd=%lu rx=%lu resp=%lu ult_contador=%lu ult_res=%u motivos=0x%08lX\n",
                  STATE_NAME[ms.state], MOMENT_NAME[ms.moment], ms.flags, ms.altM, ms.vzMps, ms.baroSrc == 0 ? "BMP" : (ms.baroSrc == 1 ? "BME" : "ninguno"),
                  (unsigned long)ms.cmds, (unsigned long)nt.rxCmd, (unsigned long)nt.txResp, (unsigned long)ms.lastCounter, ms.lastResult, (unsigned long)ms.lastReasons);
    {
        static const char *const CE[8] = {"sin analisis", "PASADA 1", "PASADA 2", "CALCULANDO", "LISTO (sin aplicar)", "ERROR", "aplicada", "descartada"};
        const calblob::Calibracion &ca = calActiva();
        Serial.printf("[cal ] activa=%08lX (%s) | analisis: %s %s archivo=%s\n", (unsigned long)(ca.lsm.ok ? ca.crc : 0),
                      ca.ok ? "completa" : (ca.lsm.ok ? "parcial" : "ninguna"), CE[calEstado() & 7], calAnalizando() ? "..." : "", calArchivo()[0] ? calArchivo() : "-");
    }
    {
        const AmbInfo am = ambInfo();
        static const char *const FU[4] = {"-", "sueno", "encendido", "a mano"};
        char edad[16];
        if (am.edad_s < 0) snprintf(edad, sizeof(edad), "?");
        else snprintf(edad, sizeof(edad), "%ld min", (long)(am.edad_s / 60));
        Serial.printf("[amb ] %s suelo=%.2f C (%s, %s) bmp=%.2f bme=%.2f pend=%.3f/%.3f C/min edad=%s | ahora bmp=%.2f bme=%.2f C P=%.1f Pa arm=0x%02X\n",
                      am.tomando ? "TOMANDO" : (am.hay ? "ok" : "SIN MUESTRA"), ambTempC(), am.hay ? FU[am.m.fuente & 3] : "-", am.hay ? (am.m.calidad ? "dudosa" : "buena") : "-",
                      am.m.t_bmp, am.m.t_bme, am.m.pend_bmp, am.m.pend_bme, edad, am.t_bmp, am.t_bme, am.p_bmp, am.armBits);
    }
    const PiStats pi = piStats();
    if (pi.active) {
        char edad[16];
        if (pi.ageMs == 0xFFFFFFFFu) snprintf(edad, sizeof(edad), "nunca");
        else snprintf(edad, sizeof(edad), "%.1f s", pi.ageMs / 1000.0f);
        Serial.printf("[pi  ] estado=%s (0x%02X) motivo=%s latido=%s cambios=%lu perdidas=%lu | rx=%lu B tramas=%lu crc_mal=%lu otras=%lu | pose=%lu omitidas=%lu banderas=0x%03X | meta=%s ult_cmd=%s cmds=%lu agotados=%lu\n",
                      piStatusName(pi.status), pi.status, piReasonName(pi.reason), edad, (unsigned long)pi.changes, (unsigned long)pi.losses,
                      (unsigned long)pi.rxBytes, (unsigned long)pi.rxFrames, (unsigned long)pi.crcErr, (unsigned long)pi.otherFrames,
                      (unsigned long)pi.txPose, (unsigned long)pi.txSkipped, pi.lastFlags,
                      piplan::goalName(pi.goal), piplan::cmdName(pi.lastCmd), (unsigned long)pi.cmds, (unsigned long)pi.cmdGaveUp);
    }
    Serial.printf("[ring] gnss=%lu/%lu imu=%lu/%lu i2c=%lu/%lu ext=%lu/%lu drops gnss=%lu imu=%lu i2c=%lu net=%lu ext=%lu (log imu=%lu) malos=%lu resync=%lu\n",
                  (unsigned long)bus_ring_used(RING_GNSS), (unsigned long)bus_ring_capacity(RING_GNSS),
                  (unsigned long)bus_ring_used(RING_IMU), (unsigned long)bus_ring_capacity(RING_IMU),
                  (unsigned long)bus_ring_used(RING_I2C), (unsigned long)bus_ring_capacity(RING_I2C),
                  (unsigned long)bus_ring_used(RING_EXT), (unsigned long)bus_ring_capacity(RING_EXT),
                  (unsigned long)l.drops[0], (unsigned long)l.drops[1], (unsigned long)l.drops[2], (unsigned long)l.drops[3], (unsigned long)bus_ring_drops(RING_EXT), (unsigned long)im.logDrops,
                  (unsigned long)l.badRecs, (unsigned long)l.resyncs);
}
