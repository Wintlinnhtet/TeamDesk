from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime

app = Flask(__name__)

# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
SERVER_IP = "192.168.1.9"   # <-- put your LAN IP here (e.g., 192.168.x.x)

# Allow both localhost (dev) and your LAN origin (other devices)
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5137",
    f"http://{SERVER_IP}:5137",   # Vite on LAN
]

CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

# --- collections ---
users_collection = db["users"]
projects_collection = db["projects"]
tasks_collection = db["tasks"]

# --- health check ---
@app.get("/ping")
def ping():
    return jsonify({"ok": True, "from": "flask"})

# -------------------- ADD MEMBER --------------------
@app.post("/add-member")
def add_member():
    data = request.get_json() or {}
    print("📩 Received data:", data)

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
    print("📩 Received data:", data)
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Signin successful",
        "user": {"_id": str(user["_id"]), "name": user.get("name"), "email": user.get("email"), "role": user.get("role")}
    })

# -------------------- MEMBERS (role=member) --------------------
@app.get("/members")
def get_members():
    try:
        cur = users_collection.find(
            {"role": {"$regex": r"^\s*member\s*$", "$options": "i"}},
            {"name": 1, "email": 1}
        )
        members = [{"_id": str(u["_id"]), "name": u.get("name",""), "email": u.get("email","")} for u in cur]
        print(f"[members] returning {len(members)} member(s): {[m.get('name') or m.get('email') for m in members]}")
        return jsonify(members)
    except Exception as e:
        print("ERROR /members:", e)
        return jsonify({"error": str(e)}), 500

# -------------------- PROJECTS (GET list + POST create) --------------------
@app.route("/projects", methods=["GET", "POST", "OPTIONS"])
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
                # if multiple criteria present, match any of them
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

    # ... keep your POST create logic unchanged below ...

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

# -------------------- TASKS (create) --------------------
@app.post("/tasks")
def create_task():
    data = request.get_json() or {}

    try:
        project_id = ObjectId(data.get("project_id"))
        assignee_id = ObjectId(data.get("assignee_id"))
    except Exception:
        return jsonify({"error": "Invalid project_id or assignee_id"}), 400

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    start_at = data.get("start_at")   # ISO string
    end_at = data.get("end_at")       # ISO string
    created_by = data.get("created_by")  # leader user id (string optional)
    project_role = (data.get("project_role") or "").strip()  # ✅ NEW

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    proj = projects_collection.find_one({"_id": project_id})
    if not proj:
        return jsonify({"error": "Project not found"}), 404
    if assignee_id not in proj.get("member_ids", []):
        return jsonify({"error": "Assignee must be a member of this project"}), 400

    doc = {
        "project_id": project_id,
        "assignee_id": assignee_id,
        "title": title,
        "description": description,
        "start_at": start_at,
        "end_at": end_at,
        "status": "todo",
        "created_by": ObjectId(created_by) if created_by else None,
        "project_role": project_role or None,               # ✅ NEW
        "created_at": __import__("datetime").datetime.utcnow(),
    }
    ins = tasks_collection.insert_one(doc)
    return jsonify({"message": "Task created", "task_id": str(ins.inserted_id)}), 201


# --- list tasks (by assignee and/or project) ---
@app.route("/tasks", methods=["GET", "POST", "OPTIONS"])
def tasks():
    # ---------- LIST (GET /tasks?assignee_id=...&project_id=...) ----------
    if request.method == "GET":
        try:
            q = {}

            assignee_id = request.args.get("assignee_id")
            if assignee_id:
                try:
                    q["assignee_id"] = ObjectId(assignee_id)
                except Exception:
                    return jsonify({"error": "Invalid assignee_id"}), 400

            project_id = request.args.get("project_id")
            if project_id:
                try:
                    q["project_id"] = ObjectId(project_id)
                except Exception:
                    return jsonify({"error": "Invalid project_id"}), 400

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
                    "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else None,
                })
            return jsonify(out)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ---------- CREATE (POST /tasks) ----------
    if request.method == "POST":
        data = request.get_json() or {}
        try:
            project_id = ObjectId(data.get("project_id"))
            assignee_id = ObjectId(data.get("assignee_id"))
        except Exception:
            return jsonify({"error": "Invalid project_id or assignee_id"}), 400

        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        start_at = data.get("start_at")   # ISO string
        end_at = data.get("end_at")       # ISO string
        created_by = data.get("created_by")
        project_role = (data.get("project_role") or "").strip()

        if not title:
            return jsonify({"error": "Task title is required"}), 400

        proj = projects_collection.find_one({"_id": project_id})
        if not proj:
            return jsonify({"error": "Project not found"}), 404
        if assignee_id not in proj.get("member_ids", []):
            return jsonify({"error": "Assignee must be a member of this project"}), 400

        doc = {
            "project_id": project_id,
            "assignee_id": assignee_id,
            "title": title,
            "description": description,
            "start_at": start_at,
            "end_at": end_at,
            "status": "todo",
            "project_role": project_role or None,
            "created_by": ObjectId(created_by) if created_by else None,
            "created_at": datetime.utcnow(),
        }
        ins = tasks_collection.insert_one(doc)
        return jsonify({"message": "Task created", "task_id": str(ins.inserted_id)}), 201

    # ---------- Preflight (OPTIONS) ----------
    return ("", 204)


@app.get("/get-user/<user_id>")
def get_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # normalize experience: prefer array; if stored as JSON string, parse it
        exp = user.get("experience", [])
        if isinstance(exp, str):
            try:
                import json
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
