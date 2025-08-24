from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime
import json

app = Flask(__name__)

# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
SERVER_IP = "192.168.1.9"

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5137",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5137",
    f"http://{SERVER_IP}:5137",
]


CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
def _preflight_ok():
    # Always send a clean 204 with explicit CORS headers
    origin = request.headers.get("Origin", "")
    h = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get(
            "Access-Control-Request-Headers", "Content-Type, Authorization"
        ),
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }
    # echo back the origin if it's one we allow
    if origin in FRONTEND_ORIGINS:
        h["Access-Control-Allow-Origin"] = origin
    resp = app.make_response(("", 204))
    for k, v in h.items():
        resp.headers[k] = v
    return resp

# Explicit preflight routes (some setups don't run before_request for dynamic paths reliably)
@app.route("/tasks", methods=["OPTIONS"])
def options_tasks():
    return _preflight_ok()

@app.route("/tasks/<task_id>", methods=["OPTIONS"])
def options_task_detail(task_id):
    return _preflight_ok()

# --- collections ---
users_collection = db["users"]
projects_collection = db["projects"]
tasks_collection = db["tasks"]

def to_object_id(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None

# ---------- make ALL preflights succeed ----------
@app.before_request
def handle_preflight():
    # If browser sends preflight anywhere, reply 204 so CORS can pass.
    if request.method == "OPTIONS":
        resp = app.make_response(("", 204))
        return resp

# Add standard allow headers/methods on every response (CORS lib will add origin)
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

# -------------------- MEMBERS (role=member) --------------------
@app.get("/members")
def get_members():
    try:
        cur = users_collection.find(
            {"role": {"$regex": r"^\s*member\s*$", "$options": "i"}},
            {"name": 1, "email": 1, "position": 1}
        )
        members = [{
            "_id": str(u["_id"]),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "position": u.get("position", "")
        } for u in cur]
        return jsonify(members)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------- PROJECTS (GET list + POST create) --------------------
@app.route("/projects", methods=["GET", "POST"])
def projects():
    if request.method == "GET":
        q = {}
        leader_id = request.args.get("leader_id")
        member_id = request.args.get("member_id")
        for_user = request.args.get("for_user")

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
                })
            return jsonify(out)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Example create (adjust as your real schema)
    if request.method == "POST":
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        description = (data.get("description") or "").strip()
        leader_id = to_object_id(data.get("leader_id"))
        member_ids = [to_object_id(x) for x in (data.get("member_ids") or []) if to_object_id(x)]
        if not name:
            return jsonify({"error": "Project name is required"}), 400
        doc = {
            "name": name,
            "description": description,
            "leader_id": leader_id,
            "member_ids": member_ids,
            "start_at": data.get("start_at"),
            "end_at": data.get("end_at"),
            "created_at": datetime.utcnow(),
        }
        ins = projects_collection.insert_one(doc)
        return jsonify({"message": "Project created", "project_id": str(ins.inserted_id)}), 201

# -------------------- PROJECT (one) with members --------------------
@app.get("/projects/<project_id>")
def get_project(project_id):
    try:
        pid = ObjectId(project_id)
    except Exception:
        return jsonify({"error": "Invalid project id"}), 400

    proj = projects_collection.find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    member_ids = proj.get("member_ids", [])
    members = list(users_collection.find(
        {"_id": {"$in": member_ids}},
        {"name": 1, "email": 1, "position": 1}
    ))
    members = [
        {
            "_id": str(m["_id"]),
            "name": m.get("name", ""),
            "email": m.get("email", ""),
            "position": m.get("position", "")
        } for m in members
    ]

    leader_id = proj.get("leader_id")
    return jsonify({
        "_id": str(proj["_id"]),
        "name": proj.get("name", ""),
        "description": proj.get("description", ""),
        "leader_id": str(leader_id) if leader_id else None,
        "members": members,
        "start_at": proj.get("start_at"),
        "end_at": proj.get("end_at")
    })

# -------------------- TASKS (LIST + CREATE) --------------------
@app.route("/tasks", methods=["GET", "POST"])
def tasks_collection_handler():
    if request.method == "GET":
        q = {}
        assignee_id = request.args.get("assignee_id")
        project_id = request.args.get("project_id")

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
                "project_role": t.get("project_role"),
                "created_by": str(t["created_by"]) if t.get("created_by") else None,
                "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else t.get("created_at"),
                "updated_at": t["updated_at"].isoformat() if isinstance(t.get("updated_at"), datetime) else t.get("updated_at"),
            })
        return jsonify(out), 200

    # POST create
    data = request.get_json() or {}
    pid = to_object_id(data.get("project_id"))
    aid = to_object_id(data.get("assignee_id"))
    if not pid or not aid:
        return jsonify({"error": "Invalid project_id or assignee_id"}), 400

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    start_at = data.get("start_at")   # ISO string or None
    end_at = data.get("end_at")       # ISO string or None
    created_by = to_object_id(data.get("created_by")) if data.get("created_by") else None
    project_role = (data.get("project_role") or "").strip() or None

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    proj = projects_collection.find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404
    if aid not in proj.get("member_ids", []):
        return jsonify({"error": "Assignee must be a member of this project"}), 400

    doc = {
        "project_id": pid,
        "assignee_id": aid,
        "title": title,
        "description": description,
        "start_at": start_at,
        "end_at": end_at,
        "status": "todo",
        "project_role": project_role,
        "created_by": created_by,
        "created_at": datetime.utcnow(),
    }
    ins = tasks_collection.insert_one(doc)
    return jsonify({"message": "Task created", "task_id": str(ins.inserted_id)}), 201

# -------------------- TASK detail (PATCH / DELETE) --------------------
@app.route("/tasks/<task_id>", methods=["PATCH", "DELETE"])
def task_detail(task_id):
    tid = to_object_id(task_id)
    if not tid:
        return jsonify({"error": "invalid task id"}), 400

    t = tasks_collection.find_one({"_id": tid})
    if not t:
        return jsonify({"error": "Task not found"}), 404

    if request.method == "DELETE":
        tasks_collection.delete_one({"_id": tid})
        return jsonify({"ok": True}), 200

    # PATCH
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

    updates["updated_at"] = datetime.utcnow()
    tasks_collection.update_one({"_id": tid}, {"$set": updates})
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
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
