# 合约档案智能检索系统 - 前端

基于 React 18 + TypeScript + Vite + Ant Design 构建的现代化前端应用。

## 技术栈

- **React 18** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design** - UI组件库
- **Redux Toolkit** - 状态管理
- **React Router** - 路由管理
- **Styled Components** - CSS-in-JS
- **Axios** - HTTP客户端
- **Day.js** - 日期处理

## 项目结构

```
src/
├── components/          # 通用组件
│   ├── Layout/         # 布局组件
│   ├── Loading/        # 加载组件
│   └── ErrorBoundary/  # 错误边界
├── pages/              # 页面组件
│   ├── Home/           # 首页
│   ├── Search/         # 搜索页面
│   ├── Upload/         # 上传页面
│   ├── Statistics/     # 统计页面
│   └── Settings/       # 设置页面
├── store/              # Redux状态管理
│   ├── slices/         # Redux切片
│   └── index.ts        # Store配置
├── services/           # API服务
├── types/              # TypeScript类型定义
├── App.tsx             # 主应用组件
├── main.tsx            # 应用入口
└── index.css           # 全局样式
```

## 功能特性

### 🏠 首页
- 系统概览和统计数据
- 快速操作入口
- 最近搜索历史
- 实时活动动态

### 🔍 智能搜索
- 自然语言搜索
- 关键词搜索
- 高级筛选功能
- 搜索结果高亮
- 文档预览和下载

### 📤 文档上传
- 拖拽上传支持
- 多文件批量上传
- 实时上传进度
- 文件格式验证
- 合同信息填写

### 📊 使用统计
- 数据概览仪表板
- 上传和搜索趋势
- 合同类型分布
- 热门搜索统计
- 实时活动监控

### ⚙️ 系统设置
- 基本系统配置
- 安全策略设置
- 数据管理功能
- 用户权限管理

## 开发指南

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## API集成

项目已配置API代理，开发环境下所有 `/api` 请求会被代理到 `http://localhost:8000`。

### API服务配置

在 `src/services/api.ts` 中配置了以下API：

- 自然语言搜索
- 关键词搜索
- 文档上传
- 文档下载
- 统计数据获取

### Mock数据

当后端API不可用时，系统会自动使用Mock数据，确保前端开发不受阻塞。

## 状态管理

使用 Redux Toolkit 进行状态管理，包含以下切片：

- **contractSlice** - 合同相关状态
- **searchSlice** - 搜索相关状态
- **uiSlice** - UI相关状态

## 样式系统

### 全局样式
- 基于 Ant Design 主题
- 自定义CSS变量
- 响应式设计支持

### 组件样式
- Styled Components 用于组件级样式
- 支持主题切换
- 统一的设计规范

## 响应式设计

项目采用移动优先的响应式设计：

- **xs**: < 576px (手机)
- **sm**: ≥ 576px (大手机)
- **md**: ≥ 768px (平板)
- **lg**: ≥ 992px (桌面)
- **xl**: ≥ 1200px (大桌面)

## 性能优化

- 代码分割和懒加载
- 图片优化和压缩
- 缓存策略配置
- Bundle分析和优化

## 浏览器支持

- Chrome >= 88
- Firefox >= 85
- Safari >= 14
- Edge >= 88

## 部署说明

### 环境变量

创建 `.env.production` 文件：

```env
VITE_API_BASE_URL=https://your-api-domain.com
VITE_APP_TITLE=合约档案智能检索系统
```

### 构建配置

项目已配置自动构建优化：

- 代码压缩和混淆
- 资源文件优化
- 缓存策略配置
- CDN资源配置

## 开发规范

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 统一的代码格式化

### 组件规范
- 函数式组件优先
- Props类型定义
- 组件文档注释

### 提交规范
- 使用语义化提交信息
- 代码审查流程
- 自动化测试

## 故障排除

### 常见问题

1. **依赖安装失败**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **端口冲突**
   ```bash
   npm run dev -- --port 3001
   ```

3. **API连接失败**
   - 检查后端服务是否启动
   - 确认API代理配置
   - 查看网络请求日志

### 调试工具

- React Developer Tools
- Redux DevTools
- Network面板
- Console日志

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发团队。