/**
 * The training course catalogue — organised by product module, each on a level
 * ladder (Foundation → Intermediate → Advanced) with a per-seat list price.
 *
 * `module` is a product key from data/products.js (so a course traces back to a
 * subscribed module), or 'platform' for product-agnostic courses everyone can
 * take. Prices are per seat, in INR; they seed the DB catalogue and are editable
 * by an admin from there, so this is a starting point, not a hard-code.
 */
export const COURSE_LEVELS = ['Foundation', 'Intermediate', 'Advanced'];

// Sensible default per-seat prices by level (INR). Overridable per course.
const P = { Foundation: 15000, Intermediate: 25000, Advanced: 40000 };

const c = (module, title, level, duration_hours, seat_price) => ({
    course_key: `${module}_${level.toLowerCase()}`,
    module, title, level, duration_hours, seat_price: seat_price ?? P[level], currency: 'INR'
});

export const TRAINING_COURSES = [
    // Platform — available to every customer regardless of modules.
    c('platform', 'Platform Essentials', 'Foundation', 4),
    c('platform', 'Admin & Configuration', 'Intermediate', 8),
    c('platform', 'Advanced Automation & API', 'Advanced', 12),

    // Interno — security posture / integrations.
    c('interno', 'Interno Foundations', 'Foundation', 4),
    c('interno', 'Interno Administration', 'Intermediate', 8),
    c('interno', 'Advanced Detection Engineering', 'Advanced', 16),

    // Conformity — compliance frameworks.
    c('conformity', 'Compliance Fundamentals', 'Foundation', 6),
    c('conformity', 'Framework Implementation', 'Intermediate', 12),
    c('conformity', 'Audit Readiness & Lead Auditor', 'Advanced', 20),

    // Vendor Pulse — third-party risk.
    c('vendor_pulse', 'Third-Party Risk Basics', 'Foundation', 4),
    c('vendor_pulse', 'Vendor Assessment Workflows', 'Intermediate', 8),
    c('vendor_pulse', 'TPRM Program Management', 'Advanced', 14),

    // ZAK - Services — delivered services.
    c('zak_services', 'Service Engagement Onboarding', 'Foundation', 3),
    c('zak_services', 'Delivery Management', 'Intermediate', 8),

    // Agentctl — AI agent governance.
    c('agentctl', 'AI Governance Foundations', 'Foundation', 5),
    c('agentctl', 'Agent Policy & Guardrails', 'Intermediate', 10),
    c('agentctl', 'Advanced AI Risk & Red-teaming', 'Advanced', 16),

    // Certifications — exam prep.
    c('certifications', 'Certification Prep', 'Foundation', 8)
];
