import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import { FunctionComponent, useState } from 'react';

import { SocietyContact } from '../../../../../../shared/phone/apps/society';
import { useAssetPath } from '../../../../../hook/assets';
import { SocietyContactForm } from '../../../apps/society-contacts/components/SocietyContactForm';
import { societyContacts } from '../../../apps/society-contacts/contacts.constant';
import { ContactPicture } from '../../../components/ContactPicture';

const EMERGENCY_NUMBERS = ['555-POLICE', '555-LSMC'];

const emergencyContacts = EMERGENCY_NUMBERS.map(number =>
    societyContacts.find(contact => contact.number === number)
).filter(Boolean);

type EmergencyDirectoryProps = {
    onClose: () => void;
};

export const EmergencyDirectory: FunctionComponent<EmergencyDirectoryProps> = ({ onClose }) => {
    const { getPath } = useAssetPath();

    const [selectedContact, setSelectedContact] = useState<SocietyContact | null>(null);

    return (
        <div className="flex flex-col h-full w-full px-6 pt-14 pb-8">
            <div className="flex items-center h-10">
                <button
                    className="flex items-center text-[17px] text-white"
                    onClick={() => (selectedContact ? setSelectedContact(null) : onClose())}
                >
                    <ChevronLeftIcon className="h-7 w-7 -ml-1" />
                    Retour
                </button>
            </div>

            <h1 className="mt-2 text-[32px] leading-tight font-bold">
                {selectedContact ? selectedContact.display : 'Urgence'}
            </h1>

            {selectedContact ? (
                <div className="flex flex-col flex-1 min-h-0">
                    <SocietyContactForm contact={selectedContact} onSent={onClose} />
                </div>
            ) : (
                <div className="mt-6 rounded-2xl overflow-hidden bg-white/15">
                    {emergencyContacts.map((contact, index) => (
                        <button
                            key={contact.number}
                            onClick={() => setSelectedContact(contact)}
                            className={clsx('flex items-center w-full gap-4 px-4 py-2 text-left active:bg-white/10', {
                                'border-t border-white/15': index > 0,
                            })}
                        >
                            <ContactPicture picture={getPath('images/society/' + contact.avatar)} />
                            <span className="flex-1 text-[17px]">{contact.display}</span>
                            <ChevronRightIcon className="h-6 w-6 opacity-60" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
