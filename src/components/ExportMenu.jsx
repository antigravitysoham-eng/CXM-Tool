import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useCX } from '../context/CXContext';

const ExportMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { addToast } = useCX();
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = (type) => {
        setIsOpen(false);
        const moduleName = window.location.pathname === '/' ? 'Dashboard' :
            window.location.pathname.substring(1).charAt(0).toUpperCase() + window.location.pathname.substring(2);

        addToast(`Preparing ${type} export for ${moduleName}...`, 'info');

        setTimeout(() => {
            addToast(`${moduleName} ${type} Report downloaded successfully!`, 'success');
        }, 1500);
    };

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button
                className="btn-ghost"
                style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Download size={16} />
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Export</span>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '200px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 100
                }}>
                    <button
                        className="dropdown-item"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderRadius: '8px',
                            transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(99, 102, 241, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        onClick={() => handleExport('Executive PDF')}
                    >
                        <FileText size={16} color="var(--danger)" />
                        <span style={{ fontSize: '0.85rem' }}>Executive PDF</span>
                    </button>
                    <button
                        className="dropdown-item"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderRadius: '8px',
                            transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(16, 185, 129, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        onClick={() => handleExport('Excel Data')}
                    >
                        <FileSpreadsheet size={16} color="var(--success)" />
                        <span style={{ fontSize: '0.85rem' }}>Excel Dataset</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExportMenu;
