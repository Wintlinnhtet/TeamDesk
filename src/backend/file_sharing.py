from flask import Blueprint, request, jsonify, send_file, Response
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime
import os
from backend.database import db, fs
from backend.extensions import socketio
from mimetypes import guess_type

file_sharing_bp = Blueprint("file_sharing", __name__, url_prefix="/api")

folders_collection = db["folders"]
files_collection = db["files"]
users_collection = db["users"]

UPLOAD_FOLDER = "./uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

LOCAL_FILE_THRESHOLD = 10 * 1024 * 1024  # 10 MB

# ------------------ Utilities ------------------
def get_current_user():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    try:
        return users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        return None

def has_access(user, file_doc):
    if not user:
        return False
    role = user.get("role")
    if role == "admin":
        return True

    uploader_role = file_doc.get("uploader_role")
    if role == "project_manager" and uploader_role == "admin":
        return True
    if role == "employee" and uploader_role == "project_manager":
        return True
    return False

# ------------------ Folder Routes ------------------
@file_sharing_bp.post("/folders")
def create_folder_route():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if user.get("role") not in ["admin", "project_manager"]:
        return jsonify({"error": "Permission denied"}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Folder name is required"}), 400

    folder_doc = {
        "name": name,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    res = folders_collection.insert_one(folder_doc)
    folder_doc["_id"] = str(res.inserted_id)
    folder_doc["files"] = []

    socketio.emit("folder:created", folder_doc, namespace="/rt")
    return jsonify(folder_doc), 201

@file_sharing_bp.get("/folders")
def list_folders():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    folders = []
    for f in folders_collection.find().sort("createdAt", -1):
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
            "createdAt": f.get("createdAt").isoformat() if f.get("createdAt") else None,
            "files": files
        })
    return jsonify({"folders": folders})

@file_sharing_bp.delete("/folders/<folder_id>")
def delete_folder(folder_id):
    user = get_current_user()
    if not user or user.get("role") != "admin":
        return jsonify({"error": "Only admins can delete folders"}), 403

    try:
        fid = ObjectId(folder_id)
    except:
        return jsonify({"error": "Invalid folder id"}), 400

    for fl in files_collection.find({"folder_id": fid}):
        if fl.get("storage") == "gridfs":
            try:
                fs.delete(fl["_id"])
            except:
                pass
        else:
            try:
                os.remove(fl["path"])
            except FileNotFoundError:
                pass
        files_collection.delete_one({"_id": fl["_id"]})

    folders_collection.delete_one({"_id": fid})
    socketio.emit("folder:deleted", {"_id": folder_id}, namespace="/rt")
    return jsonify({"message": "Folder deleted"}), 200

# ------------------ File Routes ------------------
@file_sharing_bp.post("/folders/<folder_id>/files")
def upload_file(folder_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > 50 * 1024 * 1024:
        return jsonify({"error": "File too large (max 50MB)"}), 400

    try:
        fid = ObjectId(folder_id)
    except:
        return jsonify({"error": "Invalid folder id"}), 400

    filename = secure_filename(file.filename)

    if size < LOCAL_FILE_THRESHOLD:
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)
        storage = "local"
        file_doc = {
            "folder_id": fid,
            "filename": filename,
            "path": save_path,
            "size": size,
            "mimetype": file.mimetype,
            "storage": storage,
            "createdAt": datetime.utcnow(),
            "uploaded_by": user["_id"],
            "uploader_role": user.get("role")
        }
        res = files_collection.insert_one(file_doc)
        file_doc["_id"] = str(res.inserted_id)
    else:
        grid_file_id = fs.put(file, filename=filename, content_type=file.mimetype,
                              folder_id=fid, uploaded_at=datetime.utcnow())
        storage = "gridfs"
        file_doc = {
            "_id": grid_file_id,
            "folder_id": fid,
            "filename": filename,
            "size": size,
            "mimetype": file.mimetype,
            "storage": storage,
            "uploaded_by": user["_id"],
            "uploader_role": user.get("role")
        }
        uploader_role = user.get("role", "employee")  # default fallback
        file_doc["uploader_role"] = uploader_role
        files_collection.insert_one(file_doc)


    socketio.emit("file:uploaded", file_doc, namespace="/rt")
    return jsonify(file_doc), 201

@file_sharing_bp.delete("/files/<file_id>")
def delete_file(file_id):
    user = get_current_user()
    if not user or user.get("role") != "admin":
        return jsonify({"error": "Only admins can delete files"}), 403

    try:
        fid = ObjectId(file_id)
    except:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": fid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if file_doc.get("storage") == "gridfs":
        try:
            fs.delete(fid)
        except:
            pass
    else:
        try:
            os.remove(file_doc["path"])
        except FileNotFoundError:
            pass

    files_collection.delete_one({"_id": fid})
    socketio.emit("file:deleted", {"_id": file_id, "folder_id": str(file_doc["folder_id"])}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200

@file_sharing_bp.get("/files/<file_id>")
def view_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        fid = ObjectId(file_id)
    except:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": fid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if not has_access(user, file_doc):
        return jsonify({"error": "Access denied"}), 403

    if file_doc.get("storage") == "gridfs":
        # GridFS file
        file_obj = fs.get(fid)
        mimetype = file_obj.content_type or "application/octet-stream"
        return send_file(
            file_obj,
            mimetype=mimetype,
            download_name=file_doc["filename"],
            as_attachment=False  # allow browser preview
        )
    else:
        # Local file
        path = file_doc["path"]
        if not os.path.exists(path):
            return jsonify({"error": "File missing on server"}), 404
        mimetype, _ = guess_type(path)
        return send_file(
            path,
            mimetype=mimetype or "application/octet-stream",
            download_name=file_doc["filename"],
            as_attachment=False  # allow browser preview
        )
