import { getDb } from '../db.js';
import { getCredentials, logSync } from './credentialService.js';

export const syncClosedWonDeals = async () => {
    let creds;
    try {
        creds = await getCredentials('zoho');
        if (!creds || !creds.refresh_token) {
            throw new Error('Zoho credentials not configured. Please visit the Connectivity Hub.');
        }

        const accessToken = await getAccessToken(creds);
        const db = await getDb();

        const response = await fetch(`https://www.zohoapis.${creds.dc || 'com'}/crm/v2/coql`, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                select_query: "select Deal_Name, Amount, Closing_Date, Account_Name, Pipeline, Industry from Deals where Stage = 'Closed Won'"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Zoho API error');
        }

        const deals = data.data || [];
        const syncedAccounts = [];

        for (const deal of deals) {
            const accountName = deal.Account_Name?.name || deal.Deal_Name;
            const existing = await db.get('SELECT id FROM customers WHERE name = ?', [accountName]);

            if (!existing) {
                const result = await db.run(
                    'INSERT INTO customers (name, tier, arr, status, owner, renewal, industry, progress, health, value, cxm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        accountName,
                        'Enterprise',
                        `$${deal.Amount || 0}`,
                        'Onboarding',
                        'Zoho Sync',
                        deal.Closing_Date || '',
                        deal.Industry || 'SaaS',
                        0,
                        'Good',
                        `$${(deal.Amount / 1000).toFixed(0)}k`,
                        'System'
                    ]
                );
                syncedAccounts.push({ id: result.lastID, name: accountName });
            }
        }

        await logSync('zoho', 'Success', syncedAccounts.length);
        return syncedAccounts;
    } catch (error) {
        console.error('Error syncing Zoho deals:', error.message);
        await logSync('zoho', 'Failed', 0, error.message);
        throw error;
    }
};

const getAccessToken = async (creds) => {
    try {
        const { client_id, client_secret, refresh_token, dc } = creds;
        const params = new URLSearchParams();
        params.append('refresh_token', refresh_token);
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);
        params.append('grant_type', 'refresh_token');

        const response = await fetch(`https://accounts.zoho.${dc || 'com'}/oauth/v2/token?${params.toString()}`, {
            method: 'POST'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Token refresh failed');
        }
        return data.access_token;
    } catch (error) {
        throw new Error(`Zoho auth failed: ${error.message}`);
    }
};
