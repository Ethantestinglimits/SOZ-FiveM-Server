type AddonContext = {
    keys(): string[];
    (id: string): unknown;
};

const addons = (
    require as unknown as { context: (path: string, deep: boolean, filter: RegExp) => AddonContext }
).context('./', true, /\.addon\.tsx?$/);

addons.keys().forEach(key => addons(key));
