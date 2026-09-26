import { describe, expect, it } from 'vitest'
import { TEST_CALL_NUMBERS_PER_DAY, nextTestCallNumbers } from './numbers'

describe('test call destinations per day', () => {
  it('lets a few numbers be tested again and again, but not a list of prospects', () => {
    let known: string[] = []
    for (const hash of ['a', 'b', 'c']) {
      const next = nextTestCallNumbers(known, hash)
      expect(next).not.toBeNull()
      known = next!
    }
    expect(known).toHaveLength(TEST_CALL_NUMBERS_PER_DAY)
    expect(nextTestCallNumbers(known, 'b')).toEqual(['a', 'b', 'c'])
    expect(nextTestCallNumbers(known, 'd')).toBeNull()
  })
})
