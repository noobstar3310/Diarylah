import { describe, expect, it } from 'vitest'
import { scopeQuery } from './tenancy'

const ME = '11111111-1111-4111-8111-111111111111'
const SOMEONE_ELSE = '22222222-2222-4222-8222-222222222222'

const scope = (model: string, operation: string, args?: unknown) =>
  scopeQuery({ model, operation, args, userId: ME })

describe('reads are confined to the caller', () => {
  it('constrains findMany even with no args at all', () => {
    expect(scope('Trade', 'findMany')).toEqual({
      where: { AND: [{}, { userId: ME }] },
    })
  })

  it('constrains findUnique, so an id alone is not enough', () => {
    expect(scope('Trade', 'findUnique', { where: { id: 'abc' } })).toEqual({
      where: { AND: [{ id: 'abc' }, { userId: ME }] },
    })
  })

  it.each([
    'findFirst',
    'findFirstOrThrow',
    'findUniqueOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'delete',
    'deleteMany',
    'updateMany',
  ])('constrains %s', (operation) => {
    const result = scope('Trade', operation, { where: { id: 'abc' } }) as {
      where: unknown
    }
    expect(result.where).toEqual({ AND: [{ id: 'abc' }, { userId: ME }] })
  })

  it("cannot be overridden by a caller-supplied userId in where", () => {
    // AND-wrapping means the forged filter and the real one must both hold, so
    // the query matches nothing rather than someone else's rows.
    const result = scope('Trade', 'findMany', {
      where: { userId: SOMEONE_ELSE },
    })
    expect(result).toEqual({
      where: { AND: [{ userId: SOMEONE_ELSE }, { userId: ME }] },
    })
  })

  it('preserves unrelated args such as select, orderBy and take', () => {
    const result = scope('Trade', 'findMany', {
      orderBy: { entryAt: 'desc' },
      take: 20,
      select: { id: true },
    })
    expect(result).toMatchObject({
      orderBy: { entryAt: 'desc' },
      take: 20,
      select: { id: true },
    })
  })
})

describe('the owner column is stamped onto creates', () => {
  it('adds userId to a create', () => {
    expect(scope('Journal', 'create', { data: { name: 'Prop firm' } })).toEqual({
      data: { name: 'Prop firm', userId: ME },
    })
  })

  it('overwrites a forged userId rather than honouring it', () => {
    const result = scope('Journal', 'create', {
      data: { name: 'Prop firm', userId: SOMEONE_ELSE },
    }) as { data: { userId: string } }
    expect(result.data.userId).toBe(ME)
  })

  it('stamps every row of a createMany', () => {
    const result = scope('Rule', 'createMany', {
      data: [{ label: 'Wait for confirmation' }, { label: 'Risk <= 1%', userId: SOMEONE_ELSE }],
    }) as { data: Array<{ userId: string }> }
    expect(result.data.map((r) => r.userId)).toEqual([ME, ME])
  })

  it('stamps the create branch of an upsert and constrains its where', () => {
    const result = scope('DailyReview', 'upsert', {
      where: { id: 'abc' },
      create: { notes: 'hi' },
      update: { notes: 'hi' },
    }) as { where: unknown; create: { userId: string } }
    expect(result.create.userId).toBe(ME)
    expect(result.where).toEqual({ AND: [{ id: 'abc' }, { userId: ME }] })
  })
})

describe('ownership cannot be reassigned', () => {
  // Without this, update({ where: { id }, data: { userId: other } }) passes the
  // scope filter — the caller does own the row — and then hands it away.
  it('refuses an update that changes userId', () => {
    expect(() =>
      scope('Trade', 'update', { where: { id: 'abc' }, data: { userId: SOMEONE_ELSE } })
    ).toThrow(/cannot reassign userId/)
  })

  it('refuses an updateMany that changes userId', () => {
    expect(() =>
      scope('Trade', 'updateMany', { where: {}, data: { userId: SOMEONE_ELSE } })
    ).toThrow(/cannot reassign userId/)
  })

  it('refuses the update branch of an upsert', () => {
    expect(() =>
      scope('Journal', 'upsert', {
        where: { id: 'abc' },
        create: {},
        update: { userId: SOMEONE_ELSE },
      })
    ).toThrow(/cannot reassign userId/)
  })

  it('refuses reassigning User.id', () => {
    expect(() =>
      scope('User', 'update', { where: { id: ME }, data: { id: SOMEONE_ELSE } })
    ).toThrow(/cannot reassign id/)
  })

  it('still allows a normal update', () => {
    expect(
      scope('Trade', 'update', { where: { id: 'abc' }, data: { notes: 'revenge trade' } })
    ).toEqual({
      where: { AND: [{ id: 'abc' }, { userId: ME }] },
      data: { notes: 'revenge trade' },
    })
  })
})

describe('models owned through a parent', () => {
  it.each(['TradeImage', 'TradeRuleCheck'])(
    'filters %s through its trade',
    (model) => {
      const result = scope(model, 'findMany', { where: { tradeId: 'abc' } }) as {
        where: unknown
      }
      expect(result.where).toEqual({
        AND: [{ tradeId: 'abc' }, { trade: { userId: ME } }],
      })
    }
  )

  it('filters InstrumentOverride through its journal', () => {
    const result = scope('InstrumentOverride', 'findMany') as { where: unknown }
    expect(result.where).toEqual({ AND: [{}, { journal: { userId: ME } }] })
  })

  it('refuses a direct create, since parent ownership is unproven', () => {
    expect(() =>
      scope('TradeImage', 'create', { data: { tradeId: 'abc', storagePath: 'x' } })
    ).toThrow(/through their parent/)
  })
})

describe('User is scoped on id, not userId', () => {
  it('constrains a read to the caller only', () => {
    expect(scope('User', 'findUnique', { where: { id: SOMEONE_ELSE } })).toEqual({
      where: { AND: [{ id: SOMEONE_ELSE }, { id: ME }] },
    })
  })
})

describe('shared reference data', () => {
  it.each(['Instrument', 'FxRate'])('lets reads of %s through untouched', (model) => {
    const args = { where: { symbol: 'EURUSD' } }
    expect(scope(model, 'findMany', args)).toBe(args)
  })

  it.each(['create', 'update', 'delete', 'deleteMany', 'upsert'])(
    'refuses %s on Instrument',
    (operation) => {
      expect(() => scope('Instrument', operation, { data: {} })).toThrow(
        /cannot be written through a user-scoped client/
      )
    }
  )
})

describe('fails closed', () => {
  it('throws for a model with no tenancy rule', () => {
    // Guards against someone adding a model to schema.prisma and forgetting to
    // classify it here — which would otherwise make it world-readable.
    expect(() => scope('SomeNewModel', 'findMany')).toThrow(/no tenancy rule/)
  })

  it('throws when called without a userId', () => {
    expect(() =>
      scopeQuery({ model: 'Trade', operation: 'findMany', args: {}, userId: '' })
    ).toThrow(/without a userId/)
  })
})
