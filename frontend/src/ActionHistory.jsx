// src/ActionHistory.jsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './DataSensor.css';

const deviceMap = {
    'LED_1': 'Lamp',
    'LED_2': 'AC',
    'LED_3': 'Fan'
};

const ActionHistory = ({ socket, isActive }) => {
    const [data, setData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeDevice, setActiveDevice] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/action-history`, {
                params: {
                    page: currentPage,
                    limit: rowsPerPage,
                    status: statusFilter,
                    search: searchTerm,
                    device: activeDevice // <-- NOW SENDING TO BACKEND
                },
            });
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
        } catch (error) {
            console.error("Failed to fetch action history:", error);
        }
    }, [currentPage, rowsPerPage, statusFilter, searchTerm, activeDevice]); // Added activeDevice to dependency

    useEffect(() => {
        if (isActive) {
            fetchData();
        }
    }, [isActive, currentPage, rowsPerPage, statusFilter, searchTerm, activeDevice, fetchData]);

    useEffect(() => {
        if (!isActive) return;

        const handleRealtimeUpdate = () => {
            // Only auto-refresh if the user is on the first page, 
            // so we don't interrupt them if they are looking at older history.
            if (currentPage === 1) {
                fetchData();
            }
        };

        // Listen for the 'device_update' event that the server emits when ESP32 confirms success
        socket.on('device_update', handleRealtimeUpdate);

        return () => socket.off('device_update', handleRealtimeUpdate);
    }, [socket, isActive, currentPage, fetchData]);

    // Handlers
    const handleSearchClick = () => {
        setSearchTerm(searchInput);
        setCurrentPage(1);
    };

    const handleResetClick = () => {
        setSearchInput('');
        setSearchTerm('');
        setStatusFilter('all');
        setActiveDevice('all');
        setCurrentPage(1);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleDeviceChange = (e) => {
        setActiveDevice(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="data-sensor-container">
            <h1 className="data-sensor-header">Action History</h1>

            <div className="filter-bar">
                <div className="search-bar-manual">
                    <input
                        type="text"
                        placeholder="Search by date or time..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                    />
                    <button onClick={handleSearchClick}>Search</button>
                    <button onClick={handleResetClick} className="reset-btn">Reset</button>
                </div>

                <div className="sensor-highlighter">
                    <label htmlFor="deviceHighlight">Filter Device:</label>
                    <select id="deviceHighlight" value={activeDevice} onChange={handleDeviceChange}>
                        <option value="all">All Devices</option>
                        <option value="LED_1">Lamp</option>
                        <option value="LED_2">AC</option>
                        <option value="LED_3">Fan</option>
                    </select>
                </div>

                <div className="status-filter">
                    <span>Status:</span>
                    <label><input type="radio" value="all" checked={statusFilter === 'all'} onChange={handleStatusChange} /> All</label>
                    <label><input type="radio" value="ok" checked={statusFilter === 'ok'} onChange={handleStatusChange} /> OK (Success)</label>
                    <label><input type="radio" value="error" checked={statusFilter === 'error'} onChange={handleStatusChange} /> Error (Pending)</label>
                </div>
            </div>

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Device</th>
                            <th>Action (Command)</th>
                            <th>Status (State)</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.id}>
                                <td>{row.id}</td>
                                <td><strong>{deviceMap[row.device] || row.device}</strong></td>
                                <td>
                                    <span style={{ fontWeight: 'bold', color: row.action === 'ON' ? '#059669' : '#dc2626' }}>
                                        {row.action}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-dot ${row.status === 'SUCCESS' ? 'ok' : 'error'}`}></span>
                                    {row.status}
                                </td>
                                <td>{row.created_at}</td>
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

export default ActionHistory;