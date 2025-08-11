// LeftSideBar.js
import React from "react";
import { Link } from "react-router-dom";
import {
  FaTachometerAlt,
  FaTasks,
  FaShareAlt,
  FaUsers,
  FaCog,
  FaSignOutAlt,
} from "react-icons/fa"; // Import icons from React Icons

const LeftSideBar = ({ userId }) => {
  const customColor = "#AA405B"; // Custom color for the text

  return (
    <div className="w-64 bg-white border-r-2 border-gray-200 h-full flex flex-col p-5">
      {/* Logo Section */}
      <div className="flex items-center space-x-3 mb-10">
        <img
          src="logo.png" // Replace with your logo path
          alt="Logo"
          className="w-10 h-10 object-cover" // Ensuring the logo is not stretched
        />
        <div
          className="text-2xl font-semibold"
          style={{ color: customColor }} // Applying custom color to the "TeamDesk" text
        >
          TeamDesk
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1">
        <ul className="space-y-5">
          {/* Dashboard */}
          <li>
            <a
              href="/dashboard"
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }} // Custom color for text
            >
              <FaTachometerAlt className="text-xl" />
              <span>Dashboard</span>
            </a>
          </li>

          {/* To-Do */}
          {userId === 1 ? (
            <li>
              <Link
                to="/tasks"
                className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
                style={{ color: customColor }}
              >
                <FaTasks className="text-xl" />
                <span>To-Do</span>
              </Link>
            </li>
          ) : (
            <li>
              <Link
                to="/tasks"
                className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
                style={{ color: customColor }}
              >
                <FaTasks className="text-xl" />
                <span>To-Do</span>
              </Link>
            </li>
          )}
          {/* File Sharing */}
          <li>
            <Link
              to="/file-sharing"
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }} // Custom color for text
            >
              <FaShareAlt className="text-xl" />
              <span>Files Sharing</span>
            </Link>
          </li>

         {/* Members */}
          <li className="mb-5"> {/* Added margin-bottom to create space between Members and the bottom items */}
            <Link 
              to="/members" 
              className="text-lg p-3 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
              style={{ color: customColor }} // Custom color for text
            >
              <FaUsers className="text-xl" />
              <span>Members</span>
            </Link>
          </li>
        </ul>
      </nav>

   {/* Settings and Logout Section */}
      <div className="mt-18 space-y-3"> {/* Reduced space between Settings and Logout */}
        {/* Settings */}
        <a 
          href="/profile" 
          className="text-sm p-2 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
          style={{ color: customColor }} // Custom color for text
        >
          <FaCog className="text-xl" />
          <span>Settings</span>
        </a>

        {/* Logout */}
        <Link 
          to="/signin" 
          className="text-sm p-2 rounded-md block flex items-center space-x-3 transition-all transform hover:scale-105 hover:bg-customColor hover:text-white shadow-md"
          style={{ color: customColor }} // Custom color for text
        >
          <FaSignOutAlt className="text-xl" />
          <span>Logout</span>
        </Link>
      </div>
    </div>
  );
};

export default LeftSideBar;
