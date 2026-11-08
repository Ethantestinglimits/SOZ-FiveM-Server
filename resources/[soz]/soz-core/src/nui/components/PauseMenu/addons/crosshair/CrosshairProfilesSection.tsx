import classNames from 'classnames';
import { FunctionComponent, KeyboardEvent, useState } from 'react';

import {
    CROSSHAIR_NAME_MAX,
    CROSSHAIR_PRESETS,
    CrosshairConfig,
    CrosshairProfiles,
    decodeCrosshair,
    encodeCrosshair,
    MAX_CROSSHAIR_PROFILES,
} from '../../../../../shared/nui/crosshair';
import { CrosshairView } from '../../../Crosshair/CrosshairView';
import { inputNavKeyDown, navGroup, navSelected } from '../../keyboardNav';

type Mode = 'idle' | 'new' | 'rename' | 'import';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);

        return true;
    } catch {
        const area = document.createElement('textarea');

        area.value = text;
        document.body.appendChild(area);
        area.select();

        const copied = document.execCommand('copy');

        area.remove();

        return copied;
    }
};

const ActionButton: FunctionComponent<{ label: string; disabled?: boolean; danger?: boolean; onClick: () => void }> = ({
    label,
    disabled,
    danger,
    onClick,
}) => (
    <button
        disabled={disabled}
        onClick={onClick}
        className={classNames(
            'rounded-[0.8vh] px-[1.2vh] py-[0.6vh] text-[1.3vh] font-semibold transition-colors disabled:cursor-default disabled:opacity-40',
            danger ? 'bg-red-500/20 text-red-200 hover:bg-red-500/50' : 'bg-white/10 hover:bg-white/25'
        )}
    >
        {label}
    </button>
);

type CrosshairProfilesSectionProps = {
    profiles: CrosshairProfiles;
    onChange: (profiles: CrosshairProfiles) => void;
};

export const CrosshairProfilesSection: FunctionComponent<CrosshairProfilesSectionProps> = ({ profiles, onChange }) => {
    const [mode, setMode] = useState<Mode>('idle');
    const [text, setText] = useState('');
    const [message, setMessage] = useState<{ error: boolean; text: string; code?: string } | null>(null);

    const active = profiles.profiles.find(profile => profile.id === profiles.active) ?? profiles.profiles[0];
    const full = profiles.profiles.length >= MAX_CROSSHAIR_PROFILES;

    const open = (next: Mode, value = '') => {
        setMode(mode === next ? 'idle' : next);
        setText(value);
        setMessage(null);
    };

    const add = (name: string, config: CrosshairConfig) => {
        const id = newId();

        onChange({ active: id, profiles: [...profiles.profiles, { id, name, config }] });
        setMode('idle');
    };

    const rename = () => {
        const name = text.trim().slice(0, CROSSHAIR_NAME_MAX);

        if (name) {
            onChange({
                ...profiles,
                profiles: profiles.profiles.map(profile => (profile.id === active.id ? { ...profile, name } : profile)),
            });
        }

        setMode('idle');
    };

    const remove = () => {
        const remaining = profiles.profiles.filter(profile => profile.id !== active.id);

        onChange({ active: remaining[0].id, profiles: remaining });
    };

    const importCode = () => {
        const config = decodeCrosshair(text);

        if (!config) {
            setMessage({ error: true, text: 'Ce code de viseur est invalide.' });

            return;
        }

        add('Importé', config);
        setMessage({ error: false, text: 'Viseur importé dans un nouveau profil.' });
    };

    const copy = async () => {
        const code = encodeCrosshair(active.config);
        const copied = await copyText(code);

        setMode('idle');
        setMessage(
            copied
                ? { error: false, text: 'Code copié dans le presse-papiers.' }
                : { error: false, text: 'Copie impossible, sélectionne le code :', code }
        );
    };

    const onKeyDown = (submit: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        inputNavKeyDown(event);

        if (event.key === 'Enter') {
            submit();
        }
    };

    return (
        <div className="flex flex-col gap-[0.8vh]">
            <div className="flex flex-wrap gap-[0.6vh]" {...navGroup('select')}>
                {profiles.profiles.map(profile => (
                    <button
                        key={profile.id}
                        {...navSelected(profile.id === active.id)}
                        onClick={() => onChange({ ...profiles, active: profile.id })}
                        className={classNames(
                            'flex items-center gap-[0.6vh] rounded-[0.8vh] py-[0.4vh] pl-[0.5vh] pr-[1.1vh] text-[1.3vh] font-semibold transition-colors',
                            profile.id === active.id ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/25'
                        )}
                    >
                        <span className="flex h-[2.6vh] w-[2.6vh] items-center justify-center overflow-hidden rounded-[0.5vh] bg-neutral-900">
                            <CrosshairView config={profile.config} size="2.6vh" />
                        </span>
                        {profile.name}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-[0.6vh]">
                <ActionButton label="Nouveau" disabled={full} onClick={() => open('new')} />
                <ActionButton
                    label="Dupliquer"
                    disabled={full}
                    onClick={() => add(`${active.name} (copie)`.slice(0, CROSSHAIR_NAME_MAX), active.config)}
                />
                <ActionButton label="Renommer" onClick={() => open('rename', active.name)} />
                <ActionButton label="Supprimer" danger disabled={profiles.profiles.length < 2} onClick={remove} />
                <span className="flex-1" />
                <ActionButton label="Copier le code" onClick={copy} />
                <ActionButton label="Importer un code" disabled={full} onClick={() => open('import')} />
            </div>

            {mode === 'new' && (
                <div className="grid grid-cols-6 gap-[0.8vh]">
                    {CROSSHAIR_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => add(preset.label, preset.config)}
                            className="flex flex-col items-center gap-[0.4vh] rounded-[1vh] bg-white/5 px-[0.6vh] py-[0.8vh] text-[1.3vh] font-semibold hover:bg-white/15"
                        >
                            <div className="flex h-[5vh] w-full items-center justify-center overflow-hidden rounded-[0.8vh] bg-neutral-900">
                                <CrosshairView config={preset.config} size="5vh" />
                            </div>
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}

            {(mode === 'rename' || mode === 'import') && (
                <div className="flex items-center gap-[0.6vh]">
                    <input
                        autoFocus
                        value={text}
                        maxLength={mode === 'rename' ? CROSSHAIR_NAME_MAX : 64}
                        onChange={event => setText(event.target.value)}
                        onKeyDown={onKeyDown(mode === 'rename' ? rename : importCode)}
                        placeholder={mode === 'rename' ? 'Nom du profil' : 'Colle un code SOZ1-…'}
                        className="flex-1 rounded-[0.8vh] bg-white/10 px-[1.2vh] py-[0.6vh] text-[1.4vh] text-white outline-none placeholder:text-white/40"
                    />
                    <ActionButton label="Valider" onClick={mode === 'rename' ? rename : importCode} />
                    <ActionButton label="Annuler" onClick={() => setMode('idle')} />
                </div>
            )}

            {message && (
                <div className={classNames('text-[1.3vh]', message.error ? 'text-red-300' : 'text-white/70')}>
                    {message.text}
                    {message.code && (
                        <span className="ml-[0.8vh] select-all rounded-[0.5vh] bg-white/10 px-[0.8vh] py-[0.2vh] font-mono text-white">
                            {message.code}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
