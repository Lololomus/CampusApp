from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from app import models, schemas, crud, auth
from app.database import get_db, init_db, engine

# Создаём FastAPI приложение
app = FastAPI(
    title="Campus App API",
    description="Backend для студенческой социальной сети",
    version="1.0.0"
)

# CORS - разрешаем фронтенду обращаться к API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В production поставь конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаём таблицы при запуске
@app.on_event("startup")
def startup_event():
    print("🚀 Запуск сервера...")
    init_db()
    print("✅ База данных готова!")

# ===== ПРОВЕРКА РАБОТЫ =====

@app.get("/")
def root():
    """Главная страница - проверка что API работает"""
    return {
        "message": "Campus App API работает! 🎉",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """Проверка здоровья сервера"""
    return {"status": "ok"}

# ===== AUTH ENDPOINTS =====

@app.post("/auth/telegram", response_model=schemas.User)
def auth_telegram(
    auth_data: schemas.TelegramAuth,
    db: Session = Depends(get_db)
):
    """
    Авторизация через Telegram
    Если пользователь новый - возвращает None (нужна регистрация)
    """
    # Проверяем существует ли пользователь
    user = crud.get_user_by_telegram_id(db, auth_data.telegram_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден. Нужна регистрация."
        )
    return user

@app.post("/auth/register", response_model=schemas.User)
def register_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    """Регистрация нового пользователя"""
    # Проверяем что пользователь не существует
    existing_user = crud.get_user_by_telegram_id(db, user_data.telegram_id)
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже зарегистрирован")
    
    # Создаём пользователя
    return crud.create_user(db, user_data)

# ===== USER ENDPOINTS =====

@app.get("/users/me", response_model=schemas.User)
def get_current_user(
    telegram_id: int,
    db: Session = Depends(get_db)
):
    """Получить данные текущего пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user

@app.patch("/users/me", response_model=schemas.User)
def update_current_user(
    telegram_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db)
):
    """Обновить профиль текущего пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем РЕАЛЬНО ЛИ меняются критичные поля (university, institute, course)
    update_data = user_update.model_dump(exclude_unset=True)
    critical_fields = ['university', 'institute', 'course']
    changing_critical = any(
        field in update_data and update_data[field] != getattr(user, field)
        for field in critical_fields
    )
    
    if changing_critical:
        # Проверяем cooldown (30 дней)
        if not crud.can_edit_critical_fields(db, user.id):
            days_left = crud.get_cooldown_days_left(db, user.id)
            raise HTTPException(
                status_code=403,
                detail=f"Изменить можно через {days_left} дней"
            )

    # Обновляем профиль
    updated_user = crud.update_user(db, user.id, user_update)

    # Если меняли критичные поля - обновляем timestamp ПОСЛЕ успешного сохранения
    if changing_critical:
        from datetime import datetime
        updated_user.last_profile_edit = datetime.utcnow()
        db.commit()
        db.refresh(updated_user)  # обновляем объект из БД

    return updated_user


@app.get("/users/{user_id}/posts", response_model=List[schemas.Post])
def get_user_posts_endpoint(
    user_id: int,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить посты пользователя"""
    # Проверяем что запрашивающий пользователь существует
    requesting_user = crud.get_user_by_telegram_id(db, telegram_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем что целевой пользователь существует
    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Получаем посты
    posts = crud.get_user_posts(db, user_id, limit, offset)
    
    # Обогащаем данными
    for post in posts:
        post.tags = post.get_tags_list()
        post.author = target_user
        post.is_liked = crud.is_post_liked_by_user(db, post.id, requesting_user.id)
        post.comments_count = crud.count_post_comments(db, post.id)
    
    return posts


@app.get("/users/{user_id}/stats")
def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Получить статистику пользователя"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {
        "posts_count": crud.count_user_posts(db, user_id),
        "comments_count": crud.count_user_comments(db, user_id)
    }

# ===== POST ENDPOINTS =====

@app.get("/posts", response_model=List[schemas.Post])
def get_posts(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    university: Optional[str] = None,
    course: Optional[int] = None,
    telegram_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """Получить список постов с фильтрами"""
    posts = crud.get_posts(db, skip, limit, category, university, course)
    
    # Получаем user_id если telegram_id передан
    user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            user_id = user.id
    
    # Конвертируем теги и загружаем автора + проверяем лайк
    for post in posts:
        post.tags = post.get_tags_list()
        post.author = crud.get_user_by_id(db, post.author_id)
        
        # Проверяем лайкнул ли текущий пользователь
        if user_id:
            post.is_liked = crud.is_post_liked_by_user(db, post.id, user_id)
        else:
            post.is_liked = False
        
        post.comments_count = crud.count_post_comments(db, post.id)

    return posts

@app.get("/posts/{post_id}", response_model=schemas.Post)
def get_post(
    post_id: int,
    telegram_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """Получить конкретный пост"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    # Увеличиваем просмотры
    crud.increment_post_views(db, post_id)

    # Обогащаем данными
    post.author = crud.get_user_by_id(db, post.author_id)
    post.tags = post.get_tags_list()

    # Лайк текущего пользователя
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        post.is_liked = crud.is_post_liked_by_user(db, post.id, user.id) if user else False
    else:
        post.is_liked = False

    # КЛЮЧЕВОЕ: всегда считаем актуальный счетчик тут
    post.comments_count = crud.count_post_comments(db, post_id)

    return post

@app.post("/posts", response_model=schemas.Post)
def create_post(
    post_data: schemas.PostCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Создать новый пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    new_post = crud.create_post(db, post_data, user.id, user)
    new_post.tags = new_post.get_tags_list()
    return new_post

@app.patch("/posts/{post_id}", response_model=schemas.Post)
def update_post_endpoint(
    post_id: int,
    post_update: schemas.PostUpdate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Обновить пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Проверка прав (только автор может редактировать)
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование")
    
    # Обновляем пост
    updated_post = crud.update_post(db, post_id, post_update)
    if not updated_post:
        raise HTTPException(status_code=500, detail="Не удалось обновить пост")
    
    # Обогащаем данными
    updated_post.tags = updated_post.get_tags_list()
    updated_post.author = user
    updated_post.is_liked = crud.is_post_liked_by_user(db, post_id, user.id)
    updated_post.comments_count = crud.count_post_comments(db, post_id)
    
    return updated_post

@app.post("/posts/{post_id}/like")
def toggle_like_post(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка поста"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    result = crud.toggle_post_like(db, post_id, user.id)
    return {"success": True, **result}

# ===== COMMENT ENDPOINTS =====

@app.get("/posts/{post_id}/comments", response_model=List[schemas.Comment])
def get_post_comments(
    post_id: int,
    telegram_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """Получить комментарии к посту с авторами и лайками"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Получаем user_id если telegram_id передан
    user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            user_id = user.id
    
    # Загружаем комментарии с авторами и проверкой лайков
    comments = crud.get_post_comments(db, post_id, user_id)
    
    return comments

@app.post("/comments", response_model=schemas.Comment)
def create_comment(
    comment_data: schemas.CommentCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Создать комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем что пост существует
    post = crud.get_post(db, comment_data.post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    db_comment = crud.create_comment(db, comment_data, user.id)
    
    # Загружаем автора комментария
    db_comment.author = user
    db_comment.is_liked = False
    
    return db_comment

@app.post("/comments/{comment_id}/like")
def toggle_like_comment(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка комментария"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем что комментарий существует
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    
    # Toggle лайка
    result = crud.toggle_comment_like(db, comment_id, user.id)
    return {"success": True, **result}

@app.delete("/comments/{comment_id}")
def delete_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Удаляем комментарий
    result = crud.delete_comment(db, comment_id, user.id)
    
    if not result["success"]:
        raise HTTPException(status_code=403, detail=result["error"])
    
    return result

@app.patch("/comments/{comment_id}", response_model=schemas.Comment)
def update_comment_endpoint(
    comment_id: int,
    text: str = Query(..., min_length=1),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Редактировать комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Обновляем комментарий
    updated_comment = crud.update_comment(db, comment_id, text, user.id)
    
    if not updated_comment:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование или комментарий не найден")
    
    # Загружаем автора
    updated_comment.author = crud.get_user_by_id(db, updated_comment.author_id)
    updated_comment.is_liked = crud.is_comment_liked_by_user(db, comment_id, user.id)
    
    return updated_comment


@app.post("/comments/{comment_id}/report", response_model=schemas.CommentReport)
def report_comment(
    comment_id: int,
    report_data: schemas.CommentReportCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Пожаловаться на комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Создаём жалобу
    report = crud.create_comment_report(
        db, 
        comment_id, 
        user.id, 
        report_data.reason, 
        report_data.description
    )
    
    if not report:
        raise HTTPException(status_code=400, detail="Невозможно создать жалобу")
    
    return report

@app.delete("/posts/{post_id}")
def delete_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Проверка прав (только автор может удалить)
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    
    success = crud.delete_post(db, post_id)
    if not success:
        raise HTTPException(status_code=500, detail="Не удалось удалить пост")
    
    return {"success": True}

# ===== DATING ENDPOINTS =====

@app.get("/dating/feed", response_model=List[schemas.DatingProfile])
def get_dating_feed_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    course: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Лента профилей для знакомств"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users = crud.get_dating_feed(
        db, user.id, limit, offset,
        university=university,
        institute=institute,
        course=course
    )
    
    # Форматируем ответ
    result = []
    for u in users:
        interests_list = u.interests.split(',') if u.interests else []
        interests_list = [tag.strip() for tag in interests_list if tag.strip()]
        
        profile = schemas.DatingProfile(
            id=u.id,
            telegram_id=u.telegram_id,
            name=u.name,
            age=u.age,
            bio=u.bio,
            avatar=u.avatar,
            university=u.university,
            institute=u.institute,
            course=None if u.hide_course_group else u.course,
            group=None if u.hide_course_group else u.group,
            interests=interests_list
        )
        result.append(profile)
    
    return result


@app.get("/dating/people")
def get_people_with_posts_endpoint(
    telegram_id: int = Query(...),
    category: str = Query(..., regex="^(study|help|hangout)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Получить людей с их активными постами категории X.
    Для режимов: study, help, hangout
    """
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Получаем результаты из CRUD
    result = crud.get_people_with_posts(
        db, user.id, category, limit, offset,
        university=university,
        institute=institute
    )
    
    # result уже содержит {items: [...], has_more: bool}
    # Просто возвращаем как есть
    return result


@app.post("/dating/like", response_model=schemas.LikeActionResponse)
def like_user_endpoint(
    telegram_id: int = Query(...),
    like_data: schemas.LikeCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Лайкнуть пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = crud.create_like(db, user.id, like_data.liked_id)
    
    if not result['success']:
        return schemas.LikeActionResponse(
            success=False,
            error=result.get('error')
        )
    
    response = schemas.LikeActionResponse(
        success=True,
        is_match=result.get('is_match', False)
    )
    
    if result.get('is_match'):
        matched_user = result.get('matched_user')
        response.match_id = result.get('match_id')
        response.matched_user = schemas.UserPublic.from_orm(matched_user)
    
    return response


@app.get("/dating/likes", response_model=List[schemas.DatingProfile])
def get_who_liked_me_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Кто меня лайкнул (но я их ещё нет)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users = crud.get_who_liked_me(db, user.id, limit, offset)
    
    result = []
    for u in users:
        interests_list = u.interests.split(',') if u.interests else []
        interests_list = [tag.strip() for tag in interests_list if tag.strip()]
        
        profile = schemas.DatingProfile(
            id=u.id,
            telegram_id=u.telegram_id,
            name=u.name,
            age=u.age,
            bio=u.bio,
            avatar=u.avatar,
            university=u.university,
            institute=u.institute,
            course=None if u.hide_course_group else u.course,
            group=None if u.hide_course_group else u.group,
            interests=interests_list
        )
        result.append(profile)
    
    return result


@app.get("/dating/matches", response_model=List[schemas.MatchResponse])
def get_my_matches_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Мои матчи"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    matches = crud.get_my_matches(db, user.id, limit, offset)
    
    result = []
    for match in matches:
        result.append(schemas.MatchResponse(
            id=match['id'],
            matched_at=match['matched_at'],
            matched_user=schemas.UserPublic.from_orm(match['matched_user'])
        ))
    
    return result


@app.get("/dating/stats", response_model=schemas.DatingStats)
def get_dating_stats_endpoint(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Статистика знакомств"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stats = crud.get_dating_stats(db, user.id)
    
    # Добавляем responses_count
    responses_count = 0  # TODO: реализовать когда будет модель Response
    
    return schemas.DatingStats(
        likes_count=stats['likes_count'],
        matches_count=stats['matches_count'],
        responses_count=responses_count
    )


@app.patch("/me/dating-settings", response_model=schemas.UserPublic)
def update_dating_settings_endpoint(
    telegram_id: int = Query(...),
    settings: schemas.DatingSettings = Body(...),
    db: Session = Depends(get_db)
):
    """Обновить настройки приватности для знакомств"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings_dict = settings.dict(exclude_unset=True)
    updated_user = crud.update_dating_settings(db, user.id, settings_dict)
    
    return schemas.UserPublic.from_orm(updated_user)


# ===== МОК ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ =====
@app.post("/dev/generate-mock-dating-data")
def generate_mock_dating_data(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    ТОЛЬКО ДЛЯ РАЗРАБОТКИ!
    Создаёт тестовых пользователей для ленты знакомств.
    """
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    mock_users = [
        {
            'telegram_id': 999000001,
            'name': 'Анастасия',
            'age': 19,
            'bio': 'Люблю кофе и программирование ☕ Ищу компанию для хакатонов',
            'university': user.university,
            'institute': user.institute,
            'course': 2,
            'group': 'ИБ-23',
            'interests': 'python,кофе,хакатоны,музыка',
            'show_in_dating': True
        },
        {
            'telegram_id': 999000002,
            'name': 'Дмитрий',
            'age': 21,
            'bio': 'Спорт, музыка, программирование. Всегда на позитиве!',
            'university': user.university,
            'institute': user.institute,
            'course': 3,
            'group': 'ПИ-31',
            'interests': 'спорт,музыка,программирование',
            'show_in_dating': True
        },
        {
            'telegram_id': 999000003,
            'name': 'Мария',
            'age': 20,
            'bio': 'Дизайн, путешествия, фотография 📸',
            'university': user.university,
            'institute': user.institute,
            'course': 2,
            'group': 'ДИ-22',
            'interests': 'дизайн,путешествия,фотография',
            'show_in_dating': True
        },
        {
            'telegram_id': 999000004,
            'name': 'Алексей',
            'age': 22,
            'bio': 'Кино, книги, настолки. Давайте дружить!',
            'university': user.university,
            'institute': user.institute,
            'course': 4,
            'group': 'ФИ-41',
            'interests': 'кино,книги,настолки',
            'show_in_dating': True
        },
        {
            'telegram_id': 999000005,
            'name': 'София',
            'age': 19,
            'bio': 'Психология, саморазвитие, медитация 🧘‍♀️',
            'university': user.university,
            'institute': user.institute,
            'course': 1,
            'group': 'ПС-13',
            'interests': 'психология,медитация,йога',
            'show_in_dating': True
        }
    ]
    
    created_users = []
    for mock_data in mock_users:
        # Проверяем существует ли
        existing = crud.get_user_by_telegram_id(db, mock_data['telegram_id'])
        if not existing:
            new_user = models.User(**mock_data)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            created_users.append(new_user.name)
        else:
            created_users.append(f"{existing.name} (уже существует)")
    
    return {
        "success": True,
        "message": f"Создано {len(created_users)} тестовых пользователей",
        "users": created_users
    }