// src/frontend/components/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { getCurrentUser } from "../auth";
import useRealtime from "../hooks/useRealtime";
import NotificationBell from "../components/NotificationBell";
import Notifications from "../components/Notifications";

const DONE = new Set(["done", "complete", "completed", "finished"]);

// helper: build full url when picture starts with /uploads/
const buildImageUrl = (v) => {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/uploads/")) return `${API_BASE}${v}`;
  // handle plain filename stored earlier like "cat2.jpg"
  if (!v.startsWith("/") && v.match(/\.(png|jpe?g|gif|webp|avif)$/i)) {
    return `${API_BASE}/uploads/${v}`;
  }
  return v;
};

const Dashboard = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();
  const user = getCurrentUser(); // {_id, name, email, role, ...}

  const [notifOpen, setNotifOpen] = useState(false);
  const [bellKey, setBellKey] = useState(0);

  const [batchmates, setBatchmates] = useState([]);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState("");
const reloadExperience = async () => {
  if (!user?._id) return;
  try {
    const uRes = await fetch(`${API_BASE}/get-user/${user._id}`);
    const uData = await uRes.json();
    if (uRes.ok) setExperience(uData.experience ?? []);
  } catch {}
};

useRealtime(null, {
  onExperienceUpdated: (payload) => {
    // ensure this event is for the logged-in user
    if (payload?.user_id && payload.user_id !== user?._id) return;
    // stay canonical: refetch the user's experience
    reloadExperience();
  },
  onProjectUpdated: (p) => {
    if (!p?._id) return;
    // merge into local projects so confirmedExperience recomputes
    setProjects((prev) =>
      Array.isArray(prev)
        ? prev.map((x) => (x._id === p._id ? { ...x, ...p } : x))
        : prev
    );
  },
});


// Dashboard.jsx (or Profile/Experience page)


  const markAllRead = async () => {
    if (!user?._id) return;
    try {
      await fetch(`${API_BASE}/notifications/mark_all_read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ for_user: user._id }),
      });
      setBellKey((k) => k + 1);
    } catch {}
  };

  const initials = (name = "") => {
    const first = (name || "").trim().split(/\s+/)[0] || "";
    return (first[0] || "?").toUpperCase();
  };

  const projectsById = useMemo(() => {
    const map = {};
    for (const p of projects) map[p._id] = p;
    return map;
  }, [projects]);

  const upcomingWithProject = useMemo(() => {
    const withDates = (tasks || [])
      .map((t) => ({ ...t, startMs: t.start_at ? Date.parse(t.start_at) : Infinity }))
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 6);
    return withDates.map((t) => ({
      ...t,
      projectName: projectsById[t.project_id]?.name || "Untitled project",
    }));
  }, [tasks, projectsById]);

  const today = new Date();
  const monthLabel = today.toLocaleString("en-US", { month: "long" });
  const dayLabel = `${today.getDate()}, ${today.toLocaleString("en-US", { weekday: "short" })}`;

  const normalizedExperienceAll = useMemo(() => {
    if (Array.isArray(experience)) return experience;
    if (typeof experience === "string") {
      try {
        const parsed = JSON.parse(experience);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [experience]);

  const confirmedExperience = useMemo(() => {
    if (!projects?.length) return [];
    const confirmedNames = new Set(
      projects
        .filter((p) => Number(p?.confirm || 0) === 1)
        .map((p) => String(p?.name || "").trim().toLowerCase())
    );
    if (confirmedNames.size === 0) return [];
    return normalizedExperienceAll.filter((exp) => {
      const pname = String(exp?.project || "").trim().toLowerCase();
      return pname && confirmedNames.has(pname);
    });
  }, [projects, normalizedExperienceAll]);

  const loadOpenTasksForUser = async (uid) => {
    try {
      const [rtodo, rprog] = await Promise.all([
        fetch(`${API_BASE}/tasks?assignee_id=${uid}&status=todo`),
        fetch(`${API_BASE}/tasks?assignee_id=${uid}&status=in_progress`)
      ]);
      let list = [];
      if (rtodo.ok) {
        const a = await rtodo.json().catch(() => []);
        if (Array.isArray(a)) list.push(...a);
      }
      if (rprog.ok) {
        const b = await rprog.json().catch(() => []);
        if (Array.isArray(b)) list.push(...b);
      }
      if (list.length > 0) {
        const seen = new Set();
        const openOnly = [];
        for (const t of list) {
          const id = t._id || `${t.project_id}-${t.title}-${t.start_at}`;
          if (seen.has(id)) continue;
          seen.add(id);
          openOnly.push(t);
        }
        setTasks(openOnly);
        return;
      }
      const rf = await fetch(`${API_BASE}/tasks?assignee_id=${uid}`);
      const df = await rf.json();
      const all = Array.isArray(df) ? df : [];
      const open = all.filter(
        (t) => !DONE.has(String(t.status || "").toLowerCase()) && Number(t.progress || 0) < 100
      );
      setTasks(open);
    } catch {
      setTasks([]);
    }
  };

  // Load user details, projects, tasks
  useEffect(() => {
    if (!user?._id) {
      setMsg("Please sign in again.");
      return;
    }
    (async () => {
      try {
        const uRes = await fetch(`${API_BASE}/get-user/${user._id}`);
        const uData = await uRes.json();
        if (uRes.ok) setExperience(uData.experience ?? []);
        else console.warn("get-user failed:", uData);

        const pRes = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
        const pData = await pRes.json();
        if (pRes.ok) setProjects(Array.isArray(pData) ? pData : []);
        else console.warn("projects failed:", pData);

        await loadOpenTasksForUser(user._id);
      } catch (e) {
        console.error(e);
        setMsg("Failed to load dashboard data.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Batchmates: fetch full user docs to get profileImage/picture
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!projects?.length) {
          if (!cancelled) setBatchmates([]);
          return;
        }

        // Load each project's members to gather all unique member IDs
        const memberIds = new Set();
        await Promise.all(
          projects.map(async (p) => {
            const r = await fetch(`${API_BASE}/projects/${p._id}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `Failed ${r.status}`);
            const arr = Array.isArray(d.members) ? d.members : [];
            for (const m of arr) {
              const mid = m?._id || m?.id;
              if (!mid || mid === user?._id) continue;
              memberIds.add(String(mid));
            }
          })
        );

        if (memberIds.size === 0) {
          if (!cancelled) setBatchmates([]);
          return;
        }

        // ✅ Fetch their pictures (now includes profileImage from backend)
        const url = new URL(`${API_BASE}/users`);
        url.searchParams.set("ids", Array.from(memberIds).join(","));
        const res = await fetch(url.toString(), { credentials: "include" });
        const json = await res.json().catch(() => []);
        const list = Array.isArray(json) ? json : [];

        // Map _id -> { name, title?, img }
        const byId = new Map(
          list.map((u) => [
            String(u._id),
            {
              _id: String(u._id),
              name: u.name || u.email || "Member",
              title: "Member",
              img: buildImageUrl(u.picture || ""),
            },
          ])
        );

        // Build final unique list in a stable order
        const out = Array.from(memberIds).map((id) => {
          const m = byId.get(String(id));
          return m || { _id: String(id), name: "Member", title: "Member", img: "" };
        });

        if (!cancelled) setBatchmates(out);
      } catch (e) {
        console.error("batchmates load failed:", e);
        if (!cancelled) setBatchmates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, user?._id]);

  return (
    <div className="ml-5 w-full">
      {/* Header row with bell */}
      <div className="mt-2 mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black">
            Hello {user?.name || user?.email || ""}
          </h1>
          <p className="text-sm" style={{ color: customColor }}>
            Let's finish your task today!
          </p>
        </div>

        {/* Bell + panel */}
        <div className="flex items-center justify-end gap-2 mb-2 mr-4 relative">
          <NotificationBell
            key={bellKey}
            onOpen={async () => {
              const next = !notifOpen;
              setNotifOpen(next);
              if (next) await markAllRead();
            }}
          />
          <Notifications
            currentUserId={user?._id}
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </div>
      </div>

      {msg && <p className="text-red-500 mt-2">{msg}</p>}

      <div className="flex">
        {/* LEFT COLUMN */}
        <div className="flex flex-col w-3/4 space-y-4 mr-3">
          <div className="mt-3 shadow-md p-4 rounded-lg flex items-center h-50 bg-white">
            <div className="flex-1">
              <h2 className="text-xl font-bold" style={{ color: customColor }}>Today Task</h2>
              <p className="text-gray-600">Check your projects as a leader</p>
              <button
                onClick={() => navigate("/projects")}
                className="mt-4 text-white px-4 py-2 rounded-lg shadow-md"
                style={{ backgroundColor: customColor }}
              >
                Your Projects
              </button>
            </div>
            <div className="mr-8">
              <img src="task.png" alt="Task Icon" className="h-30 w-55" />
            </div>
          </div>

          {/* Previous Experience (filtered) */}
          <div className="flex w-full space-x-4 mt-6">
            <div className="w-1/2 bg-white p-4 rounded-xl shadow-md relative">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 ml-8">Previous Experience</h2>
              <div className="absolute left-2 top-5 bottom-4 w-0.5 z-0 ml-6" style={{ backgroundColor: customColor }} />
              {confirmedExperience.length === 0 ? (
                <div className="ml-8 text-gray-500">No experience from confirmed projects.</div>
              ) : (
                <div className="space-y-5 ml-8">
                  {confirmedExperience.map((exp, i) => (
                    <div key={i} className="relative pl-6 z-10">
                      <div className="absolute left-0 top-1 w-3 h-3 rounded-full" style={{ backgroundColor: customColor }} />
                      <h3 className="font-semibold text-sm text-gray-800">
                        🧑‍💻 {exp?.title || "—"}
                      </h3>
                      <p className="text-sm text-gray-600">{exp?.time || ""}</p>
                      <p className="text-xs" style={{ color: customColor }}>
                        {exp?.project || ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

             <div className="rounded-xl p-2 w-full mb-3" style={{ backgroundColor: customColor }}>
            <h2 className="text-center font-semibold text-lg mb-4 text-white">Batchmates</h2>
            {batchmates.length === 0 ? (
              <div className="bg-white rounded-lg p-3 text-center text-sm text-gray-500">
                No teammates yet
              </div>
            ) : (
              batchmates.slice(0, 6).map((mate) => (
                <div key={mate._id} className="flex items-center bg-white rounded-lg p-2 mb-2">
                  {mate.img ? (
                    <img
                      src={mate.img}
                      alt={mate.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => { e.currentTarget.src = ""; }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: customColor }}
                      aria-label={mate.name}
                    >
                      {initials(mate.name)}
                    </div>
                  )}
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{mate.name}</p>
                    <p className="text-xs truncate" style={{ color: customColor }}>
                      {mate.title}
                    </p>
                  </div>
                </div>
              ))
            )}
            
          </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col w-1/4 space-y-4 mr-10">
          <div className="p-3 rounded-lg" style={{ backgroundColor: customColor }}>
            <h2 className="text-xl font-bold text-white">
              {user?.name || user?.email || "User"}
            </h2>
            <p className="text-white">{user?.role || "Member"}</p>

            <div className="mt-4">
              <div className="flex justify-between">
                <span className="text-white font-semibold">{monthLabel}</span>
                <span className="text-white font-semibold">{dayLabel}</span>
              </div>

              <div className="mt-2 space-y-2 bg-white shadow-md p-4 rounded-lg">
                {upcomingWithProject.length === 0 ? (
                  <div className="text-center text-sm text-gray-500">No upcoming tasks</div>
                ) : (
                  upcomingWithProject.slice(0, 4).map((t) => (
                    <div key={t._id} className="flex justify-between p-2 bg-white rounded-lg shadow-md relative">
                      <div className="absolute left-0 top-0 h/full w-2" style={{ backgroundColor: customColor }} />
                      <span className="pr-3 font-medium" style={{ color: customColor }}>
                        {t.title}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{t.projectName}</span>
                    </div>
                  ))
                )}

                <div className="text-center mt-4">
                  <button
                    className="px-4 py-2 bg.white text-gray-600 rounded-lg shadow-md border-2 transition-colors"
                    style={{ color: customColor, borderColor: customColor, backgroundColor: "white" }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = customColor;
                      e.target.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "white";
                      e.target.style.color = customColor;
                    }}
                    onClick={() => navigate("/tasks")}
                  >
                    See More
                  </button>
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
