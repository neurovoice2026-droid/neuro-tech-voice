// What the owner types to confirm account deletion: the organization name, or
// DELETE when the organization has none. Shared by the API and the dialog.

export function expectedDeletionConfirmation(orgName: string | null | undefined): string {
  return orgName?.trim() || 'DELETE'
}

export function isDeletionConfirmed(typed: string, orgName: string | null | undefined): boolean {
  return typed.trim() === expectedDeletionConfirmation(orgName)
}
