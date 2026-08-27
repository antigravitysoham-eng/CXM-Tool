import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import Modal from './Modal';
import ReportView from './ReportView';

/**
 * The per-module "Report" affordance — a single button, dropped into any module
 * header, that opens the in-app executive report (KPIs, chart, sections, actions)
 * with Excel / PDF export beside it. Every module has one.
 */
export default function ModuleReportMenu({ module, title }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button className="btn btn-ghost" onClick={() => setOpen(true)}>
                <BarChart3 size={16} /> Report
            </button>
            {open && (
                <Modal isOpen onClose={() => setOpen(false)} title={`${title} — Report`} maxWidth="900px">
                    <ReportView module={module} />
                </Modal>
            )}
        </>
    );
}
