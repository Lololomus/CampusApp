# PillowUpdate Desktop (v1)

Локальный desktop-редактор карточек апдейтов на `CustomTkinter + Pillow`.

## Запуск

Из корня проекта:

```bash
python tools/pillow_update_desktop/app.py
```

## Что делает

- Редактирует поля update-карточки (дата, версия, заголовки, футер, 3+3 пункта).
- По кнопке `Обновить превью` рендерит 1080x1080 изображение.
- По кнопке `Сохранить` создает:
  - `updates/<YYYY-MM-DD>_v<version>_<slug>/preview.png`
  - `updates/<YYYY-MM-DD>_v<version>_<slug>/update.json`

## Проверка тестов

```bash
python -m unittest discover -s tools/pillow_update_desktop/tests -v
```

