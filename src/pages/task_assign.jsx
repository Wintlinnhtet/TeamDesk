import React, { useState } from "react";

const TaskAssign = () => {
  const [assignedTo, setAssignedTo] = useState("Yin Mon Win");
  const [leadProject, setLeadProject] = useState("Lin Let");
  const [taskTitle, setTaskTitle] = useState("Research payment flow");
  const [startDate, setStartDate] = useState("2025-01-10");
  const [endDate, setEndDate] = useState("2025-01-12");
  const [tags, setTags] = useState(["Web Design", "User Research"]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const customColor = "#AA405B";

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  return (
<div
  className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2"
  style={{ borderColor: "#AA405B" }}
>

       <div className="flex items-center gap-4 mb-6">
        
        <div>
          <h2 className="text-2xl font-bold "style={{ color: customColor }}>Assign Task</h2>
          <p className="text-sm text-black">Assign task for people join to team</p>
        </div>
        <img src="assign.png" alt="icon" className=" ml-10 w-18 h-18 " />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Assign to</label>
          <select className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]" value={assignedTo}>
            <option>Yin Mon Win</option>
            <option>Wint Lin Htet</option>
            <option>Ye Yint Phay</option>
            <option>Nyi Sis Naing</option>
          </select>
        </div>

        <div>
          <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Lead Project</label>
          <select className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]" value={leadProject}>
            <option>Lin Let</option>
          </select>
        </div>

        <div>
          <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Task Title</label>
          <input
            type="text"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]"
            value={taskTitle}
          />
        </div>

        <div>
          <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Tags</label>
          <div className="flex gap-2 flex-wrap mt-2 bg-white p-3 rounded-lg">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="bg-[#AA405B] text-white text-xs font-medium px-3 py-1 rounded-full"
            >
              {tag} ❌
            </span>
          ))}
        </div>
        </div>

        <div>
        <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Start Date</label>
          <input
            type="date"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
<label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>End Date</label>
          <input
            type="date"
            className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      
      <div className="mt-6">
      <label className="block text-base font-semibold  border-b-4 border-[#AA405B] inline-block pb-1" style={{ color: customColor }}>Description</label>
        <textarea
          className="mt-2 block w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[${customColor}]"
          placeholder="Descript your experience here!"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>
      </div>

 <div className="flex justify-between mt-8">
        <button className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition">
          Save as Draft
        </button>
        <div className="flex gap-2">
          <button className="px-5 py-2 rounded-lg bg-[#E7D4D8] text-[#AA405B] font-semibold hover:bg-[#d5bfc4] transition">
            Reset Data
          </button>
          <button className="px-5 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition">
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskAssign;
