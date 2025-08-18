import React, { useState, useRef } from "react";
import {
  FaFolder,
  FaFilePdf,
  FaFileExcel,
  FaFileWord,
  FaFileImage,
  FaUpload,
  FaSearch,
  FaEye,
  FaDownload,
  FaTrash,
} from "react-icons/fa";
import FileCard from "../components/FileCard";

// File type icons
const fileIcons = {
  folder: <FaFolder size={32} color="#AA405B" />,
  pdf: <FaFilePdf size={32} color="#E02424" />,
  excel: <FaFileExcel size={32} color="#207245" />,
  word: <FaFileWord size={32} color="#2A5699" />,
  image: <FaFileImage size={32} color="#AA405B" />,
};

const getIcon = (type) => fileIcons[type] || <FaFolder size={32} color="#AA405B" />;

// Dummy folders & files
const dummyFolders = [
  {
    id: 1,
    name: "Images",
    description: "Folder containing team images",
    people: [
      { id: 1, name: "You", access: "Manage" },
      { id: 2, name: "Alice Johnson", access: "Read & Write" },
    ],
    files: [
      {
        id: 101,
        name: "TeamPhoto1.jpg",
        type: "image",
        description: "Team group photo",
        uploadedBy: { id: 2, name: "Alice Johnson" },
        datetime: "2025-08-01T14:30",
        people: [
          { id: 1, name: "You", access: "Manage" },
          { id: 2, name: "Alice Johnson", access: "Read & Write" },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Documents",
    description: "Project-related documents",
    people: [
      { id: 4, name: "Carol Lee", access: "Read & Write" },
      { id: 5, name: "Bob Smith", access: "Read" },
    ],
    files: [
      {
        id: 201,
        name: "ProjectPlan.pdf",
        type: "pdf",
        description: "Initial project planning document",
        uploadedBy: { id: 4, name: "Carol Lee" },
        datetime: "2025-07-30T11:00",
        people: [
          { id: 4, name: "Carol Lee", access: "Read & Write" },
          { id: 5, name: "Bob Smith", access: "Read" },
        ],
      },
      {
        id: 202,
        name: "BudgetReport.xlsx",
        type: "excel",
        description: "Quarterly budget report",
        uploadedBy: { id: 3, name: "Bob Smith" },
        datetime: "2025-08-05T09:15",
        people: [
          { id: 3, name: "Bob Smith", access: "Read & Write" },
          { id: 4, name: "Carol Lee", access: "Read" },
        ],
      },
    ],
  },
];

const currentUser = { id: 99, name: "Yin Mon Win" };

const FileManager = () => {
  const customColor = "#AA405B";
  const [folders, setFolders] = useState(dummyFolders);
  const [filterType, setFilterType] = useState("all");
  const [expandedFolderId, setExpandedFolderId] = useState(null);
  const fileInputRef = useRef(null);

  // Toggle folder expansion
  const toggleFolder = (id) => {
    setExpandedFolderId(expandedFolderId === id ? null : id);
  };

  // Delete file
  const handleDelete = (folderId, fileId) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? { ...folder, files: folder.files.filter((file) => file.id !== fileId) }
            : folder
        )
      );
    }
  };

  // Upload file
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length || !expandedFolderId) return;

    const nowISO = new Date().toISOString();
    const newFiles = selectedFiles.map((file, index) => {
      const ext = file.name.split(".").pop().toLowerCase();
      let type = ["jpg", "jpeg", "png", "gif"].includes(ext)
        ? "image"
        : ext === "pdf"
        ? "pdf"
        : ext.includes("xls")
        ? "excel"
        : ext.includes("doc")
        ? "word"
        : "pdf";
      return {
        id: Date.now() + index,
        name: file.name,
        type,
        description: file.name,
        uploadedBy: currentUser,
        datetime: nowISO,
        people: [{ id: 99, name: "You", access: "Manage" }],
      };
    });

    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === expandedFolderId ? { ...folder, files: [...newFiles, ...folder.files] } : folder
      )
    );
    e.target.value = "";
  };

  const formatDateTime = (dtString) => {
    const dt = new Date(dtString);
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const fileTypes = [
    { label: "All Types", value: "all" },
    { label: "PDF", value: "pdf" },
    { label: "Excel", value: "excel" },
    { label: "Word", value: "word" },
    { label: "Images", value: "image" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6" style={{ color: customColor }}>
        Team's File-Sharing
      </h1>

      {/* Upload & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <button
          onClick={handleUploadClick}
          className="flex items-center cursor-pointer text-white px-4 py-2 rounded shadow"
          style={{ backgroundColor: customColor }}
        >
          <FaUpload className="mr-2" /> Upload File
        </button>

        <input type="file" multiple onChange={handleFileChange} ref={fileInputRef} className="hidden" />

        <div className="flex items-center space-x-2">
          <FaSearch color={customColor} />
          <select
            className="border border-gray-300 rounded px-3 py-1"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {fileTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Folders */}
      {folders.map((folder) => {
        const displayedFiles =
          filterType === "all" ? folder.files : folder.files.filter((f) => f.type === filterType);

        return (
          <div key={folder.id} className="mb-6">
            {/* Folder Header */}
            <div
              className="flex items-center justify-between bg-white p-4 rounded-2xl shadow cursor-pointer hover:shadow-lg transition"
              onClick={() => toggleFolder(folder.id)}
            >
              <div className="flex items-center gap-4">
                {getIcon("folder")}
                <div>
                  <h2 className="font-semibold text-lg">{folder.name}</h2>
                  <p className="text-sm text-gray-500">{folder.description}</p>
                </div>
              </div>
            </div>

            {/* Files inside expanded folder */}
            {expandedFolderId === folder.id && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-4 ml-6">
                {displayedFiles.length === 0 ? (
                  <p className="text-gray-600 italic">No files in this folder.</p>
                ) : (
                  displayedFiles.map((file) => <FileCard key={file.id} file={file} />)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FileManager;
