import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaUserAlt, FaUsers, FaCalendarCheck, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config";

const TaskDetail = () => {
  const { taskId } = useParams(); // Get taskId from URL parameters
  const [taskDetail, setTaskDetail] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [leaderDetail, setLeaderDetail] = useState(null); // New state for leader details
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");  // New error state
  const [progress, setProgress] = useState(0); // Progress state for slider
  const navigate = useNavigate();

 useEffect(() => {
  const fetchTaskDetail = async () => {
    if (!taskId) return; // Guard against undefined taskId

    try {
      // Fetch task details first
      const taskResponse = await fetch(`${API_BASE}/tasks/${taskId}`);
      const taskData = await taskResponse.json();

      // Check if the task contains a valid project_id
      if (!taskData.project_id) {
        setError("No project_id found in task");
        setLoading(false);
        return;
      }

      // Fetch project details using the project_id from task
      const projectResponse = await fetch(`${API_BASE}/projects/${taskData.project_id}`);
      const projectData = await projectResponse.json();

      // Fetch leader details using leader_id from projectData
      const leaderResponse = await fetch(`${API_BASE}/get-user/${projectData.leader_id}`);
      const leaderData = await leaderResponse.json();

      if (!leaderResponse.ok) {
        setError("Failed to fetch leader details");
        setLoading(false);
        return;
      }

      // Set task, project, and leader details
      setTaskDetail(taskData);
      setProjectDetail(projectData);
      setLeaderDetail(leaderData);
      setLoading(false);

      // Set initial progress based on task status (e.g., "todo,45" or "completed")
      if (taskData.status && taskData.status.startsWith("todo,")) {
        const progressPercent = parseInt(taskData.status.split(",")[1], 10);
        setProgress(progressPercent);  // Set progress to the percentage extracted from status
      } else if (taskData.status === "completed") {
        setProgress(100);  // If completed, set progress to 100%
      }

    } catch (error) {
      console.error("Error fetching task details:", error);
      setError("Error fetching data");
      setLoading(false);
    }
  };

  fetchTaskDetail();
}, [taskId]); // Run this effect when taskId changes

  if (loading) {
    return <div className="text-center text-lg text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-lg text-red-500">{error}</div>;  // Display any error messages
  }

  if (!taskDetail || !projectDetail || !leaderDetail) {
    return <div className="text-center text-lg text-gray-500">No details available</div>;
  }

  // Function to handle progress change
  const handleProgressChange = (e) => {
    setProgress(e.target.value);
  };
const handleSetProgress = async () => {
  console.log(`Task Progress set to: ${progress}%`);

  // If progress reaches 100%, change status to completed
  const status = progress === 100 ? "completed" : `todo,${progress}`;

  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "PATCH", // Ensure this is a PATCH request
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status, // Update status to todo with the progress percentage or completed
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log("Progress updated:", data);
      setTaskDetail((prev) => ({ ...prev, status }));
    } else {
      console.error("Failed to update progress:", data);
    }
  } catch (error) {
    console.error("Error updating progress:", error);
  }
};

  const handleCompleteTask = async () => {
    console.log("Task completed!");

    // Automatically set progress to 100% when "Complete" is clicked
    setProgress(100);

    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "completed", // Mark task as completed
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Task marked as completed:", data);
        setTaskDetail((prev) => ({ ...prev, status: "completed" }));
      } else {
        console.error("Failed to complete task:", data);
      }
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-xl">
      <button
        onClick={() => navigate(-1)}
        className="text-blue-500 hover:text-blue-700 mb-4 flex items-center"
      >
        <FaArrowLeft className="mr-2" /> Back
      </button>

      {/* Three-Column Grid Layout */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        {/* Project Leader Card */}
        <div className="bg-gradient-to-r from-teal-400 to-teal-600 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaUserAlt className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Project Leader</h3>
          </div>
          <p><strong>Name:</strong> {leaderDetail.name || "No leader assigned"}</p>
          <p><strong>Email:</strong> {leaderDetail.email || "N/A"}</p>
        </div>

        {/* Project Details Card */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-800 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaCalendarCheck className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Project Details</h3>
          </div>
          <p><strong>Deadline:</strong> {new Date(projectDetail.end_at).toLocaleDateString()}</p>
          <p><strong>Description:</strong> {projectDetail.description || "No description available"}</p>
        </div>

        {/* Teammates Card */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <FaUsers className="text-3xl mr-4" />
            <h3 className="text-xl font-semibold">Teammates</h3>
          </div>
          <ul className="space-y-2">
            {projectDetail.members && projectDetail.members.length > 0 ? (
              projectDetail.members.map((member) => (
                <li key={member._id} className="flex items-center space-x-3">
                  <img 
                    src="https://via.placeholder.com/40" 
                    alt="profile" 
                    className="rounded-full w-10 h-10" 
                  />
                  <div>
                    <p className="text-md">{member.name}</p>
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

      {/* Task Status Card (Right aligned with a vertical line separating sections) */}
      <div
        className="p-6 rounded-lg shadow-md mt-8"
        style={{
          backgroundColor: "white", // White background for the card
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)", // Soft shadow for a clean, modern look
          borderRadius: "10px", // Rounded corners for the card
          border: "2px solid #AA405B", // Border color
        }}
      >
        <div className="flex">
          {/* Left side: Task details */}
         <div className="flex-1 pr-6">
  <div className="flex items-center mb-4">
    <FaCalendarCheck className="text-3xl mr-4 text-[#AA405B]" />
    <h3 className="text-2xl font-semibold text-[#AA405B]">Task Status</h3>
  </div>
  
  {/* Title */}
  <p className="text-lg font-medium text-gray-700">
    Title: <span className="text-gray-500">{taskDetail.title}</span>
  </p>

  {/* Status */}
  <p className="text-lg font-medium text-gray-700">
    Status:{" "}
    <span className="text-gray-500">
      {taskDetail.status && taskDetail.status.startsWith("todo,")
        ? `${taskDetail.status.split(",")[1]}% completed`
        : taskDetail.status}
    </span>
  </p>

  {/* Deadline */}
  <p className="text-lg font-medium text-gray-700">
    Deadline: <span className="text-gray-500">{new Date(taskDetail.end_at).toLocaleDateString()}</span>
  </p>
</div>


          {/* Divider */}
          <div className="border-l-2 border-gray-300 mx-4"></div>

          {/* Right side: Progress section */}
          <div className="flex-1">
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Set Your Progress</label>
              <div className="flex items-center justify-between">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleProgressChange}
                  className="w-full"
                />
                <span className="ml-2 text-sm font-medium">{progress}%</span>
              </div>
              <div className="flex justify-between mt-4">
                <button
                  onClick={handleSetProgress}
                  className="px-4 py-2 bg-[#AA405B] text-white rounded-lg hover:bg-[#902E48]"
                >
                  Set
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-700"
                >
                  <FaCheckCircle className="mr-2" /> Complete
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
