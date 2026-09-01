# 注册 Windows 计划任务（需管理员权限运行）
# 1) 每小时采集+评分+建站   2) 每日 08:30 简报   3) 每周五 09:00 周度线索池
# 用法：右键"使用 PowerShell 运行"或管理员终端执行  powershell -ExecutionPolicy Bypass -File setup-tasks.ps1

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error '未找到 node，请先安装 Node.js'; exit 1 }

# 采集任务：每小时（脚本内部按各源频率决定是否真正执行）
schtasks /Create /TN "EduBizRadar-Collect" /SC HOURLY /MO 1 /TR "cmd /c cd /d `"$root`" && `"$node`" src/run.js collect && `"$node`" src/run.js score && `"$node`" src/run.js site" /RL LIMITED /F

# 简报任务：每日 08:30
schtasks /Create /TN "EduBizRadar-Briefing" /SC DAILY /ST 08:30 /TR "cmd /c cd /d `"$root`" && `"$node`" src/run.js briefing && `"$node`" src/run.js site" /RL LIMITED /F

# 周度线索池：每周五 09:00
schtasks /Create /TN "EduBizRadar-Weekly" /SC WEEKLY /D FRI /ST 09:00 /TR "cmd /c cd /d `"$root`" && `"$node`" src/run.js weekly" /RL LIMITED /F

Write-Host ''
Write-Host '已注册计划任务：'
schtasks /Query /TN "EduBizRadar-Collect" /FO LIST | Select-String 'TaskName|Status'
schtasks /Query /TN "EduBizRadar-Briefing" /FO LIST | Select-String 'TaskName|Status'
schtasks /Query /TN "EduBizRadar-Weekly" /FO LIST | Select-String 'TaskName|Status'
Write-Host "工作目录：$root"
