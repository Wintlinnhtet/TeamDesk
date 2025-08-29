import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config"; // ensure this is set as before
import { useNavigate } from "react-router-dom";  // <-- import navigate
const ProjectCreate = () => {
  const customColor = "#AA405B";

  // form state
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const navigate = useNavigate();
  // dates & times
  const [startDate, setStartDate] = useState("2024-12-29");
  const [startTime, setStartTime] = useState("21:00");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [endTime, setEndTime] = useState("22:00");

  // members
  const [allMembers, setAllMembers] = useState([]);           // [{_id, name, email, avatar?}]
  const [selectedMembers, setSelectedMembers] = useState([]);  // same shape
  const [selectedMemberId, setSelectedMemberId] = useState(""); // dropdown value
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        console.log("Fetching members from:", `${API_BASE}/members`);
        const r = await fetch(`${API_BASE}/members`);
        if (!r.ok) {
          const text = await r.text();
          console.error("Members fetch failed:", r.status, text);
          setAllMembers([]);
          setMsg(`Failed to load members (${r.status})`);
          return;
        }
        const data = await r.json();
        console.log("Members:", data);
        setAllMembers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load members", e);
      }
    })();
  }, []);

  // labels for dropdown (show name primarily) + carry avatar if present
  const memberOptions = useMemo(
    () =>
      allMembers.map((m) => ({
        _id: m._id,
        label: m.name && m.name.trim().length ? m.name : (m.email || "(no name)"),
        email: m.email || "",
        name: m.name || "",
        avatar: m.avatar || null,
      })),
    [allMembers]
  );

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
    if (selectedMembers.some((m) => m._id === picked._id)) {
      setMsg("Already added.");
      return;
    }
    setSelectedMembers((prev) => [...prev, picked]);
    // keep dropdown selection, or clear it:
    setSelectedMemberId(""); // clear so user explicitly picks the next
  };

  const removeMember = (id) => {
    setSelectedMembers((prev) => prev.filter((m) => m._id !== id));
  };

  const isoCombine = (d, t) => {
    if (!d || !t) return null;
    const [y, mo, da] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    const dt = new Date(y, mo - 1, da, hh, mm, 0);
    return dt.toISOString();
  };

  const onCreate = async () => {
    setMsg("");
    if (!projectName.trim()) {
      setMsg("Project name is required.");
      return;
    }
    if (selectedMembers.length === 0) {
      setMsg("Please add at least one member.");
      return;
    }

    // Some backends expect progress as a STRING; status lowercase
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      member_ids: selectedMembers.map((m) => m._id),
      leader_id: leaderId, // <-- Ensure leaderId is passed here
      start_at: isoCombine(startDate, startTime),
      end_at: isoCombine(endDate, endTime),
      progress: "0",        // <= STRING to maximize compatibility
      status: "todo",
    };

    try {
      const r = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error("Create failed:", data);
        setMsg(data.error || `Failed (${r.status})`);
        return;
      }

      // If create succeeded but backend ignored fields, patch them in.
      // Try to detect the new project's id from common response shapes.
      const created =
        data?.project ||
        data?.data ||
        data;

      const createdId = created?._id || created?.id;

      // Only PATCH if id exists; harmless to run even if create already stored them
      if (createdId) {
        try {
          const patch = await fetch(`${API_BASE}/projects/${createdId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ progress: "0", status: "todo" }),
          });
          const patchData = await patch.json().catch(() => ({}));
          if (!patch.ok) {
            console.warn("Patch for progress/status did not apply:", patchData);
          }
        } catch (e) {
          console.warn("Patch for progress/status failed:", e);
        }
      } else {
        console.warn("Could not determine created project id; skip PATCH.");
      }

      setMsg(data.message || "Project created");
      // reset (optional)
      setProjectName("");
      setDescription("");
      setSelectedMembers([]);
      setSelectedMemberId("");
      setLeaderId("");
      navigate("/allprojects"); 
    } catch (e) {
      console.error(e);
      setMsg("Server error. Please try again.");
    }
  };

  return (
    <div className="bg-white max-w-xl mx-auto mt-6 mb-6 p-6 rounded-2xl shadow-md border-2" style={{ borderColor: customColor }}>
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: customColor }}>Create New project</h2>
          <p className="text-sm text-black mb-4">Set project shift for your time work.</p>
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

      {/* Add Members (dropdown single-select) */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>
          Add Members
        </label>
        <div className="flex gap-2 mt-5">
          {/* Add Members (dropdown single-select) */}
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">-- Select a member --</option>
            {allMembers.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name || m.email || "(no name)"}
              </option>
            ))}
          </select>

          {allMembers.length === 0 && (
            <div className="text-sm text-gray-500 mt-2">
              No members found. Make sure users have <code>role: "member"</code> and CORS/IP are correct.
            </div>
          )}

          <button
            onClick={addEmployee}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#AA405B] text-white hover:bg-[#902E48] transition-all duration-200 shadow-md"
          >
            + Add Employee
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
              <button onClick={() => removeMember(m._id)} className="ml-1 text-white">
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
        <button className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition">
          Cancel
        </button>
        <button
          onClick={onCreate}
          className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
        >
          Add Project
        </button>
      </div>

      {msg && <p className="mt-4 text-center text-red-600">{msg}</p>}
    </div>
  );
};

export default ProjectCreate;
