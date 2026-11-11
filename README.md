# AI Design · 智能海报工作台

内部营销工具：**AI 生图 / 上传参考图 → Mastra 多模态 Agent 重建 HTML 模板 → Excel 数据填充 → PNG 导出 → 模板复用**。

## 功能

- 输入宣传主题，由独立图片生成模型制作参考海报；也可上传 PNG、JPG、WebP。
- Mastra Agent 根据参考图生成 HTML/CSS/Handlebars 模板、字段定义和截图预览，并根据渲染效果重新排版。
- 用自然语言再次修改生成中的草稿，或修改模板库中的已存模板。AI 产物只由模型重新生成，不手工改源文件。
- 模板保存、预览、复制、重命名、删除。
- 上传 `.xlsx`，查看工作表数据，选取/排序多行，将 Excel 列映射到模板的列表字段，填入标题等固定字段。
- Playwright Chromium 真实渲染，预览及高清 PNG 导出共用渲染实现；重复填充已保存模板不会请求 AI。
- 独立保存多模态理解模型与图片生成模型的 Base URL、Model ID 和 API Key，提供真实能力检测。

## 运行

需要 Node.js 22+、npm 和 Chromium。推荐在可信内部机器单实例运行。

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

浏览器打开 **http://localhost:3000**，先在「模型配置」中设置两种模型，然后到「AI 创作」生成或上传参考图。

API 配置保存在服务器本地 `data/ai-design.sqlite`；`data/` 不提交仓库。请勿把服务公开到不可信网络，目前没有登录和权限系统。

```bash
npm run typecheck
npm test
npm run build
npm run start
```

## 模型接口约定

- Vision：OpenAI Chat Completions 兼容接口（支持图片输入；设置页同时验证 tool calling）。
- Image：OpenAI 兼容图片生成接口；不是所有转发平台都实现同一路由。
- 由于模型输出不能保证任意海报的像素级重建，界面提供预览及自然语言调整；AI 应重建 HTML 实际文本，不使用包含原文字的整张参考图作背景。

仓库在 `examples/tech-poster/` 提供一个独立静态模板参考，方便理解 HTML、CSS 和 manifest 变量。

## 模板结构

`data/templates/<uuid>/` 包含：`template.html`、`style.css`、`manifest.json`、`thumbnail.png`。字段使用 `{{title}}`、`{{#each items}}{{name}}{{/each}}` 等 Handlebars 语法。模板为静态 HTML/CSS，不执行脚本。

示例中 `items.name`、`items.price` 是演示占位字段，不代表采购表价格列。Excel 的正式格式未确定前，用户手动选择字段映射；**系统不自动把采购成本作为售价，也不计算折扣或利润。**

## 项目结构

- `src/app`: 工作台页面和 API 路由
- `src/mastra`: 唯一模板 Agent 和框架 Workflow
- `src/lib`: Excel、模板渲染、SQLite、模型接入、浏览器截图
- `src/tests`: 真实业务测试（仅能力测试需要真实 AI API Key）
- `docs`: 已确认的需求和技术设计
- `AGENTS.md`: 必须遵循的开发规范

参阅 [需求设计](docs/requirements.md)、[技术设计](docs/technical-design.md) 和 [AGENTS.md](AGENTS.md)。
