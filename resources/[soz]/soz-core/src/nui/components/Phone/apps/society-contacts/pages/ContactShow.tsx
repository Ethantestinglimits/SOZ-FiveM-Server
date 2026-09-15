import React, { FunctionComponent, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AppContent } from '../../../components/system/AppContent';
import { AppWrapper } from '../../../components/system/AppWrapper';
import { useAppTitleGetBackUpdater } from '../../../system/apps/hooks/useAppTitleGetBackUpdater';
import { useAppTitleUpdater } from '../../../system/apps/hooks/useAppTitleUpdater';
import { SocietyContactForm } from '../components/SocietyContactForm';
import { useSocietyContact } from '../hooks/useContact';

export const ContactShow: FunctionComponent = () => {
    const navigate = useNavigate();

    const { number } = useParams();
    const contact = useSocietyContact(number);

    useAppTitleGetBackUpdater(() => navigate(-1));
    useAppTitleUpdater(true, contact?.display);

    useEffect(() => {
        if (contact) return;

        navigate('/society-contacts');
    }, []);

    if (!contact) {
        return null;
    }

    return (
        <AppWrapper className="flex flex-col">
            <AppContent>
                <SocietyContactForm contact={contact} onSent={() => navigate('/society-contacts', { replace: true })} />
            </AppContent>
        </AppWrapper>
    );
};
