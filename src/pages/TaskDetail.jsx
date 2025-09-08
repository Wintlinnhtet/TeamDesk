// src/components/TaskDetail.jsx
import React, { useEffect, useState, useMemo } from "react";
import { FaArrowLeft, FaUserAlt, FaUsers, FaCalendarCheck, FaCheckCircle, FaLock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config";

/** Prefer numeric progress when >0; otherwise parse from status (e.g., "todo,48", "in_progress 60%"). */
function deriveProgress(task) {
  const n = Number(task?.progress);
  if (Number.isFinite(n) && n > 0) return Math.max(0, Math.min(100, n));

  const s = String(task?.status || "").toLowerCase();
  if (/completed|complete|done|finished/.test(s)) return 100;

  const m = s.match(/(\d{1,3})/);
  if (m) return Math.max(0, Math.min(100, parseInt(m[1], 10)));

  return 0;
}

/** Read the current user from local/session storage for actor headers */
function getActor() {
  try {
    const ls = JSON.parse(localStorage.getItem("user") || "null");
    const ss = JSON.parse(sessionStorage.getItem("user") || "null");
    const raw = (ls?.user || ls || ss?.user || ss || null) || {};
    const id = raw?._id || raw?.id || null;
    const name = raw?.name || raw?.email || "Someone";
    return { id: id ? String(id) : null, name: String(name) };
  } catch {
    return { id: null, name: "Someone" };
  }
}

const TaskDetail = () => {
  const { taskId } = useParams();
  const [taskDetail, setTaskDetail] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [leaderDetail, setLeaderDetail] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const locked = useMemo(() => {
    if (!projectDetail) return false;
    const status = String(projectDetail.status || "").toLowerCase();
    const prog = Number(projectDetail.progress || 0);
    return status === "complete"; // keep your existing rule
  }, [projectDetail]);

  useEffect(() => {
    const fetchTaskDetail = async () => {
      if (!taskId) return;
      try {
        // 1) task
        const taskRes = await fetch(`${API_BASE}/tasks/${taskId}`);
        const taskData = await taskRes.json();
        if (!taskRes.ok) {
          setError(taskData?.error || "Failed to fetch task");
          setLoading(false);
          return;
        }
        if (!taskData.project_id) {
          setError("No project_id found in task");
          setLoading(false);
          return;
        }

        // 2) project
        const projRes = await fetch(`${API_BASE}/projects/${taskData.project_id}`);
        const projData = await projRes.json();
        if (!projRes.ok) {
          setError(projData?.error || "Failed to fetch project");
          setLoading(false);
          return;
        }

        // 3) leader (optional)
        let leaderData = {};
        if (projData.leader_id) {
          const leaderRes = await fetch(`${API_BASE}/get-user/${projData.leader_id}`);
          leaderData = await leaderRes.json();
          if (!leaderRes.ok) leaderData = {};
        }

        setTaskDetail(taskData);
        setProjectDetail(projData);
        setLeaderDetail(leaderData);

        // initialize the slider from the DB
        setProgress(deriveProgress(taskData));

        setLoading(false);
      } catch (err) {
        console.error("Error fetching task details:", err);
        setError("Error fetching data");
        setLoading(false);
      }
    };

    fetchTaskDetail();
  }, [taskId]);

  // keep slider in sync if taskDetail changes elsewhere
  useEffect(() => {
    if (taskDetail) setProgress(deriveProgress(taskDetail));
  }, [taskDetail?.status, taskDetail?.progress]);

  if (loading) return <div className="text-center text-lg text-gray-500">Loading...</div>;
  if (error) return <div className="text-center text-lg text-red-500">{error}</div>;
  if (!taskDetail || !projectDetail) return <div className="text-center text-lg text-gray-500">No details available</div>;

  const handleProgressChange = (e) => setProgress(parseInt(e.target.value, 10));
// 🔧 Only this function changed
const handleSetProgress = async () => {
  if (locked) {
    alert("This project is completed. Task updates are locked.");
    return;
  }
  const { id: actorId, name: actorName } = getActor();
  const status = progress === 100 ? "completed" : `todo,${progress}`;

  try {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      // ✅ send actor in the BODY (no custom headers → no preflight block)
      body: JSON.stringify({
        status,
        progress,
        updated_by: actorId,
        updated_by_name: actorName,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTaskDetail((prev) => ({ ...prev, status, progress }));
      setProgress(progress);
    } else {
      console.error("Failed to update progress:", data);
      alert(data?.error || "Failed to update progress");
    }
  } catch (err) {
    console.error("Error updating progress:", err);
    alert("Network/CORS error while updating progress");
  }
};
// 🔧 And this one
const handleCompleteTask = async () => {
  if (locked) {
    alert("This project is completed. Task updates are locked.");
    return;
  }
  const { id: actorId, name: actorName } = getActor();

  try {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        status: "completed",
        progress: 100,
        updated_by: actorId,
        updated_by_name: actorName,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTaskDetail((prev) => ({ ...prev, status: "completed", progress: 100 }));
      setProgress(100);
    } else {
      console.error("Failed to complete task:", data);
      alert(data?.error || "Failed to complete task");
    }
  } catch (err) {
    console.error("Error completing task:", err);
    alert("Network/CORS error while completing task");
  }
};

  const statusLabel = progress === 100 ? "completed" : `${progress}% completed`;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-xl">
      <button onClick={() => navigate(-1)} className="text-blue-500 hover:text-blue-700 mb-4 flex items-center">
        <FaArrowLeft className="mr-2" /> Back
      </button>

      {locked && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          <FaLock />
          <span>This project is completed. Task updates are locked.</span>
        </div>
      )}

      {/* Three columns */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-r from-teal-400 to-teal-600 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaUserAlt className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Project Leader</h3>
          </div>
          <p><strong>Name:</strong> {leaderDetail.name || "No leader assigned"}</p>
          <p><strong>Email:</strong> {leaderDetail.email || "N/A"}</p>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-indigo-800 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaCalendarCheck className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Project Details</h3>
          </div>
          <p><strong>Deadline:</strong> {projectDetail.end_at ? new Date(projectDetail.end_at).toLocaleDateString() : "—"}</p>
          <p><strong>Status:</strong> {String(projectDetail.status || "todo")}</p>
          <p><strong>Description:</strong> {projectDetail.description || "No description available"}</p>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaUsers className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Teammates</h3>
          </div>
          <ul className="space-y-2">
            {projectDetail.members && projectDetail.members.length > 0 ? (
              projectDetail.members.map((member) => (
                <li key={member._id} className="flex items-center space-x-3">
                  <img src="https://via.placeholder.com/40" alt="profile" className="rounded-full w-10 h-10" />
                  <div>
                    <p className="text-md">{member.name || member.email || "Member"}</p>
                    <p className="text-sm text-gray-300">{member.project_role || "No role assigned"}</p>
                  </div>
                </li>
              ))
            ) : (
              <li>No teammates assigned</li>
            )}
          </ul>
        </div>
      </div>

      {/* Task status + slider */}
      <div
        className="p-6 rounded-lg shadow-md mt-8"
        style={{ backgroundColor: "white", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)", borderRadius: "10px", border: "2px solid #AA405B" }}
      >
        <div className="flex">
          <div className="flex-1 pr-6">
            <div className="flex items-center mb-4">
              <FaCalendarCheck className="text-3xl mr-4 text-[#AA405B]" />
              <h3 className="text-2xl font-semibold text-[#AA405B]">Task Status</h3>
            </div>

            <p className="text-lg font-medium text-gray-700">
              Title: <span className="text-gray-500">{taskDetail.title}</span>
            </p>

            <p className="text-lg font-medium text-gray-700">
              Status: <span className="text-gray-500">{statusLabel}</span>
            </p>

            <p className="text-lg font-medium text-gray-700">
              Deadline: <span className="text-gray-500">{taskDetail.end_at ? new Date(taskDetail.end_at).toLocaleDateString() : "—"}</span>
            </p>
          </div>

          <div className="border-l-2 border-gray-300 mx-4"></div>

          <div className="flex-1">
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Set Your Progress</label>
              <div className="flex items-center justify-between">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={e => setProgress(parseInt(e.target.value, 10))}
                  className={`w-full ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={locked}
                />
                <span className="ml-2 text-sm font-medium">{progress}%</span>
              </div>
              <div className="flex justify-between mt-4">
                <button
                  onClick={handleSetProgress}
                  className={`px-4 py-2 text-white rounded-lg ${locked ? "bg-gray-300 cursor-not-allowed" : "bg-[#AA405B] hover:bg-[#902E48]"}`}
                  disabled={locked}
                >
                  Set
                </button>
                <button
                  onClick={handleCompleteTask}
                  className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${locked ? "bg-gray-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-700"}`}
                  disabled={locked}
                >
                  <FaCheckCircle /> Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
