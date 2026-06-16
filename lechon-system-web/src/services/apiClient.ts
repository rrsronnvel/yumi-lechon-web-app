// src/services/apiClient.ts
import axios from 'axios';

// This creates a reusable "phone line" that already knows the backend's number
const apiClient = axios.create({
    baseURL: 'http://localhost:5199/api', // Double check your actual .NET port!
    headers: {
        'Content-Type': 'application/json'
    }
});

export default apiClient;