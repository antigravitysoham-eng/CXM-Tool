/**
 * Connectors — where records come from when they don't come from a person.
 *
 * This is the structure, defined ahead of the integrations themselves so the
 * modules never have to change when one lands. Each connector declares what it
 * feeds, which fields it maps, and which field decides identity on re-sync. A
 * connector supplies `pull(credentials, since)`; everything else — provenance,
 * upserting, run logging, ABAC — is handled once by syncService.
 *
 * Nothing here invents data. Without credentials a connector reports
 * `configured: false` and pulls nothing; it never fabricates a customer.
 *
 * Adding one is: a definition here + a driver in ./drivers. No module changes.
 */

export const CONNECTORS = [
    {
        key: 'zoho_crm',
        name: 'Zoho CRM',
        blurb: 'Closed-won deals arrive as Cash Horizon accounts.',
        // Which module owns the records this connector feeds.
        module: 'accounts',
        target: 'customers',
        // Re-syncing must update the same row, not add a twin — this is the field
        // that decides "same record".
        identity: 'external_id',
        direction: 'inbound',
        // Their field -> ours. The shape the driver must return.
        fieldMap: {
            id: 'external_id',
            Account_Name: 'name',
            Industry: 'industry',
            Amount: 'value_amount',
            Currency: 'value_currency',
            Stage: 'stage',
            Owner: 'sales_owner',
            Closing_Date: 'renewal'
        },
        // Fields a human may edit without the next sync stamping on them.
        // Zoho owns the commercials; CX owns the relationship.
        localWins: ['cxm', 'health', 'next_step', 'next_step_date', 'tier', 'region'],
        credentialFields: ['client_id', 'client_secret', 'refresh_token', 'dc'],
        color: '#e53935'
    },
    {
        key: 'leegality',
        name: 'Leegality',
        blurb: 'Signed agreements land in the document library, against the right account.',
        module: 'documents',
        target: 'documents',
        identity: 'external_id',
        direction: 'inbound',
        fieldMap: {
            documentId: 'external_id',
            name: 'name',
            // Their signing status maps onto our document type/version story.
            irn: 'invoice_no',
            signedUrl: 'link',
            status: 'status',
            signedAt: 'created_at',
            // The account this belongs to has to be resolvable, or the document
            // is filed nowhere useful — see matchOn below.
            partyName: 'account'
        },
        // Their payload has no account id, only a party name, so matching is by
        // name and is fuzzy by nature. Unmatched documents are parked for a human
        // rather than guessed at — filing a signed agreement against the wrong
        // customer is worse than not filing it.
        matchOn: { field: 'account', against: 'customers.name', onMiss: 'quarantine' },
        localWins: ['doc_type', 'description'],
        credentialFields: ['api_key', 'workspace_id'],
        color: '#00897b'
    }
];

export const CONNECTOR_BY_KEY = Object.fromEntries(CONNECTORS.map((c) => [c.key, c]));

/** Provenance values a record's source_system can hold. */
export const SOURCES = ['manual', ...CONNECTORS.map((c) => c.key)];

/**
 * A record's provenance, for the UI.
 * Manual records are the default; synced ones say who supplied them and when, so
 * "why did this change overnight?" has an answer.
 */
export function provenanceOf(row) {
    const key = row?.source_system || 'manual';
    if (key === 'manual') return { source: 'manual', label: 'Entered here', synced_at: null };
    const def = CONNECTOR_BY_KEY[key];
    return {
        source: key,
        label: def ? `Synced from ${def.name}` : `Synced from ${key}`,
        color: def?.color,
        external_id: row.external_id || null,
        synced_at: row.synced_at || null
    };
}
