# 全国商科院校商机雷达（edu-bizradar）

面向商科实训软件销售的高校商机监测系统：在高校采购前 1–6 个月捕获高意向线索。
链路：**多源采集 → 本地 JSON 数据仓库 → 商机评分 → 每日简报推送 → GitHub Pages 线索查阅站**。

线上站点：https://trent-200522.github.io/edu-bizradar/

## 快速使用

```powershell
npm install
node src/run.js collect        # 采集（按各源频率：教育部/省教育厅按周，招标网按天）
node src/run.js score          # 商机评分：A类 / 关注 / B类 / 红牌
node src/run.js briefing       # 生成每日简报并推送企业微信/飞书（需在 config/webhooks.json 配置）
node src/run.js weekly         # 导出周度线索池 CSV
node src/run.js site           # 生成 dist/ 静态站
node push.js "提交信息"         # 推送站点+源码到 GitHub（Contents API，无需本地 git）
node test/test-score.js        # 评分引擎三分支测试
```

## 定时任务

以管理员身份运行 `scripts/setup-tasks.ps1`，注册三个 Windows 计划任务：
每小时采集、每日 08:30 简报、每周五 09:00 周度线索池。

## 目录说明

- `config/sources.json` 数据源注册表（分级/频率/选择器，可增删省份与院校栏目）
- `config/schools.json` 目标院校名单（补 `bidUrl`/`hrUrl` 即启用该校招标/人事采集）
- `config/keywords.json` 关键词库（采购词/专业名/竞品名单，可直接编辑）
- `config/rules.json` 评分阈值与话术模板
- `config/webhooks.json` 企业微信/飞书机器人地址（不推送远端）
- `data/` 数据仓库：schools 院校表 / majors 专业动态表 / signals 需求信号表 / opportunities 商机视图
- `src/fetch/` 抓取层（限速 ≥2s、robots 协议、仅公开页面、不采个人手机号）

## 评分规则

- **A类**：新设商科专业 + 无历史软件采购记录 + 预算 ≥15 万
- **B类**：仅师资变动（招聘实验系列人员）
- **红牌**：目标专业停招，暂不跟进，从简报剔除

## 合规底线

仅采集公开发布页面；遵守 robots.txt；请求限速；只采官网公开的办公电话/邮箱；每条数据保留原文链接与抓取时间，可回溯原文。
