// src/pages/DashboardPage.tsx
import { useEffect } from 'react';
import apiClient from '../services/apiClient';

export default function DashboardPage() {
    
    // The moment the page loads, run this function
    useEffect(() => {
        apiClient.get('/inventory/categories')
            .then(response => {
                console.log("🟢 IT'S ALIVE! Backend data:", response.data);
            })
            .catch(error => {
                console.error("🔴 Connection Failed:", error);
            });
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold">Operational Dashboard</h1>
            <p>Check your browser console (F12) to see if the data arrived!</p>
        </div>
    );
}