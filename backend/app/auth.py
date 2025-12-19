import os
import hashlib
import hmac
from typing import Optional
from dotenv import load_dotenv

# Загружаем .env
load_dotenv(dotenv_path="../.env")

BOT_TOKEN = os.getenv("BOT_TOKEN", "test_token")

def verify_telegram_auth(auth_data: dict) -> bool:
    """
    Проверяет что данные действительно пришли от Telegram
    
    Telegram отправляет хеш для проверки подлинности.
    Документация: https://core.telegram.org/widgets/login
    """
    if not auth_data or "hash" not in auth_data:
        return False
    
    # В разработке можно пропустить проверку
    if BOT_TOKEN == "test_token":
        return True
    
    # Получаем хеш из данных
    received_hash = auth_data.pop("hash")
    
    # Создаём строку для проверки
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted(auth_data.items())])
    
    # Вычисляем секретный ключ
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    
    # Вычисляем хеш
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Сравниваем
    return calculated_hash == received_hash


def get_current_user_id(telegram_id: Optional[int]) -> Optional[int]:
    """
    Простая функция для получения ID пользователя
    В production здесь будет JWT токен
    """
    return telegram_id