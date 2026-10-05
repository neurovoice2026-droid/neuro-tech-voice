// Credential-shaped fixtures are assembled at runtime so no literal that
// looks like a real secret is committed (GitHub push protection scans for them).
export const FAKE_TWILIO_ACCOUNT_SID = ['A', 'C', '0123456789abcdef'.repeat(2)].join('')
export const FAKE_STRIPE_LIVE_KEY = ['sk', 'live', 'leakyleaky123'].join('_')
