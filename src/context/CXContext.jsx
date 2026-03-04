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
    const [onboarding, setOnboarding] = useState(onboardingSteps);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        if (token) {
            fetch('http://localhost:5000/api/customers', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => setCustomers(data))
                .catch(err => console.error(err));

            fetch('http://localhost:5000/api/contracts', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => setContracts(data))
                .catch(err => console.error(err));
        } else {
            setCustomers([]);
            setContracts([]);
        }
    }, [token]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const addCustomer = async (newCustomer) => {
        try {
            const response = await fetch('http://localhost:5000/api/customers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCustomer)
            });
            const data = await response.json();

            if (response.ok) {
                setCustomers(prev => [data, ...prev]);
                addToast(`Account "${data.name}" added successfully!`);
            } else {
                addToast(data.error || 'Failed to add customer', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to connect to server', 'error');
        }
    };

    const updateContractStage = (contractId, newStage) => {
        // Mocked optimistic update
        setContracts(prev => prev.map(c =>
            c.id === contractId ? { ...c, stage: newStage } : c
        ));
        addToast(`Contract status updated to ${newStage}`);
    };

    const completeOnboardingStep = (stepId) => {
        setOnboarding(prev => prev.map(step =>
            step.id === stepId ? { ...step, completed: true, date: new Date().toISOString().split('T')[0] } : step
        ));
        addToast('Milestone completed!');
    };

    const automateOutreach = () => {
        addToast('Outreach automated for high-risk accounts', 'info');
    };

    return (
        <CXContext.Provider value={{
            customers,
            contracts,
            onboarding,
            toasts,
            addCustomer,
            updateContractStage,
            completeOnboardingStep,
            automateOutreach,
            addToast
        }}>
            {children}
        </CXContext.Provider>
    );
};
