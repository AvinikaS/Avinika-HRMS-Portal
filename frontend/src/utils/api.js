import axios from 'axios';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const defaultApiUrl = isProduction
    ? 'https://avinika-hrms-portal-gn20eczul-arpit-patidars-projects-c20ec1b2.vercel.app/api'
    : '/api';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('hrms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Let browser auto-set Content-Type (with boundary) for FormData
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    return config;
});

api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            sessionStorage.removeItem('hrms_token');
            sessionStorage.removeItem('hrms_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
