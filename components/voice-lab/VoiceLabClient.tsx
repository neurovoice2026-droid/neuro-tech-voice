'use client'

import { useState } from 'react'
import { AlertCircle, AudioLines, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SpeechToTextPanel } from './SpeechToTextPanel'
import { TextToSpeechPanel } from './TextToSpeechPanel'
import { useVoiceLabUsage } from './use-voice-lab-usage'

interface VoiceLabClientProps {
  /** The agent's language, used as the starting language in both tools. */
  defaultLanguage: string
}

export function VoiceLabClient({ defaultLanguage }: VoiceLabClientProps) {
  const [tab, setTab] = useState<'tts' | 'stt'>('tts')
  const { usage, error, retry, applyHeaders } = useVoiceLabUsage()

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Voice Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create audio in any of your agent’s voices, or turn recordings into text. Usage counts toward your plan’s monthly
          allowance.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center">
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-destructive">{error.message}</p>
          {error.code !== 'not_configured' && (
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshCw aria-hidden="true" /> Try again
            </Button>
          )}
        </div>
      )}

      {usage && !usage.configured && (
        <div role="status" className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>The Voice Lab isn’t available yet because the voice service isn’t set up on this server. Your phone agent isn’t affected.</p>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'tts' | 'stt')}>
        <TabsList className="w-full group-data-horizontal/tabs:h-10 sm:w-fit sm:group-data-horizontal/tabs:h-8">
          <TabsTrigger value="tts" className="px-3">
            <AudioLines aria-hidden="true" /> Text to speech
          </TabsTrigger>
          <TabsTrigger value="stt" className="px-3">
            <FileText aria-hidden="true" /> Speech to text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tts" className="pt-4" keepMounted>
          <TextToSpeechPanel defaultLanguage={defaultLanguage} usage={usage} usageUnavailable={Boolean(error) && !usage} onQuotaHeaders={(headers) => applyHeaders('tts', headers)} />
        </TabsContent>
        <TabsContent value="stt" className="pt-4" keepMounted>
          <SpeechToTextPanel defaultLanguage={defaultLanguage} usage={usage} usageUnavailable={Boolean(error) && !usage} onQuotaHeaders={(headers) => applyHeaders('stt', headers)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
