import React from 'react';
import { useNavigate } from "react-router-dom";
import { FiPhone, FiMail } from 'react-icons/fi';
import { FaSearch } from 'react-icons/fa';

const Members = () => {
    const customColor = "#AA405B";
    const navigate = useNavigate();
  return (
   
    <div className="bg-gray-100 min-h-screen p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

  <div className="relative w-full md:w-1/2">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
        <FaSearch className="w-4 h-4" />
      </span>
      <input
        type="text"
        placeholder="Search"
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AA405B] shadow-sm"
      />
    </div>

  {/* Right Controls: Filter + Add */}
  <div className="flex items-center gap-4">
    <button className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-100">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 13.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 019 17v-3.586L3.293 6.707A1 1 0 013 6V4z" />
      </svg>
      Filter
    </button>

    <button className="bg-[#AA405B] text-white px-5 py-2 rounded-md"
    onClick={() => navigate("/add-member")}>
      + Add Candidate
    </button>
  </div>
</div>


      <h1 className="text-3xl font-semibold text-[#AA405B] mb-6">32 Employees</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white rounded-xl shadow-md p-5 flex-col items-center">
            <div className="relative w-full">
            <button className="absolute top-2 right-0 text-gray-400 hover:text-gray-600 text-3xl font-bold p-2">
              ⋯
            </button>

        </div>
          <div className="flex-col items-center mb-4">
            <img src="https://randomuser.me/api/portraits/men/10.jpg" alt="Profile" className="w-18 h-18 rounded-full mr-3" />
            <div>
              <h2 className="font-semibold text-lg">Bessie Cooper</h2>
              <p className="text-gray-500 text-sm">Project Manager</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Department:</strong> Design Team</p>
            <p><strong>Hired Date:</strong> 7/27/13</p>

            <p className="flex gap-2">
              <FiMail className="text-black  relative top-[2px] text-[18px]" />
              Ronald043@gmail.com
            </p>
            <p className="flex gap-2">
              <FiPhone className="text-black  relative top-[2px] text-[18px]" />
              (229) 555-0109
            </p>
            {/* <p><strong>Email:</strong> Ronald043@gmail.com</p>
            <p><strong>Phone:</strong> (229) 555-0109</p> */}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Members;

