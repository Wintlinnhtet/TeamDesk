import React from 'react';
import LeftSideBar from './LeftSideBar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  const user_id = 1; // or get this from auth context/state

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <div className="h-10 w-full" style={{ backgroundColor: "#AA405B" }}></div>

      <div className="flex flex-1">
        <div className="w-1/5 bg-gray-50">
          <LeftSideBar userId={user_id} />
        </div>

        <div className="w-4/5 bg-gray-50 p-4">
          <Outlet /> {/* renders nested routes */}
        </div>
      </div>

      <div className="h-10 w-full" style={{ backgroundColor: "#AA405B" }}></div>
    </div>
  );
};

export default Layout;
