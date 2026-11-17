#pragma once
// Stub de <driver/gpio.h> para el PC: solo lo que usa ext_act.cpp. Las definiciones las pone el arnes (prueba_mision.cpp).
typedef int gpio_num_t;
int  gpio_hold_en(gpio_num_t);
int  gpio_hold_dis(gpio_num_t);
void gpio_deep_sleep_hold_en(void);
void gpio_deep_sleep_hold_dis(void);
