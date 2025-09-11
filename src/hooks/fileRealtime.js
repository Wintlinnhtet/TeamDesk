import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

const SOCKET_URL = "http://localhost:5000/rt"; // adjust your backend URL

export const useFileRealtime = () => {
  const [folders, setFolders] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on("folder:created", (folder) => {
      setFolders((prev) => [folder, ...prev]);
    });

    socketRef.current.on("folder:deleted", ({ _id }) => {
      setFolders((prev) => prev.filter((f) => f._id !== _id));
    });

    socketRef.current.on("file:uploaded", (fileDoc) => {
      setFolders((prev) =>
        prev.map((f) =>
          f._id === fileDoc.folder_id.toString()
            ? { ...f, files: [fileDoc, ...f.files] }
            : f
        )
      );
    });

    socketRef.current.on("file:deleted", ({ _id, folder_id }) => {
      setFolders((prev) =>
        prev.map((f) =>
          f._id === folder_id.toString()
            ? { ...f, files: f.files.filter((file) => file._id !== _id) }
            : f
        )
      );
    });

    return () => socketRef.current.disconnect();
  }, []);

  return [folders, setFolders];
};
