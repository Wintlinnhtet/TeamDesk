import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

export default function Notifications({ currentUserId, open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!open || !currentUserId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/notifications?for_user=${encodeURIComponent(currentUserId)}`, { credentials: "include" });
      const json = await res.json().catch(() => []);
      setItems(Array.isArray(json) ? json : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [open, currentUserId]);

  const markAllRead = async () => {
    await fetch(`${API_BASE}/notifications/mark_all_read`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ for_user: currentUserId })
    });
    load();
  };

  if (!open) return null;

  return (
    <div className="absolute right-4 top-12 w-[360px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <div className="font-semibold">Notifications</div>
        <div className="flex gap-2">
          <button onClick={markAllRead} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">Mark all read</button>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">Close</button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-auto">
        {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {!loading && items.length === 0 && <div className="p-4 text-sm text-slate-500">No notifications.</div>}

        {!loading && items.map(n => (
          <div key={n._id} className="px-4 py-3 border-b last:border-b-0">
            <div className="text-sm font-medium text-slate-800">{n.title || n.type}</div>
            <div className="text-xs text-slate-600 mt-1">{n.message}</div>
            <div className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
