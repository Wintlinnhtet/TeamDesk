import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { getCurrentUser } from "../auth";

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

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
     console.log("Projects response:", data);
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("Server error while fetching projects.");
      console.error(e);
    }
  })();
}, []);

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
    {projects.map((p) => (
      <div
        key={p._id}
        className="border-2 rounded-xl shadow-md p-4 cursor-pointer hover:shadow-lg transition"
        style={{ borderColor: "#AA405B" }}
      
         onClick={() => navigate(`/assign-task?projectId=${p._id}`)}

      >
        <h3 className="text-lg font-semibold text-[#AA405B]">{p.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{p.description}</p>
        <p className="text-xs text-gray-500 mt-2">
          Members: {p.member_ids?.length || 0}
        </p>
      </div>
    ))}
  </div>
)}

    </div>
  );
};

export default Projects;
