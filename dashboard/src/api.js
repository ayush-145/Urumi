import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:3000/api',
});

// Add a response interceptor to handle errors gracefully
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("API Error:", error.response?.data || error.message);
        if (error.response && error.response.status === 401 && !error.config.url.endsWith('/login')) {
            // Optional: Redirect to login or clear token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
