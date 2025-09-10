import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { FiMail, FiPhone, FiTrash2 } from "react-icons/fi";

// Prefer importing from a central config
const API_BASE = "http://localhost:5000";

function buildAvatarSrc(profileImage) {
  const v = (profileImage || "").trim();
  if (!v) return "https://cdn-icons-png.flaticon.com/512/847/847969.png";
  if (v.startsWith("/uploads/")) return `${API_BASE}${v}`;
  if (/^https?:\/\//i.test(v))   return v;
  return `${API_BASE}/uploads/${v}`;
}

const Members = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const user = JSON.parse(localStorage.getItem("user"));

  const handleDelete = async (memberId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`${API_BASE}/delete-user/${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        alert("User deleted successfully!");
        window.location.reload();
      } else {
        alert(data.error || "Failed to delete user.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Server error.");
    }
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`${API_BASE}/registered-members`);
        const data = await res.json();
        if (res.ok) setMembers(data);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
  }, []);

  const filteredMembers = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-gray-100 min-h-screen p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="relative w-full md:w-1/2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <FaSearch className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AA405B] shadow-sm"
          />
        </div>

        {user?.role === "admin" && (
          <div className="flex items-center gap-4">
            <button className="bg-[#AA405B] text-white px-5 py-2 rounded-md" onClick={() => navigate("/add-member")}>
              + Add Candidate
            </button>
          </div>
        )}
      </div>

      <h1 className="text-3xl font-semibold text-[#AA405B] mb-6">
        {filteredMembers.length} {filteredMembers.length === 1 ? "Employee" : "Employees"}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map((member) => (
          <div key={member._id} className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
              {user?.role === "admin" && (
                <button
                  onClick={() => handleDelete(member._id)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition"
                  title="Delete User"
                >
                  <FiTrash2 size={20} />
                </button>
              )}
            </div>

            <div className="flex-col items-center mb-4">
              <img
                src={buildAvatarSrc(member.profileImage)}
                alt={member.name || "Profile"}
                className="w-18 h-18 rounded-full mr-3 object-cover"
              />
              <div>
                <h2 className="font-semibold text-lg">{member.name || "Unnamed"}</h2>
                <p className="text-gray-500 text-sm">{member.position || "Member"}</p>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p className="flex gap-2"><FiMail className="text-black relative top-[2px] text-[18px]" />{member.email || "N/A"}</p>
              <p className="flex gap-2"><FiPhone className="text-black relative top-[2px] text-[18px]" />{member.phone || "N/A"}</p>
              <p><strong>DOB:</strong> {member.dob || "N/A"}</p>
              <p><strong>Address:</strong> {member.address || "N/A"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Members;
