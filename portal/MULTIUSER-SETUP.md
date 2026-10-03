# 五人共享工作区：启用与运行

## 已实现的结构

- 每个人使用自己的 Google 账号登录，个人登录只申请 `openid email profile`。
- 一个公司工作区，最多五个有效成员。成员可操作业务数据；管理员还可以管理成员及公司的 Google 连接。
- 登录会话独立保存，七天到期。退出只撤销当前会话；禁用成员或更改角色会撤销该成员全部会话。
- Google 身份使用签名验证、发行者与客户端验证、nonce、state、PKCE 和已验证邮箱检查。Google subject 首次绑定后不允许被其他 Google 身份接管。
- 公司的 Gmail / Drive / Forms 授权独立保存。成员登录不会覆盖公司授权；个人退出也不会停止后台收集。
- 原有 SQLite 和文件保留原位。公司工作区仍使用原公司邮箱作为存储键，不按个人邮箱创建新资料库。首次使用时固定公司邮箱，切换到其他公司邮箱会被拒绝；这是单公司部署，不是多租户平台。
- 公司授权断开后，已建立的公司本地资料仍可以读取。发送、同步等 Google 操作需要管理员重新授权同一公司邮箱。

## 首次设置

1. 先停止应用，备份完整 `.google-data`（包括数据库、WAL 文件、加密密钥与凭证）；需要保留 Demo 时也备份 `.demo-data`。不要单独复制运行中的 SQLite 主文件。
2. 在 `.env.local` 或服务环境中设置 `PORTAL_ADMIN_EMAIL` 为首位管理员自己的 Google 邮箱。仅在成员数据库为空时创建初始管理员；之后修改该环境变量不会改变已登记的管理员。
3. 配置 Google OAuth Web application 客户端：
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 用于公司授权，也可供个人登录复用。
   - 如希望登录与公司授权使用不同客户端，另设 `GOOGLE_LOGIN_CLIENT_ID` / `GOOGLE_LOGIN_CLIENT_SECRET`。
   - 已导入的公司 OAuth JSON 仍可复用，但需要为该客户端增加登录回调 URL。
4. 在 Google Cloud Console 为对应客户端登记精确回调 URL。例如本机测试：
   - `http://127.0.0.1:3000/api/auth/callback`：个人登录。
   - `http://127.0.0.1:3000/api/google/callback`：公司授权。
   - 生产环境将前缀替换为 `APP_ORIGIN`，如 `https://portal.example.com`。
   - 如 Google 项目仍处于 Testing，按项目配置把需要登录/授权的账号加入测试用户。
5. 启动应用，首位管理员在 `/login` 使用该 Google 邮箱登录。
6. 打开侧栏 **Manage members**，添加其余四人的邮箱。每个人打开相同地址，使用自己的 Google 账号登录。系统不会自动发邀请邮件。
7. 管理员进入 **Company Google connection**。已有公司连接可继续使用；没有连接时授权公司所使用的邮箱。其余成员无需授权个人 Gmail 或 Drive。

不存在公开注册入口，也不会把“第一个访问网站的人”自动设为管理员。没有配置初始管理员或登录客户端时，登录会提示联系服务器管理员。

## 多人修改的行为

业务写入继续在单个 Node.js 进程中排队。每次请求带上用户看到的工作区版本；后台在队列内读取最新数据并检查版本。其他人已修改资料时，旧版本请求会失败，要求刷新并重新查看，再提交。

目前使用保守的整个工作区版本检查：即使修改的是不同页面，也可能提示冲突。页面不会在填写期间自动换成新版本；使用侧栏 **Refresh workspace** 查看最新资料。刷新会清除未提交表单，应先复制需要保留的文字。后台自动收集仍继续运行；只更新轮询时间而没有改变业务数据时，不会提高版本。

现有排班、财务和员工分组的业务级校验继续保留。财务操作记录使用实际登录成员的邮箱作为操作者。

## Ubuntu 运行

使用支持 `node:sqlite` 的 Node.js（项目最低版本 22.13），一台服务器运行一个应用进程：

```sh
npm ci
npm run server:build
npm run server:start
```

`server:start` 监听 `0.0.0.0`，默认端口 3000，可用 `PORT` 修改。生产环境设置 `APP_ORIGIN=https://你的域名`，并通过反向代理或 Cloudflare Tunnel 提供 HTTPS，保留正确的 Host。不要将应用端口直接开放给所有外网地址。当前 `npm run start` 仍是原 Sites/Wrangler 预览工具，Ubuntu 请使用明确的 `server:*` 命令。

持久保存 `GOOGLE_DATA_DIR`，默认 `.google-data`。里面新增 `members.sqlite`，用于成员、会话、公司邮箱绑定和成员管理审计。备份应同时包含它与 `portal.sqlite`、加密密钥、凭证，备份副本放在服务器外。不要把生产数据打包进应用镜像。

当前没有部署 Docker、配置域名或操作 Google Cloud 项目；上述步骤是启用所需的外部配置。应用仍要求单进程，不能用 PM2 cluster、多副本容器或多个服务器共享此数据目录。

## 验证

```sh
npm run server:build
npm run verify:multiuser
node scripts/verify-google.mjs
node scripts/verify-employees.mjs
node scripts/verify-roster.mjs
node scripts/verify-finance.mjs
node scripts/verify-monthly-finance.mjs
```

多用户测试使用临时数据库、合成身份和本地签名的测试 JWT；HTTP 测试会自动启动隔离实例。真实 Google 登录、公司的 Gmail/Drive 授权和五位成员的实际操作，需要在配置完成后进行一次验收。

官方协议参考：[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)。
