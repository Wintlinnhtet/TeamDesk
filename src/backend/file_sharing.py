from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from bson import ObjectId, errors
from datetime import datetime
import os
import gridfs
from mimetypes import guess_type
from io import BytesIO
from backend.database import db
from backend.extensions import socketio

file_sharing_bp = Blueprint("file_sharing", __name__, url_prefix="/api")

projects_collection = db["projects"]
folders_collection = db["folders"]
files_collection = db["files"]
users_collection = db["users"]
fs = gridfs.GridFS(db)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

LOCAL_FILE_THRESHOLD = 10 * 1024 * 1024  # 10 MB

# ------------------ Utilities ------------------
def get_current_user():
    user_id = request.headers.get("X-User-Id")
    print("🔥 DEBUG HEADER X-User-Id =", user_id)  # <-- add this
    if not user_id:
        return None
    try:
        return users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception as e:
        print("❌ DEBUG ObjectId error:", e)
        return None

def has_access(user, file_doc):
    if not user:
        return False
    if user.get("role") == "admin":
        return True

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
    folder_doc["_id"] = str(res.inserted_id)
    folder_doc["files"] = []

    socketio.emit("folder:created", folder_doc, namespace="/rt")
    return jsonify(folder_doc), 201

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

    project = projects_collection.find_one({"_id": folder["project_id"]})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Check access
    if user.get("role") != "admin" and user["_id"] != project["leader_id"] and user["_id"] not in project.get("member_ids", []):
        return jsonify({"error": "Unauthorized"}), 403

    uploaded_files = []

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
    # Try to find file_doc by string _id first (GridFS files)
    file_doc = files_collection.find_one({"_id": file_id})
    if not file_doc:
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
        return send_file(
            path,
            mimetype=mimetype or "application/octet-stream",
            download_name=file_doc["filename"],
            as_attachment=False
        )

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
    socketio.emit("file:deleted", {"_id": str(file_oid), "folder_id": str(file_doc["folder_id"])}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200