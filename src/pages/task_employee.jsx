import React from "react";
 import { FaSearch, FaBell, FaChevronRight, FaChevronLeft } from "react-icons/fa";
 import { useEffect, useMemo, useState } from "react";
 import { API_BASE } from "../config";
import { useParams, useNavigate } from "react-router-dom";
import useRealtime from "../hooks/useRealtime";
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
const navigate = useNavigate(); 
const [statusFilter, setStatusFilter] = useState("todo");  // "todo" or "complete"
const handleStatusChange = (status) => {
    setStatusFilter(status);
};
const filteredTasks = useMemo(() => {
    return myTasks.filter((task) => {
        const taskStatus = task.status.toLowerCase();
        const todoPattern = /^todo,\d+$/;  // regex to match "todo, followed by a number"

        if (statusFilter === "todo") {
            // Match "todo" status or "todo,<any number>"
            return taskStatus === "todo" || todoPattern.test(taskStatus);
        } else if (statusFilter === "complete") {
            return DONE.has(taskStatus);  // check if task is marked as complete
        }
        return false;
    });
}, [myTasks, statusFilter]);
 // realtime
 const sockRef = useRealtime(selectedProjectId, {
   onCreated: (t) => {
     // if it's for this project, update the bars immediately
     if (t.project_id === selectedProjectId) {
      setBars(prev => {
         // compute a single bar for this new task
         const weekStart = startOfTuesdayWeek(new Date());
         const weekEnd   = addDays(weekStart, 6);
         const start = new Date(t.start_at || t.created_at || new Date().toISOString());
         const end   = new Date(t.end_at || t.start_at || start);
         const clampedStart = start < weekStart ? weekStart : start;
         const clampedEnd   = end   > weekEnd   ? weekEnd   : end;
         const startIndex = clamp(daysBetween(startOfDay(clampedStart), weekStart), 0, 6);
         const endIndex   = clamp(daysBetween(endOfDay(clampedEnd),   weekStart), 0, 6) + 1;
         const assignee = membersById[t.assignee_id] || {};
         const bar = {
           _id: t._id,
           name: t.title,
           user: assignee.name || assignee.email || "Member",
           color: colorFor(t.assignee_id),
           startPx: startIndex * SLOT_PX,
           widthPx: Math.max((endIndex - startIndex) * SLOT_PX, SLOT_PX),
         };
         // avoid duplicates
         return prev.some(b => b._id === bar._id) ? prev : [...prev, bar];
       });
     }
     // if this user is the assignee, reflect it in myTasks
     if (t.assignee_id === user?._id) {
       setMyTasks(prev => prev.some(x => x._id === t._id) ? prev : [t, ...prev]);
       const done = (t.status || "").toLowerCase() === "completed";
       setCompleteCount(c => c + (done ? 1 : 0));
       setProgressCount(c => c + (done ? 0 : 1));
     }
   },
   onUpdated: (patch) => {
     // patch bars
     setBars(prev => prev.map(b => b._id === patch._id
       ? { ...b, name: patch.title ?? b.name }
       : b
     ));
     // patch myTasks
     setMyTasks(prev => prev.map(t => t._id === patch._id ? { ...t, ...patch } : t));
   },
   onDeleted: ({ _id, project_id }) => {
     if (project_id === selectedProjectId) setBars(prev => prev.filter(b => b._id !== _id));
     setMyTasks(prev => prev.filter(t => t._id !== _id));
   }
 });

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
  if (!selectedProjectId) return; // Exit if no project selected

  let cancelled = false; // To avoid updating the state if the component is unmounted

  (async () => {
    try {
      setLoading(true);
      setErr("");  // Reset error state

      // Fetch project details and tasks in parallel
      const [rp, rt] = await Promise.all([
        fetch(`${API_BASE}/projects/${selectedProjectId}`),
        fetch(`${API_BASE}/tasks?project_id=${selectedProjectId}`) // Fetch tasks for the selected project
      ]);

      // Parse project data
      const proj = await rp.json();
      if (!rp.ok) throw new Error(proj.error || `Project fetch failed with status: ${rp.status}`);

      // Parse tasks data
      const rawTasks = await rt.json();
      if (!rt.ok) throw new Error(rawTasks.error || `Tasks fetch failed with status: ${rt.status}`);

      console.log("Fetched tasks:", rawTasks);  // Check what tasks are returned

      // Create a mapping of members by their ID (to easily fetch member details)
      const membersMap = {};
      proj.members?.forEach((member) => {
        membersMap[member._id] = member;
      });

      if (cancelled) return; // If the effect was cancelled, do not update the state

      setMembersById(membersMap); // Update members state

      // Normalize tasks (ensure it's an array of tasks)
      const taskList = Array.isArray(rawTasks) ? rawTasks : (Array.isArray(rawTasks?.tasks) ? rawTasks.tasks : []);

      // Map tasks into bars for the calendar view
      const weekStart = startOfTuesdayWeek(new Date());
      const weekEnd = addDays(weekStart, 6);  // End of the week (Monday)

      // Compute the task bars (week view)
      const computedBars = taskList
        .filter(t => t.title) // Only include tasks with a title
        .map((task) => {
          const start = new Date(task.start_at || task.created_at || new Date().toISOString());
          const end = new Date(task.end_at || task.start_at || start);

          // Clamp task's start and end to the current week's Tuesday-Monday
          const clampedStart = start < weekStart ? weekStart : start;
          const clampedEnd = end > weekEnd ? weekEnd : end;

          const startIndex = clamp(daysBetween(startOfDay(clampedStart), weekStart), 0, 6);
          const endIndex = clamp(daysBetween(endOfDay(clampedEnd), weekStart), 0, 6) + 1; // Exclusive

          const assignee = membersMap[task.assignee_id] || membersById[task.assignee_id] || {};

          return {
            _id: task._id,
            name: task.title,
            user: assignee.name || assignee.email || "Member",
            color: colorFor(task.assignee_id),
            startPx: startIndex * SLOT_PX,
            widthPx: Math.max((endIndex - startIndex) * SLOT_PX, SLOT_PX),
          };
        });

      console.log("Computed task bars:", computedBars);  // Log the computed bars to verify they include both tasks

      if (!cancelled) {
        setBars(computedBars); // Update task bars state
      }

    } catch (e) {
      if (!cancelled) {
        setErr(e.message || "Failed to load tasks");
        setBars([]);  // Reset tasks state if fetching fails
        setLoading(false);  // End loading state
      }
    } finally {
      if (!cancelled) setLoading(false); // End loading state
    }
  })();

  return () => { cancelled = true; }; // Cleanup to prevent state updates after component unmounts
}, [selectedProjectId]); // Only re-run when the selectedProjectId changes

 // Load tasks (the logic you already have)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const r = await fetch(`${API_BASE}/tasks?assignee_id=${user._id}`);
        const data = await r.json();
        setMyTasks(data.tasks || []);
      } catch (e) {
        setMyTasks([]);
      }
    };

    fetchTasks();
  }, [user?._id]);
 const handleTaskClick = (taskId) => {
    // Navigate to task detail page with the taskId
    navigate(`/task-detail/${taskId}`);
  };

    // dynamic week header (still Tue→Mon like your design)
    const weekStart = useMemo(() => startOfTuesdayWeek(new Date()), []);
    
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
   <div className="flex items-center justify-between p-4 w-full max-w-4xl">
      {/* Left Section: Order, Agent, Task */}
      <div className="flex flex-col">
        <div className="text-lg font-semibold text-gray-800 mb-2">Order 1</div>
        <div className="text-sm text-gray-500 mb-1">
          <p>Agent: <span className="font-semibold">Sample Agent</span></p>
          <p>Task: <span className="font-semibold">Buy Property</span></p>
        </div>
      </div>

      {/* Middle Section: Progress Bar */}
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-gray-500 mb-2">Complete</div>
        <div className="w-32 bg-gray-200 rounded-full h-2 mb-2">
          <div className="bg-red-400 h-2 rounded-full" style={{ width: "45%" }}></div>
        </div>
        <div className="text-sm text-gray-500">45%</div>
      </div>

      {/* Right Section: Expected Completion */}
      <div className="flex flex-col items-end">
        <div className="text-sm text-gray-500">Expected Completion</div>
        <div className="text-lg font-semibold text-gray-800">Oct 12, 2019</div>
        <div className="text-xs text-gray-400">15 Days</div>
      </div>
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
    <div
        className={`bg-sky-400 text-white text-center py-2 rounded-xl text-sm ${statusFilter === "todo" ? "bg-opacity-80" : ""}`}
        onClick={() => handleStatusChange("todo")}
    >
        <div className="font-bold text-lg">{progressCount}</div>
        <div>Progress</div>
    </div>
    <div
        className={`bg-indigo-500 text-white text-center py-2 rounded-xl text-sm ${statusFilter === "complete" ? "bg-opacity-80" : ""}`}
        onClick={() => handleStatusChange("complete")}
    >
        <div className="font-bold text-lg">{completeCount}</div>
        <div>Complete</div>
    </div>
</div>

<div className="space-y-4 mb-6 max-h-72 overflow-auto pr-1">
    {/* Render tasks based on status */}
    {filteredTasks.length === 0 ? (
        <div className="text-sm text-gray-500 text-center">
            {statusFilter === "todo" ? "No to-do tasks" : "No completed tasks"}
        </div>
    ) : (
        filteredTasks.map((task) => (
            <div
                key={task._id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => handleTaskClick(task._id)} // Click handler for task
            >
                <div className="flex items-center space-x-2">
                    <div className={`w-5 h-5 ${colorFor(task.assignee_id)} rounded-full`} />
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
