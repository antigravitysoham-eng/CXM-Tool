import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockCustomers, mockContracts, onboardingSteps } from '../utils/mockData';

const CXContext = createContext();

export const useCX = () => {
    const context = useContext(CXContext);
    if (!context) {
        throw new Error('useCX must be used within a CXProvider');
    }
    return context;
};

export const CXProvider = ({ children }) => {
    const [customers, setCustomers] = useState(mockCustomers);
    const [contracts, setContracts] = useState(mockContracts);
    const [onboarding, setOnboarding] = useState(onboardingSteps);
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const addCustomer = (newCustomer) => {
        setCustomers(prev => [{ ...newCustomer, id: prev.length + 1 }, ...prev]);
        addToast(`Account "${newCustomer.name}" added successfully!`);
    };

    const updateContractStage = (contractId, newStage) => {
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
