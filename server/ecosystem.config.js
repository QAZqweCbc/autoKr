/**
 * PM2 部署配置文件
 * 用于生产环境进程管理
 * 
 * 使用方法：
 * 1. 安装PM2: npm install -g pm2
 * 2. 启动服务: pm2 start ecosystem.config.js
 * 3. 查看状态: pm2 status
 * 4. 查看日志: pm2 logs
 * 5. 重启服务: pm2 restart all
 * 6. 停止服务: pm2 stop all
 */

module.exports = {
  apps: [
    {
      name: 'kiro-main-service',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/main-error.log',
      out_file: './logs/main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false
    },
    {
      name: 'kiro-auth-service',
      script: './dist/auth-service/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        AUTH_PORT: 2233
      },
      error_file: './logs/auth-error.log',
      out_file: './logs/auth-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
      watch: false
    }
  ]
}
