"""
Sliding-window rate limiter using a deque per client. Avoids the burst
problem of fixed-window limiters (2x allowance at the window boundary).
"""
import threading
import time
from collections import deque, defaultdict


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, client_key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._requests[client_key]
            while q and now - q[0] > self.window_seconds:
                q.popleft()
            if len(q) >= self.max_requests:
                return False
            q.append(now)
            return True


predict_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)
