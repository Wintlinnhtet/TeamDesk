// import React, { useState } from 'react';

// const Profile = () => {
//   const customColor = "#AA405B";
  
//   // State for profile data and edit mode
//   const [profile, setProfile] = useState({
//     name: "Kim Jee Yumm",
//     role: "UI/UX Design Engineer",
//     location: "North Korea, Communist",
//     firstName: "Kim",
//     email: "Kimjee215@gmail.com",
//     jobRole: "Team Manager",
//     country: "North Korea",
//     postalCode: "ERT 2354"
//   });

//   const [isEditing, setIsEditing] = useState(false);

//   // Handle input changes
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setProfile(prev => ({
//       ...prev,
//       [name]: value
//     }));
//   };

//   // Toggle edit mode
//   const toggleEdit = () => {
//     setIsEditing(!isEditing);
//   };

//   return (
//     <div className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2" 
//          style={{ borderColor: customColor }}>
      
//       {/* Header Section */}
//       <div className="flex items-center justify-between mb-8">
//         <div>
//           <h2 className="text-2xl font-bold" style={{ color: customColor }}>Account Settings</h2>
//           <p className="text-sm text-gray-600">Manage your profile and account settings</p>
//         </div>
//         <img src="profile.png" alt="profile icon" className="w-16 h-16" />
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
//         {/* Main Content (now spans full width) */}
//         <div className="md:col-span-4">
//           {/* Profile Section */}
//           <div className="mb-8 p-6 bg-gray-50 rounded-lg">
//             <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
//                 style={{ color: customColor }}>
//               My Profile
//             </h3>
//             <div className="flex flex-col md:flex-row items-start gap-6">
//               <div className="flex-shrink-0">
//                 <img 
//                   src="2person.jpg" 
//                   alt="profile" 
//                   className="w-24 h-24 rounded-full object-cover border-2" 
//                   style={{ borderColor: customColor }}
//                 />
//               </div>
//               <div className="flex-grow">
//                 {isEditing ? (
//                   <div className="space-y-4">
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Full Name</label>
//                       <input
//                         type="text"
//                         name="name"
//                         value={profile.name}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Role</label>
//                       <input
//                         type="text"
//                         name="role"
//                         value={profile.role}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                   </div>
//                 ) : (
//                   <div>
//                     <h4 className="text-xl font-bold">{profile.name}</h4>
//                     <p className="text-gray-600">{profile.role}</p>
//                     <p className="text-gray-600">{profile.location}</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Information Sections */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {/* Personal Information */}
//             <div className="p-6 bg-gray-50 rounded-lg">
//               <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
//                   style={{ color: customColor }}>
//                 Personal Information
//               </h3>
//               <div className="space-y-4">
//                 {isEditing ? (
//                   <>
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Phone No.</label>
//                       <input
//                         type="phone"
//                         name="phone"
//                         value={profile.phone}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Email</label>
//                       <input
//                         type="email"
//                         name="email"
//                         value={profile.email}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                   </>
//                 ) : (
//                   <>
//                     <div>
//                       <p className="text-sm text-gray-500">First Name</p>
//                       <p className="font-medium">{profile.firstName}</p>
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-500">Email address</p>
//                       <p className="font-medium">{profile.email}</p>
//                     </div>
//                   </>
//                 )}
//               </div>
//             </div>

//             {/* Address */}
//             <div className="p-6 bg-gray-50 rounded-lg">
//               <h3 className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1" 
//                   style={{ color: customColor }}>
//                 Address
//               </h3>
//               <div className="space-y-4">
//                 {isEditing ? (
//                   <>
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Country</label>
//                       <input
//                         type="text"
//                         name="country"
//                         value={profile.country}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-sm text-gray-500 mb-1">Postal Code</label>
//                       <input
//                         type="text"
//                         name="postalCode"
//                         value={profile.postalCode}
//                         onChange={handleChange}
//                         className="w-full p-2 border rounded"
//                       />
//                     </div>
//                   </>
//                 ) : (
//                   <>
//                     <div>
//                       <p className="text-sm text-gray-500">Country</p>
//                       <p className="font-medium">{profile.country}</p>
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-500">Postal Code</p>
//                       <p className="font-medium">{profile.postalCode}</p>
//                     </div>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Edit/Save Button */}
//           <div className="mt-8 flex justify-end">
//             <button
//               onClick={toggleEdit}
//               className="px-6 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
//             >
//               {isEditing ? 'Save Changes' : 'Edit Profile'}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Profile;
import React, { useState, useEffect } from "react";

const Profile = () => {
  const customColor = "#AA405B";

  const [profile, setProfile] = useState(null); // Initially null
  const [isEditing, setIsEditing] = useState(false);

  // Get user ID from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Fetch user data from backend
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!user?._id) return;

        const res = await fetch(`http://localhost:5000/api/user/${user._id}`);
        const data = await res.json();
        if (data.success) setProfile(data.user);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, [user?._id]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Toggle edit mode
  const toggleEdit = () => {
    setIsEditing(!isEditing);
    // TODO: Send updated data to backend here if needed
  };

  if (!profile) return <p className="text-center mt-10">Loading profile...</p>;

  return (
    <div
      className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2"
      style={{ borderColor: customColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: customColor }}>
            Account Settings
          </h2>
          <p className="text-sm text-gray-600">
            Manage your profile and account settings
          </p>
        </div>
        {/* <img
          src={profile.profileImage ? `http://localhost:5000/uploads/${profile.profileImage}` : "https://randomuser.me/api/portraits/men/10.jpg"}
          alt="profile icon"
          className="w-16 h-16 rounded-full"
        /> */}
        <img
                    src={profile.profileImage || "https://randomuser.me/api/portraits/men/10.jpg"}
                    alt="profile"
                    className="w-16 h-16 rounded-full"
                    style={{ borderColor: customColor }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-4">
          {/* Profile Section */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3
              className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
              style={{ color: customColor }}
            >
              My Profile
            </h3>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                <img
                    src={profile.profileImage || "https://randomuser.me/api/portraits/men/10.jpg"}
                    alt="profile"
                    className="w-24 h-24 rounded-full object-cover border-2"
                    style={{ borderColor: customColor }}
                />

              </div>
              <div className="flex-grow">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    {/* <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        name="role"
                        value={profile.role}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div> */}
                  </div>
                ) : (
                  <div>
                    <h4 className="text-xl font-bold">{profile.name}</h4>
                    {/* <p className="text-gray-600">{profile.role}</p> */}
                    <p className="text-gray-600">{profile.position}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3
                className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
                style={{ color: customColor }}
              >
                Personal Information
              </h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={profile.email}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={profile.phone || ""}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{profile.phone}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="p-6 bg-gray-50 rounded-lg">
              {/* <h3
                className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
                style={{ color: customColor }}
              >
                Address
              </h3> */}
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={profile.address || ""}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="text"
                        name="dob"
                        value={profile.dob || ""}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        name="dob"
                        value={profile.role || ""}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{profile.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">{profile.dob}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="font-medium">{profile.role}</p>
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
              className="px-6 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition"
            >
              {isEditing ? "Save Changes" : "Edit Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

