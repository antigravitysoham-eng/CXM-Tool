import React from 'react';
import { Download, FileText, BarChart3, Sparkles } from 'lucide-react';
import { useCX } from '../context/CXContext';

const ModuleActions = ({ moduleName, aiInsight }) => {
    const { addToast } = useCX();

    const handleExport = (type) => {
        addToast(`Generating ${type} report for ${moduleName}...`, 'info');
        setTimeout(() => {
            addToast(`${type} report downloaded!`, 'success');
        }, 1500);
    };

    return (
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="glass-card" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                    <BarChart3 size={20} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '1.1rem' }}>Export Reports</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, gap: '8px' }} onClick={() => handleExport('Excel')}>
                        <Download size={16} /> Excel (.xlsx)
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, gap: '8px' }} onClick={() => handleExport('PDF')}>
                        <FileText size={16} /> Exec Summary (.pdf)
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ flex: 1.5, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Sparkles size={20} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '1.1rem' }}>AI Module Insights</h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {aiInsight || `Based on recent trends in ${moduleName}, 82% of accounts are maintaining healthy engagement levels. No immediate intervention required.`}
                </p>
            </div>
        </div>
    );
};

export default ModuleActions;
