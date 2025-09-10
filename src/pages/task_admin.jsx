// src/frontend/pages/task_admin.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaChevronRight, FaChevronLeft, FaChevronDown } from "react-icons/fa";
import { API_BASE } from "../config";
import useRealtime from "../hooks/useRealtime";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Notifications from "../components/Notifications";

// ----- tiny helpers -----
const DONE = new Set(["done", "complete", "completed", "finished"]);
const sk = (x = "") => (x || "").toLowerCase();
const percentFromStatus = (status = "") => {
  const s = String(status || "");
  if (DONE.has(sk(s))) return 100;
  const m = s.match(/(\d{1,3})/);
  const n = m ? Number(m[1]) : 0;
  return Math.max(0, Math.min(100, isNaN(n) ? 0 : n));
};
/** 1-letter fallback */
const initial1 = (name = "", email = "") => {
  const src = (name || "").trim() || (email || "").trim();
  return src ? src[0].toUpperCase() : "?";
};

const joinUrl = (a = "", b = "") =>
  `${String(a).replace(/\/+$/, "")}/${String(b).replace(/^\/+/, "")}`;

/** robust image URL builder */
const buildImageUrl = (v) => {
  if (!v) return null;                  // return null (not "")
  const s = String(v).trim();
  if (!s) return null;

  // Absolute URL
  if (/^https?:\/\//i.test(s)) return s;

  // Starts with /uploads/ -> API_BASE + path
  if (s.startsWith("/uploads/")) return joinUrl(API_BASE, s);

  // Starts with uploads/ (missing leading slash) -> fix to /uploads/...
  if (/^uploads\//i.test(s)) return joinUrl(API_BASE, `/${s}`);

  // Bare filename like avatar.jpg -> /uploads/avatar.jpg
  if (!s.startsWith("/") && /\.(png|jpe?g|gif|webp|avif)$/i.test(s)) {
    return joinUrl(API_BASE, `/uploads/${s}`);
  }

  // Otherwise treat as public asset path or custom path
  return s;
};

const addBust = (url, bustKey) => {
  if (!url) return null;
  if (!bustKey) return url;
  return url + (url.includes("?") ? "&" : "?") + `t=${encodeURIComponent(bustKey)}`;
};

/** choose best candidate field for a member image */
const bestMemberImage = (m) => {
  const candidates = [
    m?.profileImage,
    m?.profileImageUrl,
    m?.picture,
    m?.profile?.photo,
    m?.avatar_url,
    m?.avatar,
  ].filter(Boolean);
  return candidates[0] || "";
};

const generateColors = (count) => {
  if (!count) return [];
  const colors = [];
  const base = Math.floor(Math.random() * 360);
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const hue = Math.round((base + i * step) % 360);
    colors.push(`hsl(${hue} 70% 50%)`);
  }
  return colors;
};

// current user id helper (matches your other components)
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

const TaskAdmin = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  // ----- notifications -----
  const [notifOpen, setNotifOpen] = useState(false);
  const uidRef = useRef(getCurrentUserId());

  // when opening the drawer, try to mark notifications as "seen"
  const markSeenSilently = async () => {
    const uid = uidRef.current;
    if (!uid) return;
    try {
      // preferred endpoint
      const res = await fetch(`${API_BASE}/notifications/mark_seen`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ for_user: uid })
      });
      // if it's missing, just ignore; NotificationBell will poll and update the count
      if (!res.ok && res.status !== 404) {
        // last resort: try mark_all_read (some backends only have this)
        await fetch(`${API_BASE}/notifications/mark_all_read`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ for_user: uid })
        }).catch(() => {});
      }
    } catch {
      /* no-op */
    }
  };

  const handleBellOpen = () => {
    setNotifOpen((prev) => {
      const opening = !prev;
      if (opening) markSeenSilently();
      return opening;
    });
  };

  // ---------- LEFT PANEL (admin can select ANY project) ----------
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [leftErr, setLeftErr] = useState("");
  const [leftLoading, setLeftLoading] = useState(false);
  const [projectTasks, setProjectTasks] = useState([]);
  const [membersById, setMembersById] = useState({});
  const [memberColors, setMemberColors] = useState({});
  const [leadersById, setLeadersById] = useState({}); // for calendar leader names

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/projects`);
        const list = await r.json();
        if (!r.ok) throw new Error(list?.error || `Projects ${r.status}`);
        const arr = Array.isArray(list) ? list : [];
        setProjects(arr);
        if (!selectedProjectId && arr.length) setSelectedProjectId(arr[0]._id);

        // preload users (leaders + members)
        const uniqMemberIds = [
          ...new Set(arr.flatMap(p => [p.leader_id, ...(p.member_ids || [])]).filter(Boolean)),
        ];
        if (uniqMemberIds.length) {
          const ru = await fetch(`${API_BASE}/users?ids=${encodeURIComponent(uniqMemberIds.join(","))}`);
          const users = await ru.json();
          if (ru.ok && Array.isArray(users)) {
            const map = {};
            users.forEach(u => { map[u._id] = u; });
            setMembersById(map);

            const leaderMap = {};
            arr.forEach(p => {
              if (p.leader_id && map[p.leader_id]) leaderMap[p.leader_id] = map[p.leader_id];
            });
            setLeadersById(leaderMap);
          }
        }
      } catch {
        setProjects([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProject = useMemo(
    () => projects.find(p => p._id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const projectName = selectedProject?.name || "Untitled project";

  useRealtime(selectedProjectId, {
    onCreated: (t) => {
      if (t.project_id !== selectedProjectId) return;
      setProjectTasks(prev => prev.some(x => x._id === t._id) ? prev : [t, ...prev]);
    },
    onUpdated: (patch) => {
      setProjectTasks(prev => prev.map(t => t._id === patch._id ? { ...t, ...patch } : t));
    },
    onDeleted: ({ _id, project_id }) => {
      if (project_id !== selectedProjectId) return;
      setProjectTasks(prev => prev.filter(t => t._id !== _id));
    }
  });

  // fetch members + tasks when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        setLeftLoading(true);
        setLeftErr("");

        const [rp, rt] = await Promise.all([
          fetch(`${API_BASE}/projects/${selectedProjectId}`),
          fetch(`${API_BASE}/tasks?project_id=${selectedProjectId}`)
        ]);

        const proj = await rp.json();
        if (!rp.ok) throw new Error(proj.error || `Project ${rp.status}`);

        const raw = await rt.json();
        if (!rt.ok) throw new Error(raw.error || `Tasks ${rt.status}`);

        if (cancelled) return;

        // ⚙️ Enrich project members with an _img like Task.jsx
        const baseMembers = {};
        const missingImgIds = [];
        (proj.members || []).forEach((mm) => {
          const id = typeof mm?._id === "object" ? mm._id?.$oid : mm?._id;
          const candidate = bestMemberImage(mm);
          baseMembers[id] = { ...mm, _img: buildImageUrl(candidate) };
          if (!baseMembers[id]._img && id) missingImgIds.push(id);
        });

        if (missingImgIds.length > 0) {
          try {
            const url = new URL(`${API_BASE}/users`);
            url.searchParams.set("ids", missingImgIds.join(","));
            const ru = await fetch(url.toString(), { credentials: "include" });
            const ju = await ru.json().catch(() => []);
            if (ru.ok && Array.isArray(ju)) {
              const byId = new Map(
                ju.map((u) => [
                  String(typeof u._id === "object" ? u._id.$oid : u._id || u.id),
                  buildImageUrl(u.profileImage || u.picture || "")
                ])
              );
              missingImgIds.forEach((id) => {
                const url = byId.get(String(id)) || "";
                if (url && baseMembers[id]) baseMembers[id]._img = url;
              });
            }
          } catch { /* ignore */ }
        }

        setMembersById(baseMembers);

        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.tasks) ? raw.tasks : []);
        setProjectTasks(list);
      } catch (e) {
        if (!cancelled) {
          setLeftErr(e.message || "Failed to load project/tasks");
          setProjectTasks([]);
        }
      } finally {
        if (!cancelled) setLeftLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const projectCompletionPct = useMemo(() => {
    if (!projectTasks?.length) return 0;
    const total = projectTasks.reduce((sum, t) => sum + percentFromStatus(t.status), 0);
    return Math.round(total / projectTasks.length);
  }, [projectTasks]);

  const expectedDate = useMemo(() => {
    if (!projectTasks?.length) return null;
    const toDate = (t) => new Date(t.end_at || t.start_at || t.created_at || 0).getTime();
    const maxMs = Math.max(...projectTasks.map(toDate).filter(Boolean));
    return Number.isFinite(maxMs) ? new Date(maxMs) : null;
  }, [projectTasks]);

  const expectedDays = useMemo(() => {
    if (!expectedDate) return null;
    const ms = expectedDate.setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }, [expectedDate]);

  const featuredTaskTitle = useMemo(() => {
    if (!projectTasks.length) return "—";
    const withEnd = projectTasks.filter(t => t.end_at)
      .sort((a,b) => new Date(a.end_at) - new Date(b.end_at));
    return (withEnd[0]?.title) || projectTasks[0]?.title || "—";
  }, [projectTasks]);

  useEffect(() => {
    if (!projectTasks || projectTasks.length === 0) {
      setMemberColors({});
      return;
    }
    const assignees = [...new Set(projectTasks.map(t => t.assignee_id).filter(Boolean))];
    const palette = generateColors(assignees.length);
    const mapping = {};
    assignees.forEach((id, idx) => { mapping[id] = palette[idx]; });
    setMemberColors(mapping);
  }, [projectTasks]);

  // ---------- RIGHT: member picker + counts/list + CALENDAR ----------
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberTasks, setMemberTasks] = useState([]);
  const [mtError, setMtError] = useState("");

  // all members across projects
  const allMemberIds = useMemo(() => {
    const s = new Set();
    projects.forEach(p => {
      if (p.leader_id) s.add(p.leader_id);
      (p.member_ids || []).forEach(id => s.add(id));
    });
    return [...s];
  }, [projects]);

  const memberOptions = useMemo(() => {
    return allMemberIds
      .map(id => membersById[id]
        ? { _id: id, name: membersById[id].name, email: membersById[id].email, picture: membersById[id].picture }
        : { _id: id }
      )
      .sort((a,b) => (a.name||a.email||"").localeCompare(b.name||b.email||""));
  }, [allMemberIds, membersById]);

  useEffect(() => {
    if (!selectedMemberId && memberOptions.length) setSelectedMemberId(memberOptions[0]._id);
  }, [memberOptions, selectedMemberId]);

  useEffect(() => {
    if (!selectedMemberId) return;
    (async () => {
      try {
        setMtError("");
        const r = await fetch(`${API_BASE}/tasks?assignee_id=${selectedMemberId}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `Tasks ${r.status}`);
        const list = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : []);
        setMemberTasks(list);
      } catch (e) {
        setMemberTasks([]);
        setMtError(e.message || "Failed to load member tasks");
      }
    })();
  }, [selectedMemberId]);

  const completeTasks = useMemo(
    () => memberTasks.filter(t => (t.progress === 100) || percentFromStatus(t.status) === 100),
    [memberTasks]
  );
  const progressTasks = useMemo(
    () => memberTasks.filter(t => !((t.progress === 100) || percentFromStatus(t.status) === 100)),
    [memberTasks]
  );
  const [listFilter, setListFilter] = useState("progress");
  const filteredTasks = listFilter === "complete" ? completeTasks : progressTasks;

  const selMember = selectedMemberId ? membersById[selectedMemberId] || {} : {};
  const memberInitial = initial1(selMember.name, selMember.email);

  // Calendar state (all projects deadlines)
  const [calMonth, setCalMonth] = useState(() => new Date());
  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth();
  const firstDow = new Date(calYear, calMon, 1).getDay();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const todayKey = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, []);

  // member dropdown open/close
  const [openMemberDD, setOpenMemberDD] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenMemberDD(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpenMemberDD(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Map: day -> projects due that day
  const deadlinesByDay = useMemo(() => {
    const map = new Map();
    projects.forEach(p => {
      const end = p.end_at ? new Date(p.end_at) : null;
      if (!end || isNaN(end.getTime())) return;
      if (end.getFullYear() !== calYear || end.getMonth() !== calMon) return;
      const d = end.getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(p);
    });
    return map;
  }, [projects, calYear, calMon]);

  const [selectedDay, setSelectedDay] = useState(null);
  const selectedDayProjects = selectedDay ? (deadlinesByDay.get(selectedDay) || []) : [];

  const fmtShort = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="ml-5 w-full">
      <div className="p-6 font-sans bg-white min-h-screen w-full flex">
        {/* LEFT / MAIN PANEL */}
        <div className="w-2/3 pr-4">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Team&apos;s To-Do</h1>

            {/* Bell + drawer toggle */}
            <div className="flex items-center gap-3">
              <NotificationBell currentUserId={uidRef.current} onOpen={handleBellOpen} />
              <div>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="border rounded-lg px-3 py-1 text-sm"
                  style={{ borderColor: customColor, color: customColor }}
                  title="Select project"
                >
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name || "Untitled project"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          <div className="p-6 rounded-2xl border border-gray-200 shadow-sm bg-white">
            <div className="flex items-center justify-between p-4 w-full max-w-4xl">
              <div className="flex flex-col">
                <div className="text-lg font-semibold text-gray-800 mb-2">{projectName}</div>
                <div className="text-sm text-gray-500 mb-1">
                  <p>Task: <span className="font-semibold">{featuredTaskTitle}</span></p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="text-sm text-gray-500 mb-2">Complete</div>
                <div className="w-32 bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${projectCompletionPct}%`, backgroundColor: "#ef4444" }}
                  />
                </div>
                <div className="text-sm text-gray-500">{projectCompletionPct}%</div>
              </div>

              <div className="flex flex-col items-end">
                <div className="text-sm text-gray-500">Expected Completion</div>
                <div className="text-lg font-semibold text-gray-800">
                  {expectedDate
                    ? expectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </div>
                <div className="text-xs text-gray-400">
                  {expectedDays != null ? `${expectedDays} Days` : "—"}
                </div>
              </div>
            </div>

            {leftLoading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : leftErr ? (
              <div className="text-sm text-red-600">{leftErr}</div>
            ) : projectTasks.length === 0 ? (
              <div className="text-sm text-gray-500">No tasks in this project.</div>
            ) : (
              <div className="space-y-4">
                {projectTasks.map((t) => {
                  const m = membersById[t.assignee_id] || {};
                  const pic = m?._img || "";
                  const letter = initial1(m?.name, m?.email);
                  const pct = percentFromStatus(t.status);
                  const isDone = pct === 100;

                  return (
                    <div key={t._id} className="relative w-full">
                      <div
                        className="rounded-full text-white px-4 py-3 flex items-center gap-3 shadow"
                        style={{
                          width: `${Math.max(pct, 12)}%`,
                          minWidth: 160,
                          backgroundColor: memberColors[t.assignee_id] || "#888",
                          transition: "width 220ms ease",
                        }}
                      >
                        {/* avatar/initial */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center ring-2 ring-white/40">
                          {pic ? (
                            <img
                              src={pic}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const sibling = e.currentTarget.nextElementSibling;
                                if (sibling) sibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span
                            className="text-sm font-bold"
                            style={{ display: pic ? "none" : "flex" }}
                          >
                            {letter}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {t.title} <span className="opacity-90 font-normal">— {m.name || m.email || "Member"}</span>
                          </div>
                          <div className="text-xs text-white/90">
                            {isDone ? "Completed" : `Progress: ${pct}%`}
                          </div>
                        </div>

                        <div className="ml-auto text-xs font-semibold">
                          {isDone ? "100%" : `${pct}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-1/3 pl-6 border-l border-gray-200">
          {/* Bell also here if you want it on the right (kept to match your previous layout) */}
         
          {/* Member picker */}
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenMemberDD(v => !v)}
              className="w-full flex items-center justify-between mb-4 border rounded-lg px-3 py-2 bg-white"
              style={{ borderColor: customColor }}
            >
              <div className="flex items-center space-x-3">
            
                <div className="text-left">
                  <div className="font-semibold">
                    {selMember?.name || "Select member"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selMember?.email || ""}
                  </div>
                </div>
              </div>
              <FaChevronDown
                className={`ml-3 text-[12px] transition-transform ${openMemberDD ? "rotate-180" : ""}`}
                style={{ color: customColor }}
              />
            </button>

            {openMemberDD && (
              <div className="absolute z-20 top-full left-0 mt-1 w-full max-w-xs bg-white border border-gray-200 rounded-md shadow-md">
                <ul className="max-h-72 overflow-auto divide-y divide-gray-100">
                  {memberOptions.map((m) => (
                    <li key={m._id}>
                      <button
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                          selectedMemberId === m._id ? "bg-gray-50" : ""
                        }`}
                        onClick={() => {
                          setSelectedMemberId(m._id);
                          setOpenMemberDD(false);
                        }}
                      >
                   
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {m.name || m.email || m._id}
                          </div>
                          {(m.name && m.email) && (
                            <div className="text-xs text-gray-500 truncate">{m.email}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Counts (click to filter list) */}
          <div className="grid grid-cols-2 gap-2 mb-6 mt-2">
            <button
              className={`text-white text-center py-2 rounded-xl text-sm ${listFilter === "progress" ? "ring-2 ring-white" : ""}`}
              style={{ backgroundColor: "#0ea5e9" }}
              onClick={() => setListFilter("progress")}
              title="Show in-progress tasks"
            >
              <div className="font-bold text-lg">{progressTasks.length}</div>
              <div>Progress</div>
            </button>
            <button
              className={`text-white text-center py-2 rounded-xl text-sm ${listFilter === "complete" ? "ring-2 ring-white" : ""}`}
              style={{ backgroundColor: "#6366f1" }}
              onClick={() => setListFilter("complete")}
              title="Show completed tasks"
            >
              <div className="font-bold text-lg">{completeTasks.length}</div>
              <div>Complete</div>
            </button>
          </div>

          {/* Member task list */}
          <div className="space-y-4 mb-6">
            {mtError ? (
              <div className="text-sm text-red-600">{mtError}</div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-sm text-gray-500 text-center">
                {listFilter === "progress" ? "No in-progress tasks" : "No completed tasks"}
              </div>
            ) : (
              filteredTasks.slice(0, 8).map((t, i) => {
                const color =
                  listFilter === "complete"
                    ? "bg-indigo-500"
                    : ["bg-sky-500", "bg-rose-400", "bg-orange-300", "bg-emerald-400"][i % 4];
                const dateLabel =
                  listFilter === "complete"
                    ? (t.end_at || t.updated_at ? `Completed: ${new Date(t.end_at || t.updated_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}` : "Completed")
                    : (t.start_at ? `Started: ${new Date(t.start_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}` : "");

                return (
                  <div key={t._id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded-full ${color}`} />
                      <div>
                        <div className="text-sm font-semibold">{t.title}</div>
                        <div className="text-xs text-gray-400">{dateLabel}</div>
                      </div>
                    </div>
                    <FaChevronRight className="text-gray-400 text-xs" />
                  </div>
                );
              })
            )}
          </div>

          {/* Calendar: all projects' deadlines */}
          <div style={{ backgroundColor: customColor }} className="rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <button
                className="px-2 py-1 bg-white/20 rounded flex items-center gap-1"
                onClick={() => { setSelectedDay(null); setCalMonth(new Date(calYear, calMon - 1, 1)); }}
                title="Previous month"
              >
                <FaChevronLeft />
                <span className="text-xs">Prev</span>
              </button>
              <div className="text-sm font-semibold">
                {calMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </div>
              <button
                className="px-2 py-1 bg-white/20 rounded flex items-center gap-1"
                onClick={() => { setSelectedDay(null); setCalMonth(new Date(calYear, calMon + 1, 1)); }}
                title="Next month"
              >
                <FaChevronRight />
                <span className="text-xs">Next</span>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <div key={d} className="font-medium">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`blank-${i}`} className="p-2 rounded-lg opacity-0">.</div>
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const dayProjects = deadlinesByDay.get(d) || [];
                const hasDue = dayProjects.length > 0;
                const isSelected = selectedDay === d;
                const key = `${calYear}-${calMon}-${d}`;
                const isToday = key === todayKey;

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`rounded-lg p-2 text-left transition ${
                      isSelected ? "bg-white/30" : "bg-white/10 hover:bg-white/20"
                    } ${isToday ? "ring-2 ring-white/70" : ""}`}
                  >
                    <div className="text-xs font-semibold">{d}</div>
                    {hasDue && (
                      <div className="mt-1">
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="inline-block w-2 h-2 rounded-full bg-white" />
                          <span>{dayProjects.length}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs">
              {selectedDay ? (
                <>
                  <div className="font-semibold mb-1">
                    Deadlines on {fmtShort(new Date(calYear, calMon, selectedDay))}:
                  </div>
                  {selectedDayProjects.length === 0 ? (
                    <div className="opacity-80">No deadlines.</div>
                  ) : (
                    <ul className="space-y-1">
                      {selectedDayProjects.map((p) => {
                        const leader = leadersById[p.leader_id] || {};
                        const leaderName = leader.name || leader.email || "Unknown";
                        return (
                          <li
                            key={p._id}
                            className="flex items-center justify-between bg-white/10 rounded px-2 py-1 cursor-pointer hover:bg-white/20"
                            title="Open project"
                            onClick={() => navigate(`/projects/${p._id}`)}
                          >
                            <span className="truncate pr-2">{p.name || "Untitled project"}</span>
                            <span className="opacity-90">Lead: {leaderName}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <div className="opacity-80">Select a date to see project deadlines</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification drawer (kept outside so it overlaps cleanly) */}
      <Notifications
        currentUserId={uidRef.current}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </div>
  );
};

export default TaskAdmin;
