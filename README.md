# AI Design · 智能营销海报工作台

**图片生图 / 上传参考图 → 多模态 Mastra Agent 重建可复用 HTML 模板 → Excel 两列自动填充 → 导出 PNG**。

轻量、单实例、内网自用。无需 Canva 式拖拽编辑器。

## 实际功能

| 页面 | 功能 |
| --- | --- |
| AI 创作工作台 `/create` | 一个 Mastra 设计 Agent 聊天操作生图、图片转 HTML、自然语言修改与保存模板；左侧会话历史、右侧真实预览，刷新可恢复当前设计 |
| 模板库 `/templates` | 封面浏览、一键使用、复制、重命名、自然语言修改、删除 |
| 海报生成 `/posters` | Excel 两列自动识别并持久保存；搜索和排序最多 6 个模型；设置标题/二维码；渲染预览、导出 PNG、历史重新下载 |
| 模型配置 `/settings` | 独立配置理解/图片模型 Base URL、Model ID、API Key；测试真实模型能力 |

### 固定 Excel 格式

**仅两列**，第一行必须是下方表头，文件类型 `.xlsx`。页面可直接下载带示例数据的标准模板。

| 模型名称 | 折扣 |
| --- | --- |
| deepseek-v4.1-flash | 4折 |
| kimi-k3 | 5.7折 |
| glm-5.3 | 6折 |

模型名称和折扣都是原样文字，**不计算成本、售价或任何折扣公式**。新导入会替换当前已保存的模型表；不清空旧海报历史。

新生成的 HTML 模板统一有 `{{#each items}}`，每项是 `{{name}}` 和 `{{discount}}`；标题、活动描述、二维码仍由页面手动填写。

## 快速启动

需要 Node.js 22+、npm、Chromium：

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

打开 http://localhost:3000 ，先在「模型设置」中分别保存并测试模型。然后打开「AI 创作工作台」，输入“帮我生成一张暗黑科技风的折扣海报并转成模板”，或上传参考图让 Agent 转换，满意后说“保存为模板”，最后进入「海报生成」导入两列 Excel。

正式运行：

```bash
npm run build
npm run start
```

### Docker Compose（推荐内网部署）

```bash
docker compose up -d --build
```

默认监听服务器的 `3000` 端口。请通过内网地址访问，并用机器防火墙或内网规则限制非可信访问；**项目没有用户登录功能，不要直接暴露公网**。

Docker 下 `./data/` 映射至容器 `/app/data`。修改镜像或重建容器不会移除该目录。

### 数据持久化和备份

服务器文件目录 `AI_DESIGN_DATA_DIR`（默认 `./data`）保存：

- `ai-design.sqlite`：模型配置、Excel 模型折扣、模板索引、海报导出记录、模型对话记录。SQLite 使用 WAL 日志。
- `templates/`：HTML、CSS、manifest、缩略图。
- `drafts/`：尚未保存的模板草稿。
- `references/`：上传图和生图结果。
- `exports/`：已导出的海报 PNG。

容器使用数据库和目录的**同一个持久化挂载**。不要只备份 SQLite 而丢失模板和图片。

```bash
# 本机运行时，创建一致的 SQLite 快照并复制图片、模板到备份目录
npm run backup

# Docker Compose 使用时，在容器中创建备份，然后拷贝到别的机器/硬盘
# 建议先将宿主机的 ./data 整体做定期快照，便于同机恢复
```

建议把备份目录另行复制到不同磁盘/机器。备份脚本只备份，不自动删除历史数据。

## 模型接口约定

- **多模态理解**：OpenAI Chat Completions 兼容接口，支持图片输入。图片转模板通过 Mastra Agent 和 Workflow 调用，模型返回标准 HTML/CSS/manifest JSON。
- **图片生成**：OpenAI 兼容图片生成接口；不是所有中转上游都支持这个接口。
- **对话式创作**：多模态理解模型通过 Mastra Tools 调用现有生图、转换、修改和保存流程；同一会话的消息与设计状态保存在 SQLite。
- 无 API Key 时仍可使用已经保存的模板、导入 Excel 和离线 PNG 渲染。AI 流程需要实际可用的上游模型。

AI 图片还原不是像素级复制。最终营销数据由程序填充，不由 AI 猜测数字。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

GitHub Actions 运行上述检查以及浏览器页面冒烟测试；实际上游 AI API 需要在设置页配置后再联调。

## 项目说明

- `src/app`：页面与 API
- `src/mastra`：Mastra 模板 Agent / Workflow
- `src/lib`：Excel 解析、Handlebars、SQLite、Playwright
- `scripts/backup.mjs`：手动备份
- `docs`：需求和技术文档
- `AGENTS.md`：开发约束，所有代码变更必须遵循

## 统一创作工作流

在 `/create` 与 Agent 多轮对话，上传图片或直接描述需求。Agent 根据意图调用 **generateImage → convertToTemplate → reviseTemplate → saveTemplate**（不需要每一步手动切页）。右侧实时展示参考图/HTML 预览；保存后出现「用 Excel 填充海报」入口。旧 `/chat` 自动跳转 `/create`，旧对话历史仍可在工作台查看。

无实际模型密钥的 CI 使用一个本地 OpenAI 兼容测试端点替代收费模型，对 Mastra 工具执行、模板渲染、保存及刷新恢复做真实浏览器验收；实际模型兼容性需要用户配置后验证。
