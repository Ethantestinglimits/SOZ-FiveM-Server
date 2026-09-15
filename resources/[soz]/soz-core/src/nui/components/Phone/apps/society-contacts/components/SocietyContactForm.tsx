import { ChatIcon } from '@heroicons/react/solid';
import { FunctionComponent } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SocietyContact } from '../../../../../../shared/phone/apps/society';
import { useAssetPath } from '../../../../../hook/assets';
import { ActionButton } from '../../../components/ActionButton';
import { Checkbox } from '../../../components/Checkbox';
import { ContactPicture } from '../../../components/ContactPicture';
import { TextareaField } from '../../../components/Input';
import { useDynamicIsland } from '../../../system/dynamic-island/hooks/useDynamicIsland';
import { useContactsAPI } from '../hooks/useContactsAPI';

type MessageInputs = {
    message: string;
    anonymous: boolean;
    position: boolean;
};

type SocietyContactFormProps = {
    contact: SocietyContact;
    onSent: () => void;
};

export const SocietyContactForm: FunctionComponent<SocietyContactFormProps> = ({ contact, onSent }) => {
    const { t } = useTranslation();
    const { getPath } = useAssetPath();
    const { sendSocietyMessage } = useContactsAPI();
    const { sendIsland } = useDynamicIsland();

    const {
        register,
        watch,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isValid },
    } = useForm<MessageInputs>({ mode: 'onChange', defaultValues: { position: true } });

    const submitForm: SubmitHandler<MessageInputs> = async data => {
        reset();
        onSent();

        sendSocietyMessage({
            number: contact.number,
            message: data.message,
            anonymous: data.anonymous,
            position: data.position,
        });
        sendIsland('success');
    };

    return (
        <form onSubmit={handleSubmit(submitForm)} className="grow flex flex-col gap-4 py-4">
            <div className="flex justify-center">
                <ContactPicture picture={getPath('images/society/' + contact.avatar)} size="large" />
            </div>

            <TextareaField
                className="grow"
                {...register('message', {
                    minLength: { value: 5, message: 'Votre message est trop court' },
                    maxLength: { value: 255, message: 'Votre message est trop long' },
                    required: 'Votre message est vide',
                })}
                variant="outlined"
                placeholder={t('SOCIETY_CONTACTS.FORM_MESSAGE')}
            />

            <div>
                <Checkbox
                    title="Envoyer avec ma position"
                    enabled={watch('position')}
                    onClick={value => setValue('position', value)}
                />
                {contact.anonymousCallAllowed && (
                    <Checkbox
                        title="Envoi anonyme"
                        enabled={watch('anonymous')}
                        onClick={value => setValue('anonymous', value)}
                    />
                )}
            </div>

            <ActionButton type="submit" disabled={!isValid}>
                <ChatIcon className="size-6" />
                {!isValid ? (
                    <p className="text-sm text-center text-gray-500">
                        {errors.message?.message ?? 'Vous devez remplir le formulaire'}
                    </p>
                ) : (
                    <p className="text-sm text-center">{t('SOCIETY_CONTACTS.SEND')}</p>
                )}
            </ActionButton>
        </form>
    );
};
