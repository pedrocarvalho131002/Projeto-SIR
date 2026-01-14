import React, { useState, useEffect } from 'react';
import EventCard from '../components/EventCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getImageUrl } from '../utils/config';
import socket from '../services/socket';
import { useNavigate } from 'react-router-dom';

const EventFeed = () => {
    const { user } = useAuth();
    // Removed debug log
    const { t } = useLanguage();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState(() => sessionStorage.getItem('feed_filter') || "all");
    const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('feed_status') || "upcoming");
    const [search, setSearch] = useState(() => sessionStorage.getItem('feed_search') || "");
    const [savedIds, setSavedIds] = useState([]);

    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotif, setShowNotif] = useState(false);
    const navigate = useNavigate();

    // Persistence: Save filters and search
    useEffect(() => {
        sessionStorage.setItem('feed_filter', filter);
        sessionStorage.setItem('feed_status', statusFilter);
        sessionStorage.setItem('feed_search', search);
    }, [filter, statusFilter, search]);

    // Scroll Restoration
    useEffect(() => {
        const scrollPosition = sessionStorage.getItem('feed_scroll');
        if (scrollPosition) {
            window.scrollTo(0, parseInt(scrollPosition));
        }

        const handleScroll = () => {
            sessionStorage.setItem('feed_scroll', window.scrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loading]); // Restore after loading

    useEffect(() => {
        async function loadData() {
            try {
                // Fetch events with a minimum delay to show spinner
                const [eventsRes] = await Promise.all([
                    api.get("/events", { params: { status: statusFilter } }),
                    new Promise(resolve => setTimeout(resolve, 800))
                ]);
                setEvents(eventsRes.data);

                // Fetch saved RSVPs to mark them
                const token = localStorage.getItem("token");
                if (token) {
                try {
                    const rsvpRes = await api.get("/rsvps/me");
                    setSavedIds(rsvpRes.data.map((r) => r.eventId));
                } catch (e) {
                    console.warn("Could not fetch RSVPs", e);
                }
                }

            } catch (err) {
                console.error(err);
                setError("Erro ao carregar eventos");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [statusFilter]);

    // Socket & Notifications
    useEffect(() => {
        if (user) {
            socket.connect();
            socket.emit('join-user', user._id);

            // Listen for new notifications
            const handleNewNotification = (notif) => {
                setNotifications(prev => [notif, ...prev]);
                setUnreadCount(prev => prev + 1);
            };

            socket.on('new-notification', handleNewNotification);

            // Fetch initial notifications
            api.get('/notifications')
                .then(res => {
                    setNotifications(res.data);
                    setUnreadCount(res.data.filter(n => !n.read).length);
                })
                .catch(err => console.error("Error fetching notifications", err));

            return () => {
                socket.off('new-notification', handleNewNotification);
                socket.disconnect();
            };
        }
    }, [user]);

    const handleNotificationClick = async (notif) => {
        if (!notif.read) {
            try {
                await api.patch(`/notifications/${notif._id}/read`);
                setNotifications(prev => prev.map(n =>
                    n._id === notif._id ? { ...n, read: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.error("Error marking read", err);
            }
        }
        setShowNotif(false);
        if (notif.relatedId) {
            navigate(`/evento/${notif.relatedId}`);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const applyFilters = () => {
        let filtered = [...events];

        // Search
        if (search) {
            filtered = filtered.filter((e) =>
                e.title.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Filters
        if (filter === "today") {
            const today = new Date().toDateString();
            filtered = filtered.filter(
                (e) => new Date(e.date).toDateString() === today
            );
        }



        if (filter === "free") {
            filtered = filtered.filter((e) => e.isFree);
        }

        if (filter === "saved") {
            filtered = filtered.filter((e) => savedIds.includes(e._id));
        }

        return filtered;
    };

    const filteredEvents = applyFilters();

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="container"><p>{error}</p></div>;



    return (
        <div style={{ paddingBottom: '80px', minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
            {/* Header Section */}
            <div style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '1rem 1rem 3rem 1rem', borderRadius: '0 0 24px 24px', marginBottom: '-24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t("welcome")}, {user?.name?.split(' ')[0] || 'Visitante'}!</h1>
                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>{t("find_best_events")}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {/* Role-based Header Action */}
                    <div style={{ position: 'relative' }}>
                        {user?.type === 'admin' ? (
                            <button
                                onClick={() => navigate('/admin')}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                        ) : user?.type === 'organizer' ? (
                            <button
                                onClick={() => navigate('/create')}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        ) : (
                            /* Notification Bell for Students/Others */
                            <>
                                <button
                                    onClick={() => setShowNotif(!showNotif)}
                                    style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                    </svg>
                                    {unreadCount > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '0',
                                            right: '0',
                                            backgroundColor: '#ff4444',
                                            color: 'white',
                                            fontSize: '0.7rem',
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid var(--header-bg)'
                                        }}>
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notification Dropdown */}
                                {showNotif && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '50px',
                                        right: '-10px',
                                        width: '300px',
                                        backgroundColor: 'white',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                        color: '#333',
                                        zIndex: 1000,
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600 }}>Notificações</span>
                                            {unreadCount > 0 && (
                                                <button onClick={handleMarkAllRead} style={{ fontSize: '0.8rem', color: 'var(--color-primary)', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    Marcar todas como lidas
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {notifications.length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                                                    Sem notificações
                                                </div>
                                            ) : (
                                                notifications.map(notif => (
                                                    <div
                                                        key={notif._id}
                                                        onClick={() => handleNotificationClick(notif)}
                                                        style={{
                                                            padding: '12px 15px',
                                                            borderBottom: '1px solid #f5f5f5',
                                                            cursor: 'pointer',
                                                            backgroundColor: notif.read ? 'white' : '#f0f7ff',
                                                            transition: 'background 0.2s',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    >
                                                        <div style={{ marginBottom: '4px' }}>{notif.message}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div
                        onClick={() => navigate('/profile')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            backgroundImage: user?.photo ? `url(${getImageUrl(user.photo)})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            fontWeight: 'bold',
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        {!user?.photo && user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="container">
                {/* Search Bar (Floating) */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '50px',
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                    marginBottom: '1.5rem'
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" style={{ marginRight: '10px' }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder={t("search_placeholder")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            width: '100%',
                            fontSize: '1rem',
                            color: '#333'
                        }}
                    />
                </div>

                {/* Filter Buttons (Scrollable) */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '1.5rem',
                    overflowX: 'auto',
                    paddingBottom: '5px',
                    scrollbarWidth: 'none'
                }}>
                    {[
                        { id: 'all', label: t("all") },
                        { id: 'today', label: t("today") },
                        // { id: 'sport', label: t("sport") },
                        { id: 'free', label: t("free") },
                        { id: 'saved', label: t("saved") },
                        { id: 'past', label: t("past_events") }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => {
                                if (f.id === 'past') {
                                    setStatusFilter('past');
                                    setFilter('all'); // Reset other filters
                                } else {
                                    setStatusFilter('upcoming');
                                    setFilter(f.id);
                                }
                            }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: (f.id === 'past' ? statusFilter === 'past' : (filter === f.id && statusFilter === 'upcoming')) ? 'var(--color-primary)' : 'white',
                                color: (f.id === 'past' ? statusFilter === 'past' : (filter === f.id && statusFilter === 'upcoming')) ? 'white' : '#666',
                                boxShadow: (f.id === 'past' ? statusFilter === 'past' : (filter === f.id && statusFilter === 'upcoming')) ? '0 2px 8px rgba(255, 152, 0, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Loading / Error States */}
                {loading && <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>A carregar relatórios...</div>}
                {error && <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>{error}</div>}

                {/* Event List */}
                <div className="event-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {!loading && filteredEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: '3rem', color: '#999' }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Nenhum evento encontrado.</p>
                            <p style={{ fontSize: '0.9rem' }}>Tenta mudar os filtros.</p>
                        </div>
                    ) : (
                        filteredEvents.map(event => (
                            <EventCard key={event._id} event={event} />
                        ))
                    )}
                </div>


            </div>
        </div >
    );
};

export default EventFeed;
