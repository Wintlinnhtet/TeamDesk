import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { getCurrentUser } from "../auth";

const DONE = new Set(["done", "complete", "completed", "finished"]);

const Dashboard = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();
  const user = getCurrentUser(); // {_id, name, email, role, ...}

  const [batchmates, setBatchmates] = useState([]);
  const [experience, setExperience] = useState([]);  // from user doc (string or array)
  const [projects, setProjects] = useState([]);      // projects for this user
  const [tasks, setTasks] = useState([]);            // OPEN tasks for this user (not complete)
  const [msg, setMsg] = useState("");

  const initials = (name = "") =>
    name
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  // 1) Fast lookup: projectId -> project
  const projectsById = useMemo(() => {
    const map = {};
    for (const p of projects) map[p._id] = p;
    return map;
  }, [projects]);

  // Only NOT-complete tasks, sorted by start date; show project name
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

  // (Optional) show today's date in the header
  const today = new Date();
  const monthLabel = today.toLocaleString("en-US", { month: "long" });
  const dayLabel = `${today.getDate()}, ${today.toLocaleString("en-US", { weekday: "short" })}`;

  // Normalize experience (can be array or JSON string from backend)
  const normalizedExperience = useMemo(() => {
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

  // Fetch OPEN tasks only (todo + in_progress). Fallback: all then filter.
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
        // de-dupe by _id just in case
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

      // Fallback: one call, then filter client-side
      const rf = await fetch(`${API_BASE}/tasks?assignee_id=${uid}`);
      const df = await rf.json();
      const all = Array.isArray(df) ? df : [];
      const open = all.filter(
        (t) => !DONE.has(String(t.status || "").toLowerCase()) && Number(t.progress || 0) < 100
      );
      setTasks(open);
    } catch {
      // Final fallback: nothing
      setTasks([]);
    }
  };

  // Load user details (experience), projects, and OPEN tasks
  useEffect(() => {
    if (!user?._id) {
      setMsg("Please sign in again.");
      return;
    }
    (async () => {
      try {
        // 1) User doc (experience)
        const uRes = await fetch(`${API_BASE}/get-user/${user._id}`);
        const uData = await uRes.json();
        if (uRes.ok) setExperience(uData.experience ?? []);
        else console.warn("get-user failed:", uData);

        // 2) Projects where I'm leader or member
        const pRes = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
        const pData = await pRes.json();
        if (pRes.ok) setProjects(Array.isArray(pData) ? pData : []);
        else console.warn("projects failed:", pData);

        // 3) OPEN tasks assigned to me
        await loadOpenTasksForUser(user._id);
      } catch (e) {
        console.error(e);
        setMsg("Failed to load dashboard data.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Derive "my role" per project (kept for future use if you show roles anywhere)
  const roleByProject = useMemo(() => {
    const map = {};
    // If you need roles from ANY task (not only open), you may need a separate fetch.
    for (const t of tasks) {
      if (t.project_role && !map[t.project_id]) {
        map[t.project_id] = t.project_role;
      }
    }
    for (const p of projects) {
      const pid = p._id;
      if (!map[pid]) {
        map[pid] = p.leader_id === user?._id ? "Leader" : (user?.position || "Member");
      }
    }
    return map;
  }, [tasks, projects, user?._id, user?.position]);

  // Batchmates from all my projects (unique, exclude me)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!projects?.length) {
          if (!cancelled) setBatchmates([]);
          return;
        }
        const allMembersArrays = await Promise.all(
          projects.map(async (p) => {
            const r = await fetch(`${API_BASE}/projects/${p._id}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `Failed ${r.status}`);
            return Array.isArray(d.members) ? d.members : [];
          })
        );
        const uniq = new Map();
        for (const arr of allMembersArrays) {
          for (const m of arr) {
            if (!m?._id || m._id === user?._id) continue;
            if (!uniq.has(m._id)) {
              uniq.set(m._id, {
                _id: m._id,
                name: m.name || m.email || "Member",
                title: m.position || "Member",
                img: m.avatar || null,
              });
            }
          }
        }
        if (!cancelled) setBatchmates([...uniq.values()]);
      } catch (e) {
        console.error("batchmates load failed:", e);
        if (!cancelled) setBatchmates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, user?._id, API_BASE]);

  return (
    <div className="ml-5 w-full">
      <h1 className="text-xl font-semibold text-black mt-2">
        Hello {user?.name || user?.email || ""}
      </h1>
      <p className="text-sm" style={{ color: customColor }}>
        Let's finish your task today!
      </p>

      {msg && <p className="text-red-500 mt-2">{msg}</p>}

      <div className="flex">
        {/* LEFT COLUMN */}
        <div className="flex flex-col w-3/4 space-y-4 mr-3">
          {/* Today Task Card */}
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

          {/* Previous Experience (ALL entries) */}
          <div className="flex w-full space-x-4 mt-6">
            <div className="w-1/2 bg-white p-4 rounded-xl shadow-md relative">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 ml-8">Previous Experience</h2>
              <div
                className="absolute left-2 top-5 bottom-4 w-0.5 z-0 ml-6"
                style={{ backgroundColor: customColor }}
              />
              {normalizedExperience.length === 0 ? (
                <div className="ml-8 text-gray-500">No experience added.</div>
              ) : (
                <div className="space-y-5 ml-8">
                  {normalizedExperience.map((exp, i) => (
                    <div key={i} className="relative pl-6 z-10">
                      <div
                        className="absolute left-0 top-1 w-3 h-3 rounded-full"
                        style={{ backgroundColor: customColor }}
                      />
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

            {/* Files (demo) */}
            <div className="bg-white rounded-xl p-4 w-1/2 shadow-md flex justify-between items-start">
              <div className="w-3/4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold" style={{ color: customColor }}>
                    File Uploaded <span className="text-sm" style={{ color: customColor }}>(12)</span>
                  </h2>
                </div>
                {[
                  { title: "Colour Theory", date: "01 Feb 2024" },
                  { title: "Design system", date: "01 Feb 2024" },
                  { title: "User persona", date: "13 Mar 2024" },
                  { title: "Prototyping", date: "16 Mar 2024" },
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-start mb-3">
                    <div className="flex items-start space-x-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center mt-1"
                        style={{ backgroundColor: customColor }}
                      >
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">{item.title}</p>
                        <p className="text-xs text-gray-400 mb-2">{item.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-1/4 flex justify-end mt-10 mr-5">
                <img src="file.png" alt="File Icon" className="w-30 h-30 object-contain" />
              </div>
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
                    <div
                      key={t._id}
                      className="flex justify-between p-2 bg-white rounded-lg shadow-md relative"
                    >
                      <div
                        className="absolute left-0 top-0 h-full w-2"
                        style={{ backgroundColor: customColor }}
                      />
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
                    <img src={mate.img} alt={mate.name} className="w-10 h-10 rounded-full object-cover" />
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
            <button
              className="bg-white w-full text-sm font-medium py-1 mt-2 rounded-lg shadow hover:bg-gray-100"
              onClick={() => navigate("/team")}
            >
              See all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
