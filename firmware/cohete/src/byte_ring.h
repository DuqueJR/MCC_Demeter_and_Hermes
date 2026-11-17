// byte_ring.h - Anillo de bytes SPSC (un productor, un consumidor), sin bloqueos.
// Los registros se escriben completos o no se escriben (si no caben se descartan y se cuenta).
#pragma once
#include <stdint.h>
#include <string.h>

class ByteRing {
public:
    void init(uint8_t *storage, uint32_t cap_pow2) {
        buf_ = storage; cap_ = cap_pow2; mask_ = cap_pow2 - 1; head_ = 0; tail_ = 0; drops_ = 0;
    }
    bool ready() const { return buf_ != 0; }
    uint32_t capacity() const { return cap_; }

    bool push(const uint8_t *p, uint32_t n) {                     // solo el productor
        const uint32_t h = head_;
        const uint32_t t = __atomic_load_n(&tail_, __ATOMIC_ACQUIRE);
        if (cap_ - (h - t) < n) { __atomic_fetch_add(&drops_, 1, __ATOMIC_RELAXED); return false; }
        const uint32_t i = h & mask_, first = (cap_ - i < n) ? (cap_ - i) : n;
        memcpy(buf_ + i, p, first);
        if (n > first) memcpy(buf_, p + first, n - first);
        __atomic_store_n(&head_, h + n, __ATOMIC_RELEASE);
        return true;
    }
    uint32_t used() const {
        return __atomic_load_n(&head_, __ATOMIC_ACQUIRE) - __atomic_load_n(&tail_, __ATOMIC_ACQUIRE);
    }
    uint32_t peek(uint8_t *out, uint32_t n) const {               // solo el consumidor
        const uint32_t avail = used();
        if (n > avail) n = avail;
        const uint32_t t = tail_, i = t & mask_, first = (cap_ - i < n) ? (cap_ - i) : n;
        memcpy(out, buf_ + i, first);
        if (n > first) memcpy(out + first, buf_, n - first);
        return n;
    }
    void consume(uint32_t n) { __atomic_store_n(&tail_, tail_ + n, __ATOMIC_RELEASE); }
    uint32_t drops() const { return __atomic_load_n(&drops_, __ATOMIC_RELAXED); }

private:
    uint8_t *buf_ = 0;
    uint32_t cap_ = 0, mask_ = 0, head_ = 0, tail_ = 0, drops_ = 0;
};
