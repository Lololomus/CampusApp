# CampusApp - Чеклист прод-выкатки

## 1) Подготовить сервер
- [ ] Поднять Linux-хост (Ubuntu 22.04+).
- [ ] Установить Docker и Docker Compose Plugin.
- [ ] Открыть только `80/tcp` и `443/tcp` (порт `5432` наружу не открывать).
- [ ] Создать DNS `A`/`AAAA` запись на IP сервера (например, `app.example.com`).

## 2) Подготовить env (dev mode OFF)
- [ ] Создать `.env` на сервере по шаблону `.env.production.example`.
- [ ] Установить `APP_ENV=prod`.
- [ ] Установить `DEV_AUTH_ENABLED=false`.
- [ ] Очистить `DEV_TELEGRAM_IDS`.
- [ ] Установить `CORS_ORIGINS=https://<твой-домен>`.
- [ ] Установить `COOKIE_SECURE=true`.
- [ ] Установить сильные секреты: `SECRET_KEY`, `BOT_SECRET`.
- [ ] Установить реальный `BOT_TOKEN`.
- [ ] Установить `SQL_ECHO=false`.

## 3) Telegram и Mini App
- [ ] В BotFather настроить Mini App URL на `https://<твой-домен>`.
- [ ] Проверить `MINIAPP_URL` в `.env`.
- [ ] Проверить, что бот запускается в polling (в этом проекте webhook не используется).
- [ ] Туннель нужен только для временного теста HTTPS, для прода используем обычный домен + TLS.

## 4) TLS/HTTPS
- [ ] Поставить reverse proxy перед `frontend` (Nginx/Caddy/Traefik) с TLS-сертификатом.
- [ ] Проксировать `https://<домен>` на `frontend:80`.
- [ ] Проверить, что в браузере нет mixed content, и API идет через `/api`.

## 5) Сборка и запуск
- [ ] Скопировать проект на сервер.
- [ ] Выполнить `docker compose build --pull`.
- [ ] Выполнить `docker compose up -d`.
- [ ] Проверить статус: `docker compose ps`.
- [ ] Проверить backend health: `curl http://127.0.0.1:8000/health` из сети docker или через proxy `/api/health`.

## 6) Проверки после запуска
- [ ] Фронт открывается по `https://<домен>`.
- [ ] Логин через Telegram работает.
- [ ] Refresh cookie выставляется с `Secure`.
- [ ] `DEV`-кнопка на фронте отсутствует в прод-сборке.
- [ ] `/dev/auth/*` возвращает `404` в проде.
- [ ] `/dev/generate-mock-dating-data` возвращает `404` в проде.
- [ ] Бот отправляет уведомления (проверить `docker compose logs -f bot`).

## 7) Безопасность и эксплуатация
- [ ] Включить регулярные бэкапы Postgres volume.
- [ ] Настроить ротацию логов docker.
- [ ] Добавить мониторинг (uptime + alerts).
- [ ] Никогда не хранить реальные токены в git.
- [ ] Если токены/секреты уже светились, сразу ротировать `BOT_TOKEN`, `SECRET_KEY`, `BOT_SECRET`.

