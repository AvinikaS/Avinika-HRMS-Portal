import { useAuth } from '../../context/AuthContext';
import { HiOutlineBell, HiOutlineSearch, HiOutlineMenu, HiOutlineLogout } from 'react-icons/hi';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../utils/api';

export default function Topbar({ collapsed, setMobileOpen, title }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotif, setShowNotif] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const getInitials = () => {
        if (!user) return '?';
        const email = user.email || '';
        return email.charAt(0).toUpperCase();
    };

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/notifications');
            const notifs = data.data || [];
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.isRead).length);
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    };

    useEffect(() => {
        // Initial fetch on mount
        fetchNotifications();

        // Connect client-side WebSocket
        const token = sessionStorage.getItem('hrms_token');
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const defaultApiUrl = isProduction
            ? 'https://avinika-hrms-portal-gn20eczul-arpit-patidars-projects-c20ec1b2.vercel.app/api'
            : '/api';

        const apiUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
        const SOCKET_SERVER_URL = apiUrl
            ? apiUrl.replace('/api', '') // Production: derive from API URL
            : (window.location.hostname === 'localhost'
                ? 'http://localhost:5000'
                : `${window.location.protocol}//${window.location.hostname}:5000`);

        let newSocket;
        try {
            newSocket = io(SOCKET_SERVER_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 3
            });

            newSocket.on('connect', () => {
                console.log('Connected to HRMS notification WebSocket server');
            });

            newSocket.on('unread_count_update', ({ unreadCount }) => {
                setUnreadCount(unreadCount);
                fetchNotifications();
            });

            newSocket.on('connect_error', () => {
                // Serverless (Vercel) doesn't support WebSocket — fall back to polling
                console.log('WebSocket unavailable, using polling for notifications');
                newSocket.disconnect();
            });
        } catch (e) {
            console.log('Socket connection failed, using REST polling');
        }

        // Fallback: poll every 30s for new notifications
        const pollInterval = setInterval(fetchNotifications, 30000);

        return () => {
            if (newSocket) newSocket.disconnect();
            clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.notif-container')) {
                setShowNotif(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            fetchNotifications();
        } catch (err) {
            console.error("Error marking all read:", err);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            fetchNotifications();
        } catch (err) {
            console.error("Error marking notification read:", err);
        }
    };

    const resolveNavigationLink = (n) => {
        if (n.link) return n.link;

        const titleLower = (n.title || '').toLowerCase();
        const isAdminOrHR = ['SuperAdmin', 'HRAdmin'].includes(user?.role);

        // 1. Leaves
        if (titleLower.includes('leave')) {
            return isAdminOrHR ? '/leaves' : '/my-leaves';
        }

        // 2. Resignations
        if (titleLower.includes('resignation')) {
            return isAdminOrHR ? '/exit-management' : '/resignation';
        }

        // 3. Documents
        if (titleLower.includes('document')) {
            return isAdminOrHR ? '/document-approvals' : '/my-documents';
        }

        // 4. Payslips
        if (titleLower.includes('payslip')) {
            return '/my-payslips';
        }

        // 5. Loans
        if (titleLower.includes('loan')) {
            return isAdminOrHR ? '/payroll/loans' : '/my-loans';
        }

        // 6. Advance Salary
        if (titleLower.includes('advance')) {
            return isAdminOrHR ? '/payroll/advances' : '/my-loans';
        }

        // 7. Bonus / Incentives
        if (titleLower.includes('bonus') || titleLower.includes('incentive')) {
            return '/my-profile';
        }

        return null;
    };

    const handleNotificationClick = async (n) => {
        setShowNotif(false);
        if (!n.isRead) {
            try {
                await api.put(`/notifications/${n._id}/read`);
                fetchNotifications();
            } catch (err) {
                console.error("Error marking notification read:", err);
            }
        }
        const targetLink = resolveNavigationLink(n);
        if (targetLink) {
            navigate(targetLink);
        }
    };

    return (
        <header className={`topbar ${collapsed ? 'collapsed' : ''}`}>
            <div className="topbar-left">
                <button className="topbar-btn" style={{ display: 'none' }} id="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
                    <HiOutlineMenu />
                </button>
                <style>{`@media(max-width:768px){#mobile-menu-btn{display:flex!important}}`}</style>
                <h1>{title}</h1>
            </div>
            <div className="topbar-right">
                <div className="notif-container" style={{ position: 'relative' }}>
                    <button className="topbar-btn" onClick={() => setShowNotif(!showNotif)}>
                        <HiOutlineBell />
                        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </button>
                    {showNotif && (
                        <div className="notif-dropdown">
                            <div className="notif-header">
                                <span>Notifications ({unreadCount})</span>
                                {unreadCount > 0 && (
                                    <button className="notif-clear-btn" onClick={handleMarkAllRead}>
                                        Mark all as read
                                    </button>
                                )}
                            </div>
                            <div className="notif-list animate-scale-in">
                                {notifications.length === 0 ? (
                                    <div className="notif-empty">No notifications</div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n._id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} onClick={() => handleNotificationClick(n)} style={{ cursor: resolveNavigationLink(n) ? 'pointer' : 'default' }}>
                                            <div className="notif-title">{n.title}</div>
                                            <div className="notif-msg">{n.message}</div>
                                            <div className="notif-time">{new Date(n.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="user-menu" title="Click to logout">
                    <div className="user-avatar" style={{ border: '2px solid var(--primary)', overflow: 'hidden' }}>
                        {user?.profileImage ? (
                            <img src={user.profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            getInitials()
                        )}
                    </div>
                    <div className="user-info" onClick={logout}>
                        <div className="user-name">
                            {user?.employeeId ? `${user.employeeId.firstName} ${user.employeeId.lastName}` : user?.email?.split('@')[0]}
                        </div>
                        <div className="user-role">{user?.role || 'Employee'}</div>
                    </div>
                    <HiOutlineLogout size={16} onClick={logout} style={{ color: 'var(--text-tertiary)', marginLeft: 8, cursor: 'pointer' }} />
                </div>
            </div>

            <style>{`
                .notif-dropdown {
                    position: absolute;
                    top: 50px;
                    right: 0;
                    width: 320px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    z-index: 1001;
                    max-height: 400px;
                    display: flex;
                    flex-direction: column;
                    animation: scaleIn 0.2s ease-out;
                }
                @media (max-width: 480px) {
                    .notif-dropdown {
                        position: fixed;
                        top: 64px;
                        left: 12px;
                        right: 12px;
                        width: auto;
                        max-width: none;
                    }
                }
                .notif-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                    font-weight: 600;
                    font-size: 13.5px;
                    color: var(--text-primary);
                }
                .notif-clear-btn {
                    background: none;
                    border: none;
                    color: var(--primary);
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 0;
                }
                .notif-clear-btn:hover {
                    text-decoration: underline;
                }
                .notif-list {
                    overflow-y: auto;
                    flex: 1;
                    max-height: 340px;
                }
                .notif-empty {
                    padding: 24px 16px;
                    text-align: center;
                    color: var(--text-tertiary);
                    font-size: 13px;
                }
                .notif-item {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                    transition: var(--transition);
                }
                .notif-item:hover {
                    background: var(--bg-hover);
                }
                .notif-item.unread {
                    background: rgba(79, 70, 229, 0.05);
                    border-left: 3px solid var(--primary);
                }
                .notif-title {
                    font-weight: 600;
                    font-size: 12.5px;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                }
                .notif-msg {
                    font-size: 12px;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    margin-bottom: 6px;
                }
                .notif-time {
                    font-size: 10px;
                    color: var(--text-tertiary);
                }
                .topbar-btn .badge {
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    min-width: 16px;
                    height: 16px;
                    background: var(--danger);
                    color: white;
                    border-radius: var(--radius-full);
                    border: 2px solid var(--bg-secondary);
                    font-size: 9px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    box-sizing: border-box;
                }
            `}</style>
        </header>
    );
}
