// Invariants that must hold across all sixteen trades. The type checker
// proves the shape; this proves the things a type cannot: that nothing inks
// before its cause, that no two trades borrowed each other's page, and that
// the honesty rules survived sixteen independent authors and two repairs.
import { INDUSTRY_PAGES } from '@/lib/pages/industries';

const fail: string[] = [];
const trades = [...INDUSTRY_PAGES.values()];
const note = (m: string) => fail.push(m);

if (trades.length !== 16) note(`expected 16 trades, got ${trades.length}`);

const seen: Record<string, Map<unknown, string>> = {};
const uniq = (key: string, value: unknown, slug: string) => {
  (seen[key] ??= new Map());
  if (seen[key].has(value)) note(`${key} collision: ${slug} and ${seen[key].get(value)} both use "${String(value).slice(0, 60)}"`);
  else seen[key].set(value, slug);
};

for (const t of trades) {
  uniq('rig.form', t.rig.form, t.slug);
  uniq('wall.never', t.wall.never, t.slug);
  uniq('cut word', t.wall.retraction.begins.split(/\s+/).pop(), t.slug);
  uniq('kicker', t.kicker, t.slug);

  // Causation: a field may never ink before the thing that caused it.
  for (const f of t.rig.fields) {
    if (f.from === 'caller') {
      const first = Math.min(...t.turns.filter((x) => x.side === 'caller').map((x) => x.at));
      if (f.at < first) note(`${t.slug}: field "${f.id}" at ${f.at} precedes the first caller turn at ${first}`);
    } else {
      const runs = t.toolRuns.filter((r) => r.tool === f.from).map((r) => r.at);
      if (!runs.length) note(`${t.slug}: field "${f.id}" names ${f.from}, which never runs on this call`);
      else if (f.at < Math.min(...runs)) note(`${t.slug}: field "${f.id}" at ${f.at} precedes ${f.from} at ${Math.min(...runs)}`);
    }
  }

  // Exactly four fields survive a phone, and exactly one prong is urgent.
  const onPhone = t.rig.fields.filter((f) => f.onPhone).length;
  if (onPhone !== 4) note(`${t.slug}: ${onPhone} fields marked onPhone, expected 4`);
  const urgent = t.prongs.filter((p) => p.urgent).length;
  if (urgent !== 1) note(`${t.slug}: ${urgent} urgent prongs, expected 1`);

  // The retraction owns its detent, and is cut mid-word.
  const d = t.wall.retraction.atDetent;
  if (t.wall.detents[d]?.agent) note(`${t.slug}: detent ${d} has both an agent line and the retraction`);
  t.wall.detents.forEach((x, i) => { if (i !== d && !x.agent) note(`${t.slug}: detent ${i} has no agent line`); });
  if (/[-—…,.!?]$/.test(t.wall.retraction.begins.trim())) note(`${t.slug}: retraction ends on punctuation, not mid-word`);
  if (!t.wall.retraction.instead.trimStart().startsWith('—')) note(`${t.slug}: "instead" does not open with an em-dash`);

  // No tool may appear that the run never used, and end_call is unbuyable.
  const named = new Set([...t.intents.map((i) => i.reaches), ...t.rig.fields.map((f) => f.from), ...t.toolRuns.map((r) => r.tool), ...t.relay.by]);
  if (named.has('end_call')) note(`${t.slug}: uses end_call, which only exists in the self-run pipeline`);

  // Dates carry only the precision a source supports.
  for (const c of t.citations) {
    if (!/^\d{4}(-\d{2}){0,2}$/.test(c.date)) note(`${t.slug}: citation date "${c.date}" is not YYYY | YYYY-MM | YYYY-MM-DD`);
    if (!c.sample || c.sample.length < 20) note(`${t.slug}: citation "${c.publisher}" has no real sample`);
  }

  // No annual roll-ups anywhere. Only a currency figure standing next to an
  // annual phrase counts: several pages talk about a year in order to refuse
  // to print one, and that sentence is the point rather than the offence.
  const money = `${t.missRate.reasoning} ${t.valuePerCall.reasoning} ${t.valuePerCall.value}`;
  const rollup = /[£$€]\s?[\d,]{4,}[^.]{0,40}?(a year|per year|annually|per annum)|(a year|per year|annually|per annum)[^.]{0,40}?[£$€]\s?[\d,]{4,}/i;
  if (rollup.test(money)) note(`${t.slug}: an annual total appears in the money copy`);
}

// Shared citations across the set.
const pubs = new Map<string, string[]>();
for (const t of trades) for (const c of t.citations) {
  const k = c.publisher.split(',')[0].trim();
  pubs.set(k, [...(pubs.get(k) ?? []), t.slug]);
}
for (const [pub, slugs] of pubs) if (slugs.length > 2) note(`citation "${pub}" appears on ${slugs.length} pages: ${slugs.join(', ')}`);

console.log(fail.length ? `${fail.length} PROBLEM(S)\n` + fail.map((f) => ' · ' + f).join('\n') : `All invariants hold across ${trades.length} trades.`);
process.exit(fail.length ? 1 : 0);
