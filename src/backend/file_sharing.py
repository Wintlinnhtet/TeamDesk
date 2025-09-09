from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime
import os
from backend.database import db, fs
from backend.app import socketio

file_sharing_bp = Blueprint("file_sharing", __name__, url_prefix="/api")

folders_collection = db["folders"]
files_collection = db["files"]

UPLOAD_FOLDER = "./uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# File size threshold for local vs GridFS (in bytes)
LOCAL_FILE_THRESHOLD = 10 * 1024 * 1024  # 10 MB

# Utility
def serialize_doc(doc):
    doc["_id"] = str(doc["_id"])
    return doc

# --- FOLDER ROUTES ---
@file_sharing_bp.post("/folders")
def create_folder():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Folder name is required"}), 400

    folder = {"name": name, "createdAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}
    res = folders_collection.insert_one(folder)
    payload = {"_id": str(res.inserted_id), "name": name, "files": []}

    socketio.emit("folder:created", payload, namespace="/rt")
    return jsonify(payload), 201

@file_sharing_bp.get("/folders")
def list_folders():
    folders = []
    for f in folders_collection.find().sort("createdAt", -1):
        files = []
        for fl in files_collection.find({"folder_id": f["_id"]}).sort("createdAt", -1):
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
    try:
        fid = ObjectId(folder_id)
    except:
        return jsonify({"error": "Invalid folder id"}), 400

    # Delete all files in folder
    for fl in files_collection.find({"folder_id": fid}):
        if fl.get("storage") == "gridfs":
            try:
                fs.delete(fl["_id"])
            except: pass
        else:
            try: os.remove(fl["path"])
            except: pass
        files_collection.delete_one({"_id": fl["_id"]})

    folders_collection.delete_one({"_id": fid})
    socketio.emit("folder:deleted", {"_id": folder_id}, namespace="/rt")
    return jsonify({"message": "Folder deleted"}), 200

# --- FILE ROUTES ---
@file_sharing_bp.post("/folders/<folder_id>/files")
def upload_file(folder_id):
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # File size limit 50 MB
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > 50 * 1024 * 1024:
        return jsonify({"error": "compress your files to be under 50 MB"}), 400

    try:
        fid = ObjectId(folder_id)
    except:
        return jsonify({"error": "Invalid folder id"}), 400

    filename = secure_filename(file.filename)

    if size < LOCAL_FILE_THRESHOLD:
        # Save locally
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
            "createdAt": datetime.utcnow()
        }
        res = files_collection.insert_one(file_doc)
        file_doc["_id"] = str(res.inserted_id)
    else:
        # Save in GridFS
        grid_file_id = fs.put(file, filename=filename, content_type=file.mimetype,
                              folder_id=fid, uploaded_at=datetime.utcnow())
        storage = "gridfs"
        file_doc = {
            "_id": grid_file_id,
            "folder_id": folder_id,
            "filename": filename,
            "size": size,
            "mimetype": file.mimetype,
            "storage": storage
        }
        files_collection.insert_one(file_doc)

    socketio.emit("file:uploaded", file_doc, namespace="/rt")
    return jsonify(file_doc), 201

@file_sharing_bp.delete("/files/<file_id>")
def delete_file(file_id):
    try:
        fid = ObjectId(file_id)
    except:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": fid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if file_doc.get("storage") == "gridfs":
        try: fs.delete(fid)
        except: pass
    else:
        try: os.remove(file_doc["path"])
        except: pass

    files_collection.delete_one({"_id": fid})
    socketio.emit("file:deleted", {"_id": file_id, "folder_id": str(file_doc["folder_id"])}, namespace="/rt")
    return jsonify({"message": "File deleted"}), 200

@file_sharing_bp.get("/files/<file_id>")
def view_file(file_id):
    try:
        fid = ObjectId(file_id)
    except:
        return jsonify({"error": "Invalid file id"}), 400

    file_doc = files_collection.find_one({"_id": fid})
    if not file_doc:
        return jsonify({"error": "File not found"}), 404

    if file_doc.get("storage") == "gridfs":
        file = fs.get(fid)
        return send_file(file, download_name=file.filename, as_attachment=True)
    else:
        return send_file(file_doc["path"], download_name=file_doc["filename"], as_attachment=True)
