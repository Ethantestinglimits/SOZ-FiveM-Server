const fs = require('fs');
const path = require('path');

const [, , parsedPath, streamListPath, sozConfigPath, sozStreamDir, outDir] = process.argv;

const parsed = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
const streamFiles = fs.readFileSync(streamListPath, 'utf8').split('\n').filter(Boolean);
const sozConfig = fs.readFileSync(sozConfigPath, 'utf8');

const SOURCE = 'rpemotes-reborn';
const CHUNK = 60;

const base = f => path.basename(f).replace(/\.[^.]+$/, '').toLowerCase();
const customPackOf = new Map();
for (const f of streamFiles) {
    const m = f.match(/^stream\/\[(Custom Emotes|Props)\]\/([^/]+)\//);
    if (!m || m[2] === 'basegame') continue;
    if (/\.(ycd|ydr|yft|ytyp)$/i.test(f)) customPackOf.set(base(f), m[2]);
}

const sozStreamed = new Set(
    fs
        .readdirSync(sozStreamDir, { recursive: true })
        .filter(f => /\.(ycd|ydr|yft)$/i.test(f))
        .map(f => base(f))
);

const sozAnims = new Map();
for (const m of sozConfig.matchAll(/name: '([^']+)',\s*rightLabel[\s\S]*?dictionary: '([^']+)',\s*name: '([^']+)'/g)) {
    sozAnims.set(`${m[2]}|${m[3]}`, m[1]);
}
for (const m of sozConfig.matchAll(/dictionary: '([^']+)',\s*name: '([^']+)'/g)) {
    if (!sozAnims.has(`${m[1]}|${m[2]}`)) sozAnims.set(`${m[1]}|${m[2]}`, '?');
}
const sozScenarios = new Set([...sozConfig.matchAll(/scenario: \{\s*name: '([^']+)'/g)].map(m => m[1]));
const sozMoods = new Set([...sozConfig.matchAll(/mood: '([^']+)'/g)].map(m => m[1].toLowerCase()));
const sozWalks = new Set([...sozConfig.matchAll(/walk: '([^']+)'/g)].map(m => m[1].toLowerCase()));

const SEXUAL = [
    /\bsex/i,
    /sexy/i,
    /twerk/i,
    /lap ?dance/i,
    /strip/i,
    /\bpole/i,
    /hump/i,
    /thrust/i,
    /fuck/i,
    /blow ?job/i,
    /\bbj\b/i,
    /hooker/i,
    /prostitut/i,
    /seduc/i,
    /booty/i,
    /horny/i,
    /shag/i,
    /suggestive/i,
    /grind/i,
    /pimp/i,
    /flash(ing)? ?(boob|tits|chest)/i,
    /boob/i,
    /\btits?\b/i,
    /crotch/i,
    /breast/i,
    /\bbutt\b/i,
    /\bass\b/i,
    /jerk ?off|wank/i,
    /masturb/i,
    /orgasm/i,
    /nsfw/i,
    /dick|penis|cock\b/i,
];

const HARD_SEXUAL_ANIM = [/shagging/i, /thrust/i, /booty/i, /fuckm/i, /lap_?dance/i, /\bsex/i, /blow_?job/i, /pole_?dance/i];
const SEXUAL_CONTEXT = [/strip_?club/i, /prostitut/i, /hooker/i, /stripper/i];

const flagsToOptions = flag => {
    const o = {};
    if (flag & 1) o.repeat = true;
    if (flag & 2) o.freezeLastFrame = true;
    if (flag & 4) o.freezeLastFrameControllable = true;
    if (flag & 16) o.onlyUpperBody = true;
    if (flag & 32) o.enablePlayerControl = true;
    if (flag & 64) o.cancellable = true;
    if (flag & 512) o.turnOffCollision = true;
    if (flag & 2048) o.ignoreGravity = true;
    const known = 1 | 2 | 4 | 16 | 32 | 64 | 512 | 2048;
    return [o, flag & ~known];
};

const resolveFlag = v => {
    if (typeof v === 'number') return v;
    if (v === 'AnimFlag.MOVING') return 51;
    if (v === 'AnimFlag.LOOP') return 1;
    if (v === 'AnimFlag.STUCK') return 50;
    return null;
};

const placement = p => {
    const a = Array.isArray(p) ? p : [];
    const r = n => Math.round((a[n] || 0) * 10000) / 10000;
    return { position: [r(0), r(1), r(2)], rotation: [r(3), r(4), r(5)] };
};

const excluded = [];
const exclude = (section, e, reason, extra = {}) => void
    excluded.push({ section, key: e.key, label: extra.label || null, reason, ...extra });

function convertAnim(section, e) {
    const list = Array.isArray(e.data) ? e.data : e.data.__list || [];
    const opts = (!Array.isArray(e.data) && e.data.AnimationOptions) || {};
    const [dict, clip, label] = list;
    const notes = [];
    const assets = [dict, opts.Prop, opts.SecondProp].filter(Boolean).map(x => String(x).toLowerCase());
    const animText = `${dict} ${clip}`;

    if (SEXUAL.some(r => r.test(`${e.key} ${label}`)) || HARD_SEXUAL_ANIM.some(r => r.test(animText)))
        return exclude(section, e, 'sexual', { label, dict, clip });
    if (SEXUAL_CONTEXT.some(r => r.test(animText))) notes.push(`⚠ contexte suggestif possible: ${dict} ${clip}`);
    for (const a of assets) {
        if (customPackOf.has(a))
            return exclude(section, e, sozStreamed.has(a) ? 'custom-already-in-soz' : 'custom', {
                label,
                pack: customPackOf.get(a),
                asset: a,
            });
    }
    if (e.comment && /custom|provided/i.test(e.comment)) return exclude(section, e, 'custom', { label, comment: e.comment });
    if (opts.vehicleRequirement === 'VehicleRequirement.REQUIRED') return exclude(section, e, 'vehicle-only', { label });
    if (opts.PtfxAsset) return exclude(section, e, 'ptfx', { label });

    const duplicate = sozAnims.get(`${dict}|${clip}`);
    if (duplicate && !opts.Prop) return exclude(section, e, 'duplicate-soz', { label, soz: duplicate });

    let flag = resolveFlag(opts.onFootFlag ?? opts.Flag);
    if (flag === null) flag = opts.EmoteMoving ? 51 : opts.EmoteLoop ? 1 : 0;
    const [options, unknownBits] = flagsToOptions(flag);
    if (unknownBits) notes.push(`flag bits inconnus: ${unknownBits}`);
    if (opts.ExitEmote) notes.push(`exit rpemotes: ${opts.ExitEmote}`);
    if (opts.StartDelay) notes.push(`startDelay: ${opts.StartDelay}`);
    if (opts.PropTextureVariations) notes.push('variantes de texture du prop ignorées');

    const info = { dictionary: dict, name: clip, options };
    if (opts.EmoteDuration) info.duration = opts.EmoteDuration;

    const animation = { base: info };
    const props = [];
    if (opts.Prop) props.push({ bone: opts.PropBone, model: opts.Prop, ...placement(opts.PropPlacement) });
    if (opts.SecondProp)
        props.push({ bone: opts.SecondPropBone, model: opts.SecondProp, ...placement(opts.SecondPropPlacement) });
    if (props.length) animation.props = props;

    return {
        key: e.key,
        label,
        section,
        duplicateOf: duplicate || null,
        notes,
        item: { type: 'animation', name: label, rightLabel: null, icon: null, command: e.key, source: SOURCE, animation },
    };
}

function convertScenario(section, e) {
    const [type, name, label] = e.data;
    if (SEXUAL.some(r => r.test(`${e.key} ${label} ${name}`))) return exclude(section, e, 'sexual', { label });
    if (sozScenarios.has(name)) return exclude(section, e, 'duplicate-soz', { label, scenario: name });
    const notes = [];
    if (type === 'ScenarioType.MALE') notes.push('scénario homme uniquement');
    if (type === 'ScenarioType.OBJECT') notes.push('scénario avec objet');
    return {
        key: e.key,
        label,
        section,
        duplicateOf: null,
        notes,
        item: { type: 'scenario', name: label, rightLabel: null, icon: null, command: e.key, source: SOURCE, scenario: { name } },
    };
}

function convertWalk(e) {
    const [walk, label] = Array.isArray(e.data) ? e.data : e.data.__list || [];
    const name = label || e.key;
    if (SEXUAL.some(r => r.test(`${e.key} ${name} ${walk}`))) return exclude('Walks', e, 'sexual', { label: name });
    if (customPackOf.has(String(walk).toLowerCase())) return exclude('Walks', e, 'custom', { label: name });
    if (sozWalks.has(String(walk).toLowerCase())) return exclude('Walks', e, 'duplicate-soz', { label: name, walk });
    return { key: e.key, label: name, section: 'Walks', duplicateOf: null, notes: [], item: { type: 'walk', name, walk, command: e.key, source: SOURCE } };
}

function convertMood(e) {
    const [mood, label] = Array.isArray(e.data) ? e.data : e.data.__list || [];
    const name = label || e.key;
    if (SEXUAL.some(r => r.test(`${e.key} ${name} ${mood}`))) return exclude('Expressions', e, 'sexual', { label: name });
    if (sozMoods.has(String(mood).toLowerCase())) return exclude('Expressions', e, 'duplicate-soz', { label: name, mood });
    return { key: e.key, label: name, section: 'Expressions', duplicateOf: null, notes: [], item: { type: 'mood', name, mood, command: e.key, source: SOURCE } };
}

const isScenario = e => Array.isArray(e.data) && /^ScenarioType\./.test(e.data[0]);

const packs = [];
const pushChunks = (id, title, entries) => {
    entries.sort((a, b) => a.key.localeCompare(b.key));
    const n = Math.ceil(entries.length / CHUNK);
    for (let i = 0; i < n; i++) {
        const slice = entries.slice(i * CHUNK, (i + 1) * CHUNK);
        const suffix = n > 1 ? `-${String(i + 1).padStart(2, '0')}` : '';
        packs.push({
            id: `${id}${suffix}`,
            title: `${title}${n > 1 ? ` ${i + 1}/${n} (${slice[0].key} → ${slice[slice.length - 1].key})` : ''}`,
            source: SOURCE,
            entries: slice,
        });
    }
};

const conv = (section, list) => list.map(e => (isScenario(e) ? convertScenario(section, e) : convertAnim(section, e))).filter(Boolean);

pushChunks('dances', 'Danses', conv('Dances', parsed.Dances));
pushChunks('scenarios', 'Scénarios', conv('Emotes', parsed.Emotes.filter(isScenario)));
pushChunks('emotes', 'Emotes', conv('Emotes', parsed.Emotes.filter(e => !isScenario(e))));
pushChunks('props', 'Emotes avec props', conv('PropEmotes', parsed.PropEmotes));
pushChunks('walks', 'Démarches', parsed.Walks.map(convertWalk).filter(Boolean));
pushChunks('moods', 'Humeurs', parsed.Expressions.map(convertMood).filter(Boolean));

for (const s of ['Shared', 'AnimalEmotes', 'Exits']) for (const e of parsed[s]) exclude(s, e, 'section-skipped');

const packDir = path.join(outDir, 'packs');
fs.mkdirSync(packDir, { recursive: true });
for (const f of fs.readdirSync(packDir)) fs.unlinkSync(path.join(packDir, f));
for (const p of packs) fs.writeFileSync(path.join(packDir, `${p.id}.json`), JSON.stringify(p, null, 4) + '\n');
fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(packs.map(p => ({ id: p.id, title: p.title, count: p.entries.length })), null, 4) + '\n'
);
fs.writeFileSync(path.join(outDir, 'excluded.json'), JSON.stringify(excluded, null, 4) + '\n');

const byReason = {};
for (const x of excluded) byReason[x.reason] = (byReason[x.reason] || 0) + 1;
console.log('packs', packs.length, 'entries', packs.reduce((a, p) => a + p.entries.length, 0));
for (const p of packs) console.log(' ', p.id, p.entries.length);
console.log('excluded', byReason);
