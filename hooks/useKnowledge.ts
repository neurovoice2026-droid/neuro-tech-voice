'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { KnowledgeDocument } from '@/types'

export interface UploadingFile {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

export function useKnowledge() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState<UploadingFile[]>([])

  const fetchDocs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/agent/knowledge')
      if (res.ok) {
        const data = await res.json() as KnowledgeDocument[]
        setDocs(data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const uploadFile = useCallback(async (file: File): Promise<void> => {
    const uploadId = crypto.randomUUID()
    const entry: UploadingFile = { id: uploadId, name: file.name, progress: 0, status: 'uploading' }
    setUploading(prev => [...prev, entry])

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90)
          setUploading(prev => prev.map(u => u.id === uploadId ? { ...u, progress: pct } : u))
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status === 201) {
          setUploading(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100, status: 'done' } : u))
          const doc = JSON.parse(xhr.responseText) as KnowledgeDocument
          setDocs(prev => [doc, ...prev])
          toast.success(`"${file.name}" uploaded successfully`)
          setTimeout(() => {
            setUploading(prev => prev.filter(u => u.id !== uploadId))
          }, 2000)
        } else {
          let message = 'Upload failed'
          try {
            const data = JSON.parse(xhr.responseText) as { error?: string }
            message = data.error ?? message
          } catch { /* ignore */ }
          setUploading(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', error: message } : u))
          toast.error(`Failed to upload "${file.name}": ${message}`)
        }
        resolve()
      })

      xhr.addEventListener('error', () => {
        setUploading(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', error: 'Network error' } : u))
        toast.error(`Upload failed for "${file.name}"`)
        resolve()
      })

      xhr.open('POST', '/api/agent/knowledge')
      xhr.send(formData)
    })
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    await Promise.all(files.map(uploadFile))
  }, [uploadFile])

  const addUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/agent/knowledge/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Failed to add URL')
        return false
      }

      const doc = await res.json() as KnowledgeDocument
      setDocs(prev => [doc, ...prev])
      toast.success('URL added to knowledge base')
      return true
    } catch {
      toast.error('Network error')
      return false
    }
  }, [])

  const deleteDoc = useCallback(async (docId: string): Promise<boolean> => {
    const prev = docs
    setDocs(d => d.filter(doc => doc.id !== docId))

    try {
      const res = await fetch(`/api/agent/knowledge/${docId}`, { method: 'DELETE' })

      if (!res.ok) {
        setDocs(prev)
        toast.error('Failed to delete document')
        return false
      }

      toast.success('Document removed')
      return true
    } catch {
      setDocs(prev)
      toast.error('Network error')
      return false
    }
  }, [docs])

  const clearErrorUploads = useCallback(() => {
    setUploading(prev => prev.filter(u => u.status !== 'error'))
  }, [])

  return {
    docs,
    isLoading,
    uploading,
    uploadFile,
    uploadFiles,
    addUrl,
    deleteDoc,
    refetch: fetchDocs,
    clearErrorUploads,
  }
}
