// LeftSideBar.js
import React from "react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaTasks,
  FaShareAlt,
  FaUsers,
  FaCog,
  FaSignOutAlt,
  FaBullhorn,
} from "react-icons/fa";

const LeftSideBar = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = (user && user.role) || "member";
  const isAdmin = role.toLowerCase() === "admin";

  // State to hold notification count
const [notifications, setNotifications] = useState(0);

// Fetch announcements for the badge
// useEffect(() => {
//   const fetchNotifications = async () => {
//     try {
//       const res = await fetch("http://localhost:5000/api/announcement");
//       const data = await res.json();
//       const announcements = data.success ? data.announcements : data;
//       const unread = announcements.filter(
//         (a) => a.sendTo === "all" || a.sendTo === role
//       ).length;
//       setNotifications(unread); // 🔥 Update notification count
//     } catch (err) {
//       console.error("Error fetching announcements:", err);
//     }
//   };

//   fetchNotifications();
//   const interval = setInterval(fetchNotifications, 30000); // refresh every 30s
//   return () => clearInterval(interval);
// }, [role]);


// useEffect(() => {
//   const fetchNotifications = async () => {
//     try {
//       const res = await fetch(`http://localhost:5000/api/announcement/unread/${user._id}/${role}`);
//       const data = await res.json();
//       setNotifications(data.count);
//     } catch (err) {
//       console.error("Error fetching announcements:", err);
//     }
//   };

//   fetchNotifications();
//   const interval = setInterval(fetchNotifications, 30000); // refresh every 30s
//   return () => clearInterval(interval);
// }, [user._id, role]);
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/announcement/unread/${user._id}`);
      const data = await res.json();
      setNotifications(data.count);
    } catch (err) {
      console.error("Error fetching announcements:", err);
    }
  };

  fetchNotifications();
  const interval = setInterval(fetchNotifications, 30000); // refresh every 30s
  return () => clearInterval(interval);
}, [user._id]);




const handleAnnouncementClick = async () => {
  try {
    await fetch(`http://localhost:5000/api/announcement/read-all/${user._id}`, {
      method: "PUT"
    });
    setNotifications(0); // clear instantly
    navigate("/announcement");
  } catch (err) {
    console.error("Error marking announcements as read:", err);
  }
};



  const onLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {}
    navigate("/signin");
  };

  const baseItem =
    "group flex items-center space-x-3 text-lg p-3 rounded-md transition-all transform hover:scale-105 shadow-md";

  const baseText = "transition-colors duration-200 ";

  return (
    <div className="w-64 bg-white border-r-2 border-gray-200 h-full flex flex-col p-5">
      {/* Logo */}
      <div className="flex items-center space-x-3 mb-10">
        <img src="logo.png" alt="Logo" className="w-10 h-10 object-cover" />
        <div className="text-2xl font-semibold" style={{ color: customColor }}>
          TeamDesk
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-3">
          {/* Dashboard */}
          <li>
            <Link
              to={isAdmin ? "/admin" : "/dashboard"}
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }}
            >
              <FaTachometerAlt className={`text-xl ${baseText}`} />
              <span className={baseText}>Dashboard</span>
            </Link>
          </li>

          {/* Tasks */}
          <li>
            <Link
              to={isAdmin ? "/tasks_admin" : "/tasks"}
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }}
            >
              <FaTasks className={`text-xl ${baseText}`} />
              <span className={baseText}>
                {isAdmin ? "Manage Tasks" : "My Tasks"}
              </span>
            </Link>
          </li>

          {/* File Sharing */}
          <li>
            <Link
              to="/file-sharing"
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }}
            >
              <FaShareAlt className={`text-xl ${baseText}`} />
              <span className={baseText}>Files Sharing</span>
            </Link>
          </li>

          
          
            <li className="mb-5">
              <Link
                to="/members"
                className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }}
              >
                <FaUsers className={`text-xl ${baseText}`} />
                <span className={baseText}>Members</span>
              </Link>
            </li>
            <li className="mb-5">
  <button
    onClick={handleAnnouncementClick}
    className="w-full text-left text-lg p-3 rounded-md flex items-center space-x-2 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
    style={{ color: customColor }}
  >
    <FaBullhorn className="text-xl" />
    <span className="flex items-center space-x-2">
      <span>Announcement</span>
      {notifications > 0 && !isAdmin && (
        <span className="ml-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {notifications}
        </span>
      )}
    </span>
  </button>
</li>

            {/* <li className="mb-5">
  <Link 
    to="/announcement" 
    className="text-lg p-3 rounded-md flex items-center space-x-2 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
    style={{ color: customColor }}
  >
    <FaBullhorn className="text-xl" />
    <span className="flex items-center space-x-2">
      <span>Announcement</span>
      {notifications > 0 &&  (
        <span className="ml-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {notifications}
        </span>
      )}
    </span>
  </Link>
</li> */}

          
        </ul>
      </nav>

      {/* Settings + Logout */}
      <div className="mt-10 space-y-3">
        <Link
          to="/profile"
         className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }}
        >
          <FaCog className={`text-xl ${baseText}`} />
          <span className={baseText}>Settings</span>
        </Link>

        <button
          onClick={onLogout}
          className={`${baseItem} text-sm  w-full text-left`}
          style={{ color: customColor }}
        >
          <FaSignOutAlt className={`text-xl ${baseText}`} />
          <span className={baseText}>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default LeftSideBar;
