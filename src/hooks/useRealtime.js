// src/hooks/useRealtime.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../config";
function readUserIdFromStorage() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?._id || u?.id || null;
  } catch {
    return null;
  }
}
/**
 * Connects to Socket.IO once and optionally joins a project room.
 * Returns a ref to the socket so callers can emit extra joins/leaves.
 */
export default function useRealtime(projectId, handlers = {}) {
  const sockRef = useRef(null);

  useEffect(() => {
     const socket = io(`${API_BASE}/rt`, {
      transports: ["websocket"],   // avoids noisy preflights
      withCredentials: true,
      path: "/socket.io",
    });
    sockRef.current = socket;

    socket.on("connect", () => {
      if (projectId) socket.emit("join", { projectId });
      // Join per-user room (auto) for notifications
      const uid = readUserIdFromStorage();
      if (uid) socket.emit("user:join", { userId: String(uid) });
    });
    

    // register handlers
    if (handlers.onCreated) socket.on("task:created", handlers.onCreated);
    if (handlers.onUpdated) socket.on("task:updated", handlers.onUpdated);
    if (handlers.onDeleted) socket.on("task:deleted", handlers.onDeleted);

   

if (handlers.onProjectProgress) {
      socket.on("project:progress", handlers.onProjectProgress);
    }
    if (handlers.onAdminProjectProgress) {
      socket.on("admin:project_progress", handlers.onAdminProjectProgress);
    }
// after other listeners…
if (handlers.onExperienceUpdated) {
  socket.on("user:experience_updated", handlers.onExperienceUpdated);
}

if (handlers.onProjectUpdated) {
  socket.on("project:updated", handlers.onProjectUpdated);
}
if (handlers.onNotify) socket.on("notify:new", handlers.onNotify);
if (handlers.onNotifyCount) socket.on("notifications:unread_count", handlers.onNotifyCount);
    
    return () => {
      if (projectId) socket.emit("leave", { projectId });
      // leave user room
      const uid = readUserIdFromStorage();
      if (uid) socket.emit("user:leave", { userId: String(uid) });

      socket.off("task:created");
      socket.off("task:updated");
      socket.off("task:deleted");
      socket.off("project:progress");
      socket.off("admin:project_progress");
      socket.off("notify:new");
      socket.off("notifications:unread_count");
      socket.off("project:updated");
      socket.off("user:experience_updated");

      socket.disconnect();
    };
  }, [projectId]);

  
  return sockRef; // so the page can join extra project rooms if needed
}
