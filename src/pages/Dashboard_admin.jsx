import React, { useEffect, useState } from 'react';
import TaskAssign from './task_assign';
import { useNavigate } from "react-router-dom";
const Dashboard = () => {
  const customColor = "#AA405B";
   const navigate = useNavigate();

    const [currentDate, setCurrentDate] = useState(new Date());
   useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    // Cleanup the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []);
 const formattedTime = currentDate.toLocaleTimeString();
  const formattedDate = currentDate.toLocaleDateString();
  return (
    <div className="ml-5 w-full">
      <h1 className="text-xl font-semibold text-black mt-2">Hi, Admin Name</h1>
      <p className="text-sm" style={{ color: customColor }}>Let's finish your task today!</p>

      <div className="flex">
        {/* LEFT COLUMN: Task + Assignments */}
        <div className="flex flex-col w-3/4 space-y-4 mr-3">

          {/* Today Task Card */}
          <div className="mt-3 shadow-md p-4 rounded-lg flex items-center h-50 bg-white">
            <div className="flex-1">
              <h2 className="text-xl font-bold" style={{ color: customColor }}>Today Task</h2>
              <p className="text-gray-600">Check your daily tasks and schedules</p>
              <button
        className="mt-4 text-white px-4 py-2 rounded-lg shadow-md"
        style={{ backgroundColor: customColor }}
        onClick={() => navigate("/project-create")}
      >
        Create Project
      </button>
  
            </div>
            <div className="mr-8">
              <img src="admin.png" alt="Task Icon" className="h-40 w-65" />
            </div>
          </div>

<div className="flex w-50 space-x-2 mt-3">
 <div className="flex space-x-2 ">
  {[
    {
      date: 'Mar 2, 2024',
      title: 'Web Dashboard',
      category: 'Designing',
      progress: 90,
      color: '#7C3AED', // purple
      daysLeft: '3 days left',
      badgeColor: 'bg-purple-100 text-purple-600',
    },
    {
      date: 'Mar 6, 2024',
      title: 'Mobile App',
      category: 'Shopping',
      progress: 30,
      color: '#3B82F6', // blue
      daysLeft: '25 days left',
      badgeColor: 'bg-blue-100 text-blue-600',
    },
    {
      date: 'Mar 8, 2024',
      title: 'Animation',
      category: 'Designing',
      progress: 75,
      color: '#F97316', // orange
      daysLeft: '7 days left',
      badgeColor: 'bg-orange-100 text-orange-600',
    },
  ].map((item, idx) => (
    <div
      key={idx}
      className=" rounded-xl p-4 w-56 shadow-md flex flex-col justify-between h-40"style={{ backgroundColor: customColor }}
    >
      <p className="text-xs text-white mb-1">{item.date}</p>
      <h3 className="font-semibold text-md text-white">{item.title}</h3>
      

      <div className="mt-1">
        <p className="text-xs text-white mb-1">Progress</p>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full"
            style={{ width: `${item.progress}%`, backgroundColor: item.color }}
          ></div>
        </div>
        <p className="text-xs text-right mt-1 text-white">{item.progress}%</p>
      </div>

      <div className="flex justify-between items-center mt-2">
        {/* Avatars (placeholder) */}
        <div className="flex -space-x-2">
          <img
            src="1person.jpg"
            alt="User 1"
            className="w-6 h-6 rounded-full border-2 border-white object-cover"
          />
          <img
            src="2person.jpg"
            alt="User 2"
            className="w-6 h-6 rounded-full border-2 border-white object-cover"
          />
        </div>

        {/* Days left badge */}
        <span
          className={`text-xs px-2 py-1 rounded-lg font-medium ${item.badgeColor}`}
        >
          {item.daysLeft}
        </span>
      </div>
    </div>
  ))}
</div>




</div>


        </div>

        {/* RIGHT COLUMN: Profile + Batchmates */}
        <div className="flex flex-col w-1/4 space-y-4 mr-10">

          {/* Profile Card */}
          <div className="p-3 rounded-lg bg-white">

  <div className="mb-2 border p-1 rounded-lg" style={{ border: '2px solid #AA405B' }}>
  <h2 className="text-lg font-bold ml-3" style={{ color: customColor }}>
    Previous projects
  </h2>
</div>


  <div className="w-3/4 mx-auto relative">
    {/* Vertical Line */}
    <div
      className="absolute transform -translate-x-1/2 bg-gray-300 w-1 h-full top-0"
    ></div>

    {/* Project Timeline Items */}
    {[ 
      { title: 'Colour Theory', date: '01 Feb 2024' },
      { title: 'Design system', date: '01 Feb 2024' },
      { title: 'User persona', date: '13 Mar 2024' },
      { title: 'Prototyping', date: '16 Mar 2024' },
    ].map((item, index) => (
      <div key={index} className="relative flex justify-start mb-3">
        {/* Left Circle */}
        <div
          className="absolute  transform -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center mt-1"
          style={{ backgroundColor: customColor }}
        >
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Project Information */}
        <div className="ml-4">
          <p className="text-sm font-medium text-black">{item.title}</p>
          <p className="text-xs text-gray-400 mb-2">{item.date}</p>
          <div 
  className="w-40 mt-2" 
  style={{ borderBottom: `2px solid #AA405B` }} 
></div>

        </div>
      
      </div>
      
    ))}
  </div>
</div>


          {/* Batchmates Card */}
          <div className="rounded-xl p-2 w-full mb-3 h-50" style={{ backgroundColor: customColor }}>
            <div
        className="p-6 rounded-lg shadow-xl text-white h-45"
        style={{
           backgroundImage: `url('/time.jpg')`, // Use imported image as background
            backgroundSize: 'contain',
          backgroundPosition: 'center center',
           
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Date */}
        <div className='flex items-center justify-center h-full'>
        <div className='text-center'>
        <h2 className="text-2xl font-bold" style={{ color: customColor }}>{formattedDate}</h2>

        {/* Time */}
        <p className="text-xl font-mono mt-4" style={{ color: customColor }}>{formattedTime}</p>
        </div>
        </div>
      </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
