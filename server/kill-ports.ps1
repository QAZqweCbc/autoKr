# 关闭占用1455和2233端口的进程
# 使用方法: .\kill-ports.ps1

Write-Host "🔍 查找占用端口的进程..." -ForegroundColor Yellow

# 查找端口1455
$port1455 = netstat -ano | Select-String ":1455" | Select-String "LISTENING"
if ($port1455) {
    $pid1455 = ($port1455 -split '\s+')[-1]
    Write-Host "📍 端口 1455 被进程 $pid1455 占用" -ForegroundColor Cyan
    try {
        Stop-Process -Id $pid1455 -Force -ErrorAction Stop
        Write-Host "✅ 已关闭进程 $pid1455" -ForegroundColor Green
    } catch {
        Write-Host "❌ 无法关闭进程 $pid1455" -ForegroundColor Red
    }
} else {
    Write-Host "✅ 端口 1455 未被占用" -ForegroundColor Green
}

# 查找端口2233
$port2233 = netstat -ano | Select-String ":2233" | Select-String "LISTENING"
if ($port2233) {
    $pid2233 = ($port2233 -split '\s+')[-1]
    Write-Host "📍 端口 2233 被进程 $pid2233 占用" -ForegroundColor Cyan
    try {
        Stop-Process -Id $pid2233 -Force -ErrorAction Stop
        Write-Host "✅ 已关闭进程 $pid2233" -ForegroundColor Green
    } catch {
        Write-Host "❌ 无法关闭进程 $pid2233" -ForegroundColor Red
    }
} else {
    Write-Host "✅ 端口 2233 未被占用" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 完成！现在可以运行 npm run dev:all" -ForegroundColor Green
