from typing import List, Type
import sqlite3
from services.migrations.v1_initial_schema import V1InitialSchema
from services.migrations.v2_add_canvases import V2AddCanvases
from services.migrations.v3_add_comfy_workflow import V3AddComfyWorkflow
from services.migrations.v4_add_user_email import V4AddUserEmail
from services.migrations.v5_add_multi_user import V5AddMultiUser
from services.migrations.v6_add_user_uuid import V6AddUserUuid
from services.migrations.v7_rename_user_id_to_uuid import V7RenameUserIdToUuid
from . import Migration
from log import get_logger

logger = get_logger(__name__)

# Database version
CURRENT_VERSION = 7

ALL_MIGRATIONS = [
    {
        'version': 1,
        'migration': V1InitialSchema,
    },
    {
        'version': 2,
        'migration': V2AddCanvases,
    },
    {
        'version': 3,
        'migration': V3AddComfyWorkflow,
    },
    {
        'version': 4,
        'migration': V4AddUserEmail,
    },
    {
        'version': 5,
        'migration': V5AddMultiUser,
    },
    {
        'version': 6,
        'migration': V6AddUserUuid,
    },
    {
        'version': 7,
        'migration': V7RenameUserIdToUuid,
    },
]
class MigrationManager:
    def get_migrations_to_apply(self, current_version: int, target_version: int) -> List[Type[Migration]]:
        """Get list of migrations to apply"""
        return [m for m in ALL_MIGRATIONS
                if m['version'] > current_version and m['version'] <= target_version]

    def get_migrations_to_rollback(self, current_version: int, target_version: int) -> List[Type[Migration]]:
        """Get list of migrations to rollback"""
        return [m for m in reversed(ALL_MIGRATIONS)
                if m['version'] <= current_version and m['version'] > target_version]

    def migrate(self, conn: sqlite3.Connection, from_version: int, to_version: int) -> None:
        """Apply or rollback migrations to reach target version"""
        if from_version < to_version:
            # Apply migrations forward
            logger.info(f'🦄 Applying migrations forward {from_version} -> {to_version}')
            migrations_to_apply = self.get_migrations_to_apply(from_version, to_version)
            logger.info(f'🦄 Migrations to apply {migrations_to_apply}')
            for migration in migrations_to_apply:
                migration_class = migration['migration']
                migration = migration_class()
                logger.info(f"Applying migration {migration.version}: {migration.description}")
                migration.up(conn)
                conn.execute("UPDATE db_version SET version = ?", (migration.version,))
        # Do not do rollback migrations
        # else:
        #     # Rollback migrations
        #     print('🦄 Rolling back migrations', from_version, '->', to_version)
        #     migrations_to_rollback = self.get_migrations_to_rollback(from_version, to_version)
        #     print('🦄 Migrations to rollback', migrations_to_rollback)
        #     for migration_class in migrations_to_rollback:
        #         migration = migration_class()
        #         print(f"Rolling back migration {migration.version}: {migration.description}")
        #         migration.down(conn)
        #         conn.execute("UPDATE db_version SET version = ?", (migration.version - 1,)) 