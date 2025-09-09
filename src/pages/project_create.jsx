import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";
import { useNavigate } from "react-router-dom";

const ProjectCreate = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  const isEdit = Boolean(projectId);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  const [allMembers, setAllMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(isEdit);

  useEffect(() => {
    (async () => {
      try {
        const url = isEdit
          ? `${API_BASE}/members?exclude_project=${encodeURIComponent(projectId)}`
          : `${API_BASE}/members`;
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) {
          setAllMembers([]);
          return;
        }
        const data = await r.json();
        setAllMembers(Array.isArray(data) ? data : []);
      } catch {
        setAllMembers([]);
      }
    })();
  }, [API_BASE, isEdit, projectId]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoadingInit(true);
        const r = await fetch(`${API_BASE}/projects/${projectId}`, { credentials: "include" });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          setMsg(`Failed to load project (${r.status}) ${t}`);
          setLoadingInit(false);
          return;
        }
        const p = await r.json();

        setProjectName(p.name || "");
        setDescription(p.description || "");
        setLeaderId(p.leader_id || "");

        const toParts = (iso) => {
          if (!iso) return { d: "", t: "" };
          const dt = new Date(iso);
          const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          const t = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
          return { d, t };
        };
        const s = toParts(p.start_at);
        const e = toParts(p.end_at);
        setStartDate(s.d); setStartTime(s.t);
        setEndDate(e.d); setEndTime(e.t);

        const preselected = Array.isArray(p.members)
          ? p.members.map((m) => ({
              _id: m._id,
              name: m.name || "",
              email: m.email || "",
              label: m.name || m.email || "(no name)",
              avatar: null,
            }))
          : [];
        setSelectedMembers(preselected);
      } catch (e) {
        setMsg(`Failed to load project: ${e.message}`);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, [API_BASE, isEdit, projectId]);

  const memberOptions = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((m) => m._id));
    return (allMembers || [])
      .filter((m) => !selectedIds.has(m._id))
      .map((m) => ({
        _id: m._id,
        label: m.name && m.name.trim().length ? m.name : (m.email || "(no name)"),
        email: m.email || "",
        name: m.name || "",
        avatar: m.avatar || null,
      }));
  }, [allMembers, selectedMembers]);

  const addEmployee = () => {
    setMsg("");
    if (!selectedMemberId) {
      setMsg("Please choose a member from the list.");
      return;
    }
    const picked = memberOptions.find((m) => m._id === selectedMemberId);
    if (!picked) {
      setMsg("Selected member not found.");
      return;
    }
    setSelectedMembers((prev) => [...prev, picked]);
    setSelectedMemberId("");
  };

  const removeMember = (id) => {
    setSelectedMembers((prev) => prev.filter((m) => m._id !== id));
    setLeaderId((prevLeader) => (prevLeader === id ? "" : prevLeader));
  };

  const isoCombine = (d, t) => {
    if (!d && !t) return null;
    if (!d) return null;
    const [y, mo, da] = d.split("-").map(Number);
    let hh = 0, mm = 0;
    if (t) {
      const parts = t.split(":").map(Number);
      hh = parts[0] ?? 0;
      mm = parts[1] ?? 0;
    }
    const dt = new Date(y, mo - 1, da, hh, mm, 0);
    return dt.toISOString();
  };

  const onSave = async () => {
    setMsg("");
    if (!projectName.trim()) {
      setMsg("Project name is required.");
      return;
    }
    if (selectedMembers.length === 0) {
      setMsg("Please add at least one member.");
      return;
    }

    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      member_ids: selectedMembers.map((m) => m._id),
      leader_id: leaderId || null,
      start_at: isoCombine(startDate, startTime),
      end_at: isoCombine(endDate, endTime),
    };

    try {
      setLoading(true);
      const url = isEdit ? `${API_BASE}/projects/${projectId}` : `${API_BASE}/projects`;
      const method = isEdit ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : { ...payload, progress: "0", status: "todo" }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(data.error || `Failed (${r.status})`);
        setLoading(false);
        return;
      }

      if (!isEdit) {
        const created = data?.project || data?.data || data;
        const createdId =
          created?.project_id ||
          created?._id ||
          created?.id ||
          created?.inserted_id ||
          created?.insertedId ||
          created?.inserted_id?.$oid ||
          created?.upserted_id;

        if (createdId) {
          try {
            await fetch(`${API_BASE}/projects/${createdId}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ progress: "0", status: "todo" }),
            });
          } catch {}
        }
      }

      setMsg(isEdit ? "Project updated" : (data.message || "Project created"));
      navigate("/allprojects");
    } catch {
      setMsg("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white max-w-xl mx-auto mt-6 mb-6 p-6 rounded-2xl shadow-md border-2" style={{ borderColor: customColor }}>
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: customColor }}>
            {isEdit ? "Edit Project" : "Create New project"}
          </h2>
          <p className="text-sm text-black mb-4">
            {isEdit ? "Update your project details." : "Set project shift for your time work."}
          </p>
        </div>
        <img src="pj.png" alt="icon" className="ml-10 w-18 h-18" />
      </div>

      {/* Project Name */}
      <div className="mb-4">
        <label className="block text-base font-medium mb-1 border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
          Project Name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Add Members */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          {isEdit ? "Edit Members" : "Add Members"}
        </label>
        <div className="flex gap-2 mt-5">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">-- Select a member --</option>
            {memberOptions.map((m) => (
              <option key={m._id} value={m._id}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={addEmployee}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#AA405B] text-white hover:bg-[#902E48] transition-all duration-200 shadow-md"
          >
            + {isEdit ? "Add Member" : "Add Employee"}
          </button>
        </div>
      </div>

      {/* Current Employees */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          Current Employee
        </label>
        <div className="flex flex-wrap gap-2">
          {selectedMembers.map((m) => (
            <div
              key={m._id}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm text-white"
              style={{ backgroundColor: customColor }}
            >
              {m.avatar ? (
                <img src={m.avatar} alt="avatar" className="rounded-full w-6 h-6" />
              ) : (
                <div className="rounded-full w-6 h-6 flex items-center justify-center bg-gray-300 text-xs font-bold">
                  {(m.email || "?")[0].toUpperCase()}
                </div>
              )}
              {m.name || m.label}
              <button onClick={() => removeMember(m._id)} className="ml-1 text-white" title="Remove">
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Project Leader */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          Project Leader
        </label>
        <select
          value={leaderId}
          onChange={(e) => setLeaderId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">-- Select Leader --</option>
          {selectedMembers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name || m.email}
            </option>
          ))}
        </select>
      </div>

      {/* Start Shift */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          Start Shift
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="time"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      {/* End Shift */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          End Shift
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <input
            type="time"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-base font-medium mb-1 border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-between">
        <button
          className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition"
          onClick={() => navigate("/allprojects")}
          type="button"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
        >
          {loading ? (isEdit ? "Updating..." : "Creating...") : (isEdit ? "Update Project" : "Add Project")}
        </button>
      </div>

      {msg && <p className="mt-4 text-center text-red-600">{msg}</p>}
      {loadingInit && <div className="mt-4 h-24 rounded-xl bg-slate-100 animate-pulse" />}
    </div>
  );
};

export default ProjectCreate;
