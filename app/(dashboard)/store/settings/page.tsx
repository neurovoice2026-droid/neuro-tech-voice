import { StoreSettingsPage } from '@/components/commerce/StoreSettingsPage'
import { COMPANY } from '@/lib/site'

// The support contact is read on the server (lib/site.ts is marketing copy;
// the client bundle only receives the two strings it shows).
export default function StoreSettingsRoutePage() {
  return (
    <StoreSettingsPage
      support={{
        email: COMPANY.email || null,
        phone: COMPANY.phone || null,
        phoneHref: COMPANY.phoneHref || null,
      }}
    />
  )
}
