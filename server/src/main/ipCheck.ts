/**
 * IP 检测模块 - 纯 Node.js 实现
 * 检测 IP 状态、AWS 连接、QQ 邮箱服务和 IP 信誉
 */

import axios from 'axios'
import net from 'net'
import dns from 'dns/promises'

// ============================================
// 类型定义
// ============================================

export interface IPCheckResult {
  ip: string
  location: {
    country: string
    region: string
    city: string
    isp: string
  }
  aws: {
    accessible: boolean
    latency: number
    level: 'normal' | 'captcha' | 'rate_limit' | 'blocked'
    details?: string
  }
  qqEmail: {
    accessible: boolean
    latency: number
    error?: string
  }
  reputation: {
    score: number
    blacklist: string[]
    factors: {
      datacenter: boolean
      vpn: boolean
      residential: boolean
    }
  }
  verdict: 'safe' | 'warning' | 'risky' | 'blocked'
  suggestion: string
}

export interface DomainAnalysisResult {
  domain: string
  resolved: boolean
  ip: string
  blacklist: string[]
  ssl: {
    valid: boolean
    expires?: string
  }
  reputation: {
    score: number
    factors: {
      datacenter: boolean
      vpn: boolean
      residential: boolean
    }
  }
  verdict: 'safe' | 'warning' | 'risky' | 'blocked'
  suggestion: string
}

export interface BrowserConfig {
  enabled?: boolean
  executablePath?: string
  headless?: boolean
  proxy?: {
    enabled?: boolean
    server?: string
    username?: string
    password?: string
  }
}

// ============================================
// IP 状态检测
// ============================================

/**
 * 执行 IP 状态检测
 * @param proxyUrl 代理地址（可选）
 * @param log 日志回调
 * @param qqEmail QQ 邮箱地址
 * @param qqAuthCode QQ 邮箱授权码
 * @param emailDomains 邮箱域名列表
 * @param browserConfig 浏览器配置
 */
export async function checkIPStatus(
  proxyUrl: string | undefined,
  log: (msg: string) => void,
  qqEmail: string,
  qqAuthCode: string,
  emailDomains: string | string[] | undefined,
  browserConfig?: BrowserConfig
): Promise<IPCheckResult> {
  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
    log(msg)
  }

  addLog('开始 IP 状态检测...')

  // 1. 获取 IP 信息
  const ipInfo = await getIPInfo(proxyUrl, addLog)

  // 2. 检测 AWS 连接
  const awsResult = await checkAWSConnection(proxyUrl, addLog)

  // 3. 检测 QQ 邮箱连接
  const qqEmailResult = await checkQQEmailConnection(
    proxyUrl,
    addLog,
    qqEmail,
    qqAuthCode
  )

  // 4. 检测 IP 信誉
  const reputation = await checkIPReputation(ipInfo.ip, proxyUrl, addLog)

  // 5. 综合判定
  const verdict = calculateVerdict(ipInfo, awsResult, qqEmailResult, reputation)

  // 6. 生成建议
  const suggestion = generateSuggestion(verdict, awsResult, qqEmailResult, reputation)

  addLog(`检测完成，判定结果: ${verdict}`)

  return {
    ...ipInfo,
    aws: awsResult,
    qqEmail: qqEmailResult,
    reputation,
    verdict,
    suggestion
  }
}

// ============================================
// 域名信誉分析
// ============================================

export async function analyzeDomainReputation(
  domain: string,
  log: (msg: string) => void
): Promise<DomainAnalysisResult> {
  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
    log(msg)
  }

  addLog(`开始分析域名: ${domain}`)

  // 1. DNS 解析
  const dnsResult = await resolveDNS(domain, addLog)

  // 2. 黑名单检查
  const blacklist = await checkDomainBlacklist(domain, addLog)

  // 3. SSL 证书检查
  const sslResult = await checkDomainSSL(domain, addLog)

  // 4. IP 信誉
  const reputation = dnsResult.resolved
    ? await checkIPReputation(dnsResult.ip, undefined, addLog)
    : { score: 0, blacklist: [], factors: { datacenter: false, vpn: false, residential: false } }

  // 5. 综合判定
  const verdict = calculateDomainVerdict(dnsResult, blacklist, reputation)
  const suggestion = generateDomainSuggestion(verdict, blacklist)

  addLog(`域名 ${domain} 分析完成，判定: ${verdict}`)

  return {
    domain,
    resolved: dnsResult.resolved,
    ip: dnsResult.ip,
    blacklist,
    ssl: sslResult,
    reputation,
    verdict,
    suggestion
  }
}

// ============================================
// 内部实现
// ============================================

/**
 * 获取 IP 信息（通过第三方 API）
 */
async function getIPInfo(
  proxyUrl: string | undefined,
  addLog: (msg: string) => void
): Promise<{
  ip: string
  location: { country: string; region: string; city: string; isp: string }
}> {
  addLog('正在获取 IP 信息...')

  const axiosConfig = proxyUrl ? { httpAgent: createAgent(proxyUrl), httpsAgent: createAgent(proxyUrl) } : {}

  const apis = [
    'https://ipinfo.io/json',
    'https://ipapi.co/json',
    'https://ip-api.com/json'
  ]

  for (const apiUrl of apis) {
    try {
      addLog(`尝试 API: ${apiUrl}`)
      const { data } = await axios.get(apiUrl, {
        ...axiosConfig,
        timeout: 15000,
        validateStatus: () => true
      })

      if (data && data.status !== 'fail') {
        let ip = data.ip || ''
        let country = data.country || data.countryName || '未知'
        let region = data.region || data.regionName || data.state || '未知'
        let city = data.city || data.regionName || '未知'
        let isp = data.org || data.isp || data.asn || '未知'

        addLog(`IP: ${ip}, 位置: ${country} ${region} ${city}, ISP: ${isp}`)

        return {
          ip,
          location: {
            country,
            region,
            city,
            isp
          }
        }
      }
    } catch (err: any) {
      addLog(`API ${apiUrl} 失败: ${err.message}`)
    }
  }

  addLog('所有 IP 查询 API 均失败，使用备用方式')

  // 备用：ip-api.com（纯 HTTP）
  try {
    const { data } = await axios.get('http://ip-api.com/json', {
      ...axiosConfig,
      timeout: 10000
    })

    return {
      ip: data.ip || '未知',
      location: {
        country: data.country || '未知',
        region: data.regionName || '未知',
        city: data.city || '未知',
        isp: data.isp || '未知'
      }
    }
  } catch {
    return {
      ip: '获取失败',
      location: {
        country: '未知',
        region: '未知',
        city: '未知',
        isp: '未知'
      }
    }
  }
}

/**
 * 检测 AWS 连接性
 */
async function checkAWSConnection(
  proxyUrl: string | undefined,
  addLog: (msg: string) => void
): Promise<IPCheckResult['aws']> {
  addLog('正在检测 AWS 连接...')

  const endpoints = [
    'https://aws.amazon.com',
    'https://us-east-1.amazonaws.com'
  ]

  for (const url of endpoints) {
    try {
      addLog(`测试端点: ${url}`)
      const start = Date.now()
      const { data } = await axios.get(url, {
        ...(proxyUrl ? { httpAgent: createAgent(proxyUrl), httpsAgent: createAgent(proxyUrl) } : {}),
        timeout: 15000,
        validateStatus: () => true,
        maxRedirects: 3
      })
      const latency = Date.now() - start

      addLog(`响应状态: ${data.status}, 延迟: ${latency}ms`)

      if (data.status === 403 || data.status === 404) {
        return {
          accessible: true,
          latency,
          level: 'normal',
          details: `响应正常 (${latency}ms)`
        }
      }

      // 检查是否有验证码或限流页面
      const html = data?.data || data || ''
      if (typeof html === 'string') {
        if (html.includes('captcha') || html.includes('verify')) {
          addLog('检测到验证码页面')
          return {
            accessible: false,
            latency,
            level: 'captcha',
            details: `检测到验证码 (${latency}ms)`
          }
        }
        if (html.includes('rate') || html.includes('limit')) {
          addLog('检测到限流')
          return {
            accessible: false,
            latency,
            level: 'rate_limit',
            details: `检测到限流 (${latency}ms)`
          }
        }
      }

      return {
        accessible: true,
        latency,
        level: 'normal',
        details: `可正常访问 (${latency}ms)`
      }
    } catch (err: any) {
      addLog(`AWS 连接失败: ${err.message}`)

      if (err.code === 'ECONNABORTED') {
        return {
          accessible: false,
          latency: 15000,
          level: 'blocked',
          details: '连接超时'
        }
      }

      if (err.message.includes('certificate') || err.message.includes('SSL')) {
        return {
          accessible: false,
          latency: 0,
          level: 'blocked',
          details: 'SSL 证书验证失败'
        }
      }
    }
  }

  return {
    accessible: false,
    latency: 0,
    level: 'blocked',
    details: '所有 AWS 端点均无法连接'
  }
}

/**
 * 检测 QQ 邮箱 SMTP 连接
 */
async function checkQQEmailConnection(
  proxyUrl: string | undefined,
  addLog: (msg: string) => void,
  qqEmail: string,
  qqAuthCode: string
): Promise<IPCheckResult['qqEmail']> {
  addLog('正在检测 QQ 邮箱连接...')

  if (!qqEmail || !qqAuthCode) {
    addLog('QQ 邮箱配置缺失，跳过邮箱检测')
    return {
      accessible: false,
      latency: 0,
      error: '邮箱配置缺失'
    }
  }

  try {
    addLog(`测试 QQ 邮箱 SMTP: ${qqEmail}`)
    const start = Date.now()

    // 使用 net.Socket 测试 SMTP 端口连接 (587 或 465)
    const connected = await trySMTPConnect('smtp.qq.com', 587, proxyUrl, addLog)
    const latency = Date.now() - start

    if (connected) {
      addLog(`QQ 邮箱 SMTP 连接成功 (${latency}ms)`)
      return {
        accessible: true,
        latency
      }
    } else {
      addLog('QQ 邮箱 SMTP 连接失败')
      return {
        accessible: false,
        latency,
        error: 'SMTP 连接失败'
      }
    }
  } catch (err: any) {
    addLog(`QQ 邮箱检测异常: ${err.message}`)
    return {
      accessible: false,
      latency: 0,
      error: err.message
    }
  }
}

async function trySMTPConnect(
  host: string,
  port: number,
  proxyUrl: string | undefined,
  addLog: (msg: string) => void
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 8000)

    const socket = new net.Socket()

    if (proxyUrl && proxyUrl.includes('127.0.0.1') || proxyUrl?.includes('localhost')) {
      addLog(`直连测试 SMTP ${host}:${port}...`)
      socket.connect(port, host, () => {
        clearTimeout(timeout)
        socket.destroy()
        resolve(true)
      })
    } else {
      addLog(`直连测试 SMTP ${host}:${port}...`)
      socket.connect(port, host, () => {
        clearTimeout(timeout)
        socket.destroy()
        resolve(true)
      })
    }

    socket.on('error', (err) => {
      clearTimeout(timeout)
      addLog(`SMTP 连接失败: ${err.message}`)
      resolve(false)
    })
  })
}

/**
 * 检测 IP 信誉
 */
async function checkIPReputation(
  ip: string,
  proxyUrl: string | undefined,
  addLog: (msg: string) => void
): Promise<IPCheckResult['reputation']> {
  addLog('正在检测 IP 信誉...')

  if (ip === '获取失败' || ip === '未知') {
    return {
      score: 0,
      blacklist: [],
      factors: { datacenter: false, vpn: false, residential: false }
    }
  }

  let score = 50 // 基础分
  const blacklist: string[] = []
  const factors = {
    datacenter: false,
    vpn: false,
    residential: true
  }

  // 1. 检查是否为数据中心 IP
  const isDatacenter = ['AWS', 'Azure', 'Google', 'Alibaba', 'AWS EC2', 'EC2', 'Amazon.com'].some((k) =>
    ip.toLowerCase().includes(k.toLowerCase()) || false
  )

  // 2. 检查黑名单
  const blacklistAPIs = [
    `https://api.abuseipdb.com/api/v3/ip/${ip}`,
    `https://api.virustotal.com/api/v3/ip_addresses/${ip}`
  ]

  // 3. 检查 IP 是否为内网 IP
  if (/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./i.test(ip)) {
    factors.datacenter = true
    score += 20
  }

  // 使用 ip-api.com 获取详细信息
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`, {
      ...(proxyUrl ? { httpAgent: createAgent(proxyUrl), httpsAgent: createAgent(proxyUrl) } : {}),
      timeout: 10000
    })

    if (data && data.status === 'success') {
      const { asn, as, org, isp: ipIsp, city, country } = data

      addLog(`IP 详情: AS${asn || '?'}, ${as || org || ipIsp}, ${city}, ${country}`)

      // 数据中心检测
      const asStr = (as || org || ipIsp || '').toLowerCase()
      if (asStr.includes('amazon') || asStr.includes('google') ||
          asStr.includes('microsoft') || asStr.includes('digital ocean') ||
          asStr.includes('linode') || asStr.includes('cloudflare') ||
          asStr.includes('alibaba') || asStr.includes('tencent') ||
          asStr.includes('hetzner') || asStr.includes('ovh')) {
        factors.datacenter = true
        factors.residential = false
        score -= 15
        addLog('检测到数据中心 IP')
      }

      // VPN/代理检测
      if (asStr.includes('vpn') || asStr.includes('proxy') ||
          asStr.includes('tor') || asStr.includes('anon')) {
        factors.vpn = true
        factors.residential = false
        score -= 20
        blacklist.push('vpn_proxy')
        addLog('检测到 VPN/代理')
      }
    }
  } catch {
    addLog('IP 信誉详情查询失败')
  }

  // 4. 检查 VirusTotal（匿名）
  try {
    const { data } = await axios.get(
      `https://www.virustotal.com/api/v3/ip_addresses/${ip}`,
      {
        headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY || '' },
        timeout: 5000,
        validateStatus: () => true
      }
    )

    if (data?.data?.attributes?.last_analysis_stats) {
      const stats = data.data.attributes.last_analysis_stats
      const malicious = stats.malicious || 0
      if (malicious > 0) {
        score -= 20
        blacklist.push(`virustotal_${malicious}个报告标记`)
        addLog(`VirusTotal 发现 ${malicious} 个恶意报告`)
      }
    }
  } catch {
    addLog('VirusTotal 查询跳过（无 API Key 或失败）')
  }

  // 5. 检查 AbuseIPDB
  try {
    const { data } = await axios.get(
      `https://api.abuseipdb.com/api/v3/ip/${ip}`,
      {
        headers: { 'Key': process.env.ABUSEIPDB_API_KEY || '' },
        timeout: 5000,
        validateStatus: () => true
      }
    )

    if (data?.data?.abuseConfidenceScore && data.data.abuseConfidenceScore > 50) {
      score -= 15
      blacklist.push('abuseipdb_high_abuse')
      addLog(`AbuseIPDB 举报评分: ${data.data.abuseConfidenceScore}`)
    }
  } catch {
    addLog('AbuseIPDB 查询跳过')
  }

  // 分数范围限制
  score = Math.max(0, Math.min(100, score))

  if (blacklist.length === 0 && !factors.vpn && !factors.datacenter) {
    score = Math.max(score, 70)
  }

  addLog(`信誉评分: ${score}/100, 黑名单: ${blacklist.length} 项`)

  return { score, blacklist, factors }
}

/**
 * 计算综合判定
 */
function calculateVerdict(
  ipInfo: { ip: string },
  aws: { accessible: boolean; level: string },
  qqEmail: { accessible: boolean },
  reputation: { score: number }
): IPCheckResult['verdict'] {
  if (reputation.score >= 70 && aws.accessible) {
    return 'safe'
  }
  if (reputation.score >= 40 && (aws.accessible || aws.level === 'captcha')) {
    return 'warning'
  }
  if (reputation.score >= 20) {
    return 'risky'
  }
  return 'blocked'
}

/**
 * 生成建议
 */
function generateSuggestion(
  verdict: IPCheckResult['verdict'],
  aws: { accessible: boolean; level: string },
  qqEmail: { accessible: boolean; error?: string },
  reputation: { score: number; blacklist: string[]; factors: { datacenter: boolean; vpn: boolean } }
): string {
  const tips: string[] = []

  if (verdict === 'safe') {
    tips.push('当前 IP 状态良好，可以正常使用 AWS 和相关服务。')
  }

  if (!aws.accessible) {
    if (aws.level === 'captcha') {
      tips.push('AWS 检测到验证码，可能需要使用不同的 IP 或清理浏览器指纹。')
    } else if (aws.level === 'rate_limit') {
      tips.push('AWS 检测到限流，请稍后再试或更换 IP。')
    } else {
      tips.push('无法连接 AWS，请检查网络设置或更换 IP。')
    }
  }

  if (!qqEmail.accessible) {
    if (qqEmail.error === '邮箱配置缺失') {
      tips.push('请在配置中设置 QQ 邮箱和授权码以进行邮箱检测。')
    } else {
      tips.push('QQ 邮箱连接失败，可能是 IP 被腾讯封锁，建议更换 IP。')
    }
  }

  if (reputation.factors.datacenter) {
    tips.push('当前为数据中心 IP，部分服务可能有限制。')
  }
  if (reputation.factors.vpn) {
    tips.push('当前使用 VPN/代理 IP，多数服务会对此类 IP 进行限制。')
  }
  if (reputation.blacklist.length > 0) {
    tips.push(`IP 在以下黑名单中被标记: ${reputation.blacklist.join(', ')}，建议更换 IP。`)
  }

  return tips.length > 0 ? tips.join(' ') : '当前 IP 状态正常。'
}

/**
 * DNS 解析
 */
async function resolveDNS(
  domain: string,
  addLog: (msg: string) => void
): Promise<{ resolved: boolean; ip: string }> {
  addLog(`正在解析域名: ${domain}`)

  try {
    const resolver = new dns.Resolver()
    const addresses = await resolver.resolve4(domain)

    if (addresses && addresses.length > 0) {
      addLog(`DNS 解析成功: ${addresses.join(', ')}`)
      return { resolved: true, ip: addresses[0] }
    }
  } catch (err: any) {
    addLog(`DNS 解析失败: ${err.message}`)
  }

  return { resolved: false, ip: '' }
}

/**
 * 域名黑名单检查
 */
async function checkDomainBlacklist(
  domain: string,
  addLog: (msg: string) => void
): Promise<string[]> {
  const blacklist: Array<string> = []
  addLog('正在检查黑名单...')

  // VirusTotal
  try {
    const { data } = await axios.get(
      `https://www.virustotal.com/api/v3/domains/${domain}`,
      {
        headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY || '' },
        timeout: 5000,
        validateStatus: () => true
      }
    )

    if (data?.data?.attributes?.last_analysis_stats) {
      const stats = data.data.attributes.last_analysis_stats
      const malicious = stats.malicious || 0
      if (malicious > 0) {
        blacklist.push(`virustotal_${malicious}个报告`)
      }
    }
  } catch (err: any) {
    addLog(`VirusTotal 黑名单查询失败: ${err.message}`)
  }

  return blacklist
}

/**
 * SSL 证书检查
 */
async function checkDomainSSL(
  domain: string,
  addLog: (msg: string) => void
): Promise<{ valid: boolean; expires?: string }> {
  try {
    const tls = await import('tls')
    const options: any = {
      host: domain,
      port: 443,
      servername: domain,
      rejectUnauthorized: false
    }

    return new Promise<{ valid: boolean; expires?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        socket.destroy()
        resolve({ valid: false })
      }, 5000)

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate(true)
        if (cert && Object.keys(cert).length > 0) {
          const notAfter = cert.valid_to
          socket.destroy()
          clearTimeout(timeout)
          resolve({ valid: true, expires: notAfter })
        } else {
          socket.destroy()
          clearTimeout(timeout)
          resolve({ valid: false })
        }
      })

      socket.on('error', () => {
        clearTimeout(timeout)
        socket.destroy()
        resolve({ valid: false })
      })
    })
  } catch {
    return { valid: false }
  }
}

/**
 * 计算域名判定
 */
function calculateDomainVerdict(
  dns: { resolved: boolean },
  blacklist: string[],
  reputation: { score: number }
): DomainAnalysisResult['verdict'] {
  if (!dns.resolved) return 'blocked'
  if (blacklist.length > 0 || reputation.score < 20) return 'blocked'
  if (blacklist.length > 0 || reputation.score < 50) return 'risky'
  if (reputation.score < 70) return 'warning'
  return 'safe'
}

/**
 * 生成域名建议
 */
function generateDomainSuggestion(
  verdict: DomainAnalysisResult['verdict'],
  blacklist: string[]
): string {
  if (verdict === 'safe') return '域名信誉良好。'
  if (verdict === 'blocked') return `域名被列入黑名单 (${blacklist.join(', ')})，不建议使用。`
  if (verdict === 'risky') return '域名存在一定风险，建议谨慎使用。'
  return '域名有一定风险因素，建议关注。'
}

/**
 * 创建 HTTP Agent（支持代理）
 */
function createAgent(proxyUrl: string): any {
  const { HttpProxyAgent } = require('http-proxy-agent')
  const { HttpsProxyAgent } = require('https-proxy-agent')
  const url = new URL(proxyUrl)
  const agent = url.protocol === 'https:'
    ? new HttpsProxyAgent(proxyUrl)
    : new HttpProxyAgent(proxyUrl)
  return agent
}
