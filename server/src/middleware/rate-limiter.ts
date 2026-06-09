/**
 * API 请求限流中间件
 * 防止滥用和 DDoS 攻击
 */

import rateLimit from 'express-rate-limit'
import { logger } from '../utils/logger'

const API_LIMIT_WINDOW_MS = Number(process.env.API_LIMIT_WINDOW_MS || 15 * 60 * 1000)
const API_LIMIT_MAX = Number(process.env.API_LIMIT_MAX || 1000)

/**
 * 通用 API 限流
 * 15分钟内最多 100 个请求
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: API_LIMIT_MAX,
  message: {
    error: '请求过于频繁，请稍后再试',
    retryAfter: '15分钟'
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    })
    
    res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: '15分钟'
    })
  }
})

/**
 * 严格限流（用于敏感操作）
 * 15分钟内最多 10 个请求
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: '操作过于频繁，请稍后再试',
    retryAfter: '15分钟'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    })
    
    res.status(429).json({
      error: '操作过于频繁，请稍后再试',
      retryAfter: '15分钟'
    })
  }
})

/**
 * 账号生成限流
 * 1小时内最多 5 个请求
 */
export const generatorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5,
  message: {
    error: '账号生成请求过于频繁，请1小时后再试',
    retryAfter: '1小时'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('Generator rate limit exceeded', {
      ip: req.ip,
      path: req.path
    })
    
    res.status(429).json({
      error: '账号生成请求过于频繁，请1小时后再试',
      retryAfter: '1小时'
    })
  }
})

/**
 * 登录限流
 * 15分钟内最多 5 次尝试
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: '登录尝试次数过多，请15分钟后再试',
    retryAfter: '15分钟'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计数
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      username: req.body?.username
    })
    
    res.status(429).json({
      error: '登录尝试次数过多，请15分钟后再试',
      retryAfter: '15分钟'
    })
  }
})
