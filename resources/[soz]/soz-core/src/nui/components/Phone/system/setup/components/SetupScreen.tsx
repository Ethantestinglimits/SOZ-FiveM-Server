import { ChevronLeftIcon } from '@heroicons/react/solid';
import { animated, useSpring } from '@react-spring/web';
import clsx from 'clsx';
import { FunctionComponent, PropsWithChildren, ReactNode } from 'react';

type SetupScreenProps = PropsWithChildren<{
    dark: boolean;
    title?: string;
    subtitle?: string;
    icon?: ReactNode;
    footer?: ReactNode;
    onBack?: () => void;
}>;

export const SetupScreen: FunctionComponent<SetupScreenProps> = ({
    dark,
    title,
    subtitle,
    icon,
    footer,
    onBack,
    children,
}) => {
    const styles = useSpring({
        from: { opacity: 0, transform: 'translateX(40px)' },
        to: { opacity: 1, transform: 'translateX(0px)' },
        config: { tension: 320, friction: 30 },
    });

    return (
        <div
            className={clsx('flex flex-col h-full w-full transition-colors duration-500', {
                'bg-black text-white': dark,
                'bg-white text-black': !dark,
            })}
        >
            <div className="h-14 flex items-end px-4">
                {onBack && (
                    <button className="flex items-center text-[17px] text-[#0A84FF]" onClick={onBack}>
                        <ChevronLeftIcon className="h-7 w-7 -ml-1" />
                        Retour
                    </button>
                )}
            </div>

            <animated.div style={styles} className="flex flex-col flex-1 min-h-0 px-8 pb-10">
                {icon && <div className="flex justify-center mt-6 mb-5">{icon}</div>}

                {title && (
                    <h1 className={clsx('text-[32px] leading-tight font-bold text-center', { 'mt-6': !icon })}>
                        {title}
                    </h1>
                )}

                {subtitle && (
                    <p
                        className={clsx('mt-3 text-[16px] leading-snug text-center', {
                            'text-neutral-400': dark,
                            'text-neutral-500': !dark,
                        })}
                    >
                        {subtitle}
                    </p>
                )}

                <div className="flex flex-col flex-1 min-h-0 mt-8">{children}</div>

                {footer && <div className="mt-6">{footer}</div>}
            </animated.div>
        </div>
    );
};

type SetupButtonProps = PropsWithChildren<{
    onClick: () => void;
    disabled?: boolean;
}>;

export const SetupButton: FunctionComponent<SetupButtonProps> = ({ onClick, disabled = false, children }) => (
    <button
        disabled={disabled}
        onClick={onClick}
        className={clsx('w-full h-[54px] rounded-[14px] text-[17px] font-semibold text-white transition-opacity', {
            'bg-[#0A84FF] active:opacity-80': !disabled,
            'bg-[#0A84FF]/40': disabled,
        })}
    >
        {children}
    </button>
);
