from flask import  Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from backend.database import db
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
# at the top of app.py
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
import json
from flask_socketio import emit, join_room, leave_room
import re
from werkzeug.utils import secure_filename
import os, time
from backend.extensions import socketio

# near other imports

from bson import ObjectId
# --- add at the very top of app.py ---
import os, sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 

PARENT_DIR = os.path.dirname(BASE_DIR) 

     
# --- uploads config (ONE place only) ---



if PARENT_DIR not in sys.path:

    sys.path.insert(0, PARENT_DIR)


from backend.notifications import bp_notifications
from backend.notifier import notify_admins, notify_users

from backend.database import get_db


from backend.file_sharing import file_sharing_bp


app = Flask(__name__)
CORS(app)  # Your existing CORS setup //y2


# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
SERVER_IP = "192.168.1.7"

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5137",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5137",
    f"http://{SERVER_IP}:5137",
    
]

socketio.init_app(
    app,
    cors_allowed_origins=FRONTEND_ORIGINS,
    async_mode="eventlet"  # or "gevent"
)
# ✅ Register file_sharing blueprint
app.register_blueprint(file_sharing_bp)

# ---- rooms (one per project) ----
@socketio.on("join", namespace="/rt")
def on_join(data):
    pid = data.get("projectId")
    if pid:
        join_room(pid)

@socketio.on("leave", namespace="/rt")
def on_leave(data):
    pid = data.get("projectId")
    if pid:
        leave_room(pid)
# --- user rooms (one room per user) ---
@socketio.on("user:join", namespace="/rt")
def on_user_join(data):
    uid = (data or {}).get("userId")
    if uid:
        join_room(f"user:{uid}")

@socketio.on("user:leave", namespace="/rt")
def on_user_leave(data):
    uid = (data or {}).get("userId")
    if uid:
        leave_room(f"user:{uid}")

# after FRONTEND_ORIGINS
ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Actor-Id", "X-Actor-Name", "X-User-Id"]


CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=ALLOWED_HEADERS,
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)



# run once at boot and then every 10 minutes
def _deadline_scan_job():
    try:
        # import inside the job to avoid circular imports on app startup
        from backend.notifications import scan_and_send_deadlines
        res = scan_and_send_deadlines(days=7, lookback_hours=24, include_leader=False)
        # (optional) you can log res if you have logging configured
        # print("deadline scan:", res)
    except Exception:
        pass

def _preflight_ok():
    origin = request.headers.get("Origin", "")
    h = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get(
            "Access-Control-Request-Headers", "Content-Type, Authorization"
        ),
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }
    if origin in FRONTEND_ORIGINS:
        h["Access-Control-Allow-Origin"] = origin
    resp = app.make_response(("", 204))
    for k, v in h.items():
        resp.headers[k] = v
    return resp


# ❌ REMOVE this old handler:
# @app.before_request
# def handle_preflight():
#     if request.method == "OPTIONS":
#         return app.make_response(("", 204))

# ✅ Keep a single catch for OPTIONS (you already have some; this one is a safety net)
@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def catch_all_options(path):
    return _preflight_ok()

# where you create the app and register blueprints
app.register_blueprint(bp_notifications, url_prefix="/notifications")
scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(_deadline_scan_job, "interval", minutes=1, id="deadline_scan_every_10m")
# kick one pass a few seconds after startup so you get immediate notis when the server comes up
scheduler.add_job(_deadline_scan_job, "date", run_date=datetime.now(timezone.utc) + timedelta(seconds=5), id="deadline_scan_bootstrap")
scheduler.start()
def _iso_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    # RFC3339-like with trailing Z
    return dt.isoformat().replace("+00:00", "Z")

def _jsonable(value):
    if isinstance(value, datetime):
        return _iso_utc(value)
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    return value
# --- explicit preflights ---
@app.route("/projects", methods=["OPTIONS"])
def options_projects():
    return _preflight_ok()

@app.route("/projects/<project_id>", methods=["OPTIONS"])
def options_project_detail(project_id):
    return _preflight_ok()

@app.route("/tasks", methods=["OPTIONS"])
def options_tasks():
    return _preflight_ok()

@app.route("/tasks/<task_id>", methods=["OPTIONS"])
def options_task_detail(task_id):
    return _preflight_ok()

@app.route("/members", methods=["OPTIONS"])
def options_members():
    return _preflight_ok()

# --- collections ---
users_collection = db["users"]
projects_collection = db["projects"]
tasks_collection   = db["tasks"]
announcement_collection = db["announcement"]
notifications_collection = db.get_collection("notifications")

def get_request_user_oid():
    uid = request.headers.get("X-User-Id") or request.args.get("user_id")
    if not uid:
        data = request.get_json(silent=True) or {}
        uid = data.get("user_id")
    return to_object_id(uid) if uid else None

def _public_user_doc(u):
    img = (u.get("profileImage") or "").strip() 
    return {
        "id": str(u["_id"]),
        "name": u.get("name", ""),
        "position": u.get("position", ""),
        "email": u.get("email", ""),
        "address": u.get("address", ""),
        "phone": u.get("phone", ""),
        "profileImage": img,
    }

@app.route("/api/profile", methods=["GET", "PUT"])
def api_profile():
    uid = get_request_user_oid()
    if not uid:
        return jsonify({"error": "Missing user_id"}), 400

    # 1) Read the user first (avoid UnboundLocalError)
    u = users_collection.find_one({"_id": uid})
    if not u:
        return jsonify({"error": "User not found"}), 404

    # 2) If profileImage is missing, set a default once and reflect it in the response
   
    if request.method == "GET":
        return jsonify(_public_user_doc(u)), 200

    # PUT: update non-password fields only
    data = request.get_json() or {}
    updates = {}
    for key in ["name", "position", "email", "address", "phone"]:
        if key in data:
            updates[key] = (data.get(key) or "").strip()

    if not updates:
        return jsonify({"error": "No changes"}), 400

    updates["updated_at"] = datetime.now(timezone.utc)

    users_collection.update_one({"_id": uid}, {"$set": updates})
    u2 = users_collection.find_one({"_id": uid})
    return jsonify({"ok": True, "user": _public_user_doc(u2)}), 200

@app.route("/api/profile/password", methods=["PUT"])
def api_profile_password():
    uid = get_request_user_oid()
    if not uid:
        return jsonify({"error": "Missing user_id"}), 400

    u = users_collection.find_one({"_id": uid})
    if not u:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    current_password = (data.get("current_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400

    # Verify current password
    stored_hash = u.get("password") or ""
    try:
      ok = check_password_hash(stored_hash, current_password)
    except Exception:
      ok = False
    if not ok:
      return jsonify({"error": "Current password is incorrect"}), 400

    # Update to new password
    try:
        new_hash = generate_password_hash(new_password, method="scrypt")
    except Exception:
        new_hash = generate_password_hash(new_password, method="pbkdf2:sha256", salt_length=16)

    users_collection.update_one({"_id": uid}, {"$set": {"password": new_hash, "updated_at": datetime.now(timezone.utc)
}})
    return jsonify({"ok": True}), 200


@app.route("/api/upload-profile-image", methods=["POST"])
def api_upload_profile_image():
    uid = get_request_user_oid()
    if not uid:
        return jsonify({"error": "Missing user_id"}), 400

    u = users_collection.find_one({"_id": uid})
    if not u:
        return jsonify({"error": "User not found"}), 404

    if "profileImage" not in request.files:
        return jsonify({"error": "No file"}), 400

    f = request.files["profileImage"]
    if not f or f.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    filename = secure_filename(f.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"

    # remove old file if it was an uploaded file (we don't delete the default cat2.jpg)
    old = u.get("profileImage") or ""
    if old.startswith("/uploads/"):
        try:
            os.remove(os.path.join(UPLOAD_DIR, os.path.basename(old)))
        except Exception:
            pass

    new_name = f"{str(uid)}_{int(time.time())}.{ext}"
    path = os.path.join(UPLOAD_DIR, new_name)
    f.save(path)

    image_url = f"/uploads/{new_name}"
    users_collection.update_one(
        {"_id": uid},
        {"$set": {"profileImage": image_url, "updated_at": datetime.now(timezone.utc)
}}
    )

    return jsonify({"ok": True, "imageUrl": image_url, "profileImage": image_url}), 200
# (keep this)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_DIR

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=False)
     # .../src/backend
# If any code elsewhere uses app.config['UPLOAD_FOLDER'], point it here too:

           # .../src

def _notify_admins(kind: str, title: str, body: str, data: dict | None = None):
    try:
        notify_admins(kind=kind, title=title, body=body, data=data or {})
        return
    except Exception:
        pass

    admin_roles = ["admin", "owner", "superadmin"]
    admin_ids = [u["_id"] for u in users_collection.find({"role": {"$in": admin_roles}}, {"_id": 1})]
    now = datetime.now(timezone.utc)

    base = {
        "type": kind,
        "title": title,
        "message": body,          # ✅ FIX: must be 'message' (not 'body')
        "data": data or {},
        "created_at": now,
        "read": False,
    }
    for uid in admin_ids:
        try:
            notifications_collection.insert_one({**base, "for_user": uid})
            # ✅ push realtime
            socketio.emit("notify:new", {
                "type": base["type"],
                "title": base["title"],
                "body": base["message"],
                "data": base["data"],
                "created_at": base["created_at"].isoformat().replace("+00:00", "Z"),
                "read": False,
            }, namespace="/rt", to=f"user:{str(uid)}")

            # optional: push unread count for the bell
            cnt = notifications_collection.count_documents({"for_user": uid, "read": {"$ne": True}})
            socketio.emit("notifications:unread_count",
                {"user_id": str(uid), "count": int(cnt)},
                namespace="/rt", to=f"user:{str(uid)}")
        except Exception:
            pass

# replace _notify_users in app.py
def _notify_users(user_ids: list, kind: str, title: str, body: str, data: dict | None = None):
    try:
        notify_users(user_ids=user_ids, kind=kind, title=title, body=body, data=data or {})
        return
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    base = {
        "type": kind,
        "title": title,
        "message": body,          # ✅ use 'message' in DB
        "data": data or {},
        "created_at": now,
        "read": False,
    }
    for uid in user_ids or []:
        try:
            uid_obj = uid if isinstance(uid, ObjectId) else ObjectId(str(uid))
        except Exception:
            continue
        try:
            notifications_collection.insert_one({**base, "for_user": uid_obj})
        except Exception:
            pass


def to_object_id(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None
# --- helpers to filter self-notifications ------------------------------------
ADMIN_ROLES = {"admin", "owner", "superadmin"}

def _is_admin_user(user_id: ObjectId | None) -> bool:
    if not user_id:
        return False
    try:
        u = users_collection.find_one({"_id": user_id}, {"role": 1})
        return (u or {}).get("role") in ADMIN_ROLES
    except Exception:
        return False

def _notify_admins_excluding_actor(*, kind: str, title: str, body: str, data: dict | None = None, actor_id: ObjectId | None = None):
    """
    Notify all admins EXCEPT the actor (if the actor is an admin).
    Falls back to writing docs if notifier isn't available.
    """
    if actor_id and _is_admin_user(actor_id):
        # manual fan-out, excluding actor
        ids = [u["_id"] for u in users_collection.find(
            {"role": {"$in": list(ADMIN_ROLES)}, "_id": {"$ne": actor_id}},
            {"_id": 1}
        )]
        _notify_users(ids, kind=kind, title=title, body=body, data=data or {})
        return

    # otherwise use the normal admin-notify path
    _notify_admins(kind=kind, title=title, body=body, data=data or {})

# ---------- make ALL preflights succeed ----------
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return app.make_response(("", 204))

@app.after_request
def add_cors_headers(resp):
    origin = request.headers.get("Origin", "")
    if origin in FRONTEND_ORIGINS:
        # reflect only known origins
        resp.headers.setdefault("Access-Control-Allow-Origin", origin)
        resp.headers.setdefault("Vary", "Origin")
        resp.headers.setdefault("Access-Control-Allow-Credentials", "true")
    # keep these fallbacks
    req_acrh = request.headers.get("Access-Control-Request-Headers", "")
    if req_acrh:
        resp.headers.setdefault("Access-Control-Allow-Headers", req_acrh)
    else:
        resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    return resp

# --- health check ---
@app.get("/ping")
def ping():
    return jsonify({"ok": True, "from": "flask"})
# ---- replace the whole _actor_from_request with this ----

# --- actor helper (REPLACE existing function) ---
def _actor_from_request(data=None):
    """
    Tries HARD to derive the acting user from:
      - request JSON body: updated_by / actor_id / user_id (+ *_name)
      - request headers:   X-Actor-Id / X-User-Id / X-UserId / X-Uid
                           X-Actor-Name / X-User-Name / X-Username
      - cookies:           user_id / user_name (if you ever set them)
      - DB lookup:         if we get an id but no name, fetch name/email
    Returns: (ObjectId | None, display_name: str)
    """
    data = data or {}

    # 1) body fields
    uid_raw  = data.get("updated_by") or data.get("actor_id") or data.get("user_id") or data.get("created_by")
    name_raw = data.get("updated_by_name") or data.get("actor_name") or data.get("user_name")

    # 2) headers
    hdr = request.headers
    uid_hdr = (
        hdr.get("X-Actor-Id") or hdr.get("X-User-Id") or
        hdr.get("X-UserId")  or hdr.get("X-Uid")
    )
    name_hdr = (
        hdr.get("X-Actor-Name") or hdr.get("X-User-Name") or
        hdr.get("X-Username")
    )
    uid_raw  = uid_raw  or uid_hdr
    name_raw = name_raw or name_hdr

    # 3) cookies (optional)
    if not uid_raw:
        cid = request.cookies.get("user_id")
        if cid:
            uid_raw = cid
    if not name_raw:
        cname = request.cookies.get("user_name")
        if cname:
            name_raw = cname

    # 4) coerce id, lookup name if missing
    uid = None
    if uid_raw:
        try:
            uid = ObjectId(str(uid_raw))
        except Exception:
            uid = None

    if uid and not name_raw:
        u = users_collection.find_one({"_id": uid}, {"name": 1, "email": 1})
        if u:
            name_raw = u.get("name") or u.get("email")

    # Final display name
    display = (name_raw or "").strip()
    if not display and uid:
        # last-ditch: show email if available
        u = users_collection.find_one({"_id": uid}, {"email": 1})
        display = (u or {}).get("email", "")

    return uid, (display or "Someone")


def _safe_str_id(x):
    try:
        return str(x)
    except Exception:
        return None
def _normalize_confirm_value(val):
    if isinstance(val, bool):
        return 1 if val else 0
    try:
        if isinstance(val, (int, float)):
            return 1 if int(val) else 0
    except Exception:
        pass
    if isinstance(val, str):
        return 1 if val.strip().lower() in {"1", "true", "yes", "y", "on"} else 0
    return 0

def _safe_parse_experience(exp_value):
    """
    Accepts None / JSON string / list and returns a list.
    """
    if exp_value is None:
        return []
    if isinstance(exp_value, list):
        return exp_value
    if isinstance(exp_value, str):
        try:
            parsed = json.loads(exp_value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []
def _id_to_str(x):
    if isinstance(x, ObjectId):
        return str(x)
    if isinstance(x, dict) and "$oid" in x:
        return str(x["$oid"])
    if x is None:
        return None
    s = str(x)
    try:
        return str(ObjectId(s))
    except Exception:
        return s

def _safe_serialize_experience(original_value, exp_list):
    """
    Preserve original type: if user had a JSON string, write back string; else write list.
    """
    if isinstance(original_value, str):
        try:
            return json.dumps(exp_list, ensure_ascii=False)
        except Exception:
            # last resort
            return json.dumps([])
    return exp_list
# put this in app.py, replacing your previous _write_member_experience_for_confirmed_project
def _write_member_experience_for_confirmed_project(pid: ObjectId):
    """
    On project confirm, write experience ONLY for users who had a task project_role.
    - Do not add an entry that is just "Leader".
    - If a user is the leader AND had a role, append " (Leader)" to that role.
    - Skip users without any project_role on tasks.
    """
    proj = projects_collection.find_one({"_id": pid}, {"name": 1, "leader_id": 1})
    if not proj:
        return

    proj_name = (proj.get("name") or "Untitled Project").strip()
    leader_id = proj.get("leader_id")

    # Collect roles per user from tasks (non-empty project_role only)
    roles_by_user: dict[ObjectId, set[str]] = {}
    try:
        cur = tasks_collection.find(
            {"$or": [{"project_id": pid}, {"project_id": str(pid)}]},
            {"assignee_id": 1, "project_role": 1}
        )
        for t in cur:
            role = (t.get("project_role") or "").strip()
            if not role:
                continue
            aid = t.get("assignee_id")
            try:
                aid = aid if isinstance(aid, ObjectId) else ObjectId(str(aid))
            except Exception:
                continue
            roles_by_user.setdefault(aid, set()).add(role)
    except Exception:
        return  # best-effort

    when = datetime.now(timezone.utc)

    for uid, roles in roles_by_user.items():
        # Only write if the user actually has at least one role
        if not roles:
            continue
        try:
            u = users_collection.find_one({"_id": uid}, {"experience": 1})
            current = _safe_load_experience(u.get("experience") if u else None)

            is_leader = (leader_id == uid) if leader_id else False
            for role in sorted(roles):
                title = f"{role} (Leader)" if is_leader else role

                # dedupe on (project, title)
                exists = any(
                    isinstance(item, dict)
                    and item.get("project", "").strip().lower() == proj_name.lower()
                    and item.get("title", "").strip().lower() == title.lower()
                    for item in current
                )
                if exists:
                    continue

                current.append({
                    "title": title,
                    "project": proj_name,
                    "time": _relative_month_label(when)
                })

            # store as JSON string (matches your existing schema)
            users_collection.update_one(
                {"_id": uid},
                {"$set": {"experience": json.dumps(current, ensure_ascii=False)}}
            )
        except Exception:
            # keep going for other users
            continue

@app.post("/add-member")
def add_member():
    data = request.get_json() or {}
    email = data.get("email")
    position = data.get("position")
    if not email or not position:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash("12345")  # demo only
    users_collection.insert_one({
        "email": email,
        "position": position,
        "password": hashed_password,
        "role": "member",
        "alreadyRegister": False  # 🔥 boolean field
    })
    return jsonify({"message": "Member added successfully!"}), 201

# -------------------- register USER --------------------
# Update user endpoint
@app.patch("/update-user/<user_id>")
def update_user(user_id):
    # Get text fields from form
    name = request.form.get("name")
    dob = request.form.get("dob")
    phone = request.form.get("phone")
    address = request.form.get("address")
    password = request.form.get("password")

    if not name or not dob or not phone or not address or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash(password)

    # Handle profile image (optional)
    profile_image_filename = None
    if "profileImage" in request.files:
        file = request.files["profileImage"]
        if file.filename != "" and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
            profile_image_filename = filename  # Save only filename in DB

    update_data = {
        "name": name,
        "dob": dob,
        "phone": phone,
        "address": address,
        "password": hashed_password,
        "alreadyRegister": True
    }

    if profile_image_filename:
        update_data["profileImage"] = profile_image_filename  # Store filename in DB

    try:
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            return jsonify({"error": "Update failed"}), 400
        return jsonify({"message": "Profile updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




# -------------------- SIGN IN --------------------
@app.post("/signin")
def signin():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Signin successful",
        "user": {
            "_id": str(user["_id"]),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "profileImage": user.get("profileImage", ""),
            "alreadyRegister": user.get("alreadyRegister", False)  # 🔥 include boolean
        }
    })

# -------------------- USERS (lookup by ids) --------------------
# -------------------- USERS (lookup by ids) --------------------
@app.get("/users")
def get_users_by_ids():
    ids_param = (request.args.get("ids") or "").strip()
    if not ids_param:
        return jsonify([]), 200

    raw_ids = [s.strip() for s in ids_param.split(",") if s.strip()]
    oids = []
    for s in raw_ids:
        oid = to_object_id(s)
        if oid:
            oids.append(oid)

    if not oids:
        return jsonify([]), 200

    # ✅ include profileImage in projection
    cursor = users_collection.find(
        {"_id": {"$in": oids}},
        {"email": 1, "name": 1, "profileImage": 1, "picture": 1, "avatar": 1, "avatar_url": 1, "profile": 1}
    )

    out = []
    for u in cursor:
        # ✅ prefer profileImage, then other possible fields
        pic = (
            (u.get("profileImage") or "").strip()
            or (u.get("picture") or "").strip()
            or ((u.get("profile") or {}).get("photo") or "").strip()
            or (u.get("avatar_url") or "").strip()
            or (u.get("avatar") or "").strip()
        )
        out.append({
            "_id": str(u["_id"]),
            "email": u.get("email", ""),
            "name": u.get("name", ""),
            "picture": pic,  # frontend will prefix API_BASE for /uploads/*
        })
    return jsonify(out), 200

# -------------------- MEMBERS (list all selectable *non-admin* users) --------------------
@app.get("/members")
def list_members():
    """
    Returns users to populate the member picker.
    Filters OUT admin/superadmin/owner accounts.

    Optional:
      - q=<text>                 (search name/email contains)
      - exclude_project=<pid>    (omit users already in this project)
    """
    qtext = (request.args.get("q") or "").strip().lower()
    exclude_pid = (request.args.get("exclude_project") or "").strip()

    exclude_ids = set()
    if exclude_pid:
        try:
            pid = ObjectId(exclude_pid)
            proj = projects_collection.find_one({"_id": pid}, {"member_ids": 1})
            if proj:
                for mid in proj.get("member_ids", []):
                    try:
                        exclude_ids.add(str(mid))
                    except Exception:
                        pass
        except Exception:
            pass

    base_filter = {"role": {"$nin": ["admin", "superadmin", "owner"]}}
    projection = {"email": 1, "name": 1, "avatar": 1, "avatar_url": 1, "picture": 1, "profile": 1, "role": 1,"profileImage": 1,}

    cursor = users_collection.find(base_filter, projection)
    out = []
    for u in cursor:
        uid = str(u["_id"])
        if uid in exclude_ids:
            continue
        name = (u.get("name") or "").strip()
        email = (u.get("email") or "").strip()
        if qtext and (qtext not in name.lower() and qtext not in email.lower()):
            continue
        out.append({
            "_id": uid,
            "name": name,
            "email": email,
            "avatar": (
                u.get("avatar") or u.get("avatar_url") or
                u.get("picture") or (u.get("profile") or {}).get("photo") or ""
            ),
             "profileImage": u.get("profileImage", "")
        })
    return jsonify(out), 200

# -------------------- PROGRESS helpers --------------------
DONE = {"done", "complete", "completed", "finished"}

def _parse_digits(text: str) -> int:
    if not text:
        return 0
    m = re.search(r"(\d{1,3})", str(text))
    if not m:
        return 0
    return max(0, min(100, int(m.group(1))))

def pct_from_status_like(status: str) -> int:
    if not status:
        return 0
    s = str(status).strip().lower()
    if s in DONE:
        return 100
    return _parse_digits(s)

def _as_object_id(maybe_id) -> ObjectId | None:
    if isinstance(maybe_id, ObjectId):
        return maybe_id
    try:
        return ObjectId(str(maybe_id))
    except Exception:
        return None

def _coerce_pct_from_task(task: dict) -> int:
    """
    1) Parse % from status/state (handles 'completed', 'todo,80', etc.)
    2) Prefer numeric fields if > 0
    3) If numeric = 0 but status has % > 0, use that
    """
    status_like = task.get("status") or task.get("state") or ""
    s_pct = pct_from_status_like(status_like)  # 0..100
    raw_candidates = [
        task.get("progress"),
        task.get("percent"),
        task.get("percentage"),
        task.get("progress_pct"),
        task.get("completion"),
        task.get("complete_percent"),
    ]
    n_pct = None
    for v in raw_candidates:
        if isinstance(v, (int, float)):
            n_pct = max(0, min(100, int(v)))
            break
        if isinstance(v, str) and v.strip().isdigit():
            n_pct = max(0, min(100, int(v.strip())))
            break
    if n_pct is None:
        return s_pct
    if n_pct > 0:
        return n_pct
    return s_pct if s_pct > 0 else 0

def recompute_and_store_project_progress(project_oid):
    """
    Recompute project.progress from tasks, store it, and notify:
      - admins (already done below)
      - leader
      - members (excluding leader and the actor who caused the change)
    """
    pid = project_oid if isinstance(project_oid, ObjectId) else to_object_id(project_oid)
    if not pid:
        return

    # 1) Load tasks and compute new percentage
    tasks = list(tasks_collection.find({"project_id": {"$in": [pid, str(pid)]}}))
    if not tasks:
        new_pct = 0
    else:
        vals = []
        for t in tasks:
            try:
                vals.append(int(t.get("progress", 0) or 0))
            except Exception:
                vals.append(0)
        new_pct = int(round(sum(vals) / max(1, len(vals))))

    # 2) Fetch the project (name/leader/member_ids/progress/status)
    proj = projects_collection.find_one(
        {"_id": pid},
        {"name": 1, "leader_id": 1, "member_ids": 1, "progress": 1, "status": 1}
    )
    if not proj:
        return

    old_pct = int(proj.get("progress", 0) or 0)
    if new_pct == old_pct:
        return  # nothing changed → nothing to notify

    # 3) Persist the new progress
    projects_collection.update_one({"_id": pid}, {"$set": {"progress": new_pct, "updated_at": datetime.now(timezone.utc)
}})
    payload = {"project_id": str(pid), "progress": new_pct}
    socketio.emit("project:progress", payload, namespace="/rt", to=str(pid))
    # 4) Actor (from headers/body) for exclusion in notifications
    try:
        actor_id, actor_name = _actor_from_request(request.get_json(silent=True) or {})
    except Exception:
        actor_id, actor_name = (None, None)

    actor_id_str  = _id_to_str(actor_id)
    leader_id_str = _id_to_str(proj.get("leader_id"))

    # Build member recipients (exclude leader and actor)
    member_ids = proj.get("member_ids", []) or []
    member_recips = []
    for mid in member_ids:
        ms = _id_to_str(mid)
        if not ms:
            continue
        if leader_id_str and ms == leader_id_str:
            continue
        if actor_id_str and ms == actor_id_str:
            continue
        member_recips.append(ms)

    pname = proj.get("name", "")

    # 5) Notify admins
    try:
        notify_admins(
            kind="project_progress_changed",
            title=f"Project progress updated: {pname}",
            body=f"{actor_name or 'Someone'} set progress to {new_pct}% (was {old_pct}%).",
            data={"project_id": str(pid), "project_name": pname, "from": old_pct, "to": new_pct},
        )
    except Exception:
        pass

    # 6) Notify leader (if not the actor)
    try:
        if leader_id_str and leader_id_str != actor_id_str:
            notify_users(
                [leader_id_str],
                kind="project_progress_changed",
                title=f"Project progress updated • {pname}",
                body=f"{actor_name or 'Someone'} set progress to {new_pct}% (was {old_pct}%).",
                data={"project_id": str(pid), "project_name": pname, "from": old_pct, "to": new_pct},
            )
    except Exception:
        pass

    # 7) Notify members (exclude leader & actor)
    try:
        if member_recips:
            notify_users(
                member_recips,
                kind="project_progress_changed",
                title=f"Project progress updated • {pname}",
                body=f"{actor_name or 'Someone'} set progress to {new_pct}% (was {old_pct}%).",
                data={"project_id": str(pid), "project_name": pname, "from": old_pct, "to": new_pct},
            )
    except Exception:
        pass
def _as_dt(v):
    """Coerce task end_at into datetime (UTC) best-effort."""
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)   # ← add UTC if naive
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z","").strip())
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc) # ← add UTC if naive
    except Exception:
        return None
    

def _safe_load_experience(exp_val):
    """
    Users.experience may be:
      - list[dict]
      - JSON string
      - missing/None
    Return list[dict].
    """
    if exp_val is None:
        return []
    if isinstance(exp_val, list):
        return [x for x in exp_val if isinstance(x, dict)]
    if isinstance(exp_val, str):
        try:
            data = json.loads(exp_val)
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict)]
        except Exception:
            return []
    return []

def _relative_month_label(dt: datetime) -> str:
    now = datetime.now(timezone.utc)

    months = (now.year - dt.year) * 12 + (now.month - dt.month)
    if months <= 0:
        return "This Month"
    if months == 1:
        return "Last Month"
    if months == 2:
        return "Two Months Ago"
    # fallback: Month Year
    return dt.strftime("%b %Y")

def _append_experience(user_id: ObjectId, title: str, project_name: str, when: datetime):
    """Append {title, project, time} to users.experience if not already present."""
    u = users_collection.find_one({"_id": user_id}, {"experience": 1})
    current = _safe_load_experience(u.get("experience") if u else None)

    # dedupe on (title.lower(), project_name.lower())
    key = (title or "").strip().lower(), (project_name or "").strip().lower()
    for item in current:
        if isinstance(item, dict):
            if (item.get("title","").strip().lower(), item.get("project","").strip().lower()) == key:
                return  # already exists

    entry = {
        "title": title or "Member",
        "project": project_name or "",
        "time": _relative_month_label(when)
    }
    current.append(entry)

    # store as JSON string to match your existing sample schema
    try:
        users_collection.update_one(
            {"_id": user_id},
            {"$set": {"experience": json.dumps(current, ensure_ascii=False)}}
        )
    except Exception:
        # best-effort; ignore failures
        pass

def _update_users_experience_for_completed_project(pid: ObjectId):
    """Collect roles per assignee from tasks in this project and write to users.experience."""
    proj = projects_collection.find_one({"_id": pid}, {"name": 1})
    if not proj:
        return
    project_name = proj.get("name", "")

    pid_str = str(pid)
    task_filter = {"$or": [
        {"project_id": pid}, {"project_id": pid_str},
        {"projectId": pid},  {"projectId": pid_str},
        {"$expr": {"$eq": [{"$toString": "$project_id"}, pid_str]}},
        {"$expr": {"$eq": [{"$toString": "$projectId"}, pid_str]}}
    ]}
    tasks = tasks_collection.find(task_filter, {"assignee_id": 1, "project_role": 1})

    # group roles per user
    per_user = {}  # user_oid -> set(roles)
    for t in tasks:
        aid = t.get("assignee_id")
        role = (t.get("project_role") or "").strip()
        if not aid:
            continue
        # tolerate string/ObjectId
        try:
            aid_oid = aid if isinstance(aid, ObjectId) else ObjectId(str(aid))
        except Exception:
            continue
        if not role:
            role = "Member"
        per_user.setdefault(aid_oid, set()).add(role)

    when = datetime.now(timezone.utc)

    for uid, roles in per_user.items():
        for r in roles:
            _append_experience(uid, r, project_name, when)


@app.route("/projects", methods=["GET", "POST"])
def projects():
    if request.method == "GET":
        q = {}
        leader_id = request.args.get("leader_id")
        member_id = request.args.get("member_id")
        for_user  = request.args.get("for_user")

        try:
            clauses = []
            if leader_id:
                clauses.append({"leader_id": ObjectId(leader_id)})
            if member_id:
                clauses.append({"member_ids": ObjectId(member_id)})
            if for_user:
                oid = ObjectId(for_user)
                clauses.append({"leader_id": oid})
                clauses.append({"member_ids": oid})
            if clauses:
                q = {"$or": clauses}
        except Exception:
            return jsonify({"error": "Invalid id in query"}), 400

        try:
            cur = projects_collection.find(q).sort("created_at", -1)
            out = []
            for p in cur:
                out.append({
                    "_id": str(p["_id"]),
                    "name": p.get("name", ""),
                    "description": p.get("description", ""),
                    "member_ids": [str(mid) for mid in p.get("member_ids", [])],
                    "leader_id": str(p.get("leader_id")) if p.get("leader_id") else None,
                    "start_at": p.get("start_at"),
                    "end_at": p.get("end_at"),
                    "progress": int(p.get("progress", 0)),
                    "status": p.get("status", "todo"),
                    "confirm": int(p.get("confirm", 0)),
                })
            return jsonify(out), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ----- POST (create) -----
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    leader_id = to_object_id(data.get("leader_id"))
    member_ids = [to_object_id(x) for x in (data.get("member_ids") or []) if to_object_id(x)]

    if not name:
        return jsonify({"error": "Project name is required"}), 400

    try:
        prog_num = int(str(data.get("progress", 0)).strip())
    except Exception:
        prog_num = 0
    prog_num = max(0, min(100, prog_num))

    raw_status = (data.get("status") or "").strip().lower()
    allowed = {"todo", "in_progress", "complete", "completed", "done"}
    status = raw_status if raw_status in allowed else "todo"
    if status in {"completed", "done"}:
        status = "complete"

    doc = {
        "name": name,
        "description": description,
        "leader_id": leader_id,
        "member_ids": member_ids,
        "start_at": data.get("start_at"),
        "end_at": data.get("end_at"),
        "created_at": datetime.now(timezone.utc)
,
        "progress": int(prog_num),
        "status": status,
        "confirm": int(_normalize_confirm_value(data.get("confirm", 0))),  # keep numeric 0/1 if provided
    }

    # write to DB
    try:
        ins = projects_collection.insert_one(doc)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # notify assigned leader (if any)
    try:
        actor_id, actor_name = _actor_from_request(data)
        if doc.get("leader_id"):
            _notify_users(
                [doc["leader_id"]],
                kind="you_were_made_leader",
                title=f"You were assigned as leader • {doc.get('name','Untitled project')}",
                body=f"Admin made you the leader.",
                data={
                    "project_id": str(ins.inserted_id),
                    "project_name": doc.get("name",""),
                    "actor_id": (str(actor_id) if actor_id else None),
                    "actor_name": actor_name,
                },
            )
    except Exception:
        pass

    return jsonify({
        "message": "Project created",
        "project_id": str(ins.inserted_id),
        "progress": int(prog_num),
        "status": status,
        "confirm": doc.get("confirm", 0),
    }), 201

# --- PROJECT (read one + patch + delete) ---
@app.route("/projects/<project_id>", methods=["GET", "PATCH", "DELETE"])
def project_detail(project_id):
    pid = to_object_id(project_id)
    if not pid:
        return jsonify({"error": "Invalid project id"}), 400

    if request.method == "GET":
        proj = projects_collection.find_one({"_id": pid})
        if not proj:
            return jsonify({"error": "Project not found"}), 404

        raw_member_ids = proj.get("member_ids", [])
        ids_for_query = []
        for mid in raw_member_ids:
            if isinstance(mid, ObjectId):
                ids_for_query.append(mid)
            else:
                oid = to_object_id(mid)
                if oid:
                    ids_for_query.append(oid)

        members = list(users_collection.find({"_id": {"$in": ids_for_query}}))
        members = [{"_id": str(m["_id"]), "name": m.get("name",""), "email": m.get("email","")} for m in members]

        return jsonify({
            "_id": str(proj["_id"]),
            "name": proj.get("name", ""),
            "description": proj.get("description", ""),
            "member_ids": [str(mid) for mid in proj.get("member_ids", [])],
            "leader_id": str(proj.get("leader_id")) if proj.get("leader_id") else None,
            "members": members,
            "start_at": proj.get("start_at"),
            "end_at": proj.get("end_at"),
            "progress": int(proj.get("progress", 0)),
            "status": proj.get("status", "todo"),
            "confirm": int(proj.get("confirm",0)),
        })
 

    if request.method == "PATCH":
        # load old values first
        existing = projects_collection.find_one({"_id": pid})
        if not existing:
            return jsonify({"error": "Project not found"}), 404
        prev_leader_id = existing.get("leader_id") 
        old_status = (existing.get("status") or "").strip().lower()
        old_progress = int(existing.get("progress", 0) or 0)
        old_confirm = int(existing.get("confirm",0)or 0)
        old_member_ids = existing.get("member_ids", [])
        old_set = set(old_member_ids)
        updates = {}
        removed_member_oids = []
        tasks_deleted = 0

        data = request.get_json() or {}

        if "name" in data:
            nm = (data.get("name") or "").strip()
            if not nm:
                return jsonify({"error": "Name cannot be empty"}), 400
            updates["name"] = nm

        if "description" in data:
            updates["description"] = (data.get("description") or "").strip()

        if "start_at" in data:
            updates["start_at"] = data.get("start_at") or None
        if "end_at" in data:
            updates["end_at"] = data.get("end_at") or None

        if "leader_id" in data:
            lid = data.get("leader_id")
            updates["leader_id"] = ObjectId(lid) if lid else None

        if "member_ids" in data and isinstance(data.get("member_ids"), list):
            new_mids = []
            for x in data.get("member_ids", []):
                try:
                    new_mids.append(ObjectId(x))
                except Exception:
                    pass
            updates["member_ids"] = new_mids
            new_set = set(new_mids)
            removed_member_oids = list(old_set - new_set)

        if "progress" in data:
            try:
                prog_num = int(str(data.get("progress")).strip())
            except Exception:
                prog_num = 0
            updates["progress"] = max(0, min(100, int(prog_num)))

        if "status" in data:
            raw_status = (data.get("status") or "").strip().lower()
            allowed = {"todo", "in_progress", "complete", "completed", "done"}
            if raw_status in {"completed", "done"}:
                raw_status = "complete"
            if raw_status not in allowed:
                return jsonify({"error": "Invalid status"}), 400
            updates["status"] = raw_status
    # ---- confirm toggle (0/1) ----
        if "confirm" in data:
            raw = data.get("confirm")
            val = 0
            try:
                # allow 1/0, "1"/"0", true/false, "true"/"false"
                if isinstance(raw, str):
                    s = raw.strip().lower()
                    if s in ("1", "true", "yes", "y", "on"): val = 1
                    elif s in ("0", "false", "no", "n", "off"): val = 0
                    elif s.isdigit(): val = 1 if int(s) != 0 else 0
                elif isinstance(raw, (int, float, bool)):
                    val = 1 if int(raw) != 0 else 0
            except Exception:
                val = 0
            updates["confirm"] = int(val)

        if not updates:
            return jsonify({"error": "No changes"}), 400

        updates["updated_at"] = datetime.now(timezone.utc)


        try:
            res = projects_collection.update_one({"_id": pid}, {"$set": updates})
            if res.matched_count == 0:
                return jsonify({"error": "Project not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        
        # Cascade: delete tasks of removed members
        if removed_member_oids:
            try:
                removed_str = [str(x) for x in removed_member_oids]
                del_res = tasks_collection.delete_many({
                    "project_id": {"$in": [pid, str(pid)]},
                    "assignee_id": {"$in": removed_member_oids + removed_str}
                })
                tasks_deleted = getattr(del_res, "deleted_count", 0)
            except Exception:
                tasks_deleted = 0

            try:
                socketio.emit(
                    "project:members-removed",
                    {"project_id": str(pid),
                     "removed_member_ids": removed_str,
                     "tasks_deleted": int(tasks_deleted)},
                    namespace="/rt",
                    to=str(pid)
                )
            except Exception:
                pass

            try:
                recompute_and_store_project_progress(pid)
            except Exception:
                pass
      # already present:
        try:
            new_confirm = int(updates.get("confirm", existing.get("confirm", 0)) or 0)
            if old_confirm != 1 and new_confirm == 1:
                _write_member_experience_for_confirmed_project(pid)

                # ✅ notify members (not the leader) that the project is approved
                try:
                    final_for_notif = projects_collection.find_one(
                        {"_id": pid},
                        {"name":1, "member_ids":1, "leader_id":1}
                    )
                    pname = (final_for_notif or {}).get("name","")
                    leader_id = (final_for_notif or {}).get("leader_id")
                    recipients = []
                    for uid in (final_for_notif or {}).get("member_ids", []):
                        try:
                            uoid = uid if isinstance(uid, ObjectId) else ObjectId(str(uid))
                        except Exception:
                            continue
                        if leader_id and uoid == leader_id:
                            continue  # exclude leader; they already get their own noti
                        recipients.append(uoid)
                    if recipients:
                        _notify_users(
                            recipients,
                            kind="project_confirmed",
                            title=f"Project approved • {pname}",
                            body="Your whole project is complete and approved by company.",
                            data={"project_id": str(pid), "project_name": pname},
                        )
                    if leader_id:
                        _notify_users(
                            [leader_id],
                            kind="project_confirmed",
                            title=f"Project approved • {pname}",
                            body="Your whole project is complete and approved by company.",
                            data={"project_id": str(pid), "project_name": pname},
                        )
                except Exception:
                    pass
        except Exception:
            pass

        # Re-read final values after update
        final = projects_collection.find_one(
            {"_id": pid},
            {"name": 1, "progress": 1, "status": 1, "leader_id": 1, "member_ids": 1}  # ⬅️ add leader_id & member_ids
        )
        final_progress = int((final or {}).get("progress", 0) or 0)
        final_status = (final or {}).get("status", "").strip().lower()
        proj_name = (final or {}).get("name", "")
        new_leader_id = (final or {}).get("leader_id")

        # Notify admins (progress change / completion)
        try:
            actor_id, actor_name = _actor_from_request(data)

            if final_progress != old_progress:
                notify_admins(
                    kind="project_progress_changed",
                    title=f"Project progress updated: {proj_name}",
                    body=f"{actor_name} set progress to {final_progress}% (was {old_progress}%).",
                    data={"project_id": str(pid), "project_name": proj_name, "from": old_progress, "to": final_progress},
                )

            became_complete = (
                (old_status not in {"complete","completed","done"} and final_status in {"complete","completed","done"})
                or (old_progress < 100 and final_progress >= 100)
            )
            if became_complete:
                notify_admins(
                    kind="project_completed",
                    title=f"Project completed: {proj_name}",
                    body=f"{actor_name} marked the project complete.",
                    data={"project_id": str(pid), "project_name": proj_name},
                )
        except Exception:
            pass
        # ✅ Members: progress changed (exclude leader & actor)
       # ✅ Members: progress changed (exclude leader & actor)
        try:
            if final_progress != old_progress:
                actor_id, actor_name = _actor_from_request(data)

                def _to_str_id(x):
                    if isinstance(x, ObjectId):
                        return str(x)
                    # try coercing to ObjectId then back to string; if it fails, just str()
                    try:
                        return str(ObjectId(str(x)))
                    except Exception:
                        return str(x) if x is not None else None

                leader_id_str = _to_str_id((final or {}).get("leader_id"))
                actor_id_str  = _to_str_id(actor_id)

                member_ids = (final or {}).get("member_ids", []) or []
                recipients = []
                for mid in member_ids:
                    ms = _to_str_id(mid)
                    if not ms:
                        continue
                    if leader_id_str and ms == leader_id_str:  # exclude leader
                        continue
                    if actor_id_str and ms == actor_id_str:    # exclude actor
                        continue
                    recipients.append(ms)

                if recipients:
                    notify_users(
                        recipients,
                        kind="project_progress_changed",
                        title=f"Project progress updated • {proj_name}",
                        body=f"Progress to {final_progress}% (was {old_progress}%).",
                        data={
                            "project_id": str(pid),
                            "project_name": proj_name,
                            "from": old_progress,
                            "to": final_progress,
                        },
                    )
        except Exception:
            pass


        try:
            actor_id, actor_name = _actor_from_request(data)

            # If leader changed, notify new leader (and optionally the old one)
            new_leader_id = (final or {}).get("leader_id")
            if new_leader_id and new_leader_id != prev_leader_id:
                _notify_users(
                    [new_leader_id],
                    kind="you_were_made_leader",
                    title=f"You were assigned as leader • {proj_name}",
                    body=f"{actor_name or 'Someone'} assigned you as the project leader.",
                    data={"project_id": str(pid), "project_name": proj_name},
                )
            # (optional) let the old leader know they were removed
            if prev_leader_id and prev_leader_id != new_leader_id:
                _notify_users(
                    [prev_leader_id],
                    kind="you_were_removed_as_leader",
                    title=f"Leadership changed • {proj_name}",
                    body=f"{actor_name or 'Someone'} replaced you as the project leader.",
                    data={"project_id": str(pid), "project_name": proj_name},
                )

            # If progress changed, ping the current leader (same event admins get)
            if new_leader_id and final_progress != old_progress:
                _notify_users(
                    [new_leader_id],
                    kind="project_progress_changed",
                    title=f"Project progress updated • {proj_name}",
                    body=f"Progress to {final_progress}% (was {old_progress}%).",
                    data={"project_id": str(pid), "project_name": proj_name, "from": old_progress, "to": final_progress},
                )

            # If it became complete, ping the leader too (admins already notified)
            
        except Exception:
            pass
        # Response
        out = {"ok": True, "project_id": str(pid)}
        for k, v in updates.items():
            if isinstance(v, ObjectId):
                out[k] = str(v)
            elif isinstance(v, list) and all(isinstance(x, ObjectId) for x in v):
                out[k] = [str(x) for x in v]
            else:
                out[k] = v
        if removed_member_oids:
            out["removed_members"] = [str(x) for x in removed_member_oids]
            out["tasks_deleted"] = int(tasks_deleted)

        return jsonify(out), 200

        # DELETE
    res = projects_collection.delete_one({"_id": pid})
    if res.deleted_count == 0:
        return jsonify({"error": "Project not found"}), 404
    try:
        tasks_collection.delete_many({"project_id": {"$in": [pid, str(pid)]}})
    except Exception:
        pass
    return jsonify({"ok": True, "deleted_id": str(pid)}), 200


# -------------------- TASKS (LIST + CREATE) --------------------
@app.route("/tasks", methods=["GET", "POST"])
def tasks_collection_handler():
    if request.method == "GET":
        q = {}
        assignee_id = request.args.get("assignee_id")
        project_id  = request.args.get("project_id")
        status      = request.args.get("status")

        if assignee_id:
            aid = to_object_id(assignee_id)
            if not aid:
                return jsonify({"error": "Invalid assignee_id"}), 400
            q["assignee_id"] = aid

        if project_id:
            pid = to_object_id(project_id)
            if not pid:
                return jsonify({"error": "Invalid project_id"}), 400
            q["project_id"] = pid

        if status:
            q["status"] = status

        cur = tasks_collection.find(q).sort("created_at", -1)
        out = []
        for t in cur:
            out.append({
                "_id": str(t["_id"]),
                "project_id": str(t["project_id"]),
                "assignee_id": str(t["assignee_id"]),
                "title": t.get("title", ""),
                "description": t.get("description", ""),
                "start_at": t.get("start_at"),
                "end_at": t.get("end_at"),
                "status": t.get("status", "todo"),
                "progress": int(t.get("progress", 0)),
                "project_role": t.get("project_role"),
                "created_by": str(t["created_by"]) if t.get("created_by") else None,
                "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else t.get("created_at"),
                "updated_at": t["updated_at"].isoformat() if isinstance(t.get("updated_at"), datetime) else t.get("updated_at"),
            })
        return jsonify(out), 200

    # ---- POST (create task) ----
    data = request.get_json() or {}
    pid = to_object_id(data.get("project_id"))
    aid = to_object_id(data.get("assignee_id"))
    if not pid or not aid:
        return jsonify({"error": "Invalid project_id or assignee_id"}), 400

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    start_at = data.get("start_at")
    end_at   = data.get("end_at")
    created_by = to_object_id(data.get("created_by")) if data.get("created_by") else None
    project_role = (data.get("project_role") or "").strip() or None

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    proj = projects_collection.find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404
    if aid not in proj.get("member_ids", []):
        return jsonify({"error": "Assignee must be a member of this project"}), 400

    # initial status/progress
    tprog = int(max(0, min(100, int(data.get("progress", 0) or 0)))) if str(data.get("progress", "")).strip().isdigit() else 0
    tstatus = "completed" if tprog == 100 else "todo"

    doc = {
        "project_id": pid,
        "assignee_id": aid,
        "title": title,
        "description": description,
        "start_at": start_at,
        "end_at": end_at,
        "status": tstatus,
        "progress": int(tprog),
        "project_role": project_role,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc)
,
    }
    ins = tasks_collection.insert_one(doc)

    payload = {
        "_id": str(ins.inserted_id),
        "project_id": str(doc["project_id"]),
        "assignee_id": str(doc["assignee_id"]),
        "title": doc.get("title",""),
        "description": doc.get("description",""),
        "start_at": doc.get("start_at"),
        "end_at": doc.get("end_at"),
        "status": doc.get("status","todo"),
        "progress": int(doc.get("progress", 0)),
        "project_role": doc.get("project_role"),
        "created_by": str(doc["created_by"]) if doc.get("created_by") else None,
        "created_at": doc["created_at"].isoformat(),
    }
    socketio.emit("task:created", payload, namespace="/rt", to=str(doc["project_id"]))

    # recompute project.progress
    recompute_and_store_project_progress(pid)

    # [NOTIFY] task assigned
    try:
        creator_id, creator_name = _actor_from_request(data)
        assignee = users_collection.find_one({"_id": aid}, {"name": 1, "email": 1})
        assignee_name = (assignee or {}).get("name") or (assignee or {}).get("email") or "a member"
        proj_name = proj.get("name", "")

        notify_admins(
            kind="task_assigned",
            title=f"Task assigned • {proj_name}",
            body=f"{creator_name or 'Someone'} assigned '{title}' to {assignee_name}.",
            data={"project_id": str(pid), "task_id": str(ins.inserted_id)},
        )

        if aid and (not creator_id or aid != creator_id):
            notify_users(
                [aid],
                kind="you_were_assigned",
                title=f"New task in {proj_name}",
                body=f"You were assigned: {title}",
                data={"project_id": str(pid), "task_id": str(ins.inserted_id)},
            )

# notify the leader (not if leader is assignee, and not if leader is the actor)
        leader_id = (proj or {}).get("leader_id")
        if leader_id and leader_id != aid and (not creator_id or leader_id != creator_id):
            notify_users(
                [leader_id],
                kind="task_assigned_in_your_project",
                title=f"Task assigned • {proj_name}",
                body=f"{assignee_name} was assigned: {title}",
                data={"project_id": str(pid), "task_id": str(ins.inserted_id)},
            )
    except Exception:
            pass
   

    return jsonify({"message": "Task created", **payload}), 201

# -------------------- TASK (GET/PATCH/DELETE) --------------------
@app.route("/tasks/<task_id>", methods=["GET", "PATCH", "DELETE"])
def task_detail(task_id):
    tid = to_object_id(task_id)
    if not tid:
        return jsonify({"error": "invalid task id"}), 400

    t = tasks_collection.find_one({"_id": tid})
    if not t:
        return jsonify({"error": "Task not found"}), 404

    if request.method == "GET":
        return jsonify({
            "_id": str(t["_id"]),
            "project_id": str(t["project_id"]),
            "assignee_id": str(t["assignee_id"]),
            "title": t.get("title", ""),
            "description": t.get("description", ""),
            "start_at": t.get("start_at"),
            "end_at": t.get("end_at"),
            "status": t.get("status", "todo"),
            "progress": int(t.get("progress", 0)),
            "project_role": t.get("project_role"),
            "created_by": str(t["created_by"]) if t.get("created_by") else None,
            "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else t.get("created_at"),
            "updated_at": t["updated_at"].isoformat() if isinstance(t.get("updated_at"), datetime) else t.get("updated_at"),
        })

    if request.method == "PATCH":
        data = request.get_json() or {}
        updates = {}

        # save previous values for notifications
        prev_status = (t.get("status") or "").strip().lower()
        prev_progress = int(t.get("progress") or 0)

        if "title" in data:
            title = (data.get("title") or "").strip()
            if not title:
                return jsonify({"error": "Title is required"}), 400
            updates["title"] = title

        if "description" in data:
            updates["description"] = (data.get("description") or "").strip()

        if "project_role" in data:
            pr = (data.get("project_role") or "").strip()
            updates["project_role"] = pr or None

        if "start_at" in data:
            updates["start_at"] = data.get("start_at") or None

        if "end_at" in data:
            updates["end_at"] = data.get("end_at") or None

        if "assignee_id" in data:
            new_assignee = to_object_id(data.get("assignee_id"))
            if not new_assignee:
                return jsonify({"error": "invalid assignee_id"}), 400
            proj = projects_collection.find_one({"_id": t["project_id"]})
            if not proj:
                return jsonify({"error": "Project not found"}), 404
            if new_assignee not in proj.get("member_ids", []):
                return jsonify({"error": "Assignee must be a member of this project"}), 400
            updates["assignee_id"] = new_assignee

        # progress/status coupling
        if "progress" in data:
            try:
                p = int(str(data.get("progress")).strip())
            except Exception:
                p = 0
            p = max(0, min(100, p))
            updates["progress"] = int(p)
            if p == 100:
                updates["status"] = "completed"
            elif "status" not in data:
                updates.setdefault("status", t.get("status","todo") if p == 0 else "in_progress")

        if "status" in data:
            updates["status"] = (data.get("status") or "todo").strip().lower()

        updates["updated_at"] = datetime.now(timezone.utc)


        result = tasks_collection.update_one({"_id": tid}, {"$set": updates})
        try:
            actor_id, actor_name = _actor_from_request(data)
            # read fresh values
           # was: {"title":1,"project_id":1,"status":1,"progress":1}
            t2 = tasks_collection.find_one({"_id": tid}, {
                "title": 1, "project_id": 1, "status": 1, "progress": 1, "assignee_id": 1  # ⬅️ add assignee_id
            })
            # was: {"leader_id":1, "name":1}
            proj = projects_collection.find_one({"_id": t2["project_id"]}, {
                "leader_id": 1, "name": 1, "member_ids": 1  # ⬅️ add member_ids
            })

            leader_id = (proj or {}).get("leader_id")
            proj_name = (proj or {}).get("name","")
            changed_for_notify = (
            ("progress" in updates and int(updates["progress"]) != int(prev_progress)) or
            ("status"   in updates and (updates["status"] or "").strip().lower() != prev_status)
        )

            if leader_id and leader_id != actor_id and changed_for_notify:
                notify_users(
                    [leader_id],
                    kind="member_task_progress_changed",
                    title=f"Task updated • {proj_name}",
                    body=f"{actor_name or 'Someone'} set '{t2.get('title','Task')}' to "
                        f"{int(t2.get('progress') or 0)}% ({(t2.get('status') or 'todo').lower()}).",
                    data={"project_id": str(t2["project_id"]), "task_id": str(tid)},
                )

        # ✅ members notify (exclude leader, actor, and — if actor is the assignee — themselves)
        # ✅ members notify (exclude leader, actor, and — if actor is the assignee — themselves)
            if changed_for_notify and proj:
                recipients = []
                for uid in (proj.get("member_ids") or []):
                    try:
                        uoid = uid if isinstance(uid, ObjectId) else ObjectId(str(uid))
                    except Exception:
                        continue
                    if leader_id and uoid == leader_id:
                        continue                  # not the leader
                    if actor_id and uoid == actor_id:
                        continue                  # not the actor
                    if t2.get("assignee_id") and uoid == t2["assignee_id"] and actor_id and actor_id == t2["assignee_id"]:
                        continue                  # actor updated their own task → don't notify them
                    recipients.append(uoid)

                if recipients:
                    _notify_users(
                        recipients,
                        kind="member_task_progress_changed",
                        title=f"Task updated • {proj_name}",
                        body=f"{actor_name or 'Someone'} set '{t2.get('title','Task')}' to "
                            f"{int(t2.get('progress') or 0)}% ({(t2.get('status') or 'todo').lower()}).",
                        data={"project_id": str(t2["project_id"]), "task_id": str(tid)},
                    )

        except Exception:
            pass
        if result.modified_count == 0:
            return jsonify({"error": "No changes were made"}), 400

        # Build the patch object used both for socket and to derive new values
        patch = {"_id": str(tid)}
        patch.update({
            k: (str(v) if k.endswith("_id") and v is not None else (int(v) if k == "progress" and v is not None else v))
            for k, v in updates.items()
        })

        project_id = t["project_id"]

       # after you’ve built `patch` / `updates` and know the project_id:
        safe_patch = _jsonable(patch)  # or _jsonable({"_id": task_id, **updates})

        socketio.emit("task:updated", safe_patch, namespace="/rt", to=str(project_id))


        # recompute & broadcast project progress
        recompute_and_store_project_progress(project_id)

          # ---- ADMIN NOTIFY: task progress / completion (now that DB is updated) ----
               # ---- ADMIN NOTIFY: task progress / completion (after DB is updated) ----
        try:
            actor_id, actor_name = _actor_from_request(data)

            # derive new values
            new_status = (patch.get("status") or t.get("status") or "").strip().lower()
            new_progress = int(patch.get("progress") if patch.get("progress") is not None else (t.get("progress") or 0))
            done_set = {"complete", "completed", "done", "finished"}
            just_completed = (prev_progress < 100 and new_progress >= 100) or \
                             (prev_status not in done_set and new_status in done_set)

            # labels
            proj = projects_collection.find_one({"_id": project_id}, {"name": 1})
            proj_name = (proj or {}).get("name", "")
            title_now = patch.get("title") or t.get("title", "")
            assignee_label = ""
            try:
                assignee = users_collection.find_one({"_id": t.get("assignee_id")}, {"name": 1, "email": 1})
                assignee_label = (assignee or {}).get("name") or (assignee or {}).get("email") or ""
            except Exception:
                pass

            # progress changed -> notify admins (exclude actor if actor is admin)
            if new_progress != prev_progress:
                _notify_admins_excluding_actor(
                    kind="task_progress_changed",
                    title=f"Task progress • {proj_name}",
                    body=f"{actor_name or 'Someone'} set '{title_now}' to {new_progress}% (was {prev_progress}%).",
                    data={"project_id": str(project_id), "task_id": str(tid),
                          "actor_id": str(actor_id) if actor_id else None, "actor_name": actor_name},
                    actor_id=actor_id,
                )

            # completed -> notify admins (exclude actor if actor is admin)
            if just_completed:
                _notify_admins_excluding_actor(
                    kind="task_completed",
                    title=f"Task completed • {proj_name}",
                    body=f"{actor_name or 'Someone'} marked '{title_now}' as complete.",
                    data={"project_id": str(project_id), "task_id": str(tid),
                          "assignee_id": str(t.get("assignee_id")), "assignee_name": assignee_label,
                          "actor_id": str(actor_id) if actor_id else None, "actor_name": actor_name},
                    actor_id=actor_id,
                )

        except Exception:
            pass

           
        except Exception:
            pass


        return jsonify({"message": "Task updated successfully", "task": patch}), 200

    # DELETE
    tasks_collection.delete_one({"_id": tid})
    socketio.emit("task:deleted", {"_id": str(tid), "project_id": str(t["project_id"])}, namespace="/rt", to=str(t["project_id"]))
    recompute_and_store_project_progress(t["project_id"])
    return jsonify({"ok": True}), 200

# -------------------- USER (read) --------------------
@app.get("/get-user/<user_id>")
def get_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        exp = user.get("experience", [])
        if isinstance(exp, str):
            try:
                exp = json.loads(exp)
            except Exception:
                exp = []

        return jsonify({
            "name": user.get("name", ""),
            "dob": user.get("dob", ""),
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "email": user.get("email", ""),
            "experience": exp,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    



@app.route("/api/announcement", methods=["POST"])
def save_announcement():
    try:
        title = request.form.get("title")  # ✅ get title
        message = request.form.get("message")
        send_to = request.form.get("sendTo")
        image_file = request.files.get("image")

        # image_url = None
        # if image_file:
        #     filename = secure_filename(image_file.filename)
        #     filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        #     image_file.save(filepath)
        #     # image_url = f"/{UPLOAD_FOLDER}/{filename}"  # frontend can fetch from this path
        #     # Full URL so frontend can access
        #     image_url = f"http://localhost:5000/uploads/{filename}"
         # 🔥 Changed: store only filename, not full URL
        filename = None
        if image_file:
            filename = secure_filename(image_file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            image_file.save(filepath)

        announcement = {
            "title": title,  # ✅ store title
            "message": message,
            "sendTo": send_to,
            "image": filename,
            "createdAt": datetime.now(timezone.utc)

        }

        result = announcement_collection.insert_one(announcement)

        return jsonify({"success": True, "id": str(result.inserted_id)})
    except Exception as e:
        print("Error:", e)
        return jsonify({"success": False, "error": str(e)}), 500
    
    
    
@app.route("/api/announcement", methods=["GET"])
def get_announcements():
    try:
        announcements = []
        for a in announcement_collection.find().sort("createdAt", -1):
            # 🔥 Always return full URL for frontend
            image_url = f"http://localhost:5000/uploads/{a['image']}" if a.get("image") else None
            announcements.append({
                "id": str(a["_id"]),
                "title": a.get("title", ""),  # ✅ include title
                "message": a.get("message", ""),
                "sendTo": a.get("sendTo", "all"),
                # "image": a.get("image", None),
                 "image": image_url,  # 🔥 full URL
                "createdAt": a.get("createdAt").isoformat() if a.get("createdAt") else None
            })
        return jsonify(announcements)
    except Exception as e:
        print("Error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/announcement/<id>", methods=["GET"])
def get_announcement_detail(id):
    try:
        a = announcement_collection.find_one({"_id": ObjectId(id)})
        if not a:
            return jsonify({"error": "Announcement not found"}), 404
        
        image_url = f"http://localhost:5000/uploads/{a['image']}" if a.get("image") else None  # 🔥

        announcement = {
            "id": str(a["_id"]),
            "title": a.get("title", ""),
            "message": a.get("message", ""),
            "sendTo": a.get("sendTo", "all"),
            # "image": a.get("image", None),
            "image": image_url,  # 🔥 full URL
            "createdAt": a.get("createdAt").isoformat() if a.get("createdAt") else None
        }
        return jsonify(announcement)
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/api/announcement/<id>", methods=["DELETE"])
def delete_announcement(id):
    try:
        result = announcement_collection.delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 1:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "Not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


    # ✅ Update announcement
@app.route("/api/announcement/<id>", methods=["PUT"])
def update_announcement(id):
    try:
        title = request.form.get("title")
        message = request.form.get("message")
        sendTo = request.form.get("sendTo")

        update_data = {
            "title": title,
            "message": message,
            "sendTo": sendTo
        }

       
        if "image" in request.files:
            image = request.files["image"]
            if image and image.filename != "":
                filename = secure_filename(image.filename)
                filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                image.save(filepath)
                update_data["image"] = filename  # 🔥 filename only

        result = announcement_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Announcement not found"}), 404

        return jsonify({"success": True, "message": "Announcement updated successfully"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


    # -------------------- GET ALL REGISTERED MEMBERS --------------------
@app.get("/registered-members")
def get_members():
    try:
        members = list(users_collection.find({"alreadyRegister": True}))
        for m in members:
            m["_id"] = str(m["_id"])
        return jsonify(members)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.delete("/delete-user/<user_id>")
def delete_user(user_id):
    try:
        result = users_collection.delete_one({"_id": ObjectId(user_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------- bind to LAN --------------------
if __name__ == "__main__":
    print("✅ Connected to MongoDB!")
    print(f"📂 Available collections: {list(db.list_collection_names())}")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)