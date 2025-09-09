import React, { useEffect, useMemo, useState } from "react";
import { FaBell, FaChevronRight, FaChevronLeft } from "react-icons/fa";
import { FiCheckCircle } from "react-icons/fi";
import { API_BASE } from "../config";
import { useNavigate } from "react-router-dom";
import useRealtime from "../hooks/useRealtime";

// --- helpers ---
const initials = (name = "", email = "") => {
  const src = (name || "").trim() || (email || "").trim();
  return src ? src[0].toUpperCase() : "?";
};

// Generate N distinct random HSL colors (randomized order but evenly spaced)
const generateColors = (count) => {
  if (!count) return [];
  const colors = [];
  const base = Math.floor(Math.random() * 360); // random offset per load
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const hue = Math.round((base + i * step) % 360);
    colors.push(`hsl(${hue} 70% 50%)`);
  }
  return colors;
};

const sk = (x = "") => (x || "").toLowerCase();
const DONE = new Set(["done", "complete", "completed", "finished"]);

// parse "todo,80" → 80; "complete" → 100; fallback → 0
const parseProgress = (status = "") => {
  const s = String(status || "").toLowerCase();
  if (DONE.has(s)) return 100;
  const m = s.match(/(\d{1,3})/);
  const n = m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : 0;
  return n;
};


// pull the numeric % out of "todo,80", clamp, or 100 for any "done" state
const percentFromStatus = (status = "") => {
  const s = String(status || "");
  if (DONE.has(sk(s))) return 100;
  const m = s.match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return Math.max(0, Math.min(100, isNaN(n) ? 0 : n));
};

const Task = () => {
  const customColor = "#AA405B";

  // ---- who am I ----
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const stored =
        JSON.parse(localStorage.getItem("user")) ||
        JSON.parse(sessionStorage.getItem("user"));
      setUser(stored?.user || stored || null);
    } catch {
      setUser(null);
    }
  }, []);

  // ---- projects & selection ----
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?._id) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
        const list = await r.json();
        if (!r.ok) throw new Error(list.error || `Projects ${r.status}`);
        const arr = Array.isArray(list) ? list : [];
        setProjects(arr);
        if (!selectedProjectId && arr.length) setSelectedProjectId(arr[0]._id);
      } catch (e) {
        setErr(e.message || "Failed to load projects");
      }
    })();
  }, [user?._id]);

  // ---- RIGHT PANE (unchanged) data ----
  const [myTasks, setMyTasks] = useState([]);
  const [progressCount, setProgressCount] = useState(0);
  const [completeCount, setCompleteCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("todo"); // right pane filter
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?._id) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/tasks?assignee_id=${user._id}`);
        const data = await r.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : []);
        setMyTasks(list);
        const doneCount = list.filter(t => DONE.has((t.status || "").toLowerCase())).length;
        setCompleteCount(doneCount);
        setProgressCount(list.length - doneCount);
      } catch {
        setMyTasks([]);
        setProgressCount(0);
        setCompleteCount(0);
      }
    })();
  }, [user?._id]);

  const handleTaskClick = (taskId) => navigate(`/task-detail/${taskId}`);

  const filteredTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const s = (task.status || "").toLowerCase();
      return statusFilter === "complete" ? DONE.has(s) : !DONE.has(s);
    });
  }, [myTasks, statusFilter]);

  // ---- Calendar (RIGHT) state early so memos can use them if needed ----
  const [calMonth, setCalMonth] = useState(() => new Date());
  const calYear  = calMonth.getFullYear();
  const calMon   = calMonth.getMonth();
  const daysInCalMonth = new Date(calYear, calMon + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) =>
    d === today.getDate() && calMon === today.getMonth() && calYear === today.getFullYear();

  // map project_id -> project name (for calendar tooltips)
  const projectNameById = useMemo(() => {
    const map = new Map();
    (projects || []).forEach(p => map.set(p._id, p.name || "Untitled project"));
    return map;
  }, [projects]);

  // Bucket MY tasks by end date (YYYY-MM-DD) in the current month (for calendar)
  const tasksByDay = useMemo(() => {
    const byDay = new Map();
    for (const t of myTasks) {
      const end = t.end_at || null;
      if (!end) continue;
      const d = new Date(end);
      if (d.getFullYear() !== calYear || d.getMonth() !== calMon) continue;
      const day = d.getDate();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(t);
    }
    return byDay;
  }, [myTasks, calYear, calMon]);

  // which calendar day is selected and its tasks
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState([]);

  // ---- LEFT PANE: Project-wide tasks ----
  const [projectTasks, setProjectTasks] = useState([]);
  const [membersById, setMembersById] = useState({});
  const [memberColors, setMemberColors] = useState({});
// parse "status" like "todo,80" or "complete" → 0..100
const pctFromStatus = (status) => {
  if (!status) return 0;
  const s = String(status).trim().toLowerCase();
  if (DONE.has(s)) return 100;
  const m = /^todo\s*,\s*(\d{1,3})/.exec(s);
  if (m) return Math.max(0, Math.min(100, parseInt(m[1], 10)));
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
};
const selectedProject = useMemo(
  () => projects.find(p => p._id === selectedProjectId) || null,
  [projects, selectedProjectId]
);

const projectName = selectedProject?.name || "Untitled project";

// Aggregate completion across all tasks (simple average of each task's %)
const projectCompletionPct = useMemo(() => {
  if (!projectTasks?.length) return 0;
  const total = projectTasks.reduce((sum, t) => sum + pctFromStatus(t.status), 0);
  return Math.round(total / projectTasks.length);
}, [projectTasks]);

// "Expected completion" = farthest end_at among tasks (fallback: latest start_at / created_at)
const expectedDate = useMemo(() => {
  if (!projectTasks?.length) return null;
  const toDate = (t) => new Date(t.end_at || t.start_at || t.created_at || 0).getTime();
  const maxMs = Math.max(...projectTasks.map(toDate).filter(Boolean));
  return Number.isFinite(maxMs) ? new Date(maxMs) : null;
}, [projectTasks]);
// tasks in selected project that belong to the logged-in user
const myProjectTasks = useMemo(() => {
  if (!user?._id) return [];
  return (projectTasks || []).filter(t => t.assignee_id === user._id);
}, [projectTasks, user?._id]);

// choose which of *my* tasks to show in header (earliest upcoming end date; fallback to first)
const myFeaturedTaskTitle = useMemo(() => {
  if (!myProjectTasks.length) return "—";
  const withEnd = myProjectTasks
    .filter(t => t.end_at)
    .sort((a, b) => new Date(a.end_at) - new Date(b.end_at));
  return (withEnd[0]?.title) || myProjectTasks[0].title || "—";
}, [myProjectTasks]);

// days remaining to expectedDate (ceil)
const expectedDays = useMemo(() => {
  if (!expectedDate) return null;
  const ms = expectedDate.setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}, [expectedDate]);

// Optional: show a "featured" task (earliest upcoming end date)
const featuredTaskTitle = useMemo(() => {
  const upcoming = projectTasks
    .filter(t => t.end_at)
    .sort((a,b) => new Date(a.end_at) - new Date(b.end_at));
  return upcoming[0]?.title || projectTasks[0]?.title || "—";
}, [projectTasks]);

  // Build a unique color mapping per assignee when projectTasks change
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

  // realtime for selected project → only touches LEFT data
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

  // fetch members + tasks for the selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [rp, rt] = await Promise.all([
          fetch(`${API_BASE}/projects/${selectedProjectId}`),
          fetch(`${API_BASE}/tasks?project_id=${selectedProjectId}`)
        ]);

        const proj = await rp.json();
        if (!rp.ok) throw new Error(proj.error || `Project ${rp.status}`);

        const raw = await rt.json();
        if (!rt.ok) throw new Error(raw.error || `Tasks ${rt.status}`);

        if (cancelled) return;

        const m = {};
        (proj.members || []).forEach(mm => { m[mm._id] = mm; });
        setMembersById(m);

        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.tasks) ? raw.tasks : []);
        setProjectTasks(list);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Failed to load project/tasks");
          setProjectTasks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedProjectId]);

  return (
    <div className="p-6 font-sans bg-white min-h-screen w-full flex">
      {/* LEFT / MAIN PANE */}
      <div className="w-2/3 pr-4">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team&apos;s To-Do</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <span className="text-xl font-bold mr-3" style={{ color: customColor }}>
                Do your task in-time!
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
                style={{ borderColor: customColor, color: customColor }}
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name || "Untitled project"}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Project-wide task list (ALL tasks in the project) */}
        <div className="p-6 rounded-2xl border border-gray-200 shadow-sm bg-white">
          <div className="flex items-center justify-between p-4 w-full max-w-4xl">
  {/* Left: project + a sample task name */}
  <div className="flex flex-col">
    <div className="text-lg font-semibold text-gray-800 mb-2">
      {projectName}
    </div>
    <div className="text-sm text-gray-500 mb-1">
       <p>Task: <span className="font-semibold">{myFeaturedTaskTitle}</span></p>
  
    </div>
  </div>

  {/* Middle: aggregate progress */}
  <div className="flex flex-col items-center justify-center">
    <div className="text-sm text-gray-500 mb-2">Complete</div>
    <div className="w-32 bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
      <div
        className="h-2 rounded-full"
        style={{
          width: `${projectCompletionPct}%`,
          backgroundColor: "#ef4444" // keep your red bar color
        }}
      />
    </div>
    <div className="text-sm text-gray-500">{projectCompletionPct}%</div>
  </div>

  {/* Right: expected completion date + days */}
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


          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : projectTasks.length === 0 ? (
            <div className="text-sm text-gray-500">No tasks in this project.</div>
          ) : (
            <div className="space-y-4">
              {projectTasks.map((t) => {
  const m = membersById[t.assignee_id] || {};
  const pic = m.avatar || m.picture || m.profile?.photo || "";
  const letter = initials(m.name, m.email);

  const pct = percentFromStatus(t.status);  // 0..100 (or 100 if done)
  const isDone = pct === 100;

  return (
    <div key={t._id} className="relative w-full">
      {/* the colored piece itself */}
      <div
        className="rounded-full text-white px-4 py-3 flex items-center gap-3 shadow"
        style={{
          width: `${Math.max(pct, 12)}%`,        // visible even at tiny %
          minWidth: 160,                          // keeps avatar/title readable
          backgroundColor: memberColors[t.assignee_id] || "#888",
          transition: "width 220ms ease",
        }}
        
      >
        {/* avatar/initial */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center ring-2 ring-white/40">
          {pic ? (
            <img src={pic} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{letter}</span>
          )}
        </div>

        {/* title + assignee */}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {t.title}{" "}
            <span className="opacity-90 font-normal">
              — {m.name || m.email || "Member"}
            </span>
          </div>
          <div className="text-xs text-white/90">
            {isDone ? "Completed" : `Progress: ${pct}%`}
          </div>
        </div>

        {/* right status */}
        <div className="ml-auto flex items-center">
          {isDone ? (
            // inline check (no extra lib import)
            <svg viewBox="0 0 20 20" className="w-5 h-5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7.7 13.3L4.9 10.5l-1.4 1.4 4.2 4.2 8-8-1.4-1.4z"
              />
            </svg>
          ) : (
            <span className="text-xs font-semibold">{pct}%</span>
          )}
        </div>
      </div>
    </div>
  );
})}

            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE (UNCHANGED) */}
      <div className="w-1/3 pl-6 border-l border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <img src="1person.jpg" alt="avatar" className="w-10 h-10 rounded-full" />
            <div>
              <div className="font-semibold">{user?.name || user?.email || "User"}</div>
              <div className="text-xs text-gray-500">{user?.email || ""}</div>
            </div>
          </div>
          <FaBell style={{ color: customColor }} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <div
            className={`bg-sky-400 text-white text-center py-2 rounded-xl text-sm ${statusFilter === "todo" ? "bg-opacity-80" : ""}`}
            onClick={() => setStatusFilter("todo")}
          >
            <div className="font-bold text-lg">{progressCount}</div>
            <div>Progress</div>
          </div>
          <div
            className={`bg-indigo-500 text-white text-center py-2 rounded-xl text-sm ${statusFilter === "complete" ? "bg-opacity-80" : ""}`}
            onClick={() => setStatusFilter("complete")}
          >
            <div className="font-bold text-lg">{completeCount}</div>
            <div>Complete</div>
          </div>
        </div>

        <div className="space-y-4 mb-6 max-h-72 overflow-auto pr-1">
          {filteredTasks.length === 0 ? (
            <div className="text-sm text-gray-500 text-center">
              {statusFilter === "todo" ? "No to-do tasks" : "No completed tasks"}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task._id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => handleTaskClick(task._id)}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: memberColors[task.assignee_id] || "#888" }}
                  />
                  <div>
                    <div className="text-sm font-semibold">{task.title}</div>
                    {task.start_at && (
                      <div className="text-xs text-gray-400">
                        Started: {new Date(task.start_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      </div>
                    )}
                  </div>
                </div>
                <FaChevronRight className="text-gray-400 text-xs" />
              </div>
            ))
          )}
        </div>

        {/* Calendar (unchanged structure from your last version) */}
        <div style={{ backgroundColor: customColor }} className="rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <button
              className="px-2 py-1 bg-white/20 rounded flex items-center gap-1"
              onClick={() => { setSelectedDay(null); setSelectedDayTasks([]); setCalMonth(new Date(calYear, calMon - 1, 1)); }}
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
              onClick={() => { setSelectedDay(null); setSelectedDayTasks([]); setCalMonth(new Date(calYear, calMon + 1, 1)); }}
              title="Next month"
            >
              <span className="text-xs">Next</span>
              <FaChevronRight />
            </button>
          </div>

          <div className="mb-2">
            <button
              className="px-2 py-1 bg-white/10 rounded text-xs"
              onClick={() => {
                const now = new Date();
                setSelectedDay(null);
                setSelectedDayTasks([]);
                setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              title="Jump to current month"
            >
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm text-white">
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
              <div key={d} className="font-medium text-xs text-white">{d}</div>
            ))}

            {Array.from({ length: daysInCalMonth }, (_, i) => {
              const day = i + 1;
              const tasksDue = tasksByDay.get(day) || [];
              const hasDue = tasksDue.length > 0;

              const todayPill = isToday(day);

              const style = hasDue
                ? { backgroundColor: "#ef4444", color: "#fff" }
                : (todayPill ? { backgroundColor: "#FDE68A", color: "#111" } : {});

              const titleStr = hasDue
                ? tasksDue.map(t => `${t.title} — ${projectNameById.get(t.project_id) || "Project"}`).join("\n")
                : (todayPill ? "Today" : "");

              return (
                <button
                  key={day}
                  type="button"
                  className="rounded-full p-1 w-8 h-8 mx-auto flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/60"
                  style={style}
                  title={titleStr}
                  onClick={() => {
                    setSelectedDay({ y: calYear, m: calMon, d: day });
                    setSelectedDayTasks(tasksDue);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {selectedDay && selectedDayTasks.length > 0 && (
            <div className="mt-3 bg-white/10 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide mb-2">
                Due {new Date(selectedDay.y, selectedDay.m, selectedDay.d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <ul className="space-y-1">
                {selectedDayTasks.map(t => (
                  <li key={t._id} className="text-sm">
                    <span className="font-semibold">{t.title}</span>
                    <span className="opacity-90"> — {projectNameById.get(t.project_id) || "Project"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedDay && selectedDayTasks.length === 0 && (
            <div className="mt-3 text-xs text-white/80">No deadlines on this day.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Task;
