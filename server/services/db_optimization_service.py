"""数据库优化服务 - 提供连接池和批量操作支持"""

import asyncio
import sqlite3
import json
import time
from typing import List, Dict, Any, Optional, AsyncContextManager
import aiosqlite
from contextlib import asynccontextmanager
from log import get_logger

logger = get_logger(__name__)


class DatabaseOptimizationService:
    """数据库优化服务 - 提供连接池、批量操作和性能监控"""
    
    def __init__(self, db_path: str, max_connections: int = 10):
        self.db_path = db_path
        self.max_connections = max_connections
        self._connection_pool: List[aiosqlite.Connection] = []
        self._pool_lock = asyncio.Lock()
        self._stats = {
            'queries_executed': 0,
            'connections_created': 0,
            'connections_reused': 0,
            'batch_operations': 0
        }
    
    async def _create_connection(self) -> aiosqlite.Connection:
        """创建新的数据库连接"""
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        # 启用性能优化设置
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA synchronous=NORMAL")
        await conn.execute("PRAGMA cache_size=10000")
        await conn.execute("PRAGMA temp_store=memory")
        await conn.commit()
        self._stats['connections_created'] += 1
        logger.info(f"[debug] 创建新数据库连接，总连接数: {self._stats['connections_created']}")
        return conn
    
    @asynccontextmanager
    async def get_connection(self) -> AsyncContextManager[aiosqlite.Connection]:
        """获取数据库连接（支持连接池）"""
        conn = None
        start_time = time.time()
        
        async with self._pool_lock:
            if self._connection_pool:
                conn = self._connection_pool.pop()
                self._stats['connections_reused'] += 1
                logger.debug(f"[debug] 复用连接池连接，剩余: {len(self._connection_pool)}")
            else:
                conn = await self._create_connection()
        
        try:
            # 检查连接是否有效
            await conn.execute("SELECT 1")
            yield conn
        except Exception as e:
            logger.error(f"[debug] 数据库连接错误: {e}")
            # 连接无效，创建新连接
            try:
                await conn.close()
            except:
                pass
            conn = await self._create_connection()
            yield conn
        finally:
            # 将连接返回到池中（如果池未满）
            async with self._pool_lock:
                if len(self._connection_pool) < self.max_connections:
                    self._connection_pool.append(conn)
                    logger.debug(f"[debug] 连接返回池中，池大小: {len(self._connection_pool)}")
                else:
                    await conn.close()
                    logger.debug(f"[debug] 连接池已满，关闭连接")
            
            logger.info(f"[debug] 数据库操作耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    async def execute_with_timing(self, conn: aiosqlite.Connection, query: str, params: tuple = ()) -> Any:
        """执行SQL查询并记录性能"""
        start_time = time.time()
        try:
            cursor = await conn.execute(query, params)
            self._stats['queries_executed'] += 1
            logger.debug(f"[debug] SQL执行耗时: {(time.time() - start_time) * 1000:.2f}ms")
            return cursor
        except Exception as e:
            logger.error(f"[debug] SQL执行失败: {e}, 查询: {query[:100]}...")
            raise
    
    async def batch_insert(self, table: str, columns: List[str], values_list: List[tuple]) -> None:
        """批量插入数据"""
        if not values_list:
            return
            
        start_time = time.time()
        placeholders = ', '.join(['?' for _ in columns])
        query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
        
        async with self.get_connection() as conn:
            await conn.executemany(query, values_list)
            await conn.commit()
            
        self._stats['batch_operations'] += 1
        logger.info(f"[debug] 批量插入 {len(values_list)} 条记录到 {table}，耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    async def batch_update(self, queries_and_params: List[tuple]) -> None:
        """批量执行更新操作"""
        if not queries_and_params:
            return
            
        start_time = time.time()
        
        async with self.get_connection() as conn:
            for query, params in queries_and_params:
                await self.execute_with_timing(conn, query, params)
            await conn.commit()
            
        self._stats['batch_operations'] += 1
        logger.info(f"[debug] 批量执行 {len(queries_and_params)} 个更新操作，耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    async def create_canvas_and_session_batch(self, canvas_data: dict, session_data: dict) -> None:
        """批量创建Canvas和Session（原子操作）"""
        start_time = time.time()
        
        async with self.get_connection() as conn:
            # 在一个事务中完成两个操作
            await self.execute_with_timing(conn, """
                INSERT INTO tb_canvases (id, name, uuid, email)
                VALUES (?, ?, ?, ?)
            """, (canvas_data['id'], canvas_data['name'], canvas_data['user_uuid'], canvas_data['user_email']))
            
            await self.execute_with_timing(conn, """
                INSERT INTO tb_chat_sessions (id, model, provider, canvas_id, uuid, title)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (session_data['id'], session_data['model'], session_data['provider'], 
                  session_data['canvas_id'], session_data['user_uuid'], session_data['title']))
            
            await conn.commit()
        
        logger.info(f"[debug] 批量创建Canvas和Session，耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    async def create_messages_batch(self, messages: List[dict]) -> None:
        """批量创建消息"""
        if not messages:
            return
            
        values_list = [
            (msg['session_id'], msg['role'], msg['message'], msg['user_uuid'])
            for msg in messages
        ]
        
        await self.batch_insert('tb_chat_messages', 
                               ['session_id', 'role', 'message', 'uuid'], 
                               values_list)
    
    async def get_stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        async with self._pool_lock:
            pool_size = len(self._connection_pool)
        
        return {
            **self._stats,
            'pool_size': pool_size,
            'max_connections': self.max_connections
        }
    
    async def cleanup(self) -> None:
        """清理连接池"""
        async with self._pool_lock:
            for conn in self._connection_pool:
                try:
                    await conn.close()
                except:
                    pass
            self._connection_pool.clear()
        
        logger.info("[debug] 数据库连接池已清理")


# 全局实例
db_optimization_service = None

def get_db_optimization_service(db_path: str) -> DatabaseOptimizationService:
    """获取数据库优化服务实例"""
    global db_optimization_service
    if db_optimization_service is None:
        db_optimization_service = DatabaseOptimizationService(db_path)
    return db_optimization_service