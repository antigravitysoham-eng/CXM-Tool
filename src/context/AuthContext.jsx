import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiBase } from '../api/client';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);

    // Honour the token's own expiry (absolute 6h session). If it has already
    // lapsed, drop it; otherwise schedule an auto-logout for the exact moment it
    // expires so an open tab doesn't linger past the session.
    useEffect(() => {
        if (!token) { setLoading(false); return undefined; }
        let payload;
        try {
            payload = JSON.parse(atob(token.split('.')[1]));
        } catch {
            localStorage.removeItem('token'); setToken(null); setLoading(false);
            return undefined;
        }
        const expMs = payload.exp ? payload.exp * 1000 : null;
        if (expMs && Date.now() >= expMs) {
            // Already expired on load — clear it; ProtectedRoute sends to /login.
            localStorage.removeItem('token'); setToken(null); setUser(null); setLoading(false);
            return undefined;
        }
        setUser(payload);
        setLoading(false);
        if (!expMs) return undefined;
        const id = setTimeout(() => {
            localStorage.removeItem('token'); setToken(null); setUser(null);
            if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1');
        }, expMs - Date.now());
        return () => clearTimeout(id);
    }, [token]);

    const login = async (email, password) => {
        try {
            const response = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('token', data.token);
            setToken(data.token);
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const register = async (name, email, password) => {
        try {
            const response = await fetch(`${apiBase}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Registration failed');

            localStorage.setItem('token', data.token);
            setToken(data.token);
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
