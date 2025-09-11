<<<<<<< HEAD
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime
import os
import gridfs
from mimetypes import guess_type
from io import BytesIO
from backend.database import db
from backend.extensions import socketio
import traceback

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


# ------------------ Helpers ------------------
def serialize_value(v):
    """Serialize a single value (ObjectId, datetime, list, dict) into JSON-safe types."""
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, dict):
        return serialize_doc(v)
    if isinstance(v, list):
        return [serialize_value(i) for i in v]
    return v


def serialize_doc(doc):
    """Convert MongoDB doc to JSON-serializable dict (recursively)."""
    if doc is None:
        return None
    # If this isn't a mapping (e.g. an ObjectId or primitive), just return serialized value
    result = {}
    try:
        items = doc.items()
    except Exception:
        return serialize_value(doc)

    for k, v in items:
        result[k] = serialize_value(v)
    return result


def safe_objectid(value):
    """Try to convert value to ObjectId, return None if invalid."""
    try:
        return ObjectId(value)
    except Exception:
        return None


# ------------------ Utilities ------------------
def get_current_user():
    user_id = request.headers.get("X-User-Id")
    print("🔥 DEBUG HEADER X-User-Id =", user_id)
    if not user_id:
        return None
    oid = safe_objectid(user_id)
    if not oid:
        print("❌ DEBUG: invalid X-User-Id", user_id)
        return None
    return users_collection.find_one({"_id": oid})


def has_access(user, file_doc):
    """Return True if user has access to the given file_doc.
    Expects project/leader/member fields to be stored as ObjectId in DB.
    """
    if not user:
        return False
    if user.get("role") == "admin":
        return True

    folder_id = file_doc.get("folder_id")
    # folder_id should be ObjectId already in DB
    if not folder_id:
        return False

    folder = folders_collection.find_one({"_id": folder_id})
    if not folder:
        return False
    project = projects_collection.find_one({"_id": folder.get("project_id")})
    if not project:
        return False

    if project.get("leader_id") == user.get("_id"):
        return True
    if user.get("_id") in project.get("member_ids", []):
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
        allowed_projects = list(projects_collection.find({
            "$or": [
                {"leader_id": user["_id"]},
                {"member_ids": user["_id"]}
            ]
        }))
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
                    "filename": fl.get("filename"),
                    "size": fl.get("size", 0),
                    "mimetype": fl.get("mimetype", ""),
                    "storage": fl.get("storage", "local"),
                    "createdAt": fl.get("createdAt").isoformat() if fl.get("createdAt") else None
                })
        folders.append({
            "_id": str(f["_id"]),
            "name": f.get("name", ""),
            "project_id": str(f.get("project_id")) if f.get("project_id") else None,
            "createdAt": f.get("createdAt").isoformat() if f.get("createdAt") else None,
            "files": files
        })

    return jsonify({"folders": folders})


@file_sharing_bp.get("/folders/<folder_id>/files")
def list_files(folder_id):
    try:
        folder_oid = ObjectId(folder_id)
    except Exception:
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

    project_oid = safe_objectid(project_id)
    if not project_oid:
        return jsonify({"error": "Invalid project id"}), 400

    project = projects_collection.find_one({"_id": project_oid})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if user.get("role") != "admin" and user["_id"] != project.get("leader_id") and user["_id"] not in project.get("member_ids", []):
        return jsonify({"error": "Unauthorized"}), 403

    folder_doc = {
        "name": name,
        "project_id": project_oid,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = folders_collection.insert_one(folder_doc)
    # refresh to have _id as ObjectId
    folder_doc = folders_collection.find_one({"_id": res.inserted_id})

    emitted = {
        "_id": str(folder_doc["_id"]),
        "name": folder_doc.get("name", ""),
        "project_id": str(folder_doc.get("project_id")) if folder_doc.get("project_id") else None,
        "createdAt": folder_doc.get("createdAt").isoformat() if folder_doc.get("createdAt") else None,
        "files": []
    }

    socketio.emit("folder:created", emitted, namespace="/rt")
    return jsonify(emitted), 201


# ------------------ Upload File ------------------
@file_sharing_bp.post("/folders/<folder_id>/files")
def upload_file(folder_id):
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        folder_oid = safe_objectid(folder_id)
        if not folder_oid:
            return jsonify({"error": "Invalid folder id"}), 400

        folder = folders_collection.find_one({"_id": folder_oid})
        if not folder:
            return jsonify({"error": "Folder not found"}), 404

        # permission check
        project = projects_collection.find_one({"_id": folder.get("project_id")})
        if user.get("role") != "admin" and user["_id"] != project.get("leader_id") and user["_id"] not in project.get("member_ids", []):
            return jsonify({"error": "Unauthorized"}), 403

        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        uploaded_files = []

        for file in request.files.getlist("file"):
            if file.filename == "":
                continue

            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)

            filename = secure_filename(file.filename)

            if size <= LOCAL_FILE_THRESHOLD:
                # save locally
                save_path = os.path.join(UPLOAD_FOLDER, f"{datetime.utcnow().timestamp()}_{filename}")
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
                file_doc = files_collection.find_one({"_id": res.inserted_id})
            else:
                # save to GridFS
                gridfs_id = fs.put(file, filename=filename, content_type=file.mimetype,
                                  folder_id=folder_oid, uploaded_at=datetime.utcnow())
                file_doc = {
                    "_id": gridfs_id,
                    "folder_id": folder_oid,
                    "filename": filename,
                    "size": size,
                    "mimetype": file.mimetype,
                    "storage": "gridfs",
                    "uploaded_by": user["_id"],
                    "uploader_role": user.get("role"),
                    "createdAt": datetime.utcnow()
                }
                files_collection.insert_one(file_doc)

            uploaded_files.append(file_doc)

        # Serialize before emitting/returning
        serialized_files = [serialize_doc(f) for f in uploaded_files]

        for f in serialized_files:
            socketio.emit("file:uploaded", f, namespace="/rt")

        return jsonify({"uploaded": serialized_files}), 201

    except Exception as e:
        print("❌ upload_file crashed:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


# ------------------ View File ------------------
@file_sharing_bp.get("/files/<file_id>")
def view_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # find file by either string id or ObjectId
    file_doc = None
    oid = safe_objectid(file_id)
    if oid:
        file_doc = files_collection.find_one({"_id": oid})
    if not file_doc:
        # try string-keyed _id (GridFS uses ObjectId but in some cases saved as string)
        file_doc = files_collection.find_one({"_id": file_id})

    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if not has_access(user, file_doc):
        return jsonify({"error": "Access denied"}), 403

    if file_doc.get("storage") == "gridfs":
        try:
            gridfs_id = safe_objectid(file_doc.get("_id")) or file_doc.get("_id")
            file_obj = fs.get(gridfs_id)
            bio = BytesIO(file_obj.read())
            mimetype = getattr(file_obj, "content_type", None) or "application/octet-stream"
            return send_file(bio, mimetype=mimetype, download_name=file_doc.get("filename"), as_attachment=False)
        except Exception as e:
            print("❌ GridFS get error:", e)
            traceback.print_exc()
            return jsonify({"error": "File not found in GridFS"}), 404
    else:
        path = file_doc.get("path")
        if not path or not os.path.exists(path):
            return jsonify({"error": "File missing"}), 404
        mimetype, _ = guess_type(path)
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

    return jsonify({"message": "Folder deleted"}), 200


# ------------------ Delete File ------------------
@file_sharing_bp.delete("/files/<file_id>")
def delete_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    file_oid = safe_objectid(file_id)
    if not file_oid:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": file_oid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    folder = folders_collection.find_one({"_id": file_doc.get("folder_id")})
    project = projects_collection.find_one({"_id": folder.get("project_id")}) if folder else None

    # Authorization: admin or project leader can delete; members only their own files
    if user.get("role") == "admin":
        pass
    elif project and project.get("leader_id") == user.get("_id"):
        pass
    elif project and user.get("_id") in project.get("member_ids", []):
        if file_doc.get("uploaded_by") != user.get("_id"):
            return jsonify({"error": "Members can only delete their own uploaded files"}), 403
    else:
        return jsonify({"error": "Unauthorized"}), 403

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
                print("❌ Local file delete error:", e)

    files_collection.delete_one({"_id": file_oid})
    socketio.emit("file:deleted", {"_id": str(file_oid), "folder_id": str(file_doc.get("folder_id"))}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200
=======
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime
import os
import gridfs
from mimetypes import guess_type
from io import BytesIO
from backend.database import db
from backend.extensions import socketio
import traceback

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


# ------------------ Helpers ------------------
def serialize_value(v):
    """Serialize a single value (ObjectId, datetime, list, dict) into JSON-safe types."""
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, dict):
        return serialize_doc(v)
    if isinstance(v, list):
        return [serialize_value(i) for i in v]
    return v


def serialize_doc(doc):
    """Convert MongoDB doc to JSON-serializable dict (recursively)."""
    if doc is None:
        return None
    # If this isn't a mapping (e.g. an ObjectId or primitive), just return serialized value
    result = {}
    try:
        items = doc.items()
    except Exception:
        return serialize_value(doc)

    for k, v in items:
        result[k] = serialize_value(v)
    return result


def safe_objectid(value):
    """Try to convert value to ObjectId, return None if invalid."""
    try:
        return ObjectId(value)
    except Exception:
        return None


# ------------------ Utilities ------------------
def get_current_user():
    user_id = request.headers.get("X-User-Id")
    print("🔥 DEBUG HEADER X-User-Id =", user_id)
    if not user_id:
        return None
    oid = safe_objectid(user_id)
    if not oid:
        print("❌ DEBUG: invalid X-User-Id", user_id)
        return None
    return users_collection.find_one({"_id": oid})


def has_access(user, file_doc):
    """Return True if user has access to the given file_doc.
    Expects project/leader/member fields to be stored as ObjectId in DB.
    """
    if not user:
        return False
    if user.get("role") == "admin":
        return True

    folder_id = file_doc.get("folder_id")
    # folder_id should be ObjectId already in DB
    if not folder_id:
        return False

    folder = folders_collection.find_one({"_id": folder_id})
    if not folder:
        return False
    project = projects_collection.find_one({"_id": folder.get("project_id")})
    if not project:
        return False

    if project.get("leader_id") == user.get("_id"):
        return True
    if user.get("_id") in project.get("member_ids", []):
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
        allowed_projects = list(projects_collection.find({
            "$or": [
                {"leader_id": user["_id"]},
                {"member_ids": user["_id"]}
            ]
        }))
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
                    "filename": fl.get("filename"),
                    "size": fl.get("size", 0),
                    "mimetype": fl.get("mimetype", ""),
                    "storage": fl.get("storage", "local"),
                    "createdAt": fl.get("createdAt").isoformat() if fl.get("createdAt") else None
                })
        folders.append({
            "_id": str(f["_id"]),
            "name": f.get("name", ""),
            "project_id": str(f.get("project_id")) if f.get("project_id") else None,
            "createdAt": f.get("createdAt").isoformat() if f.get("createdAt") else None,
            "files": files
        })

    return jsonify({"folders": folders})


@file_sharing_bp.get("/folders/<folder_id>/files")
def list_files(folder_id):
    try:
        folder_oid = ObjectId(folder_id)
    except Exception:
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

    project_oid = safe_objectid(project_id)
    if not project_oid:
        return jsonify({"error": "Invalid project id"}), 400

    project = projects_collection.find_one({"_id": project_oid})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if user.get("role") != "admin" and user["_id"] != project.get("leader_id") and user["_id"] not in project.get("member_ids", []):
        return jsonify({"error": "Unauthorized"}), 403

    folder_doc = {
        "name": name,
        "project_id": project_oid,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = folders_collection.insert_one(folder_doc)
    # refresh to have _id as ObjectId
    folder_doc = folders_collection.find_one({"_id": res.inserted_id})

    emitted = {
        "_id": str(folder_doc["_id"]),
        "name": folder_doc.get("name", ""),
        "project_id": str(folder_doc.get("project_id")) if folder_doc.get("project_id") else None,
        "createdAt": folder_doc.get("createdAt").isoformat() if folder_doc.get("createdAt") else None,
        "files": []
    }

    socketio.emit("folder:created", emitted, namespace="/rt")
    return jsonify(emitted), 201


# ------------------ Upload File ------------------
@file_sharing_bp.post("/folders/<folder_id>/files")
def upload_file(folder_id):
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        folder_oid = safe_objectid(folder_id)
        if not folder_oid:
            return jsonify({"error": "Invalid folder id"}), 400

        folder = folders_collection.find_one({"_id": folder_oid})
        if not folder:
            return jsonify({"error": "Folder not found"}), 404

        # permission check
        project = projects_collection.find_one({"_id": folder.get("project_id")})
        if user.get("role") != "admin" and user["_id"] != project.get("leader_id") and user["_id"] not in project.get("member_ids", []):
            return jsonify({"error": "Unauthorized"}), 403

        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        uploaded_files = []

        for file in request.files.getlist("file"):
            if file.filename == "":
                continue

            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)

            filename = secure_filename(file.filename)

            if size <= LOCAL_FILE_THRESHOLD:
                # save locally
                save_path = os.path.join(UPLOAD_FOLDER, f"{datetime.utcnow().timestamp()}_{filename}")
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
                file_doc = files_collection.find_one({"_id": res.inserted_id})
            else:
                # save to GridFS
                gridfs_id = fs.put(file, filename=filename, content_type=file.mimetype,
                                  folder_id=folder_oid, uploaded_at=datetime.utcnow())
                file_doc = {
                    "_id": gridfs_id,
                    "folder_id": folder_oid,
                    "filename": filename,
                    "size": size,
                    "mimetype": file.mimetype,
                    "storage": "gridfs",
                    "uploaded_by": user["_id"],
                    "uploader_role": user.get("role"),
                    "createdAt": datetime.utcnow()
                }
                files_collection.insert_one(file_doc)

            uploaded_files.append(file_doc)

        # Serialize before emitting/returning
        serialized_files = [serialize_doc(f) for f in uploaded_files]

        for f in serialized_files:
            socketio.emit("file:uploaded", f, namespace="/rt")

        return jsonify({"uploaded": serialized_files}), 201

    except Exception as e:
        print("❌ upload_file crashed:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


# ------------------ View File ------------------
@file_sharing_bp.get("/files/<file_id>")
def view_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # find file by either string id or ObjectId
    file_doc = None
    oid = safe_objectid(file_id)
    if oid:
        file_doc = files_collection.find_one({"_id": oid})
    if not file_doc:
        # try string-keyed _id (GridFS uses ObjectId but in some cases saved as string)
        file_doc = files_collection.find_one({"_id": file_id})

    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if not has_access(user, file_doc):
        return jsonify({"error": "Access denied"}), 403

    if file_doc.get("storage") == "gridfs":
        try:
            gridfs_id = safe_objectid(file_doc.get("_id")) or file_doc.get("_id")
            file_obj = fs.get(gridfs_id)
            bio = BytesIO(file_obj.read())
            mimetype = getattr(file_obj, "content_type", None) or "application/octet-stream"
            return send_file(bio, mimetype=mimetype, download_name=file_doc.get("filename"), as_attachment=False)
        except Exception as e:
            print("❌ GridFS get error:", e)
            traceback.print_exc()
            return jsonify({"error": "File not found in GridFS"}), 404
    else:
        path = file_doc.get("path")
        if not path or not os.path.exists(path):
            return jsonify({"error": "File missing"}), 404
        mimetype, _ = guess_type(path)
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

    return jsonify({"message": "Folder deleted"}), 200


# ------------------ Delete File ------------------
@file_sharing_bp.delete("/files/<file_id>")
def delete_file(file_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    file_oid = safe_objectid(file_id)
    if not file_oid:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": file_oid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    folder = folders_collection.find_one({"_id": file_doc.get("folder_id")})
    project = projects_collection.find_one({"_id": folder.get("project_id")}) if folder else None

    # Authorization: admin or project leader can delete; members only their own files
    if user.get("role") == "admin":
        pass
    elif project and project.get("leader_id") == user.get("_id"):
        pass
    elif project and user.get("_id") in project.get("member_ids", []):
        if file_doc.get("uploaded_by") != user.get("_id"):
            return jsonify({"error": "Members can only delete their own uploaded files"}), 403
    else:
        return jsonify({"error": "Unauthorized"}), 403

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
                print("❌ Local file delete error:", e)

    files_collection.delete_one({"_id": file_oid})
    socketio.emit("file:deleted", {"_id": str(file_oid), "folder_id": str(file_doc.get("folder_id"))}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200
>>>>>>> 8c1a5a82c3f104ea33be42347d12d9b96172c5ce
