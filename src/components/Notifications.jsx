import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { FiTrash2 } from "react-icons/fi";

export default function Notifications({ currentUserId, open, onClose, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!open || !currentUserId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/notifications?for_user=${encodeURIComponent(currentUserId)}`,
        { credentials: "include" }
      );
      const json = await res.json().catch(() => []);
      setItems(Array.isArray(json) ? json : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [open, currentUserId]);

  const deleteOne = async (n) => {
    if (!n?._id) return;
    try {
      setBusyId(n._id);
      const res = await fetch(`${API_BASE}/notifications/${encodeURIComponent(n._id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Failed to delete: ${res.status} ${t}`);
        return;
      }
      setItems(prev => prev.filter(x => x._id !== n._id));
      // if the server tracks unread, tell parent to decrement the bell
      if (onCountChange && (n.read === false || n.is_read === false || n.unread === true)) {
        onCountChange(-1);
      }
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-4 top-12 w-[360px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <div className="font-semibold">Notifications</div>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">Close</button>
      </div>

      <div className="max-h-[360px] overflow-auto">
        {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {!loading && items.length === 0 && <div className="p-4 text-sm text-slate-500">No notifications.</div>}

        {!loading && items.map(n => (
          <div key={n._id} className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-800">{n.title || n.type}</div>
              <div className="text-xs text-slate-600 mt-1">{n.message}</div>
              <div className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <button
  onClick={() => deleteOne(n)}
  className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
  title="Delete notification"
  aria-label="Delete notification"
>
  <FiTrash2 className="w-4 h-4" />
</button>

          </div>
        ))}
      </div>
    </div>
  );
}
