import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../config";

const TaskAssign = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const projectId =
    searchParams.get("projectId") ||
    (location.state && location.state.projectId) ||
    "";

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [idx, setIdx] = useState(0);

  const [taskTitle, setTaskTitle] = useState("");
  const [startDate, setStartDate] = useState("2025-01-10");
  const [endDate, setEndDate] = useState("2025-01-12");
  const [description, setDescription] = useState("");

  // ✅ NEW: project role per assignee
  const [projectRole, setProjectRole] = useState("");

  const [msg, setMsg] = useState("");

  const leaderId = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u?._id || null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    if (!projectId) {
      setMsg("No project selected. Choose a project first.");
      navigate("/projects");
    }
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/projects/${projectId}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `Failed ${r.status}`);
        setProject(data);
        setMembers(data.members || []);
        // Prefill projectRole from member.position if you want:
        if ((data.members || []).length) {
          setProjectRole(data.members[0].position || "");
        }
      } catch (e) {
        console.error(e);
        setMsg(e.message || "Failed to load project");
      }
    })();
  }, [projectId]);

  const currentMember = members[idx];

  useEffect(() => {
    if (!currentMember) return;
    setTaskTitle("");
    setDescription("");
    // ✅ when moving to next member, prefill role from that member's position
    setProjectRole(currentMember.position || "");
  }, [idx, currentMember?._id]);

  const iso = (d) => (d ? new Date(d).toISOString() : null);

  const saveForCurrent = async () => {
    setMsg("");
    if (!currentMember) return;
    if (!taskTitle.trim()) {
      setMsg("Task title is required");
      return;
    }
    try {
      const payload = {
        project_id: projectId,
        assignee_id: currentMember._id,
        title: taskTitle.trim(),
        description: description.trim(),
        start_at: iso(startDate),
        end_at: iso(endDate),
        created_by: leaderId,
        // ✅ include role in payload
        project_role: projectRole?.trim() || null,
      };
      const r = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Failed ${r.status}`);

      if (idx < members.length - 1) {
        setIdx(idx + 1);
        setMsg("Saved. Next member…");
      } else {
        setMsg("All tasks saved.");
      }
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Server error");
    }
  };

  const finish = () => navigate("/dashboard");

  return (
    <div
      className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2"
      style={{ borderColor: customColor }}
    >
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: customColor }}>
            {project?.name || "Project"}
          </h2>
          <p className="text-sm text-black">Assign task for members in team</p>
        </div>
        <img src="assign.png" alt="icon" className="ml-10 w-18 h-18" />
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600">
          Member {members.length ? idx + 1 : 0} of {members.length}
        </div>
        {currentMember ? (
          <div className="mt-1 font-semibold">
            Assigning to: {currentMember.name || currentMember.email}
          </div>
        ) : (
          <div className="mt-1 text-gray-500">No members to assign.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
            Assign to
          </label>
          <input
            disabled
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2 bg-gray-50"
            value={currentMember ? (currentMember.name || currentMember.email) : ""}
            readOnly
          />
        </div>

        {/* ✅ editable Project Role input */}
        <div>
          <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
            Project Role
          </label>
          <input
            type="text"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2"
            value={projectRole}
            onChange={(e) => setProjectRole(e.target.value)}
            placeholder="e.g., Frontend, QA, Reviewer"
          />
        </div>

        <div>
          <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
            Task Title
          </label>
          <input
            type="text"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2"
            placeholder="e.g., Research payment flow"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
            Start Date
          </label>
          <input
            type="date"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
            End Date
          </label>
          <input
            type="date"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-base font-semibold border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
          Description
        </label>
        <textarea
          className="mt-2 block w-full border border-gray-300 rounded-lg p-2"
          placeholder="Describe the task details"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex justify-between mt-8">
        <button
          className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>

        {idx < members.length - 1 ? (
          <button
            className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
            onClick={saveForCurrent}
          >
            Save Task & Next Member
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
              onClick={saveForCurrent}
            >
              Save Task
            </button>
            <button
              className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:opacity-90 transition"
              onClick={finish}
            >
              Finish
            </button>
          </div>
        )}
      </div>

      {msg && <p className="mt-4 text-center text-red-600">{msg}</p>}
    </div>
  );
};

export default TaskAssign;
