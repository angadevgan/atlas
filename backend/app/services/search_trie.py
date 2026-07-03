"""
Trie (prefix tree) for global search autocomplete over model/dataset names.

Why a Trie over a SQL LIKE '%query%' scan: prefix lookup is O(k) where k is
the length of the search string, independent of how many models/datasets
exist -- a SQL LIKE with a leading wildcard can't use an index and degrades
to a full table scan as the catalog grows. The Trie is rebuilt from the DB
periodically / on write, trading a bit of memory for fast autocomplete.
"""
import threading
from dataclasses import dataclass, field


@dataclass
class _TrieNode:
    children: dict = field(default_factory=dict)
    is_end: bool = False
    # store (id, type, display_name) tuples for exact matches ending here
    entries: list = field(default_factory=list)


class Trie:
    def __init__(self):
        self._root = _TrieNode()
        self._lock = threading.Lock()

    def insert(self, text: str, entry_id: str, entry_type: str, display_name: str):
        with self._lock:
            node = self._root
            for ch in text.lower():
                node = node.children.setdefault(ch, _TrieNode())
            node.is_end = True
            node.entries.append({"id": entry_id, "type": entry_type, "name": display_name})

    def search_prefix(self, prefix: str, limit: int = 10) -> list[dict]:
        with self._lock:
            node = self._root
            for ch in prefix.lower():
                if ch not in node.children:
                    return []
                node = node.children[ch]

            results: list[dict] = []
            self._collect(node, results, limit)
            return results[:limit]

    def _collect(self, node: _TrieNode, results: list, limit: int):
        if len(results) >= limit:
            return
        if node.is_end:
            results.extend(node.entries)
        for child in node.children.values():
            if len(results) >= limit:
                return
            self._collect(child, results, limit)

    def clear(self):
        with self._lock:
            self._root = _TrieNode()


search_trie = Trie()


def rebuild_search_trie(db_session_factory):
    """Call after any create/rename/delete of a model or dataset."""
    from app.models.models import MLModel, Dataset

    db = db_session_factory()
    try:
        search_trie.clear()
        for m in db.query(MLModel).all():
            search_trie.insert(m.name, m.id, "model", m.name)
        for d in db.query(Dataset).all():
            search_trie.insert(d.filename, d.id, "dataset", d.filename)
    finally:
        db.close()
