// src/frontend/components/Projects.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

function readCurrentUser() {
  try {
    const ls = JSON.parse(localStorage.getItem("user") || "null");
    const ss = JSON.parse(sessionStorage.getItem("user") || "null");
    const raw = ls?.user || ls || ss?.user || ss || null;
    if (!raw) return null;
    return {
      id: String(raw._id || raw.id || ""),
      name: String(raw.name || raw.email || ""),
      raw,
    };
  } catch {
    return null;
  }
}

function actorHeaders() {
  const u = readCurrentUser();
  const h = {};
  if (u?.id) h["X-Actor-Id"] = u.id;
  if (u?.name) h["X-Actor-Name"] = u.name;
  return h;
}

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({}); // { [projectId]: { hasTasks: boolean, count: number } }
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  // Helper to read current user for rendering
  const getUser = () => readCurrentUser()?.raw || null;

  // 1) Load projects where the logged-in user is the LEADER
  useEffect(() => {
    (async () => {
      try {
        const user = getUser();
        if (!user?._id) {
          setMsg("Please sign in again.");
          return;
        }

        // 👇 Only projects the current user leads
        const r = await fetch(`${API_BASE}/projects?leader_id=${user._id}`);
        if (!r.ok) {
          const txt = await r.text();
          setMsg(`Failed to load projects (${r.status}): ${txt}`);
          return;
        }
        const data = await r.json();
        const list = Array.isArray(data) ? data : [];
        setProjects(list);

        // 2) For each project, fetch its tasks (to show 'On progress' and count)
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Complete button — sends actor headers + body so admin notification shows the actor
  const markComplete = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Mark "${projectName}" as complete?`)) return;

    const actor = readCurrentUser();
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...actorHeaders(), // X-Actor-Id / X-Actor-Name
        },
        body: JSON.stringify({
          status: "complete",
          progress: 100,
          // also include in body as a fallback for _actor_from_request
          updated_by: actor?.id || null,
          updated_by_name: actor?.name || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status} ${t}`);
      }

      // Optimistic local update (status/progress)
      setProjects((prev) =>
        prev.map((p) =>
          p._id === projectId ? { ...p, status: "complete", progress: "100" } : p
        )
      );
    } catch (err) {
      alert(`Failed to complete project: ${err.message}`);
    }
  };

  // “Assign task” navigation helpers
  const goAssign = (e, projectId, select = false) => {
    e.stopPropagation();
    navigate(
      select
        ? `/assign-task?projectId=${projectId}&mode=select`
        : `/assign-task?projectId=${projectId}` // sequential default
    );
  };

  const goManageTasks = (e, projectId) => {
    e.stopPropagation();
    navigate(`/project-tasks?projectId=${projectId}`);
  };

  const user = getUser();

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-6 text-[#AA405B]">My Projects (Leader)</h2>
      {msg && <p className="text-red-500 mb-4">{msg}</p>}

      {projects.length === 0 ? (
        <div className="text-gray-600">
          You don’t lead any projects yet. Create one in “Create Project” and set yourself as Leader.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const info = stats[p._id] || { hasTasks: false, count: 0 };
            const hasTasks = info.hasTasks;
            const isLeader = p.leader_id === user?._id; // should be true with leader-only fetch

            const statusNorm = String(p.status || "").toLowerCase();
            const isComplete =
              statusNorm === "complete" || statusNorm === "completed" || statusNorm === "done";

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
                  {isComplete ? (
                    <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Completed
                    </span>
                  ) : hasTasks ? (
                    <span className="px-3 py-1 text-xs rounded-full bg-green-300 text-black border border-green-300">
                      On progress
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                      No tasks
                    </span>
                  )}

                  {/* Manage tasks icon (leaders only) */}
                  {isLeader && (
                    <button
                      onClick={(e) => goManageTasks(e, p._id)}
                      className="p-2 rounded hover:bg-gray-100"
                      title="Manage tasks"
                    >
                      {/* pencil icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-5 h-5 text-gray-700"
                      >
                        <path d="M3 14.25V17h2.75l8.1-8.1-2.75-2.75L3 14.25Zm12.71-7.96a.996.996 0 0 0 0-1.41l-1.59-1.59a.996.996 0 1 0-1.41 1.41l1.59 1.59c.39.39 1.02.39 1.41 0Z" />
                      </svg>
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Members: {p.member_ids?.length || 0} • Tasks: {info.count}
                </p>

                <div className="mt-4 flex gap-2">
                  {/* Left: Assign/continue (leaders only) */}
                  {isLeader && (
                    info.count > 0 ? (
                      <button
                        onClick={(e) => goAssign(e, p._id, true)}
                        className="px-4 py-2 rounded bg-[#AA405B] text-white"
                      >
                        Add more tasks
                      </button>
                    ) : (
                      <button
                        onClick={(e) => goAssign(e, p._id)}
                        className="px-4 py-2 rounded bg-[#AA405B] text-white"
                      >
                        Make Task assign
                      </button>
                    )
                  )}

                  {/* Right: Complete/Completed (leaders only) */}
                  {isLeader && (
                    <button
                      onClick={(e) => (isComplete ? e.preventDefault() : markComplete(e, p._id, p.name))}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        isComplete
                          ? "cursor-not-allowed bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-white text-[#AA405B] border-[#AA405B] hover:bg-[#AA405B] hover:text-white"
                      }`}
                      disabled={isComplete}
                      title={isComplete ? "Already completed" : "Mark complete"}
                    >
                      {isComplete ? "Completed" : "Complete"}
                    </button>
                  )}
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
