import React, { useState } from "react";
import { FaPlus } from "react-icons/fa";

const ProjectCreate = () => {
  const [selectedEmployees, setSelectedEmployees] = useState([
    "Lin Let",
    "Rika Lix",
    "Gaou Tu",
  ]);

  const [newEmployee, setNewEmployee] = useState("");
const customColor = "#AA405B";
  const addEmployee = () => {
    if (newEmployee.trim() && !selectedEmployees.includes(newEmployee)) {
      setSelectedEmployees([...selectedEmployees, newEmployee.trim()]);
      setNewEmployee("");
    }
  };

  return (
    <div className="bg-white max-w-xl mx-auto mt-6 mb-6 p-6 rounded-2xl shadow-md  border-2" style={{ borderColor: "#AA405B" }}>
       <div className="flex items-center gap-4 mb-6">
        <div>
      <h2 className="text-xl font-semibold mb-1" style={{ color: customColor }}>Create New project</h2>
      <p className="text-sm text-black mb-4">
        Set project shift for your time work.
      </p>
      </div>
      <img src="pj.png" alt="icon" className=" ml-10 w-18 h-18 " />
      </div>

      {/* Add Employee */}
      <div className="mb-4">
        <label className="block text-base font-medium mb-1 border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>
          Add Employee New Registered
        </label>
        <div className="flex gap-2 mt-5">
          <input
            value={newEmployee}
            onChange={(e) => setNewEmployee(e.target.value)}
            placeholder="Add new employee for project"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm "
          />
           <button
            onClick={addEmployee}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#AA405B] text-white hover:bg-[#902E48] transition-all duration-200 shadow-md"
          >
            + Add Employee
          </button>
        </div>
      </div>

      {/* Current Employees */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>Current Employee</label>
        <div className="flex flex-wrap gap-2">
          {selectedEmployees.map((name, idx) => (
            <div
              key={idx}
              className=" flex items-center gap-2 px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: customColor }}
            >
              <img
                src="3person.jpg"
                alt="avatar"
                className="rounded-full w-6 h-6"
              />
              {name}
              <button
                onClick={() =>
                  setSelectedEmployees(
                    selectedEmployees.filter((n) => n !== name)
                  )
                }
                className="ml-1 text-white"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shift Duration */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>Shift Duration</label>
        <input
          type="text"
          value="2 days"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          disabled
        />
      </div>

      {/* Start Shift */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>Start Shift</label>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            defaultValue="2024-12-29"
          />
          <input
            type="time"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            defaultValue="21:00"
          />
        </div>
      </div>

     

      {/* End Shift */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: customColor }}>End Shift</label>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            defaultValue="2024-12-31"
          />
          <input
            type="time"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            defaultValue="22:00"
          />
        </div>
      </div>

      {/* Set for week/month */}
      <div className="flex flex-col gap-2 mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
          <input type="checkbox" /> Set this for a week
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked readOnly /> Set this for a month
        </label>
      </div>

      {/* Buttons */}
      <div className="flex justify-between">
      
        <button className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition">
          Cancel
        </button>
        <button className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition">
          Add Project
        </button>
      </div>
    </div>
  );
};

export default ProjectCreate;
