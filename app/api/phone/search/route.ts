import { NextResponse } from 'next/server'
import { getTwilioClient } from '@/lib/twilio/client'

interface PhoneResult {
  number: string
  friendly_name: string
  locality: string
  region: string
}

// Mock numbers for dev / Twilio not configured
function getMockNumbers(country: string): PhoneResult[] {
  const prefixes: Record<string, string> = {
    US: '+1555', GB: '+44744', RO: '+40721', DE: '+4915', FR: '+33612', AU: '+61412',
  }
  const prefix = prefixes[country] ?? '+1555'
  return Array.from({ length: 5 }, (_, i) => ({
    number: `${prefix}${String(2000 + i * 37).padStart(7, '0')}`,
    friendly_name: `${country} Local`,
    locality: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i],
    region: ['NY', 'CA', 'IL', 'TX', 'AZ'][i],
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'US'

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token || sid === 'your-twilio-account-sid') {
    return NextResponse.json(getMockNumbers(country))
  }

  try {
    const twilio = getTwilioClient()
    const available = await twilio
      .availablePhoneNumbers(country)
      .local.list({ voiceEnabled: true, limit: 20 })

    // Only offer numbers Twilio can provision instantly. Anything requiring
    // a regulatory bundle (address_requirements !== 'none') is excluded so we
    // never promise a number the org can't actually complete the purchase of.
    const results: PhoneResult[] = available
      .filter((n) => n.addressRequirements === 'none')
      .slice(0, 5)
      .map((n) => ({
        number:        n.phoneNumber,
        friendly_name: n.friendlyName,
        locality:      n.locality ?? '',
        region:        n.region ?? '',
      }))

    return NextResponse.json(results)
  } catch {
    // Dev fallback
    return NextResponse.json(getMockNumbers(country))
  }
}
