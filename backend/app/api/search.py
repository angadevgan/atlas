from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.models.models import User
from app.services.search_trie import search_trie

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search(q: str = Query(..., min_length=1), user: User = Depends(get_current_user)):
    results = search_trie.search_prefix(q, limit=10)
    return {"query": q, "results": results}
