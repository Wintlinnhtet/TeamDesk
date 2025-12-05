import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
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
  FaSearch,
} from "react-icons/fa";
import ViewLogs from "../components/ViewLogs";

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
    try {
      return JSON.parse(rawUser)._id || null;
    } catch {
      return null;
    }
  }
  return null;
}

function getUserRole() {
  const rawUser = localStorage.getItem("user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser).role || null;
  } catch {
    return null;
  }
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
  const [showLogs, setShowLogs] = useState(false);

  // ---------------- Fetch Projects & Folders ----------------
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const fetchInitialData = async () => {
      try {
        const [projRes, folderRes] = await Promise.all([
          axios.get(`${API_URL}/projects`, {
            headers: { "X-User-Id": userId },
          }),
          axios.get(`${API_URL}/folders`, { headers: { "X-User-Id": userId } }),
        ]);

        setProjects(projRes.data.projects?.filter((p) => p && p._id) || []);
        setFolders(folderRes.data.folders?.filter((f) => f && f._id) || []);
      } catch (err) {
        console.error("❌ Fetch error:", err.response?.data || err);
        alert("Failed to fetch data");
      }
    };
    fetchInitialData();

    // ---------------- Socket ----------------
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      extraHeaders: { "X-User-Id": userId },
    });

    socket.on("folder:created", (folder) => {
      if (!folder || !folder._id) return;
      setFolders((prev) => {
        const exists = prev.some((f) => f._id === folder._id);
        if (exists) return prev;
        return [folder, ...prev];
      });
    });

    socket.on("folder:deleted", ({ _id }) => {
      if (!_id) return;
      setFolders((prev) => prev.filter((f) => f._id !== _id));
      if (activeFolder === _id) setActiveFolder(null);
    });

    socket.on("file:uploaded", (fileDoc) => {
      if (!fileDoc || !fileDoc._id || !fileDoc.folder_id) return;
      const folderId = fileDoc.folder_id.toString();
      setFolders((prev) =>
        prev.map((f) => {
          if (f._id !== folderId) return f;
          const exists = (f.files || []).some((file) => file._id === fileDoc._id);
          if (exists) return f;
          return { ...f, files: [fileDoc, ...(f.files || [])] };
        })
      );
    });

    socket.on("file:deleted", ({ _id, folder_id }) => {
      if (!_id || !folder_id) return;
      setFolders((prev) =>
        prev.map((f) =>
          f._id === folder_id.toString()
            ? { ...f, files: (f.files || []).filter((file) => file._id !== _id) }
            : f
        )
      );
    });

    return () => socket.disconnect();
  }, [activeFolder]);

  // ---------------- Create Folder ----------------
  const handleCreateFolder = async () => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!newFolderName.trim() || !selectedProject)
      return alert("Folder name and project must be selected");

    try {
      const res = await axios.post(
        `${API_URL}/folders`,
        { name: newFolderName.trim(), project_id: selectedProject },
        { headers: { "X-User-Id": userId } }
      );

      const createdFolder = res.data;
      if (!createdFolder || !createdFolder._id) return;

      setFolders((prev) => {
        const exists = prev.some((f) => f._id === createdFolder._id);
        if (exists) return prev;
        return [createdFolder, ...prev];
      });

      setNewFolderName("");
      setSelectedProject("");
      setShowCreateFolderForm(false);
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
    Array.from(files).forEach((file) => formData.append("file", file));

    try {
      const res = await axios.post(
        `${API_URL}/folders/${folderId}/files`,
        formData,
        { headers: { "Content-Type": "multipart/form-data", "X-User-Id": userId } }
      );

      const newFiles = res.data.uploaded;
      setFolders((prev) =>
        prev.map((f) =>
          f._id === folderId ? { ...f, files: [...(f.files || []), ...newFiles] } : f
        )
      );
    } catch (err) {
      alert(err.response?.data?.error || "Failed to upload files");
    }
  };

  const handleFileSelect = (folderId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => handleUpload(e.target.files, folderId);
    input.click();
  };

  // ---------------- File Actions ----------------
  const handleDeleteFile = async (fileId, filename) => {
    const userId = getUserId();
    if (!userId) return alert("Not logged in!");
    if (!window.confirm(`Delete file "${filename}"?`)) return;
    try {
      await axios.delete(`${API_URL}/files/${fileId}`, {
        headers: { "X-User-Id": userId },
      });
    } catch (err) {
      console.error(err);
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
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
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
                  <td key={j} className="border px-2 py-1">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const handleOpenLogs = () => setShowLogs(true);

  // ---------------- Filter ----------------
  const filteredFolders = folders.filter(f => f?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = folders.find(f => f._id === activeFolder)?.files.filter(file => file.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredFiles = folders.flatMap(f => f.files.map(file => ({ ...file, folderName: f.name, folderId: f._id }))).filter(file => file.filename.toLowerCase().includes(searchQuery.toLowerCase()));

  // ---------------- Render ----------------
  return showLogs ? (
    <ViewLogs onBack={() => setShowLogs(false)} />
  ) : (
    <div className="min-h-screen bg-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaFolder className="text-yellow-500" /> File Manager
        </h1>
        <button onClick={handleOpenLogs} className="px-4 py-2 border-2 bg-[#AA405B] text-white rounded hover:bg-white hover:border-[#AA405B] hover:text-[#AA405B]">
          View Logs
        </button>

        {/* Search + Add */}
        <div className="flex items-center gap-3">
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
          <button
            onClick={() => setShowCreateFolderForm(true)}
            className="px-2 py-[8px] border-2 rounded-2xl bg-[#AA405B] text-2xl text-white hover:bg-white hover:text-[#AA405B] hover:border-2  hover:border-[#AA405B] flex items-center justify-center"
            title="Create Folder"
          >
            +
          </button>
        </div>
      </div>

      {/* Create Folder Form */}
      {showCreateFolderForm && (
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
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button onClick={handleCreateFolder} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Create
          </button>
        </div>
      )}

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
                  e.stopPropagation();
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
                      setOpenMenuFolder(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Upload File
                  </button>

                  {getUserRole() === "admin" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm(`Delete folder "${folder.name}"?`)) return;
                        const userId = getUserId();
                        try {
                          await axios.delete(`${API_URL}/folders/${folder._id}`, { headers: { "X-User-Id": userId } });
                          setFolders((prev) => prev.filter((f) => f._id !== folder._id));
                          if (activeFolder === folder._id) setActiveFolder(null);
                        } catch (err) {
                          console.error(err);
                        }
                        setOpenMenuFolder(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Delete Folder
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Files */}
      {(activeFolder || searchQuery) && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(activeFolder ? filteredFiles : allFilteredFiles)?.map((file) => (
            <div key={file._id} className="p-3 bg-white border rounded shadow flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {getFileIcon(file.filename)}
                {file.storage === "gridfs" ? <FaCloud className="text-green-500" title="GridFS Storage" /> : <FaHdd className="text-gray-500" title="Local Storage" />}
              </div>
              <span className="text-gray-700 text-sm truncate">{file.filename}</span>
              {searchQuery && <span className="text-gray-400 text-xs">Folder: {file.folderName}</span>}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleDownload(file._id, file.filename)} className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                  Download
                </button>
                <button onClick={() => handlePreview(file._id, file.filename)} className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">
                  Preview
                </button>
                {(getUserRole() === "admin" || file.uploaded_by === getUserId()) && (
                  <button onClick={() => handleDeleteFile(file._id, file.filename)} className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {(!activeFolder && searchQuery && allFilteredFiles.length === 0) && <div className="text-gray-500">No files found</div>}
          {(!activeFolder && !searchQuery) && <div className="text-gray-500">Select a folder to view files</div>}
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg max-w-4xl max-h-[90vh] overflow-auto relative">
            <button onClick={() => setPreviewFile(null)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded">✕</button>
            <h2 className="text-lg font-semibold mb-2">{previewFile.name}</h2>

            {(() => {
              const { url, name, type } = previewFile;

              if (type.startsWith("image/")) return <img src={url} alt={name} className="max-h-[75vh] object-contain mx-auto" />;
              if (type === "application/pdf") return <iframe src={url} className="w-[80vw] h-[75vh]" title="PDF Preview" />;
              if (type.startsWith("text/") || ["application/javascript", "application/json"].includes(type) || name.match(/\.(py|css|html)$/i))
                return <iframe src={url} className="w-[80vw] h-[75vh]" title="Text/Code Preview" />;
              if (name.match(/\.(csv|xls|xlsx)$/i)) return <ExcelPreview file={previewFile} />;
              if (name.match(/\.(doc|docx)$/i)) return (
                <p className="text-gray-600">
                  Word documents can’t be previewed. <a href={url} download={name} className="text-blue-600 underline">Download instead</a>
                </p>
              );
              if (type.startsWith("audio/")) return <audio controls className="w-full"><source src={url} type={type} />Your browser does not support audio playback.</audio>;
              if (type.startsWith("video/")) return <video controls className="max-h-[75vh] w-auto mx-auto"><source src={url} type={type} />Your browser does not support video playback.</video>;
              return <p className="text-gray-600">Preview not supported. <a href={url} download={name} className="text-blue-600 underline">Download instead</a></p>;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileManager;
