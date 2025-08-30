from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime
import json
from flask_socketio import SocketIO, emit, join_room, leave_room
import re

app = Flask(__name__)

# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
SERVER_IP = "192.168.1.5"

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5137",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5137",
    f"http://{SERVER_IP}:5137",
]

socketio = SocketIO(
    app,
    cors_allowed_origins=FRONTEND_ORIGINS,
    async_mode="eventlet"  # or "gevent"
)

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

CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

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

def to_object_id(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None

# ---------- make ALL preflights succeed ----------
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return app.make_response(("", 204))

@app.after_request
def add_cors_headers(resp):
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    return resp

# --- health check ---
@app.get("/ping")
def ping():
    return jsonify({"ok": True, "from": "flask"})

# -------------------- ADD MEMBER --------------------
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
    })
    return jsonify({"message": "Member added successfully!"}), 201

# -------------------- UPDATE USER --------------------
@app.patch("/update-user/<user_id>")
def update_user(user_id):
    data = request.get_json() or {}
    name = data.get("name")
    dob = data.get("dob")
    phone = data.get("phone")
    address = data.get("address")
    password = data.get("password")

    if not name or not dob or not phone or not address or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash(password)
    try:
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "name": name,
                "dob": dob,
                "phone": phone,
                "address": address,
                "password": hashed_password
            }}
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
            "role": user.get("role")
        }
    })

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

    cursor = users_collection.find(
        {"_id": {"$in": oids}},
        {"email": 1, "name": 1, "picture": 1, "avatar": 1, "avatar_url": 1, "profile": 1}
    )

    out = []
    for u in cursor:
        out.append({
            "_id": str(u["_id"]),
            "email": u.get("email", ""),
            "name": u.get("name", ""),
            "picture": (
                u.get("picture")
                or (u.get("profile") or {}).get("photo")
                or u.get("avatar_url")
                or u.get("avatar")
                or ""
            )
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
    projection = {"email": 1, "name": 1, "avatar": 1, "avatar_url": 1, "picture": 1, "profile": 1, "role": 1}

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

def recompute_and_store_project_progress(project_id_any) -> int:
    """
    Compute mean of task percentages for a project and persist to projects.progress.
    """
    pid = _as_object_id(project_id_any)
    if not pid:
        return 0
    pid_str = str(pid)

    or_terms = [
        {"project_id": pid}, {"project_id": pid_str},
        {"projectId": pid},  {"projectId": pid_str},
        {"project._id": pid},{"project._id": pid_str},
        {"project.id": pid}, {"project.id": pid_str},
        {"$expr": {"$eq": [{"$toString": "$project_id"}, pid_str]}},
        {"$expr": {"$eq": [{"$toString": "$projectId"}, pid_str]}},
        {"$expr": {"$eq": [{"$toString": "$project._id"}, pid_str]}},
        {"$expr": {"$eq": [{"$toString": "$project.id"}, pid_str]}}
    ]

    tasks = list(tasks_collection.find(
        {"$or": or_terms},
        {"status": 1, "state": 1, "progress": 1, "percent": 1, "percentage": 1,
         "progress_pct": 1, "completion": 1, "complete_percent": 1}
    ))

    if not tasks:
        pct = 0
    else:
        vals = [_coerce_pct_from_task(t) for t in tasks]
        pct = round(sum(vals) / len(vals)) if vals else 0

    projects_collection.update_one(
        {"_id": pid},
        {"$set": {"progress": int(pct), "updated_at": datetime.utcnow()}}
    )

    socketio.emit(
        "project:progress",
        {"project_id": pid_str, "progress": int(pct)},
        namespace="/rt",
        to=pid_str
    )
    return int(pct)

# -------------------- EXPERIENCE helpers --------------------
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
    now = datetime.utcnow()
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

    when = datetime.utcnow()
    for uid, roles in per_user.items():
        for r in roles:
            _append_experience(uid, r, project_name, when)

# -------------------- PROJECTS (GET list + POST create) --------------------
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
                    "progress": int(p.get("progress", 0)),  # numeric
                    "status": p.get("status", "todo"),
                })
            return jsonify(out)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # POST create
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    leader_id = to_object_id(data.get("leader_id"))
    member_ids = [to_object_id(x) for x in (data.get("member_ids") or []) if to_object_id(x)]

    if not name:
        return jsonify({"error": "Project name is required"}), 400

    # progress default numeric 0..100
    try:
        prog_num = int(str(data.get("progress", 0)).strip())
    except Exception:
        prog_num = 0
    prog_num = max(0, min(100, prog_num))

    # status normalization
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
        "created_at": datetime.utcnow(),
        "progress": int(prog_num),   # numeric
        "status": status,
    }

    try:
        ins = projects_collection.insert_one(doc)
        return jsonify({
            "message": "Project created",
            "project_id": str(ins.inserted_id),
            "progress": int(prog_num),
            "status": status,
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- PROJECT (read one + patch + delete) ---
@app.route("/projects/<project_id>", methods=["GET", "PATCH", "DELETE"])
def project_detail(project_id):
    try:
        pid = ObjectId(project_id)
    except Exception:
        return jsonify({"error": "Invalid project id"}), 400

    if request.method == "GET":
        proj = projects_collection.find_one({"_id": pid})
        if not proj:
            return jsonify({"error": "Project not found"}), 404

        # Safe member lookup
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
        members = [
            {
                "_id": str(m["_id"]),
                "name": m.get("name", ""),
                "email": m.get("email", ""),
            }
            for m in members
        ]

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
        })

    if request.method == "PATCH":
        # fetch existing to compute removed members for cascade delete + to check final completion
        existing = projects_collection.find_one({"_id": pid})
        if not existing:
            return jsonify({"error": "Project not found"}), 404
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

        if not updates:
            return jsonify({"error": "No changes"}), 400

        updates["updated_at"] = datetime.utcnow()

        try:
            res = projects_collection.update_one({"_id": pid}, {"$set": updates})
            if res.matched_count == 0:
                return jsonify({"error": "Project not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

        # ---- Cascade: delete tasks of removed members
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

        # -------- If project is now complete, write member experience ----------
        # read the updated project to determine final status/progress
        final_proj = projects_collection.find_one({"_id": pid}, {"status": 1, "progress": 1})
        final_status = (final_proj or {}).get("status", "").strip().lower()
        final_progress = int((final_proj or {}).get("progress", 0) or 0)
        if final_status in {"complete", "completed", "done"} or final_progress >= 100:
            try:
                _update_users_experience_for_completed_project(pid)
            except Exception:
                pass

        # make response safe
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
        tasks_collection.delete_many({"project_id": pid})
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

    # initial task status/progress
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
        "created_at": datetime.utcnow(),
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

    # recompute & broadcast project.progress
    recompute_and_store_project_progress(pid)

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

        updates["updated_at"] = datetime.utcnow()

        result = tasks_collection.update_one({"_id": tid}, {"$set": updates})

        patch = {"_id": str(tid)}
        patch.update({
            k: (str(v) if k.endswith("_id") and v is not None else (int(v) if k == "progress" and v is not None else v))
            for k, v in updates.items()
        })
        project_id = t["project_id"]
        socketio.emit("task:updated", patch, namespace="/rt", to=str(project_id))

        if result.modified_count == 0:
            return jsonify({"error": "No changes were made"}), 400

        # recompute & broadcast progress
        recompute_and_store_project_progress(project_id)

        return jsonify({"message": "Task updated successfully", "task": patch}), 200

    # DELETE
    tasks_collection.delete_one({"_id": tid})
    socketio.emit("task:deleted", {"_id": str(tid), "project_id": str(t["project_id"])}, namespace="/rt", to=str(t["project_id"]))

    # recompute progress after deletion
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

# -------------------- bind to LAN --------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
