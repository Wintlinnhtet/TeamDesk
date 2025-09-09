import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaFolder, FaFileAlt, FaCloud, FaHdd } from "react-icons/fa";

const API_URL = "http://localhost:5000/api";

function FileManager() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const dropRef = useRef();

  // Fetch folders and files
  const fetchFolders = async () => {
    try {
      const res = await axios.get(`${API_URL}/folders`);
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  // Upload file
  const handleUpload = async (file) => {
    if (!file || !selectedFolder) return alert("Select a folder first!");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_URL}/folders/${selectedFolder}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchFolders();
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle drag-and-drop
  const handleDrop = (e) => {
    e.preventDefault();
    if (!selectedFolder) return alert("Select a folder first!");
    const file = e.dataTransfer.files[0];
    handleUpload(file);
  };

  const handleDragOver = (e) => e.preventDefault();

  // Delete file
  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API_URL}/files/${fileId}`);
      fetchFolders();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId) => {
    try {
      await axios.delete(`${API_URL}/folders/${folderId}`);
      fetchFolders();
    } catch (err) {
      console.error(err);
    }
  };

  // Download file
  const handleDownload = async (fileId, filename) => {
    try {
      const res = await axios.get(`${API_URL}/files/${fileId}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <h1 className="text-2xl font-bold text-[#AA405B] mb-6">📂 File Manager</h1>

      {/* Upload Section */}
      <div
        className="flex flex-wrap gap-3 items-center mb-10 border-2 border-dashed p-4 rounded"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        ref={dropRef}
      >
        <select
          className="px-3 py-2 border rounded"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
        >
          <option value="">Select Folder</option>
          {folders.map((folder) => (
            <option key={folder._id} value={folder._id}>
              {folder.name}
            </option>
          ))}
        </select>

        <input
          type="file"
          onChange={(e) => {
            setSelectedFile(e.target.files[0]);
            handleUpload(e.target.files[0]);
          }}
          className="px-3 py-2 border rounded"
        />
        <span className="text-gray-500 text-sm ml-4">Or drag & drop file here</span>
      </div>

      {/* Folder & Files Display */}
      {folders.length === 0 ? (
        <p className="text-gray-500">No folders found.</p>
      ) : (
        folders.map((folder) => (
          <div key={folder._id} className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FaFolder className="text-[#AA405B]" /> {folder.name}
              </h2>
              <button
                onClick={() => handleDeleteFolder(folder._id)}
                className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete Folder
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folder.files.length === 0 ? (
                <p className="text-gray-500 text-sm">No files</p>
              ) : (
                folder.files.map((file) => (
                  <div
                    key={file._id}
                    className="p-4 bg-white border rounded-xl shadow flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1 mb-2">
                      <FaFileAlt className="text-[#AA405B] text-3xl" />
                      {file.storage === "gridfs" ? (
                        <FaCloud title="GridFS Storage" className="text-blue-500" />
                      ) : (
                        <FaHdd title="Local Storage" className="text-gray-500" />
                      )}
                    </div>
                    <span className="text-gray-700 text-sm truncate mb-2">{file.filename}</span>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleDownload(file._id, file.filename)}
                        className="px-2 py-1 text-xs rounded-lg bg-[#AA405B] text-white hover:bg-[#922f4a]"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file._id)}
                        className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default FileManager;
