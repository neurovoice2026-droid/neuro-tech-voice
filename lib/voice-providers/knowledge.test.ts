import { describe, expect, it } from 'vitest'

import {
  checkPublicUrl, resolveFileType, safeFileName, cleanDisplayName, cleanFileDisplayName, validateContent, toPlainText,
  isOrgStoragePath, toDocumentView, parseDocId, type KnowledgeDocumentRow,
} from '@/lib/voice-providers/knowledge'

const enc = (s: string) => new TextEncoder().encode(s)

describe('checkPublicUrl', () => {
  const blocked = [
    'http://localhost/', 'http://foo.localhost/', 'http://printer.local/x', 'https://db.internal/', 'http://intranet/',
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.255.255/',
    'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'http://100.64.0.1/', 'http://0.0.0.0/',
    'http://[::1]/', 'http://[::]/', 'http://[fe80::1]/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:10.0.0.1]/',
    'http://[64:ff9b::a9fe:a9fe]/', 'http://[2002:7f00:1::]/', 'ftp://example.com/', 'javascript:alert(1)', 'file:///etc/passwd',
    'https://user:pass@example.com/', 'not a url', '', 'http://224.0.0.1/', 'http://255.255.255.255/', 'http://example.local./',
  ]
  for (const u of blocked) it(`blocks ${u}`, () => expect(checkPublicUrl(u).ok).toBe(false))
  const allowed = ['https://example.com/faq', 'http://example.co.uk/a?b=1#frag', 'https://8.8.8.8/', 'https://[2606:4700::1111]/', 'https://172.32.0.1/']
  for (const u of allowed) it(`allows ${u}`, () => expect(checkPublicUrl(u).ok).toBe(true))
  it('strips the fragment', () => {
    const r = checkPublicUrl('https://example.com/a#x')
    expect(r.ok && r.url.href).toBe('https://example.com/a')
  })
})

describe('resolveFileType', () => {
  it('maps extensions', () => {
    expect(resolveFileType('a.PDF', 'application/pdf')?.kind).toBe('pdf')
    expect(resolveFileType('notes.markdown', '')?.kind).toBe('md')
    expect(resolveFileType('page.htm', 'text/html')?.ext).toBe('html')
    expect(resolveFileType('book.epub', 'application/epub+zip')?.kind).toBe('epub')
    expect(resolveFileType('x.md', 'application/octet-stream')?.kind).toBe('md')
  })
  it('rejects unknown or contradictory types', () => {
    expect(resolveFileType('a.exe', '')).toBeNull()
    expect(resolveFileType('a.pdf', 'image/png')).toBeNull()
    expect(resolveFileType('.pdf', 'application/pdf')).toBeNull()
    expect(resolveFileType('noext', 'text/plain')).toBeNull()
  })
})

describe('names', () => {
  it('safeFileName is ascii and keeps the extension', () => {
    expect(safeFileName('../../etc/Prix été 2026!!.pdf', 'pdf')).toBe('Prix-ete-2026.pdf')
    expect(safeFileName('???.txt', 'txt')).toBe('document.txt')
    expect(safeFileName('a'.repeat(300) + '.md', 'md').length).toBeLessThanOrEqual(83)
  })
  it('cleanDisplayName strips control chars and paths', () => {
    expect(cleanFileDisplayName('C:\\Users\\me\\My\u0000 File\n.pdf')).toBe('My File .pdf'); expect(cleanDisplayName('example.com/a/b')).toBe('example.com/a/b')
  })
})

describe('validateContent', () => {
  it('pdf magic', () => {
    expect(validateContent('pdf', enc('%PDF-1.7\n...'))).toBeNull()
    expect(validateContent('pdf', enc('hello'))).not.toBeNull()
  })
  it('zip magic for docx/epub', () => {
    expect(validateContent('docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toBeNull()
    expect(validateContent('epub', enc('%PDF-'))).not.toBeNull()
  })
  it('utf-8 text without NUL', () => {
    expect(validateContent('txt', enc('Bonjour à tous'))).toBeNull()
    expect(validateContent('md', new Uint8Array([0x61, 0x00, 0x62]))).not.toBeNull()
    expect(validateContent('html', new Uint8Array([0xc3, 0x28]))).not.toBeNull()
    expect(validateContent('text', enc('   \n '))).toBe('The file is empty.')
    expect(validateContent('txt', new Uint8Array())).toBe('The file is empty.')
  })
})

describe('toPlainText', () => {
  it('strips tags, scripts and entities', () => {
    const t = toPlainText('<html><head><style>p{}</style><script>alert(1)</script></head><body><h1>Hours</h1><p>Mon&nbsp;&ndash; Fri &amp; Sat &#8211; 9&#x2013;5</p><!-- c --></body></html>')
    expect(t).toBe('Hours\nMon – Fri & Sat – 9–5')
  })
})

describe('misc', () => {
  it('isOrgStoragePath', () => {
    expect(isOrgStoragePath('org1', 'org1/a/b.pdf')).toBe(true)
    expect(isOrgStoragePath('org1', 'org2/a/b.pdf')).toBe(false)
    expect(isOrgStoragePath('org1', 'org1/../org2/b.pdf')).toBe(false)
    expect(isOrgStoragePath('org1', 'org1//b.pdf')).toBe(false)
  })
  it('parseDocId', () => {
    expect(parseDocId('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(() => parseDocId("x' or 1=1")).toThrow()
  })
  it('can_retry', () => {
    const base = { status: 'processing', attached_at: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() } as unknown as KnowledgeDocumentRow
    expect(toDocumentView(base).can_retry).toBe(false)
    expect(toDocumentView({ ...base, updated_at: new Date(Date.now() - 10 * 60_000).toISOString() }).can_retry).toBe(true)
    expect(toDocumentView({ ...base, status: 'failed' }).can_retry).toBe(true)
    expect(toDocumentView({ ...base, status: 'ready' }).can_retry).toBe(true)
    expect(toDocumentView({ ...base, status: 'ready', attached_at: base.updated_at }).can_retry).toBe(false)
  })
})
