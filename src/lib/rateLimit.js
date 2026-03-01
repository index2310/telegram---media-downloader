const buckets = new Map();

export function checkRateLimit(key, { capacity = 6, refillMs = 60_000 } = {}) {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: capacity, ref: now };

  const refill = Math.floor((now - b.ref) / refillMs);
  if (refill > 0) {
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.ref = now;
  }

  if (b.tokens <= 0) {
    buckets.set(key, b);
    return false;
  }

  b.tokens -= 1;
  buckets.set(key, b);

  // bounded map growth
  if (buckets.size > 5000) {
    // delete an arbitrary (oldest not tracked) key to avoid unbounded memory
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  return true;
}
