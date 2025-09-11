# src/backend/notifications.py
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify
from backend.database import db

bp_notifications = Blueprint("notifications", __name__)
col = db["notifications"]

def _oid(x):
    try:
        return ObjectId(str(x))
    except Exception:
        return None

# NEW: derive uid from query, headers, or cookie (so panel works even if it forgets the param)
def _uid_from_request():
    candidate = (
        request.args.get("for_user") or
        request.args.get("user_id")  or
        request.headers.get("X-User-Id") or
        request.cookies.get("user_id")
    )
    return _oid(candidate)

def _ser(n):
    created = n.get("created_at")
    if isinstance(created, datetime):
        created = created.isoformat() + "Z"
    body = n.get("message")           # stored field is 'message'
    return {
        "_id": str(n.get("_id")),
        "type": n.get("type"),
        "title": n.get("title"),
        "body": body,                  # ← what your UI renders
        "message": body,               # ← legacy alias
        "data": n.get("data") or {},
        "created_at": created,
        "read": bool(n.get("read")),
    }


# Support both /notifications and /notifications/ and filtering by unread

# notifications.py
@bp_notifications.get("/", strict_slashes=False)

def list_notifications():
    uid = _uid_from_request()
    if not uid:
        return jsonify([]), 200

    unread = (request.args.get("unread", "").strip().lower() in {"1","true","yes","y"})
    q = {"$or": [{"for_user": uid}, {"user_id": uid}]}
    if unread:
        q["read"] = {"$ne": True}

    try:
        limit = int(request.args.get("limit", "100") or 100)
    except Exception:
        limit = 100

    cur = col.find(q).sort("created_at", -1).limit(limit)
    return jsonify([_ser(n) for n in cur]), 200

@bp_notifications.get("/unread_count")
def unread_count():
    uid = _uid_from_request()
    if not uid:
        return jsonify({"count": 0}), 200
    n = col.count_documents({
        "$and": [
            {"read": {"$ne": True}},
            {"$or": [{"for_user": uid}, {"user_id": uid}]}
        ]
    })
    return jsonify({"count": int(n)}), 200

@bp_notifications.post("/mark_all_read")
def mark_all_read():
    data = request.get_json() or {}
    # prefer body-provided for_user, else fall back to headers/query/cookie
    uid = _oid(data.get("for_user")) or _uid_from_request()
    if not uid:
        return jsonify({"updated": 0}), 200
    res = col.update_many(
        {"read": {"$ne": True}, "$or": [{"for_user": uid}, {"user_id": uid}]},
        {"$set": {"read": True}}
    )
    return jsonify({"updated": int(res.modified_count)}), 200

@bp_notifications.route("/<nid>", methods=["DELETE", "OPTIONS"])
def delete_notification(nid):
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        _id = ObjectId(str(nid))
    except Exception:
        return jsonify({"error": "invalid id"}), 400
    res = db["notifications"].delete_one({"_id": _id})
    return jsonify({"ok": True, "deleted_count": getattr(res, "deleted_count", 0)}), 200
