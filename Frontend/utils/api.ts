import axios from 'axios';

const api = axios.create({
     baseURL: (import.meta as any).env.VITE_API_URL || 'https://trustchain-ai-backend-v1.onrender.com' || 'http://localhost:8000',
     headers: {
          'Content-Type': 'application/json',
     },
});

export default api;
