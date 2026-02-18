# Используем легкий Python
FROM python:3.11-slim

# Рабочая директория внутри контейнера
WORKDIR /app

# Чтобы Python не создавал .pyc файлы и вывод шел сразу в консоль
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Ставим системные зависимости (для psycopg2 и работы с изображениями)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости и ставим их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY . .

# Создаем папку для загрузок, чтобы не было ошибки прав
RUN mkdir -p uploads/avatars uploads/images

# Запуск через Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]