// net_auth.h - Firma de paquetes: HMAC-SHA256 truncado a 8 B. Usa mbedtls del framework.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <mbedtls/md.h>
#include "secrets.h"

namespace net {

static const size_t TAG_LEN = 8;

inline void authTag(const uint8_t *d, size_t n, uint8_t *tag) {
    uint8_t full[32];
    mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), NET_KEY, sizeof(NET_KEY), d, n, full);
    memcpy(tag, full, TAG_LEN);
}

inline bool authCheck(const uint8_t *d, size_t n, const uint8_t *tag) {
    uint8_t t[TAG_LEN];
    authTag(d, n, t);
    uint8_t diff = 0;
    for (size_t i = 0; i < TAG_LEN; i++) diff |= (uint8_t)(t[i] ^ tag[i]);
    return diff == 0;
}

} // namespace net
