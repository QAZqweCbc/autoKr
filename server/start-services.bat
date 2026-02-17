@echo off
REM Kiro 用户管理系统 - 服务启动脚本 (Windows)
REM 用于开发和测试环境

echo ==========================================
echo   Kiro 用户管理与Token分配系统
echo ==========================================
echo.

REM 检查Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未安装 Node.js
    echo 请访问 https://nodejs.org/ 安装 Node.js
    pause
    exit /b 1
)

echo ✓ Node.js 已安装
node --version

REM 检查npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未安装 npm
    pause
    exit /b 1
)

echo ✓ npm 已安装
npm --version
echo.

REM 检查依赖
if not exist "node_modules" (
    echo 📦 安装依赖...
    call npm install
    echo.
)

REM 检查环境配置
if not exist ".env" (
    echo ⚠️  警告: 未找到 .env 文件
    echo 使用默认配置启动...
    echo.
)

REM 检查管理员账户
echo 🔍 检查管理员账户...
if not exist ".admin-initialized" (
    echo 📝 初始化管理员账户...
    call npm run init:admin
    if %ERRORLEVEL% EQU 0 (
        echo. > .admin-initialized
    )
    echo.
)

REM 检查端口占用
echo 🔍 检查端口占用...
netstat -ano | findstr :3000 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ❌ 错误: 端口 3000 已被占用
    echo 请使用以下命令查看占用进程:
    echo   netstat -ano ^| findstr :3000
    echo 或者杀死占用进程:
    echo   taskkill /PID [进程ID] /F
    pause
    exit /b 1
)

netstat -ano | findstr :2233 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ❌ 错误: 端口 2233 已被占用
    echo 请使用以下命令查看占用进程:
    echo   netstat -ano ^| findstr :2233
    pause
    exit /b 1
)

echo ✓ 端口检查通过
echo.

REM 启动服务
echo ==========================================
echo   启动服务
echo ==========================================
echo.
echo 主服务端口: 3000
echo 认证服务端口: 2233
echo.
echo 管理面板: http://localhost:3000
echo 管理员登录: http://localhost:3000/admin-login
echo.
echo 默认管理员账户:
echo   邮箱: admin@user.com
echo   密码: cbc123123
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
echo.

REM 启动服务
call npm run dev:all
