// src/frontend/components/Projects.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({}); // { [projectId]: { hasTasks: boolean, count: number } }
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  // 1) Load all projects for the current user (leader or member)
  useEffect(() => {
    (async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user?._id) {
          setMsg("Please sign in again.");
          return;
        }
        const r = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
        if (!r.ok) {
          const txt = await r.text();
          setMsg(`Failed to load projects (${r.status}): ${txt}`);
          return;
        }
        const data = await r.json();
        const list = Array.isArray(data) ? data : [];
        setProjects(list);

        // 2) For each project, fetch its tasks to know if it's "On progress"
        //    (no backend changes needed)
        const results = await Promise.all(
          list.map(async (p) => {
            try {
              const tr = await fetch(`${API_BASE}/tasks?project_id=${p._id}`);
              if (!tr.ok) return [p._id, { hasTasks: false, count: 0 }];
              const tasks = await tr.json().catch(() => []);
              const count = Array.isArray(tasks) ? tasks.length : 0;
              return [p._id, { hasTasks: count > 0, count }];
            } catch {
              return [p._id, { hasTasks: false, count: 0 }];
            }
          })
        );

        const map = {};
        results.forEach(([pid, info]) => (map[pid] = info));
        setStats(map);
      } catch (e) {
        console.error(e);
        setMsg("Server error while fetching projects.");
      }
    })();
  }, []);

  // Optional: Complete button handler (UI only unless you add a backend route)
  const markComplete = async (e, projectId) => {
    e.stopPropagation(); // don’t trigger the card’s onClick
    // If you add a backend later (e.g., PATCH /projects/:id/complete),
    // wire it up here. For now we just show a toast-like message.
    alert(`(TODO) Mark project ${projectId} as complete.\nAdd a backend route to persist this.`);
  };

  const goAssign = (e, projectId, select = false) => {
   e.stopPropagation();
   navigate(
     select
       ? `/assign-task?projectId=${projectId}&mode=select`
       : `/assign-task?projectId=${projectId}` // sequential default
   );
 };

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-6 text-[#AA405B]">Projects</h2>
      {msg && <p className="text-red-500 mb-4">{msg}</p>}

      {projects.length === 0 ? (
        <div className="text-gray-600">
          No projects yet for you. Create one in “Create Project” and be sure to set a Leader.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const info = stats[p._id] || { hasTasks: false, count: 0 };
            const hasTasks = info.hasTasks;
            return (
              <div
                key={p._id}
                className="border-2 rounded-xl shadow-md p-4 hover:shadow-lg transition cursor-pointer"
                style={{ borderColor: "#AA405B" }}
                onClick={() => navigate(`/assign-task?projectId=${p._id}`)}
                title="Open project"
              >
                <div className="flex items-start justify-between">
                  <div className="pr-3">
                    <h3 className="text-lg font-semibold text-[#AA405B]">{p.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  </div>



                  {/* Status badge */}
                  {hasTasks ? (
                    <span className="px-3 py-1 text-xs rounded-full bg-green-300 text-black border border-green-300">
                      On progress
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                      No tasks
                    </span>
                  )}

                                    {/* Edit/Manage tasks icon */}
 <button
   onClick={(e) => {
     e.stopPropagation();
     navigate(`/project-tasks?projectId=${p._id}`);
   }}
   className="p-2 rounded hover:bg-gray-100"
   title="Manage tasks"
 >
   {/* simple pencil icon (SVG) */}
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-700">
     <path d="M3 14.25V17h2.75l8.1-8.1-2.75-2.75L3 14.25Zm12.71-7.96a.996.996 0 0 0 0-1.41l-1.59-1.59a.996.996 0 1 0-1.41 1.41l1.59 1.59c.39.39 1.02.39 1.41 0Z" />
   </svg>
 </button>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Members: {p.member_ids?.length || 0} • Tasks: {info.count}
                </p>

                <div className="mt-4 flex gap-2">
                  {/* Left: assign/continue button */}
                   {stats[p._id]?.count > 0 ? (
  // Project ALREADY has tasks → "Add more tasks" goes to SELECT mode
   <button
     onClick={(e) => goAssign(e, p._id, true)}
     className="px-4 py-2 rounded bg-[#AA405B] text-white"
   >
     Add more tasks
   </button>
 ) : (
   // Project has NO tasks → start sequential flow (no mode param)
   <button
     onClick={(e) => goAssign(e, p._id)}
     className="px-4 py-2 rounded bg-[#AA405B] text-white"
   >
     Make Task assign
   </button>
 )}

                  {/* Right: complete button (UI only unless backend added) */}
                  <button
                    onClick={(e) => markComplete(e, p._id)}
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: "#AA405B", color: "#AA405B" }}
                    title="Mark complete (requires backend route to persist)"
                  >
                    Complete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
