// src/DataSensor.jsx (VERSION with MANUAL SEARCH BUTTON)

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CONFIG } from '../config';

const DataSensor = ({ socket, isActive }) => {
    const [data, setData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeSensor, setActiveSensor] = useState('all');

    // We only need one state for search now.
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); // This will only be set on button click
    const [valueInput, setValueInput] = useState('');
    const [searchValue, setSearchValue] = useState('');

    // This fetchData function now depends on `searchTerm`
    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(CONFIG.API_ENDPOINTS.SENSOR_DATA, {
                params: {
                    page: currentPage,
                    limit: rowsPerPage,
                    status: statusFilter,
                    search: searchTerm,
                    value: searchValue,
                    sensor: activeSensor
                },
            });
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
        } catch (error) {
            console.error("Failed to fetch sensor data:", error);
        }
    }, [currentPage, rowsPerPage, statusFilter, searchTerm, searchValue, activeSensor]);

    // The debounce useEffect is now gone. This effect runs when filters or the search term changes.
    useEffect(() => {
        if (isActive) {
            fetchData();
        }
    }, [isActive, currentPage, rowsPerPage, statusFilter, searchTerm, searchValue, activeSensor, fetchData]);

    // Real-time update effect remains the same.
    useEffect(() => {
        if (!isActive) return;
        const handleRealtimeUpdate = () => {
            if (currentPage === 1) {
                fetchData();
            }
        };
        socket.on('sensor_update', handleRealtimeUpdate);
        return () => socket.off('sensor_update', handleRealtimeUpdate);
    }, [socket, isActive, currentPage, fetchData]);

    // --- NEW HANDLERS FOR MANUAL SEARCH ---
    const handleSearchClick = () => {
        setSearchTerm(searchInput);
        setSearchValue(valueInput);
        setCurrentPage(1); // Reset to page 1 for a new search
    };

    const handleResetClick = () => {
        // Reset all filter states to their default values
        setSearchInput('');
        setSearchTerm('');
        setValueInput('');
        setSearchValue('');
        setStatusFilter('all');
        setActiveSensor('all');

        // Go back to the first page
        setCurrentPage(1);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };

    const getColumnClass = (columnName) => {
        const sensorKeys = ['temp', 'hum', 'light'];
        if (activeSensor === 'all') return '';
        if (columnName === activeSensor) return 'active-sensor';
        if (sensorKeys.includes(columnName) && columnName !== activeSensor) return 'dimmed';
        return '';
    };

    return (
        <div className="data-sensor-container">
            <h1 className="data-sensor-header">Data sensor</h1>

            <div className="filter-bar">
                <div className="search-bar-manual"> {/* Changed class for easier styling */}
                    <input
                        type="text"
                        placeholder="Date/Time..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                    />
                    <input
                        type="number"
                        placeholder="Exact value..."
                        value={valueInput}
                        onChange={(e) => setValueInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                    />
                    <button onClick={handleSearchClick}>Search</button>
                    <button onClick={handleResetClick} className="reset-btn">Reset</button>
                </div>

                <div className="sensor-highlighter">
                    <label htmlFor="sensorHighlight">Filter/Highlight:</label>
                    <select id="sensorHighlight" value={activeSensor} onChange={(e) => { setActiveSensor(e.target.value); setCurrentPage(1); }}>
                        <option value="all">All Sensors</option>
                        <option value="temp">Temperature</option>
                        <option value="hum">Humidity</option>
                        <option value="light">Light</option>
                    </select>
                </div>

                <div className="status-filter">
                    <span>Status:</span>
                    <label><input type="radio" value="all" checked={statusFilter === 'all'} onChange={handleStatusChange} /> All</label>
                    <label><input type="radio" value="ok" checked={statusFilter === 'ok'} onChange={handleStatusChange} /> OK</label>
                    <label><input type="radio" value="error" checked={statusFilter === 'error'} onChange={handleStatusChange} /> Error</label>
                </div>
            </div>

            {/* The rest of the component (table, pagination) remains the same */}
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th className={getColumnClass('id')}>ID</th>
                            <th className={getColumnClass('temp')}>Temperature (°C)</th>
                            <th className={getColumnClass('hum')}>Humidity (%)</th>
                            <th className={getColumnClass('light')}>Light (lux)</th>
                            <th className={getColumnClass('status')}>Status</th>
                            <th className={getColumnClass('time')}>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.id}>
                                <td className={getColumnClass('id')}>{row.id}</td>
                                <td className={`${getColumnClass('temp')} ${searchValue && row.temp !== null && Number(row.temp).toFixed(2) === Number(searchValue).toFixed(2) ? 'sensor-bold' : ''}`}>
                                    {row.temp !== null ? row.temp.toFixed(2) : 'N/A'}
                                </td>
                                <td className={`${getColumnClass('hum')} ${searchValue && row.hum !== null && Number(row.hum).toFixed(2) === Number(searchValue).toFixed(2) ? 'sensor-bold' : ''}`}>
                                    {row.hum !== null ? row.hum.toFixed(2) : 'N/A'}
                                </td>
                                <td className={`${getColumnClass('light')} ${searchValue && row.light !== null && Number(row.light).toFixed(2) === Number(searchValue).toFixed(2) ? 'sensor-bold' : ''}`}>
                                    {row.light !== null ? row.light : 'N/A'}
                                </td>
                                <td className={getColumnClass('status')}>
                                    <span className={`status-dot ${row.temp !== null ? 'ok' : 'error'}`}></span>
                                    {row.temp !== null ? 'OK' : 'ERROR'}
                                </td>
                                <td className={getColumnClass('time')}>{row.created_at}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="table-footer">
                <div className="per-page-selector">
                    <label htmlFor="rowsPerPage">Rows per page: </label>
                    <select id="rowsPerPage" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                <div className="pagination">
                    <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                        &laquo; Previous
                    </button>
                    <span> Page {currentPage} of {totalPages || 1} </span>
                    <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                        Next &raquo;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataSensor;