import React, { useState, useRef } from "react";
import {
    FaFolder,
    FaFilePdf,
    FaFileExcel,
    FaFileWord,
    FaUpload,
    FaSearch,
    FaEye,
    FaDownload,
    FaTrash,
    FaFileImage,
    } from "react-icons/fa";

    const fileIcons = {
    folder: <FaFolder size={32} color="#AA405B" />,
    pdf: <FaFilePdf size={32} color="#E02424" />,
    excel: <FaFileExcel size={32} color="#207245" />,
    word: <FaFileWord size={32} color="#2A5699" />,
    image: <FaFileImage size={32} color="#AA405B" />,
    };

    const getIcon = (type) => fileIcons[type] || <FaFolder size={32} color="#AA405B" />;

    const dummyFolders = [
    {
        id: 1,
        name: "Images",
        files: [
        {
            id: 101,
            name: "TeamPhoto1.jpg",
            type: "image",
            description: "Team group photo",
            uploadedBy: { id: 2, name: "Alice Johnson" },
            datetime: "2025-08-01T14:30",
        },
        // You can add more image files here if you want
        ],
    },
    {
        id: 2,
        name: "Documents",
        files: [
        {
            id: 201,
            name: "ProjectPlan.pdf",
            type: "pdf",
            description: "Initial project planning document",
            uploadedBy: { id: 4, name: "Carol Lee" },
            datetime: "2025-07-30T11:00",
        },
        {
            id: 202,
            name: "BudgetReport.xlsx",
            type: "excel",
            description: "Quarterly budget report",
            uploadedBy: { id: 3, name: "Bob Smith" },
            datetime: "2025-08-05T09:15",
        },
        {
            id: 203,
            name: "MeetingNotes.docx",
            type: "word",
            description: "Notes from last meeting",
            uploadedBy: { id: 5, name: "Dana White" },
            datetime: "2025-08-03T16:00",
        },
        {
            id: 204,
            name: "Summary.pdf",
            type: "pdf",
            description: "Executive summary",
            uploadedBy: { id: 6, name: "Eva Green" },
            datetime: "2025-08-07T10:30",
        },
        {
            id: 205,
            name: "SalesData.xls",
            type: "excel",
            description: "Sales data for Q2",
            uploadedBy: { id: 7, name: "Frank Black" },
            datetime: "2025-08-08T13:45",
        },
        {
            id: 206,
            name: "Contract.doc",
            type: "word",
            description: "Signed contract document",
            uploadedBy: { id: 8, name: "Grace Hopper" },
            datetime: "2025-08-09T11:00",
        },
        ],
    },
    ];

    const currentUser = { id: 99, name: "Yin Mon Win" };

    const FileManager = () => {
    const customColor = "#AA405B";

    const [folders, setFolders] = useState(dummyFolders);
    const [filterType, setFilterType] = useState("all");
    const [selectedFolderId, setSelectedFolderId] = useState(folders[0]?.id || null);
    const fileInputRef = useRef(null);

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

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        if (!selectedFolderId) return alert("Please select a folder to upload to.");

        const nowISO = new Date().toISOString();

        const newFiles = selectedFiles.map((file, index) => {
        const ext = file.name.split(".").pop().toLowerCase();
        let type = "pdf";

        if (["jpg", "jpeg", "png", "gif"].includes(ext)) type = "image";
        else if (ext === "pdf") type = "pdf";
        else if (ext === "xlsx" || ext === "xls") type = "excel";
        else if (ext === "doc" || ext === "docx") type = "word";

        return {
            id: Date.now() + index,
            name: file.name,
            type,
            description: file.name,
            uploadedBy: currentUser,
            datetime: nowISO,
        };
        });

        setFolders((prev) =>
        prev.map((folder) =>
            folder.id === selectedFolderId
            ? { ...folder, files: [...newFiles, ...folder.files] }
            : folder
        )
        );

        e.target.value = "";
    };

    const formatDateTime = (dtString) => {
        const dt = new Date(dtString);
        const date = dt.toLocaleDateString();
        const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `${date} ${time}`;
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
            <FaUpload className="mr-2" />
            Upload File
            </button>
            <button 
            className="flex items-center cursor-pointer  bg-white border-1  px-4 py-2 rounded shadow  hover:bg-[var(--hover-bg)] hover:text-amber-50! transition duration-300"
            style={{color:customColor, '--hover-bg':customColor}}>File access
            </button>
            <input
            type="file"
            multiple
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
            />

            {/* Folder selection for upload */}
            <div className="flex items-center space-x-2">
            <label
                className="font-medium"
                htmlFor="folderSelect"
                style={{ color: customColor }}
            >
                Upload to:
            </label>
            <select
                id="folderSelect"
                className="border border-gray-300 rounded px-3 py-1"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(Number(e.target.value))}
            >
                {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                    {folder.name}
                </option>
                ))}
            </select>
            </div>

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

        {/* Folder List */}
        {folders.map((folder) => {
            const displayedFiles =
            filterType === "all"
                ? folder.files
                : folder.files.filter((file) => file.type === filterType);

            return (
            <section key={folder.id} className="mb-10">
                <h2
                className="text-xl font-semibold mb-4 flex items-center"
                style={{ color: customColor }}
                >
                <FaFolder className="mr-2" />
                {folder.name} ({displayedFiles.length})
                </h2>

                {displayedFiles.length === 0 ? (
                <p className="text-gray-600 italic ml-6">No files in this folder.</p>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 ml-6">
                    {displayedFiles.map((file) => (
                    <div
                        key={file.id}
                        className="bg-white rounded-lg shadow p-4 flex flex-col cursor-pointer hover:shadow-lg transition"
                        title={file.description}
                    >
                        <div className="flex items-center gap-4 mb-4">
                        {getIcon(file.type)}

                        <div className="flex flex-col flex-1 overflow-hidden">
                            <p className="font-semibold truncate">{file.name}</p>
                            <p className="text-xs text-gray-400 truncate">
                            Uploaded by{" "}
                            <span className="font-medium text-gray-700">
                                {file.uploadedBy.name}
                            </span>
                            </p>
                            <p className="text-xs text-gray-400">
                            {formatDateTime(file.datetime)}
                            </p>
                        </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-auto flex justify-end space-x-3 pt-3 border-t border-gray-200">
                        <button
                            onClick={() => alert("Preview feature not implemented")}
                            className="text-gray-500"
                            title="Preview"
                            onMouseEnter={(e) => (e.currentTarget.style.color = customColor)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                        >
                            <FaEye size={18} />
                        </button>

                        <button
                            onClick={() => alert("Download feature not implemented")}
                            className="text-gray-500"
                            title="Download"
                            onMouseEnter={(e) => (e.currentTarget.style.color = customColor)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                        >
                            <FaDownload size={18} />
                        </button>

                        <button
                            onClick={() => handleDelete(folder.id, file.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                        >
                            <FaTrash size={18} />
                        </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </section>
            );
        })}
        </div>
    );
};

export default FileManager;
