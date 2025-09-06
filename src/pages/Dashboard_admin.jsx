import React, { useEffect, useState, useMemo } from 'react';
import TaskAssign from './task_assign';
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { FiBell } from "react-icons/fi";

import NotificationBell from "../components/NotificationBell";
import Notifications from '../components/Notifications';
NotificationBell

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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
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
const [notifOpen, setNotifOpen] = useState(false);

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

  // notifications (unread count)
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let mounted = true;

    const getUnreadCount = async () => {
      if (!user?._id) { setUnreadCount(0); return; }
      try {
        // Try a dedicated count endpoint first
        const u1 = new URL(`${API_BASE}/notifications/unread_count`);
        u1.searchParams.set("for_user", user._id);
        const r1 = await fetch(u1.toString(), { credentials: "include" });
        if (r1.ok) {
          const j = await r1.json().catch(() => ({}));
          if (mounted) setUnreadCount(Number(j?.count || 0));
          return;
        }
      } catch {}

      try {
        // Fallback: fetch unread items and count them
        const u2 = new URL(`${API_BASE}/notifications`);
        u2.searchParams.set("for_user", user._id);
        u2.searchParams.set("unread", "true");
        const r2 = await fetch(u2.toString(), { credentials: "include" });
        if (r2.ok) {
          const arr = await r2.json().catch(() => []);
          if (mounted) setUnreadCount(Array.isArray(arr) ? arr.length : 0);
          return;
        }
      } catch {}

      try {
        // Last fallback: fetch all and count where read is falsy
        const u3 = new URL(`${API_BASE}/notifications`);
        u3.searchParams.set("for_user", user._id);
        const r3 = await fetch(u3.toString(), { credentials: "include" });
        if (r3.ok) {
          const arr = await r3.json().catch(() => []);
          if (mounted) {
            const n = Array.isArray(arr) ? arr.filter(n => !n.read && !n.seen).length : 0;
            setUnreadCount(n);
          }
          return;
        }
      } catch {}

      if (mounted) setUnreadCount(0);
    };

    getUnreadCount();

    // optional: refresh every 60s
    const id = setInterval(getUnreadCount, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, [user?._id]);

  // helpers used below
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
  const palette = ['#3B82F6','#F59E0B','#10B981','#EF4444','#8B5CF6','#14B8A6','#A855F7','#F97316'];

  // --- load projects (with fallback to /projects) ---
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const primaryUrl = user?._id
          ? `${API_BASE}/projects?for_user=${encodeURIComponent(user._id)}`
          : `${API_BASE}/projects`;

        let r = await fetch(primaryUrl, { credentials: "include" });
        let data = await r.json().catch(() => []);
        let arr = Array.isArray(data) ? data : [];

        if ((!r.ok || arr.length === 0) && user?._id) {
          const rf = await fetch(`${API_BASE}/projects`, { credentials: "include" });
          const df = await rf.json().catch(() => []);
          if (rf.ok && Array.isArray(df)) arr = df;
        }

        arr.forEach(p => { p.progress = Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10); });

        if (mounted) setProjects(arr);
      } catch (e) {
        if (mounted) {
          setProjects([]);
          setProjectsError(e.message || "Failed to load projects");
        }
      } finally {
        if (mounted) setProjectsLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [user?._id]);

  // --- load member profiles for the currently loaded projects ---
  useEffect(() => {
    let mounted = true;
    const toId = (x) => (typeof x === "object" && x && x.$oid) ? x.$oid : String(x || "");
    const ids = [...new Set(
      projects.flatMap(p => Array.isArray(p.member_ids) ? p.member_ids.map(toId) : [])
    )].filter(Boolean);

    const fetchMembers = async () => {
      if (ids.length === 0) {
        if (mounted) setMembersById({});
        return;
      }
      try {
        const url = new URL(`${API_BASE}/users`);
        url.searchParams.set("ids", ids.join(","));
        const ru = await fetch(url.toString(), { credentials: "include" });
        const users = await ru.json().catch(() => []);
        if (mounted) {
          if (ru.ok && Array.isArray(users)) {
            const map = {};
            users.forEach(u => { map[(u?._id?.$oid || u?._id || "").toString()] = u; });
            setMembersById(map);
          } else {
            setMembersById({});
          }
        }
      } catch {
        if (mounted) setMembersById({});
      }
    };

    fetchMembers();
    return () => { mounted = false; };
  }, [projects]);

  // Previous (completed) projects for timeline
  const prevProjects = projects
    .filter(p => String(p.status || "").toLowerCase() === "complete" || Number(p.progress) >= 100)
    .sort((a,b) => new Date(b.end_at || b.updated_at || b.created_at || 0) - new Date(a.end_at || a.updated_at || a.created_at || 0))
    .slice(0, 10);

  const top3Projects = useMemo(() =>
    [...projects]
      .sort((a, b) =>
        new Date(b.end_at || b.updated_at || b.created_at || 0) - new Date(a.end_at || a.updated_at || a.created_at || 0)
      )
      .slice(0, 3)
  , [projects]);

  /* ---------------- Member Workload (OPEN tasks) ---------------- */
  const [workload, setWorkload] = useState([]); // [{assignee_id, name, email, count}]
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [workloadError, setWorkloadError] = useState("");

  useEffect(() => {
    let mounted = true;

    const aggregateFromTasks = async (tasks) => {
      const open = tasks.filter(t => !DONE.has(lowercase(t.status)));
      const counts = new Map();
      for (const t of open) {
        const key = t.assignee_id || "UNASSIGNED";
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      const missing = [...counts.keys()]
        .filter(id => id !== "UNASSIGNED")
        .filter(id => !membersById[id]);

      if (missing.length) {
        try {
          const url = new URL(`${API_BASE}/users`);
          url.searchParams.set("ids", missing.join(","));
          const ru = await fetch(url.toString(), { credentials: "include" });
          const users = await ru.json().catch(() => []);
          if (ru.ok && Array.isArray(users)) {
            const map = { ...membersById };
            users.forEach(u => { map[(u?._id?.$oid || u?._id || "").toString()] = u; });
            if (mounted) setMembersById(map);
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
      if (mounted) setWorkload(rows);
    };

    const loadWorkload = async () => {
      setWorkloadLoading(true);
      setWorkloadError("");

      try {
        const r2 = await fetch(`${API_BASE}/tasks?only_open=true`, { credentials: "include" });
        if (r2.ok) {
          const d2 = await r2.json().catch(() => []);
          const list = Array.isArray(d2) ? d2 : (Array.isArray(d2?.tasks) ? d2.tasks : []);
          await aggregateFromTasks(list);
          setWorkloadLoading(false);
          return;
        }
      } catch {}

      try {
        const results = await Promise.all(
          projects.map(p =>
            fetch(`${API_BASE}/tasks?project_id=${p._id}`, { credentials: "include" })
              .then(res => res.json().catch(() => []))
          )
        );
        const merged = [];
        for (const chunk of results) {
          if (Array.isArray(chunk)) merged.push(...chunk);
          else if (Array.isArray(chunk?.tasks)) merged.push(...chunk.tasks);
        }
        await aggregateFromTasks(merged);
      } catch (e) {
        if (mounted) {
          setWorkload([]);
          setWorkloadError("Failed to load workload data");
        }
      } finally {
        if (mounted) setWorkloadLoading(false);
      }
    };

    loadWorkload();
    return () => { mounted = false; };
  }, [projects]);

  /* ---------------- Donut data under clock (Todo vs Complete only) ---------------- */
  const filteredForDonut = useMemo(() => {
    if (!projects.length) return [];
    return projects;
  }, [projects]);

  const statusSummary = useMemo(() => {
    let complete = 0;
    for (const p of filteredForDonut) {
      const s = lowercase(p.status);
      const prog = Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10) || 0;
      if (DONE.has(s) || prog >= 100) complete++;
    }
    const total = filteredForDonut.length;
    return { todo: Math.max(0, total - complete), complete };
  }, [filteredForDonut]);

  const donutSeries = [statusSummary.todo, statusSummary.complete];
  const donutColors = ["#ec4899", "#10b981"];
  const donutTotal = donutSeries.reduce((a,b)=>a+b,0) || 0;
  const pct = (n) => donutTotal ? Math.round((n / donutTotal) * 100) : 0;

  const overallAvgProgress = useMemo(() => {
    if (!filteredForDonut.length) return 0;
    const sum = filteredForDonut.reduce((acc, p) => acc + (Number.isFinite(p.progress) ? p.progress : parseInt(p.progress ?? 0, 10) || 0), 0);
    return Math.round(sum / filteredForDonut.length);
  }, [filteredForDonut]);

  // Build robust member list for each project (works with member_ids, members, or member_emails)
  const projectMembers = (p) => {
    const toId = (x) => (typeof x === "object" && x && x.$oid) ? x.$oid : String(x || "");
    if (Array.isArray(p.members) && p.members.length) {
      return p.members.map(m => ({
        name: m.name,
        email: m.email,
        picture: m.picture || m.profile?.photo || m.avatar_url || m.avatar || ""
      }));
    }
    if (Array.isArray(p.member_emails) && p.member_emails.length) {
      return p.member_emails.map(em => ({ name: "", email: em, picture: "" }));
    }
    if (Array.isArray(p.member_ids) && p.member_ids.length) {
      const ids = p.member_ids.map(toId);
      return ids
        .map(id => membersById[id])
        .filter(Boolean)
        .map(u => ({
          name: u?.name || "",
          email: u?.email || "",
          picture: u?.picture || u?.profile?.photo || u?.avatar_url || u?.avatar || ""
        }));
    }
    return [];
  };

  const projectMemberFallbackCount = (p) => {
    if (Array.isArray(p.members) && p.members.length) return p.members.length;
    if (Array.isArray(p.member_emails) && p.member_emails.length) return p.member_emails.length;
    if (Array.isArray(p.member_ids) && p.member_ids.length) return p.member_ids.length;
    return 0;
  };

  return (
    <div className="ml-5 w-full">
      {/* Top row: greeting + bell */}
      <div className="mt-2 mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black">Hi, {user?.name || "Admin Name"}</h1>
          <p className="text-sm" style={{ color: customColor }}>Let's finish your task today!</p>
        </div>
        <div className="flex items-center justify-end gap-2 mb-2 relative">
  <NotificationBell currentUserId={user?._id} onOpen={() => setNotifOpen(v => !v)} />
  <Notifications currentUserId={user?._id} open={notifOpen} onClose={() => setNotifOpen(false)} />
</div>

      </div>

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

                  const members = projectMembers(p);
                  const totalMembers = members.length || projectMemberFallbackCount(p);

                  return (
                    <div
                      key={p._id?.$oid || p._id || `p-${idx}`}
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
                        <div className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white/20 text-white">
                          {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                        </div>
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

            {/* ... existing workload list unchanged ... */}
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
                  const widthPct = Math.max(6, Math.round((row.count / (workload.reduce((m, r) => Math.max(m, r.count || 0), 0) || 1)) * 100));
                  const barColor = palette[i % palette.length];

                  return (
                    <div key={row.assignee_id + i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {u?.picture
                          ? <img src={u.picture} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-bold text-gray-700">
                              {(name || email || "?").slice(0,1).toUpperCase()}
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

                <div className="space-y-2">
                  {[0,1].map((i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: donutColors[i] }} />
                        <span className="text-gray-700">{["Todo","Complete"][i]}</span>
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
