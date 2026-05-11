import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Filter, BarChart3, ChevronRight } from 'lucide-react';
import { CONFIG } from '../config';
import './Analytics.css';

const Analytics = () => {
    const [metadata, setMetadata] = useState({});
    const [years, setYears] = useState([]);
    const [months, setMonths] = useState([]);
    const [days, setDays] = useState([]);

    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedDay, setSelectedDay] = useState('');

    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);

    const DEVICE_NAMES = {
        'LED_1': 'LAMP',
        'LED_2': 'AC',
        'LED_3': 'FAN',
        'LED_4': 'HUMIDIFIER',
        'LED_5': 'HEATER'
    };

    // Fetch Year/Month/Day
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await axios.get(CONFIG.API_ENDPOINTS.ANALYTICS_METADATA);
                setMetadata(res.data); //get data
                const availableYears = Object.keys(res.data).sort((a, b) => b - a); //extract data
                setYears(availableYears);

                // Default to latest available
                if (availableYears.length > 0) {
                    const latestYear = availableYears[0];
                    setSelectedYear(latestYear);

                    const availableMonths = Object.keys(res.data[latestYear]).sort((a, b) => b - a);
                    setMonths(availableMonths);
                    if (availableMonths.length > 0) {
                        const latestMonth = availableMonths[0];
                        setSelectedMonth(latestMonth);

                        const availableDays = res.data[latestYear][latestMonth].sort((a, b) => b - a);
                        setDays(availableDays);
                        if (availableDays.length > 0) {
                            setSelectedDay(availableDays[0]);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching metadata:", err);
            }
        };
        fetchMetadata();
    }, []);

    // Update months when year changes
    useEffect(() => {
        if (selectedYear && metadata[selectedYear]) {
            const availableMonths = Object.keys(metadata[selectedYear]).sort((a, b) => b - a);
            setMonths(availableMonths);
            if (!availableMonths.includes(selectedMonth)) {
                setSelectedMonth(availableMonths[0] || '');
            }
        }
    }, [selectedYear, metadata]);

    // Update days when month changes
    useEffect(() => {
        if (selectedYear && selectedMonth && metadata[selectedYear] && metadata[selectedYear][selectedMonth]) {
            const availableDays = metadata[selectedYear][selectedMonth].sort((a, b) => b - a);
            setDays(availableDays);
            if (!availableDays.includes(selectedDay)) {
                setSelectedDay(availableDays[0] || '');
            }
        }
    }, [selectedMonth, selectedYear, metadata]);

    // Fetch chart data
    useEffect(() => {
        if (selectedYear && selectedMonth && selectedDay) {
            const fetchData = async () => {
                setLoading(true);
                try {
                    const dateStr = `${selectedYear}-${selectedMonth}-${selectedDay}`;
                    const res = await axios.get(`${CONFIG.API_ENDPOINTS.ANALYTICS_DAILY_STATS}?date=${dateStr}`);

                    // Map IDs to Names (LED_x -> Device)
                    const mappedData = res.data.map(item => ({
                        ...item,
                        device: DEVICE_NAMES[item.device] || item.device
                    }));

                    setChartData(mappedData);
                } catch (err) {
                    console.error("Error fetching daily stats:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [selectedYear, selectedMonth, selectedDay]);

    return (
        <div className="dashboard-content analytics-page">
            <div className="analytics-header">
                <div className="analytics-title">
                    <h1>Usage Analytics</h1>
                </div>
            </div>

            <div className="analytics-chart-container">
                <div className="chart-header">
                    <div className="filter-group">
                        <Calendar size={18} color="#000" />
                        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="glass-select">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronRight size={14} opacity={0.5} color="#000" />
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="glass-select">
                            {months.map(m => <option key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'short' })}</option>)}
                        </select>
                        <ChevronRight size={14} opacity={0.5} color="#000" />
                        <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="glass-select">
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                </div>

                <ResponsiveContainer width="100%" height="90%">
                    {/* data=[{device: "LED_1", on_count: 10, off_count: 8 }, ...]*/}
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ddd" vertical={false} />
                        <XAxis dataKey="device" stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                        <YAxis stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                        <Tooltip
                            contentStyle={{ background: '#fff', border: '1px solid #777', borderRadius: '4px', color: '#000' }}
                            itemStyle={{ color: '#000' }}
                        />
                        <Legend wrapperStyle={{ color: '#000', fontWeight: 'bold' }} />
                        <Bar dataKey="on_count" name="ON Commands" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={40} stroke="#000" strokeWidth={1} />
                        <Bar dataKey="off_count" name="OFF Commands" fill="#f87171" radius={[4, 4, 0, 0]} barSize={40} stroke="#000" strokeWidth={1} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Analytics;
