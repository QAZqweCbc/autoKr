/**
 * Setup Wizard - Standalone Express Web Service
 * Port: 3000
 * Provides configuration wizard UI and APIs for initial server setup
 */

import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import { existsSync } from 'fs'
import * as mysql from 'mysql2/promise'

import {
  checkSetupStatus,
  checkEnvVars,  generateEnvVars,
  saveEnvVars,
  markSetupComplete,
  checkSystemDependencies
} from '../services/setup.service'

import {
  loadDatabaseConfig,
  saveDatabaseConfig,
  validateDatabaseConfig,
  getMaskedConfig,
  DatabaseConfig
} from '../services/database-config.service'

import {
  JsonMigratorService,
  MigrationResult
} from '../services/json-migrator.service'

const app = express()
const PORT = 3000
const STATIC_DIR = path.join(__dirname, 'public')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

app.get('/api/setup/status', async (req: Request, res: Response) => {
  try {
    const status = checkSetupStatus()
    const jsonMigrator = new JsonMigratorService()
    const jsonFiles = jsonMigrator.detectJsonFiles()
    const dbConfig = loadDatabaseConfig()
    const maskedConfig = getMaskedConfig(dbConfig)

    res.json({
      success: true,
      data: { status, jsonFiles, databaseConfig: maskedConfig }
    })
  } catch (error: any) {
    console.error('Status check failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/setup/mysql', async (req: Request, res: Response) => {
  try {
    const { host, port, user, password, database } = req.body

    if (!host || !user || !database) {
      return res.status(400).json({
        success: false,
        error: 'Host, user, and database are required'
      })
    }

    const currentConfig = loadDatabaseConfig()
    const newConfig: DatabaseConfig = {
      ...currentConfig,
      storage: 'mysql',
      mysql: {
        host,
        port: parseInt(port) || 3306,
        user,
        password: password || '',
        database
      }
    }

    const validation = validateDatabaseConfig(newConfig)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors
      })
    }

    saveDatabaseConfig(newConfig)

    res.json({
      success: true,
      message: 'MySQL configuration saved',
      config: getMaskedConfig(newConfig)
    })
  } catch (error: any) {
    console.error('Save MySQL config failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/setup/mysql/test', async (req: Request, res: Response) => {
  let connection: mysql.Connection | null = null

  try {
    const { host, port, user, password, database } = req.body

    if (!host || !user || !database) {
      return res.status(400).json({
        success: false,
        error: 'Host, user, and database are required'
      })
    }

    console.log(`Testing MySQL connection to ${host}:${port}...`)

    connection = await mysql.createConnection({
      host,
      port: parseInt(port) || 3306,
      user,
      password: password || '',
      database,
      connectTimeout: 5000
    })

    await connection.execute('SELECT 1')
    console.log('MySQL connection successful')

    res.json({ success: true, message: 'MySQL connection successful' })
  } catch (error: any) {
    console.error('MySQL connection failed:', error)

    let errorMessage = error.message

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Check if MySQL is running and host/port are correct.'
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Access denied. Check your username and password.'
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = 'Database does not exist. Create it first or use an existing database.'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Check your network and firewall settings.'
    }

    res.status(400).json({ success: false, error: errorMessage, code: error.code })
  } finally {
    if (connection) {
      await connection.end()
    }
  }
})

app.post('/api/setup/redis', async (req: Request, res: Response) => {
  try {
    const { host, port, password, db } = req.body

    if (!host) {
      return res.status(400).json({ success: false, error: 'Host is required' })
    }

    const currentConfig = loadDatabaseConfig()
    const newConfig: DatabaseConfig = {
      ...currentConfig,
      redis: {
        host,
        port: parseInt(port) || 6379,
        password: password || '',
        db: parseInt(db) || 0
      }
    }

    const validation = validateDatabaseConfig(newConfig)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors
      })
    }

    saveDatabaseConfig(newConfig)

    res.json({
      success: true,
      message: 'Redis configuration saved',
      config: getMaskedConfig(newConfig)
    })
  } catch (error: any) {
    console.error('Save Redis config failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/setup/redis/test', async (req: Request, res: Response) => {
  let client: any = null

  try {
    const { host, port, password, db } = req.body

    if (!host) {
      return res.status(400).json({ success: false, error: 'Host is required' })
    }

    console.log(`Testing Redis connection to ${host}:${port}...`)

    // Dynamic import for optional redis dependency
    let redis: any
    try {
      redis = require('redis')
    } catch (importError) {
      return res.status(500).json({
        success: false,
        error: 'Redis client not installed. Run: npm install redis'
      })
    }

    client = redis.createClient({
      socket: { host, port: parseInt(port) || 6379, connectTimeout: 5000 },
      password: password || undefined,
      database: parseInt(db) || 0
    })

    await client.connect()
    await client.ping()
    console.log('Redis connection successful')

    res.json({ success: true, message: 'Redis connection successful' })
  } catch (error: any) {
    console.error('Redis connection failed:', error)

    let errorMessage = error.message

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Check if Redis is running and host/port are correct.'
    } else if (error.message && error.message.includes('WRONGPASS')) {
      errorMessage = 'Invalid password. Check your Redis password.'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Check your network and firewall settings.'
    }

    res.status(400).json({ success: false, error: errorMessage, code: error.code })
  } finally {
    if (client) {
      await client.disconnect()
    }
  }
})

app.post('/api/setup/migrate', async (req: Request, res: Response) => {
  try {
    console.log('Starting JSON migration via Setup Wizard')

    const jsonMigrator = new JsonMigratorService()
    const result: MigrationResult = await jsonMigrator.migrateAllData()

    res.json({
      success: result.success,
      message: result.success ? 'Migration completed successfully' : 'Migration completed with errors',
      data: {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        failedRecords: result.failedRecords,
        files: result.files,
        backupPath: result.backupPath,
        errors: result.errors.slice(0, 10)
      }
    })
  } catch (error: any) {
    console.error('Migration failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/setup/env', async (req: Request, res: Response) => {
  try {
    const { regenerate } = req.body
    const existing = checkEnvVars()

    if (!regenerate && existing.jwtSecret && existing.encryptionKey) {
      return res.json({
        success: true,
        message: 'Environment variables already configured',
        existing: true
      })
    }

    const envVars = generateEnvVars()
    saveEnvVars(envVars)

    res.json({
      success: true,
      message: 'Environment variables generated and saved',
      existing: false
    })
  } catch (error: any) {
    console.error('Generate env vars failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/setup/complete', async (req: Request, res: Response) => {
  try {
    const status = checkSetupStatus()
    const errors: string[] = []

    if (!status.mysql.configured) {
      errors.push('MySQL is not configured')
    }

    if (!status.envVars.jwtSecret || !status.envVars.encryptionKey) {
      errors.push('Environment variables are not configured')
    }

    const failedDeps = status.dependencies.filter(d => d.status === 'fail' && d.category === 'required')
    if (failedDeps.length > 0) {
      errors.push(`Missing required dependencies: ${failedDeps.map(d => d.name).join(', ')}`)
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Setup incomplete', errors })
    }

    markSetupComplete()

    console.log('Setup Wizard completed successfully!')
    console.log('You can now start the main server.')

    res.json({
      success: true,
      message: 'Setup completed successfully. You can now start the main server.'
    })
  } catch (error: any) {
    console.error('Complete setup failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/setup/dependencies', async (req: Request, res: Response) => {
  try {
    const dependencies = checkSystemDependencies()
    res.json({ success: true, data: dependencies })
  } catch (error: any) {
    console.error('Check dependencies failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR))

  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(STATIC_DIR, 'index.html'))
    } else {
      res.status(404).json({ success: false, error: 'API endpoint not found' })
    }
  })
} else {
  console.warn(`Static directory not found: ${STATIC_DIR}`)
  console.warn('Setup wizard will only serve API endpoints.')

  app.get('/', (req: Request, res: Response) => {
    res.json({
      service: 'Setup Wizard API',
      version: '1.0.0',
      endpoints: {
        status: 'GET /api/setup/status',
        mysql: 'POST /api/setup/mysql',
        mysqlTest: 'POST /api/setup/mysql/test',
        redis: 'POST /api/setup/redis',
        redisTest: 'POST /api/setup/redis/test',
        migrate: 'POST /api/setup/migrate',
        env: 'POST /api/setup/env',
        complete: 'POST /api/setup/complete',
        dependencies: 'GET /api/setup/dependencies'
      }
    })
  })
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ success: false, error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('Setup Wizard - Configuration Service')
  console.log(`URL: http://localhost:${PORT}`)
  console.log(`API: http://localhost:${PORT}/api/setup/status`)
  console.log('='.repeat(60))
  console.log('This is a standalone configuration service.')
  console.log('Complete the setup wizard to configure the main rver.')
  console.log('='.repeat(60) + '\n')
})

export default app
