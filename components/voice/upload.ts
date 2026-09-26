'use client'

import { VoiceApiError, postJson } from './api'

// Uploads that bypass Vercel's 4.5 MB request limit: the API hands out a
// signed upload URL for a private storage path, the browser sends the file
// straight to Supabase Storage (with progress), then the API is called with
// the path. Same wire format as supabase-js uploadToSignedUrl.

export interface SignedUploadTicket {
  bucket: string
  path: string
  token: string
  signed_url: string
  content_type: string
  max_bytes: number
}

export function requestUploadTicket(endpoint: string, file: File | Blob, name: string): Promise<SignedUploadTicket> {
  return postJson<SignedUploadTicket>(endpoint, { name, size: file.size, type: file.type })
}

export function uploadToSignedUrl(input: {
  ticket: SignedUploadTicket
  file: Blob
  fileName: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', input.ticket.signed_url)
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (anonKey) xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && input.onProgress) input.onProgress(Math.min(1, event.loaded / event.total))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.(1)
        resolve()
        return
      }
      const tooLarge = xhr.status === 413 || /too large|maximum allowed size/i.test(xhr.responseText)
      reject(
        new VoiceApiError(
          xhr.status,
          tooLarge ? 'file_too_large' : 'upload_failed',
          tooLarge ? 'This file is too large to upload.' : 'The upload didn’t finish. Please try again.'
        )
      )
    }
    xhr.onerror = () => reject(new VoiceApiError(0, 'network_error', 'The upload was interrupted. Check your connection and try again.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

    if (input.signal) {
      if (input.signal.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'))
        return
      }
      input.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    // Storage checks the part's type against the bucket's allowed audio types.
    const typed = new File([input.file], input.fileName, { type: input.ticket.content_type })
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', typed)
    xhr.send(form)
  })
}

/** Duration of an audio file from its metadata, or null when the browser can't tell. */
export function measureAudioDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new Audio()
    let settled = false
    const done = (value: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      resolve(value)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      // WebM from MediaRecorder reports Infinity until fully scanned.
      done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null)
    }
    el.onerror = () => done(null)
    setTimeout(() => done(null), 5000)
    el.src = url
  })
}
