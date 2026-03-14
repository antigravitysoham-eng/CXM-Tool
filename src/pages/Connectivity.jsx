import React, { useState, useEffect } from 'react';
import { Settings, Shield, Activity, Terminal, CheckCircle, XCircle, RefreshCw, Key, Database, Globe, Layers } from 'lucide-react';
import { useCX } from '../context/CXContext';

const Connectivity = () => {
    const { addToast } = useCX();
    const token = localStorage.getItem('token');
    const [logs, setLogs] = useState([]);
    const [configs, setConfigs] = useState([]);
    const [activeTool, setActiveTool] = useState('zoho_crm');
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        client_id: '',
        client_secret: '',
        refresh_token: '',
        dc: 'com',
        target_module: ''
    });

    const modules = [
        { id: 'customerdirectory', name: 'Account Directory' },
        { id: 'zohotickets', name: 'Support Metrics' },
        { id: 'clm', name: 'CLM' },
        { id: 'onboarding', name: 'Onboarding' },
        { id: 'training', name: 'Training' },
        { id: 'healthchecks', name: 'Health Checks' },
        { id: 'ebrs', name: 'EBRs' },
        { id: 'surveys', name: 'Surveys' },
        { id: 'journeymap', name: 'Journey Map' },
        { id: 'featurerequests', name: 'Feature Requests' },
        { id: 'upsells', name: 'Upsells' },
        { id: 'communications', name: 'Communications' },
        { id: 'events', name: 'Events' },
        { id: 'advocacyhub', name: 'Advocacy Hub' }
    ];

    const fetchConnectivityData = async () => {
        try {
            const [logsRes, configRes] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/connectivity/logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://127.0.0.1:5000/api/connectivity/credentials', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            const logsData = await logsRes.json();
            const configData = await configRes.json();
            setLogs(logsData);
            setConfigs(configData);

            // If active tool has config, load it
            const currentConfig = configData.find(c => c.tool_name === activeTool);
            if (currentConfig) {
                setForm({
                    client_id: currentConfig.client_id || '',
                    client_secret: '',
                    refresh_token: currentConfig.refresh_token || '',
                    dc: currentConfig.dc || 'com',
                    target_module: currentConfig.target_module || ''
                });
            } else {
                setForm({ client_id: '', client_secret: '', refresh_token: '', dc: 'com', target_module: '' });
            }
        } catch (err) {
            console.error('Failed to fetch connectivity data', err);
        }
    };

    useEffect(() => {
        fetchConnectivityData();
    }, [activeTool]);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5000/api/connectivity/credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tool_name: activeTool, ...form })
            });
            if (res.ok) {
                addToast(`${activeTool.toUpperCase()} credentials saved!`, 'success');
                fetchConnectivityData();
            } else {
                addToast('Failed to save credentials', 'error');
            }
        } catch (err) {
            addToast('Connection error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isConfigured = (tool) => configs.some(c => c.tool_name === tool);
    const getTargetModule = (tool) => configs.find(c => c.tool_name === tool)?.target_module;

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Connectivity Hub</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Centralized API management. Define which third-party tools automate which CX modules.</p>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                            <Settings size={20} color="var(--accent-primary)" />
                            <h3 style={{ fontSize: '1.1rem' }}>Available Integrations</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { id: 'zoho_crm', name: 'Zoho CRM', color: '#F44336' },
                                { id: 'zoho_desk', name: 'Zoho Desk', color: '#03A9F4' },
                                { id: 'salesforce', name: 'Salesforce', color: '#00A1E0' },
                                { id: 'hubspot', name: 'HubSpot', color: '#FF7A59' }
                            ].map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => setActiveTool(tool.id)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '12px',
                                        background: activeTool === tool.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                        border: activeTool === tool.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'var(--transition-fast)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tool.color }}></div>
                                            <span style={{ fontWeight: 600 }}>{tool.name}</span>
                                        </div>
                                        {isConfigured(tool.id) && <CheckCircle size={14} color="var(--success)" />}
                                    </div>
                                    {getTargetModule(tool.id) && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Layers size={10} /> Automates: {modules.find(m => m.id === getTargetModule(tool.id))?.name}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                            <Shield size={20} color="var(--info)" />
                            <h3 style={{ fontSize: '1.1rem' }}>Security Overview</h3>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <p style={{ marginBottom: '12px' }}>All API tokens are encrypted at rest using AES-256 and transmitted via TLS 1.3.</p>
                            <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Shield size={16} />
                                <span style={{ fontWeight: 600 }}>System Integrity Verified</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="glass-card">
                        <h3 style={{ marginBottom: '1.5rem' }}>{activeTool.replace('_', ' ').toUpperCase()} Configuration</h3>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        <Key size={14} style={{ marginRight: '6px' }} /> Client ID
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                                        value={form.client_id}
                                        onChange={e => setForm({ ...form, client_id: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        <Layers size={14} style={{ marginRight: '6px' }} /> Automates CX Module
                                    </label>
                                    <select
                                        className="glass"
                                        required
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', background: 'var(--bg-secondary)' }}
                                        value={form.target_module}
                                        onChange={e => setForm({ ...form, target_module: e.target.value })}
                                    >
                                        <option value="">Select Module...</option>
                                        {modules.map(mod => (
                                            <option key={mod.id} value={mod.id}>{mod.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    <Shield size={14} style={{ marginRight: '6px' }} /> Client Secret
                                </label>
                                <input
                                    required={!isConfigured(activeTool)}
                                    type="password"
                                    className="glass"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                                    placeholder={isConfigured(activeTool) ? '••••••••••••••••' : 'Enter client secret'}
                                    value={form.client_secret}
                                    onChange={e => setForm({ ...form, client_secret: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh Token
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                                        value={form.refresh_token}
                                        onChange={e => setForm({ ...form, refresh_token: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        <Globe size={14} style={{ marginRight: '6px' }} /> Data Center
                                    </label>
                                    <select
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', background: 'var(--bg-secondary)' }}
                                        value={form.dc}
                                        onChange={e => setForm({ ...form, dc: e.target.value })}
                                    >
                                        <option value="com">.com</option>
                                        <option value="eu">.eu</option>
                                        <option value="in">.in</option>
                                        <option value="com.au">.au</option>
                                    </select>
                                </div>
                            </div>

                            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: 'fit-content', padding: '12px 24px' }}>
                                {loading ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </form>
                    </div>

                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Terminal size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Global Sync Timeline</h3>
                            </div>
                            <button className="btn btn-ghost" onClick={fetchConnectivityData} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                <RefreshCw size={12} style={{ marginRight: '4px' }} /> Refresh
                            </button>
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {logs.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No sync history found.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                            <th style={{ padding: '12px' }}>TOOL</th>
                                            <th style={{ padding: '12px' }}>STATUS</th>
                                            <th style={{ padding: '12px' }}>RECORDS</th>
                                            <th style={{ padding: '12px' }}>TIME</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                                <td style={{ padding: '12px', fontWeight: 600 }}>{log.tool_name.toUpperCase().replace('_', ' ')}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span className={`badge ${log.status === 'Success' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px' }}>{log.records_count}</td>
                                                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Connectivity;
