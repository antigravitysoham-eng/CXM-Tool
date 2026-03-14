import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { onboardingSteps } from '../utils/mockData';

const CXContext = createContext();

export const useCX = () => {
    const context = useContext(CXContext);
    if (!context) {
        throw new Error('useCX must be used within a CXProvider');
    }
    return context;
};

export const CXProvider = ({ children }) => {
    const { token } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [onboarding, setOnboarding] = useState([
        {
            customerId: 1,
            account: 'Acme Corp',
            cxm: 'Sarah J.',
            progress: 50,
            status: 'On Track',
            steps: [
                { id: 1, label: 'Kickoff Meeting', date: '2024-02-01', completed: true },
                { id: 2, label: 'Technical Setup', date: '2024-02-05', completed: true },
                { id: 3, label: 'User Training', date: '2024-02-12', completed: false },
                { id: 4, label: 'Platform Launch', date: '2024-02-20', completed: false }
            ]
        },
        {
            customerId: 2,
            account: 'Globex',
            cxm: 'Mike T.',
            progress: 25,
            status: 'At Risk',
            steps: [
                { id: 1, label: 'Kickoff Meeting', date: '2024-03-01', completed: true },
                { id: 2, label: 'Technical Setup', date: '2024-03-10', completed: false },
                { id: 3, label: 'User Training', date: '2024-03-15', completed: false },
                { id: 4, label: 'Platform Launch', date: '2024-03-25', completed: false }
            ]
        }
    ]);
    const [healthChecks, setHealthChecks] = useState([]);
    const [ebrs, setEBRs] = useState([]);
    const [surveys, setSurveys] = useState([]);
    const [requests, setRequests] = useState([]);
    const [upsells, setUpsells] = useState([]);
    const [comms, setComms] = useState([]);
    const [events, setEvents] = useState([]);
    const [toasts, setToasts] = useState([]);

    // New Mock States for Enhancements
    const [referrals, setReferrals] = useState([
        { id: 1, referrer: 'Acme Corp', referee: 'Stark Industries', status: 'Pending', reward: '$500 Credit', date: '2026-03-01' },
        { id: 2, referrer: 'Globex', referee: 'Wayne Enterprises', status: 'Won', reward: '1 Month Free', date: '2026-02-15' },
        { id: 3, referrer: 'Soylent', referee: 'Cyberdyne', status: 'Lost', reward: 'Swag Pack', date: '2026-01-20' }
    ]);

    const [aiPredictions, setAiPredictions] = useState([
        { id: 1, account: 'Acme Corp', prediction: 'Premium Tier Upgrade', probability: 85, rationale: 'High usage in Advanced Analytics + Positive NPS + Requested EBR.' },
        { id: 2, account: 'Soylent', prediction: 'Extra Seats Expansion', probability: 92, rationale: 'Current seat utilization at 98% + recent hiring announcements.' },
        { id: 3, account: 'Initech', prediction: 'Professional Services', probability: 60, rationale: 'Struggling with complex feature adoption + recent support tickets.' }
    ]);

    const [personaTriggers, setPersonaTriggers] = useState([
        { id: 1, persona: 'Admin', trigger: 'Failed Login > 3', template: 'Security Check-in', status: 'Active' },
        { id: 2, persona: 'Executive', trigger: 'Quarterly boundary crossed', template: 'Executive Summary Report', status: 'Active' },
        { id: 3, persona: 'Power User', trigger: 'Hasnt logged in 14 days', template: 'We Miss You / Tips', status: 'Paused' }
    ]);

    const fetchAllData = async () => {
        if (!token) return;

        const endpoints = [
            { url: 'customers', setter: setCustomers },
            { url: 'contracts', setter: setContracts },
            { url: 'health-checks', setter: setHealthChecks },
            { url: 'ebrs', setter: setEBRs },
            { url: 'surveys', setter: setSurveys },
            { url: 'feature-requests', setter: setRequests },
            { url: 'upsells', setter: setUpsells },
            { url: 'comms', setter: setComms },
            { url: 'events', setter: setEvents }
        ];

        endpoints.forEach(async ({ url, setter }) => {
            try {
                const res = await fetch(`http://127.0.0.1:5000/api/${url}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setter(data);
            } catch (err) {
                console.error(`Failed to fetch ${url}:`, err);
            }
        });
    };

    useEffect(() => {
        if (token) {
            fetchAllData();
        } else {
            setCustomers([]);
            setContracts([]);
            setHealthChecks([]);
            setEBRs([]);
            setSurveys([]);
            setRequests([]);
            setUpsells([]);
            setComms([]);
            setEvents([]);
        }
    }, [token]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const addData = async (endpoint, payload, toastMessage) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                fetchAllData(); // Refresh all data to stay in sync
                if (toastMessage) addToast(toastMessage);
                return data;
            } else {
                addToast(data.error || `Failed to add ${endpoint}`, 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Connection error', 'error');
        }
    };

    const addCustomer = (customer) => addData('customers', customer, `Account "${customer.name}" added!`);
    const addHealthCheck = (check) => addData('health-checks', check, 'Health check logged!');
    const addSurvey = (survey) => addData('surveys', survey, 'Survey created!');
    const addRequest = (request) => addData('feature-requests', request, 'Feature request submitted!');
    const addUpsell = (upsell) => addData('upsells', upsell, 'Upsell opportunity added!');
    const addComm = (comm) => addData('comms', comm, 'Campaign scheduled!');
    const addEvent = (event) => addData('events', event, 'Event planned!');
    const addEbr = (ebr) => addData('ebrs', ebr, 'EBR scheduled!');

    const voteRequest = async (requestId) => {
        await addData('feature-requests/vote', { id: requestId });
    };

    const completeOnboardingStep = (customerId, stepId) => {
        const date = new Date().toISOString().split('T')[0];
        setOnboarding(prev => prev.map(customer => {
            if (customer.customerId === customerId) {
                const updatedSteps = customer.steps.map(step =>
                    step.id === stepId ? { ...step, completed: true, date } : step
                );
                const completedCount = updatedSteps.filter(s => s.completed).length;
                const progress = Math.round((completedCount / updatedSteps.length) * 100);
                return { ...customer, steps: updatedSteps, progress };
            }
            return customer;
        }));
        addToast('Milestone completed!');
    };

    const addReferral = (referral) => {
        setReferrals(prev => [{ ...referral, id: Date.now() }, ...prev]);
        addToast('Referral tracked successfully!');
    };

    const addPersonaTrigger = (trigger) => {
        setPersonaTriggers(prev => [{ ...trigger, id: Date.now() }, ...prev]);
        addToast('Persona trigger configured!');
    };

    const queryAI = async (query) => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/ai/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            });
            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error(error);
            return "I'm having trouble connecting to my knowledge base right now.";
        }
    };

    const updateContractStage = (contractId, newStage) => {
        // Optimistic update for UI feel, followed by refresh
        setContracts(prev => prev.map(c =>
            c.id === contractId ? { ...c, stage: newStage } : c
        ));
        addToast(`Contract status updated to ${newStage}`);
    };

    const automateOutreach = () => {
        addToast('Outreach automated for high-risk accounts', 'info');
    };

    const syncZohoDeals = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/zoho/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                addToast(`Successfully synced ${data.count} deals from Zoho!`, 'success');
                fetchAllData();
            } else {
                addToast(data.error || 'Zoho sync failed', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Connection error during Zoho sync', 'error');
        }
    };

    return (
        <CXContext.Provider value={{
            customers,
            contracts,
            onboarding,
            healthChecks,
            ebrs,
            surveys,
            requests,
            upsells,
            comms,
            events,
            toasts,
            referrals,
            aiPredictions,
            personaTriggers,
            addCustomer,
            addHealthCheck,
            addSurvey,
            addRequest,
            addUpsell,
            addComm,
            addEvent,
            addEbr,
            voteRequest,
            completeOnboardingStep,
            addReferral,
            addPersonaTrigger,
            updateContractStage,
            automateOutreach,
            addToast,
            queryAI,
            syncZohoDeals
        }}>
            {children}
        </CXContext.Provider>
    );
};
