import os
import unittest
from unittest.mock import patch

from app import config as app_config


class ProdConfigValidationTests(unittest.TestCase):
    def setUp(self):
        app_config.get_settings.cache_clear()

    def tearDown(self):
        app_config.get_settings.cache_clear()

    def _base_prod_env(self):
        return {
            "APP_ENV": "prod",
            "DATABASE_URL": "postgresql+asyncpg://campus:secret@postgres:5432/campusapp",
            "REDIS_URL": "redis://:secret@redis:6379/0",
            "SECRET_KEY": "s" * 32,
            "BOT_SECRET": "b" * 32,
            "BOT_TOKEN": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "ANALYTICS_SALT": "a" * 16,
            "COOKIE_SECURE": "true",
            "COOKIE_SAMESITE": "lax",
            "CORS_ORIGINS": "https://app.example.com",
            "DEV_AUTH_ENABLED": "false",
            "SQL_ECHO": "false",
        }

    def test_prod_rejects_placeholder_secret_key(self):
        env = self._base_prod_env()
        env["SECRET_KEY"] = "change_me_secret_key_change_me_secret_key"
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(RuntimeError):
                app_config.get_settings()

    def test_prod_rejects_localhost_cors_origin(self):
        env = self._base_prod_env()
        env["CORS_ORIGINS"] = "https://app.example.com,http://localhost:3000"
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(RuntimeError):
                app_config.get_settings()


if __name__ == "__main__":
    unittest.main()
