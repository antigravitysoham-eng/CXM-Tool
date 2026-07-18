import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { onboardingRepo } from '../repositories/onboardingRepo.js';
import { validate } from '../validation/accountSchema.js';
import { STAGES, STAGE_STATUSES, ONBOARDING_STATUSES, PARTIES, DEFAULT_PLAN, suggestPlan, VALUE_STAGE_NO } from '../data/onboardingStages.js';
import { scopeRepo } from '../repositories/scopeRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Not found — or outside your access' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').or(z.literal('')).optional();

const startSchema = z.object({
    account: z.string().trim().min(1, 'Account is required'),
    contract_id: z.string().trim().optional().default(''),
    // A CSM must be named before onboarding starts — the CX lead assigns them in
    // CLM, and this is the point of no return for that decision.
    csm_name: z.string().trim().min(1, 'Assign a CSM before starting onboarding'),
    csm_email: z.string().trim().email().or(z.literal('')).optional().default(''),
    kickoff_date: date,
    target_go_live: date,
    // The agreed plan: days from kickoff for each stage.
    stage_days: z.array(z.number().int().min(1).max(730)).length(STAGES.length).optional(),
    notes: z.string().trim().max(1000).optional().default('')
});

const updateSchema = z.object({
    csm_name: z.string().trim().optional(),
    csm_email: z.string().trim().optional(),
    status: z.enum(ONBOARDING_STATUSES).optional(),
    kickoff_date: date,
    target_go_live: date,
    contract_id: z.string().trim().optional(),
    notes: z.string().trim().max(1000).optional()
});

const stageSchema = z.object({
    status: z.enum(STAGE_STATUSES).optional(),
    owner: z.string().trim().max(120).optional(),
    due_date: date,
    // The CSM-logged working dates for the stage, to track days-in-stage.
    start_date: date,
    end_date: date,
    notes: z.string().trim().max(1000).optional()
});

const taskSchema = z.object({
    done: z.boolean().optional(),
    label: z.string().trim().min(1).max(300).optional(),
    owner: z.string().trim().max(120).optional(),
    due_date: date,
    notes: z.string().trim().max(500).optional()
});

const addTaskSchema = z.object({
    stage_id: z.number().int().positive(),
    label: z.string().trim().min(1).max(300),
    party: z.enum(PARTIES).optional().default('Zeron'),
    owner: z.string().trim().max(120).optional().default(''),
    due_date: date
});

router.get('/meta', wrap(async (req, res) => {
    res.json({
        stages: STAGES.map(({ no, name, blurb, defaultDays, generated, valueStage }) => ({ no, name, blurb, defaultDays, generated: !!generated, valueStage: !!valueStage })),
        defaultPlan: DEFAULT_PLAN,
        valueStageNo: VALUE_STAGE_NO,
        stageStatuses: STAGE_STATUSES,
        statuses: ONBOARDING_STATUSES,
        parties: PARTIES
    });
}));

router.get('/stats', wrap(async (req, res) => res.json(await onboardingRepo.stats(req.user))));

// Recent activity across the board (for the kanban's activity feed).
router.get('/activity', wrap(async (req, res) => {
    res.json(await onboardingRepo.recentActivity(req.user, { limit: Number(req.query.limit) || 30 }));
}));

// What plan would this account get? Lets the lead see the dates — and the reason
// behind them — before committing to them.
router.get('/plan-preview/:account', wrap(async (req, res) => {
    const scope = await scopeRepo.listScope(req.user, { account: req.params.account });
    const scopeItems = scope.reduce((n, s) => n + (s.items.length || 1), 0);
    res.json({
        scopeItems,
        base: DEFAULT_PLAN,
        suggested: suggestPlan(scopeItems),
        stages: STAGES.map((s) => ({ no: s.no, name: s.name }))
    });
}));

router.get('/', wrap(async (req, res) => {
    res.json(await onboardingRepo.list(req.user, { account: req.query.account, status: req.query.status }));
}));

// Does this account already have one? CLM asks before offering "Proceed to onboard".
router.get('/by-account/:account', wrap(async (req, res) => {
    const o = await onboardingRepo.findByAccount(req.params.account, req.user);
    if (!o) return res.status(404).json({ error: 'No onboarding for this account' });
    res.json(o);
}));

router.get('/:id', wrap(async (req, res) => {
    const o = await onboardingRepo.get(Number(req.params.id), req.user);
    if (!o) return res.status(404).json({ error: 'Not found — or outside your access' });
    res.json(o);
}));

// "Proceed to onboard" — builds the five stages and generates Stage 2 from the
// CLM scope in one step.
router.post('/', wrap(async (req, res) => {
    const data = validate(startSchema, req.body);
    const r = await onboardingRepo.start(data, req.user);
    if (r.conflict) return res.status(409).json({ error: 'This account is already being onboarded', id: r.id });
    if (settled(res, r)) return;
    res.status(201).json(r.onboarding);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateSchema, req.body);
    const r = await onboardingRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.onboarding);
}));

// The board move: place this onboarding at a delivery stage (or Live).
const moveSchema = z.object({ stage: z.number().int().min(1).max(20) });
router.patch('/:id/move', wrap(async (req, res) => {
    const { stage } = validate(moveSchema, req.body);
    const r = await onboardingRepo.moveToStage(Number(req.params.id), stage, req.user);
    if (settled(res, r)) return;
    res.json(r.onboarding);
}));

// The activity log for one onboarding (shown in the detail drawer).
router.get('/:id/activity', wrap(async (req, res) => {
    const rows = await onboardingRepo.activity(Number(req.params.id), req.user, { limit: Number(req.query.limit) || 50 });
    if (rows === null) return res.status(404).json({ error: 'Not found — or outside your access' });
    res.json(rows);
}));

router.patch('/stages/:stageId', wrap(async (req, res) => {
    const data = validate(stageSchema, req.body);
    const r = await onboardingRepo.updateStage(Number(req.params.stageId), data, req.user);
    if (settled(res, r)) return;
    res.json(r.onboarding);
}));

router.post('/:id/tasks', wrap(async (req, res) => {
    const data = validate(addTaskSchema, req.body);
    const r = await onboardingRepo.addTask(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.onboarding);
}));

router.patch('/tasks/:taskId', wrap(async (req, res) => {
    const data = validate(taskSchema, req.body);
    const r = await onboardingRepo.updateTask(Number(req.params.taskId), data, req.user);
    if (settled(res, r)) return;
    res.json(r.onboarding);
}));

router.delete('/tasks/:taskId', wrap(async (req, res) => {
    const r = await onboardingRepo.removeTask(Number(req.params.taskId), req.user);
    if (settled(res, r)) return;
    res.json(r.onboarding);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await onboardingRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

export default router;
