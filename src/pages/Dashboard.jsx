import React from 'react';

const Dashboard = () => {
  const customColor = "#AA405B";
  const batchmates = [
    { name: 'Rinsen Jey', title: 'UI/UX Designer', img: '1person.jpg' },
    { name: 'Kim Jee yong', title: 'UI/UX Designer', img: '2person.jpg' },
    { name: 'Kim Jee yong', title: 'UI/UX Designer', img: '3person.jpg' },
  ];

  return (
    <div className="ml-5 w-full">
      <h1 className="text-xl font-semibold text-black mt-2">Hello</h1>
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
              >
                Today's schedule
              </button>
            </div>
            <div className="mr-8">
              <img src="task.png" alt="Task Icon" className="h-30 w-55" />
            </div>
          </div>

<div className="flex w-full space-x-4 mt-6">
 <div className="w-1/2 bg-white p-4 rounded-xl shadow-md relative">
  <h2 className="text-lg font-semibold text-gray-800 mb-4 ml-8">Previous Experience</h2>

  {/* Timeline vertical line */}
  <div className="absolute left-2 top-5 bottom-16 w-0.5 z-0 ml-6" style={{ backgroundColor: customColor }}></div>

  {/* Experience 1 */}
  <div className="relative pl-6 mb-6 z-10 ml-8">
    <div className="absolute left-0 top-1 w-3 h-3 rounded-full" style={{ backgroundColor: customColor }}></div>
    <h3 className="font-semibold text-sm text-gray-800">🧑‍💻 Lead UI/UX designer</h3>
    <p className="text-sm text-gray-600">Last Month</p>
    <p className="text-xs" style={{ color: customColor }}>Bank System Project</p>
  </div>

  {/* Experience 2 */}
  <div className="relative pl-6 z-10 ml-8">
    <div className="absolute left-0 top-1 w-3 h-3 rounded-full" style={{ backgroundColor: customColor }}></div>
    <h3 className="font-semibold text-sm text-gray-800">🧑‍💻 Senior UI/UX Designer</h3>
    <p className="text-sm text-gray-600">Two Months Ago</p>
    <p className="text-xs" style={{ color: customColor }}>Tracking System</p>
  </div>

  {/* See More Button */}
  <div className="text-center mt-6">
    <button
      className="px-4 py-2 text-sm font-medium rounded-full shadow-md border transition-all duration-200 hover:shadow-lg"
      style={{
        color: customColor,
        borderColor: customColor,
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = customColor;
        e.target.style.color = 'white';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = 'white';
        e.target.style.color = customColor;
      }}
    >
      See More
    </button>
  </div>
</div>


<div className="bg-white rounded-xl p-4 w-1/2 shadow-md flex justify-between items-start">
  {/* Left Content */}
  <div className="w-3/4">
    <div className="flex justify-between items-center mb-2">
      <h2 className="text-lg font-semibold" style={{ color: customColor }}>
        File Uploaded <span className="text-sm" style={{ color: customColor }}>(12)</span>
      </h2>
    </div>

    {[
      { title: 'Colour Theory', date: '01 Feb 2024' },
      { title: 'Design system', date: '01 Feb 2024' },
      { title: 'User persona', date: '13 Mar 2024' },
      { title: 'Prototyping', date: '16 Mar 2024' },
    ].map((item, index) => (
      <div key={index} className="flex justify-between items-start mb-3">
        <div className="flex items-start space-x-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center mt-1"
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

          <div>
            <p className="text-sm font-medium text-black">{item.title}</p>
            <p className="text-xs text-gray-400 mb-2">{item.date}</p>
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* Right Image */}
  <div className="w-1/4 flex justify-end mt-10 mr-5">
    <img
      src="file.png"
      alt="File Icon"
      className="w-30 h-30 object-contain" 
    />
  </div>
</div>

</div>


        </div>

        {/* RIGHT COLUMN: Profile + Batchmates */}
        <div className="flex flex-col w-1/4 space-y-4 mr-10">

          {/* Profile Card */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: customColor }}>
            <h2 className="text-xl font-bold text-white">Kim Namjoon</h2>
            <p className="text-white">UI/UX Designer</p>

            <div className="mt-4">
              <div className="flex justify-between">
                <span className="text-white font-semibold">March</span>
                <span className="text-white font-semibold">6, Wed</span>
              </div>

              <div className="mt-2 space-y-2 bg-white shadow-md p-4 rounded-lg">
                <div className="flex justify-between p-2 bg-white rounded-lg shadow-md relative">
                  <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: customColor }}></div>
                  <span className="ml-2">09:00</span>
                  <span className="" style={{ color: customColor }}>UI Motion</span>
                </div>

                <div className="flex justify-between p-2 bg-white rounded-lg shadow-md relative">
                  <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: customColor }}></div>
                  <span className="ml-2">10:00</span>
                  <span className="" style={{ color: customColor }}>UI Design</span>
                </div>

                <div className="text-center mt-4">
                  <button
                    className="px-4 py-2 bg-white text-gray-600 rounded-lg shadow-md border-2 transition-colors"
                    style={{
                      color: customColor,
                      borderColor: customColor,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = customColor;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.color = customColor;
                    }}
                  >
                    See More
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Batchmates Card */}
          <div className="rounded-xl p-2 w-full mb-3" style={{ backgroundColor: customColor }}>
            <h2 className="text-center font-semibold text-lg mb-4 text-white">Batchmates</h2>

            {batchmates.map((mate, index) => (
              <div key={index} className="flex items-center bg-white rounded-lg p-2 mb-2">
                <img src={mate.img} alt={mate.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">{mate.name}</p>
                  <p className="text-xs" style={{ color: customColor }}>{mate.title}</p>
                </div>
              </div>
            ))}

            <button className="bg-white w-full text-sm font-medium py-1 mt-2 rounded-lg shadow hover:bg-gray-100">
              See all
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
