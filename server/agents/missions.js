const today = () => new Date().toISOString().slice(0, 10);

// Missions are computed from live data — concrete, high-value tasks the agent
// nudges you to do. Completing the underlying work clears them next refresh.
export function accountMissions(records) {
    const prospects = records.filter((a) => a.segment === 'Prospect');
    const weak = prospects.filter((a) => a.meddicc_score < 3);
    const overdue = records.filter((a) => a.next_step_date && a.next_step_date < today());
    const atRisk = records.filter((a) => a.segment === 'Customer' && (a.health === 'Poor' || a.health === 'Critical'));
    const negotiation = prospects.filter((a) => a.stage === 'Negotiation');

    const missions = [];
    if (weak.length) missions.push({ id: 'qualify_weak', emoji: '✅', title: `Qualify ${weak.length} under-qualified deal(s)`, detail: 'Get MEDDICC to 3+/7 before advancing', points: 30, target: weak.length, accounts: weak.map((a) => a.name) });
    if (overdue.length) missions.push({ id: 'clear_overdue', emoji: '⏰', title: `Clear ${overdue.length} overdue next step(s)`, detail: 'Update the next step + date', points: 25, target: overdue.length, accounts: overdue.map((a) => a.name) });
    if (atRisk.length) missions.push({ id: 'save_at_risk', emoji: '🛟', title: `Build save plans for ${atRisk.length} at-risk account(s)`, detail: 'Poor / Critical health customers', points: 40, target: atRisk.length, accounts: atRisk.map((a) => a.name) });
    if (negotiation.length) missions.push({ id: 'push_negotiation', emoji: '🏁', title: `Push ${negotiation.length} negotiation-stage deal(s) to close`, detail: 'Late-stage — closest to revenue', points: 35, target: negotiation.length, accounts: negotiation.map((a) => a.name) });
    return missions;
}

export function missionsForAgent(agentKey, ctx) {
    if (agentKey === 'aukat') return accountMissions(ctx.records || []);
    if (agentKey === 'neo') {
        // Global: top missions across live modules (accounts today), tagged by agent.
        return accountMissions(ctx.records || []).map((m) => ({ ...m, agent: 'Aukat' }));
    }
    return [];
}
