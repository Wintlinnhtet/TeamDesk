import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react'; 


import { API_BASE } from "../config";   // adjust path if needed

const SignIn = () => {
    const customColor = "#AA405B"; // Custom color for the text
    const navigate = useNavigate(); // NEW: for redirecting after success

    // <-- NEW: form state to track input values
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // <-- NEW: message to show errors or success
  const [message, setMessage] = useState('');

  // <-- NEW: update formData state on input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // <-- NEW: handle form submit, call backend, handle response
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
        const res = await fetch(`${API_BASE}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        navigate('/dashboard'); // <-- NEW: redirect on success
      } else {
        setMessage(data.error || 'Login failed');
      }
    } catch {
      setMessage('Server error. Please try again later.');
    }
  };

  return (
   <div class="flex items-center justify-center min-h-screen bg-gray-100">
      <div
        class="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0"
      >
        {/* <!-- left side --> */}
        <div class="flex flex-col justify-center p-8 md:p-14">
          <span class="mb-3 text-4xl font-bold" style={{ color: customColor }}>Welcome back!</span>
          <span class="font-light text-gray-400 mb-8">
            Please enter your details
          </span>
          <form onSubmit={handleSubmit}>
          <div class="py-4">
            <span class="mb-2 text-md">Email</span>
            <input
              type="text"
              class="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
              name="email"
              id="email"
              value={formData.email} // <-- UPDATED: controlled input
              onChange={handleChange} // <-- UPDATED: input change handler
              required
            />
          </div>
          <div class="py-4">
            <span class="mb-2 text-md">Password</span>
            <input
              type="password"
              name="password"
              id="password"
              class="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
              value={formData.password} // <-- UPDATED: controlled input
              onChange={handleChange} // <-- UPDATED: input change handler
              required
            />
          </div>
          <div class="flex justify-between w-full py-4">
            <div class="mr-24">
              <input type="checkbox" name="ch" id="ch" class="mr-2" />
              <span class="text-md">Remember password</span>
            </div>
            <span class="font-bold text-md">Forgot password?</span>
          </div>
          <button
            type="submit" 
            style={{ backgroundColor: customColor }}
            class="w-60 text-white p-2 rounded-full mx-auto block mt-4 mb-6 hover:bg-white hover:text-white hover:border hover:border-gray-300"
          >
            Sign in
          </button>
          </form>
          {message && <p className="text-center text-red-500">{message}</p>}
          {/* <button
            class="w-full border border-gray-300 text-md p-2 rounded-lg mb-6 hover:bg-black hover:text-white"
          >
            <img src="google.svg" alt="img" class="w-6 h-6 inline mr-2" />
            Sign in with Google
          </button> */}
          {/* <div class="text-center text-gray-400">
            Dont'have an account?
            <span class="font-bold text-black">Sign up</span>
          </div> */}
          <div className="text-center text-gray-400">
                Don't have an account?
                <Link to="/" className="font-bold text-black hover:underline">Sign up</Link>
          </div>

        </div>
        {/* <!-- {/* right side */} 
        <div class="relative">
          <img
            src="register.png"
            alt="img"
            class="w-[400px] h-full hidden rounded-r-2xl md:block object-cover"
          />
          {/* <!-- text on image  --> */}
          <div
            class="absolute hidden bottom-10 right-6 p-6 bg-white bg-opacity-30 backdrop-blur-sm rounded drop-shadow-lg md:block"
          >
            <span class="text-white text-xl"
              >We've been uesing Untitle to kick"<br />start every new project
              and can't <br />imagine working without it."
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
