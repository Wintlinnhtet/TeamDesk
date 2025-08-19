import React from 'react';
import { BrowserRouter, Routes, Route, Router } from 'react-router-dom';
import Layout from './components/Layout'
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
const App = () => {
  const customColor = "#AA405B";
  const user_id = 1; // Can be dynamically set later

  return (
    <BrowserRouter>
   <Routes>
        {/* Public routes without sidebar */}
        {/* <Route path="/" element={<SignUp />} /> */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/add-member" element={<AddMember />} />
        <Route path="/register" element={<Register />} />

 {/* Protected routes with sidebar */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={user_id === 1 ? <DashboardAdmin /> : <Dashboard />} />
          <Route path="/tasks" element={user_id === 1 ? <Task1 /> : <Task />} />
          <Route path="/assign-task" element={<TaskAssign />} />  
           <Route path="/projects" element={<Projects />} />  
          <Route path="/project-create" element={<ProjectCreate />} />
          <Route path="/members" element={<Members />} />
          <Route path="/profile" element={<Profile />} />
           <Route path="/file-sharing" element={<FileManager />} />
        </Route>
    </Routes>
      

       

         

        
    </BrowserRouter>
  );
};

export default App;
