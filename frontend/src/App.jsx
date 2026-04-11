// src/App.jsx

import React, { useState } from 'react';
import { io } from 'socket.io-client';
import { LayoutDashboard, Database, History, User } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import DataSensor from './pages/DataSensor';
import ActionHistory from './pages/ActionHistory';
import Profile from './pages/Profile';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [activePage, setActivePage] = useState('Dashboard');

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2 style={{ color: 'white' }}>My Smart Room</h2>
        <div className={`nav-item ${activePage === 'Dashboard' ? 'active' : ''}`} onClick={() => setActivePage('Dashboard')}>
          <LayoutDashboard size={20} /> Dashboard
        </div>
        <div className={`nav-item ${activePage === 'DataSensor' ? 'active' : ''}`} onClick={() => setActivePage('DataSensor')}>
          <Database size={20} /> Data sensor
        </div>
        <div className={`nav-item ${activePage === 'ActionHistory' ? 'active' : ''}`} onClick={() => setActivePage('ActionHistory')}>
          <History size={20} /> Action History
        </div>
        <div className={`nav-item ${activePage === 'Profile' ? 'active' : ''}`} onClick={() => setActivePage('Profile')}>
          <User size={20} /> Profile
        </div>
      </div>

      <div className="main-content">
        {activePage === 'Dashboard' && (
          <Dashboard socket={socket} isActive={activePage === 'Dashboard'} />
        )}

        {activePage === 'DataSensor' && (
          <DataSensor socket={socket} isActive={activePage === 'DataSensor'} />
        )}
        {activePage === 'ActionHistory' && (
          <ActionHistory socket={socket} isActive={activePage === 'ActionHistory'} />
        )}
        {activePage === 'Profile' && (
          <Profile />
        )}
      </div>
    </div>
  );
}

export default App;