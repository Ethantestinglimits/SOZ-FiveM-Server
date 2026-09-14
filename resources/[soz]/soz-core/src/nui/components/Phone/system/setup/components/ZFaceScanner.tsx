import { CheckIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import { FunctionComponent } from 'react';

export const ZFACE_TICKS = 24;

type ZFaceScannerProps = {
    progress: number;
    completed: boolean;
    dark: boolean;
};

export const ZFaceGlyph: FunctionComponent<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M6 20v-6a8 8 0 0 1 8-8h6" />
        <path d="M44 6h6a8 8 0 0 1 8 8v6" />
        <path d="M58 44v6a8 8 0 0 1-8 8h-6" />
        <path d="M20 58h-6a8 8 0 0 1-8-8v-6" />
        <path d="M22 24v5" />
        <path d="M42 24v5" />
        <path d="M32 24v12a3 3 0 0 1-3 3h-1" />
        <path d="M23 45c5 5 13 5 18 0" />
    </svg>
);

export const ZFaceScanner: FunctionComponent<ZFaceScannerProps> = ({ progress, completed, dark }) => (
    <div className="relative w-[210px] h-[210px] flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute inset-0">
            {Array.from({ length: ZFACE_TICKS }).map((_, index) => {
                const angle = (index / ZFACE_TICKS) * Math.PI * 2 - Math.PI / 2;

                return (
                    <line
                        key={index}
                        x1={100 + Math.cos(angle) * 82}
                        y1={100 + Math.sin(angle) * 82}
                        x2={100 + Math.cos(angle) * 96}
                        y2={100 + Math.sin(angle) * 96}
                        strokeWidth={4}
                        strokeLinecap="round"
                        className="transition-colors duration-150"
                        stroke={index < progress ? '#30D158' : dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}
                    />
                );
            })}
        </svg>

        {completed ? (
            <div className="w-[96px] h-[96px] rounded-full bg-[#30D158] flex items-center justify-center">
                <CheckIcon className="w-16 h-16 text-white" />
            </div>
        ) : (
            <ZFaceGlyph className={clsx('w-[104px] h-[104px]', { 'text-[#30D158]': progress > 0 })} />
        )}
    </div>
);
