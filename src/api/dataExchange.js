import { api } from './client';

// Generic data-exchange engine (works for any registered module).
export const dataApi = {
    exportExcel: (module) => api.download(`/data/${module}/export.xlsx`, `${module}-export.xlsx`),
    template: (module) => api.download(`/data/${module}/template.xlsx`, `${module}-template.xlsx`),
    report: (module) => api.download(`/data/${module}/report.pdf`, `${module}-executive-report.pdf`),
    import: (module, fileBase64) => api.post(`/data/${module}/import`, { fileBase64 })
};

export const customFieldsApi = {
    list: (module = 'accounts') => api.get(`/custom-fields?module=${module}`),
    create: (def) => api.post('/custom-fields', def),
    remove: (id, module = 'accounts') => api.del(`/custom-fields/${id}?module=${module}`)
};
