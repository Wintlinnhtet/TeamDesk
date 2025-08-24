import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const toISO = (yyyy_mm_dd) => (yyyy_mm_dd ? new Date(yyyy_mm_dd).toISOString() : null);

const ProjectTasks= () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState("");

  // edit form
  const [editing, setEditing] = useState(null); // the whole task being edited
  const [form, setForm] = useState({
    assignee_id: "",
    title: "",
    description: "",
    start_at: "",
    end_at: "",
    project_role: "",
  });

  const membersById = useMemo(() => {
    const m = {};
    for (const mem of members) m[mem._id] = mem;
    return m;
  }, [members]);

  const color = "#AA405B";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // 1) fetch project (to get members)
        const rp = await fetch(`${API_BASE}/projects/${projectId}`);
        const proj = await rp.json();
        if (!rp.ok) throw new Error(proj.error || "Failed to load project");
        if (!alive) return;
        setProject(proj);
        setMembers(proj.members || []);

        // 2) fetch tasks for this project
        const rt = await fetch(`${API_BASE}/tasks?project_id=${projectId}`);
        const data = await rt.json();
        if (!rt.ok) throw new Error(data.error || "Failed to load tasks");
        if (!alive) return;
        setTasks(data.tasks || data); // support either {tasks:[]} or []
      } catch (e) {
        setMsg(e.message || "Server error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const startEdit = (t) => {
    setEditing(t);
    setForm({
      assignee_id: t.assignee_id || "",
      title: t.title || "",
      description: t.description || "",
      start_at: toDateInput(t.start_at),
      end_at: toDateInput(t.end_at),
      project_role: t.project_role || "",
    });
    setMsg("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setMsg("");
  };

  const saveEdit = async () => {
    try {
      setMsg("");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.assignee_id) throw new Error("Assignee is required");

      const payload = {
        assignee_id: form.assignee_id,
        title: form.title.trim(),
        description: form.description.trim(),
        start_at: toISO(form.start_at),
        end_at: toISO(form.end_at),
        project_role: form.project_role?.trim() || null,
      };
      const r = await fetch(`${API_BASE}/tasks/${editing._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Update failed (${r.status})`);

      // refresh list (or patch locally)
      setTasks((prev) =>
        prev.map((x) => (x._id === editing._id ? { ...x, ...payload } : x))
      );
      setMsg("Task updated.");
      setEditing(null);
    } catch (e) {
      setMsg(e.message || "Server error");
    }
  };

  const removeTask = async (t) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try {
      const r = await fetch(`${API_BASE}/tasks/${t._id}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Delete failed (${r.status})`);
      setTasks((prev) => prev.filter((x) => x._id !== t._id));
    } catch (e) {
      setMsg(e.message || "Server error");
    }
  };

  if (!projectId) {
    return <div className="p-6">Missing projectId.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color }}>
          {project?.name || "Project"} — Tasks
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/assign-task?projectId=${projectId}&mode=select`)}
            className="px-4 py-2 rounded-lg text-white"
            style={{ background: color }}
          >
            + Add Task
          </button>
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg">
            Back
          </button>
        </div>
      </div>

      {project?.description && (
        <p className="text-sm text-gray-600 mt-1">{project.description}</p>
      )}

      {msg && <p className="mt-4 text-red-600">{msg}</p>}
      {loading ? (
        <p className="mt-8">Loading…</p>
      ) : (
        <>
          {/* Tasks table */}
          <div className="mt-6 overflow-x-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Assignee</th>
                  <th className="text-left px-4 py-3">Start</th>
                  <th className="text-left px-4 py-3">End</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No tasks yet.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => (
                    <tr key={t._id} className="border-t">
                      <td className="px-4 py-3">{t.title}</td>
                      <td className="px-4 py-3">
                        {membersById[t.assignee_id]?.name ||
                          membersById[t.assignee_id]?.email ||
                          t.assignee_id}
                      </td>
                      <td className="px-4 py-3">{toDateInput(t.start_at)}</td>
                      <td className="px-4 py-3">{toDateInput(t.end_at)}</td>
                      <td className="px-4 py-3">{t.project_role || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(t)}
                            className="px-3 py-1 rounded border"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeTask(t)}
                            className="px-3 py-1 rounded text-white bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Edit panel */}
          {editing && (
            <div className="mt-8 border rounded-2xl p-6">
              <h3 className="text-lg font-semibold" style={{ color }}>
                Edit Task
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium">Assignee</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.assignee_id}
                    onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}
                  >
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Project Role</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.project_role}
                    onChange={(e) => setForm((f) => ({ ...f, project_role: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Title</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Start</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">End</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Description</label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full border rounded-lg p-2"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={saveEdit}
                  className="px-5 py-2 rounded-lg text-white"
                  style={{ background: color }}
                >
                  Save changes
                </button>
                <button onClick={cancelEdit} className="px-5 py-2 rounded-lg border">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default ProjectTasks;