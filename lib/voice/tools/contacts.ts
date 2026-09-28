// Finding the team member a caller or the model means ("Maria", "the
// manager", "someone from billing"). Speech recognition misspells names and
// callers add words, so matching is by normalised tokens with a small
// spelling tolerance. Pure.

import type { EscalationContact } from '@/types'
import { isE164 } from '@/lib/phone/e164'
import { editDistance, matchTokens, normalizeForMatch, similarity } from '@/lib/scheduling/text'

export type MatchableContact = Pick<EscalationContact, 'id' | 'name' | 'role' | 'sort_order'> &
  Partial<Pick<EscalationContact, 'phone' | 'transfer_enabled' | 'is_on_call'>>

/** Words that say nothing about who is meant, in the agent languages that use Latin script. */
const FILLER = new Set([
  'the', 'a', 'an', 'to', 'with', 'for', 'from', 'of', 'please', 'someone', 'somebody', 'person', 'my', 'our', 'your',
  'mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'sir', 'madam',
  'domnul', 'doamna', 'domnului', 'doamnei', 'dl', 'dna', 'cu', 'la', 'de', 'pe', 'va', 'rog',
  'el', 'los', 'las', 'senor', 'senora', 'con', 'del', 'por', 'favor',
  'le', 'les', 'monsieur', 'madame', 'avec', 'du', 'des',
  'der', 'die', 'das', 'herr', 'frau', 'mit', 'bitte',
  'il', 'lo', 'gli', 'signor', 'signore', 'signora', 'di', 'per',
  'o', 'os', 'senhor', 'senhora', 'com', 'do', 'da',
  'pan', 'pani', 'z', 'ze', 'prosze',
  'de', 'het', 'meneer', 'mevrouw', 'met', 'van',
])

function meaningfulTokens(value: string | null | undefined): string[] {
  return matchTokens(value).filter((token) => !FILLER.has(token))
}

/** 0–100: how well a contact matches what was asked for. */
export function contactMatchScore(contact: MatchableContact, query: string | null | undefined): number {
  const q = normalizeForMatch(query)
  if (!q) return 0
  const name = normalizeForMatch(contact.name)
  const role = normalizeForMatch(contact.role)
  if (name && q === name) return 100
  if (role && q === role) return 95

  const queryTokens = meaningfulTokens(query)
  if (queryTokens.length === 0) return 0
  const nameTokens = meaningfulTokens(contact.name)
  const roleTokens = meaningfulTokens(contact.role)
  const querySet = new Set(queryTokens)

  if (name && queryTokens.join(' ') === nameTokens.join(' ')) return 100
  if (role && roleTokens.length > 0 && queryTokens.join(' ') === roleTokens.join(' ')) return 95
  // "Maria Popescu from sales" contains the whole name.
  if (nameTokens.length > 1 && nameTokens.every((t) => querySet.has(t))) return 90
  // CJK and other scripts without spaces: substring match on the whole name.
  if (name.length >= 2 && !name.includes(' ') && q.includes(name)) return 88
  // "the manager" ⊂ "office manager", or the role written in full in the query.
  if (roleTokens.length > 0 && (roleTokens.every((t) => querySet.has(t)) || queryTokens.every((t) => roleTokens.includes(t)))) return 80
  // "Maria" for "Maria Popescu".
  if (nameTokens.some((t) => t.length >= 2 && querySet.has(t))) return 75
  // Inflected roles: Romanian "managerul", Italian "responsabile" for "responsabil".
  const inflectedRole = roleTokens.some((r) => r.length >= 5 && queryTokens.some((t) => t.length >= 5 && (t.startsWith(r) || r.startsWith(t))))
  if (inflectedRole) return 70
  // Misheard spelling: "Mariya" for "Maria", "Popesco" for "Popescu".
  const closeName = nameTokens.some((n) => n.length >= 4 && queryTokens.some((t) => t.length >= 4 && editDistance(n, t, 2) <= Math.max(1, Math.floor(n.length / 4))))
  if (closeName) return 60
  const closeRole = roleTokens.some((r) => r.length >= 5 && queryTokens.some((t) => t.length >= 5 && similarity(r, t) >= 0.8))
  if (closeRole) return 55
  return 0
}

export const CONTACT_MATCH_THRESHOLD = 55

/** Best match above the threshold; ties go to the contact listed first. */
export function findContact<T extends MatchableContact>(contacts: readonly T[], query: string | null | undefined): T | null {
  let best: { contact: T; score: number } | null = null
  for (const contact of contacts) {
    const score = contactMatchScore(contact, query)
    if (score < CONTACT_MATCH_THRESHOLD) continue
    if (!best || score > best.score || (score === best.score && (contact.sort_order ?? 0) < (best.contact.sort_order ?? 0))) {
      best = { contact, score }
    }
  }
  return best?.contact ?? null
}

export type TransferMatch<T> = { contact: T; matchedBy: 'requested' | 'on_call' | 'default' }

function bySortOrder<T extends MatchableContact>(contacts: readonly T[]): T[] {
  return [...contacts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

/**
 * Who a live call can go to. Only contacts with transfers allowed and a valid
 * number qualify. Named person or role first; otherwise whoever is on call;
 * with no name given and nobody on call, the first transferable contact.
 */
export function pickTransferContact<T extends MatchableContact>(contacts: readonly T[], query: string | null | undefined): TransferMatch<T> | null {
  const transferable = bySortOrder(contacts.filter((c) => c.transfer_enabled && typeof c.phone === 'string' && isE164(c.phone)))
  if (transferable.length === 0) return null

  if (normalizeForMatch(query)) {
    const requested = findContact(transferable, query)
    if (requested) return { contact: requested, matchedBy: 'requested' }
  }
  const onCall = transferable.find((c) => c.is_on_call)
  if (onCall) return { contact: onCall, matchedBy: 'on_call' }
  if (!normalizeForMatch(query)) return { contact: transferable[0], matchedBy: 'default' }
  return null
}
