// src/hooks/useRealtime.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../config";

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
    });

    // register handlers
    if (handlers.onCreated) socket.on("task:created", handlers.onCreated);
    if (handlers.onUpdated) socket.on("task:updated", handlers.onUpdated);
    if (handlers.onDeleted) socket.on("task:deleted", handlers.onDeleted);

    return () => {
      if (projectId) socket.emit("leave", { projectId });
      socket.off("task:created");
      socket.off("task:updated");
      socket.off("task:deleted");
      socket.disconnect();
    };
  }, [projectId]);

  return sockRef; // so the page can join extra project rooms if needed
}
