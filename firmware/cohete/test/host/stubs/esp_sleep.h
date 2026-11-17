#pragma once
#include "driver/gpio.h"
typedef enum { ESP_SLEEP_WAKEUP_EXT0 = 2 } esp_sleep_wakeup_cause_t;
int esp_sleep_enable_ext0_wakeup(gpio_num_t, int);
esp_sleep_wakeup_cause_t esp_sleep_get_wakeup_cause(void);
void esp_deep_sleep_start(void);
