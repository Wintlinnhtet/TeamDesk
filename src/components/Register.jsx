
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user._id;

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: ""
  });
  // const [profileImage, setProfileImage] = useState(null); // ✅ profile image state
  const [message, setMessage] = useState("");

  // Fetch existing user data to prefill form
  useEffect(() => {
    if (!userId) {
      navigate("/signin");
      return;
    }

    const fetchUserData = async () => {
      try {
        const res = await fetch(`http://localhost:5000/get-user/${userId}`);
        const data = await res.json();
        if (res.ok) {
          setFormData({
            ...formData,
            name: data.name || "",
            dob: data.dob || "",
            phone: data.phone || "",
            address: data.address || "",
            password: "",
            confirmPassword: ""
          });
        }
      } catch (err) {
        console.log("Error fetching user data:", err);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // const handleImageChange = (e) => {
  //   setProfileImage(e.target.files[0]);
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const formPayload = new FormData();
      formPayload.append("name", formData.name);
      formPayload.append("dob", formData.dob);
      formPayload.append("phone", formData.phone);
      formPayload.append("address", formData.address);
      formPayload.append("password", formData.password);

      // if (profileImage) {
      //   formPayload.append("profileImage", profileImage);
      // }

      const res = await fetch(`http://localhost:5000/update-user/${userId}`, {
        method: "PATCH",
        body: formPayload,
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Profile updated successfully!");
        navigate("/dashboard");
      } else {
        setMessage(data.error || "Something went wrong.");
      }
    } catch (error) {
      setMessage("Server error. Please try again later.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0">
        <div className="flex flex-col justify-center p-8 md:p-14">
          <span className="mb-3 text-4xl font-bold" style={{ color: customColor }}>
            Registration Form
          </span>
          <span className="font-light text-center text-gray-400 mb-8">
            Please enter your details
          </span>

          <form onSubmit={handleSubmit} method="post" encType="multipart/form-data">
            {/* Name */}
            <div className="py-4">
              <span className="mb-2 text-md">Full Name</span>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            {/* DOB */}
            <div className="py-4">
              <span className="mb-2 text-md">Date of Birth</span>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            {/* Phone */}
            <div className="py-4">
              <span className="mb-2 text-md">Phone No</span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            {/* Address */}
            <div className="py-4">
              <span className="mb-2 text-md">Address</span>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            {/* Profile Image */}
            {/* <div className="py-4">
              <span className="mb-2 text-md">Profile Image (Optional)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
              />
            </div> */}

            {/* Password */}
            <div className="py-4">
              <span className="mb-2 text-md">Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="py-4">
              <span className="mb-2 text-md">Confirm Password</span>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>

            <button
              type="submit"
              style={{ backgroundColor: customColor }}
              className="w-60 text-white p-2 rounded-full mx-auto block mt-4 mb-6"
            >
              Apply
            </button>
          </form>

          {message && <p className="text-center text-red-500">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default Register;

