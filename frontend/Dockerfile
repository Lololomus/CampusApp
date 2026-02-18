# --- Этап 1: Сборка (Build) ---
FROM node:20-alpine as build

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Ставим зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем проект (создается папка build)
RUN npm run build

# --- Этап 2: Запуск (Production) ---
FROM nginx:stable-alpine

# Копируем собранные файлы из первого этапа в папку Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Копируем наш конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]