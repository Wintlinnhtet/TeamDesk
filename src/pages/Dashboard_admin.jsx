import React, { useEffect, useState, useMemo } from 'react';
import TaskAssign from './task_assign';
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

const DONE = new Set(["done", "complete", "completed", "finished"]);
const lowercase = (s) => (s || "").toLowerCase();

/* ---------- Tiny SVG Donut (no libs) ---------- */
function Donut({ series = [], colors = [], size = 180, thickness = 18, center }) {
  const total = Math.max(0, series.reduce((a, b) => a + (b || 0), 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#e5e7eb" strokeWidth={thickness}
      />
      {/* slices */}
      <g transform={`rotate(-90 ${size/2} ${size/2})`}>
        {series.map((v, i) => {
          if (!v || total === 0) return null;
          const len = (v / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
            />
          );
          acc += len;
          return el;
        })}
      </g>
      {/* center label */}
      {center && (
        <g>
          <text x="50%" y="46%" textAnchor="middle" fontWeight="700" fontSize="20" fill="#111827">
            {center.top}
          </text>
          <text x="50%" y="64%" textAnchor="middle" fontSize="11" fill="#6b7280">
            {center.bottom}
          </text>
        </g>
      )}
    </svg>
  );
}

const Dashboard = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  // live clock
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const formattedTime = currentDate.toLocaleTimeString();
  const formattedDate = currentDate.toLocaleDateString();

  // logged-in user
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const ls = localStorage.getItem("user");
      const ss = sessionStorage.getItem("user");
      const raw = (ls && JSON.parse(ls)) || (ss && JSON.parse(ss)) || null;
      setUser(raw?.user || raw || null);
    } catch {
      setUser(null);
    }
  }, []);

  // projects + members
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [membersById, setMembersById] = useState({});

  useEffect(() => {
    const load = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        // 1) try filtered by user (leader OR member)
        let url = user?._id ? `${API_BASE}/projects?for_user=${user._id}` : `${API_BASE}/projects`;
        let r = await fetch(url);
        let data = await r.json();
        if (!r.ok) throw new Error(data?.error || `Failed to load projects (${r.status})`);
        let arr = Array.isArray(data) ? data : [];

        // 2) fallback to ALL projects if filtered result is empty
        if (arr.length === 0 && user?._id) {
          const rf = await fetch(`${API_BASE}/projects`);
          const df = await rf.json();
          if (rf.ok && Array.isArray(df)) arr = df;
        }

        // normalize progress to number
        arr.forEach(p => { p.progress = Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10); });
        setProjects(arr);

        // fetch member details once (for avatars/labels in Top 3 cards)
        const uniqIds = [...new Set(arr.flatMap(p => (p.member_ids || [])))];
        if (uniqIds.length) {
          const ru = await fetch(`${API_BASE}/users?ids=${encodeURIComponent(uniqIds.join(","))}`);
          const users = await ru.json();
          if (ru.ok && Array.isArray(users)) {
            const map = {};
            users.forEach(u => { map[u._id] = u; });
            setMembersById(map);
          }
        }
      } catch (e) {
        setProjects([]);
        setProjectsError(e.message || "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };

    load();
  }, [user?._id]);

  // helpers
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const daysLeft = (end_at, status, progress) => {
    const done = String(status || "").toLowerCase() === "complete" || Number(progress) >= 100;
    if (done) return "Completed";
    if (!end_at) return "—";
    const end = new Date(end_at).setHours(0,0,0,0);
    const now = new Date().setHours(0,0,0,0);
    const diff = Math.ceil((end - now) / (1000*60*60*24));
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    if (diff === 0) return "Today";
    return `${diff} days left`;
  };
  const colorForIndex = (i) => ['#7C3AED', '#3B82F6', '#F97316', '#10B981', '#EF4444'][i % 5];
  const initials = (name = "", email = "") => {
    const src = (name || "").trim() || (email || "").trim();
    return src ? src[0].toUpperCase() : "?";
  };

  // Previous (completed) projects for timeline
  const prevProjects = projects
    .filter(p => String(p.status || "").toLowerCase() === "complete" || Number(p.progress) >= 100)
    .sort((a,b) => new Date(b.end_at || b.updated_at || b.created_at || 0) - new Date(a.end_at || a.updated_at || a.created_at || 0))
    .slice(0, 10);

  const top3Projects = useMemo(() =>
    [...projects]
      .sort((a, b) =>
        new Date(b.end_at || b.updated_at || b.created_at || 0) -
        new Date(a.end_at || a.updated_at || a.created_at || 0)
      )
      .slice(0, 3)
  , [projects]);

  /* ---------------- Member Workload (OPEN tasks) ---------------- */
  const [workload, setWorkload] = useState([]); // [{assignee_id, name, email, count}]
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [workloadError, setWorkloadError] = useState("");

  useEffect(() => {
    const aggregateFromTasks = async (tasks) => {
      // open ≈ status NOT in DONE
      const open = tasks.filter(t => !DONE.has(lowercase(t.status)));
      const counts = new Map(); // assignee_id -> count
      for (const t of open) {
        const key = t.assignee_id || "UNASSIGNED";
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      // label buckets → fetch missing users
      const missing = [...counts.keys()]
        .filter(id => id !== "UNASSIGNED")
        .filter(id => !membersById[id]);

      if (missing.length) {
        try {
          const ru = await fetch(`${API_BASE}/users?ids=${encodeURIComponent(missing.join(","))}`);
          const users = await ru.json();
          if (ru.ok && Array.isArray(users)) {
            const map = { ...membersById };
            users.forEach(u => { map[u._id] = u; });
            setMembersById(map);
          }
        } catch {}
      }

      const rows = [...counts.entries()].map(([id, count]) => {
        const u = id === "UNASSIGNED" ? null : (membersById[id] || {});
        return {
          assignee_id: id,
          name: u?.name || (id === "UNASSIGNED" ? "Unassigned" : ""),
          email: u?.email || "",
          count
        };
      });

      rows.sort((a,b) => b.count - a.count);
      setWorkload(rows);
    };

    const loadWorkload = async () => {
      setWorkloadLoading(true);
      setWorkloadError("");

      // A: analytics endpoint if present
      try {
        const r = await fetch(`${API_BASE}/analytics/tasks/workload?only_open=true`);
        if (r.ok) {
          const data = await r.json();
          const rows = Array.isArray(data) ? data : [];
          rows.sort((a,b) => b.count - a.count);
          setWorkload(rows);
          setWorkloadLoading(false);
          return;
        }
      } catch {}

      // B: all open tasks endpoint
      try {
        const r2 = await fetch(`${API_BASE}/tasks?only_open=true`);
        if (r2.ok) {
          const d2 = await r2.json();
          const list = Array.isArray(d2) ? d2 : (Array.isArray(d2?.tasks) ? d2.tasks : []);
          await aggregateFromTasks(list);
          setWorkloadLoading(false);
          return;
        }
      } catch {}

      // C: aggregate by project
      try {
        const results = await Promise.all(
          projects.map(p => fetch(`${API_BASE}/tasks?project_id=${p._id}`).then(res => res.json().catch(() => [])))
        );
        const merged = [];
        for (const chunk of results) {
          if (Array.isArray(chunk)) merged.push(...chunk);
          else if (Array.isArray(chunk?.tasks)) merged.push(...chunk.tasks);
        }
        await aggregateFromTasks(merged);
      } catch (e) {
        setWorkload([]);
        setWorkloadError("Failed to load workload data");
      } finally {
        setWorkloadLoading(false);
      }
    };

    if (projects.length >= 0) loadWorkload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, API_BASE]);

  const maxCount = workload.reduce((m, r) => Math.max(m, r.count || 0), 0) || 1;
  const palette = ['#3B82F6','#F59E0B','#10B981','#EF4444','#8B5CF6','#14B8A6','#A855F7','#F97316'];

  /* ---------------- Donut data under clock (Todo vs Complete only) ---------------- */
  const [period, setPeriod] = useState("all"); // kept for future; default "all"
  const filteredForDonut = useMemo(() => {
    if (!projects.length) return [];
    // all time for now
    return projects;
  }, [projects]);

  // Count only two buckets:
  // - complete: status in DONE OR progress >= 100
  // - todo: everything else
  const statusSummary = useMemo(() => {
    let complete = 0;
    for (const p of filteredForDonut) {
      const s = lowercase(p.status);
      const prog = Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10) || 0;
      if (DONE.has(s) || prog >= 100) complete++;
    }
    const total = filteredForDonut.length;
    return {
      todo: Math.max(0, total - complete),
      complete
    };
  }, [filteredForDonut]);

  const donutSeries = [statusSummary.todo, statusSummary.complete];
  const donutColors = ["#ec4899", "#10b981"]; // pink = Todo, green = Complete
  const donutLabels = ["Todo", "Complete"];
  const donutTotal = donutSeries.reduce((a,b)=>a+b,0) || 0;
  const pct = (n) => donutTotal ? Math.round((n / donutTotal) * 100) : 0;

  const overallAvgProgress = useMemo(() => {
    if (!filteredForDonut.length) return 0;
    const sum = filteredForDonut.reduce((acc, p) => acc + (Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10) || 0), 0);
    return Math.round(sum / filteredForDonut.length);
  }, [filteredForDonut]);

  return (
    <div className="ml-5 w-full">
      <h1 className="text-xl font-semibold text-black mt-2">Hi, {user?.name || "Admin Name"}</h1>
      <p className="text-sm" style={{ color: customColor }}>Let's finish your task today!</p>

      <div className="flex">
        {/* LEFT COLUMN */}
        <div className="flex flex-col w-3/4 space-y-4 mr-3">
          <div className="mt-3 shadow-md p-4 rounded-lg flex items-center h-50 bg-white">
            <div className="flex-1">
              <h2 className="text-xl font-bold" style={{ color: customColor }}>Today Task</h2>
              <p className="text-gray-600">Check your daily tasks and schedules</p>
              <button
                className="mt-4 text-white px-4 py-2 rounded-lg shadow-md"
                style={{ backgroundColor: customColor }}
                onClick={() => navigate("/project-create")}
              >
                Create Project
              </button>
            </div>
            <div className="mr-8">
              <img src="admin.png" alt="Task Icon" className="h-40 w-65" />
            </div>
          </div>

          {/* TOP 3 projects */}
          <div className="mt-3">
            {projectsLoading ? (
              <div className="text-sm text-gray-500">Loading projects…</div>
            ) : projectsError ? (
              <div className="text-sm text-red-600">{projectsError}</div>
            ) : top3Projects.length === 0 ? (
              <div className="text-sm text-gray-500">No projects yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {top3Projects.map((p, idx) => {
                  const color = ['#7C3AED', '#3B82F6', '#F97316', '#10B981', '#EF4444'][idx % 5];
                  const dateLabel = (d =>
                    d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"
                  )(p.start_at || p.end_at || p.created_at);
                  const pctVal = Math.max(0, Math.min(100, Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10)));
                  const done = String(p.status || "").toLowerCase() === "complete" || pctVal >= 100;

                  const memberIds = Array.isArray(p.member_ids) ? p.member_ids.slice(0, 2) : [];
                  const mA = membersById[memberIds[0]] || {};
                  const mB = membersById[memberIds[1]] || {};

                  return (
                    <div
                      key={p._id || idx}
                      className="rounded-2xl p-4 shadow-md flex flex-col justify-between h-44"
                      style={{ backgroundColor: customColor }}
                    >
                      <div>
                        <p className="text-xs text-white mb-1">{dateLabel}</p>
                        <h3 className="font-semibold text-md text-white truncate" title={p.name || "Untitled"}>
                          {p.name || "Untitled project"}
                        </h3>
                        <div className="mt-2">
                          <p className="text-xs text-white mb-1">Progress</p>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full" style={{ width: `${pctVal}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-xs text-right mt-1 text-white">{pctVal}%</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2">
                        {/* Members */}
                        <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-white/20 flex items-center justify-center">
                            {mA.picture ? (
                              <img src={mA.picture} alt={mA.name || ""} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-white font-bold">{initials(mA.name, mA.email)}</span>
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-white/20 flex items-center justify-center">
                            {mB.picture ? (
                              <img src={mB.picture} alt={mB.name || ""} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-white font-bold">{initials(mB.name, mB.email)}</span>
                            )}
                          </div>
                        </div>

                        {/* Status pill */}
                        <span
                          className={`text-[10px] px-2 py-1 rounded-lg font-medium ${
                            done ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {done ? "Completed" : "In progress"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* See all projects button */}
            <div className="flex justify-center mt-5">
              <button
                onClick={() => navigate("/allprojects")}
                className="px-5 py-2 rounded-lg text-white font-semibold shadow-md"
                style={{ backgroundColor: customColor }}
              >
                See all projects
              </button>
            </div>
          </div>

          {/* Member workload (bar) */}
          <div className="mt-4 bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold" style={{ color: customColor }}>
                Member workload (open tasks)
              </h3>
            </div>

            {workloadLoading ? (
              <div className="text-sm text-gray-500">Calculating workload…</div>
            ) : workloadError ? (
              <div className="text-sm text-red-600">{workloadError}</div>
            ) : workload.length === 0 ? (
              <div className="text-sm text-gray-500">No open tasks.</div>
            ) : (
              <div className="space-y-3">
                {workload.slice(0, 10).map((row, i) => {
                  const u = row.assignee_id === "UNASSIGNED" ? null : (membersById[row.assignee_id] || {});
                  const name = row.name || u?.name || row.email || (row.assignee_id === "UNASSIGNED" ? "Unassigned" : "—");
                  const email = row.email || u?.email || "";
                  const widthPct = Math.max(6, Math.round((row.count / maxCount) * 100)); // min visual width
                  const barColor = palette[i % palette.length];

                  return (
                    <div key={row.assignee_id + i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {u?.picture
                          ? <img src={u.picture} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-bold text-gray-700">
                              {initials(name, email)}
                            </span>}
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium truncate pr-2">{name}</span>
                          <span className="text-gray-500">{row.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full" style={{ width: `${widthPct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Previous projects + Clock + Donut */}
        <div className="flex flex-col w-1/4 space-y-4 mr-10">
          {/* Previous projects */}
          <div className="p-3 rounded-lg bg-white">
            <div className="mb-2 border p-1 rounded-lg" style={{ border: '2px solid #AA405B' }}>
              <h2 className="text-lg font-bold ml-3" style={{ color: customColor }}>Previous projects</h2>
            </div>

            <div className="w-3/4 mx-auto relative">
              <div className="absolute left-0 bg-gray-300 w-1 h-full top-0 rounded mr-2" />
              {prevProjects.length === 0 ? (
                <div className="text-sm text-gray-500 ml-4">No completed projects yet.</div>
              ) : (
                prevProjects.map((p, index) => (
                  <div key={p._id || index} className="relative flex justify-start mb-3 ml-4">
                    <div
                      className="absolute -left-4 w-5 h-5 rounded-full flex items-center justify-center mt-1 ml-2"
                      style={{ backgroundColor: customColor }}
                      title="Completed"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-black">{p.name || "Untitled project"}</p>
                      <p className="text-xs text-gray-400 mb-2">{fmtDate(p.end_at || p.updated_at || p.created_at)}</p>
                      <div className="w-40 mt-2" style={{ borderBottom: `2px solid ${customColor}` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Clock */}
          <div className="rounded-xl p-2 w-full mb-3 h-50" style={{ backgroundColor: customColor }}>
            <div
              className="p-6 rounded-lg shadow-xl text-white h-45"
              style={{
                backgroundImage: `url('/time.jpg')`,
                backgroundSize: 'contain',
                backgroundPosition: 'center center',
                backgroundAttachment: 'fixed',
              }}
            >
              <div className='flex items-center justify-center h-full'>
                <div className='text-center'>
                  <h2 className="text-2xl font-bold" style={{ color: customColor }}>{formattedDate}</h2>
                  <p className="text-xl font-mono mt-4" style={{ color: customColor }}>{formattedTime}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Donut under clock (Todo vs Complete) */}
          <div className="p-3 rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold ml-1" style={{ color: customColor }}>
                Project status mix
              </h2>
            </div>

            {donutTotal === 0 ? (
              <div className="text-sm text-gray-500">No projects yet.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-center">
                  <Donut
                    series={donutSeries}
                    colors={donutColors}
                    size={190}
                    thickness={20}
                    center={{ top: `${overallAvgProgress}%`, bottom: "OVERALL" }}
                  />
                </div>

                {/* legend */}
                <div className="space-y-2">
                  {[0,1].map((i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: donutColors[i] }} />
                        <span className="text-gray-700">{donutLabels[i]}</span>
                      </div>
                      <div className="text-gray-500">
                        <span className="font-medium mr-2">{donutSeries[i]}</span>
                        <span className="text-xs">{pct(donutSeries[i])}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* End Donut */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
