import React, { useState } from 'react';
import { Upload, Plus, RefreshCw, FileSpreadsheet, Database, Filter, User } from 'lucide-react';
import { useCX } from '../context/CXContext';

const DataManagement = ({ moduleName, onManualAdd }) => {
    const { addToast } = useCX();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleBulkUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx';
        input.onchange = (e) => {
            const file = e.target.files[0];
            addToast(`Uploading ${file.name}...`, 'info');
            setTimeout(() => {
                addToast(`Successfully imported ${Math.floor(Math.random() * 50) + 10} records into ${moduleName}!`, 'success');
            }, 2000);
        };
        input.click();
    };

    const handleSync = () => {
        setIsSyncing(true);
        addToast(`Connecting to third-party sources for ${moduleName}...`, 'info');
        setTimeout(() => {
            setIsSyncing(false);
            addToast(`Data sync complete! Synced with Salesforce & Zoho Desk.`, 'success');
        }, 3000);
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={onManualAdd}>
                        <Plus size={18} /> Add Record
                    </button>
                    <button className="btn btn-ghost" onClick={handleBulkUpload}>
                        <FileSpreadsheet size={18} /> Bulk Upload
                    </button>
                    <button className="btn btn-ghost" onClick={handleSync} disabled={isSyncing}>
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Syncing...' : 'Auto Sync'}
                    </button>
                </div>

                <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                    <User size={14} color="var(--text-muted)" />
                    <select style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="all">All CX Managers</option>
                        <option value="me">My Accounts Only</option>
                        <option value="sarah">Sarah J.</option>
                        <option value="mike">Mike T.</option>
                    </select>
                </div>
            </div>

            <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Database size={14} />
                <span>Last automated sync: Today, 10:45 AM via <strong>Salesforce Connector</strong></span>
            </div>
        </div>
    );
};

export default DataManagement;
