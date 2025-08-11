import React, { useState } from 'react';

import { FaSearch, FaBell, FaChevronRight } from "react-icons/fa";

const tasks = [
  {
    name: "Seeking Money Investors",
    user: "Anna",
    color: "bg-teal-400",
    start: 6,
    end: 10,
  },
  {
    name: "Banner for Social Media",
    user: "John",
    color: "bg-rose-400",
    start: 7,
    end: 10,
  },
  {
    name: "A/B Testing Next",
    user: "",
    color: "bg-pink-200",
    start: 7,
    end: 11,
  },
  {
    name: "Backend and Database Setup",
    user: "",
    color: "bg-sky-400",
    start: 8,
    end: 11,
  },
  {
    name: "Product Launching 2.0",
    user: "",
    color: "bg-orange-300",
    start: 8,
    end: 11,
  },
  {
    name: "Final Financial Report",
    user: "Finance Team",
    color: "bg-indigo-500",
    start: 7,
    end: 12,
  },
];

const Task1 = () => {

  const [isOpen, setIsOpen] = useState(false);
     const customColor = "#AA405B";
  const days = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

  return (
    <div className="p-6 font-sans bg-white min-h-screen w-full flex">
      <div className="w-2/3 pr-4">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team's To-Do</h1>
          <div className="flex items-center space-x-4">
           
            <div className="relative">
               <span className="text-xl font-bold" style={{ color: customColor }}>Do your task in-time!</span>
            </div>
          </div>
        </header>
<div className="p-4 rounded-xl border border-gray-200 shadow-sm bg-white" >
        <div className="mb-2 text-sm text-gray-600">December 7, 2020</div>
        <div className="flex space-x-6 items-center mb-4 justify-center">
          {days.map((day, index) => (
            <div
  key={index}
  className={`text-center ${index === 4 ? "text-white rounded-full px-3 py-1" : "text-gray-600"}`}
  style={index === 4 ? { backgroundColor: customColor } : {}}
>

              <div className="text-sm font-semibold">{7 + index}</div>
              <div className="text-xs">{day}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-center w-full mt-9">
          <div className="space-y-3 w-2/3">
            {tasks.map((task, index) => (
              <div
                key={index}
                className={`rounded-full text-white px-4 py-2 flex items-center ${task.color}`}
                style={{
                  width: `${(task.end - task.start + 1) * 60}px`,
                  marginLeft: `${(task.start - 6) * 60}px`,
                }}
              >
                <div className="flex items-center space-x-2">
  <div className="w-7 h-7 rounded-full overflow-hidden">
    <img
      src="2person.jpg"
      alt="profile"
      className="w-full h-full object-cover"
    />
  </div>
  <span className="text-sm font-medium">{task.name}</span>
</div>

              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      <div className="w-1/3 pl-6 border-l border-gray-200">
     <div className="relative">
  {/* Toggle Area */}
  <div
    onClick={() => setIsOpen(!isOpen)}
    className="flex items-center justify-between mb-4 cursor-pointer"
  >
    <div className="flex items-center space-x-3">
      <img
        src="1person.jpg"
        alt="avatar"
        className="w-10 h-10 rounded-full"
      />
      <div>
        <div className="font-semibold">Lin Let Shwe Yi Khin</div>
        <div className="text-xs text-gray-500">llsyk@gmail.com</div>
      </div>
    </div>
    <FaBell style={{ color: customColor }} />
  </div>

  {/* Dropdown Panel */}
  {isOpen && (
    <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-md z-10">
      <ul className="text-sm text-gray-700 divide-y divide-gray-100">
        {[
          { name: "Lin Let Shwe Yi Khin", email: "llsyk@gmail.com" },
          { name: "John Doe", email: "john@example.com" },
          { name: "Alex Myint", email: "alex@gmail.com" },
          { name: "Yu Yu", email: "yuyu@gmail.com" },
        ].map((person, idx) => (
          <li
            key={idx}
            className="px-4 py-3 hover:bg-gray-100 cursor-pointer flex items-center space-x-3"
          >
            <img
              src="1person.jpg"
              alt="avatar"
              className="w-10 h-10 rounded-full"
            />
            <div>
              <div className="font-semibold">{person.name}</div>
              <div className="text-xs text-gray-500">{person.email}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )}
</div>


        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-teal-400 text-white text-center py-2 rounded-xl text-sm">
            <div className="font-bold text-lg">14</div>
            <div>Started</div>
          </div>
          <div className="bg-sky-400 text-white text-center py-2 rounded-xl text-sm">
            <div className="font-bold text-lg">10</div>
            <div>Progress</div>
          </div>
          <div className="bg-indigo-500 text-white text-center py-2 rounded-xl text-sm">
            <div className="font-bold text-lg">4</div>
            <div>Complete</div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-sky-500 rounded-full" />
              <div>
                <div className="text-sm font-semibold">Web Design</div>
                <div className="text-xs text-gray-400">Completed: 21 Nov</div>
              </div>
            </div>
            <FaChevronRight className="text-gray-400 text-xs" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-rose-400 rounded-full" />
              <div>
                <div className="text-sm font-semibold">Design System</div>
                <div className="text-xs text-gray-400">Completed: 24 Nov</div>
              </div>
            </div>
            <FaChevronRight className="text-gray-400 text-xs" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-orange-300 rounded-full" />
              <div>
                <div className="text-sm font-semibold">UX Research 101</div>
                <div className="text-xs text-gray-400">Completed: 30 Nov</div>
              </div>
            </div>
            <FaChevronRight className="text-gray-400 text-xs" />
          </div>
        </div>

        <div
  style={{ backgroundColor: customColor }}
  className="rounded-xl p-4 text-white"
>
          <div className="text-sm font-semibold mb-2">December 2020</div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm text-white">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <div key={d} className="font-medium text-xs text-white">{d}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => {
              const day = i + 1;
              const highlight = [7, 8, 9, 10].includes(day);
              return (
             <div
  key={day}
  className={`rounded-full p-1 ${highlight ? "text-black" : ""}`}
  style={highlight ? { backgroundColor: "white" } : {}}
>
  {day}
</div>


              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Task1;
