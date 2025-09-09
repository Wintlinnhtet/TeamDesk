import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from "../config";

const SignIn = () => {
    const customColor = "#AA405B";
    const navigate = useNavigate();

    // form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
                setMessage(data.message || "Login successful");

                // Save user to localStorage
                localStorage.setItem("user", JSON.stringify(data.user));

                // Redirect based on role
                // if (data.user.role === "admin") {
                //     navigate("/admin");   // Admin goes to /admin
                // } else {
                //     navigate("/dashboard"); // Normal user goes to /dashboard
                // }
                 // 🔥 Redirect based on role and alreadyRegister
                    const { role, alreadyRegister } = data.user;

                        if (role === "admin") {
                        navigate("/admin");   // Admin goes to /admin
                        } else {
                            if (alreadyRegister) {
                            navigate("/dashboard"); // Registered users go to /dashboard
                         } else {
                            navigate("/register");  // Not registered users go to /register
                    }
            }

            } else {
                setMessage(data.error || 'Login failed');
            }

        } catch (err) {
            console.error(err);
            setMessage('Server error. Please try again later.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0">
                {/* Left side */}
                <div className="flex flex-col justify-center p-8 md:p-14">
                    <span className="mb-3 text-4xl font-bold" style={{ color: customColor }}>Welcome back!</span>
                    <span className="font-light text-gray-400 mb-8">
                        Please enter your details
                    </span>

                    <form onSubmit={handleSubmit}>
                        <div className="py-4">
                            <span className="mb-2 text-md">Email</span>
                            <input
                                type="text"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
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
                                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
                                required
                            />
                        </div>

                        {/* <div className="flex justify-between w-full py-4">
                            <div className="mr-24">
                                <input type="checkbox" name="ch" id="ch" className="mr-2" />
                                <span className="text-md">Remember password</span>
                            </div>
                            <span className="font-bold text-md">Forgot password?</span>
                        </div> */}

                        <button
                            type="submit"
                            style={{ backgroundColor: customColor }}
                            className="w-60 text-white p-2 rounded-full mx-auto block mt-4 mb-6 hover:bg-white hover:text-white hover:border hover:border-gray-300"
                        >
                            Sign in
                        </button>
                    </form>

                    {message && <p className="text-center text-red-500">{message}</p>}

                    {/* <div className="text-center text-gray-400">
                        Don't have an account?
                        <Link to="/" className="font-bold text-black hover:underline">Sign up</Link>
                    </div> */}
                </div>

                {/* Right side */}
                <div className="relative">
                    <img
                        src="register.png"
                        alt="img"
                        className="w-[400px] h-full hidden rounded-r-2xl md:block object-cover"
                    />
                    <div className="absolute hidden bottom-10 right-6 p-6 bg-white bg-opacity-30 backdrop-blur-sm rounded drop-shadow-lg md:block">
                        <span className="text-white text-xl">
                            We've been using Untitle to kick start every new project and can't imagine working without it.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignIn;
