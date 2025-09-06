# src/backend/notifier.py
from datetime import datetime
from bson import ObjectId
from backend.database import db

_notifications = db["notifications"]
_users = db["users"]

def _oid(x):
    try:
        return ObjectId(str(x))
    except Exception:
        return None

def _insert(for_user, kind, title, body, data=None):
    doc = {
        "for_user": _oid(for_user),
        "type": kind,
        "title": title,
        "message": body,
        "data": data or {},
        "read": False,
        "created_at": datetime.utcnow(),
    }
    ins = _notifications.insert_one(doc)
    return str(ins.inserted_id)

def notify_admins(kind, title, body, data=None) -> int:
    """Create the same notification for every admin/superadmin/owner."""
    roles = ["admin", "superadmin", "owner"]
    admins = _users.find({"role": {"$in": roles}}, {"_id": 1})
    n = 0
    for a in admins:
        _insert(a["_id"], kind, title, body, data)
        n += 1
    return n

def notify_users(user_ids, kind, title, body, data=None) -> int:
    """Create per-user notifications."""
    n = 0
    for uid in user_ids or []:
        oid = _oid(uid)
        if not oid:
            continue
        _insert(oid, kind, title, body, data)
        n += 1
    return n
