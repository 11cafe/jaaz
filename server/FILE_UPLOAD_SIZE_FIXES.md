# 文件上传大小限制修复总结

## 问题
线上用户上传大图片时出现 `413 Request Entity Too Large` 错误。

## 根本原因
1. **Nginx 限制**：默认 `client_max_body_size` 通常为1MB
2. **FastAPI 限制**：之前图片上传限制为3MB，不够用
3. **缺乏统一配置**：没有统一的文件大小限制策略

## 修复方案

### 1. FastAPI 层面修复

#### 主应用配置 (main.py)
- 添加文件大小检查中间件
- 设置50MB上传限制
- 提供友好的错误信息

#### 图片路由 (routers/image_router.py)
- 将默认大小限制从3MB增加到50MB
- 保持压缩逻辑不变

#### 聊天路由 (routers/chat_router.py)
- 添加魔法生成的错误处理
- 针对413错误提供特定错误信息

### 2. Nginx 层面配置

需要在nginx配置文件中添加：
```nginx
# 针对API路径设置50MB限制
location ~ ^/api/(image|magic|chat) {
    client_max_body_size 50M;
    client_body_timeout 120s;
    # ... 其他配置
}
```

## 修改的文件

### 1. main.py
- 添加文件大小检查中间件
- 50MB限制，超出时返回413错误

### 2. routers/image_router.py
- 默认上传限制：3MB → 50MB

### 3. routers/chat_router.py
- 添加魔法生成错误处理
- 导入 HTTPException
- 特殊处理413错误

### 4. 新增配置文档
- `NGINX_UPLOAD_SIZE_CONFIG.md` - Nginx配置详细说明
- `FILE_UPLOAD_SIZE_FIXES.md` - 修复总结

## 部署要求

### 1. 应用层（已完成）
代码修改已完成，重启FastAPI应用即可生效。

### 2. Nginx 层（需要运维配置）
需要在nginx配置文件中添加：

```nginx
server {
    listen 443 ssl;
    server_name www.magicart.cc;
    
    # 针对API设置大文件上传限制
    location ~ ^/api/(image|magic|chat) {
        client_max_body_size 50M;
        client_body_timeout 120s;
        
        proxy_pass http://127.0.0.1:8000;
        # ... 其他代理配置
    }
    
    # 其他路径保持默认限制
    location / {
        client_max_body_size 10M;
        # ... 其他配置
    }
}
```

然后重启nginx：
```bash
sudo nginx -t && sudo nginx -s reload
```

## 验证方法

### 1. 应用层验证
```bash
# 检查应用启动日志
# 应该能看到中间件加载信息
```

### 2. Nginx 验证
```bash
# 测试配置语法
sudo nginx -t

# 检查nginx进程
sudo systemctl status nginx
```

### 3. 功能验证
- 上传大于3MB但小于50MB的图片
- 确认不再出现413错误
- 确认图片能正常显示

## 监控建议

1. **错误监控**：监控413错误频率
2. **性能监控**：关注大文件上传的响应时间
3. **存储监控**：确保磁盘空间充足

## 安全考虑

1. **大小限制**：50MB是合理的平衡点
2. **类型检查**：保持现有的图片格式验证
3. **频率限制**：考虑添加上传频率限制
4. **存储清理**：定期清理临时文件