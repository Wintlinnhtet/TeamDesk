// src/components/NotificationBell.jsx
import React, { useEffect, useState, useRef } from "react";
import { API_BASE } from "../config";

function getCurrentUserId() {
  try {
    const ls = JSON.parse(localStorage.getItem("user") || "null");
    const ss = JSON.parse(sessionStorage.getItem("user") || "null");
    const raw = (ls?.user || ls || ss?.user || ss || null);
    const id = raw?._id || raw?.id || null;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export default function NotificationBell({ onOpen }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const uidRef = useRef(getCurrentUserId());
  const openedRef = useRef(false); // avoid immediate re-pop after we clear

  const fetchCount = async () => {
    const uid = uidRef.current;
    if (!uid) return;
    // if we just opened and cleared, skip first poll to prevent flicker
    if (openedRef.current) return;
    try {
      setLoading(true);
      const url = `${API_BASE}/notifications/unread_count?for_user=${encodeURIComponent(uid)}`;
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json.count === "number") {
        setCount(json.count);
      }
    } catch {
      // ignore errors silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount(); // initial
    timerRef.current = setInterval(fetchCount, 10000); // poll every 10s
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async () => {
    // Optimistically clear the badge
    setCount(0);
    openedRef.current = true;

    // Tell backend to mark all read (fails silently if route not present)
    const uid = uidRef.current;
    if (uid) {
      try {
        await fetch(`${API_BASE}/notifications/mark_all_read`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ for_user: uid }),
        });
      } catch {
        // no-op
      }
    }

    // Let parent open the panel
    onOpen?.();

    // allow polling again after a short delay to avoid immediate re-pop
    setTimeout(() => {
      openedRef.current = false;
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition"
      title="Notifications"
      aria-label="Notifications"
    >
      {/* Bell icon */}
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-700">
        <path
          fill="currentColor"
          d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 1 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.71 1.71A1 1 0 0 0 4 19h16a1 1 0 0 0 .71-1.71Z"
        />
      </svg>

      {/* red dot / count */}
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] leading-[18px] text-center font-bold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
