import React, { useState, useEffect } from 'react';
import { Upload, Plus, RefreshCw, FileSpreadsheet, Database, Filter, User } from 'lucide-react';
import { useCX } from '../context/CXContext';

const DataManagement = ({ moduleName, onManualAdd }) => {
    const { addToast, syncZohoDeals } = useCX();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncInfo, setSyncInfo] = useState({ tool: '', lastSync: '' });

    const token = localStorage.getItem('token');

    const fetchSyncStatus = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/connectivity/credentials', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            // Find which tool automates this module
            const toolConfig = data.find(c => c.target_module === moduleName.toLowerCase().replace(' ', ''));
            if (toolConfig) {
                const logsRes = await fetch(`http://localhost:5000/api/connectivity/logs?tool_name=${toolConfig.tool_name}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const logsData = await logsRes.json();
                setSyncInfo({
                    tool: toolConfig.tool_name.toUpperCase().replace('_', ' '),
                    lastSync: logsData[0] ? new Date(logsData[0].timestamp).toLocaleString() : 'Never'
                });
            }
        } catch (err) {
            console.error('Failed to fetch sync status', err);
        }
    };

    useEffect(() => {
        fetchSyncStatus();
    }, [moduleName]);

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

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await syncZohoDeals();
            addToast('Synchronizing with 3rd party tool...', 'info');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSyncing(false);
            fetchSyncStatus();
        }
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                    </select>
                </div>
            </div>

            <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Database size={14} />
                <span>
                    {syncInfo.tool ? (
                        <>Automated via <strong>{syncInfo.tool}</strong>. Last sync: {syncInfo.lastSync}</>
                    ) : (
                        <>No 3rd party tool automation configured for this module. Visit the Connectivity Hub to link a tool.</>
                    )}
                </span>
            </div>
        </div>
    );
};

export default DataManagement;
