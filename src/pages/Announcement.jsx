import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { FaSearch } from 'react-icons/fa';
import { MdCampaign } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
// put this near imports (or import from a config)
// const API_BASE = "http://localhost:5000";


// Normalize DB image -> usable <img src>
function buildAnnImageSrc(image) {
  const v = (image || "").trim();
  if (!v) return "/default-announcement.png";              // React /public fallback
  if (/^https?:\/\//i.test(v)) return v;                   // absolute URL already
  if (v.startsWith("/uploads/")) return `${API_BASE}${v}`; // stored as '/uploads/..'
  return `${API_BASE}/uploads/${v}`;                       // bare filename -> uploads
}

const PageContainer = styled.div`
  max-width: 90vw;
  margin: 2rem auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const Button = styled.button`
  background-color: #AA405B;
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 4px 8px rgba(24, 119, 242, 0.4);
  transition: background-color 0.3s ease;
  display: flex;              /* ✅ align icon + text */
  align-items: center;        /* ✅ vertically center */
  gap: 8px;                   /* ✅ space between icon and text */

  &:hover {
    background-color: #922f4b;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.5rem;
  margin-bottom: 1rem;
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  }
`;

const Image = styled.img`
  width: 100px;
  height: 80px;
  border-radius: 7px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin-right: 1rem;
`;

const Content = styled.div`
  flex: 1;
`;

const Title = styled.h2`
  font-size: 1rem;
  color: #222;
  margin: 0 0 0.5rem 0;
  font-weight: 600;
`;

const Message = styled.p`
  font-size: 0.7rem;
  color: #555;
  line-height: 1.4;
  margin: 0;
`;

const Announcement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  

  // ✅ get user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = (user && user.role) || "member";
  const isLeader = user.isLeader ?? false;

  

  console.log("Current user:", user);
console.log("Role:", role);
console.log("isLeader:", isLeader);
  

  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();

  

  // ✅ fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // const res = await fetch("http://172.20.6.73:5000/api/announcement");
         const res = await fetch(`${API_BASE}/api/announcement`);
        const data = await res.json();
        setAnnouncements(data);
      } catch (err) {
        console.error("Error fetching announcements:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  // ✅ filter announcements based on role
  // let filteredAnnouncements = [];
  // if (role === "admin") {
  //   filteredAnnouncements = announcements;
  // } else if (role === "leader") {
  //   filteredAnnouncements = announcements.filter(
  //     (a) => a.sendTo === "all" || a.sendTo === "team_leader"
  //   );
  // } else if (role === "member") {
  //   filteredAnnouncements = announcements.filter((a) => a.sendTo === "all");
  // }



  let filteredAnnouncements = [];

if (role === "admin") {
  // Admin sees everything
  filteredAnnouncements = announcements;
} else if  (isLeader) {
  // Leaders see announcements sent to 'all' or 'team_leader'
  filteredAnnouncements = announcements;

} else if (role === "member") {
  // Normal members see only 'all'
  filteredAnnouncements = announcements.filter((a) => a.sendTo === "all");
}



  // ✅ New: filter announcements by search term
  const displayedAnnouncements = filteredAnnouncements.filter((a) =>
  a.title.toLowerCase().includes(searchTerm.toLowerCase())
);

  return (
    <PageContainer>
      
      <Header>
        <div className="relative w-full md:w-1/2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <FaSearch className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}               // ✅ bind searchTerm
                onChange={(e) => setSearchTerm(e.target.value)}  // ✅ update searchTerm
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AA405B] shadow-sm"
              />
        </div>
        {role === "admin" && (
          <Link to="/announce">
            <Button>
               <MdCampaign size={21} />   {/* ✅ icon before text */}
              Make Announcement
            </Button>
          </Link>
        )}
      </Header>
      <h1 className="text-3xl font-semibold text-[#AA405B] mb-6">Announcement List</h1>

     {loading ? (
  <p>Loading announcements...</p>
) : displayedAnnouncements.length > 0 ? (
  displayedAnnouncements.map((a) => (
    <Card
      key={a.id}
      style={{ cursor: "pointer", justifyContent: "space-between" }} // ✅ space between content & buttons
    >
      {/* Left side: Image + Content */}
      <div
        onClick={() => navigate(`/announcement/${a.id}`)} // ✅ click card to go detail
        style={{ display: "flex", alignItems: "center", flex: 1 }}
      >
        <Image
  src={buildAnnImageSrc(a.image)}
  alt="Announcement"
  className="w-full h-[250px] object-cover rounded-lg shadow-md"
/>

        <Content>
          <Title>{a.title}</Title>
          <p style={{ fontSize: "0.8rem", color: "#555", margin: "0 0 0.4rem 0" }}>
            Announce to:{" "}
            <strong>{a.sendTo === "all" ? "All Members" : "Team Leader"}</strong>
          </p>
        </Content>
      </div>

      {/* ✅ Right side: Edit + Delete buttons (only admin) */}
      {role === "admin" && (
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => navigate(`/edit-announcement/${a.id}`)}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Edit
          </button>
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to delete this announcement?")) {
                try {
                  await fetch(`${API_BASE}/api/announcement/${a.id}`, {
                    method: "DELETE",
                  });
                  setAnnouncements(announcements.filter((ann) => ann.id !== a.id)); // ✅ remove from UI
                } catch (err) {
                  console.error("Delete failed:", err);
                }
              }
            }}
            style={{
              backgroundColor: "#E53935",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Delete
          </button>
        </div>
      )}
    </Card>
  ))
) : (
  <p>No announcements available.</p>
)}

    </PageContainer>
  );
};

export default Announcement;