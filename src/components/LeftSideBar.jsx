// LeftSideBar.js
import React from "react";
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
              className={`${baseItem} hover:bg-[${customColor}]`}
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
              className={`${baseItem} hover:bg-[${customColor}]`}
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
              className={`${baseItem} hover:bg-[${customColor}]`}
              style={{ color: customColor }}
            >
              <FaShareAlt className={`text-xl ${baseText}`} />
              <span className={baseText}>Files Sharing</span>
            </Link>
          </li>

          
          
            <li className="mb-5">
              <Link
                to="/members"
                className={`${baseItem} hover:bg-[${customColor}]`}
                style={{ color: customColor }}
              >
                <FaUsers className={`text-xl ${baseText}`} />
                <span className={baseText}>Members</span>
              </Link>
            </li>
            <li className="mb-5"> {/* Added margin-bottom to create space between Members and the bottom items */}
            <Link 
              to="/announcement" 
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }} // Custom color for text
            >
              <FaBullhorn className="text-xl" />
              <span>Announcement</span>
            </Link>
          </li>
          
        </ul>
      </nav>

      {/* Settings + Logout */}
      <div className="mt-10 space-y-3">
        <Link
          to="/profile"
          className={`${baseItem} text-sm hover:bg-[${customColor}]`}
          style={{ color: customColor }}
        >
          <FaCog className={`text-xl ${baseText}`} />
          <span className={baseText}>Settings</span>
        </Link>

        <button
          onClick={onLogout}
          className={`${baseItem} text-sm hover:bg-[${customColor}] w-full text-left`}
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
