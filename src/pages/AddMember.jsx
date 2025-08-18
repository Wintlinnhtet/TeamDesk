import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";  
const AddMember = () => {
  const customColor = "#AA405B";
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    position: ""
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
      const res = await fetch(`${API_BASE}/add-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setFormData({
          email: "",
          position: ""
        });
        // Redirect to dashboard after success
      navigate("/members");
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
            Add Member
          </span>
          <span className="font-light text-gray-400 mb-8">Please enter member's details</span>

          <form onSubmit={handleSubmit} method="post">
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
              <span className="mb-2 text-md">Position</span>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div>
            
            {/* <div className="py-4">
              <span className="mb-2 text-md">Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md"
                required
              />
            </div> */}
            

            <button
              type="submit"
              style={{ backgroundColor: customColor }}
              className="w-60 text-white p-2 rounded-full mx-auto block mt-4 mb-6"
            >
              Add
            </button>
          </form>

          {message && <p className="text-center text-red-500">{message}</p>}

          
        </div>

      </div>
    </div>
  );
};

export default AddMember;





// import React from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useState } from 'react'; 



// const AddMember = () => {
//     const customColor = "#AA405B"; // Custom color for the text
//     // const navigate = useNavigate(); 

//     // <-- NEW: form state to track input values
//   const [formData, setFormData] = useState({
//     email: '',
//     position: '',
//   });

//   // <-- NEW: message to show errors or success
//   const [message, setMessage] = useState('');

//   // <-- NEW: update formData state on input change
//   const handleChange = (e) => {
//     setFormData({ ...formData, [e.target.name]: e.target.value });
//   };

//   // <-- NEW: handle form submit, call backend, handle response
//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     try {
//       const res = await fetch('http://localhost:5000/add-member', { // adjust URL if needed
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(formData),
//       });

//       const data = await res.json();

//       if (res.ok) {
//         setMessage(data.message);
//         setFormData({
//           email: "",
//           position: ""
//         });
//         // Redirect to dashboard after success
//       navigate("/dashboard");
//       } else {
//         setMessage(data.error || "Something went wrong.");
//       }
//     } catch {
//       setMessage('Server error. Please try again later.');
//     }
//   };

//   return (
//    <div class="flex items-center justify-center min-h-screen bg-gray-100">
//       <div
//         class="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0"
//       >
//         {/* <!-- left side --> */}
//         <div class="flex flex-col justify-center p-8 md:p-14">
//           <span class="mb-3 text-4xl font-bold" style={{ color: customColor }}>Add Member</span>
//           <span class="font-light text-gray-400 mb-8">
//             Please enter member's details
//           </span>
//           <form onSubmit={handleSubmit}>
//           <div class="py-4">
//             <span class="mb-2 text-md">Email</span>
//             <input
//               type="text"
//               class="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
//               name="email"
//               id="email"
//               value={formData.email} // <-- UPDATED: controlled input
//               onChange={handleChange} // <-- UPDATED: input change handler
//               required
//             />
//           </div>
//           <div class="py-4">
//             <span class="mb-2 text-md">Position</span>
//             <input
//               type="text"
//               name="position"
//               id="position"
//               class="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
//               value={formData.position} // <-- UPDATED: controlled input
//               onChange={handleChange} // <-- UPDATED: input change handler
//               required
//             />
//           </div>
//           {/* <div class="py-4">
//             <span class="mb-2 text-md">Password</span>
//             <input
//               type="password"
//               name="password"
//               id="password"
//               class="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#AA405B] rounded-md placeholder:font-light placeholder:text-gray-500"
//               value={formData.password} // <-- UPDATED: controlled input
//               onChange={handleChange} // <-- UPDATED: input change handler
//               required
//             />
//           </div> */}
          
//           <button
//             type="submit" 
//             style={{ backgroundColor: customColor }}
//             class="w-60 text-white p-2 rounded-full mx-auto block mt-4 mb-6 hover:bg-white hover:text-white hover:border hover:border-gray-300"
//           >
//             Add
//           </button>
//           </form>
//           {message && <p className="text-center text-red-500">{message}</p>}
//           {/* <button
//             class="w-full border border-gray-300 text-md p-2 rounded-lg mb-6 hover:bg-black hover:text-white"
//           >
//             <img src="google.svg" alt="img" class="w-6 h-6 inline mr-2" />
//             Sign in with Google
//           </button> */}
//           {/* <div class="text-center text-gray-400">
//             Dont'have an account?
//             <span class="font-bold text-black">Sign up</span>
//           </div> */}
          

//         </div>
//         {/* <!-- {/* right side */} 
//         <div class="relative">
//           <img
//             src="register.png"
//             alt="img"
//             class="w-[400px] h-full hidden rounded-r-2xl md:block object-cover"
//           />
//           {/* <!-- text on image  --> */}
//           {/* <div
//             class="absolute hidden bottom-10 right-6 p-6 bg-white bg-opacity-30 backdrop-blur-sm rounded drop-shadow-lg md:block"
//           >
//             <span class="text-white text-xl"
//               >We've been uesing Untitle to kick"<br />start every new project
//               and can't <br />imagine working without it."
//             </span>
//           </div> */}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AddMember;
