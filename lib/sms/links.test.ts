import { describe, expect, it } from 'vitest'
import { linksOutsideWebsite } from './links'

describe('linksOutsideWebsite (SEC-12)', () => {
  it('allows the business’s own website and its subdomains', () => {
    expect(linksOutsideWebsite('Book online at https://www.zenithdental.ro/booking.', 'https://zenithdental.ro')).toEqual([])
    expect(linksOutsideWebsite('See shop.zenithdental.ro for prices', 'zenithdental.ro')).toEqual([])
  })

  it('flags links anywhere else, with or without a scheme', () => {
    expect(linksOutsideWebsite('Pay here: https://bit.ly/abc123', 'https://zenithdental.ro')).toEqual(['https://bit.ly/abc123'])
    expect(linksOutsideWebsite('Log in at www.zenith-dental-login.com now', 'https://zenithdental.ro')).toEqual(['www.zenith-dental-login.com'])
    expect(linksOutsideWebsite('Visit secure-pay.xyz/verify', 'zenithdental.ro')).toEqual(['secure-pay.xyz/verify'])
    expect(linksOutsideWebsite('zenithdental.ro.evil.com/login', 'zenithdental.ro')).toEqual(['zenithdental.ro.evil.com/login'])
  })

  it('treats any link as foreign when the business has no website', () => {
    expect(linksOutsideWebsite('https://zenithdental.ro', null)).toEqual(['https://zenithdental.ro'])
  })

  it('leaves ordinary text alone', () => {
    expect(linksOutsideWebsite('Your appointment is on 18.09 at 10:30 with Dr. Popescu, e.g. bring your ID. Cost 3.50 lei.', 'zenithdental.ro')).toEqual([])
  })
})
