# Magic图片存储路径重构

## 问题描述
Magic生成的图片当前存储在 `user_data/` 根目录下，需要改为按用户邮箱分目录存储，即 `user_data/users/{user_email}/files/` 路径，与chat接口保持一致。

## 目标路径结构
```
user_data/
├── users/
│   ├── {user_email}/          # 如：user@example.com -> user_example_com
│   │   └── files/
│   │       ├── image1.png     # Magic生成的图片
│   │       ├── image2.jpg     # Chat生成的图片
│   │       └── ...
│   └── {user_id}/            # 向后兼容
│       └── files/
├── anonymous/                # 匿名用户
│   └── files/
└── files/                    # 旧版文件目录（向后兼容）
```

## 修改内容

### 1. 核心函数签名更新

#### `get_user_files_dir` 函数
- **文件**: `services/config_service.py:208`
- **修改**: 参数类型从 `str = None` 改为 `Optional[str] = None`

#### Magic服务方法签名
- **`generate_magic_image`**: 添加 `user_info` 参数
- **`generate_image`**: 添加 `user_info` 参数
- **`create_local_magic_response`**: 添加 `user_info` 参数

### 2. 存储逻辑修改

#### `tuzi_llm_service.py`
**位置**: `services/new_chat/tuzi_llm_service.py`

**修改前**:
```python
user_data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'user_data')
os.makedirs(user_data_dir, exist_ok=True)
file_path = os.path.join(user_data_dir, f"{file_id}.{image_format}")
```

**修改后**:
```python
from services.config_service import get_user_files_dir

user_email = user_info.get('email') if user_info else None
user_id = user_info.get('uuid') if user_info else None
user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
file_path = os.path.join(user_files_dir, f"{file_id}.{image_format}")
```

#### `magic_draw_service.py`
**位置**: `services/magic_draw_service.py`

应用了相同的存储逻辑修改。

### 3. 调用链更新

#### `local_magic_agent.py`
- 添加 `user_info` 参数传递
- 更新方法调用以传递用户信息

#### `magic_service.py`
- `_process_magic_generation` 函数添加 `user_info` 参数
- `handle_magic` 函数从请求数据中提取用户信息

## 用户信息传递流程

```
chat_router.py (/magic endpoint)
  ↓ 添加user_info到data
magic_service.py (handle_magic)
  ↓ 提取user_info
_process_magic_generation
  ↓ 传递user_info
create_local_magic_response
  ↓ 传递user_info
generate_magic_image / generate_image
  ↓ 使用user_info获取目录
get_user_files_dir
  ↓ 返回用户特定目录
user_data/users/{email}/files/
```

## 向后兼容性

1. **匿名用户**: 自动使用 `user_data/users/anonymous/files/`
2. **无邮箱用户**: 使用用户ID: `user_data/users/{user_id}/files/`
3. **旧文件**: 保留在 `user_data/files/` 中，文件访问API支持向后兼容

## 部署影响

### 无需数据迁移
- 现有文件保持原位置不变
- 新生成的magic图片将存储在新的用户目录结构中
- 文件访问API已支持多目录查找

### 存储空间优化
- 用户文件按邮箱分目录组织
- 便于用户数据管理和清理
- 支持用户级别的存储配额管理

## 测试验证

### 1. 匿名用户测试
```bash
# 预期路径: user_data/users/anonymous/files/
```

### 2. 登录用户测试
```bash
# 用户邮箱: user@example.com
# 预期路径: user_data/users/user_example_com/files/
```

### 3. 向后兼容测试
```bash
# 确认旧文件仍可正常访问
```

## 修改的文件列表

1. `services/config_service.py` - 函数签名类型修复
2. `services/new_chat/tuzi_llm_service.py` - 存储逻辑重构
3. `services/magic_draw_service.py` - 存储逻辑重构
4. `services/OpenAIAgents_service/local_magic_agent.py` - 用户信息传递
5. `services/magic_service.py` - 用户信息提取和传递

## 注意事项

1. **用户信息依赖**: Magic生成现在依赖于正确的用户信息传递
2. **目录权限**: 确保应用有权限在用户目录下创建文件
3. **磁盘空间**: 用户目录可能分散在不同位置，注意磁盘使用监控