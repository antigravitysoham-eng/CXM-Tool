import React, { useState } from 'react';
import { Folder, Search, Grid, List, MoreVertical, ExternalLink, Plus } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Directory = () => {
    const { customers, addCustomer } = useCX();
    const [view, setView] = useState('grid');
    const [activeFolder, setActiveFolder] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [newAccount, setNewAccount] = useState({
        name: '',
        type: 'Customer',
        cxm: 'Sarah J.',
        health: 'Good',
        value: '$0',
        progress: 0,
        industry: 'SaaS'
    });

    const folders = [
        { name: 'All', count: customers.length },
        { name: 'Customer', count: customers.filter(c => c.type === 'Customer').length },
        { name: 'Prospect', count: customers.filter(c => c.type === 'Prospect').length },
        { name: 'Partner', count: customers.filter(c => c.type === 'Partner').length },
    ];

    const filteredCustomers = (activeFolder === 'All'
        ? customers
        : customers.filter(c => c.type === activeFolder)
    ).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleAddAccount = (e) => {
        e.preventDefault();
        addCustomer(newAccount);
        setIsModalOpen(false);
        setNewAccount({
            name: '',
            type: 'Customer',
            cxm: 'Sarah J.',
            health: 'Good',
            value: '$0',
            progress: 0,
            industry: 'SaaS'
        });
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Account Directory</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage and organize your Customers, Prospects, and Partners.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> Add New Account
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {folders.map((folder, idx) => (
                    <div
                        key={idx}
                        className={`glass-card ${activeFolder === folder.name ? 'active-folder' : ''}`}
                        onClick={() => setActiveFolder(folder.name)}
                        style={{
                            cursor: 'pointer',
                            padding: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            border: activeFolder === folder.name ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                            background: activeFolder === folder.name ? 'rgba(99, 102, 241, 0.1)' : ''
                        }}
                    >
                        <div style={{ color: activeFolder === folder.name ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            <Folder size={24} fill={activeFolder === folder.name ? 'currentColor' : 'none'} />
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{folder.name}s</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{folder.count} accounts</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Filter accounts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px 6px 32px', color: 'white', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px' }}>
                        <button
                            onClick={() => setView('grid')}
                            style={{ background: view === 'grid' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: view === 'grid' ? 'white' : 'var(--text-muted)' }}
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => setView('list')}
                            style={{ background: view === 'list' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: view === 'list' ? 'white' : 'var(--text-muted)' }}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {view === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {filteredCustomers.map((customer) => (
                                <div key={customer.id} className="glass" style={{ borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                            {customer.name.substring(0, 1)}
                                        </div>
                                        <span className={`badge ${customer.health === 'Good' ? 'badge-success' : customer.health === 'Critical' || customer.health === 'Poor' ? 'badge-danger' : 'badge-warning'}`} style={{ height: 'fit-content' }}>
                                            {customer.health}
                                        </span>
                                    </div>
                                    <h4 style={{ marginBottom: '0.25rem' }}>{customer.name}</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{customer.industry} • {customer.cxm}</p>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Maturity</span>
                                            <span>{customer.progress}%</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                                            <div style={{ height: '100%', width: `${customer.progress}%`, background: 'var(--accent-primary)', borderRadius: '2px' }}></div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{customer.value}</span>
                                        <button className="btn-ghost" style={{ padding: '6px', fontSize: '0.75rem' }}>Details <ExternalLink size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>NAME</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>MANAGER</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>HEALTH</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>VALUE</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{customer.name}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{customer.cxm}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge ${customer.health === 'Good' ? 'badge-success' : customer.health === 'Critical' || customer.health === 'Poor' ? 'badge-danger' : 'badge-warning'}`}>
                                                {customer.health}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{customer.value}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <button className="btn-ghost" style={{ padding: '4px' }}><MoreVertical size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Account">
                <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Account Name</label>
                        <input
                            required
                            type="text"
                            className="glass"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                            value={newAccount.name}
                            onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Type</label>
                            <select
                                className="glass"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', background: 'var(--bg-secondary)' }}
                                value={newAccount.type}
                                onChange={e => setNewAccount({ ...newAccount, type: e.target.value })}
                            >
                                <option value="Customer">Customer</option>
                                <option value="Prospect">Prospect</option>
                                <option value="Partner">Partner</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Industry</label>
                            <input
                                type="text"
                                className="glass"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                                value={newAccount.industry}
                                onChange={e => setNewAccount({ ...newAccount, industry: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Contract Value</label>
                        <input
                            type="text"
                            placeholder="$0"
                            className="glass"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                            value={newAccount.value}
                            onChange={e => setNewAccount({ ...newAccount, value: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Account</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Directory;
