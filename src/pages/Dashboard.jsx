import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { getCurrentUser } from "../auth";

const Dashboard = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();
  const user = getCurrentUser(); // {_id, name, email, role, ...}

  const [experience, setExperience] = useState([]);  // from user doc
  const [projects, setProjects] = useState([]);      // projects for this user
  const [tasks, setTasks] = useState([]);            // tasks assigned to this user
  const [msg, setMsg] = useState("");

  // Load user details (experience), projects, and tasks
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
        if (uRes.ok) setExperience(uData.experience || []);
        else console.warn("get-user failed:", uData);

        // 2) Projects where I'm leader or member
        const pRes = await fetch(`${API_BASE}/projects?for_user=${user._id}`);
        const pData = await pRes.json();
        if (pRes.ok) setProjects(Array.isArray(pData) ? pData : []);
        else console.warn("projects failed:", pData);

        // 3) Tasks assigned to me
        const tRes = await fetch(`${API_BASE}/tasks?assignee_id=${user._id}`);
        const tData = await tRes.json();
        if (tRes.ok) setTasks(Array.isArray(tData) ? tData : []);
        else console.warn("tasks failed:", tData);
      } catch (e) {
        console.error(e);
        setMsg("Failed to load dashboard data.");
      }
    })();
  }, [user?._id]);

  // Derive "my role" per project:
  // - Prefer the most recent task that has project_role
  // - Else if I'm the leader -> "Leader"
  // - Else fallback to my user.position (if you store it on signin) or "Member"
  const roleByProject = useMemo(() => {
    const map = {};
    // most recent task first (tasks already sorted desc by created_at in backend)
    for (const t of tasks) {
      if (t.project_role && !map[t.project_id]) {
        map[t.project_id] = t.project_role;
      }
    }
    for (const p of projects) {
      const pid = p._id;
      if (!map[pid]) {
        map[pid] = (p.leader_id === user?._id) ? "Leader" : (user?.position || "Member");
      }
    }
    return map;
  }, [tasks, projects, user?._id, user?.position]);

  // Upcoming tasks (sorted by start_at asc)
  const upcoming = useMemo(() => {
    const withDates = tasks
      .map(t => ({ ...t, startMs: t.start_at ? Date.parse(t.start_at) : Infinity }))
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 6);
    return withDates;
  }, [tasks]);

  const batchmates = [
    { name: 'Rinsen Jey', title: 'UI/UX Designer', img: '1person.jpg' },
    { name: 'Kim Jee yong', title: 'UI/UX Designer', img: '2person.jpg' },
    { name: 'Kim Jee yong', title: 'UI/UX Designer', img: '3person.jpg' },
  ];

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
              <p className="text-gray-600">Check your daily tasks and schedules</p>
              <button
                onClick={() => navigate("/projects")}
                className="mt-4 text-white px-4 py-2 rounded-lg shadow-md"
                style={{ backgroundColor: customColor }}
              >
                Today's schedule
              </button>
            </div>
            <div className="mr-8">
              <img src="task.png" alt="Task Icon" className="h-30 w-55" />
            </div>
          </div>

          {/* Previous Experience (from user.experience) */}
          <div className="flex w-full space-x-4 mt-6">
            <div className="w-1/2 bg-white p-4 rounded-xl shadow-md relative">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 ml-8">Previous Experience</h2>
              <div className="absolute left-2 top-5 bottom-16 w-0.5 z-0 ml-6" style={{ backgroundColor: customColor }}></div>

              {experience.length === 0 ? (
                <div className="ml-8 text-gray-500">No experience added.</div>
              ) : (
                experience.slice(0, 2).map((exp, i) => (
                  <div key={i} className={`relative pl-6 ${i === 0 ? "mb-6" : ""} z-10 ml-8`}>
                    <div className="absolute left-0 top-1 w-3 h-3 rounded-full" style={{ backgroundColor: customColor }}></div>
                    <h3 className="font-semibold text-sm text-gray-800">🧑‍💻 {exp.title}</h3>
                    <p className="text-sm text-gray-600">{exp.time}</p>
                    <p className="text-xs" style={{ color: customColor }}>{exp.project}</p>
                  </div>
                ))
              )}

              <div className="text-center mt-6">
                <button
                  className="px-4 py-2 text-sm font-medium rounded-full shadow-md border transition-all duration-200 hover:shadow-lg"
                  style={{ color: customColor, borderColor: customColor }}
                >
                  See More
                </button>
              </div>
            </div>

            {/* Files (left as-is) */}
            <div className="bg-white rounded-xl p-4 w-1/2 shadow-md flex justify-between items-start">
              <div className="w-3/4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold" style={{ color: customColor }}>
                    File Uploaded <span className="text-sm" style={{ color: customColor }}>(12)</span>
                  </h2>
                </div>
                {[
                  { title: 'Colour Theory', date: '01 Feb 2024' },
                  { title: 'Design system', date: '01 Feb 2024' },
                  { title: 'User persona', date: '13 Mar 2024' },
                  { title: 'Prototyping', date: '16 Mar 2024' },
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-start mb-3">
                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center mt-1" style={{ backgroundColor: customColor }}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
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

        {/* RIGHT COLUMN (kept, just greeting above already personalizes) */}
        <div className="flex flex-col w-1/4 space-y-4 mr-10">
          <div className="p-3 rounded-lg" style={{ backgroundColor: customColor }}>
            <h2 className="text-xl font-bold text-white">{user?.name || "Profile"}</h2>
            <p className="text-white">{user?.position || "—"}</p>
            {/* ... rest of your right column remains ... */}
          </div>

          <div className="rounded-xl p-2 w-full mb-3" style={{ backgroundColor: customColor }}>
            <h2 className="text-center font-semibold text-lg mb-4 text-white">Batchmates</h2>
            {batchmates.map((mate, index) => (
              <div key={index} className="flex items-center bg-white rounded-lg p-2 mb-2">
                <img src={mate.img} alt={mate.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">{mate.name}</p>
                  <p className="text-xs" style={{ color: customColor }}>{mate.title}</p>
                </div>
              </div>
            ))}
            <button className="bg-white w-full text-sm font-medium py-1 mt-2 rounded-lg shadow hover:bg-gray-100">
              See all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
