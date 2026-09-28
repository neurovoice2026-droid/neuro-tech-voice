import 'server-only'
import { appUrl } from '@/lib/env'
import { ResponseTooLargeError, UnsafeUrlError, safeFetch } from '@/lib/security/ssrf'
import { KnowledgeIngestError } from './errors'
import type { ExtractableKind } from './extract'
import { KNOWLEDGE_MAX_URL_BYTES, formatMegabytes } from './shared'

// Fetches a knowledge-base web page through safeFetch (https only, public
// addresses, every redirect re-validated, 10 s, 5 MB) and works out what kind
// of document came back.

const FETCH_TIMEOUT_MS = 10_000

export interface FetchedWebDocument {
  kind: Extract<ExtractableKind, 'html' | 'txt' | 'pdf'>
  bytes: Uint8Array
  charset: string | null
  finalUrl: string
}

function userAgent(): string {
  return `NeuroTechVoiceBot/1.0 (+${appUrl()}; knowledge base reader)`
}

function parseContentType(header: string | null): { mime: string; charset: string | null } {
  const [mime = '', ...params] = (header ?? '').split(';')
  const charset = params
    .map((p) => p.trim())
    .find((p) => p.toLowerCase().startsWith('charset='))
    ?.slice('charset='.length)
    .replace(/^["']|["']$/g, '')
  return { mime: mime.trim().toLowerCase(), charset: charset || null }
}

function kindFor(mime: string, bytes: Uint8Array): FetchedWebDocument['kind'] | null {
  if (mime === 'text/html' || mime === 'application/xhtml+xml') return 'html'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'text/x-markdown') return 'txt'
  // Some servers omit the type or send octet-stream: sniff.
  if (mime === '' || mime === 'application/octet-stream') {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).trimStart().toLowerCase()
    if (head.startsWith('%pdf-')) return 'pdf'
    if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html'
  }
  return null
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) {
    return `The website refused our request (error ${status}). The page may need a login or block automated visitors. Copy its text into a .txt file and upload it instead.`
  }
  if (status === 404 || status === 410) {
    return `The website says this page doesn’t exist (error ${status}). Check the address and try again.`
  }
  if (status === 429) return 'The website asked us to slow down (error 429). Please try again in a few minutes.'
  if (status >= 500) return `The website had a problem answering (error ${status}). Please try again later.`
  return `The website answered with an error (${status}). Check the address and try again.`
}

export async function fetchWebDocument(url: string): Promise<FetchedWebDocument> {
  let response: Awaited<ReturnType<typeof safeFetch>>
  try {
    response = await safeFetch(
      url,
      {
        method: 'GET',
        headers: {
          'User-Agent': userAgent(),
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,application/pdf;q=0.8,*/*;q=0.1',
          'Accept-Language': 'en;q=0.8, *;q=0.5',
        },
        cache: 'no-store',
      },
      { timeoutMs: FETCH_TIMEOUT_MS, maxBytes: KNOWLEDGE_MAX_URL_BYTES, maxRedirects: 5 }
    )
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new KnowledgeIngestError(
        'unsafe_url',
        error.message === 'Too many redirects'
          ? 'This address redirects too many times. Open it in your browser and add the address you end up on.'
          : 'We can only read public web pages that start with https://. Check the address and try again.',
        { cause: error }
      )
    }
    if (error instanceof ResponseTooLargeError) {
      throw new KnowledgeIngestError(
        'page_too_large',
        `This page is larger than ${formatMegabytes(KNOWLEDGE_MAX_URL_BYTES)}, which is more than we can read. Try a more specific page.`,
        { cause: error }
      )
    }
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new KnowledgeIngestError('page_timeout', 'The website took too long to respond. Please try again later.', {
        cause: error,
      })
    }
    throw new KnowledgeIngestError(
      'page_unreachable',
      'We couldn’t reach this website. Check the address, or try again in a few minutes.',
      { cause: error }
    )
  }

  if (response.status < 200 || response.status >= 300) {
    throw new KnowledgeIngestError('page_http_error', describeStatus(response.status))
  }

  const { mime, charset } = parseContentType(response.headers.get('content-type'))
  const kind = kindFor(mime, response.body)
  if (!kind) {
    throw new KnowledgeIngestError(
      'page_unsupported_type',
      'This address doesn’t lead to a web page or PDF we can read. Link to the page itself rather than an image, video or download.'
    )
  }
  return { kind, bytes: response.body, charset, finalUrl: response.finalUrl }
}
