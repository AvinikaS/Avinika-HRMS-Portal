import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = async () => {
        try {
            const { data } = await api.get('/auth/me');
            if (data.success) {
                sessionStorage.setItem('hrms_user', JSON.stringify(data.user));
                setUser(data.user);
            }
        } catch {
            logout();
        }
    };

    useEffect(() => {
        const token = sessionStorage.getItem('hrms_token');
        const saved = sessionStorage.getItem('hrms_user');
        if (token && saved) {
            setUser(JSON.parse(saved));
            fetchMe(); // Refresh data to get latest profile image
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        if (data.success) {
            sessionStorage.setItem('hrms_token', data.token);
            sessionStorage.setItem('hrms_user', JSON.stringify(data.user));
            setUser(data.user);
            return data;
        }
        throw new Error(data.message);
    };

    const logout = () => {
        sessionStorage.removeItem('hrms_token');
        sessionStorage.removeItem('hrms_user');
        setUser(null);
    };

    const isAdmin = user && ['SuperAdmin', 'HRAdmin'].includes(user.role);
    const isManager = user && ['SuperAdmin', 'HRAdmin', 'Manager'].includes(user.role);
    const isRecruiter = user && ['SuperAdmin', 'HRAdmin', 'Recruiter'].includes(user.role);

    return (
        <AuthContext.Provider value={{ user, login, logout, fetchMe, loading, isAdmin, isManager, isRecruiter }}>
            {children}
        </AuthContext.Provider>
    );
}
