# 前端HTTPS混合内容错误修复

## 问题描述
线上环境出现混合内容错误：
```
Mixed Content: The page at 'https://www.magicart.cc/canvas/...' was loaded over HTTPS, 
but requested an insecure resource 'http://www.magicart.cc/api/billing/getBalance'. 
This request has been blocked; the content must be served over HTTPS.
```

## 根本原因
前端 `src/constants.ts` 文件中硬编码了开发环境的HTTP地址：
```javascript
export const BASE_API_URL = 'http://localhost:8000'  // ❌ 错误：硬编码HTTP
```

正确的环境检测配置被注释掉了。

## 修复方案

### 修复内容
将 `src/constants.ts` 中的配置修改为：

**修复前：**
```javascript
// export const BASE_API_URL = import.meta.env.PROD
//   ? 'https://www.magicart.cc'
//   : 'http://localhost:8000'

export const BASE_API_URL = 'http://localhost:8000'  // ❌ 硬编码
```

**修复后：**
```javascript
// 自动检测环境并使用正确的协议
export const BASE_API_URL = import.meta.env.PROD
  ? 'https://www.magicart.cc'      // ✅ 生产环境使用HTTPS
  : 'http://localhost:8000'        // ✅ 开发环境使用HTTP
```

### 其他配置验证

#### Socket连接配置（已确认正确）
`src/contexts/socket.tsx` 中的配置是正确的：
```javascript
serverUrl:
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'      // 开发环境
    : window.location.origin,      // 生产环境自动使用当前协议(HTTPS)
```

## 环境检测机制

### Vite 环境变量
- `import.meta.env.PROD`: 生产构建时为 `true`
- `import.meta.env.DEV`: 开发环境时为 `true`

### 构建环境
- **开发环境** (`npm run dev`): 使用 `http://localhost:8000`
- **生产环境** (`npm run build`): 使用 `https://www.magicart.cc`

## 部署验证

### 1. 构建验证
```bash
# 构建生产版本
npm run build

# 检查构建输出中的API配置
grep -r "BASE_API_URL" dist/
```

### 2. 运行时验证
在浏览器开发者工具中检查：
```javascript
// 在生产环境控制台中执行
console.log(window.location.origin)  // 应该是 https://www.magicart.cc
```

### 3. 网络请求验证
- 所有API请求应该使用 `https://www.magicart.cc/api/...`
- Socket连接应该使用 `wss://www.magicart.cc`
- 不应该再有HTTP请求

## 影响的功能

修复后以下功能的请求将使用正确协议：
- ✅ 账单查询 (`/api/billing/getBalance`)
- ✅ 用户认证 (`/api/auth/*`)
- ✅ 图片上传 (`/api/image/*`)
- ✅ 魔法生成 (`/api/magic/*`)
- ✅ Socket实时通信
- ✅ 所有其他API请求

## 部署步骤

1. **重新构建前端**：
   ```bash
   npm run build
   ```

2. **部署到生产环境**：
   将 `dist/` 目录部署到Web服务器

3. **验证修复**：
   - 访问 `https://www.magicart.cc`
   - 打开浏览器开发者工具
   - 确认没有混合内容错误
   - 测试API功能正常

## 预防措施

1. **代码审查**：确保不再硬编码HTTP地址
2. **环境变量**：使用环境检测而非硬编码
3. **测试覆盖**：添加环境配置的自动化测试

## 注意事项

- ⚠️ 确保生产环境的SSL证书正确配置
- ⚠️ 确保后端API支持HTTPS
- ⚠️ 确保WebSocket支持WSS协议
- ⚠️ 开发环境仍然使用HTTP（正常行为）