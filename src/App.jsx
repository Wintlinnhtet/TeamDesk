import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LeftSideBar from './components/LeftSideBar';
import Dashboard from './pages/Dashboard';
import DashboardAdmin from './pages/Dashboard_admin';
import Task from './pages/task_employee';
import Task1 from './pages/task_admin';
import TaskAssign from './pages/task_assign';
import ProjectCreate from './pages/project_create';
import FileManager from './pages/file_sharing';

const App = () => {
  const customColor = "#AA405B";
  const user_id = 1; // Can be dynamically set later

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-gray-100">
        {/* Top Color Line */}
        <div className="h-10 w-full" style={{ backgroundColor: customColor }}></div>

        <div className="flex flex-1">
          {/* Sidebar */}
          <div className="w-1/5 text-white bg-gray-50">
           <LeftSideBar userId={user_id} />

          </div>

          {/* Main Content Area with Routes */}
          <div className="w-4/5 bg-gray-50 p-4">
            <Routes>
  <Route path="/" element={user_id === 1 ? <DashboardAdmin /> : <Dashboard />} />
  <Route path="/tasks" element={user_id === 1 ? <Task1 /> : <Task />} />
  <Route path="/assign-task" element={<TaskAssign />} />
  <Route path="/project-create" element={<ProjectCreate />} />
  <Route path="/file-sharing" element={<FileManager />} />
</Routes>

          </div>
        </div>

        {/* Bottom Color Line */}
        <div className="h-10 w-full" style={{ backgroundColor: customColor }}></div>
      </div>
    </BrowserRouter>
  );
};

export default App;
