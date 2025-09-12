import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Container,
  Header,
  Form,
  FormGroup,
  Label,
  RoleSelect,
  TextArea,
  FileInput,
  FileLabel,
  ImagePreview,
  SubmitButton,
  Input,
} from "./Announce"; // ✅ Reuse styled components from Announce.jsx
import { API_BASE } from "../config";

const EditAnnouncement = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [image, setImage] = useState(null);
  const [existingImage, setExistingImage] = useState(null); // ✅ keep old image
  const [role, setRole] = useState("all");

  useEffect(() => {
    // ✅ Fetch existing data
    const fetchAnnouncement = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/announcement/${id}`);
        const data = await res.json();

        setTitle(data.title || "");
        setAnnouncementText(data.message || "");
        setRole(data.sendTo || "all");
        setExistingImage(data.image || null);
      } catch (err) {
        console.error("Failed to fetch announcement:", err);
      }
    };
    fetchAnnouncement();
  }, [id]);

  const handleImageChange = (event) => {
    setImage(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append("title", title);
    formData.append("message", announcementText);
    formData.append("sendTo", role);
    if (image) formData.append("image", image);

    try {
      const res = await fetch(`${API_BASE}/api/announcement/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok) {
        alert("Announcement updated successfully!");
        navigate("/announcement"); // ✅ redirect back
      } else {
        alert("Failed to update announcement");
      }
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  return (
    <Container>
      <Header>
        <h1>Edit Announcement</h1>
        <p>Update your announcement details</p>
      </Header>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Announcement Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title here..."
          />
        </FormGroup>

        <FormGroup>
          <Label>Announcement Message</Label>
          <TextArea
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
          />
        </FormGroup>

        <FormGroup>
  <Label>Attach Image (Optional)</Label>
  <FileInput
    type="file"
    id="imageInput"
    accept="image/*"
    onChange={handleImageChange}
  />
  <FileLabel htmlFor="imageInput">📷 Click to upload an image</FileLabel>

  {/* ✅ Show previous image if exists and no new image selected */}
  {existingImage && !image && (
    <ImagePreview style={{ display: "block" }}>
      <img
        src={
          existingImage.startsWith("http")
            ? existingImage // use full URL if stored in DB
            : `${API_BASE}/uploads/${existingImage}` // otherwise prefix
        }
        alt="Existing"
      />
    </ImagePreview>
  )}

  {/* ✅ Show new preview if selected */}
  {image && (
    <ImagePreview style={{ display: "block" }}>
      <img src={URL.createObjectURL(image)} alt="Preview" />
    </ImagePreview>
  )}
</FormGroup>


        <FormGroup>
          <Label>Send to</Label>
          <RoleSelect value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All Members</option>
            <option value="team_leader">Team Leaders</option>
          </RoleSelect>
        </FormGroup>

        <SubmitButton type="submit">Update Announcement</SubmitButton>
      </Form>
    </Container>
  );
};

export default EditAnnouncement;
