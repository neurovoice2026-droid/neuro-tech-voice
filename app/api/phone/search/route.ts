import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isTwilioConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { getTwilioClient, isTwilioNotFound, numberCapabilities, twilioErrorInfo } from '@/lib/twilio/client'
import { isPhoneCountry } from '@/lib/twilio/countries'
import type { AvailableNumber, PhoneSearchResponse } from '@/lib/twilio/types'

// Numbers available to buy right now. Only numbers Twilio can provision
// instantly (address_requirements "none") are offered, and numbers that can
// also text are listed first so booking confirmations and reminders work.
// There are no sample numbers: without Twilio this answers 503.

export const runtime = 'nodejs'

const QuerySchema = z.object({
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(isPhoneCountry, 'Numbers from this country aren’t offered yet'),
  sms: z.enum(['0', '1']).default('1'),
})

const MAX_RESULTS = 8

type TwilioLocalNumber = {
  phoneNumber: string
  friendlyName: string
  locality: string | null
  region: string | null
  addressRequirements: string
  capabilities: { voice?: boolean; sms?: boolean; mms?: boolean; SMS?: boolean; MMS?: boolean } | null
}

function toAvailable(n: TwilioLocalNumber): AvailableNumber {
  const caps = numberCapabilities(n.capabilities)
  return {
    number: n.phoneNumber,
    friendly_name: n.friendlyName,
    locality: n.locality ?? '',
    region: n.region ?? '',
    // Every result was searched with voiceEnabled, so only an explicit false counts.
    capabilities: { voice: n.capabilities?.voice !== false, sms: caps.sms, mms: caps.mms },
  }
}

export const GET = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  const query = parseSearchParams(req.nextUrl, QuerySchema)
  await enforceRateLimit(RATE_LIMITS.phoneSearch, ctx.user.id)
  if (!isTwilioConfigured()) {
    throw new ApiError(503, 'not_configured', 'Buying numbers isn’t available right now. Please try again later or contact support.')
  }

  const preferSms = query.sms === '1'
  const local = getTwilioClient().availablePhoneNumbers(query.country).local
  const byNumber = new Map<string, AvailableNumber>()
  const add = (list: TwilioLocalNumber[]) => {
    for (const n of list) {
      if (n.addressRequirements !== 'none' || byNumber.has(n.phoneNumber)) continue
      byNumber.set(n.phoneNumber, toAvailable(n))
    }
  }

  try {
    if (preferSms) {
      add((await local.list({ voiceEnabled: true, smsEnabled: true, limit: 20 })) as unknown as TwilioLocalNumber[])
    }
    if (byNumber.size < MAX_RESULTS) {
      add((await local.list({ voiceEnabled: true, limit: 20 })) as unknown as TwilioLocalNumber[])
    }
  } catch (error) {
    // Twilio answers 404 for countries without local inventory.
    if (!isTwilioNotFound(error)) {
      const info = twilioErrorInfo(error)
      console.error('[telephony] number search failed', query.country, info.status, info.code, info.message)
      throw new ApiError(502, 'search_failed', 'We couldn’t load available numbers. Please try again in a moment.')
    }
  }

  const numbers = [...byNumber.values()]
    .sort((a, b) => (preferSms ? Number(b.capabilities.sms) - Number(a.capabilities.sms) : 0))
    .slice(0, MAX_RESULTS)
  const body: PhoneSearchResponse = { numbers, sms_available: numbers.some((n) => n.capabilities.sms) }
  return noStore(Response.json(body))
})
