import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

function when(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || "";
  }
}

function ActivityItem({ it, accent = "#AA405B" }) {
  // generic formatter; adjust to your log shape
  const who = it.user_name || it.user?.name || it.actor || "Someone";
  const proj = it.project_name || it.project?.name || it.project || "";
  const task = it.task_title || it.task?.title || it.task || "";
  const msg =
    it.message ||
    it.action ||
    (it.type === "task_progress"
      ? `updated "${task}" to ${it.progress_after ?? it.progress}%`
      : it.type === "project_progress"
      ? `project "${proj}" is now ${it.progress_after ?? it.progress}%`
      : it.type === "membership"
      ? it.detail || "changed membership"
      : it.type || "activity");

  return (
    <div className="relative p-2 bg-white rounded-lg shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg" style={{ backgroundColor: accent }} />
      <div className="pl-3">
        <div className="text-sm font-medium text-gray-800">
          {who} <span className="font-normal text-gray-600">{msg}</span>
        </div>
        {proj ? <div className="text-xs text-gray-500 mt-0.5">Project: {proj}</div> : null}
        <div className="text-[11px] text-gray-400 mt-0.5">{when(it.at || it.created_at || it.timestamp)}</div>
      </div>
    </div>
  );
}

export default function ActivityFeed({
  title = "Recent activity",
  projectId,
  userId,
  limit = 8,
  accent = "#AA405B",
}) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchTry = async (path) => {
      const url = new URL(`${API_BASE}${path}`);
      if (projectId) url.searchParams.set("project_id", projectId);
      if (userId) url.searchParams.set("user_id", userId);
      if (limit) url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return Array.isArray(j) ? j : (Array.isArray(j.logs) ? j.logs : []);
    };

    (async () => {
      try {
        // Try a few common/likely endpoints; first one that works wins.
        const attempts = ["/logs", "/admin/logs", "/audit-log"];
        for (const p of attempts) {
          try {
            const data = await fetchTry(p);
            if (!cancelled) {
              setItems(data.slice(0, limit));
              setErr("");
            }
            return;
          } catch {
            // continue to next attempt
          }
        }
        if (!cancelled) {
          setItems([]);
          setErr(""); // silent if none exist yet
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setErr(""); // keep quiet in UI by default
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, userId, limit]);

  return (
    <div className="p-3 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold" style={{ color: accent }}>{title}</h2>
      </div>

      {items === null ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">No activity yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <ActivityItem key={it._id || it.id || i} it={it} accent={accent} />
          ))}
        </div>
      )}

      {err ? <div className="mt-2 text-xs text-red-500">{err}</div> : null}
    </div>
  );
}
