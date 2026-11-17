#include "test_lora.h"
#include "LoRaBoards.h"
#include <RadioLib.h>

#define LORA_FREQ   903.0
#define LORA_BW     250.0
#define LORA_SF     7
#define LORA_CR     5
#define LORA_SYNC   0xD3
#define LORA_PWR    10
#define PKT_LEN     66

SX1262 radio = new Module(RADIO_CS_PIN, RADIO_DIO1_PIN, RADIO_RST_PIN, RADIO_BUSY_PIN);

struct __attribute__((packed)) TestPkt {
    uint8_t  magic;      // 0xA5
    uint8_t  ver;
    uint16_t seq;
    uint32_t tx_ms;
    uint8_t  pad[56];
    uint16_t crc;
};
static_assert(sizeof(TestPkt) == PKT_LEN, "TestPkt debe medir 66 B");

static uint16_t crc16(const uint8_t *d, size_t n) {
    uint16_t c = 0xFFFF;
    while (n--) { c ^= (uint16_t)(*d++) << 8; for (int i = 0; i < 8; i++) c = (c & 0x8000) ? (c << 1) ^ 0x1021 : (c << 1); }
    return c;
}

static volatile bool s_flag = false;
static void IRAM_ATTR setFlag() { s_flag = true; }

void testLoraBegin() {
    int st = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR, LORA_SYNC, LORA_PWR, 8);
    Serial.printf("[lora] begin -> %d\n", st);
    if (st != RADIOLIB_ERR_NONE) return;
    radio.setCurrentLimit(140);
    radio.setCRC(2);
    Serial.printf("[lora] tiempo en el aire %u us\n", (unsigned)radio.getTimeOnAir(PKT_LEN));
#if defined(TEST_LORA_TX)
    radio.setPacketSentAction(setFlag);
#else
    radio.setPacketReceivedAction(setFlag);
    radio.startReceive();
#endif
}

#if defined(TEST_LORA_TX)
void testLoraLoop() {
    static uint32_t tNext = 0, sent = 0;
    static uint16_t seq = 0;
    static bool busy = false;
    static uint32_t tStart = 0, airMax = 0;
    if (s_flag) {                       // transmisión terminada
        s_flag = false;
        radio.finishTransmit();
        uint32_t d = micros() - tStart;
        if (d > airMax) airMax = d;
        busy = false; sent++;
    }
    if (!busy && millis() >= tNext) {
        tNext = millis() + 100;         // 10 Hz
        TestPkt p; memset(&p, 0, sizeof(p));
        p.magic = 0xA5; p.ver = 1; p.seq = seq++; p.tx_ms = millis();
        p.crc = crc16((uint8_t *)&p, PKT_LEN - 2);
        tStart = micros();
        int st = radio.startTransmit((uint8_t *)&p, PKT_LEN);
        if (st == RADIOLIB_ERR_NONE) busy = true;
        else Serial.printf("[lora] startTransmit error %d\n", st);
    }
    static uint32_t tRep = 0;
    if (millis() - tRep >= 1000) {
        tRep = millis();
        Serial.printf("[lora-tx] enviados=%lu seq=%u aire_max=%lu us\n",
                      (unsigned long)sent, seq, (unsigned long)airMax);
    }
}
#else
void testLoraLoop() {
    static uint32_t rx = 0, crcBad = 0, lost = 0, err = 0, lastSeq = 0, haveSeq = 0;
    static float rssiSum = 0, snrSum = 0, rssiMin = 0; static uint32_t nWin = 0, rxWin = 0;
    if (s_flag) {
        s_flag = false;
        TestPkt p;
        int st = radio.readData((uint8_t *)&p, PKT_LEN);
        if (st == RADIOLIB_ERR_NONE) {
            if (p.magic == 0xA5 && crc16((uint8_t *)&p, PKT_LEN - 2) == p.crc) {
                if (haveSeq) lost += (uint16_t)(p.seq - lastSeq - 1);
                lastSeq = p.seq; haveSeq = 1; rx++; rxWin++;
                float r = radio.getRSSI(), s = radio.getSNR();
                rssiSum += r; snrSum += s; nWin++;
                if (nWin == 1 || r < rssiMin) rssiMin = r;
            } else crcBad++;
        } else err++;
        radio.startReceive();
    }
    static uint32_t tRep = 0;
    if (millis() - tRep >= 1000) {
        tRep = millis();
        Serial.printf("[lora-rx] ok=%lu (%lu/s) perdidos=%lu crc_mal=%lu err=%lu | RSSI=%.1f (min %.1f) dBm SNR=%.1f dB\n",
                      (unsigned long)rx, (unsigned long)rxWin, (unsigned long)lost,
                      (unsigned long)crcBad, (unsigned long)err,
                      nWin ? rssiSum / nWin : 0.0f, nWin ? rssiMin : 0.0f, nWin ? snrSum / nWin : 0.0f);
        rssiSum = snrSum = 0; nWin = 0; rxWin = 0;
    }
}
#endif