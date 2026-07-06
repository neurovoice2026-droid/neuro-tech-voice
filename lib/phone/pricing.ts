// Recurring monthly phone number fee, charged through a dedicated Stripe
// subscription per number (decided 2026-07-06, reversing an earlier
// one-time-fee design). Pure pass-through of Twilio's own ~$1.15/mo cost, no
// markup - margin comes from the plan subscriptions and usage, not the
// number itself.
export const PHONE_NUMBER_MONTHLY_PRICE_USD = 1.15
