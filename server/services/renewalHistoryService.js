import { config } from '../config.js';

// Renewal tracking, derived from the chain of a customer's contracts.
//
// When a contract renews it's entered as the next contract for the account
// (type New Business → Renewal → Renewal…). Ordering those by start date gives
// the renewal timeline; comparing each term's ARR to the previous term tells us
// whether the account EXPANDED, stayed FLAT, or CONTRACTED (downsell) at that
// renewal. This needs no separate ledger — it reads the contracts you already
// keep — and stays correct as new renewal contracts are added.

const toArrInr = (c, fx) => (c.currency === 'INR' ? (c.arr || 0) : (c.arr || 0) * fx) || 0;

/**
 * The renewal timeline for one account's contracts.
 * Returns { cycles[], renewalCount, firstArrInr, currentArrInr, netGrowthInr,
 *           netGrowthPct, trajectory }.
 */
export function renewalHistory(contracts, fx = config.fxUsdInr) {
    const ordered = [...(contracts || [])]
        .filter((c) => (c.arr || c.tcv))
        .sort((a, b) => String(a.start_date || a.created_at || '').localeCompare(String(b.start_date || b.created_at || '')));

    const cycles = [];
    let prev = null;
    ordered.forEach((c, i) => {
        const arr = toArrInr(c, fx);
        const prevArr = prev ? toArrInr(prev, fx) : null;
        const delta = prevArr === null ? 0 : arr - prevArr;
        const deltaPct = prevArr ? Math.round((delta / prevArr) * 100) : null;
        const classification = i === 0 ? 'Initial'
            : delta > 0 ? 'Expansion' : delta < 0 ? 'Contraction' : 'Flat';
        cycles.push({
            cycle: i, // 0 = initial term, 1 = first renewal, …
            contractId: c.id, type: c.type, status: c.status,
            start_date: c.start_date || '', renewal_date: c.renewal_date || '',
            arrInr: Math.round(arr),
            prevArrInr: prevArr === null ? null : Math.round(prevArr),
            deltaInr: Math.round(delta), deltaPct, classification
        });
        prev = c;
    });

    const first = cycles[0] || null;
    const last = cycles[cycles.length - 1] || null;
    const netGrowthInr = first && last ? last.arrInr - first.arrInr : 0;
    return {
        cycles,
        renewalCount: Math.max(0, ordered.length - 1),
        firstArrInr: first ? first.arrInr : 0,
        currentArrInr: last ? last.arrInr : 0,
        netGrowthInr,
        netGrowthPct: first && first.arrInr ? Math.round((netGrowthInr / first.arrInr) * 100) : null,
        trajectory: !last || cycles.length < 2 ? 'New'
            : last.arrInr > first.arrInr ? 'Expanded'
                : last.arrInr < first.arrInr ? 'Contracted' : 'Flat'
    };
}

/**
 * Portfolio roll-up: how many renewed accounts expanded vs contracted, and the
 * net ₹ movement from renewals. `contractsByAccount` = { accountName: [contracts] }.
 */
export function renewalPortfolio(contractsByAccount, fx = config.fxUsdInr) {
    let renewedAccounts = 0, expanded = 0, contracted = 0, flat = 0, netMovementInr = 0;
    const perAccount = [];
    for (const [account, contracts] of Object.entries(contractsByAccount || {})) {
        const h = renewalHistory(contracts, fx);
        if (h.renewalCount > 0) {
            renewedAccounts += 1;
            if (h.trajectory === 'Expanded') expanded += 1;
            else if (h.trajectory === 'Contracted') contracted += 1;
            else flat += 1;
            netMovementInr += h.netGrowthInr;
        }
        perAccount.push({
            account, renewalCount: h.renewalCount,
            currentArrInr: h.currentArrInr, netGrowthInr: h.netGrowthInr, trajectory: h.trajectory
        });
    }
    return { renewedAccounts, expanded, contracted, flat, netMovementInr, perAccount };
}
