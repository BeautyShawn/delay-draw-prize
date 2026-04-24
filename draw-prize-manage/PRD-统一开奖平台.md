# 统一开奖平台 PRD

## 1. 文档信息

- 文档名称：统一开奖平台产品需求文档
- 适用范围：抽奖活动后台管理 + 用户端移动展示
- 当前版本依据：`/Users/zhangxiao/Downloads/draw-prize-manage` 当前原型与本地接口实现
- 文档目的：沉淀当前原型的业务目标、页面职责、字段定义、来源、边界条件及实现约束，供产品、设计、前端、后端联调使用

## 2. 产品定位

统一开奖平台用于支持“活动期间发放抽奖码，指定时间统一开奖”的营销活动闭环。

平台分为两部分：

- 后台管理端：用于运营配置活动、奖品、查看参与记录、执行开奖、人工干预、查看统计
- 用户端 M 版：用于用户查看活动、参与任务、获取抽奖码、等待开奖、查看结果、兑奖与查看中奖记录

## 3. 核心业务流程

1. 运营创建活动，配置活动时间、开奖时间、参与次数限制、参与任务、奖品池和中奖策略。
2. 用户在活动周期内完成指定任务，获得一个或多个抽奖码。
3. 到达开奖时间后，平台统一开奖。
4. 中奖用户进入兑奖流程；未中奖用户进入安慰反馈页。
5. 运营可在后台查看中奖结果并进行人工干预。
6. 平台输出活动、奖品、参与、开奖统计数据。

## 4. 角色与权限

### 4.1 后台角色

- 运营：创建和编辑活动、配置奖品、查看记录、执行开奖
- 客服/审核：人工调整中奖结果、取消中奖、记录备注

### 4.2 用户端角色

- 登录用户：查看活动、完成任务、获得抽奖码、查看开奖结果、兑奖、查看中奖记录

## 5. 关键对象模型

### 5.1 活动 Activity

字段：

- `id`：活动 ID
- `name`：活动名称
- `startTime`：活动开始时间
- `endTime`：活动结束时间
- `drawTime`：统一开奖时间
- `status`：活动状态
- `participantCount`：参与人数
- `entryCount`：抽奖码总数
- `allowMultiWin`：是否允许同一用户多次中奖
- `interventionRate`：人工干预中奖率
- `joinLimit`：参与次数限制
- `description`：活动说明
- `subtitle`：前台副标题
- `buttonText`：前台按钮文案
- `tasks`：参与任务列表

来源：

- 主数据来源：`data/store.json > activities`
- 后台接口来源：`GET /api/activities`、`GET /api/activities/:id`
- 聚合补充来源：`server/index.js > enrichActivity`

边界条件：

- `name` 必填
- `status` 当前支持：`草稿/进行中/待开奖/已开奖/已结束`
- `interventionRate` 范围为 `0-100`
- `joinLimit` 当前原型支持：`每天1次/总共1次/总共3次/无限制/自定义`
- `tasks` 允许为空数组，但前台需展示“暂未配置参与任务”
- `participantCount`、`entryCount` 当活动无参与数据时应为 `0`

### 5.2 奖品 Prize

字段：

- `id`
- `activityId`
- `level`
- `name`
- `quantity`
- `awarded`
- `type`
- `deletable`

来源：

- 主数据来源：`data/store.json > prizes`
- 接口来源：`GET /api/activities/:id/prizes`

边界条件：

- `name` 必填
- `level` 当前后端默认按整数处理；UI 录入最小值为 `1`
- `quantity` 必须大于等于 `1`
- `level >= 99` 时默认视为“谢谢参与/参与奖”
- `deletable=false` 的奖品不允许删除

### 5.3 参与记录 Entry

字段：

- `id`
- `activityId`
- `userId`
- `nickname`
- `code`
- `obtainedAt`
- `source`
- `status`
- `prizeId`
- `prizeName`
- `isWinner`

来源：

- 主数据来源：`data/store.json > entries`
- 接口来源：`GET /api/entries`、`GET /api/winners`

边界条件：

- 同一用户允许存在多个 `code`
- `status` 当前原型使用：`待开奖/已开奖/已中奖`
- 未中奖时 `prizeId=null`，`prizeName` 可为空或显示“谢谢参与”
- 开奖后若中奖，需同步写入 `prizeId`、`prizeName`、`isWinner=true`

### 5.4 中奖干预日志 InterventionLog

字段：

- `id`
- `entryId`
- `action`
- `remark`
- `operator`
- `createdAt`

来源：

- 主数据来源：`data/store.json > interventionLogs`
- 接口来源：`GET /api/logs`

边界条件：

- 每次“改奖/取消中奖”必须写日志
- `remark` 默认允许为空，但后续正式版建议必填

## 6. 后台管理端需求

### 6.1 页面总则

- 所有后台页面均带左侧主导航
- 所有后台页面均带右侧悬浮导航，支持快速切换页面
- 数据优先来自本地接口，不再使用纯静态硬编码展示

---

### 6.2 仪表盘 `dashboard.html`

#### 页面目标

展示平台总体经营概览，帮助运营快速了解当前活动状态。

#### 页面字段说明

1. 进行中活动
   来源：`GET /api/dashboard > activeActivities`
   规则：统计 `status=进行中` 的活动数
   边界：无活动时显示 `0`
2. 总参与人数
   来源：`GET /api/dashboard > totalParticipants`
   规则：按 `entries.userId` 去重统计
   边界：无参与记录时显示 `0`
3. 总抽奖码
   来源：`GET /api/dashboard > totalEntries`
   规则：统计参与记录条数
   边界：无参与记录时显示 `0`
4. 待开奖活动
   来源：`GET /api/dashboard > pendingDrawActivities`
   规则：统计 `status=待开奖` 的活动数
   边界：无待开奖活动时显示 `0`
5. 活动概览表
   来源：`GET /api/dashboard > activities[]`
   字段：`id/name/status/participantCount/entryCount/winnerCount`
   边界：无活动时表格展示空态

#### 边界条件

- 接口异常时提示错误弹窗
- 数值字段统一显示为千分位

---

### 6.3 活动管理 `activity-list.html`

#### 页面目标

展示活动列表并支持新建活动、进入编辑页。

#### 页面字段说明

1. 活动 ID
   来源：`GET /api/activities[].id`
2. 活动名称
   来源：`GET /api/activities[].name`
3. 活动时间
   来源：`startTime/endTime`
   规则：格式化后展示区间
4. 参与人数
   来源：`participantCount`
5. 状态
   来源：`status`
6. 开奖时间
   来源：`drawTime`
7. 编辑按钮
   来源：页面路由拼接 `/activity-edit.html?id={id}`

#### 新建活动字段

1. 活动名称输入框
   来源：前端本地输入 `activityNameInput`
   规则：为空时自动生成默认名称
2. 创建接口
   来源：`POST /api/activities`
   默认写入：`status=草稿`、默认时间、默认任务 `分享朋友圈`

#### 边界条件

- 活动名称为空时允许创建，但系统自动生成名称
- 当前原型未做去重校验，正式版建议活动名称支持重名但需有活动 ID 区分

---

### 6.4 活动编辑 `activity-edit.html`

#### 页面目标

完成单活动的完整编辑，包括活动基础信息、展示文案、任务和中奖策略配置。

#### 页面字段说明

1. 活动名称
   来源：`GET /api/activities/:id > name`
   保存：`PUT /api/activities/:id > name`
   边界：必填，空值禁止保存
2. 活动状态
   来源/保存：`status`
   可选值：`草稿/进行中/待开奖/已开奖/已结束`
3. 开始时间
   来源/保存：`startTime`
   规则：页面展示为 `datetime-local`，保存时转 ISO
4. 结束时间
   来源/保存：`endTime`
5. 开奖时间
   来源/保存：`drawTime`
6. 参与次数限制
   来源/保存：`joinLimit`
   可选值：`每天1次/总共1次/总共3次/无限制/自定义`
7. 副标题
   来源/保存：`subtitle`
8. 按钮文案
   来源/保存：`buttonText`
   边界：为空时后端回落默认值 `立即参与抽奖`
9. 活动说明
   来源/保存：`description`
   边界：允许为空
10. 参与任务
    来源/保存：`tasks`
    规则：前端通过中文逗号/英文逗号拆分成数组
    边界：允许为空数组；空时前端展示“暂未配置参与任务”
11. 人工干预中奖率
    来源/保存：`interventionRate`
    边界：前端限制 `0-100`；正式版后端也应强校验
12. 允许同一用户多次中奖
    来源/保存：`allowMultiWin`
    边界：布尔值
13. 活动概况卡
    来源：`participantCount/entryCount/stats.prizeCount/stats.waitingEntries`
14. 奖品池摘要
    来源：`prizes[]`
15. 最近参与记录
    来源：`recentEntries[]`
    规则：按 `obtainedAt` 倒序取最近 5 条

#### 边界条件

- `id` 不存在时返回“活动不存在”
- 保存时若名称为空，返回“活动名称不能为空”
- 当前原型未校验 `startTime <= endTime <= drawTime`，正式版建议强制校验：
  - `startTime < endTime`
  - `drawTime >= endTime`
- 当前原型未校验“进行中状态”必须满足当前时间在活动周期内，正式版建议补充

---

### 6.5 奖品管理 `prize-manage.html`

#### 页面目标

查看活动奖品池，支持新增和删除奖品。

#### 页面字段说明

1. 奖品名称输入
   来源：前端输入 `prizeNameInput`
   保存：`POST /api/activities/{activityId}/prizes`
   边界：必填
2. 奖项等级
   来源：前端输入 `prizeLevelInput`
   默认值：`4`
   边界：最小值 `1`
3. 奖品数量
   来源：前端输入 `prizeQuantityInput`
   默认值：`10`
   边界：最小值 `1`
4. 奖品列表
   来源：`GET /api/activities/{activityId}/prizes`
   展示字段：`level/name/quantity/awarded/deletable`
5. 删除按钮
   来源：`DELETE /api/prizes/:id`
   边界：`deletable=false` 不展示删除按钮

#### 边界条件

- 奖品名称为空时前端提示，不发请求
- 删除不存在奖品时返回“奖品不存在”
- 删除不可删奖品时返回“该奖品不允许删除”

---

### 6.6 参与记录 `entry-list.html`

#### 页面目标

查看指定活动下用户参与记录与抽奖码发放情况。

#### 页面字段说明

1. 用户 ID
   来源：`GET /api/entries > userId`
2. 抽奖码
   来源：`code`
3. 获得时间
   来源：`obtainedAtLabel`
4. 获取方式
   来源：`source`
5. 状态
   来源：`status`
6. 奖品结果
   来源：`prizeName`

#### 边界条件

- 默认查询 `activityId=1001`
- 无记录时展示空表
- 未开奖记录 `prizeName` 显示 `-` 或空

---

### 6.7 开奖管理 `draw-manage.html`

#### 页面目标

查看各活动开奖状态，并对待开奖活动执行统一开奖。

#### 页面字段说明

1. 活动 ID/名称/状态
   来源：`GET /api/draws`
2. 待开奖记录
   来源：`pendingEntries`
   规则：统计该活动 `status=待开奖` 的参与记录条数
3. 开奖时间
   来源：`drawTime`
4. 立即开奖按钮
   来源：当 `pendingEntries > 0` 时显示
   执行接口：`POST /api/draws/:id/run`

#### 开奖规则

- 按奖项等级升序发奖
- 单奖项发奖数 = `quantity - 已有中奖占用数`
- 待开奖记录按当前数组顺序依次中奖
- 未命中奖项的记录写成：
  - `status=已开奖`
  - `isWinner=false`
  - `prizeName=谢谢参与`

#### 边界条件

- 活动不存在时返回“活动不存在”
- 无待开奖记录时不允许开奖
- 当前原型开奖算法非随机，正式版需改为可配置的随机/权重/防作弊策略

---

### 6.8 中奖干预 `winner-intervene.html`

#### 页面目标

在开奖后手动改奖或取消中奖，并形成操作日志。

#### 页面字段说明

1. 抽奖码
   来源：`GET /api/winners > code`
2. 用户昵称
   来源：`nickname`
3. 当前奖品
   来源：`prizeName`
4. 状态
   来源：`status`
5. 改奖按钮
   来源：前端从 `GET /api/activities/1001/prizes` 获取可选奖品缓存
   接口：`POST /api/winners/:entryId/intervene`
   请求字段：`action=改奖/prizeId/remark`
6. 取消中奖按钮
   接口：`POST /api/winners/:entryId/intervene`
   请求字段：`action=取消中奖/remark`

#### 边界条件

- 改奖时 `prizeId` 必须存在，否则返回“目标奖品不存在”
- 取消中奖后：
  - `isWinner=false`
  - `status=已开奖`
  - `prizeId=null`
  - `prizeName=谢谢参与`
- 每次干预必须写入日志
- 当前原型默认 `remark` 自动生成，正式版建议改为人工必填

---

### 6.9 数据统计 `statistics.html`

#### 页面目标

展示奖品发放分布和参与趋势，用于活动复盘。

#### 页面字段说明

1. 奖品发放统计图
   来源：`GET /api/statistics > prizeStats[]`
   字段：`label/value`
   规则：统计每个奖品已被命中的次数
2. 参与趋势图
   来源：`GET /api/statistics > trend[]`
   字段：`date/count`
   规则：按天聚合参与记录数

#### 边界条件

- 当前统计固定按 `activityId=1001` 聚合
- 无数据时图表应展示空数据集，不报错

## 7. 用户端 M 版需求

### 7.1 页面总则

- 页面需适配手机宽度，目标宽度 375-430px
- 顶部统一使用目录导航栏，支持多个页面切换
- 样式采用活动氛围感视觉，强调奖品和结果反馈

---

### 7.2 导航页 `m-index.html`

#### 页面目标

作为用户端原型目录与说明页，帮助评审快速浏览全部状态页。

#### 页面字段说明

- 页面目录：静态链接集合
- 体验说明：静态说明文案

#### 边界条件

- 当前页为原型说明页，不承载业务数据

---

### 7.3 活动列表页 `m-activity-list.html`

#### 页面目标

用户查看自己参加过的所有活动，点击活动进入对应详情页。

#### 页面字段说明

1. 累计参与活动
   来源：当前原型为静态值
   正式来源建议：按用户参与记录聚合活动数
2. 累计抽奖码
   来源：当前原型为静态值
   正式来源建议：按用户维度统计 `entries.code` 数量
3. 已中奖活动
   来源：当前原型为静态值
   正式来源建议：按用户维度统计有中奖记录的活动数
4. 活动卡片
   来源：当前原型为静态配置
   正式来源建议：
   - 活动名：`activities.name`
   - 状态：根据用户参与结果 + 活动状态综合计算
   - 我的抽奖码：按 `entries` 聚合
   - 开奖时间：`activities.drawTime`
   - 中奖号码：中奖记录中的 `code`

#### 边界条件

- 无参加过活动时展示空态和“去参加活动”入口
- 同一活动可存在多条抽奖码记录，但活动列表仅展示一张卡片

---

### 7.4 未参与页 `m-activity-new.html`

#### 页面目标

向未参与用户展示活动价值、奖品、任务与倒计时，引导立即参与。

#### 页面字段说明

1. 活动标题
   来源建议：`activities.subtitle/name`
2. 描述文案
   来源建议：`activities.description`
3. 倒计时
   来源建议：`activities.drawTime - 当前时间`
4. 已参与人数
   来源建议：`participantCount`
5. 累计抽奖码
   来源建议：`entryCount`
6. 开奖时间
   来源建议：`drawTime`
7. 奖品墙
   来源建议：`prizes[]`
8. 参与任务
   来源建议：`tasks[]`
9. 立即参与抽奖按钮
   来源建议：`buttonText`

#### 边界条件

- 活动未开始时按钮置灰并显示“即将开始”
- 活动已结束时不可参与，跳转结果页或空态页
- 奖品为空时仍允许展示活动说明，但需展示“奖品待公布”

---

### 7.5 已参与待开奖页 `m-activity-pending.html`

#### 页面目标

展示用户已获得的多个抽奖码，并鼓励继续完成任务获取更多号码。

#### 页面字段说明

1. 状态标签
   来源建议：用户维度活动状态 = `已参与且未开奖`
2. 我的抽奖码列表
   来源建议：当前用户在该活动下的 `entries[]`
   字段：`code/source/obtainedAt`
3. 倒计时
   来源建议：`drawTime - 当前时间`
4. 再拿一个抽奖码任务推荐
   来源建议：剩余可完成任务

#### 边界条件

- 同一活动允许展示多条抽奖码
- 若无抽奖码则不应进入该页，应回到未参与页
- 开奖时间到达后，应自动跳转结果页或刷新状态

---

### 7.6 开奖未中奖页 `m-activity-lost.html`

#### 页面目标

对未中奖用户做结果告知、情绪安抚与二次转化。

#### 页面字段说明

1. 结果状态
   来源建议：该活动下用户所有参与记录均未中奖
2. 本次参与号码
   来源建议：该用户该活动下所有 `entries.code`
3. 安慰奖励
   来源建议：活动配置或运营策略
4. 再抽一次按钮
   来源建议：跳转下一活动或当前活动的新一轮

#### 边界条件

- 若存在一条中奖记录，则不可进入未中奖页
- 安慰奖励为空时隐藏对应模块

---

### 7.7 已中奖页 `m-activity-won.html`

#### 页面目标

突出中奖结果，并引导用户进入兑奖流程。

#### 页面字段说明

1. 中奖状态
   来源建议：存在 `isWinner=true` 的参与记录
2. 奖品名称
   来源建议：中奖记录 `prizeName`
3. 中奖号码
   来源建议：中奖记录 `code`
4. 领奖截止时间
   来源建议：当前原型为静态文案
   正式版建议：活动配置新增 `redeemDeadline`
5. 立即兑换按钮
   来源建议：跳转兑奖页

#### 边界条件

- 同活动多次中奖时，正式版需定义：
  - 展示最高奖
  - 或展示全部中奖项
- 奖品为虚拟奖时，按钮文案应改为“立即领取”或“查看券码”

---

### 7.8 中奖记录页 `m-records.html`

#### 页面目标

展示用户所有中奖记录及领奖/发货进度。

#### 页面字段说明

1. 累计中奖
   来源建议：用户全部中奖记录数
2. 待兑换
   来源建议：中奖且未完成兑奖的记录数
3. 已发放
   来源建议：已到账或已发货记录数
4. 记录列表
   来源建议：用户中奖历史
   字段：活动名、奖品名、中奖码、开奖时间、物流/到账状态

#### 边界条件

- 无中奖记录时展示空态
- 需区分：
  - 待兑换
  - 已发放
  - 已签收
  - 已到账

---

### 7.9 奖品兑换页 `m-redeem.html`

#### 页面目标

承接中奖后的领奖信息收集与兑奖流程说明。

#### 页面字段说明

1. 当前待兑换奖品
   来源建议：当前中奖记录
2. 中奖抽奖码
   来源建议：当前中奖记录 `code`
3. 领奖截止时间
   来源建议：活动/奖品兑奖截止配置
4. 收件人
   来源：用户输入
5. 手机号
   来源：用户输入
6. 详细地址
   来源：用户输入
7. 提交兑奖信息按钮
   来源：提交兑奖接口
8. 其他兑奖方式说明
   来源：静态规则或奖品类型规则

#### 边界条件

- 实物奖需填写完整地址
- 虚拟奖品无需地址，应隐藏地址表单
- 手机号需满足格式校验
- 截止时间已过则不可提交

## 8. API 需求汇总

当前已有接口：

- `GET /api/health`
- `GET /api/state`
- `GET /api/dashboard`
- `GET /api/activities`
- `POST /api/activities`
- `GET /api/activities/:id`
- `PUT /api/activities/:id`
- `GET /api/activities/:id/prizes`
- `POST /api/activities/:id/prizes`
- `DELETE /api/prizes/:id`
- `GET /api/entries?activityId=`
- `GET /api/draws`
- `POST /api/draws/:id/run`
- `GET /api/winners?activityId=`
- `POST /api/winners/:entryId/intervene`
- `GET /api/logs`
- `GET /api/statistics`

建议补充接口：

- 用户端活动列表接口：按用户聚合参与过的活动
- 用户端活动详情接口：按用户 + 活动返回状态页所需数据
- 用户兑奖提交接口
- 用户中奖记录接口
- 奖励发放状态接口

## 9. 关键边界与风控建议

### 9.1 活动配置

- 必须校验时间先后关系
- 状态切换应与时间规则联动
- 活动发布后是否允许改时间，需要明确版本策略

### 9.2 抽奖与中奖

- 当前开奖算法非随机，仅适合原型验证
- 正式版必须支持随机抽取、防重复中奖、防刷码
- `allowMultiWin=false` 时需防止同用户多条记录多次中奖

### 9.3 兑奖

- 实物奖需要地址审核
- 虚拟奖需即时到账或异步通知
- 过期未兑需自动失效并留日志

### 9.4 用户体验

- 用户端不同状态页应由后端统一计算，不建议前端自行判断
- 活动列表、中奖记录、兑奖页应支持登录态校验

## 10. 非功能要求

- 后台与用户端均支持移动端或窄屏查看
- 接口返回需具备基础错误码与错误文案
- 所有写操作需可追溯，关键操作需写日志
- 局域网环境下原型应支持多设备访问

## 11. 当前原型与正式版差异

当前原型特征：

- 数据保存在本地 `store.json`
- 用户端大部分页面仍为静态演示
- 开奖逻辑为顺序分配，不是真实抽奖
- 兑奖页未接后端提交

正式版目标：

- 后台与用户端全面数据化
- 统一用户身份、活动状态、中奖状态计算
- 增加真实抽奖策略、发奖链路、风控和日志审计

## 12. 附录：页面清单

后台页面：

- `dashboard.html`
- `activity-list.html`
- `activity-edit.html`
- `prize-manage.html`
- `entry-list.html`
- `draw-manage.html`
- `winner-intervene.html`
- `statistics.html`

用户端页面：

- `m-index.html`
- `m-activity-list.html`
- `m-activity-new.html`
- `m-activity-pending.html`
- `m-activity-lost.html`
- `m-activity-won.html`
- `m-records.html`
- `m-redeem.html`

