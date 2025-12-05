from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime, timedelta, timezone
from bson import ObjectId, errors
from datetime import datetime
import os
import gridfs
from mimetypes import guess_type
from io import BytesIO
from backend.database import db
from backend.extensions import socketio
import traceback
import csv
import threading
import time
import json

file_sharing_bp = Blueprint("file_sharing", __name__, url_prefix="/api")

projects_collection = db["projects"]
folders_collection = db["folders"]
files_collection = db["files"]
users_collection = db["users"]
histories_collection = db["histories"]
fs = gridfs.GridFS(db)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

LOCAL_FILE_THRESHOLD = 10 * 1024 * 1024  # 10 MB

# ------------------ Helpers ------------------
def serialize_value(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, dict):
        return serialize_doc(v)
    if isinstance(v, list):
        return [serialize_value(i) for i in v]
    return v

def serialize_doc(doc, doc_type="log"):
    if not doc:
        return {}

    _id = str(doc.get("_id"))

    if doc_type == "log":
        timestamp = doc.get("timestamp")
        if hasattr(timestamp, "isoformat"):
            ts_str = timestamp.isoformat()
        else:
            ts_str = str(timestamp) if timestamp else None

        return {
            "_id": _id,
            "username": doc.get("username"),
            "action": doc.get("action"),
            "folder_name": doc.get("folder_name"),
            "file_name": doc.get("file_name"),
            "timestamp": ts_str,
        }

    elif doc_type == "file":
        created_at = doc.get("createdAt")
        if hasattr(created_at, "isoformat"):
            created_str = created_at.isoformat()
        else:
            created_str = str(created_at) if created_at else None

        return {
            "_id": _id,
            "folder_id": str(doc.get("folder_id")) if doc.get("folder_id") else None,
            "filename": doc.get("filename", "unknown"),
            "size": doc.get("size", 0),
            "mimetype": doc.get("mimetype", "application/octet-stream"),
            "storage": doc.get("storage", "local"),
            "uploaded_by": str(doc.get("uploaded_by")) if doc.get("uploaded_by") else None,
            "uploader_role": doc.get("uploader_role", ""),
            "createdAt": created_str,
        }



    # result = {}
    # for k, v in doc.items():
    #     if isinstance(v, ObjectId):
    #         result[k] = str(v)
    #     elif isinstance(v, datetime):
    #         result[k] = v.isoformat()
    #     else:
    #         result[k] = v
    # return result

def safe_objectid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None

def log_action(user, action, folder=None, file=None):
    try:
        if not user or "_id" not in user:
            return

        # Build record
        record = {
            "_id": str(ObjectId()),
            "user_id": str(user["_id"]),
            "username": user.get("username") or user.get("name") or user.get("email") or "Unknown",  # <-- fixed
            "action":action,
            "folder_id": str(folder["_id"]) if folder else None,
            "folder_name": folder.get("name") if folder else None,
            "file_id": str(file["_id"]) if file else None,
            "file_name": file.get("filename") if file else None,
            "timestamp": datetime.now(timezone.utc)  # timezone-aware UTC
        }

        # Insert into MongoDB
        histories_collection.insert_one(record)

        # Prepare record for SocketIO (convert datetime to ISO string)
        emit_record = record.copy()
        emit_record["timestamp"] = record["timestamp"].isoformat()

        try:
            socketio.emit("log:created", emit_record, namespace="/rt")
        except Exception as e:
            print("⚠️ socketio emit failed:", e)

    except Exception as e:
        print("⚠️ log_action failed:", e)

# ------------------ Utilities ------------------
def get_current_user():
    user_id = request.headers.get("X-User-Id")
    print("🔥 DEBUG HEADER X-User-Id =", user_id)  # <-- add this
    if not user_id:
        return None
    oid = safe_objectid(user_id)
    if not oid:
        try:
            return users_collection.find_one({"_id": ObjectId(user_id)})
        except Exception as e:
            print("❌ DEBUG ObjectId error:", e)
        return None
    return users_collection.find_one({"_id": oid})


def has_access(user, file_doc):
    if not user:
        return False
    if user.get("role") == "admin":
        return True

    folder_id = file_doc.get("folder_id")
    if not folder_id:
        return False

    folder = folders_collection.find_one({"_id": folder_id})
    folder = folders_collection.find_one({"_id": file_doc["folder_id"]})
    if not folder:
        return False
    project = projects_collection.find_one({"_id": folder["project_id"]})
    if not project:
        return False

    # Leader or member
    if project["leader_id"] == user["_id"]:
        return True
    if user["_id"] in project.get("member_ids", []):
        return True

    return False

# ------------------ Logs Endpoint ------------------
@file_sharing_bp.get("/user/logs")
def get_user_logs():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    query = {"user_id": str(user["_id"])}
    logs_cursor = histories_collection.find(query).sort("timestamp", -1).limit(100)
    logs = [l for l in logs_cursor]  # already JSON serializable because we stored IDs as strings
    return jsonify({"logs": logs})


# ------------------ Projects Endpoint ------------------
@file_sharing_bp.get("/projects")
def get_projects():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.get("role") == "admin":
        allowed_projects = list(projects_collection.find())
    else:
        # Use ObjectId comparison
        allowed_projects = list(projects_collection.find({
            "$or": [
                {"leader_id": user["_id"]},
                {"member_ids": user["_id"]}
            ]
        }))

    projects = [{"_id": str(p["_id"]), "name": p.get("name", "")} for p in allowed_projects]
    return jsonify({"projects": projects})

# ------------------ Folders Endpoint ------------------
@file_sharing_bp.get("/folders")
def list_folders():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.get("role") == "admin":
        folders_cursor = folders_collection.find().sort("createdAt", -1)
    else:
        allowed_projects = projects_collection.find({
            "$or": [
                {"leader_id": user["_id"]},
                {"member_ids": user["_id"]}
            ]
        })
        allowed_project_ids = [p["_id"] for p in allowed_projects]
        folders_cursor = folders_collection.find({
            "project_id": {"$in": allowed_project_ids}
        }).sort("createdAt", -1)

    folders = []
    for f in folders_cursor:
        files = []
        for fl in files_collection.find({"folder_id": f["_id"]}).sort("createdAt", -1):
            if has_access(user, fl):
                files.append({
                    "_id": str(fl["_id"]),
                    "filename": fl["filename"],
                    "size": fl.get("size", 0),
                    "mimetype": fl.get("mimetype", ""),
                    "storage": fl.get("storage", "local"),
                    "createdAt": fl.get("createdAt").isoformat() if fl.get("createdAt") else None
                })
        folders.append({
            "_id": str(f["_id"]),
            "name": f.get("name", ""),
            "project_id": str(f.get("project_id")),
            "createdAt": f.get("createdAt").isoformat() if f.get("createdAt") else None,
            "files": files
        })
    return jsonify({"folders": folders})

@file_sharing_bp.get("/folders/<folder_id>/files")
def list_files(folder_id):
    folder_oid = safe_objectid(folder_id)
    if not folder_oid:
        return jsonify({"error": "Invalid folder id"}), 400

    files = list(files_collection.find({"folder_id": folder_oid}))
    serialized_files = [serialize_doc(f) for f in files]

    return jsonify(serialized_files), 200

# ------------------ Create Folder ------------------
@file_sharing_bp.post("/folders")
def create_folder_route():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    project_id = data.get("project_id")

    if not name or not project_id:
        return jsonify({"error": "Folder name and project_id required"}), 400

    try:
        project_oid = ObjectId(project_id)
    except:
        return jsonify({"error": "Invalid project id"}), 400

    project = projects_collection.find_one({"_id": project_oid})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Admin, leader, or member of the project can create folder
    if user.get("role") != "admin" and user["_id"] != project["leader_id"] and user["_id"] not in project.get("member_ids", []):
        return jsonify({"error": "Unauthorized"}), 403

    folder_doc = {
        "name": name,
        "project_id": project_oid,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = folders_collection.insert_one(folder_doc)
    folder_doc = folders_collection.find_one({"_id": res.inserted_id})

    emitted = {
        "_id": str(folder_doc["_id"]),
        "name": folder_doc.get("name", ""),
        "project_id": str(folder_doc.get("project_id")) if folder_doc.get("project_id") else None,
        "createdAt": folder_doc.get("createdAt").isoformat() if folder_doc.get("createdAt") else None,
        "files": []
    }
    folder_doc["_id"] = str(res.inserted_id)
    folder_doc["files"] = []

    socketio.emit("folder:created", emitted, namespace="/rt")
    # Pass folder object to log_action
    log_action(user, "create_folder", folder=folder_doc)
    return jsonify(emitted), 201
    socketio.emit("folder:created", folder_doc, namespace="/rt")
    return jsonify(folder_doc), 201

# ------------------ Upload File ------------------
@file_sharing_bp.post("/folders/<folder_id>/files")
def upload_file(folder_id):
    user = get_current_user()
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    try:
        folder_oid = ObjectId(folder_id)
    except:
        return jsonify({"error": "Invalid folder id"}), 400

    folder = folders_collection.find_one({"_id": folder_oid})
    if not folder:
        return jsonify({"error": "Folder not found"}), 404

        project = projects_collection.find_one({"_id": folder.get("project_id")})
        if user.get("role") != "admin" and user["_id"] != project.get("leader_id") and user["_id"] not in project.get("member_ids", []):
            return jsonify({"error": "Unauthorized"}), 403
    project = projects_collection.find_one({"_id": folder["project_id"]})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Check access
    if user.get("role") != "admin" and user["_id"] != project["leader_id"] and user["_id"] not in project.get("member_ids", []):
        return jsonify({"error": "Unauthorized"}), 403

    uploaded_files = []

    for file in request.files.getlist("file"):
            if not file.filename:
                continue
    # Loop through all uploaded files
    for file in request.files.getlist("file"):
        if file.filename == "":
            continue

        # Get file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 50 * 1024 * 1024:
            continue  # skip too large files

            filename = secure_filename(file.filename)
            created_at = datetime.now(timezone.utc)
        filename = secure_filename(file.filename)

        if size <= LOCAL_FILE_THRESHOLD:
            # Save locally
            save_path = os.path.join(UPLOAD_FOLDER, f"{created_at.timestamp()}_{filename}")
            file.save(save_path)
            file_doc = {
                "folder_id": folder_oid,
                "filename": filename,
                "path": save_path,
                "size": size,
                "mimetype": file.mimetype,
                "storage": "local",
                "createdAt": created_at,
                "uploaded_by": user["_id"],
                "uploader_role": user.get("role")
            }
            res = files_collection.insert_one(file_doc)
            file_doc = files_collection.find_one({"_id": res.inserted_id})
        else:
                # Save to GridFS
                file.seek(0)
                gridfs_id = fs.put(file, filename=filename, content_type=file.mimetype,
                                   folder_id=folder_oid, uploaded_at=created_at)
                file_doc = {
                    "_id": gridfs_id,
                    "folder_id": folder_oid,
                    "filename": filename,
                    "size": size,
                    "mimetype": file.mimetype,
                    "storage": "gridfs",
                    "uploaded_by": user["_id"],
                    "uploader_role": user.get("role"),
                    "createdAt": created_at
                }
                files_collection.insert_one(file_doc)

        uploaded_files.append(file_doc)

        # Serialize files for UI and socket
        serialized_files = [serialize_doc(f, doc_type="file") for f in uploaded_files]

        # Emit to socket only once per file
        for raw_doc, serialized in zip(uploaded_files, serialized_files):
            socketio.emit("file:uploaded", serialized, namespace="/rt")
            try:
                log_action(user, "upload_file", folder=folder, file=raw_doc)
            except Exception as e:
                print("❌ log_action failed:", e)


        return jsonify({"uploaded": serialized_files}), 201
        if size < LOCAL_FILE_THRESHOLD:
            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)

            file_doc = {
                "folder_id": folder_oid,
                "filename": filename,
                "path": save_path,
                "size": size,
                "mimetype": file.mimetype,
                "storage": "local",
                "createdAt": datetime.utcnow(),
                "uploaded_by": user["_id"],
                "uploader_role": user.get("role")
            }
            res = files_collection.insert_one(file_doc)
            file_doc["_id"] = str(res.inserted_id)
        else:
            grid_file_id = fs.put(file, filename=filename, content_type=file.mimetype,
                                  folder_id=folder_oid, uploaded_at=datetime.utcnow())
            file_doc = {
                "_id": str(grid_file_id),
                "folder_id": folder_oid,
                "filename": filename,
                "size": size,
                "mimetype": file.mimetype,
                "storage": "gridfs",
                "uploaded_by": user["_id"],
                "uploader_role": user.get("role")
            }
            files_collection.insert_one(file_doc)
    uploaded_files.append(file_doc)
    # Emit for each uploaded file
    for f in uploaded_files:
        socketio.emit("file:uploaded", f, namespace="/rt")
    return jsonify({"uploaded": uploaded_files}), 201

@file_sharing_bp.get("/files/<file_id>")
def view_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    file_doc = None
    oid = safe_objectid(file_id)
    if oid:
        file_doc = files_collection.find_one({"_id": oid})
    # Try to find file_doc by string _id first (GridFS files)
    file_doc = files_collection.find_one({"_id": file_id})
    if not file_doc:
        file_doc = files_collection.find_one({"_id": file_id})

        # fallback: try ObjectId for local files
        try:
            file_oid = ObjectId(file_id)
            file_doc = files_collection.find_one({"_id": file_oid})
        except:
            return jsonify({"error": "Invalid file id"}), 400
    if not file_doc:
        return jsonify({"error": "File not found"}), 404
    if not has_access(user, file_doc):
        return jsonify({"error": "Access denied"}), 403
    if file_doc.get("storage") == "gridfs":
        try:
            gridfs_id = ObjectId(file_doc["_id"])
            file_obj = fs.get(gridfs_id)
            data = file_obj.read()
            bio = BytesIO(data)
            mimetype = file_obj.content_type or "application/octet-stream"
            return send_file(
                bio,
                mimetype=mimetype,
                download_name=file_doc["filename"],
                as_attachment=False
            )
        except Exception as e:
            print("❌ GridFS get error:", e)
            return jsonify({"error": "File not found in GridFS"}), 404
    else:
        path = file_doc.get("path")
        if not path or not os.path.exists(path):
            return jsonify({"error": "File missing"}), 404
        mimetype, _ = guess_type(path)
        # Pass folder object to log_action
        folder = folders_collection.find_one({"_id": file_doc.get("folder_id")})
        log_action(user, "preview_file", folder=folder, file=file_doc)
        return send_file(path, mimetype=mimetype or "application/octet-stream", download_name=file_doc.get("filename"), as_attachment=False)

# ------------------ Delete Folder ------------------
@file_sharing_bp.delete("/folders/<folder_id>")
def delete_folder(folder_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    folder_oid = safe_objectid(folder_id)
    if not folder_oid:
        return jsonify({"error": "Invalid folder id"}), 400

    folder = folders_collection.find_one({"_id": folder_oid})
    if not folder:
        return jsonify({"error": "Folder not found"}), 404

    project = projects_collection.find_one({"_id": folder.get("project_id")})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if user.get("role") != "admin" and project.get("leader_id") != user.get("_id"):
        return jsonify({"error": "Unauthorized"}), 403

    files_in_folder = files_collection.find({"folder_id": folder_oid})
    for file_doc in files_in_folder:
        if file_doc.get("storage") == "gridfs":
            try:
                fs.delete(safe_objectid(file_doc.get("_id")) or file_doc.get("_id"))
            except Exception as e:
                print("❌ GridFS delete error:", e)
        else:
            path = file_doc.get("path")
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print("❌ local file delete error:", e)
    files_collection.delete_many({"folder_id": folder_oid})
    folders_collection.delete_one({"_id": folder_oid})
    socketio.emit("folder:deleted", {"_id": str(folder_oid)}, namespace="/rt")
    log_action(user, "delete_folder", folder=folder)
    return jsonify({"message": "Folder deleted"}), 200

# ------------------ Delete File ------------------

@file_sharing_bp.delete("/files/<file_id>")
def delete_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        file_oid = ObjectId(file_id)
    except:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": file_oid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    folder = folders_collection.find_one({"_id": file_doc["folder_id"]})
    project = projects_collection.find_one({"_id": folder["project_id"]}) if folder else None

    # Permissions: admin > leader > uploader
    if user.get("role") == "admin":
        pass
    elif project and project["leader_id"] == user["_id"]:
        pass
    elif user["_id"] in project.get("member_ids", []):
        if file_doc.get("uploaded_by") != user["_id"]:
            return jsonify({"error": "Members can only delete their own uploaded files"}), 403
    else:
        return jsonify({"error": "Unauthorized"}), 403

    # Delete storage
    if file_doc.get("storage") == "gridfs":
        try:
            fs.delete(ObjectId(file_doc["_id"]))
        except Exception as e:
            print("❌ GridFS delete error:", e)
    else:
        path = file_doc.get("path")
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print("❌ Local file delete error:", e)


    files_collection.delete_one({"_id": file_oid})
    socketio.emit("file:deleted", {"_id": str(file_oid), "folder_id": str(file_doc.get("folder_id"))}, namespace="/rt")
    log_action(user, "delete_file", folder=folder, file=file_doc)
    socketio.emit("file:deleted", {"_id": str(file_oid), "folder_id": str(file_doc["folder_id"])}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200

# Log Action History

@file_sharing_bp.get("/logs")
def get_logs():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    search = request.args.get("search", "").strip()

    query = {}

    if search:
        query["$or"] = [
            {"username": {"$regex": search, "$options": "i"}},
            {"folder_name": {"$regex": search, "$options": "i"}},
            {"file_name": {"$regex": search, "$options": "i"}},
        ]

    one_month_ago = datetime.utcnow() - timedelta(days=30)
    query["timestamp"] = {"$gte": one_month_ago}

    total_count = histories_collection.count_documents(query)
    logs = list(histories_collection.find(query)
                .sort("timestamp", -1)
                .skip((page - 1) * limit)
                .limit(limit))

    serialized_logs = [serialize_doc(l) for l in logs]

    return jsonify({
        "logs": serialized_logs,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit,
        "total_count": total_count
    })

# ------------------ View Logs ------------------
@file_sharing_bp.get("/histories")
def get_histories():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Search filters
    username = request.args.get("username", "").strip()
    foldername = request.args.get("foldername", "").strip()
    filename = request.args.get("filename", "").strip()

    date = request.args.get("date", "").strip()  # format: YYYY-MM-DD
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = {}
    
    # Only retrieve logs within the last 30 days
    cutoff = datetime.utcnow() - timedelta(days=30)
    query["timestamp"] = {"$gte": cutoff}

    if username:
        query["username"] = {"$regex": username, "$options": "i"}
    if filename:
        query["filename"] = {"$regex": filename, "$options": "i"}
    if foldername:
        folder = folders_collection.find_one({"name": {"$regex": foldername, "$options": "i"}})
        if folder:
            query["folder_id"] = folder["_id"]
        else:
            query["folder_id"] = None

    if date:
        try:
            start = datetime.strptime(date, "%Y-%m-%d")
            end = start + timedelta(days=1)
            query["timestamp"]["$gte"] = start
            query["timestamp"]["$lt"] = end
        except:
            pass

    total = histories_collection.count_documents(query)
    histories_cursor = histories_collection.find(query).sort("timestamp", -1).skip((page-1)*per_page).limit(per_page)
    histories = [serialize_doc(h) for h in histories_cursor]

    return jsonify({
        "histories": histories,
        "total": total,
        "page": page,
        "per_page": per_page
    })


def archive_old_logs():
    while True:
        one_month_ago = datetime.utcnow() - timedelta(days=30)
        old_logs = list(histories_collection.find({"timestamp": {"$lt": one_month_ago}}))
        if old_logs:
            csv_file = os.path.join(BASE_DIR, "archives", f"logs_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.csv")
            os.makedirs(os.path.dirname(csv_file), exist_ok=True)
            keys = ["user_id","username","action","folder_id","folder_name","file_id","file_name","timestamp"]
            with open(csv_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                for log in old_logs:
                    writer.writerow(serialize_doc(log))
            histories_collection.delete_many({"timestamp": {"$lt": one_month_ago}})
        time.sleep(3600)  # check every hour

@file_sharing_bp.get("/test/logs")
def test_logs():
    logs = list(histories_collection.find().sort("timestamp", -1).limit(10))
    logs = [serialize_doc(l) for l in logs]  # <-- serialize here
    return jsonify(logs)



# Start background thread
threading.Thread(target=archive_old_logs, daemon=True).start()
