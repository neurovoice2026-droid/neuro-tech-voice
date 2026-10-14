import 'server-only'
// The adapter registry: one implementation per platform (./<platform>.ts).

import type { CommercePlatform } from '../types'
import type { CommerceAdapter } from './types'
import { wooCommerceAdapter } from './woocommerce'
import { shopifyAdapter } from './shopify'
import { magentoAdapter } from './magento'
import { prestaShopAdapter } from './prestashop'
import { customAdapter } from './custom'

const ADAPTERS: Record<CommercePlatform, CommerceAdapter> = {
  woocommerce: wooCommerceAdapter,
  shopify: shopifyAdapter,
  magento: magentoAdapter,
  prestashop: prestaShopAdapter,
  custom: customAdapter,
}

export function adapterFor(platform: CommercePlatform): CommerceAdapter {
  return ADAPTERS[platform]
}

export function isCommercePlatform(value: string): value is CommercePlatform {
  return Object.hasOwn(ADAPTERS, value)
}
