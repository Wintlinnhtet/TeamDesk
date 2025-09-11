import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import {
  FaFolder, FaFileAlt, FaFileExcel, FaFileCsv, FaFileCode, FaFileImage, FaFilePdf, FaCloud, FaHdd, FaSearch
} from "react-icons/fa";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000/rt";

// File icons mapping
const fileIcons = {
  py: FaFileCode,
  js: FaFileCode,
  java: FaFileCode,
  html: FaFileCode,
  css: FaFileCode,
  jpg: FaFileImage,
  jpeg: FaFileImage,
  png: FaFileImage,
  gif: FaFileImage,
  bmp: FaFileImage,
  xls: FaFileExcel,
  xlsx: FaFileExcel,
  csv: FaFileCsv,
  pdf: FaFilePdf,
};

// File colors
const fileColors = {
  py: "text-yellow-500",
  js: "text-yellow-400",
  java: "text-red-500",
  html: "text-orange-500",
  css: "text-blue-500",
  jpg: "text-green-500",
  jpeg: "text-green-500",
  png: "text-green-500",
  gif: "text-green-400",
  bmp: "text-green-300",
  xls: "text-green-600",
  xlsx: "text-green-600",
  csv: "text-teal-600",
  pdf: "text-red-600",
};

// Get file icon component with color
function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const Icon = fileIcons[ext] || FaFileAlt;
  const colorClass = fileColors[ext] || "text-gray-500";
  return <Icon className={`text-2xl ${colorClass}`} />;
}

// Helper to extract userId
function getUserId() {
  const rawUserId = localStorage.getItem("userId");
  if (rawUserId) return rawUserId;

  const rawUser = localStorage.getItem("user");
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      return parsed._id || parsed.id || null;
    } catch {
      return null;
    }
  }
  return null;
}

function FileManager() {
  const [folders, setFolders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [showCreateFolderForm, setShowCreateFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const dropRef = useRef();

  // ---------------- Fetch Projects & Folders ----------------
  const fetchProjects = async () => {
    const userId = getUserId();
    if (!userId) return console.warn("⚠️ No userId in localStorage");
    try {
      const res = await axios.get(`${API_URL}/projects`, {
        headers: { "X-User-Id": userId },
      });
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("❌ Failed to fetch projects:", err.response?.data || err);
      alert("Failed to fetch projects");
    }
  };

  const fetchFolders = async () => {
    const userId = getUserId();
    if (!userId) return console.warn("⚠️ No userId in localStorage");
    try {
      const res = await axios.get(`${API_URL}/folders`, {
        headers: { "X-User-Id": userId },
      });
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error("❌ Failed to fetch folders:", err.response?.data || err);
      alert("Failed to fetch folders");
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchFolders();

    const socket = io(SOCKET_URL);

    socket.on("folder:created", (folder) => setFolders((prev) => [folder, ...prev]));
    socket.on("folder:deleted", ({ _id }) =>
      setFolders((prev) => prev.filter((f) => f._id !== _id))
    );
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

  // ---------------- Create Folder ----------------
  const handleCreateFolder = async () => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!newFolderName.trim() || !selectedProject)
      return alert("Folder name and project must be selected");

    const payload = {
      name: newFolderName.trim(),
      project_id: selectedProject,
    };

    try {
      const res = await axios.post(`${API_URL}/folders`, payload, {
        headers: { "X-User-Id": userId },
      });
      alert(`Folder "${res.data.name}" created successfully!`);
      setNewFolderName("");
      setSelectedProject("");
      setShowCreateFolderForm(false);
      setFolders((prev) => [res.data, ...prev]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to create folder";
      alert(`Error: ${errorMsg}`);
    }
  };

  // ---------------- Upload File ----------------
  const handleUpload = async (files, folderId) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!files || !files.length || !folderId) return alert("Select a folder first!");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append("file", files[i]);

    try {
      await axios.post(`${API_URL}/folders/${folderId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data", "X-User-Id": userId },
      });
      alert("Files uploaded successfully!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to upload files");
    }
  };

  const handleFileSelect = (folderId) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.onchange = (e) => handleUpload(e.target.files, folderId);
    fileInput.click();
  };

  const handleDeleteFile = async (fileId, filename) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!window.confirm(`Delete file "${filename}"?`)) return;

    try {
      await axios.delete(`${API_URL}/files/${fileId}`, {
        headers: { "X-User-Id": userId },
      });
      setFolders((prev) =>
        prev.map((f) => ({
          ...f,
          files: f.files.filter((f) => f._id !== fileId),
        }))
      );
      alert("File deleted successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete file");
    }
  };

  const handleDownload = async (fileId, filename) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    try {
      const res = await axios.get(`${API_URL}/files/${fileId}`, {
        headers: { "X-User-Id": userId },
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to download file");
    }
  };

  const handlePreview = async (fileId, filename) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    try {
      const res = await axios.get(`${API_URL}/files/${fileId}`, {
        headers: { "X-User-Id": userId },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: res.data.type || "application/octet-stream" });
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewFile({ url: blobUrl, name: filename });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to preview file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!activeFolder) return alert("Select a folder first!");
    handleUpload(e.dataTransfer.files, activeFolder);
  };
  const handleDragOver = (e) => e.preventDefault();

  // ---------------- Filter Folders & Files by Search ----------------
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = folders
    .find((f) => f._id === activeFolder)
    ?.files.filter((file) =>
      file.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allFilteredFiles = folders
    .flatMap(f =>
      f.files.map(file => ({ ...file, folderName: f.name, folderId: f._id }))
    )
    .filter(file => file.filename.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {/* Title */}
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaFolder className="text-yellow-500" />
          File Manager
        </h1>

        {/* Search + Add */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 md:w-64 p-2 pl-9 border rounded focus:ring focus:ring-blue-200"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={() => {
              if (activeFolder) {
                handleFileSelect(activeFolder); // upload files
              } else {
                setShowCreateFolderForm(true); // create folder
              }
            }}
            className="p-2 text-white rounded-full hover:bg-blue-700 flex items-center justify-center"
            style={{ backgroundColor: "#AA405B" }}
            title={activeFolder ? "Upload File" : "Create Folder"}
          >
            +
          </button>
        </div>
      </div>

      {/* Create Folder Form */}
      {showCreateFolderForm && !activeFolder && (
        <div className="mb-6 p-4 border rounded bg-gray-50 max-w-md">
          <input
            type="text"
            placeholder="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          />
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          >
            <option value="">Select Project</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create
          </button>
        </div>
      )}

      {/* Folder List */}
      <div className="flex flex-wrap gap-3 mb-6">
        {filteredFolders.map((folder) => (
          <div
            key={folder._id}
            className={`flex items-center gap-2 px-4 py-2 rounded border cursor-pointer transition ${
              activeFolder === folder._id
                ? "bg-blue-100 border-blue-600"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
            onClick={() => setActiveFolder(folder._id)}
          >
            <FaFolder className="text-blue-500" />
            <span>{folder.name}</span>
            <button
              onClick={async (e) => {
                e.stopPropagation(); // prevent folder activation on delete
                if (!window.confirm(`Delete folder "${folder.name}"?`)) return;
                const userId = getUserId();
                try {
                  await axios.delete(`${API_URL}/folders/${folder._id}`, {
                    headers: { "X-User-Id": userId },
                  });
                  setFolders((prev) => prev.filter((f) => f._id !== folder._id));
                  if (activeFolder === folder._id) setActiveFolder(null);
                } catch (err) {
                  alert(err.response?.data?.error || "Failed to delete folder");
                }
              }}
              className="ml-auto px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Files */}
      {/* Files */}
      {activeFolder ? (
        // Files in the selected folder
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles?.map((file) => (
            <div
              key={file._id}
              className="p-3 bg-white border rounded shadow flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                {getFileIcon(file.filename)}
                {file.storage === "gridfs" ? (
                  <FaCloud className="text-green-500" title="GridFS Storage" />
                ) : (
                  <FaHdd className="text-gray-500" title="Local Storage" />
                )}
              </div>
              <span className="text-gray-700 text-sm truncate">{file.filename}</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleDownload(file._id, file.filename)}
                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Download
                </button>
                <button
                  onClick={() => handlePreview(file._id, file.filename)}
                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleDeleteFile(file._id, file.filename)}
                  className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery ? (
        // Search files across all folders
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allFilteredFiles.length > 0 ? (
            allFilteredFiles.map((file) => (
              <div
                key={file._id}
                className="p-3 bg-white border rounded shadow flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  {getFileIcon(file.filename)}
                  {file.storage === "gridfs" ? (
                    <FaCloud className="text-green-500" title="GridFS Storage" />
                  ) : (
                    <FaHdd className="text-gray-500" title="Local Storage" />
                  )}
                </div>
                <span className="text-gray-700 text-sm truncate">{file.filename}</span>
                <span className="text-gray-400 text-xs">Folder: {file.folderName}</span>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleDownload(file._id, file.filename)}
                    className="flex-1 px-2 py-1 text-white rounded text-xs"
                    style={{ backgroundColor: "#607D8B" }}
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handlePreview(file._id, file.filename)}
                    className="flex-1 px-2 py-1 text-white rounded text-xs"
                    style={{ backgroundColor: "#A890B3" }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file._id, file.filename)}
                    className="flex-1 px-2 py-1 text-white rounded text-xs"
                    style={{ backgroundColor: "#A77D7D" }}
                  >
                    Delete
                  </button>
                    </div>
                  </div>
            ))
          ) : (
            <div className="text-gray-500">No files found</div>
          )}
        </div>
      ) : (
        <div className="text-gray-500">Select a folder to view files</div>
      )}

    </div>
  );

}

export default FileManager;
