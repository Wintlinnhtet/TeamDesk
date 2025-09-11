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

# --- replace _ser(...) ---
def _ser(n):
    created = n.get("created_at")
    if isinstance(created, datetime):
        created = created.isoformat() + "Z"
    body = n.get("message")  # DB field is 'message'
    return {
        "_id": str(n.get("_id")),
        "type": n.get("type"),
        "title": n.get("title"),
        "body": body,           # ← UI-friendly
        "message": body,        # ← keep legacy too
        "data": n.get("data") or {},
        "created_at": created,
        "read": bool(n.get("read")),
    }

@bp_notifications.get("/")
def list_notifications():
    uid = _oid(request.args.get("for_user"))
    if not uid:
        return jsonify([]), 200
    cur = col.find({
        "$or": [{"for_user": uid}, {"user_id": uid}]   # ← support legacy docs
    }).sort("created_at", -1).limit(100)
    return jsonify([_ser(n) for n in cur]), 200

@bp_notifications.get("/unread_count")
def unread_count():
    uid = _oid(request.args.get("for_user"))
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
    uid = _oid(data.get("for_user"))
    if not uid:
        return jsonify({"updated": 0}), 200
    res = col.update_many(
        {"read": {"$ne": True}, "$or": [{"for_user": uid}, {"user_id": uid}]},
        {"$set": {"read": True}}
    )
    return jsonify({"updated": int(res.modified_count)}), 200


@bp_notifications.route("/<nid>", methods=["DELETE", "OPTIONS"])
def delete_notification(nid):
    # handle preflight cleanly
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        _id = ObjectId(str(nid))
    except Exception:
        return jsonify({"error": "invalid id"}), 400
    res = db["notifications"].delete_one({"_id": _id})
    return jsonify({"ok": True, "deleted_count": getattr(res, "deleted_count", 0)}), 200
