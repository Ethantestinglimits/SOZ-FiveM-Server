import { KeyboardEvent as ReactKeyboardEvent, useEffect } from 'react';

export const NAV_ZONE_ATTRIBUTE = 'data-nav-zone';
export const NAV_SKIP_ATTRIBUTE = 'data-nav-skip';

export const FOCUS_RING_CLASSES =
    '[&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-inset [&_*:focus-visible]:ring-white';

const ZONES = ['side', 'main'];

const NAV_SELECTOR = [
    `button:not(:disabled):not([${NAV_SKIP_ATTRIBUTE}])`,
    `input:not(:disabled):not([${NAV_SKIP_ATTRIBUTE}])`,
    `[tabindex="0"]:not([${NAV_SKIP_ATTRIBUTE}])`,
].join(',');

const lastFocused = new Map<string, HTMLElement>();

const zoneElement = (zone: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[${NAV_ZONE_ATTRIBUTE}="${zone}"]`);

const zoneOf = (element: Element | null): string | null =>
    element?.closest(`[${NAV_ZONE_ATTRIBUTE}]`)?.getAttribute(NAV_ZONE_ATTRIBUTE) ?? null;

const itemsOf = (zone: string): HTMLElement[] =>
    Array.from(zoneElement(zone)?.querySelectorAll<HTMLElement>(NAV_SELECTOR) ?? []).filter(
        (element) => element.offsetParent !== null && !element.closest(`[${NAV_SKIP_ATTRIBUTE}]`),
    );

const focusItem = (element: HTMLElement | undefined): void => {
    if (!element) {
        return;
    }

    element.focus({ preventScroll: false });
    element.scrollIntoView({ block: 'nearest' });

    const zone = zoneOf(element);

    if (zone) {
        lastFocused.set(zone, element);
    }
};

const move = (direction: number): void => {
    const active = document.activeElement as HTMLElement | null;
    const zone = zoneOf(active) ?? ZONES[0];
    const items = itemsOf(zone);

    if (items.length === 0) {
        return;
    }

    const index = active ? items.indexOf(active) : -1;

    if (index === -1) {
        focusItem(direction > 0 ? items[0] : items[items.length - 1]);

        return;
    }

    focusItem(items[(index + direction + items.length) % items.length]);
};

const switchZone = (direction: number): void => {
    const current = zoneOf(document.activeElement) ?? ZONES[0];
    const next = ZONES[(ZONES.indexOf(current) + direction + ZONES.length) % ZONES.length];
    const items = itemsOf(next);
    const remembered = lastFocused.get(next);

    focusItem(remembered && items.includes(remembered) ? remembered : items[0]);
};

export const inputNavKeyDown = (event: ReactKeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        (event.target as HTMLElement).blur();
    }
};

export const useKeyboardNav = (enabled: boolean): void => {
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    move(1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    move(-1);
                    break;
                case 'Tab':
                    event.preventDefault();
                    switchZone(event.shiftKey ? -1 : 1);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled]);
};
