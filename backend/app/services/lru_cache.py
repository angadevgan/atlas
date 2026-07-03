"""
OrderedDict-based LRU cache for inference results. O(1) get/put.
"""
import hashlib
import json
import threading
from collections import OrderedDict
from typing import Any, Optional


class LRUCache:
    def __init__(self, capacity: int = 256):
        self.capacity = capacity
        self._store: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    @staticmethod
    def make_key(model_id: str, payload: dict) -> str:
        serialized = json.dumps(payload, sort_keys=True)
        digest = hashlib.sha256(serialized.encode()).hexdigest()
        return f"{model_id}:{digest}"

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._store:
                self.misses += 1
                return None
            self._store.move_to_end(key)
            self.hits += 1
            return self._store[key]

    def put(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = value
            if len(self._store) > self.capacity:
                self._store.popitem(last=False)

    def stats(self) -> dict:
        with self._lock:
            total = self.hits + self.misses
            return {
                "size": len(self._store),
                "capacity": self.capacity,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": round(self.hits / total, 4) if total else 0.0,
            }


prediction_cache = LRUCache(capacity=256)
