// ===== 📄 ФАЙЛ: frontend/src/services/postPublisher.js =====
//
// Сервис фоновой публикации постов с медиа (документы / видео).
// Управляет жизненным циклом задачи в zustand store, прогрессом аплоада,
// AbortController'ом и тостами по завершении.

import { createPost } from '../api';
import useStore from '../store';
import { toast } from '../components/shared/Toast';

// Через сколько ms убрать success-карточку из ленты после успешной публикации.
// Делаем коротко (~250ms), т.к. реальный PostCard уже добавлен в storePosts и
// отрисовывается параллельно — длинный success hold создавал бы дубликат.
const SUCCESS_HOLD_MS = 250;
const TASK_ID_PREFIX = 'pub';

function generateTaskId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${TASK_ID_PREFIX}-${Date.now()}-${rand}`;
}

/**
 * Маппит ошибку axios/network в человекочитаемое сообщение.
 */
export function describeUploadError(error) {
  if (!error) return 'Не удалось опубликовать пост';

  // Отмена пользователем
  if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
    return 'Публикация отменена';
  }

  // Сеть (запрос вообще не доехал)
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Нет связи с сервером. Проверьте подключение.';
  }

  // Таймаут axios — на всякий случай (мы выключили, но оставим)
  if (error.code === 'ECONNABORTED') {
    return 'Слишком долгий аплоад. Проверьте подключение и попробуйте снова.';
  }

  const status = error?.response?.status;
  if (status === 413) return 'Файл слишком большой';
  if (status === 415) return 'Неподдерживаемый тип файла';
  if (status === 429) return 'Слишком частые публикации. Подождите немного.';
  if (status === 401 || status === 403) return 'Нет прав на эту публикацию';

  const detail = error?.response?.data?.detail;

  const detailString = (() => {
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || item.type).filter(Boolean).join(', ');
    }
    if (typeof detail === 'string') return detail;
    return '';
  })();

  // Понятные подмены для типовых backend-сообщений
  if (/Antivirus scanner is unavailable/i.test(detailString)) {
    return 'Антивирус временно недоступен. Попробуйте через минуту.';
  }
  if (/Document failed antivirus scan/i.test(detailString)) {
    return 'Файл отклонён антивирусом';
  }
  if (/Document is suspicious \(zip bomb\)/i.test(detailString)) {
    return 'Файл выглядит подозрительно (архив-бомба)';
  }
  if (/Document is too large/i.test(detailString)) {
    return 'Файл слишком большой';
  }
  if (/Unsupported document type/i.test(detailString)) {
    return 'Неподдерживаемый тип документа';
  }

  if (detailString.trim()) return detailString;

  return 'Не удалось опубликовать пост';
}

/**
 * Запускает фоновую публикацию поста с медиа.
 * Не возвращает promise аплоада — после вызова можно сразу закрыть модалку.
 *
 * @param {Object} params
 * @param {FormData} params.formData — собранный FormData (images/video/documents/...)
 * @param {Object} params.draftSnapshot — snapshot черновика для восстановления при ошибке
 * @returns {string} taskId — id созданной задачи (для возможной отмены/трекинга)
 */
export function publishPostInBackground({ formData, draftSnapshot }) {
  const taskId = generateTaskId();
  const controller = new AbortController();

  const store = useStore.getState();

  store.addPublishingTask({
    id: taskId,
    status: 'uploading',
    progress: 0,
    formData,
    draftSnapshot: draftSnapshot || null,
    abortController: controller,
    errorMessage: null,
    createdPost: null,
    createdAt: Date.now(),
  });
  store.setHasPendingPublish(true);

  runUpload(taskId, formData, controller.signal);

  return taskId;
}

/**
 * Повторный запуск аплоада для существующей error-задачи.
 * Использует ту же formData, что хранится в задаче.
 */
export function retryPublishingTask(taskId) {
  const store = useStore.getState();
  const task = store.publishingTasks.find((t) => t.id === taskId);
  if (!task || !task.formData) return;

  const controller = new AbortController();
  store.updatePublishingTask(taskId, {
    status: 'uploading',
    progress: 0,
    errorMessage: null,
    abortController: controller,
  });
  store.setHasPendingPublish(true);

  runUpload(taskId, task.formData, controller.signal);
}

/**
 * Отменяет аплоад и удаляет задачу из стора.
 */
export function cancelPublishingTask(taskId) {
  const store = useStore.getState();
  const task = store.publishingTasks.find((t) => t.id === taskId);
  if (!task) return;
  try {
    task.abortController?.abort();
  } catch (_e) {
    /* ignore */
  }
  store.removePublishingTask(taskId);
  // Если других активных задач не осталось — снимаем persisted-флаг
  const remaining = useStore.getState().publishingTasks;
  if (!remaining.some((t) => t.status === 'uploading')) {
    store.setHasPendingPublish(false);
  }
}

/**
 * Открывает редактор с восстановленным черновиком из задачи (для error-восстановления).
 * Удаляет саму задачу.
 */
export function recoverDraftFromTask(taskId) {
  const store = useStore.getState();
  const task = store.publishingTasks.find((t) => t.id === taskId);
  if (!task) return;
  if (task.draftSnapshot) {
    store.setCreateContentDraft(task.draftSnapshot);
  }
  store.removePublishingTask(taskId);
  store.setShowCreateModal(true);
}

// ───────────────────────── internals ─────────────────────────

async function runUpload(taskId, formData, signal) {
  const store = useStore.getState();

  // Диагностика: логируем КАЖДЫЙ progress-событие c байтами (не процентами).
  // Так видно: реально ли стоят на месте (несколько одинаковых loaded подряд)
  // или просто ползёт медленно (loaded растёт, % округлён до 2).
  const startedAt = Date.now();
  let lastLoaded = 0;
  let lastProgressAt = startedAt;
  console.info(`[postPublisher] upload start task=${taskId}`);

  const onProgress = (event) => {
    if (!event?.total) return;
    const now = Date.now();
    const elapsedMs = now - startedAt;
    const sinceLastMs = now - lastProgressAt;
    const deltaBytes = event.loaded - lastLoaded;
    lastLoaded = event.loaded;
    lastProgressAt = now;

    const speedKbps = sinceLastMs > 0 ? Math.round((deltaBytes / 1024) / (sinceLastMs / 1000)) : 0;
    const pct = Math.round((event.loaded / event.total) * 100);

    console.info(
      `[postPublisher] task=${taskId} progress: ${event.loaded}/${event.total} bytes (${pct}%) +${deltaBytes}B in ${sinceLastMs}ms ~${speedKbps}KB/s elapsed=${elapsedMs}ms`,
    );

    const live = useStore.getState();
    const exists = live.publishingTasks.some((t) => t.id === taskId);
    if (exists) {
      live.updatePublishingTask(taskId, { progress: pct });
    }
  };

  // Watchdog: если 20 секунд нет ни одного progress-события — пишем варнинг.
  const watchdog = setInterval(() => {
    const idleMs = Date.now() - lastProgressAt;
    if (idleMs > 20000) {
      console.warn(
        `[postPublisher] task=${taskId} STALLED for ${idleMs}ms at ${lastLoaded} bytes`,
      );
    }
  }, 10000);

  try {
    const newPost = await createPost(formData, onProgress, signal);
    clearInterval(watchdog);
    console.info(
      `[postPublisher] upload done task=${taskId} elapsed=${Date.now() - startedAt}ms`,
    );

    const live = useStore.getState();
    // Задача могла быть отменена пока мы ждали — проверяем
    const stillExists = live.publishingTasks.some((t) => t.id === taskId);
    if (!stillExists) return;

    live.addNewPost(newPost);
    live.updatePublishingTask(taskId, {
      status: 'success',
      progress: 100,
      createdPost: newPost,
    });
    live.clearCreateContentDraft();

    // Тост с кнопкой "Перейти к посту"
    toast.success('Пост опубликован', {
      duration: 4000,
      action: {
        label: 'Открыть',
        onClick: () => {
          useStore.getState().setViewPostId(newPost.id);
        },
      },
    });

    // Через короткий "success hold" убираем карточку из ленты (реальный пост уже там)
    setTimeout(() => {
      const s = useStore.getState();
      s.removePublishingTask(taskId);
      const remaining = useStore.getState().publishingTasks;
      if (!remaining.some((t) => t.status === 'uploading')) {
        s.setHasPendingPublish(false);
      }
    }, SUCCESS_HOLD_MS);
  } catch (error) {
    clearInterval(watchdog);
    const isCanceled = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';
    console.warn(
      `[postPublisher] upload failed task=${taskId} elapsed=${Date.now() - startedAt}ms loaded=${lastLoaded} canceled=${isCanceled}`,
      error,
    );
    const live = useStore.getState();
    const stillExists = live.publishingTasks.some((t) => t.id === taskId);

    if (isCanceled) {
      // Отмена: задачу уже мог удалить cancelPublishingTask
      const remaining = useStore.getState().publishingTasks;
      if (!remaining.some((t) => t.status === 'uploading')) {
        live.setHasPendingPublish(false);
      }
      return;
    }

    if (!stillExists) {
      const remaining = useStore.getState().publishingTasks;
      if (!remaining.some((t) => t.status === 'uploading')) {
        live.setHasPendingPublish(false);
      }
      return;
    }

    const message = describeUploadError(error);
    live.updatePublishingTask(taskId, {
      status: 'error',
      errorMessage: message,
    });

    toast.error(message, {
      duration: 6000,
      action: {
        label: 'Открыть',
        onClick: () => recoverDraftFromTask(taskId),
      },
    });

    const remaining = useStore.getState().publishingTasks;
    if (!remaining.some((t) => t.status === 'uploading')) {
      live.setHasPendingPublish(false);
    }
  }
}
