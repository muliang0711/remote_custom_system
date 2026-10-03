# Hiring Forms → SQLite + Google Drive 设计

状态：设计草案，尚未接通或修改现有系统、Google Forms、Drive 或生产数据库。

## 存储边界

沿用项目的 `portal/lib/people-db.ts` 和现有 SQLite。Drive 保存上传的原始文件和生成的 PDF；SQLite 是结构化档案、流程状态、文件索引的主数据源。档案页面从 SQLite 读取，按 Drive ID 打开文件，不需要每次搜索整个 Drive。

现有 `person` 保存姓名、email、电话；`hiring_candidate` 保存面试、试工、职位和 assignment 关联；`official_employee`、`recruitment_history` 保留现有转员工流程。新增表统一关联稳定的 `(account_id, person_id)`，候选人转成员工后附件不会丢失。不以姓名、电话或 passport 编号作为主键。

附带的 `schema.sql` 是新增表草案，供迁移实现时使用，不能直接当作完整生产迁移执行。

## 两份表单与字段

|用途|Form ID|触发阶段|
|---|---|---|
|Acknowledgement|`1mGcegGH3SzgJ18FY14g4XLk4E9l_A4I1igLxq_WL9wo`|面试通过后|
|Employee Detail|`1g20kddHFApBjgsjU3srmi_u_br7hza2P2w4LUYMZDww`|试工通过后|

映射在首次接通时读取真实题目 ID，再写入 `hiring_form.field_map_json`。目前已查看题目文字，但没有读取 API question ID；不得凭空填写。API question ID 与 Apps Script item ID 不能假设相同。本方案统一使用 Forms REST API 的答案及 question ID。

|题目|存储目标|
|---|---|
|Full legal name / Full Name (as per ID)|`person.name`；改名或冲突进入复核|
|系统收集的 respondent email|用于校验 assignment 的收件人身份|
|Employee Detail 的 Email Address|`candidate_profile.contact_email`，不覆盖用于身份匹配的 `person.email`|
|Contact Number|`person.phone`，字符串，保留国家码|
|Nickname / Date of Birth / Residential Address|`candidate_profile.nickname / date_of_birth / residential_address`|
|Emergency Contact Name / Number / Relationship|`candidate_profile` 对应紧急联系人字段|
|Visa work right and restriction|`candidate_profile.visa_work_rights_text`，保留原文，不自动决定录用|
|Position applied for / Position|现有候选人 position，Floor Allrounder 与 FOH / Waitstaff 映射为 FOH；Kitchen Allrounder 与 Kitchen Hand / Kitchen allrounder 映射为 Kitchen；保留原答案|
|Date of form / 声明姓名 / Date|`form_submission.answers_json`，随提交归档；姓名填写不当作手写签名|
|Tax File Number|`payroll_detail.tfn`；填写 TBC 时保存为 NULL，`tfn_status=pending`|
|Bank Account Name / BSB Number / Account Number|`payroll_detail`，全部字符串，保留前导零|
|Compulsory Superannuation / Fund Name / USI / Membership Number|`payroll_detail` 对应字段；YES/NO 同时选中进入复核|
|Start Working Date / Trial Date|`candidate_profile.reported_work_or_trial_date`，暂不猜测属于哪个日期；系统的 trialAt 保持独立|
|Passport / Visa / Resume 上传|每个文件一条 `candidate_document` 记录|
|资料正确确认|保存提交原文；通过校验后才能完成 Employee Detail|

“来自哪里”尚不确定是国籍、居住地或招聘渠道。预留独立的 `country_of_origin`、`recruitment_source`，不从姓名、护照或住址推断。

## 最小接收流程

1. 保留目前管理员创建候选人及发送 assignment 的方式。面试和试工结果仍由管理员操作。
2. 在两个 Form 安装 Apps Script 的可安装提交触发器。只发送 `formId` 和 `responseId` 通知到服务端，不在 webhook 里发送银行、税号或附件内容。
3. 服务端验证请求签名，按配置确定 account；持久化 `form_ingest_job` 后返回 202。后台任务用现有 Google OAuth 从 Forms API 读取完整响应、提交时间、verified respondent email 和文件答案。
4. 使用 account + form + verified email + 已发送 assignment + 时间范围匹配；必须且只能匹配一个。未匹配、多个匹配、身份冲突、过早提交或前置阶段不满足，保存为 `needs_review`，不新建候选人、不标记完成。未来若增加预填关联 token，它只是查找辅助，不能替代身份校验。
5. 按 `formId + responseId + lastSubmittedTime` 去重。在 SQLite 事务中保存原始答案、字段更新和文件处理任务。相同版本重复通知不重复写入；新版本另存一条 submission。比最新已应用版本更旧的响应不覆盖档案；已完成 assignment 的额外提交先复核。
6. 文件 worker 验证 Drive 元数据和访问权限，记录真实 MIME 类型、文件名和 ID。上传件已在 Drive 时先关联原件，不重复复制或强制转 PDF。图片也可作为附件，不能一律标成 PDF。
7. 可生成每次提交的 PDF 存档，索引类型为 acknowledgement_pdf 或 employee_detail_pdf。包含提交答案、提交时间及已保存的表单版本。若表单结构在提交前后有变化且版本无法确认，进入复核，不声称证明了当时的声明内容。
8. 附件处理独立重试，不因网络错误丢失已保存答案。显示“资料已收到／附件处理中”。要求的档案全部就绪才将 assignment 标记 Completed；最终仍沿用现有“Ready for HR confirmation”，不自动转正式员工。

表单配置必须验证 Verified email。此前浏览器看到 Employee Detail 是输入 email 的提示，Acknowledgement 是自动收集 email；正式接通必须通过 API 确认，不能假定两者均 VERIFIED。若未满足，先显示配置待完成，不能关闭现有身份校验来迁就表单。

## API 合约（待实现）

### POST /api/integrations/google-forms/events

Header：`X-Integration-Key-Id`、`X-Event-Timestamp`（Unix 秒）、`X-Event-Nonce`、`X-Event-Signature`。

签名：HMAC-SHA256(secret, timestamp + "\n" + nonce + "\n" + 原始请求 body)，十六进制编码；恒定时间比较。secret 存服务端配置和 Apps Script Properties，不写入 SQLite 表或浏览器代码。key ID 绑定单个 account 和允许的 Form，客户端不能自行指定 account。timestamp 限制五分钟；nonce 持久化拒绝重放。限制 body 大小及速率。

```json
{"formId":"<configured-form-id>","responseId":"<google-response-id>"}
```

返回：202 = 已持久化排队（不代表处理完成）；401 = 签名或时间无效；403 = Form 不允许；409 = nonce 重放；503 = 未能持久化，发送端稍后以新 nonce 重试。同一个响应允许再次排队，具体版本在读取 Google 响应后去重。

### 档案与处理接口

|接口|用途|
|---|---|
|GET /api/hiring/:candidateId/profile|姓名、联络方式、补充资料、阶段、两份表单状态；不返回 payroll 或完整原始响应|
|GET /api/hiring/:candidateId/documents?type=resume|按人及文件类型查文件索引；分页|
|GET /api/hiring/:candidateId/payroll|仅 payroll/HR 权限读取薪资资料|
|GET /api/hiring/:candidateId/submissions|提交版本、处理状态及错误摘要；原答案需单独授权|
|POST /api/hiring/submissions/:id/retry|授权管理员重试失败任务，保持幂等|
|POST /api/hiring/submissions/:id/resolve|管理员确认匹配／字段冲突，记录操作者与原因，再交同一处理器|

所有接口从已认证会话确定 account，按 account + id 查询，不能仅凭 URL 中的 candidate ID 访问。跨 account 返回 404。复核后关联必须在同一 account 内。

## Drive 与 SQLite 一致性

Drive 与 SQLite 无法共享事务。先写持久化任务，worker 执行外部操作，再记录完成；不在 SQLite 写事务内等待 Drive。生成 PDF 使用稳定的 job key（account/form/response/version/type），写入 Drive appProperties，重试先查找已有产物并核对元数据，避免重复生成。

建议目录 `Hiring/<person_id>/`；文件位置变更不影响 Drive ID 索引。目录实际创建、移动或分享属于后续实现，本设计未执行。沿用已有访问权限；薪资 PDF 与普通 resume 应使用相应受限目录。数据库文件、备份和原始 answers JSON 都按 HR 资料限制读取，普通档案接口不返回敏感字段，日志不输出完整响应。

同一进程的 worker 串行处理；多进程时通过 SQLite 事务及 lease 原子领取。失败采用指数退避；超过次数进入人工处理。保留定时对账入口，通过 Forms API 分页补抓，使用相同去重逻辑，覆盖触发器漏发和响应编辑。部署阶段配置定时运行，本设计没有创建后台自动化。

## 必须先修正的现有存储行为

现有 `persist()` 每次清空 candidate/employee 表，并删除未在 recruitment_history 的 person 再插回。新表引用 person 后，该行为会外键失败或丢失关联。

实现时先改为 person 原位 UPSERT；候选人删除改为显式归档／删除流程，不能在普通保存中扫掉 person。外部提交使用按行事务写入，不能让陈旧的 LiveState 全量覆盖。通过行版本或统一数据库事务检测并发修改。保留旧 ID、account ID、assignment ID；新表不外键引用会被清空的 candidate 表。

SQLite 与后台 worker 必须部署在有持久磁盘的同一服务环境；现有本地数据库不能直接假定适合无持久文件系统的部署。

## 实施和验收顺序

1. 备份 SQLite，验证原位 UPSERT、候选人转员工、删除及回滚；新增表迁移使用版本记录。
2. 从真实表单读取 schema 和 email 设置，绑定 question ID，验证全部字段、必填项和附件限制。保存每一版本 schema。
3. 实现通知接收、完整响应读取、唯一匹配、答案映射；先用无真实个人资料的夹具验证。
4. 实现 Drive 索引、PDF 归档和失败重试，再接到档案 UI。
5. 测试重复通知、编辑重交、事件乱序、同名不同人、错误 email、无匹配、跨 account、附件多文件、Drive 403、TFN=TBC、BSB 前导零、日期歧义、并发修改、候选人转员工，以及 PDF 成功但数据库确认失败后的重试。
6. 配置真实触发器后进行受控端到端提交，确认档案可查、附件可打开、日志不泄露原始资料。

## 官方技术依据

- [Google Apps Script 可安装表单提交事件](https://developers.google.com/apps-script/guides/triggers/events)：Form 事件提供 response 对象。
- [FormResponse](https://developers.google.com/apps-script/reference/forms/form-response)：可读取 response ID。

待实施确认：服务端部署地址及持久磁盘；Google API 权限；真实题目 ID；“来自哪里”的业务含义；PDF 存档是否作为完成必需条件。其余按上述默认方案实施，不需要引入 MySQL 或额外数据库服务。
