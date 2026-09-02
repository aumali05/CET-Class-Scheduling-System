import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className={`flex-1 flex flex-col ${isHomePage ? 'overflow-hidden' : ''}`}>
        <div className={`flex-1 p-0 bg-[#f8f8f8] ${isHomePage ? 'overflow-x-hidden' : 'overflow-auto'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

