import { describe, expect, it } from 'vitest'
import {
  formResolver,
  registerFormSchema,
  newPasswordFormSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from './schemas'

describe('signInSchema', () => {
  it('normalises the email', () => {
    const parsed = signInSchema.parse({ email: '  Owner@Example.COM ', password: 'x' })
    expect(parsed.email).toBe('owner@example.com')
  })

  it('rejects malformed and non-string input from direct action calls', () => {
    expect(signInSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: ['a@b.co'], password: 'x' }).success).toBe(false)
    expect(signInSchema.safeParse(null).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(1000) }).success).toBe(false)
  })
})

describe('signUpSchema', () => {
  const valid = { fullName: 'Ana Pop', email: 'ana@example.com', password: 'Str0ngPass' }

  it('accepts a complete sign-up', () => {
    expect(signUpSchema.parse(valid)).toEqual(valid)
  })

  it('enforces the password rules on the server too', () => {
    for (const password of ['Short1', 'alllowercase1', 'NoDigitsHere', `A1${'x'.repeat(80)}`]) {
      expect(signUpSchema.safeParse({ ...valid, password }).success, password).toBe(false)
    }
  })

  it('requires a real name', () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: ' a ' }).success).toBe(false)
    expect(signUpSchema.parse({ ...valid, fullName: '  Ana Pop  ' }).fullName).toBe('Ana Pop')
  })
})

describe('passwordResetRequestSchema', () => {
  it('needs a valid email', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
    expect(passwordResetRequestSchema.safeParse({ email: 'nope' }).success).toBe(false)
  })
})

describe('newPasswordFormSchema', () => {
  it('requires matching, strong passwords', () => {
    expect(newPasswordFormSchema.safeParse({ password: 'Str0ngPass', confirmPassword: 'Str0ngPass' }).success).toBe(true)
    const mismatch = newPasswordFormSchema.safeParse({ password: 'Str0ngPass', confirmPassword: 'Str0ngPasz' })
    expect(mismatch.success).toBe(false)
    expect(mismatch.error?.issues[0]?.path).toEqual(['confirmPassword'])
    expect(newPasswordFormSchema.safeParse({ password: 'weak', confirmPassword: 'weak' }).success).toBe(false)
  })
})

describe('registerFormSchema', () => {
  const valid = { fullName: 'Ana Pop', email: 'Ana@Example.com', password: 'Str0ngPass', confirmPassword: 'Str0ngPass', terms: true }

  it('adds the confirmation and the terms to the sign-up rules', () => {
    expect(registerFormSchema.parse(valid)).toEqual({ ...valid, email: 'ana@example.com' })
    const errors = registerFormSchema.safeParse({ ...valid, fullName: 'a', confirmPassword: 'Other1Pass', terms: false })
    expect(errors.success).toBe(false)
    expect(errors.error?.issues.map((i) => i.path[0])).toEqual(['fullName', 'terms', 'confirmPassword'])
  })
})

describe('formResolver', () => {
  it('gives react-hook-form the parsed values or the first message per field', async () => {
    const ok = await formResolver(signInSchema)({ email: ' Owner@Example.COM ', password: 'x' }, undefined, { fields: {}, shouldUseNativeValidation: false })
    expect(ok).toEqual({ values: { email: 'owner@example.com', password: 'x' }, errors: {} })
    const bad = await formResolver(signUpSchema)({ fullName: 'A', email: 'nope', password: 'weak' }, undefined, { fields: {}, shouldUseNativeValidation: false })
    expect(bad.values).toEqual({})
    expect(bad.errors).toEqual({
      fullName: { type: 'validation', message: 'Name must be at least 2 characters' },
      email: { type: 'validation', message: 'Please enter a valid email' },
      password: { type: 'validation', message: 'Must be at least 8 characters' },
    })
  })
})
