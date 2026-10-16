import axios from 'axios';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const defaultApiUrl = isProduction
    ? 'https://avinika-hrms-portal.vercel.app/api'
    : '/api';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('hrms_token');
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
            // Don't redirect if we're already on the login page or if this is a login request
            const isLoginRequest = err.config?.url?.includes('/auth/login');
            const isOnLoginPage = window.location.pathname === '/login';
            if (!isLoginRequest && !isOnLoginPage) {
                localStorage.removeItem('hrms_token');
                localStorage.removeItem('hrms_user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

export default api;
