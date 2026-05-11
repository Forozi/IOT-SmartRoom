// src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sun, Thermometer, Droplets, Volume2, Wind, Zap } from 'lucide-react';
import { CONFIG } from '../config';
import './Dashboard.css';

const DeviceControl = ({ name, deviceId, status, onControl, isLoading }) => (
  <div className="control-section">
    <div className="btn-label">{name}</div>
    {isLoading ? (
      <div className="btn-loading" style={{
        width: '100%',
        height: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#666'
      }}>
        LOADING...
      </div>
    ) : (
      <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
        <button
          className="btn-on"
          onClick={() => onControl(deviceId, true)}
          disabled={status === 'ON'}
          style={{
            opacity: status === 'ON' ? 1 : 0.5,
            cursor: status === 'ON' ? 'default' : 'pointer',
            border: status === 'ON' ? '2px solid #000' : '1px solid #777'
          }}
        >
          ON
        </button>
        <button
          className="btn-off"
          onClick={() => onControl(deviceId, false)}
          disabled={status === 'OFF'}
          style={{
            opacity: status === 'OFF' ? 1 : 0.5,
            cursor: status === 'OFF' ? 'default' : 'pointer',
            border: status === 'OFF' ? '2px solid #000' : '1px solid #777'
          }}
        >
          OFF
        </button>
      </div>
    )}
  </div>
);

const Dashboard = ({ socket, isActive }) => {
  const [sensors, setSensors] = useState({ temp: null, hum: null, light: null });
  const [deviceStatus, setDeviceStatus] = useState({
    LED_1: 'OFF', LED_2: 'OFF', LED_3: 'OFF', LED_4: 'OFF', LED_5: 'OFF'
  });
  const [pendingActions, setPendingActions] = useState({
    LED_1: 0, LED_2: 0, LED_3: 0, LED_4: 0, LED_5: 0
  });

  const [chartData, setChartData] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [todaySummary, setTodaySummary] = useState(null);
  const [lastSummaryUpdate, setLastSummaryUpdate] = useState('');

  // Thresholds (Normalized 0-100)
  const lightThresholdLow = (1500 / 4096) * 100; // ~36.6
  const lightThresholdHigh = (3000 / 4096) * 100; // ~73.2

  const isLightWarning = isOnline && (sensors.light < lightThresholdLow || sensors.light > lightThresholdHigh);
  const isTempWarning = isOnline && (sensors.temp < 15);
  const isHumWarning = isOnline && (sensors.hum < 20);

  const getStatus = (specificWarning = false) => {
    if (!isOnline) return { text: "System: ERROR", class: "status-error" };
    if (specificWarning) return { text: "System: WARNING", class: "status-warning" };
    return { text: "System: OK", class: "status-ok" };
  };

  const systemStatus = !isOnline ? "ERROR" : (isLightWarning || isTempWarning || isHumWarning ? "WARNING" : "OK");

  // API Functions
  const fetchCurrentStatus = async () => {
    try {
      const res = await axios.get(CONFIG.API_ENDPOINTS.CURRENT_STATUS);
      // Only sync if not currently waiting for a user action
      setDeviceStatus(prev => {
        const next = { ...prev };
        Object.keys(res.data).forEach(dev => {
          // Only trust server if we don't have a pending local action
          if (pendingActions[dev] === 0) {
            next[dev] = res.data[dev].current_state;
          }
        });
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummaryData = async () => {
    try {
      const res = await axios.get(CONFIG.API_ENDPOINTS.TODAY_SUMMARY);
      setTodaySummary(res.data);
      setLastSummaryUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (error) {
      console.error("Failed to fetch summary data:", error);
    }
  };

  const fetchChartData = async () => {
    try {
      const res = await axios.get(`${CONFIG.API_BASE_URL}/api/sensor-data?limit=20`);
      if (res.data && res.data.data) {
        const historical = res.data.data.map(d => ({
          time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: d.temp,
          hum: d.hum,
          light: d.light
        })).reverse();
        setChartData(historical);

        if (res.data.data.length > 0) {
          const latest = res.data.data[0];
          if (latest.temp !== null && latest.hum !== null && latest.light !== null) {
            setSensors({ temp: latest.temp, hum: latest.hum, light: latest.light });
            setIsOnline(true);
          } else {
            setIsOnline(false);
          }
        } else {
          setIsOnline(false);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
    }
  };

  const handleControl = async (ledNumber, targetState) => {
    const deviceName = `LED_${ledNumber}`;
    const targetStateStr = targetState ? "ON" : "OFF";
    console.log(`[UI] Clicking ${deviceName} -> ${targetStateStr}`);

    // Trigger LOADING state via pendingActions count
    setPendingActions(prev => ({ ...prev, [deviceName]: prev[deviceName] + 1 }));

    try {
      await axios.post(CONFIG.API_ENDPOINTS.CONTROL, { cmd: "device_action", led: ledNumber, state: targetState });
      console.log(`[UI] API request sent for ${deviceName}`);
    } catch (err) {
      console.error("[UI ERROR] Control Error:", err);
      // Decrement on error to unlock and restore previous state
      setPendingActions(prev => ({ ...prev, [deviceName]: Math.max(0, prev[deviceName] - 1) }));
      fetchCurrentStatus();
    }
  };

  useEffect(() => {
    if (!isActive) return;

    // ON OFF FETCH LAST STATE FROM DB
    fetchCurrentStatus();
    // GET DATA FOR GRAPH AND SUMMARY
    fetchChartData();
    fetchSummaryData();

    // GET DATA FOR CHART FROM SOCKET
    const handleSensorUpdate = (data) => {
      if (data.temp === null || data.hum === null || data.light === null) {
        setIsOnline(false);
      } else {
        setIsOnline(true);
        setSensors(data); // update values
      }
      setChartData(prev => { //set data for chart
        const newData = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: data.temp,
          hum: data.hum,
          light: data.light
        }];
        return newData.slice(-20); // show only last 20 data
      });
    };

    // ON OFF SUCCESS
    const handleDeviceUpdate = (data) => {
      console.log(`[SOCKET] Received update for ${data.device}: ${data.state}`);
      setDeviceStatus(prev => ({ ...prev, [data.device]: data.state })); //update state
      //263 279 295
      setPendingActions(prev => ({ ...prev, [data.device]: Math.max(0, prev[data.device] - 1) })); //unlock (loading)
      setIsOnline(true);
    };

    socket.on('sensor_update', handleSensorUpdate); //socket received
    socket.on('device_update', handleDeviceUpdate); //socket received

    return () => {
      socket.off('sensor_update', handleSensorUpdate);
      socket.off('device_update', handleDeviceUpdate);
    };
  }, [socket, isActive]);

  // Today's Summary Data every 30 secs
  useEffect(() => {
    if (isActive) {
      fetchSummaryData();

      const intervalId = setInterval(() => {
        fetchSummaryData();
      }, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isActive]);
  // pendingaction +1 then -1 when recevied
  const isDeviceLoading = (dev) => pendingActions[dev] > 0 || deviceStatus[dev] === "LOADING";

  return (
    <>
      <div className="dashboard-grid">

        <div className="charts-area">
          <div className="chart-card">
            <h3>Master Sensor Graph</h3>
            <div style={{ height: '400px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {/* received data to display */}
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line isAnimationActive={false} connectNulls={false} type="linear" dataKey="temp" name="Temperature (°C)" stroke="#f59e0b" dot={true} strokeWidth={3} />
                  <Line isAnimationActive={false} connectNulls={false} type="linear" dataKey="hum" name="Humidity (%)" stroke="#3b82f6" dot={true} strokeWidth={3} />
                  <Line isAnimationActive={false} connectNulls={false} type="linear" dataKey="light" name="Light (lux)" stroke="#ef4444" dot={true} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="sensor-stack">
          <div className={`sensor-card light-card ${!isOnline ? 'card-error' : (isLightWarning ? 'card-warning' : '')}`}>
            <div className="card-left"><Sun /></div>
            <div className="card-right">
              <h3>Light</h3>
              <h2>{isOnline ? `${Math.round(sensors.light)} lux` : "N/A"}</h2>
              <p className={getStatus(isLightWarning).class}>
                {getStatus(isLightWarning).text}
              </p>
              <DeviceControl
                name="LAMP"
                deviceId={1}
                status={deviceStatus.LED_1}
                onControl={handleControl}
                isLoading={isDeviceLoading('LED_1')}
              />
            </div>
          </div>

          <div className={`sensor-card temp-card ${!isOnline ? 'card-error' : (isTempWarning ? 'card-warning' : '')}`}>
            <div className="card-left"><Thermometer /></div>
            <div className="card-right">
              <h3>Temperature</h3>
              <h2>{isOnline ? `${sensors.temp}°C` : "N/A"}</h2>
              <p className={getStatus(isTempWarning).class}>{getStatus(isTempWarning).text}</p>
              <DeviceControl
                name="AC"
                deviceId={2}
                status={deviceStatus.LED_2}
                onControl={handleControl}
                isLoading={isDeviceLoading('LED_2')}
              />
            </div>
          </div>

          <div className={`sensor-card hum-card ${!isOnline ? 'card-error' : (isHumWarning ? 'card-warning' : '')}`}>
            <div className="card-left"><Droplets /></div>
            <div className="card-right">
              <h3>Humidity</h3>
              <h2>{isOnline ? `${sensors.hum}%` : "N/A"}</h2>
              <p className={getStatus(isHumWarning).class}>{getStatus(isHumWarning).text}</p>
              <DeviceControl
                name="FAN"
                deviceId={3}
                status={deviceStatus.LED_3}
                onControl={handleControl}
                isLoading={isDeviceLoading('LED_3')}
              />
            </div>
          </div>

          <div className="sensor-card dummy-card" style={{ backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' }}>
            <div className="card-left"><Wind /></div>
            <div className="card-right">
              <h3>Humidifier</h3>
              <h2>45%</h2>
              <p className="status-ok">System: OK</p>
              <DeviceControl
                name="HUMIDIFIER"
                deviceId={4}
                status={deviceStatus.LED_4}
                onControl={handleControl}
                isLoading={isDeviceLoading('LED_4')}
              />
            </div>
          </div>

          <div className="sensor-card dummy-card" style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5' }}>
            <div className="card-left"><Thermometer /></div>
            <div className="card-right">
              <h3>Heater</h3>
              <h2>22°C</h2>
              <p className="status-ok">System: OK</p>
              <DeviceControl
                name="HEATER"
                deviceId={5}
                status={deviceStatus.LED_5}
                onControl={handleControl}
                isLoading={isDeviceLoading('LED_5')}
              />
            </div>
          </div>
        </div>
      </div>

      {todaySummary && (
        <div className="summary-card full-width">
          <div className="summary-title">
            <h4>Today's Data</h4>
            <span className="last-update-text">Last update: {lastSummaryUpdate}</span>
          </div>
          <div className="summary-stats">
            <div>
              <p>Avg Temp: <strong>{todaySummary.avg_temp.toFixed(1)}°C</strong></p>
              <p>Avg Hum: <strong>{todaySummary.avg_hum.toFixed(1)}%</strong></p>
              <p>Avg Light: <strong>{todaySummary.avg_light != null ? todaySummary.avg_light.toFixed(1) : "N/A"} lux</strong></p>
            </div>
            <div>
              <p>Highest Temp: <strong>{todaySummary.max_temp.toFixed(1)}°C</strong></p>
              <p>Highest Hum: <strong>{todaySummary.max_hum.toFixed(1)}%</strong></p>
              <p>Highest Light: <strong>{todaySummary.max_light != null ? todaySummary.max_light.toFixed(1) : "N/A"} lux</strong></p>
            </div>
            <div>
              <p>Lowest Temp: <strong>{todaySummary.min_temp.toFixed(1)}°C</strong></p>
              <p>Lowest Hum: <strong>{todaySummary.min_hum.toFixed(1)}%</strong></p>
              <p>Lowest Light: <strong>{todaySummary.min_light != null ? todaySummary.min_light.toFixed(1) : "N/A"} lux</strong></p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
