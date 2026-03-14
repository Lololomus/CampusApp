import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BarChart2,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Gift,
  Hash,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  MapPin,
  Plus,
  Send,
  Settings,
  Users,
  VenetianMask,
  X,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from './SwipeableModal';
import { updatePost, updateRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_EDIT_POST, getOverlayZIndex } from '../../constants/zIndex';
import { REWARD_TYPES } from '../../types';
import { IMAGE_SETTINGS, POST_LIMITS, REQUEST_LIMITS } from '../../constants/contentConstants';
import {
  CREATE_CONTENT_CATEGORY_CAPABILITIES,
  CREATE_CONTENT_POST_CATEGORIES,
  CREATE_CONTENT_POST_PLACEHOLDERS,
  CREATE_CONTENT_REQUEST_CATEGORIES,
  CREATE_CONTENT_REQUEST_DEADLINE_OPTIONS,
  CREATE_CONTENT_REQUEST_PLACEHOLDERS,
  CREATE_CONTENT_REQUEST_REWARD_OPTIONS,
  CREATE_CONTENT_SUGGESTED_TAGS,
} from '../../constants/createContentUiConfig';
import {
  composeSingleTextFromTitleBody,
  parsePostSingleText,
  parseRequestSingleText,
} from '../../utils/contentTextParser';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { toast } from './Toast';
import ConfirmationDialog from './ConfirmationDialog';
import SmartDatePicker from './SmartDatePicker';
import { useTelegramScreen } from './telegram/useTelegramScreen';

const MAX_IMAGES = POST_LIMITS.IMAGES_MAX;
const MAX_TAGS = POST_LIMITS.TAGS_MAX;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;

const normalizeTag = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zа-яё0-9_-]/gi, '');

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractImageKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutHash = raw.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const normalized = withoutQuery.replace(/\\/g, '/');
  if (!normalized.includes('/')) return normalized;
  return normalized.split('/').pop() || '';
};

const parseInitialImages = (images) =>
  parseArrayField(images)
    .map((raw, index) => {
      const source = typeof raw === 'object' && raw !== null ? raw.url || raw.filename || '' : raw;
      const key = extractImageKey(source);
      if (!source && !key) return null;
      return {
        id: `old-${index}-${key || 'img'}`,
        key,
        preview: resolveImageUrl(source, 'images'),
        isNew: false,
        file: null,
      };
    })
    .filter(Boolean);

const parseInitialTags = (tags) =>
  parseArrayField(tags)
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .slice(0, MAX_TAGS);

const formatCustomDate = (value) => {
  if (!value) return 'Выбрать дату';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Выбрать дату';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const firstLine = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';

const buildEventDateIso = (mode, customDate) => {
  const now = new Date();
  const date = new Date();
  if (mode === 'today') {
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
  }
  if (mode === 'tomorrow') {
    date.setDate(now.getDate() + 1);
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
  }
  if (mode === 'custom') {
    const custom = new Date(customDate || '');
    if (!Number.isNaN(custom.getTime())) return custom.toISOString();
  }
  return null;
};

const deriveEventPreset = (value) => {
  if (!value) return { mode: 'today', custom: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { mode: 'today', custom: '' };

  const now = new Date();
  const todayPreset = new Date(now);
  todayPreset.setHours(18, 0, 0, 0);
  const tomorrowPreset = new Date(now);
  tomorrowPreset.setDate(now.getDate() + 1);
  tomorrowPreset.setHours(18, 0, 0, 0);

  const deltaToday = Math.abs(date.getTime() - todayPreset.getTime());
  const deltaTomorrow = Math.abs(date.getTime() - tomorrowPreset.getTime());
  if (deltaToday <= 45 * 60 * 1000) return { mode: 'today', custom: '' };
  if (deltaTomorrow <= 45 * 60 * 1000) return { mode: 'tomorrow', custom: '' };
  return { mode: 'custom', custom: date.toISOString() };
};

const buildRequestExpiresAtIso = (type, customDate) => {
  const now = Date.now();
  if (type === '3h') return new Date(now + 3 * 60 * 60 * 1000).toISOString();
  if (type === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (type === '3d') return new Date(now + 72 * 60 * 60 * 1000).toISOString();
  if (type === 'custom') {
    const custom = new Date(customDate || '');
    if (!Number.isNaN(custom.getTime())) return custom.toISOString();
  }
  return null;
};

const deriveRequestDeadline = (value) => {
  if (!value) return { type: '24h', custom: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { type: '24h', custom: '' };
  const diffHours = Math.round((date.getTime() - Date.now()) / (60 * 60 * 1000));
  if (Math.abs(diffHours - 3) <= 1) return { type: '3h', custom: '' };
  if (Math.abs(diffHours - 24) <= 2) return { type: '24h', custom: '' };
  if (Math.abs(diffHours - 72) <= 3) return { type: '3d', custom: '' };
  return { type: 'custom', custom: date.toISOString() };
};

const toIso = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const mapRewardTypeToUi = (value) => {
  if (value === REWARD_TYPES.MONEY) return 'money';
  if (value === REWARD_TYPES.FAVOR || value === REWARD_TYPES.GIFT) return 'barter';
  return 'none';
};

function EditContentModal({ contentType = 'post', initialData = {}, onClose, onSuccess }) {
  const isPost = contentType === 'post';
  const postCategory = initialData.category || 'news';
  const requestCategory = initialData.category || 'help';
  const categoryCapabilities =
    CREATE_CONTENT_CATEGORY_CAPABILITIES[postCategory] || CREATE_CONTENT_CATEGORY_CAPABILITIES.news;
  const categoryItem = (isPost ? CREATE_CONTENT_POST_CATEGORIES : CREATE_CONTENT_REQUEST_CATEGORIES).find(
    (item) => item.value === (isPost ? postCategory : requestCategory)
  );

  const initialText = composeSingleTextFromTitleBody(initialData?.title, initialData?.body);
  const initialEventPreset = deriveEventPreset(initialData?.event_date);
  const initialRequestDeadline = deriveRequestDeadline(initialData?.expires_at);
  const initialTags = useMemo(() => parseInitialTags(initialData?.tags), [initialData?.tags]);
  const initialImages = useMemo(() => parseInitialImages(initialData?.images), [initialData?.images]);

  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [postText, setPostText] = useState(initialText);
  const [reqText, setReqText] = useState(initialText);
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [showTagTool, setShowTagTool] = useState(false);
  const [photos, setPhotos] = useState(initialImages);
  const [processingImages, setProcessingImages] = useState([]);

  const [isAnonymous, setIsAnonymous] = useState(Boolean(initialData?.is_anonymous) || postCategory === 'confessions');
  const [lfType, setLfType] = useState(initialData?.lost_or_found || 'lost');
  const [location, setLocation] = useState(initialData?.location || initialData?.event_location || '');
  const [eventDateMode, setEventDateMode] = useState(initialEventPreset.mode);
  const [customDate, setCustomDate] = useState(initialEventPreset.custom);
  const [showEventPicker, setShowEventPicker] = useState(false);

  const poll = initialData?.poll || null;
  const pollOptions = useMemo(() => {
    const options = Array.isArray(poll?.options) ? poll.options : [];
    const values = options
      .map((item) => (typeof item === 'string' ? item : item?.text || item?.option_text || ''))
      .filter(Boolean);
    return values.length ? values : ['', ''];
  }, [poll]);
  const pollType = poll?.type || 'regular';
  const pollCorrectOption = Number.isInteger(poll?.correct_option) ? poll.correct_option : null;
  const pollMulti = Boolean(poll?.allow_multiple);
  const pollAnon = Boolean(poll?.is_anonymous);
  const [showPollSettings, setShowPollSettings] = useState(false);

  const [showReqReward, setShowReqReward] = useState(false);
  const [reqRewardType, setReqRewardType] = useState(mapRewardTypeToUi(initialData?.reward_type));
  const [reqRewardValue, setReqRewardValue] = useState(initialData?.reward_value || '');
  const [showReqDeadline, setShowReqDeadline] = useState(false);
  const [reqDeadlineType, setReqDeadlineType] = useState(initialRequestDeadline.type);
  const [reqCustomDate, setReqCustomDate] = useState(initialRequestDeadline.custom);
  const [showReqPicker, setShowReqPicker] = useState(false);

  const sheetRef = useRef(null);
  const fileInputRef = useRef(null);
  const postTextareaRef = useRef(null);
  const reqTextareaRef = useRef(null);
  const tagInputRef = useRef(null);

  const postPlaceholder =
    CREATE_CONTENT_POST_PLACEHOLDERS[postCategory] || CREATE_CONTENT_POST_PLACEHOLDERS.default;
  const requestPlaceholder =
    CREATE_CONTENT_REQUEST_PLACEHOLDERS[requestCategory] || CREATE_CONTENT_REQUEST_PLACEHOLDERS.default;
  const requestParsed = useMemo(() => parseRequestSingleText(reqText), [reqText]);
  const resolvedRequestExpiresAt = useMemo(
    () => buildRequestExpiresAtIso(reqDeadlineType, reqCustomDate),
    [reqDeadlineType, reqCustomDate]
  );

  const filteredSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    return CREATE_CONTENT_SUGGESTED_TAGS.filter((tag) => {
      if (tags.includes(tag)) return false;
      return query ? tag.includes(query) : true;
    });
  }, [tagInput, tags]);

  const baseline = useMemo(
    () => ({
      text: initialText.trim(),
      tags: initialTags,
      photos: initialImages.map((item) => item.key).filter(Boolean),
      isAnonymous: Boolean(initialData?.is_anonymous) || postCategory === 'confessions',
      lfType: initialData?.lost_or_found || 'lost',
      location: (initialData?.location || initialData?.event_location || '').trim(),
      eventDate: buildEventDateIso(initialEventPreset.mode, initialEventPreset.custom) || '',
      rewardType: mapRewardTypeToUi(initialData?.reward_type),
      rewardValue: (initialData?.reward_value || '').trim(),
      requestExpiresAt: toIso(initialData?.expires_at),
    }),
    [initialData, initialEventPreset.custom, initialEventPreset.mode, initialImages, initialTags, initialText, postCategory]
  );

  const hasChanges = useMemo(() => {
    const currentText = (isPost ? postText : reqText).trim();
    if (currentText !== baseline.text) return true;

    const currentTags = tags.join('|');
    const baselineTags = baseline.tags.join('|');
    if (currentTags !== baselineTags) return true;

    if (photos.some((photo) => photo.isNew)) return true;
    const currentPhotoKeys = photos.filter((photo) => !photo.isNew).map((photo) => photo.key).filter(Boolean);
    if (currentPhotoKeys.join('|') !== baseline.photos.join('|')) return true;

    if (isPost) {
      if (Boolean(isAnonymous) !== Boolean(baseline.isAnonymous)) return true;
      if (postCategory === 'lost_found') {
        if (lfType !== baseline.lfType) return true;
        if (location.trim() !== baseline.location) return true;
      }
      if (postCategory === 'events') {
        if (location.trim() !== baseline.location) return true;
        if ((buildEventDateIso(eventDateMode, customDate) || '') !== baseline.eventDate) return true;
      }
      return false;
    }

    if (reqRewardType !== baseline.rewardType) return true;
    if (reqRewardValue.trim() !== baseline.rewardValue) return true;
    if ((resolvedRequestExpiresAt || '') !== baseline.requestExpiresAt) return true;
    return false;
  }, [
    baseline,
    customDate,
    eventDateMode,
    isAnonymous,
    isPost,
    lfType,
    location,
    photos,
    postCategory,
    postText,
    reqRewardType,
    reqRewardValue,
    reqText,
    resolvedRequestExpiresAt,
    tags,
  ]);

  const isPostValid = () => {
    if (postCategory === 'polls') return postText.trim().length >= 3;
    if (postText.trim().length < POST_LIMITS.BODY_MIN) return false;
    if (postCategory === 'lost_found') return location.trim().length >= 3;
    if (postCategory === 'events') {
      return Boolean(buildEventDateIso(eventDateMode, customDate)) && location.trim().length >= 3;
    }
    return true;
  };

  const isRequestValid = () =>
    requestParsed.title.length >= REQUEST_LIMITS.TITLE_MIN &&
    requestParsed.body.length >= REQUEST_LIMITS.BODY_MIN &&
    Boolean(resolvedRequestExpiresAt);

  const canSend = hasChanges && (isPost ? isPostValid() : isRequestValid()) && !isSubmitting;

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById('root');
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prevBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const prevHtmlOverflow = html.style.overflow;
    const prevRootOverflow = root?.style.overflow || '';
    const shouldRestoreScroll = prevBodyStyle.position !== 'fixed';

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    html.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';

    const restoreScrollPosition = () => {
      const prevScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        setTimeout(() => {
          window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
          html.style.scrollBehavior = prevScrollBehavior;
        }, 0);
      });
    };

    return () => {
      body.style.overflow = prevBodyStyle.overflow;
      body.style.position = prevBodyStyle.position;
      body.style.top = prevBodyStyle.top;
      body.style.left = prevBodyStyle.left;
      body.style.right = prevBodyStyle.right;
      body.style.width = prevBodyStyle.width;
      html.style.overflow = prevHtmlOverflow;
      if (root) root.style.overflow = prevRootOverflow;
      if (shouldRestoreScroll) restoreScrollPosition();
    };
  }, []);

  useEffect(() => {
    if (postCategory === 'confessions') setIsAnonymous(true);
  }, [postCategory]);

  useEffect(() => {
    if (!showTagTool) return undefined;
    const timer = setTimeout(() => tagInputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [showTagTool]);

  useEffect(() => {
    if (window.innerWidth < 768 || isSubmitting) return undefined;
    const timer = setTimeout(() => {
      if (isPost) postTextareaRef.current?.focus();
      else reqTextareaRef.current?.focus();
    }, 220);
    return () => clearTimeout(timer);
  }, [isPost, isSubmitting]);

  const confirmClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (hasChanges) {
      setShowConfirmation(true);
      hapticFeedback('light');
      return;
    }
    confirmClose();
  };

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: handleClose,
    isModal: true,
    threshold: 120,
  });

  const addTag = (value) => {
    const normalized = normalizeTag(value || tagInput);
    if (!normalized || tags.includes(normalized) || tags.length >= MAX_TAGS || normalized.length > 20) return;
    setTags((prev) => [...prev, normalized]);
    setTagInput('');
    hapticFeedback('light');
  };

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (isPost && !categoryCapabilities.allowImages) {
      toast.error('В этой категории фото недоступны');
      hapticFeedback('error');
      return;
    }

    const freeSlots = MAX_IMAGES - photos.length - processingImages.length;
    if (freeSlots <= 0) {
      toast.error(`Максимум ${MAX_IMAGES} фото`);
      hapticFeedback('error');
      return;
    }

    const filesToProcess = files.slice(0, freeSlots);
    const processors = filesToProcess.map(() => ({ id: Math.random().toString(36).slice(2), progress: 0 }));
    setProcessingImages((prev) => [...prev, ...processors]);

    try {
      for (let i = 0; i < filesToProcess.length; i += 1) {
        const file = filesToProcess[i];
        const processorId = processors[i].id;
        if (!ALLOWED_FORMATS.includes(file.type)) {
          setProcessingImages((prev) => prev.filter((item) => item.id !== processorId));
          continue;
        }

        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          onProgress: (progress) =>
            setProcessingImages((prev) =>
              prev.map((item) => (item.id === processorId ? { ...item, progress } : item))
            ),
        });

        const preview = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result || '');
          reader.readAsDataURL(compressed);
        });

        setPhotos((prev) => [
          ...prev,
          {
            id: `new-${processorId}`,
            key: '',
            preview: String(preview),
            isNew: true,
            file: compressed,
          },
        ]);
        setProcessingImages((prev) => prev.filter((item) => item.id !== processorId));
      }
      hapticFeedback('success');
    } catch (uploadError) {
      console.error(uploadError);
      setProcessingImages([]);
      toast.error('Ошибка обработки фото');
      hapticFeedback('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    setError('');
    if (!canSend) {
      setError('Заполните обязательные поля');
      hapticFeedback('error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(8);

    try {
      if (isPost) {
        const parsed = postCategory === 'polls'
          ? { title: postText.trim().slice(0, POST_LIMITS.TITLE_MAX), body: postText.trim() }
          : parsePostSingleText(postText, { titleMax: POST_LIMITS.TITLE_MAX, bodyMin: POST_LIMITS.BODY_MIN });
        const formData = new FormData();
        formData.append('category', postCategory);
        formData.append('title', parsed.title || '');
        formData.append('body', parsed.body || '');
        formData.append('tags', JSON.stringify(tags));
        formData.append('is_anonymous', String(Boolean(isAnonymous)));

        if (postCategory === 'lost_found') {
          formData.append('lost_or_found', lfType);
          formData.append('item_description', (parsed.body || '').trim());
          formData.append('location', location.trim());
        }

        if (postCategory === 'events') {
          const eventDateIso = buildEventDateIso(eventDateMode, customDate);
          formData.append('event_name', firstLine(postText).slice(0, 200) || 'Событие');
          if (eventDateIso) formData.append('event_date', eventDateIso);
          formData.append('event_location', location.trim());
        }

        const keepImages = photos
          .filter((photo) => !photo.isNew)
          .map((photo) => photo.key)
          .filter(Boolean);

        photos
          .filter((photo) => photo.isNew && photo.file)
          .forEach((photo) => formData.append('new_images', photo.file));
        formData.append('keep_images', JSON.stringify(keepImages));

        const updatedPost = await updatePost(initialData.id, formData, (progressEvent) => {
          if (!progressEvent?.total) return;
          setUploadProgress(Math.round(35 + (progressEvent.loaded / progressEvent.total) * 55));
        });
        onSuccess?.(updatedPost);
        toast.success('Пост обновлён');
      } else {
        const payload = parseRequestSingleText(reqText, { titleMax: REQUEST_LIMITS.TITLE_MAX });
        const requestBody = {
          title: payload.title,
          body: payload.body,
          tags,
          expires_at: resolvedRequestExpiresAt,
        };

        if (reqRewardType === 'none') {
          requestBody.reward_type = null;
          requestBody.reward_value = null;
        } else if (reqRewardType === 'money') {
          requestBody.reward_type = REWARD_TYPES.MONEY;
          requestBody.reward_value = reqRewardValue.trim() || null;
        } else {
          requestBody.reward_type = REWARD_TYPES.FAVOR;
          requestBody.reward_value = reqRewardValue.trim() || 'Бартер';
        }

        const updatedRequest = await updateRequest(initialData.id, requestBody);
        onSuccess?.(updatedRequest);
        toast.success('Запрос обновлён');
      }

      hapticFeedback('success');
      setUploadProgress(100);
      setTimeout(confirmClose, 120);
    } catch (submitError) {
      console.error(submitError);
      const detail = submitError?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg || item.type).join(', ')
        : typeof detail === 'string'
          ? detail
          : 'Не удалось сохранить изменения';
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
      setUploadProgress(0);
      hapticFeedback('error');
    }
  };

  useTelegramScreen({
    id: `edit-content-modal-${contentType}-${initialData?.id || 'new'}`,
    title: isPost ? 'Редактирование поста' : 'Редактирование запроса',
    priority: 125,
    back: {
      visible: isVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: { visible: false, text: '', enabled: false, loading: false, onClick: undefined },
    secondary: { visible: false, text: '', enabled: false, loading: false, onClick: undefined },
  });

  if (!isMounted) return null;

  return createPortal(
    <>
      <style>{keyframeStyles}</style>
      <div style={{ ...styles.overlay, opacity: isVisible ? 1 : 0 }}>
        <div style={styles.backdrop} onClick={handleClose} />
        <div ref={sheetRef} style={{ ...styles.sheet, transform: isVisible ? 'translateY(0)' : 'translateY(100%)' }} onClick={(e) => e.stopPropagation()}>
          {isSubmitting ? <div style={{ ...styles.progress, width: `${uploadProgress}%` }} /> : null}
          <DragHandle handlers={swipeHandlers} gap={6} />

          <div className="hide-scroll" style={styles.content}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--create-text-muted)', marginBottom: 10 }}>
              {isPost ? 'Редактирование поста' : 'Редактирование запроса'}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 14,
              border: '1px solid var(--create-border)',
              background: 'var(--create-surface-elevated)',
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
            }}>
              <Lock size={14} />
              <span>{categoryItem?.icon || '📌'} {categoryItem?.label || (isPost ? 'Пост' : 'Запрос')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--create-text-muted)', fontSize: 11 }}>категория зафиксирована</span>
            </div>

            <div className="create-grow-wrap" data-replicated-value={(isPost ? postText : reqText) || ' '} style={{ marginBottom: 14 }}>
              <textarea
                ref={isPost ? postTextareaRef : reqTextareaRef}
                value={isPost ? postText : reqText}
                onChange={(e) => (isPost ? setPostText(e.target.value) : setReqText(e.target.value))}
                placeholder={isPost ? postPlaceholder : requestPlaceholder}
                className="hide-scroll create-input"
                style={styles.textarea}
                maxLength={isPost ? POST_LIMITS.BODY_MAX : REQUEST_LIMITS.BODY_MAX}
                disabled={isSubmitting}
              />
            </div>

            {tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {tags.map((tag) => (
                  <span key={tag} style={styles.tagChip}>
                    #{tag}
                    <button
                      type="button"
                      className="create-spring-btn"
                      style={styles.removeMiniBtn}
                      onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                      disabled={isSubmitting}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {(photos.length > 0 || processingImages.length > 0) ? (
              <div className="hide-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={styles.photoCard}>
                    <img src={photo.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      className="create-spring-btn"
                      style={styles.removePhotoBtn}
                      onClick={() => setPhotos((prev) => prev.filter((item) => item.id !== photo.id))}
                      disabled={isSubmitting}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {processingImages.map((processor) => (
                  <div key={processor.id} style={styles.photoCard}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--create-primary)', fontSize: 13, fontWeight: 700 }}>
                      {Math.round(processor.progress)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {isPost && postCategory === 'lost_found' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="create-spring-btn" style={lfType === 'lost' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn} onClick={() => setLfType('lost')} disabled={isSubmitting}>Потерял</button>
                  <button type="button" className="create-spring-btn" style={lfType === 'found' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn} onClick={() => setLfType('found')} disabled={isSubmitting}>Нашёл</button>
                </div>
                <div style={styles.smartInputWrap}>
                  <MapPin size={16} color="var(--create-text-muted)" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Где это было?" style={styles.smartInput} disabled={isSubmitting} />
                </div>
              </div>
            ) : null}

            {isPost && postCategory === 'events' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'today' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn} onClick={() => { setEventDateMode('today'); setShowEventPicker(false); }} disabled={isSubmitting}>Сегодня</button>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'tomorrow' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn} onClick={() => { setEventDateMode('tomorrow'); setShowEventPicker(false); }} disabled={isSubmitting}>Завтра</button>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'custom' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn} onClick={() => { setEventDateMode('custom'); setShowEventPicker(true); setShowReqPicker(false); setShowTagTool(false); }} disabled={isSubmitting}>
                    {eventDateMode === 'custom' ? formatCustomDate(customDate) : 'Своя дата'}
                  </button>
                </div>
                <div style={styles.smartInputWrap}>
                  <MapPin size={16} color="var(--create-text-muted)" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Место проведения" style={styles.smartInput} disabled={isSubmitting} />
                </div>
              </div>
            ) : null}

            {isPost && postCategory === 'confessions' ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 14,
                border: '1px solid rgba(212,255,0,0.2)',
                background: 'rgba(212,255,0,0.06)',
                padding: '10px 12px',
                marginBottom: 12,
              }}>
                <VenetianMask size={18} color="var(--create-primary)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--create-primary)' }}>Полная анонимность</div>
                  <div style={{ fontSize: 12, color: 'var(--create-text-muted)' }}>Авторство скрыто автоматически</div>
                </div>
              </div>
            ) : null}

            {isPost && (postCategory === 'polls' || poll) ? (
              <div style={styles.pollCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--create-text-muted)', fontWeight: 700 }}>ОПРОС</span>
                  <span style={{ fontSize: 11, color: 'var(--create-text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Lock size={12} /> структура фиксирована</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pollOptions.map((option, index) => (
                    <div key={`${option}-${index}`} style={styles.pollRow}>
                      <span style={{ display: 'flex', color: 'var(--create-text-muted)' }}>
                        {pollType === 'quiz'
                          ? (pollCorrectOption === index ? <CheckCircle size={18} /> : <Circle size={18} />)
                          : <BarChart2 size={16} />}
                      </span>
                      <span style={{ fontSize: 14 }}>{option || `Вариант ${index + 1}`}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="create-spring-btn" style={{ marginTop: 10, border: 'none', background: 'transparent', color: 'var(--create-text-muted)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, cursor: 'pointer' }} onClick={() => setShowPollSettings((prev) => !prev)} disabled={isSubmitting}>
                  <Settings size={14} /> Настройки
                </button>
                {showPollSettings ? (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={styles.pollFlag}><HelpCircle size={12} /> {pollType === 'quiz' ? 'Викторина' : 'Опрос'}</span>
                    <span style={styles.pollFlag}><Users size={12} /> {pollMulti ? 'Мультивыбор' : 'Один выбор'}</span>
                    <span style={styles.pollFlag}><VenetianMask size={12} /> {pollAnon ? 'Анонимный' : 'Публичный'}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

            <div style={{ height: 150 }} />
          </div>

          <div style={styles.bottomDock}>
            {showTagTool ? (
              <div style={styles.popup}>
                <div className="hide-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10 }}>
                  {filteredSuggestions.length ? filteredSuggestions.map((tag) => (
                    <button key={tag} type="button" className="create-spring-btn" style={styles.suggestionBtn} onClick={() => addTag(tag)} disabled={isSubmitting}>
                      #{tag}
                    </button>
                  )) : <span style={{ color: 'var(--create-text-muted)', fontSize: 12 }}>Нет подсказок</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={styles.tagInputWrap}>
                    <Hash size={15} color="var(--create-text-muted)" />
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Свой тег"
                      style={styles.tagInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  <button type="button" className="create-spring-btn" style={tagInput.trim() ? { ...styles.toolBtn, ...styles.sendBtnActive } : styles.toolBtn} onClick={() => addTag()} disabled={isSubmitting}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ) : null}

            {!isPost && showReqReward ? (
              <div style={styles.popup}>
                <div style={styles.popupTitle}>НАГРАДА</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {CREATE_CONTENT_REQUEST_REWARD_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className="create-spring-btn" style={reqRewardType === option.value ? { ...styles.optionBtn, ...styles.optionBtnActive } : styles.optionBtn} onClick={() => setReqRewardType(option.value)} disabled={isSubmitting}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {reqRewardType !== 'none' ? (
                  <input value={reqRewardValue} onChange={(e) => setReqRewardValue(e.target.value)} placeholder={reqRewardType === 'money' ? 'Например: 500₽' : 'Что предлагаете?'} style={styles.popupInput} disabled={isSubmitting} />
                ) : null}
              </div>
            ) : null}

            {!isPost && showReqDeadline ? (
              <div style={styles.popup}>
                <div style={styles.popupTitle}>АКТУАЛЬНО ДО</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CREATE_CONTENT_REQUEST_DEADLINE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className="create-spring-btn" style={reqDeadlineType === option.value ? { ...styles.optionBtn, ...styles.optionBtnActive } : styles.optionBtn} onClick={() => { setReqDeadlineType(option.value); setShowReqPicker(false); }} disabled={isSubmitting}>
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="create-spring-btn"
                    style={reqDeadlineType === 'custom' ? { ...styles.optionBtn, ...styles.optionBtnActive } : styles.optionBtn}
                    onClick={() => {
                      setReqDeadlineType('custom');
                      setShowReqPicker(true);
                      setShowEventPicker(false);
                    }}
                    disabled={isSubmitting}
                  >
                    {reqDeadlineType === 'custom' ? formatCustomDate(reqCustomDate) : 'Своя дата'}
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div style={styles.errorBar}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            ) : null}

            <div style={styles.toolbar}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="create-spring-btn" style={styles.toolBtn} onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                  <ImageIcon size={18} />
                </button>
                <button type="button" className="create-spring-btn" style={showTagTool ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowTagTool((prev) => !prev); setShowReqReward(false); setShowReqDeadline(false); }} disabled={isSubmitting}>
                  <Hash size={18} />
                </button>
                {isPost ? (
                  <button type="button" className="create-spring-btn" style={showPollSettings ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => setShowPollSettings((prev) => !prev)} disabled={isSubmitting || !(postCategory === 'polls' || poll)}>
                    <BarChart2 size={18} />
                  </button>
                ) : (
                  <button type="button" className="create-spring-btn" style={showReqReward ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowReqReward((prev) => !prev); setShowReqDeadline(false); setShowTagTool(false); }} disabled={isSubmitting}>
                    <Gift size={18} />
                  </button>
                )}
                {isPost ? (
                  <button type="button" className="create-spring-btn" style={isAnonymous ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => setIsAnonymous((prev) => !prev)} disabled={isSubmitting || postCategory === 'confessions'}>
                    <VenetianMask size={18} />
                  </button>
                ) : (
                  <button type="button" className="create-spring-btn" style={showReqDeadline ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowReqDeadline((prev) => !prev); setShowReqReward(false); setShowTagTool(false); }} disabled={isSubmitting}>
                    <Clock size={18} />
                  </button>
                )}
              </div>

              <button type="button" className="create-spring-btn" style={canSend ? { ...styles.sendBtn, ...styles.sendBtnActive } : styles.sendBtn} onClick={handleSubmit} disabled={!canSend}>
                {isPost ? <Check size={18} strokeWidth={2.5} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(showEventPicker || showReqPicker) ? (
        <div style={styles.pickerOverlay}>
          <div style={styles.pickerBackdrop} onClick={() => { setShowEventPicker(false); setShowReqPicker(false); }} />
          <div style={styles.pickerSheet}>
            <SmartDatePicker
              initialDate={showEventPicker ? (customDate || new Date().toISOString()) : (reqCustomDate || new Date().toISOString())}
              onCancel={() => { setShowEventPicker(false); setShowReqPicker(false); }}
              onSave={(value) => {
                if (showEventPicker) {
                  setCustomDate(value);
                  setEventDateMode('custom');
                  setShowEventPicker(false);
                } else {
                  setReqCustomDate(value);
                  setReqDeadlineType('custom');
                  setShowReqPicker(false);
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Отменить изменения?"
        message="Несохранённые правки будут потеряны."
        confirmText="Выйти"
        cancelText="Остаться"
        confirmType="danger"
        onCancel={() => setShowConfirmation(false)}
        onConfirm={confirmClose}
      />
    </>,
    document.body
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: getOverlayZIndex(Z_MODAL_EDIT_POST), transition: 'opacity 0.3s ease' },
  backdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(2px)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '92%',
    background: 'var(--create-surface)',
    borderTop: '1px solid var(--create-border)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
    boxShadow: '0 -20px 60px rgba(0,0,0,0.65)',
  },
  progress: { position: 'absolute', top: 0, left: 0, height: 3, background: 'linear-gradient(90deg, #D4FF00 0%, #8fff00 100%)' },
  content: { flex: 1, padding: '0 16px 16px', overflowY: 'auto', overflowX: 'hidden', color: '#fff', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' },
  textarea: {
    width: '100%',
    minHeight: 84,
    border: 'none',
    resize: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.4,
    padding: 0,
    outline: 'none',
    fontFamily: 'inherit',
  },
  tagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 13,
    fontWeight: 600,
  },
  removeMiniBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(24,24,26,0.86)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  photoCard: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid var(--create-border)',
    background: 'var(--create-surface-elevated)',
    flexShrink: 0,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(24,24,26,0.86)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  switchBtn: {
    flex: 1,
    border: '1px solid var(--create-border)',
    borderRadius: 12,
    background: 'var(--create-surface-elevated)',
    color: 'var(--create-text-muted)',
    padding: '10px 6px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  switchBtnActive: {
    border: '1px solid var(--create-primary)',
    background: 'rgba(212,255,0,0.12)',
    color: 'var(--create-primary)',
  },
  smartInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    border: '1px solid var(--create-border)',
    background: 'var(--create-surface-elevated)',
    padding: '0 10px',
  },
  smartInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    padding: '12px 0',
    outline: 'none',
  },
  pollCard: {
    borderRadius: 14,
    border: '1px solid var(--create-border)',
    background: 'var(--create-surface-elevated)',
    padding: 12,
    marginBottom: 12,
  },
  pollRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.04)',
    padding: '8px 10px',
  },
  pollFlag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '5px 9px',
    fontSize: 12,
    color: 'var(--create-text-muted)',
  },
  bottomDock: { position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 8 },
  popup: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    zIndex: 10,
    padding: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTop: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(28,28,30,0.95)',
    backdropFilter: 'blur(18px)',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
  },
  suggestionBtn: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 10px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  tagInputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.4)',
    padding: '8px 10px',
  },
  tagInput: { flex: 1, border: 'none', background: 'transparent', color: '#fff', fontSize: 14, outline: 'none' },
  popupTitle: { fontSize: 12, fontWeight: 700, color: 'var(--create-text-muted)', marginBottom: 10, letterSpacing: 0.3 },
  optionBtn: {
    minWidth: 82,
    borderRadius: 12,
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--create-text-muted)',
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  optionBtnActive: { border: '1px solid var(--create-primary)', color: 'var(--create-primary)', background: 'rgba(212,255,0,0.08)' },
  popupInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.4)',
    color: '#fff',
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
  },
  errorBar: {
    margin: '0 12px 10px',
    borderRadius: 12,
    border: '1px solid rgba(255,69,58,0.35)',
    background: 'rgba(255,69,58,0.14)',
    color: '#ffb0aa',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  toolbar: {
    padding: '10px 14px calc(10px + var(--screen-bottom-offset))',
    borderTop: '1px solid var(--create-border)',
    background: 'var(--create-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    border: 'none',
    background: 'var(--create-surface-elevated)',
    color: 'var(--create-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  toolBtnActive: { background: 'rgba(212,255,0,0.16)', color: 'var(--create-primary)' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    border: 'none',
    background: 'var(--create-surface-elevated)',
    color: 'var(--create-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  sendBtnActive: { background: 'var(--create-primary)', color: '#000' },
  pickerOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: getOverlayZIndex(Z_MODAL_EDIT_POST) + 3,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  pickerBackdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' },
  pickerSheet: {
    position: 'relative',
    borderTop: '1px solid var(--create-border)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    background: 'var(--create-surface)',
    padding: '20px 16px calc(var(--screen-bottom-offset) + 16px)',
  },
};

const keyframeStyles = `
:root {
  --create-primary: ${theme.colors.premium.primary};
  --create-surface: ${theme.colors.premium.surfaceElevated};
  --create-surface-elevated: ${theme.colors.premium.surfaceHover};
  --create-border: ${theme.colors.premium.border};
  --create-text-muted: ${theme.colors.premium.textMuted};
}

.create-spring-btn {
  transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s, background-color 0.2s, border-color 0.2s;
}

.create-spring-btn:active {
  transform: scale(0.92);
  opacity: 0.85;
}

.hide-scroll::-webkit-scrollbar { display: none; }
.hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

.create-grow-wrap { display: grid; }
.create-grow-wrap::after {
  content: attr(data-replicated-value) " ";
  visibility: hidden;
  white-space: pre-wrap;
  min-height: 84px;
}
.create-grow-wrap > textarea,
.create-grow-wrap::after {
  grid-area: 1 / 1 / 2 / 2;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  font-family: inherit;
  word-break: break-word;
}

.create-input::placeholder { color: #666; }
`;

export default EditContentModal;
