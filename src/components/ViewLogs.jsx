import React, { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// Helper to get userId from localStorage
const getUserId = () => {
  const rawUser = localStorage.getItem("user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser)._id;
  } catch {
    return null;
  }
};

function ViewLogs({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState({
    username: "",
    foldername: "",
    filename: "",
    date: "",
  });

  const perPage = 20;
  const userId = getUserId();

  const fetchLogs = async (pageNum = 1) => {
    if (!userId) return;

    try {
      const res = await axios.get(`${API_URL}/logs`, {
        headers: { "X-User-Id": userId },
        params: {
          page: pageNum,
          username: search.username || undefined,
          foldername: search.foldername || undefined,
          filename: search.filename || undefined,
          date: search.date || undefined,
          perPage,
        },
      });

      const mappedLogs = (res.data.logs || []).map(log => ({
        ...log,
        folder_name: log.folder_name || log.foldername || "-",
        file_name: log.file_name || log.filename || "-",
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      }));

      setLogs(mappedLogs);
      setTotal(res.data.total || mappedLogs.length);
      setTotalPages(res.data.totalPages || Math.ceil(res.data.total / perPage) || 1);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      alert("Failed to fetch logs");
    }
  };

  useEffect(() => {
    if (!userId) return;

    fetchLogs(page);

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      extraHeaders: { "X-User-Id": userId },
    });

    socket.on("connect", () => console.log("Socket connected for logs!"));

    socket.on("log:created", log => {
      log.timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
      log.folder_name = log.folder_name || log.foldername || "-";
      log.file_name = log.file_name || log.filename || "-";
      setLogs(prev => [log, ...prev]);
      setTotal(prev => prev + 1);
    });

    return () => socket.disconnect();
  }, [page, search]);

  return (
    <div className="min-h-screen px-6 py-8">
      <button
        onClick={onBack}
        className="mb-4 px-4 py-2 bg-[#AA405B] text-white rounded hover:bg-white hover:border-2 hover:border-[#AA405B] hover:text-[#AA405B]"
      >
        Back
      </button>

      <h1 className="text-2xl font-bold mb-4 text-[#AA405B]">User Action Logs</h1>

      {/* Search filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          name="username"
          placeholder="Username"
          value={search.username}
          onChange={e => setSearch(prev => ({ ...prev, username: e.target.value }))}
          className="p-2 border rounded"
        />
        <input
          name="foldername"
          placeholder="Folder Name"
          value={search.foldername}
          onChange={e => setSearch(prev => ({ ...prev, foldername: e.target.value }))}
          className="p-2 border rounded"
        />
        <input
          name="filename"
          placeholder="File Name"
          value={search.filename}
          onChange={e => setSearch(prev => ({ ...prev, filename: e.target.value }))}
          className="p-2 border rounded"
        />
        <input
          name="date"
          type="date"
          value={search.date}
          onChange={e => setSearch(prev => ({ ...prev, date: e.target.value }))}
          className="p-2 border rounded"
        />
        <button
          onClick={() => fetchLogs(1)}
          className="px-4 py-2 border-2 bg-[#AA405B] text-white rounded hover:bg-white hover:text-[#AA405B] hover:border-2 hover:border-[#AA405B]"
        >
          Search
        </button>
      </div>

      {/* Logs table */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Time</th>
              <th className="border px-2 py-1">Username</th>
              <th className="border px-2 py-1">Action</th>
              <th className="border px-2 py-1">Folder</th>
              <th className="border px-2 py-1">File</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  No logs found
                </td>
              </tr>
            )}
            {logs.map(log => (
              <tr key={log._id}>
                <td className="border px-2 py-1">{log.timestamp.toLocaleString()}</td>
                <td className="border px-2 py-1">{log.username}</td>
                <td className="border px-2 py-1">{log.action}</td>
                <td className="border px-2 py-1">{log.folder_name}</td>
                <td className="border px-2 py-1">{log.file_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-2 mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(p => { const np = p - 1; fetchLogs(np); return np; })}
          className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
        >
          Prev
        </button>
        <span className="px-2 py-1">Page {page} / {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(p => { const np = p + 1; fetchLogs(np); return np; })}
          className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default ViewLogs;
