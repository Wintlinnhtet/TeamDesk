import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LeftSideBar from './components/LeftSideBar';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import AddMember from './components/AddMember';
import DashboardAdmin from './pages/Dashboard_admin';
import Task from './pages/task_employee';
import Task1 from './pages/task_admin';
import TaskAssign from './pages/task_assign';
import ProjectCreate from './pages/project_create';
import SignIn from './components/SignIn';
import FileManager from './pages/file_sharing';
import Profile from './pages/set_profile';
import Projects from './pages/Projects';
import Register from './components/Register';
import ProjectTasks from './pages/ProjectTasks';
import TaskDetail from './pages/TaskDetail';
import AllProjects from './pages/AllProjects';
import ActivityFeed from './components/ActivityFeed';
const App = () => {
  const customColor = "#AA405B";

  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root '/' to '/signin' */}
        <Route path="/" element={<Navigate to="/signin" replace />} />

        {/* Public routes without sidebar */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/register" element={<Register />} />
        <Route path="/add-member" element={<AddMember />} />

        {/* Protected routes with sidebar */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<DashboardAdmin />} />
          <Route path="/tasks" element={<Task />} />
          <Route path="/allprojects" element={<AllProjects />} />
          <Route path="/tasks_admin" element={<Task1 />} />
          <Route path="/task-detail/:taskId" element={<TaskDetail />} />
          <Route path="/assign-task" element={<TaskAssign />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/project-create" element={<ProjectCreate />} />
          <Route path="/members" element={<Members />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/file-sharing" element={<FileManager />} />
          <Route path="/project-tasks" element={<ProjectTasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
