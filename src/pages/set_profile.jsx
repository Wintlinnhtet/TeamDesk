import React, { useState, useEffect } from 'react';

const Profile = () => {
  const customColor = "#AA405B";
  
  // State for profile data and edit mode
  const [profile, setProfile] = useState({
    name: "",
    role: "",
    location: "",
    firstName: "",
    email: "",
    jobRole: "",
    country: "",
    postalCode: "",
    profileImageUrl: ""
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch profile data on component mount
  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch('http://localhost:5000/api/profile');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setError("Failed to load profile data. Please check if the server is running.");
      // Set fallback data
      setProfile({
        name: "Kim Jee Yumm",
        role: "UI/UX Design Engineer",
        location: "North Korea, Communist",
        firstName: "Kim",
        email: "Kimjee215@gmail.com",
        jobRole: "Team Manager",
        country: "North Korea",
        postalCode: "ERT 2354",
        profileImageUrl: ""
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle file selection for profile image
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size too large. Please select an image under 5MB.");
        return;
      }
      
      setSelectedFile(file);
      setError("");
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload profile image to backend
  const uploadProfileImage = async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('profileImage', selectedFile);
    
    try {
      setLoading(true);
      setError("");
      const response = await fetch('http://localhost:5000/api/upload-profile-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update profile with new image URL
      setProfile(prev => ({
        ...prev,
        profileImageUrl: data.imageUrl
      }));
      setPreviewImage(null);
      alert('Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Error uploading image: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    try {
      setLoading(true);
      setError("");
      // Remove the URL field before sending to backend
      const { profileImageUrl, ...profileData } = profile;
      
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      
      setProfile(result.user);
      alert('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Error updating profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle edit mode
  const toggleEdit = () => {
    if (isEditing) {
      saveProfileChanges();
    } else {
      setIsEditing(true);
    }
  };

  // Function to get the full image URL
  const getImageUrl = () => {
    if (previewImage) return previewImage;
    if (profile.profileImageUrl) 
      return profile.profileImageUrl;
    return "profile.png"; // Fallback image
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2 flex justify-center items-center h-64" 
           style={{ borderColor: customColor }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: customColor }}></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2" 
         style={{ borderColor: customColor }}>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError("")} className="absolute top-0 right-0 px-4 py-3">
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>
      )}
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: customColor }}>Account Settings</h2>
          <p className="text-sm text-gray-600">Manage your profile and account settings</p>
        </div>
        <img 
          src={getImageUrl()} 
          alt="profile icon" 
          className="w-16 h-16 rounded-full object-cover border-2"
          style={{ borderColor: customColor }}
          onError={(e) => {
            e.target.src = "profile.png"; // Fallback if image fails to load
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Main Content (now spans full width) */}
        <div className="md:col-span-4">
          {/* Profile Section */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
                style={{ color: customColor }}>
              My Profile
            </h3>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0 relative">
                <img 
                  src={getImageUrl()} 
                  alt="profile" 
                  className="w-24 h-24 rounded-full object-cover border-2" 
                  style={{ borderColor: customColor }}
                  onError={(e) => {
                    e.target.src = "profile.png"; // Fallback if image fails to load
                  }}
                />
                {isEditing && (
                  <>
                    <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-[#AA405B] text-white p-1 rounded-full cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </label>
                    <input 
                      id="profile-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileSelect}
                    />
                  </>
                )}
              </div>
              <div className="flex-grow">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Role</label>
                      <input
                        type="text"
                        name="role"
                        value={profile.role}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    {selectedFile && (
                      <button
                        onClick={uploadProfileImage}
                        className="px-4 py-1 bg-[#AA405B] text-white rounded text-sm"
                      >
                        Upload Image
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <h4 className="text-xl font-bold">{profile.name}</h4>
                    <p className="text-gray-600">{profile.role}</p>
                    <p className="text-gray-600">{profile.location}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Information Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
                  style={{ color: customColor }}>
                Personal Information
              </h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={profile.firstName}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={profile.email}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">First Name</p>
                      <p className="font-medium">{profile.firstName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email address</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
                  style={{ color: customColor }}>
                Address
              </h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Country</label>
                      <input
                        type="text"
                        name="country"
                        value={profile.country}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Postal Code</label>
                      <input
                        type="text"
                        name="postalCode"
                        value={profile.postalCode}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Country</p>
                      <p className="font-medium">{profile.country}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Postal Code</p>
                      <p className="font-medium">{profile.postalCode}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Edit/Save Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={toggleEdit}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;