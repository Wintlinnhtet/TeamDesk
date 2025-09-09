import React, { useState } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from "react-router-dom";

const Container = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 700px;
  overflow: hidden;
  margin: 20px auto;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  padding: 30px;
  text-align: center;
`;

const Form = styled.form`
  padding: 30px;
`;

const FormGroup = styled.div`
  margin-bottom: 25px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const RoleSelect = styled.select`
  width: 100%;
  padding: 10px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 15px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileLabel = styled.label`
  display: block;
  padding: 20px;
  border: 2px dashed #e9ecef;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8f9fa;

  &:hover {
    border-color: #4facfe;
    background: #e7f3ff;
  }
`;

const ImagePreview = styled.div`
  margin-top: 15px;
  display: none;

  img {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Input = styled.input`   /* ✅ New input for title */
  width: 100%;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
  }
`;

const Announce = () => {
  const [title, setTitle] = useState(''); // ✅ New title state
  const [announcementText, setAnnouncementText] = useState('');
  const [image, setImage] = useState(null);
  const [role, setRole] = useState('all');
  const navigate = useNavigate();

  const handleImageChange = (event) => {
    setImage(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!announcementText.trim()) {
      alert('Please write an announcement message');
      return;
    }

    const formData = new FormData();
    formData.append('title', title); // ✅ send title to backend
    formData.append('message', announcementText);
    formData.append('sendTo', role); // 'all' or 'team_leader'
    if (image) formData.append('image', image);

    try {
      const response = await fetch('http://localhost:5000/api/announcement', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      console.log(data);

      // Reset form
      setAnnouncementText('');
      setImage(null);
      setRole('all');
      alert('Announcement sent successfully!');
      navigate("/announcement"); // ✅ redirect back
    } catch (error) {
      console.error(error);
      alert('Failed to send announcement');
    }
  };

  return (
    <Container>
      <Header>
        <h1>Create Announcement</h1>
        <p>Share important updates with your team members</p>
      </Header>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Announcement Title</Label>
          <Input
            value={title}  // ✅ bind title
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title here..."
          />
        </FormGroup>
        
        <FormGroup>
          <Label>Announcement Message</Label>
          <TextArea
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="Type your important announcement here..."
          />
        </FormGroup>

        <FormGroup>
          <Label>Attach Image (Optional)</Label>
          <FileInput type="file" id="imageInput" accept="image/*" onChange={handleImageChange} />
          <FileLabel htmlFor="imageInput">📷 Click to upload an image</FileLabel>
          {image && (
            <ImagePreview style={{ display: 'block' }}>
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

        <SubmitButton type="submit">Send Announcement</SubmitButton>
      </Form>
    </Container>
  );
};

// Add these exports at the bottom of Announce.jsx
export {
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
  Input
};

export default Announce;
