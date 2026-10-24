const fs = require('fs');
const luaparse = require('luaparse');

const [, , input, output] = process.argv;
const src = fs.readFileSync(input, 'utf8');
const ast = luaparse.parse(src, { comments: true, locations: true, luaVersion: '5.3' });

const commentsByLine = new Map();
for (const c of ast.comments) commentsByLine.set(c.loc.start.line, c.value.trim());

function key(k) {
    if (k.type === 'StringLiteral') return k.raw.slice(1, -1);
    if (k.type === 'Identifier') return k.name;
    if (k.type === 'NumericLiteral') return k.value;
    return JSON.stringify(k);
}

function val(n) {
    switch (n.type) {
        case 'StringLiteral':
            return n.raw.slice(1, -1).replace(/\\(["'\\])/g, '$1');
        case 'NumericLiteral':
            return n.value;
        case 'BooleanLiteral':
            return n.value;
        case 'NilLiteral':
            return null;
        case 'UnaryExpression':
            if (n.operator === '-') return -val(n.argument);
            return { expr: n.operator };
        case 'MemberExpression':
            return `${n.base.name}.${n.identifier.name}`;
        case 'Identifier':
            return n.name;
        case 'TableConstructorExpression': {
            const arr = [];
            const obj = {};
            for (const f of n.fields) {
                if (f.type === 'TableValue') arr.push(val(f.value));
                else if (f.type === 'TableKey') obj[key(f.key)] = val(f.value);
                else obj[f.key.name] = val(f.value);
            }
            if (Object.keys(obj).length === 0) return arr;
            if (arr.length) obj.__list = arr;
            return obj;
        }
        default:
            return { expr: n.type };
    }
}

const sections = {};
for (const st of ast.body) {
    if (st.type !== 'AssignmentStatement') continue;
    const t = st.variables[0];
    if (t.type !== 'MemberExpression' || t.base.name !== 'RP') continue;
    const name = t.identifier.name;
    const init = st.init[0];
    if (init.type !== 'TableConstructorExpression') continue;
    const entries = [];
    for (const f of init.fields) {
        if (f.type === 'TableValue') continue;
        const k = f.type === 'TableKey' ? key(f.key) : f.key.name;
        const line = f.loc.start.line;
        entries.push({ key: k, line, comment: commentsByLine.get(line) || null, data: val(f.value) });
    }
    sections[name] = entries;
}

fs.writeFileSync(output, JSON.stringify(sections, null, 1));
for (const [k, v] of Object.entries(sections)) console.log(k, v.length);
