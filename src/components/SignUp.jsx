import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const SignUp = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: ""
  });
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setFormData({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
          phone: ""
        });
        // Redirect to dashboard after success
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

        {/* Left side */}
        <div className="relative">
          <img
            src="register.png"
            alt="img"
            className="w-[400px] h-full hidden rounded-l-2xl md:block object-cover"
          />
        </div>

        {/* Right side */}
        <div className="flex flex-col justify-center p-8 md:p-14">
          <span className="mb-3 text-4xl font-bold" style={{ color: customColor }}>
            Welcome To Our Team!
          </span>
          <span className="font-light text-gray-400 mb-8">Please enter your details</span>

          <form onSubmit={handleSubmit} method="post">
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
            <div className="py-4">
              <span className="mb-2 text-md">Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>
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
              Sign up
            </button>
          </form>

          {message && <p className="text-center text-red-500">{message}</p>}

          <div className="text-center text-gray-400">
            Already have an account?{" "}
            <Link to="/signin" className="font-bold text-black hover:underline">
              Sign in
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SignUp;
