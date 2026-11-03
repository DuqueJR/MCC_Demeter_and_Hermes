#pragma once
// Stub de mbedtls/md.h: solo lo que usa net_auth.h, para -fsyntax-only en el PC
#include <stddef.h>
#include <stdint.h>
typedef enum { MBEDTLS_MD_SHA256 = 6 } mbedtls_md_type_t;
typedef struct mbedtls_md_info_t mbedtls_md_info_t;
const mbedtls_md_info_t *mbedtls_md_info_from_type(mbedtls_md_type_t);
int mbedtls_md_hmac(const mbedtls_md_info_t *, const unsigned char *, size_t, const unsigned char *, size_t, unsigned char *);
