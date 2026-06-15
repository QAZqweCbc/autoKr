import { describe, expect, it } from '@jest/globals'
import { exportAsCustomJSON, exportTokens } from '../token-export.service'
import { Account } from '../../models/account.model'

const baseAccount: Account = {
  id: 'account-1',
  email: 'jessica.fo@kasxi.site',
  password: '',
  nickname: '',
  idp: 'BuilderId',
  credentials: {
    accessToken: 'access-token',
    csrfToken: '',
    refreshToken: 'refresh-token',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    region: 'us-east-1',
    expiresAt: 1781158379235
  },
  subscription: {
    type: 'Free',
    title: 'KIRO FREE'
  },
  usage: {
    current: 6,
    limit: 50,
    percentUsed: 0,
    lastUpdated: 1781154833887,
    baseCurrent: 6,
    baseLimit: 50,
    freeTrialCurrent: 0,
    freeTrialLimit: 0,
    nextResetDate: '2026-07-01T00:00:00.000Z'
  },
  tags: [],
  status: 'active',
  lastUsedAt: 1781154764327,
  createdAt: 1781154764327,
  userId: 'd-9067642ac7.d4b8e498-c0e1-70e0-60b1-9436d2065cc3',
  lastCheckedAt: 1781154833887
}

describe('token export custom JSON', () => {
  it('exports selected fields using real nested account field paths', () => {
    const result = exportAsCustomJSON([baseAccount], {
      email: true,
      idp: true,
      'credentials.accessToken': true,
      'credentials.refreshToken': true,
      'credentials.clientId': true,
      'credentials.clientSecret': true,
      'credentials.region': true,
      'subscription.type': true,
      'usage.current': true,
      'usage.limit': true,
      userId: true
    } as any)

    expect(result).toEqual([
      {
        email: 'jessica.fo@kasxi.site',
        idp: 'BuilderId',
        credentials: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          region: 'us-east-1'
        },
        subscription: {
          type: 'Free'
        },
        usage: {
          current: 6,
          limit: 50
        },
        userId: 'd-9067642ac7.d4b8e498-c0e1-70e0-60b1-9436d2065cc3'
      }
    ])
  })

  it('does not include fields that were not selected', () => {
    const result = exportAsCustomJSON([baseAccount], {
      'credentials.accessToken': true
    } as any)

    expect(result).toEqual([
      {
        credentials: {
          accessToken: 'access-token'
        }
      }
    ])
  })

  it('exports expired credentials by default', () => {
    const expiredAccount: Account = {
      ...baseAccount,
      credentials: {
        ...baseAccount.credentials,
        expiresAt: Date.now() - 1000
      }
    }

    const result = exportTokens([expiredAccount], {
      format: 'json',
      fields: {
        email: true,
        'credentials.accessToken': true
      },
      onlyWithToken: true
    })

    expect(JSON.parse(result)).toEqual([
      {
        email: 'jessica.fo@kasxi.site',
        credentials: {
          accessToken: 'access-token'
        }
      }
    ])
  })

  it('throws a clear error when filters remove every account', () => {
    const expiredAccount: Account = {
      ...baseAccount,
      credentials: {
        ...baseAccount.credentials,
        expiresAt: Date.now() - 1000
      }
    }

    expect(() => exportTokens([expiredAccount], {
      format: 'json',
      fields: {
        email: true,
        'credentials.accessToken': true
      },
      onlyWithToken: true,
      includeExpired: false
    })).toThrow('筛选后没有可导出的账号')
  })
})
