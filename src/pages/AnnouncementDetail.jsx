import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import styled from "styled-components";

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Title = styled.h1`
  font-size: 1.8rem;
  font-weight: 700;
  color: #AA405B;
  margin-bottom: 1rem;
`;

const Meta = styled.p`
  font-size: 0.9rem;
  color: #555;
  font-weight: bold;
  margin-bottom: 1rem;
`;

const Image = styled.img`
  width: 100%;
  height: 250px;
  border-radius: 12px;
  object-fit: cover;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const Message = styled.p`
  font-size: 1rem;
  line-height: 1.6;
  color: #333;
`;

const BackButton = styled(Link)`
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.6rem 1.2rem;
  background: #AA405B;
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: background 0.3s ease;

  &:hover {
    background: #922f4b;
  }
`;

const AnnouncementDetail = () => {
  const { id } = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/announcement/${id}`);
        const data = await res.json();
        setAnnouncement(data);
      } catch (err) {
        console.error("Error fetching announcement:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncement();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!announcement) return <p>Announcement not found</p>;

  // ✅ Use default image if no image found
  const imageSrc =
    announcement.image && announcement.image.trim() !== ""
      ? announcement.image
      : "/default-announcement.png"; // put this file in your public folder

  return (
    <Container>
      <Title>{announcement.title}</Title>
      <Meta>
        Send to:{" "}
        {announcement.sendTo === "all"
          ? "All Members"
          : announcement.sendTo === "team_leader"
          ? "Team Leader"
          : announcement.sendTo}
      </Meta>
      {/* {announcement.image && (
        <Image src={announcement.image} alt="Announcement" />
      )} */}
      <img
        src={imageSrc}
        alt="Announcement"
        className="w-full h-[250px] object-cover rounded-lg shadow-md mb-6"
      />
      <Message className="text-lg text-gray-700 leading-relaxed text-center max-w-2xl">{announcement.message}</Message>

      <BackButton to="/announcement">← Back </BackButton>
    </Container>
  );
};

export default AnnouncementDetail;
