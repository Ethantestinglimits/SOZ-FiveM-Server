import { SearchIcon } from '@heroicons/react/outline';
import { FunctionComponent, useMemo, useState } from 'react';

const MAX_RESULTS = 8;

export type PauseMapSearchResult = {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
};

type PauseMapSearchProps = {
    items: PauseMapSearchResult[];
    onSelect: (result: PauseMapSearchResult) => void;
};

const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

export const PauseMapSearch: FunctionComponent<PauseMapSearchProps> = ({ items, onSelect }) => {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        const search = normalize(query.trim());

        if (!search) {
            return [];
        }

        return items.filter((item) => normalize(item.label).startsWith(search)).slice(0, MAX_RESULTS);
    }, [items, query]);

    const select = (result: PauseMapSearchResult) => {
        setQuery('');
        onSelect(result);
    };

    return (
        <div className="relative">
            <label className="flex items-center gap-[1vh] rounded-[1vh] bg-white/10 px-[1.2vh] py-[0.9vh]">
                <SearchIcon className="h-[1.9vh] w-[1.9vh] shrink-0 text-white/60" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && results.length > 0) {
                            select(results[0]);
                        }
                    }}
                    placeholder="Code postal, région, lieu…"
                    className="w-full bg-transparent text-[1.5vh] text-white outline-none placeholder:text-white/40"
                />
            </label>
            {results.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-[0.6vh] overflow-hidden rounded-[1vh] border border-white/20 bg-black/85">
                    {results.map((result) => (
                        <li key={result.id}>
                            <button
                                onClick={() => select(result)}
                                className="flex w-full items-center justify-between px-[1.2vh] py-[0.8vh] text-left text-[1.4vh] hover:bg-white/15"
                            >
                                <span className="truncate">{result.label}</span>
                                <span className="ml-[1vh] shrink-0 text-[1.1vh] uppercase tracking-wider text-white/40">
                                    {result.type}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
