import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useCX } from '../context/CXContext';

const Toast = () => {
    const { toasts } = useCX();

    if (toasts.length === 0) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            left: '501px', // Account for sidebar
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'none',
            zIndex: 3000
        }}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className="glass"
                    style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        minWidth: '300px',
                        background: 'rgba(30, 41, 59, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: 'var(--shadow-lg)',
                        pointerEvents: 'auto',
                        animation: 'toastIn 0.3s ease-out'
                    }}
                >
                    {toast.type === 'success' && <CheckCircle size={20} color="var(--success)" />}
                    {toast.type === 'danger' && <AlertCircle size={20} color="var(--danger)" />}
                    {toast.type === 'info' && <Info size={20} color="var(--info)" />}
                    <p style={{ fontSize: '0.9rem', flex: 1, margin: 0 }}>{toast.message}</p>
                </div>
            ))}
            <style>
                {`
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </div>,
        document.body
    );
};

export default Toast;
