import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import { FaFolder, FaFileAlt, FaCloud, FaHdd } from "react-icons/fa";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000/rt";

function FileManager() {
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [previewFile, setPreviewFile] = useState(null); // File for preview
  const dropRef = useRef();

  const userId = localStorage.getItem("userId") || "68a095c74b792955f29769f1"; 
  axios.defaults.headers.common["X-User-Id"] = userId;

  const fetchFolders = async () => {
    try {
      const res = await axios.get(`${API_URL}/folders`);
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error("Failed to fetch folders:", err.response?.data || err);
      alert("Failed to fetch folders");
    }
  };

  useEffect(() => {
    fetchFolders();
    const socket = io(SOCKET_URL);
    socket.on("folder:created", (folder) => setFolders((prev) => [folder, ...prev]));
    socket.on("folder:deleted", ({ _id }) => setFolders((prev) => prev.filter((f) => f._id !== _id)));
    socket.on("file:uploaded", (fileDoc) => {
      setFolders((prev) =>
        prev.map((f) =>
          f._id === fileDoc.folder_id.toString()
            ? { ...f, files: [fileDoc, ...f.files] }
            : f
        )
      );
    });
    socket.on("file:deleted", ({ _id, folder_id }) => {
      setFolders((prev) =>
        prev.map((f) =>
          f._id === folder_id.toString()
            ? { ...f, files: f.files.filter((file) => file._id !== _id) }
            : f
        )
      );
    });
    return () => socket.disconnect();
  }, []);

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name?.trim()) return;
    try {
      await axios.post(`${API_URL}/folders`, { name });
    } catch (err) {
      console.error("Create folder error:", err.response?.data || err);
      alert(err.response?.data?.error || "Failed to create folder");
    }
  };

  const handleUpload = async (file, folderId) => {
    if (!file || !folderId) return alert("Select a folder first!");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API_URL}/folders/${folderId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      console.error("Upload file error:", err.response?.data || err);
      alert(err.response?.data?.error || "Failed to upload file");
    }
  };

  const handleFileSelect = (folderId) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = (e) => handleUpload(e.target.files[0], folderId);
    fileInput.click();
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API_URL}/files/${fileId}`);
    } catch (err) {
      console.error("Delete file error:", err.response?.data || err);
      alert("Failed to delete file");
    }
  };

  // -------------------- DOWNLOAD --------------------
  const handleDownload = async (fileId, filename) => {
    try {
      const res = await axios.get(`${API_URL}/files/${fileId}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Download error:", err.response?.data || err);
      alert("Failed to download file");
    }
  };

  // -------------------- PREVIEW --------------------
  const handlePreview = async (fileId, filename) => {
    try {
      const res = await axios.get(`${API_URL}/files/${fileId}`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      setPreviewFile({ url: blobUrl, name: filename });
    } catch (err) {
      console.error("Preview error:", err.response?.data || err);
      alert("Failed to preview file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!activeFolder) return alert("Select a folder first!");
    handleUpload(e.dataTransfer.files[0], activeFolder);
  };
  const handleDragOver = (e) => e.preventDefault();

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <h1 className="text-2xl font-bold mb-6">📂 File Manager</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleCreateFolder}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Folder
        </button>
      </div>

      {/* ------------------ Folder List ------------------ */}
      <div className="flex flex-wrap gap-4 mb-6">
        {folders.map((folder) => (
          <div
            key={folder._id}
            onClick={() => setActiveFolder(folder._id)}
            className={`cursor-pointer px-4 py-2 rounded border ${
              activeFolder === folder._id ? "bg-blue-100 border-blue-600" : "bg-gray-100 border-gray-300"
            } flex items-center gap-2`}
          >
            <FaFolder className="text-blue-500" /> {folder.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder._id);
              }}
              className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* ------------------ Files for active folder ------------------ */}
      {activeFolder && (
        <div>
          <div
            className="flex gap-3 items-center mb-4 border-2 border-dashed p-4 rounded"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            ref={dropRef}
          >
            <span>Drag & drop file here</span>
            <button
              onClick={() => handleFileSelect(activeFolder)}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Upload File
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {folders.find((f) => f._id === activeFolder)?.files.map((file) => (
              <div key={file._id} className="p-3 bg-white border rounded shadow flex flex-col gap-2">
                <div className="flex items-center gap-1 mb-1">
                  <FaFileAlt className="text-blue-500 text-2xl" />
                  {file.storage === "gridfs" ? (
                    <FaCloud title="GridFS Storage" className="text-green-500" />
                  ) : (
                    <FaHdd title="Local Storage" className="text-gray-500" />
                  )}
                </div>
                <span className="text-gray-700 text-sm truncate">{file.filename}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(file._id, file.filename)}
                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handlePreview(file._id, file.filename)}
                    className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file._id)}
                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------ Preview Modal ------------------ */}
      {previewFile && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded w-3/4 h-3/4 overflow-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">{previewFile.name}</h2>
          <button className="px-2 py-1 bg-red-600 text-white rounded"
                  onClick={() => setPreviewFile(null)}>Close</button>
        </div>

        {previewFile.type === "image" && (
          <img src={previewFile.url} alt={previewFile.name} className="w-full h-full object-contain" />
        )}
        {previewFile.type === "pdf" && (
          <iframe src={previewFile.url} className="w-full h-full"></iframe>
        )}
        {previewFile.type === "text" && (
          <pre className="overflow-auto text-sm">{previewFile.content}</pre>
        )}
      </div>
    </div>
  )}

      </div>
  );
}

export default FileManager;
