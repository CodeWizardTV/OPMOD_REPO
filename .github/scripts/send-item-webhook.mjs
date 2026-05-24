// .github/scripts/send-item-webhook.mjs
import { readFileSync } from 'fs';

const GITHUB_BASE = 'https://github.com/geldbedarf/OPMOD_REPO/blob/main/items';

const CHANGE_COLORS = {
    A: 0x57F287, // Erstellt  → Grün
    M: 0xFEE75C, // Geändert  → Gelb
    D: 0xED4245, // Gelöscht  → Rot
};

const CHANGE_LABELS = {
    A: 'Hinzugefügt',
    M: 'Geändert',
    D: 'Gelöscht',
};

function stripMcColors(str) {
    return str.replace(/[§&][0-9a-fk-orA-FK-OR]/g, '').trim();
}

function getRarityLabel(lore) {
    for (const line of lore) {
        const clean = stripMcColors(line);
        if (clean.includes('Seltenheit')) {
            return clean.split('»').pop().trim();
        }
    }
    return null;
}

function formatShard(price) {
    return price.toLocaleString('de-DE') + ' Shards';
}

// ── main ──────────────────────────────────────────────────────────────────────

const [filePath, changeType = 'A'] = process.argv.slice(2);
if (!filePath) {
    console.error('Usage: node send-item-webhook.mjs <path/to/item.json> [A|M|D]');
    process.exit(1);
}

const webhookUrl = process.env.DISCORD_WEBHOOK;
if (!webhookUrl) {
    console.error('DISCORD_WEBHOOK env var not set');
    process.exit(1);
}

const item = JSON.parse(readFileSync(filePath, 'utf8'));

const color   = CHANGE_COLORS[changeType] ?? CHANGE_COLORS.A;
const label   = CHANGE_LABELS[changeType] ?? CHANGE_LABELS.A;
const rarity  = getRarityLabel(item.lore);
const fileUrl = `${GITHUB_BASE}/${item.internalname}.json`;

// Lore: strip color codes, drop leading/trailing empty lines
const loreLines = item.lore
    .map(stripMcColors)
    .filter((l, i, arr) => {
        if (i === 0 && l === '') return false;
        if (i === arr.length - 1 && l === '') return false;
        return true;
    });

const description = loreLines.length > 0
    ? '```\n' + loreLines.join('\n') + '\n```'
    : null;

// Fields
const fields = [];

fields.push({ name: 'Material', value: `\`${item.material}\``, inline: true });

if (item.shard_price) {
    fields.push({ name: 'Shard Preis', value: formatShard(item.shard_price), inline: true });
}

if (rarity) {
    fields.push({ name: 'Seltenheit', value: rarity, inline: true });
}

if (item.alternative_raritys?.length) {
    const cleaned = item.alternative_raritys.map(r => `• ${stripMcColors(r)}`).join('\n');
    fields.push({ name: 'Alternative Seltenheiten', value: cleaned, inline: false });
}

// Embed
const embed = {
    title:       item.displayname,
    url:         fileUrl,
    description: description,
    color:       color,
    fields:      fields,
    footer:      { text: `${label}  •  ${item.internalname}` },
    timestamp:   item.capturedAt ?? new Date().toISOString(),
};

const payload = {
    username: 'Item Datenbank',
    embeds:   [embed],
};

const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
});

if (!res.ok) {
    const body = await res.text();
    console.error(`Webhook failed [${res.status}]: ${body}`);
    process.exit(1);
}

console.log(`Webhook sent [${label}]: ${item.displayname}`);
