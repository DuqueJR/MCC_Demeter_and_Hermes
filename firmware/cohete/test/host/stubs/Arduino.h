#pragma once
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <stddef.h>
typedef void* QueueHandle_t; typedef void* SemaphoreHandle_t; typedef void* TaskHandle_t; typedef int BaseType_t; typedef uint32_t TickType_t;
#define pdTRUE 1
#define pdFALSE 0
#define portMAX_DELAY 0xFFFFFFFFu
#define IRAM_ATTR
#define pdMS_TO_TICKS(x) (x)
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLDOWN 2
#define HIGH 1
#define LOW 0
#define RISING 1
#define MSBFIRST 1
#define SPI_MODE0 0
#define SPI_MODE3 3
uint32_t millis();
void delay(uint32_t);
void pinMode(int,int); void digitalWrite(int,int);
int digitalPinToInterrupt(int);
void attachInterrupt(int, void(*)(), int);
QueueHandle_t xQueueCreate(int,int);
BaseType_t xQueueSend(QueueHandle_t,const void*,TickType_t);
BaseType_t xQueueReceive(QueueHandle_t,void*,TickType_t);
BaseType_t xTaskCreatePinnedToCore(void(*)(void*),const char*,uint32_t,void*,int,TaskHandle_t*,int);
TaskHandle_t xTaskGetCurrentTaskHandle();
uint32_t ulTaskNotifyTake(BaseType_t,TickType_t);
void vTaskNotifyGiveFromISR(TaskHandle_t,BaseType_t*);
#define portYIELD_FROM_ISR(x) ((void)0)
void vTaskDelay(TickType_t); void vTaskDelete(TaskHandle_t);
BaseType_t xSemaphoreTake(SemaphoreHandle_t,TickType_t); BaseType_t xSemaphoreGive(SemaphoreHandle_t);
// T-413: lo minimo para -fsyntax-only de core_sleep.cpp, net_radio.cpp y core_selftest.cpp (solo declaraciones)
struct HardwareSerial { int printf(const char*, ...) __attribute__((format(printf, 2, 3))); void println(const char*); int available(); int read(); void flush();
                        void begin(uint32_t, int, int, int); size_t setRxBufferSize(size_t); int availableForWrite(); size_t write(const uint8_t*, size_t); };
extern HardwareSerial Serial;
extern HardwareSerial Serial0;            // ext_pi.cpp: UART0 hacia la Pi
#define SERIAL_8N1 0x800001c
TickType_t xTaskGetTickCount(void);
void vTaskDelayUntil(TickType_t*, TickType_t);
struct EspClass { void restart(); };
extern EspClass ESP;
typedef struct { int dummy; } portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED {0}
void taskYIELD(void);
#define portENTER_CRITICAL(m) ((void)(m))
#define portEXIT_CRITICAL(m) ((void)(m))
