import { NextResponse } from 'next/server'
import { getTwilioClient } from '@/lib/twilio/client'

interface PhoneResult {
  number: string
  friendly_name: string
  locality: string
  region: string
  price: string
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
    price: '$1.15/mo',
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
      .local.list({ voiceEnabled: true, limit: 5 })

    const results: PhoneResult[] = available.map((n) => ({
      number:        n.phoneNumber,
      friendly_name: n.friendlyName,
      locality:      n.locality ?? '',
      region:        n.region ?? '',
      price:         '$1.15/mo',
    }))

    return NextResponse.json(results)
  } catch {
    // Dev fallback
    return NextResponse.json(getMockNumbers(country))
  }
}
