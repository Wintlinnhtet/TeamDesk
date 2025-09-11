from datetime import datetime, timedelta, timezone
from bson import ObjectId
from flask import Blueprint, request, jsonify
from backend.database import db
from backend.notifier import notify_users

bp_notifications = Blueprint("notifications", __name__)
col = db["notifications"]

def _oid(x):
    try:
        return ObjectId(str(x))
    except Exception:
        return None

# --- NEW: robust UTC parser (handles naive ISO, "Z", etc.) ---
def _as_dt_utc(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if not v:
        return None
    s = str(v).strip()
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

@bp_notifications.post("/run_deadline_scan")
def run_deadline_scan():
    """
    Create 'deadline' notifications for tasks due within the next `days` (default 1 day).
    De-dupe once per task per day.
    Optional query params:
      - days: int (default 1)
      - lookback_hours: int (default 24)  # kept for parity, not strictly needed here
      - include_leader: 0/1 (default 0)
      - only_for_user: user id (limit to a single user)
    """
    tasks = db["tasks"]
    notis = db["notifications"]
    projects = db["projects"]

    # --- read options ---
    try:
        days = int(request.args.get("days", "1") or 1)
    except Exception:
        days = 1
    try:
        lookback_hours = int(request.args.get("lookback_hours", "24") or 24)
    except Exception:
        lookback_hours = 24
    include_leader = (str(request.args.get("include_leader", "0")).strip().lower() in {"1","true","yes","y"})
    only_for_user = _oid(request.args.get("only_for_user"))

    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=max(1, days))
    today0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # kept for future use if you want to skip duplicates in a rolling window
    recent = now - timedelta(hours=max(1, lookback_hours))

    # --- find candidate tasks (not done, with end_at) ---
    q = {
        "status": {"$nin": ["done", "complete", "completed", "finished"]},
        "end_at": {"$ne": None}
    }
    if only_for_user:
        # tolerate ObjectId / string in your collection
        q["assignee_id"] = {"$in": [only_for_user, str(only_for_user)]}

    cur = tasks.find(q, {"_id": 1, "title": 1, "end_at": 1, "assignee_id": 1, "project_id": 1})

    checked = 0
    sent = 0
    for t in cur:
        checked += 1
        end_dt = _as_dt_utc(t.get("end_at"))
        if not end_dt:
            continue
        if end_dt > soon:
            continue

        task_id_str = str(t["_id"])

        # --- daily de-dupe: ensure we didn't already create a deadline noti for this task today ---
        if notis.find_one({
            "type": "deadline",
            "created_at": {"$gte": today0},
            "data.task_id": task_id_str   # ✅ compare string with string
        }):
            continue

        # --- recipients: assignee (and optionally project leader) ---
        recipients = []
        aid = t.get("assignee_id")
        if aid:
            recipients.append(aid)

        if include_leader and t.get("project_id"):
            proj = projects.find_one({"_id": t["project_id"]}, {"leader_id": 1})
            lid = (proj or {}).get("leader_id")
            if lid and str(lid) != str(aid):  # avoid sending twice to same person
                recipients.append(lid)

        if only_for_user:
            recipients = [r for r in recipients if str(r) == str(only_for_user)]
        if not recipients:
            continue

        due_txt = end_dt.isoformat().replace("+00:00", "Z")
        title = "Deadline approaching"
        body = f"‘{t.get('title', 'Task')}’ is due by {due_txt}."
        data = {
            "task_id": task_id_str,
            "project_id": (str(t["project_id"]) if t.get("project_id") else None),
            "end_at": due_txt,
            "window_days": int(days)
        }

        try:
            # notifier.notify_users writes 'message' in DB and emits realtime
            notify_users(recipients, "deadline", title, body, data)
            sent += len(recipients)
        except Exception:
            # best-effort; keep scanning
            pass

    return jsonify({"checked": checked, "sent": sent}), 200


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
