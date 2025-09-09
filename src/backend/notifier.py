# src/backend/notifier.py
from datetime import datetime
from bson import ObjectId
from backend.database import db

_notifications = db["notifications"]
_users = db["users"]

def _oid(x):
    """Coerce any id-ish value to ObjectId, else None."""
    try:
        return x if isinstance(x, ObjectId) else ObjectId(str(x))
    except Exception:
        return None

def _ensure_indexes():
    """Helpful indexes for lookups & ordering (runs best-effort)."""
    try:
        _notifications.create_index("for_user")
        _notifications.create_index([("for_user", 1), ("read", 1)])
        _notifications.create_index([("created_at", -1)])
    except Exception:
        # non-fatal if Mongo user lacks createIndex privilege
        pass

_ensure_indexes()

def _insert(for_user, kind, title, body, data=None):
    """
    Insert a single notification row for one user.
    Schema matches your existing code:
      - for_user: ObjectId (recipient)
      - type, title, message, data
      - read: False
      - created_at: datetime.utcnow()
    Returns inserted _id as str, or None if invalid.
    """
    oid = _oid(for_user)
    if not oid:
        return None

    doc = {
        "for_user": oid,
        "type": str(kind or ""),
        "title": str(title or ""),
        "message": str(body or ""),
        "data": data or {},
        "read": False,
        "created_at": datetime.utcnow(),  # always “now” (UTC)
    }
    res = _notifications.insert_one(doc)
    return str(res.inserted_id)

def notify_admins(kind, title, body, data=None) -> int:
    """
    Create one notification per admin/superadmin/owner.
    Returns the count of inserted documents.
    """
    roles = {"admin", "superadmin", "owner"}
    cursor = _users.find({"role": {"$in": list(roles)}}, {"_id": 1})
    n = 0
    for u in cursor:
        if _insert(u["_id"], kind, title, body, data):
            n += 1
    return n

def notify_users(user_ids, kind, title, body, data=None) -> int:
    """
    Create per-user notifications.
    Returns the count of inserted documents.
    """
    n = 0
    for uid in (user_ids or []):
        oid = _oid(uid)
        if not oid:
            continue
        if _insert(oid, kind, title, body, data):
            n += 1
    return n

# Keep legacy import patterns working:
def send_to_users(user_ids, kind, title, body, data=None) -> int:
    return notify_users(user_ids, kind, title, body, data)
