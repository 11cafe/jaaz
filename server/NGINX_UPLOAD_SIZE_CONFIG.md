# Nginx 上传文件大小配置

## 问题
当用户上传大图片时出现 `413 Request Entity Too Large` 错误，这是由于nginx的默认上传大小限制（通常为1MB）导致的。

## 错误信息
```
413 Request Entity Too Large
nginx/1.24.0 (Ubuntu)
```

## 解决方案

### 1. Nginx 配置修改

在nginx配置文件中添加或修改以下配置：

#### 方法1: 在 http 块中（全局设置）
```nginx
http {
    # 设置最大上传文件大小为 50MB
    client_max_body_size 50M;
    
    # 可选：设置缓冲区大小
    client_body_buffer_size 128k;
    client_body_timeout 60s;
}
```

#### 方法2: 在 server 块中（特定域名）
```nginx
server {
    listen 443 ssl;
    server_name www.magicart.cc;
    
    # 设置最大上传文件大小为 50MB
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 可选：针对特定API路径设置更大的限制
        # client_max_body_size 100M;
    }
}
```

#### 方法3: 针对特定路径（推荐）
```nginx
server {
    listen 443 ssl;
    server_name www.magicart.cc;
    
    # 默认限制
    client_max_body_size 10M;
    
    # 针对图片上传API设置更大限制
    location /api/image/ {
        client_max_body_size 50M;
        proxy_pass http://backend;
    }
    
    # 针对魔法生成API设置更大限制
    location /api/magic/ {
        client_max_body_size 50M;
        proxy_pass http://backend;
    }
}
```

### 2. 重启 Nginx
```bash
# 检查配置语法
sudo nginx -t

# 重新加载配置
sudo nginx -s reload

# 或者重启nginx服务
sudo systemctl restart nginx
```

### 3. FastAPI 配置
代码中已添加中间件来处理文件大小限制：
- FastAPI层限制：50MB
- Nginx层限制：需要配置

## 推荐配置

### 生产环境配置
```nginx
server {
    listen 443 ssl http2;
    server_name www.magicart.cc;
    
    # SSL配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 基础上传限制
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # 针对图片相关API设置更大限制
    location ~ ^/api/(image|magic|chat) {
        client_max_body_size 50M;
        client_body_timeout 120s;
        
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增加超时时间
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
    
    # 其他静态资源
    location / {
        try_files $uri $uri/ /index.html;
        root /path/to/frontend/dist;
    }
}
```

## 验证配置

### 1. 检查nginx配置
```bash
curl -I https://www.magicart.cc/api/image/upload
```

### 2. 测试文件上传
使用大于默认限制的图片进行测试，确认不再出现413错误。

### 3. 监控日志
```bash
# 检查nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 检查access日志
sudo tail -f /var/log/nginx/access.log
```

## 故障排除

1. **配置未生效**：确保重启了nginx服务
2. **仍有413错误**：检查是否有多层代理，每层都需要配置
3. **FastAPI报错**：检查应用层的文件大小限制

## 注意事项

1. **安全考虑**：不要设置过大的上传限制，避免恶意攻击
2. **磁盘空间**：确保服务器有足够空间存储上传文件
3. **网络带宽**：考虑用户上传大文件的网络条件
4. **负载均衡**：如果使用负载均衡器，也需要相应配置