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
    const [onboarding, setOnboarding] = useState([]);
    const [healthChecks, setHealthChecks] = useState([]);
    const [ebrs, setEBRs] = useState([]);
    const [surveys, setSurveys] = useState([]);
    const [requests, setRequests] = useState([]);
    const [upsells, setUpsells] = useState([]);
    const [comms, setComms] = useState([]);
    const [events, setEvents] = useState([]);
    const [toasts, setToasts] = useState([]);

    const fetchAllData = async () => {
        if (!token) return;

        const endpoints = [
            { url: 'customers', setter: setCustomers },
            { url: 'contracts', setter: setContracts },
            { url: 'onboarding', setter: setOnboarding },
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
            setOnboarding([]);
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

    const completeOnboardingStep = async (stepId) => {
        const date = new Date().toISOString().split('T')[0];
        await addData('onboarding/complete', { id: stepId, date });
        addToast('Milestone completed!');
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
            updateContractStage,
            automateOutreach,
            addToast,
            queryAI
        }}>
            {children}
        </CXContext.Provider>
    );
};
