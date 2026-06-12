@echo off
cd /d "%~dp0..\.."
echo [%date% %time%] 开始刷新Token...
npx ts-node server/scripts/batch-refresh-tokens.ts
echo [%date% %time%] 刷新完成
