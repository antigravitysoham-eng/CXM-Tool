import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { validate } from '../validation/accountSchema.js';
import {
    createSessionSchema, updateSessionSchema, createCourseSchema, updateCourseSchema,
    createTraineeSchema, trainerSchema, updateTrainerSchema, createEnrollmentSchema, updateEnrollmentSchema,
    TRAINING_STATUSES, TRAINING_FORMATS, COURSE_LEVELS, ENROLLMENT_STATUSES
} from '../validation/trainingSchema.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Not found — or the account is outside your access' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

const filtersFrom = (q) => ({ account: q.account, status: q.status, format: q.format });

router.get('/meta', wrap(async (req, res) => {
    res.json({ statuses: TRAINING_STATUSES, formats: TRAINING_FORMATS, levels: COURSE_LEVELS, enrollmentStatuses: ENROLLMENT_STATUSES });
}));

// ---- course catalogue (everyone reads; admins write) ----
router.get('/courses', wrap(async (req, res) => {
    res.json(await trainingRepo.listCourses({ module: req.query.module, level: req.query.level, activeOnly: req.query.active === 'true' }));
}));

router.post('/courses', requireRole('admin'), wrap(async (req, res) => {
    const data = validate(createCourseSchema, req.body);
    res.status(201).json(await trainingRepo.createCourse(data));
}));

router.patch('/courses/:id', requireRole('admin'), wrap(async (req, res) => {
    const data = validate(updateCourseSchema, req.body);
    const r = await trainingRepo.updateCourse(Number(req.params.id), data);
    if (r.notFound) return res.status(404).json({ error: 'Course not found' });
    res.json(r.course);
}));

router.delete('/courses/:id', requireRole('admin'), wrap(async (req, res) => {
    const r = await trainingRepo.removeCourse(Number(req.params.id));
    if (r.notFound) return res.status(404).json({ error: 'Course not found' });
    res.json(r);
}));

// Courses a customer is entitled to, from its opted modules (+ platform).
router.get('/available/:account', wrap(async (req, res) => {
    const r = await trainingRepo.availableCourses(req.user, req.params.account);
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' });
    res.json(r);
}));

// ---- trainees (account-scoped) ----
router.get('/trainees', wrap(async (req, res) => {
    res.json(await trainingRepo.listTrainees(req.user, req.query.account));
}));
router.post('/trainees', wrap(async (req, res) => {
    const data = validate(createTraineeSchema, req.body);
    const r = await trainingRepo.addTrainee(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.trainee);
}));
router.delete('/trainees/:id', wrap(async (req, res) => {
    const r = await trainingRepo.removeTrainee(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

// ---- trainers (global roster; admin writes) ----
router.get('/trainers', wrap(async (req, res) => {
    res.json(await trainingRepo.listTrainers());
}));
router.post('/trainers', requireRole('admin'), wrap(async (req, res) => {
    const data = validate(trainerSchema, req.body);
    res.status(201).json(await trainingRepo.addTrainer(data));
}));
router.patch('/trainers/:id', requireRole('admin'), wrap(async (req, res) => {
    const data = validate(updateTrainerSchema, req.body);
    const r = await trainingRepo.updateTrainer(Number(req.params.id), data);
    if (r.notFound) return res.status(404).json({ error: 'Trainer not found' });
    res.json(r.trainer);
}));
router.delete('/trainers/:id', requireRole('admin'), wrap(async (req, res) => {
    const r = await trainingRepo.removeTrainer(Number(req.params.id));
    if (r.notFound) return res.status(404).json({ error: 'Trainer not found' });
    res.json(r);
}));

// ---- enrollments (account-scoped) ----
router.get('/enrollments', wrap(async (req, res) => {
    res.json(await trainingRepo.listEnrollments(req.user, {
        account: req.query.account, status: req.query.status, course_key: req.query.course_key,
        trainee_id: req.query.trainee_id ? Number(req.query.trainee_id) : undefined
    }));
}));
router.post('/enrollments', wrap(async (req, res) => {
    const data = validate(createEnrollmentSchema, req.body);
    const r = await trainingRepo.createEnrollment(data, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Course not found' });
    if (settled(res, r)) return;
    res.status(201).json(r.enrollment);
}));
router.patch('/enrollments/:id', wrap(async (req, res) => {
    const data = validate(updateEnrollmentSchema, req.body);
    const r = await trainingRepo.updateEnrollment(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.enrollment);
}));
router.delete('/enrollments/:id', wrap(async (req, res) => {
    const r = await trainingRepo.removeEnrollment(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.get('/stats', wrap(async (req, res) => {
    res.json(await trainingRepo.stats(req.user, filtersFrom(req.query)));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await trainingRepo.list(req.user, filtersFrom(req.query)));
}));

router.get('/:id', wrap(async (req, res) => {
    const s = await trainingRepo.get(Number(req.params.id), req.user);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createSessionSchema, req.body);
    const r = await trainingRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.session);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateSessionSchema, req.body);
    const r = await trainingRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.session);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await trainingRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

/**
 * Seed a spread of enablement sessions across the caller's accounts — varied
 * format, status and funnel depth so completion/certification rates and the
 * "under-enabled" flag have something to show. Admin only; appends.
 */
router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    if (!accounts.length) return res.status(400).json({ error: 'No accounts to attach sessions to — seed accounts first.' });

    const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    // [title, format, status, sessionDate, enrolled, completed, certified]
    const plan = [
        ['Platform Essentials', 'Webinar', 'Completed', daysAgo(30), 45, 42, 38],
        ['Advanced Admin Training', 'Workshop', 'In Progress', daysAgo(5), 12, 6, 0],
        ['API & Integrations', 'Self-paced', 'Completed', daysAgo(60), 8, 8, 8],
        ['Custom Reports Setup', 'Webinar', 'Delayed', daysAgo(10), 22, 0, 0],       // stalled: enrolled, nobody finished
        ['Security & Compliance 101', 'On-site', 'Scheduled', daysAgo(-7), 30, 0, 0],
        ['Renewal Playbook', 'Webinar', 'In Progress', daysAgo(2), 15, 9, 4],
        ['Onboarding Fast-Track', 'Self-paced', 'Completed', daysAgo(45), 20, 16, 12]
    ];

    let created = 0;
    for (let i = 0; i < plan.length; i++) {
        const acct = accounts[i % accounts.length];
        const [title, format, status, session_date, enrolled, completed, certified] = plan[i];
        const r = await trainingRepo.create({
            account: acct.name, title, format, status, session_date,
            trainer: 'Enablement Team', enrolled, completed, certified
        }, req.user);
        if (r.session) created += 1;
    }
    res.json({ seeded: created });
}));

export default router;
