<<<<<<< HEAD
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import {
  FaFolder, FaFileAlt, FaFileExcel, FaFileCsv, FaFileCode, FaFileImage, FaFilePdf, FaCloud, FaHdd, FaSearch
} from "react-icons/fa";
import * as XLSX from "xlsx";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000/rt";

// File icons mapping
const fileIcons = { py: FaFileCode, js: FaFileCode, java: FaFileCode, html: FaFileCode, css: FaFileCode,
  jpg: FaFileImage, jpeg: FaFileImage, png: FaFileImage, gif: FaFileImage, bmp: FaFileImage,
  xls: FaFileExcel, xlsx: FaFileExcel, csv: FaFileCsv, pdf: FaFilePdf
};
const fileColors = { py: "text-yellow-500", js: "text-yellow-400", java: "text-red-500", html: "text-orange-500", css: "text-blue-500",
  jpg: "text-green-500", jpeg: "text-green-500", png: "text-green-500", gif: "text-green-400", bmp: "text-green-300",
  xls: "text-green-600", xlsx: "text-green-600", csv: "text-teal-600", pdf: "text-red-600"
};

function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const Icon = fileIcons[ext] || FaFileAlt;
  const colorClass = fileColors[ext] || "text-gray-500";
  return <Icon className={`text-2xl ${colorClass}`} />;
}

function getUserId() {
  const rawUserId = localStorage.getItem("userId");
  if (rawUserId) return rawUserId;
  const rawUser = localStorage.getItem("user");
  if (rawUser) {
    try { return JSON.parse(rawUser)._id || null; } catch { return null; }
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
  const [showMenu, setShowMenu] = useState(false);
  const [openMenuFolder, setOpenMenuFolder] = useState(null);
  // ---------------- Fetch Projects & Folders ----------------
  useEffect(() => {
    const fetchInitialData = async () => {
      const userId = getUserId();
      if (!userId) return;
      try {
        const [projRes, folderRes] = await Promise.all([
          axios.get(`${API_URL}/projects`, { headers: { "X-User-Id": userId } }),
          axios.get(`${API_URL}/folders`, { headers: { "X-User-Id": userId } }),
        ]);
        setProjects(projRes.data.projects || []);
        setFolders(folderRes.data.folders || []);
      } catch (err) {
        console.error("❌ Fetch error:", err.response?.data || err);
        alert("Failed to fetch data");
      }
    };
    fetchInitialData();

    const socket = io(SOCKET_URL);

    socket.on("folder:created", (folder) => setFolders(prev => [folder, ...prev]));
    socket.on("folder:deleted", ({ _id }) =>
      setFolders(prev => prev.filter(f => f._id !== _id))
    );
    socket.on("file:uploaded", (fileDoc) => {
      const folderId = fileDoc.folder_id.toString();
      setFolders(prev =>
        prev.map(f => f._id === folderId ? { ...f, files: [fileDoc, ...(f.files || [])] } : f)
      );
    });
    socket.on("file:deleted", ({ _id, folder_id }) => {
      setFolders(prev =>
        prev.map(f => f._id === folder_id.toString() ? { ...f, files: f.files.filter(file => file._id !== _id) } : f)
      );
    });

    return () => socket.disconnect();
  }, []);

  // ---------------- Create Folder ----------------
  const handleCreateFolder = async () => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!newFolderName.trim() || !selectedProject) return alert("Folder name and project must be selected");

    try {
      await axios.post(`${API_URL}/folders`, { name: newFolderName.trim(), project_id: selectedProject }, {
        headers: { "X-User-Id": userId },
      });
      setNewFolderName("");
      setSelectedProject("");
      setShowCreateFolderForm(false);
      // no need to manually update folders; socket will handle it
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create folder");
    }
  };

  // ---------------- Upload File ----------------
  const handleUpload = async (files, folderId) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!files?.length || !folderId) return alert("Select a folder first!");

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append("file", file));

    try {
      await axios.post(`${API_URL}/folders/${folderId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data", "X-User-Id": userId },
      });
      // state updated via socket
    } catch (err) {
      // alert(err.response?.data?.error || "Failed to upload files");
      alert(err)
    }
  };

  const handleFileSelect = folderId => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    input.onchange = e => handleUpload(e.target.files, folderId);
    input.click();
  };

  // ---------------- File Actions ----------------
  const handleDeleteFile = async (fileId, filename) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!window.confirm(`Delete file "${filename}"?`)) return;
    try {
      await axios.delete(`${API_URL}/files/${fileId}`, { headers: { "X-User-Id": userId } });
      // state updated via socket
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
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
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

      const mimeType = res.data.type || "application/octet-stream";
      const blob = new Blob([res.data], { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);

      setPreviewFile({ url: blobUrl, name: filename, type: mimeType });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to preview file");
    }
  };

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
            onClick={() => setShowCreateFolderForm(true)}
            className="p-2 text-white rounded-full hover:bg-blue-700 flex items-center justify-center"
            style={{ backgroundColor: "#AA405B" }}
            title="Create Folder"
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

      // Add to state

      {/* Folder List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {filteredFolders.map((folder) => (
          <div
            key={folder._id}
            className={`relative flex items-center gap-2 px-4 py-2 rounded border cursor-pointer transition ${
              activeFolder === folder._id
                ? "bg-blue-100 border-blue-600"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
            onClick={() => setActiveFolder(folder._id)}
          >
            <FaFolder className="text-blue-500" />
            <span>{folder.name}</span>

            {/* Kebab button */}
            <div className="ml-auto relative">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent folder selection
                  setOpenMenuFolder(openMenuFolder === folder._id ? null : folder._id);
                }}
                className="inline-flex justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 items-center text-gray-700"
              >
                ⋮
              </button>

              {/* Dropdown menu */}
              {openMenuFolder === folder._id && (
                <div className="absolute right-0 mt-2 w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileSelect(folder._id);
                      setOpenMenuFolder(null); // close menu after click
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Upload File
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
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
                      setOpenMenuFolder(null); // close menu after delete
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Delete Folder
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg max-w-4xl max-h-[90vh] overflow-auto relative">
            {/* Close button */}
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-2">{previewFile.name}</h2>

      {/* Universal preview */}
      {previewFile.type.startsWith("image/") ? (
        <img
          src={previewFile.url}
          alt={previewFile.name}
          className="max-h-[75vh] object-contain mx-auto"
        />
              ) : previewFile.type === "application/pdf" ? (
                <iframe
                  src={previewFile.url}
                  className="w-[80vw] h-[75vh]"
                  title="PDF Preview"
                />
              ) : previewFile.type.startsWith("text/") ||
                ["application/javascript", "application/json"].includes(previewFile.type) ||
                previewFile.name.match(/\.(py|css|html)$/i) ? (
                <iframe
                  src={previewFile.url}
                  className="w-[80vw] h-[75vh]"
                  title="Text/Code Preview"
                />
              ) : previewFile.name.match(/\.(csv|xls|xlsx)$/i) ? (
                <ExcelPreview file={previewFile} />
              ) : previewFile.name.match(/\.(doc|docx)$/i) ? (
                <p className="text-gray-600">
                  Word documents can’t be previewed.{" "}
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="text-blue-600 underline"
                  >
                    Download instead
                  </a>
                </p>
              ) : previewFile.type.startsWith("audio/") ? (
                <audio controls className="w-full">
                  <source src={previewFile.url} type={previewFile.type} />
                  Your browser does not support audio playback.
                </audio>
              ) : previewFile.type.startsWith("video/") ? (
                <video controls className="max-h-[75vh] w-auto mx-auto">
                  <source src={previewFile.url} type={previewFile.type} />
                  Your browser does not support video playback.
                </video>
              ) : (
                <p className="text-gray-600">
                  Preview not supported.{" "}
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="text-blue-600 underline"
                  >
                    Download instead
                  </a>
                </p>
              )}

        </div>
      </div>
    )}

    </div>
  );

}

// ---------------- Excel/CSV Preview Component ----------------
function ExcelPreview({ file }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch(file.url)
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        setRows(sheet);
      });
  }, [file]);

  return (
    <div className="overflow-auto max-h-[70vh] border rounded">
      <table className="border-collapse border border-gray-300 w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FileManager;
=======
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import {
  FaFolder,
  FaFileAlt,
  FaFileExcel,
  FaFileCsv,
  FaFileCode,
  FaFileImage,
  FaFilePdf,
  FaCloud,
  FaHdd,
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

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <h1 className="text-2xl font-bold mb-6">📂 File Manager</h1>

      <input
        type="text"
        placeholder="Search folders/files..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />

      {/* Create Folder */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowCreateFolderForm(!showCreateFolderForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Folder
        </button>
      </div>

      {showCreateFolderForm && (
        <div className="mb-6 p-4 border rounded bg-gray-100 w-full max-w-md">
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
      <div className="flex flex-wrap gap-4 mb-6">
        {filteredFolders.map((folder) => (
          <div
            key={folder._id}
            className={`cursor-pointer px-4 py-2 rounded border flex items-center gap-2 ${
              activeFolder === folder._id
                ? "bg-blue-100 border-blue-600"
                : "bg-gray-100 border-gray-300"
            }`}
          >
            <FaFolder className="text-blue-500" />
            <span onClick={() => setActiveFolder(folder._id)}>{folder.name}</span>
            <button
              onClick={async () => {
                if (!window.confirm(`Delete folder "${folder.name}"?`)) return;
                const userId = getUserId();
                try {
                  await axios.delete(`${API_URL}/folders/${folder._id}`, {
                    headers: { "X-User-Id": userId },
                  });
                  setFolders((prev) => prev.filter((f) => f._id !== folder._id));
                  if (activeFolder === folder._id) setActiveFolder(null);
                  alert("Folder deleted successfully");
                } catch (err) {
                  alert(err.response?.data?.error || "Failed to delete folder");
                }
              }}
              className="ml-auto px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Files */}
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
            {filteredFiles?.map((file) => (
              <div
                key={file._id}
                className="p-3 bg-white border rounded shadow flex flex-col gap-2"
              >
                <div className="flex items-center gap-1 mb-1">
                  {getFileIcon(file.filename)}
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
                    onClick={() => handleDeleteFile(file._id, file.filename)}
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

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded w-3/4 h-3/4 overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold">{previewFile.name}</h2>
              <button
                className="px-2 py-1 bg-red-600 text-white rounded"
                onClick={() => setPreviewFile(null)}
              >
                Close
              </button>
            </div>
            <iframe src={previewFile.url} className="w-full h-full"></iframe>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileManager;
>>>>>>> 8c1a5a82c3f104ea33be42347d12d9b96172c5ce
