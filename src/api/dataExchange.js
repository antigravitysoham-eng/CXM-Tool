import { api } from './client';

// Build a ?from=&to= query string, dropping empty bounds.
const periodQs = (period = {}) => {
    const s = new URLSearchParams();
    if (period.from) s.set('from', period.from);
    if (period.to) s.set('to', period.to);
    const str = s.toString();
    return str ? `?${str}` : '';
};

const slug = (period = {}) => (period.from || period.to ? `_${period.from || 'start'}_to_${period.to || 'today'}` : '');

// Generic data-exchange engine (works for any registered module). All report
// and export calls accept an optional { from, to } period so a download covers
// only that span.
export const dataApi = {
    modules: () => api.get('/data/modules'),
    exportExcel: (module, period) => api.download(`/data/${module}/export.xlsx${periodQs(period)}`, `${module}-export${slug(period)}.xlsx`),
    template: (module) => api.download(`/data/${module}/template.xlsx`, `${module}-template.xlsx`),
    report: (module, period) => api.download(`/data/${module}/report.pdf${periodQs(period)}`, `${module}-executive-report${slug(period)}.pdf`),
    reportJson: (module, period) => api.get(`/data/${module}/report.json${periodQs(period)}`),
    import: (module, fileBase64) => api.post(`/data/${module}/import`, { fileBase64 })
};

export const customFieldsApi = {
    list: (module = 'accounts') => api.get(`/custom-fields?module=${module}`),
    create: (def) => api.post('/custom-fields', def),
    remove: (id, module = 'accounts') => api.del(`/custom-fields/${id}?module=${module}`)
};
