import React from "react";
 import { FaSearch, FaBell, FaChevronRight, FaChevronLeft } from "react-icons/fa";
 import { useEffect, useMemo, useState } from "react";
 import { API_BASE } from "../config";

 const initials = (name = "") =>
   name
     .trim()
     .split(/\s+/)
     .map(s => s[0])
     .slice(0, 2)
     .join("")
     .toUpperCase();
// deterministic color per assignee
const PALETTE = [
  "bg-teal-400","bg-rose-400","bg-pink-200","bg-sky-400","bg-orange-300",
  "bg-indigo-500","bg-emerald-500","bg-violet-400","bg-amber-400"
];
const hash = (s="") => [...s].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0);
const colorFor = (id="") => PALETTE[Math.abs(hash(id)) % PALETTE.length];

// Tuesday-start week: Tue, Wed, Thu, Fri, Sat, Sun, Mon (matches your UI)
const startOfTuesdayWeek = (d0=new Date()) => {
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const dow = d.getDay();                 // 0..6 (Sun..Sat)
  const offset = (dow - 2 + 7) % 7;       // back to Tuesday
  d.setDate(d.getDate() - offset);
  d.setHours(0,0,0,0);
  return d;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const daysBetween = (a,b) => Math.floor((a-b)/(1000*60*60*24));

 const SLOT_PX = 300;            // width of one day column (make bars longer)
 const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
 const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
// helpers for status grouping
const sk = (x = "") => (x || "").toLowerCase();
const DONE = new Set(["done", "complete", "completed", "finished"]);

const Task = () => {
     const customColor = "#AA405B";
  const days = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
   const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [membersById, setMembersById] = useState({});
    const [bars, setBars] = useState([]);         // ← replaces static tasks
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
 const [myTasks, setMyTasks] = useState([]);              // all tasks assigned to me (across projects)
 const [progressCount, setProgressCount] = useState(0);
 const [completeCount, setCompleteCount] = useState(0);

 // Live calendar month (current)
 const [calMonth, setCalMonth] = useState(() => new Date());
    // who am I?
    useEffect(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("user")) || JSON.parse(sessionStorage.getItem("user"));
        setUser(stored?.user || stored || null);
      } catch { setUser(null); }
    }, []);

    // my projects
    useEffect(() => {
      if (!user?._id) return;
      (async () => {
        try {
          const r = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
          const list = await r.json();
          if (!r.ok) throw new Error(list.error || `Projects ${r.status}`);
          setProjects(list);
          if (!selectedProjectId && list.length) setSelectedProjectId(list[0]._id);
        } catch (e) { setErr(e.message || "Failed to load projects"); }
      })();
    }, [user?._id]);

    // details for selected project (members) + its tasks → transform into bars
    useEffect(() => {
      if (!selectedProjectId) return;
      let cancelled = false;
      (async () => {
        try {
          setLoading(true); setErr("");
          const [rp, rt] = await Promise.all([
            fetch(`${API_BASE}/projects/${selectedProjectId}`),
            fetch(`${API_BASE}/tasks?project_id=${selectedProjectId}`)
          ]);
          const proj = await rp.json();  if (!rp.ok) throw new Error(proj.error || `Project ${rp.status}`);
          const rawTasks = await rt.json(); if (!rt.ok) throw new Error(rawTasks.error || `Tasks ${rt.status}`);

          const m = {};
          for (const mem of (proj.members || [])) m[mem._id] = mem; // name, email, position
          if (cancelled) return;
          setMembersById(m);

          // Build this-week bars to fit your existing width/margin math (6..12 slots)
          // Normalize payload shape
         const list = Array.isArray(rawTasks)
            ? rawTasks
            : (Array.isArray(rawTasks?.tasks) ? rawTasks.tasks : []);

          // Map ALL tasks into this week's strip, clamping to Tue→Mon
          const weekStart = startOfTuesdayWeek(new Date());
          const weekEnd = addDays(weekStart, 6);

        const computed = list
            .filter(t => t.title)
            .map(t => {
              const s0 = t.start_at || t.created_at || new Date().toISOString();
              const e0 = t.end_at   || t.start_at   || s0;
              const s  = new Date(s0);
              const e  = new Date(e0);

              // Clamp to current Tue→Mon, but measure inclusively:
              const cs = s < weekStart ? weekStart : s;
              const ce = e > weekEnd   ? weekEnd   : e;
              const si = clamp(daysBetween(startOfDay(cs), weekStart), 0, 6); // 0..6
              const ei = clamp(daysBetween(endOfDay(ce),   weekStart), 0, 6); // 0..6 (inclusive)

              const startIndex = si;         // inclusive
              const endIndex   = ei + 1;     // exclusive → ensures multi-day bars stretch
              const assignee   = m[t.assignee_id] || membersById[t.assignee_id] || {};

              return {
                _id: t._id,
                name: t.title,
                user: assignee.name || assignee.email || "Member",
                color: colorFor(t.assignee_id),
                // precompute exact pixels so the JSX stays clean
                startPx: startIndex * SLOT_PX,
                widthPx: Math.max((endIndex - startIndex) * SLOT_PX, SLOT_PX), // at least 1 day wide
              };
            });
          if (!cancelled) setBars(computed);
        } catch (e) {
          if (!cancelled) { setErr(e.message || "Failed to load tasks"); setBars([]); }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [selectedProjectId]);

    // dynamic week header (still Tue→Mon like your design)
    const weekStart = useMemo(() => startOfTuesdayWeek(new Date()), []);
    const dayCells = useMemo(() =>
      Array.from({length: 7}, (_,i) => {
        const d = addDays(weekStart, i);
        return { label: d.toLocaleString("en-US",{weekday:"short"}), num: d.getDate() };
      }), [weekStart]
    );
    // helpers for status grouping (declare BEFORE using them)

const todoTasksAll = useMemo(
  () =>
    myTasks
      .filter(t => (t.status || "").toLowerCase() === "todo")
      .sort(
        (a, b) =>
          Date.parse(b.start_at || b.created_at || 0) -
          Date.parse(a.start_at || a.created_at || 0)
      ),
  [myTasks]
);

const progressTasksAll = useMemo(
  () =>
    myTasks
      .filter(t => !DONE.has(sk(t.status))) // anything not done = in progress
      .sort(
        (a, b) =>
          Date.parse(b.start_at || b.created_at || 0) -
          Date.parse(a.start_at || a.created_at || 0)
      ),
  [myTasks]
);

const completedTasksAll = useMemo(
  () =>
    myTasks
      .filter(t => DONE.has(sk(t.status)))
      .sort(
        (a, b) =>
          Date.parse(b.end_at || b.updated_at || 0) -
          Date.parse(a.end_at || a.updated_at || 0)
      ),
  [myTasks]
);

     // Load MY tasks across all projects I participate in
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
     } catch (e) {
       setMyTasks([]);
       setProgressCount(0);
       setCompleteCount(0);
     }
   })();
 }, [user?._id]);


 // Calendar (days of current month) & which days have my tasks
 const calYear  = calMonth.getFullYear();
 const calMon   = calMonth.getMonth();
 const daysInCalMonth = new Date(calYear, calMon + 1, 0).getDate();
 const today = new Date();
 const isToday = (d) => d === today.getDate() && calMon === today.getMonth() && calYear === today.getFullYear();
// Only mark deadline day (prefer end_at, else start_at, else created_at)
const deadlineDays = useMemo(() => {
  const set = new Set();
  for (const t of myTasks) {
    const d0 = t.end_at || t.start_at || t.created_at;
    if (!d0) continue;
    const d = new Date(d0);
    if (d.getFullYear() === calYear && d.getMonth() === calMon) {
      set.add(d.getDate());
    }
  }
  return set;
}, [myTasks, calYear, calMon]);

 // helpers for status grouping


  return (
    <div className="p-6 font-sans bg-white min-h-screen w-full flex">
      <div className="w-2/3 pr-4">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team's To-Do</h1>
          <div className="flex items-center space-x-4">
           
            <div className="relative">
       <span className="text-xl font-bold mr-3" style={{ color: customColor }}>
         Do your task in-time!
       </span>
       {/* Project selector */}
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
<div className="p-4 rounded-xl border border-gray-200 shadow-sm bg-white" >
        <div className="mb-2 text-sm text-gray-600">
  {weekStart.toLocaleString("en-US", { month: "long" })} {weekStart.getFullYear()}
 </div>
       <div className="flex space-x-6 items-center mb-4 justify-center">
   {dayCells.map((d, index) => (
     <div
       key={index}
       className={`text-center ${index === 4 ? "text-white rounded-full px-3 py-1" : "text-gray-600"}`}
       style={index === 4 ? { backgroundColor: customColor } : {}}
     >
       <div className="text-sm font-semibold">{d.num}</div>
       <div className="text-xs">{d.label}</div>
     </div>
   ))}
 </div> 

       <div className="flex justify-center w-full mt-9">
   <div className="relative w-2/3">
     {/* vertical guides per day */}
     <div className="pointer-events-none absolute inset-0 flex">
       {Array.from({length:7}).map((_,i)=>(
         <div key={i} className="border-l border-gray-200" style={{ width: SLOT_PX }} />
       ))}
     </div>
     <div className="space-y-3 relative">
             {bars.map((task, index) => (
              <div
                key={index}
                className={`rounded-full text-white px-4 py-2 flex items-center ${task.color}`}
                 style={{
  width: `${task.widthPx}px`,
   marginLeft: `${task.startPx}px`,
 }}
              >
                <div className="flex items-center space-x-2">
  <div className="w-7 h-7 rounded-full overflow-hidden">
    <img
      src="2person.jpg"
      alt="profile"
      className="w-full h-full object-cover"
    />
  </div>
         <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
         {task.name}
         <span className="opacity-90 font-normal"> — {task.user}</span>
       </span>
</div>

              </div>
            ))}
          </div>
        </div>
        </div>
        
      </div>
      </div>

      <div className="w-1/3 pl-6 border-l border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <img
              src="1person.jpg"
              alt="avatar"
              className="w-10 h-10 rounded-full"
            />
            <div>
             <div className="font-semibold">{user?.name || user?.email || "User"}</div>         <div className="text-xs text-gray-500">{user?.email || ""}</div>
            </div>
          </div>
          <FaBell className=""style={{ color: customColor }} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          
          <div className="bg-sky-400 text-white text-center py-2 rounded-xl text-sm">
            <div className="font-bold text-lg">{progressCount}</div>
            <div>Progress</div>
          </div>
          <div className="bg-indigo-500 text-white text-center py-2 rounded-xl text-sm">
            <div className="font-bold text-lg">{completeCount}</div>
            <div>Complete</div>
          </div>
        </div>
 <div className="space-y-4 mb-6 max-h-72 overflow-auto pr-1">
 {/* To-do — ALL */}
 {todoTasksAll.length === 0 ? (
   <div className="text-sm text-gray-500 text-center">No to-do tasks</div>
 ) : (
   todoTasksAll.map((t) => (
      <div key={t._id} className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-5 h-5 ${colorFor(t.assignee_id)} rounded-full`} />
          <div>
            <div className="text-sm font-semibold">{t.title}</div>
            {t.start_at && (
              <div className="text-xs text-gray-400">
                Started: {new Date(t.start_at).toLocaleDateString(undefined, { day:"2-digit", month:"short" })}
              </div>
            )}
          </div>
        </div>
        <FaChevronRight className="text-gray-400 text-xs" />
      </div>
    ))
  )}

  {/* Completed — ALL */}
  {completedTasksAll.length === 0 ? (
    <div className="text-sm text-gray-500 text-center">No completed tasks</div>
  ) : (
    completedTasksAll.map((t) => {
      const dateTxt = t.end_at
        ? new Date(t.end_at).toLocaleDateString(undefined, { day:"2-digit", month:"short" })
        : (t.updated_at ? new Date(t.updated_at).toLocaleDateString(undefined, { day:"2-digit", month:"short" }) : "");
      return (
        <div key={t._id} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-5 h-5 ${colorFor(t.assignee_id)} rounded-full`} />
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              {dateTxt && <div className="text-xs text-gray-400">Completed: {dateTxt}</div>}
            </div>
          </div>
          <FaChevronRight className="text-gray-400 text-xs" />
        </div>
      );
    })
  )}
</div>
 
        
{/* Active, live calendar (current month) */}
   <div style={{ backgroundColor: customColor }} className="rounded-xl p-4 text-white">
     <div className="flex items-center justify-between mb-2">
    <button
      className="px-2 py-1 bg-white/20 rounded flex items-center gap-1"
      onClick={() => setCalMonth(new Date(calYear, calMon - 1, 1))}
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
      onClick={() => setCalMonth(new Date(calYear, calMon + 1, 1))}
      title="Next month"
    >
      <span className="text-xs">Next</span>
      <FaChevronRight />
    </button>
  </div>
  <div className="mb-2">
    <button
      className="px-2 py-1 bg-white/10 rounded text-xs"
      onClick={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
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
  const isDeadline = deadlineDays.has(day);
  const todayMark = isToday(day);
  const style = todayMark
    ? { backgroundColor: "#FDE68A", color: "#111" }      // today: yellow pill
    : (isDeadline ? { backgroundColor: "white", color: "#111" } : {}); // deadline: white pill
  return (
    <div
      key={day}
      className="rounded-full p-1"
      style={style}
      title={isDeadline ? "Deadline" : ""}
    >
      {day}
    </div>
  );
})}

     </div>
   </div>

      </div>
    </div>
  );
};

export default Task;
