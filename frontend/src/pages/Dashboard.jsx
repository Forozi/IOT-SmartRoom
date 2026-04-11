// src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sun, Thermometer, Droplets } from 'lucide-react';
import './Dashboard.css';

const DeviceControl = ({ name, deviceId, status, onControl }) => (
  <div className="control-section">
    <div className="btn-label">{name}</div>
    {status === "LOADING" ? (
      <div className="btn-loading">LOADING</div>
    ) : (
      <div style={{ display: 'flex', gap: '5px' }}>
        <button className="btn-on" style={{ opacity: status === "ON" ? 1 : 0.5 }} onClick={() => onControl(deviceId, true)}>ON</button>
        <button className="btn-off" style={{ opacity: status === "OFF" ? 1 : 0.5 }} onClick={() => onControl(deviceId, false)}>OFF</button>
      </div>
    )}
  </div>
);

const Dashboard = ({ socket, isActive }) => {
  const [sensors, setSensors] = useState({ temp: 0, hum: 0, light: 0 });
  const [deviceStatus, setDeviceStatus] = useState({ LED_1: 'OFF', LED_2: 'OFF', LED_3: 'OFF' });
  const [chartData, setChartData] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [todaySummary, setTodaySummary] = useState(null);
  const [lastSummaryUpdate, setLastSummaryUpdate] = useState('');

  useEffect(() => {
    if (!isActive) return;

    // 1. Initial Device Status Fetch
    axios.get('http://localhost:5000/api/current-status').then(res => {
      setDeviceStatus(res.data);
    });

    // 2. Real-time Sensor Updates
    const handleSensorUpdate = (data) => {
      if (data.temp === null) {
        setIsOnline(false);
      } else {
        setIsOnline(true);
        setSensors(data);
      }
      setChartData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: data.temp,
          hum: data.hum,
          light: data.light
        }];
        return newData.slice(-20);
      });
    };

    // 3. Real-time Device Updates
    const handleDeviceUpdate = (data) => {
      setDeviceStatus(prevStatus => ({ ...prevStatus, [data.device]: data.state }));
      setIsOnline(true);
    };

    socket.on('sensor_update', handleSensorUpdate);
    socket.on('device_update', handleDeviceUpdate);

    return () => {
      socket.off('sensor_update', handleSensorUpdate);
      socket.off('device_update', handleDeviceUpdate);
    };
  }, [socket, isActive]);

  // 4. Polling for Today's Summary Data
  useEffect(() => {
    const fetchSummaryData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/today-summary');
        setTodaySummary(res.data);
        setLastSummaryUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (error) {
        console.error("Failed to fetch summary data:", error);
      }
    };

    if (isActive) {
      fetchSummaryData();
      const intervalId = setInterval(fetchSummaryData, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isActive]);

  const handleControl = async (ledNumber, targetState) => {
    const deviceName = `LED_${ledNumber}`;
    setDeviceStatus(prev => ({ ...prev, [deviceName]: "LOADING" }));
    try {
      await axios.post('http://localhost:5000/api/control', { cmd: "device_action", led: ledNumber, state: targetState });
    } catch (err) {
      console.error("Control Error:", err);
      axios.get('http://localhost:5000/api/current-status').then(res => setDeviceStatus(res.data));
    }
  };

  return (
    <>
      <h1 className="dashboard-header">Dashboard</h1>
      <div className="dashboard-grid">

        <div className="charts-area">
          <div className="chart-card">
            <h3>Brightness graph</h3>
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line connectNulls={false} type="monotone" dataKey="light" stroke="#ef4444" dot={false} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h3>Temp and humidity graph</h3>
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line connectNulls={false} type="monotone" dataKey="temp" stroke="#f59e0b" dot={false} strokeWidth={3} />
                  <Line connectNulls={false} type="monotone" dataKey="hum" stroke="#3b82f6" dot={false} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {todaySummary && (
            <div className="summary-card">
              <div className="summary-title">
                <h4>Today's Data</h4>
                <span className="last-update-text">Last update: {lastSummaryUpdate}</span>
              </div>
              <div className="summary-stats">
                <div>
                  <p>Avg Temp: <strong>{todaySummary.avg_temp.toFixed(1)}°C</strong></p>
                  <p>Avg Hum: <strong>{todaySummary.avg_hum.toFixed(1)}%</strong></p>
                  <p>Avg Light: <strong>{todaySummary.avg_light != null ? todaySummary.avg_light.toFixed(1) : "N/A"}</strong></p>
                </div>
                <div>
                  <p>Highest Temp: <strong>{todaySummary.max_temp.toFixed(1)}°C</strong></p>
                  <p>Highest Hum: <strong>{todaySummary.max_hum.toFixed(1)}%</strong></p>
                  <p>Highest Light: <strong>{todaySummary.max_light != null ? todaySummary.max_light.toFixed(1) : "N/A"}</strong></p>
                </div>
                <div>
                  <p>Lowest Temp: <strong>{todaySummary.min_temp.toFixed(1)}°C</strong></p>
                  <p>Lowest Hum: <strong>{todaySummary.min_hum.toFixed(1)}%</strong></p>
                  <p>Lowest Light: <strong>{todaySummary.min_light != null ? todaySummary.min_light.toFixed(1) : "N/A"}</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sensor-stack">
          <div className={`sensor-card light-card ${!isOnline ? 'card-error' : ''}`}>
            <div className="card-left"><Sun /></div>
            <div className="card-right">
              <h3>Light</h3>
              <h2>{isOnline ? sensors.light : "N/A"}</h2>
              <p className={isOnline ? 'status-ok' : 'status-error'}>{isOnline ? "System: OK" : "System: ERROR"}</p>
              <DeviceControl name="LAMP" deviceId={1} status={deviceStatus.LED_1} onControl={handleControl} />
            </div>
          </div>

          <div className={`sensor-card temp-card ${!isOnline ? 'card-error' : ''}`}>
            <div className="card-left"><Thermometer /></div>
            <div className="card-right">
              <h3>Temperature</h3>
              <h2>{isOnline ? `${sensors.temp}°C` : "N/A"}</h2>
              <p className={isOnline ? 'status-ok' : 'status-error'}>{isOnline ? "System: OK" : "System: ERROR"}</p>
              <DeviceControl name="AC" deviceId={2} status={deviceStatus.LED_2} onControl={handleControl} />
            </div>
          </div>

          <div className={`sensor-card hum-card ${!isOnline ? 'card-error' : ''}`}>
            <div className="card-left"><Droplets /></div>
            <div className="card-right">
              <h3>Humidity</h3>
              <h2>{isOnline ? `${sensors.hum}%` : "N/A"}</h2>
              <p className={isOnline ? 'status-ok' : 'status-error'}>{isOnline ? "System: OK" : "System: ERROR"}</p>
              <DeviceControl name="FAN" deviceId={3} status={deviceStatus.LED_3} onControl={handleControl} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
