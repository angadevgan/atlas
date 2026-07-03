"""
Min-heap priority queue for training job scheduling.
O(log n) insert/pop instead of an O(n) scan for the highest-priority job.
"""
import heapq
import itertools
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Optional


@dataclass(order=True)
class _QueueItem:
    priority: int
    seq: int
    job_id: str = field(compare=False)
    payload: Any = field(compare=False)


class JobPriorityQueue:
    def __init__(self):
        self._heap: list[_QueueItem] = []
        self._lock = threading.Lock()
        self._counter = itertools.count()
        self._not_empty = threading.Condition(self._lock)

    def push(self, job_id: str, payload: Any, priority: int = 5) -> None:
        with self._not_empty:
            item = _QueueItem(priority=priority, seq=next(self._counter), job_id=job_id, payload=payload)
            heapq.heappush(self._heap, item)
            self._not_empty.notify()

    def pop(self, block: bool = True, timeout: Optional[float] = None) -> Optional[_QueueItem]:
        with self._not_empty:
            if not self._heap and block:
                self._not_empty.wait(timeout=timeout)
            if not self._heap:
                return None
            return heapq.heappop(self._heap)

    def __len__(self) -> int:
        with self._lock:
            return len(self._heap)


class JobWorker:
    def __init__(self, queue: JobPriorityQueue, handler: Callable[[str, Any], None]):
        self.queue = queue
        self.handler = handler
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()

    def _run(self):
        while not self._stop_event.is_set():
            item = self.queue.pop(block=True, timeout=1.0)
            if item is None:
                continue
            try:
                self.handler(item.job_id, item.payload)
            except Exception as exc:  # noqa: BLE001
                print(f"[JobWorker] job {item.job_id} failed: {exc}")


training_queue = JobPriorityQueue()
