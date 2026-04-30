import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BarChart2,
  CheckCircle,
  Circle,
  Clock,
  Gift,
  Hash,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  MapPin,
  Play,
  Plus,
  Loader2,
  Users,
  X,
} from 'lucide-react';
import IncognitoIcon from '../icons/IncognitoIcon';
import { compressImage } from '../../utils/media';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from '../shared/SwipeableModal';
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
import { isVideoFileCandidate, validateVideoFile } from '../../utils/videoValidation';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { composeSingleTextFromTitleBody } from '../../utils/contentTextParser';
import { toast } from '../shared/Toast';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import SmartDatePicker from '../shared/SmartDatePicker';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { modalBoundaryProps, modalTouchBoundaryHandlers } from '../../utils/modalEventBoundary';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BOTTOM_SHEET_EXIT_MS, BOTTOM_SHEET_TRANSITION } from '../../hooks/useBottomSheetModal';

const MAX_IMAGES = POST_LIMITS.IMAGES_MAX;
const MAX_TAGS = POST_LIMITS.TAGS_MAX;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;
const TOOL_ICON_SIZE = 26;

const normalizeTag = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zа-яё0-9_-]/gi, '');

const countLetters = (raw) => (String(raw || '').match(/[a-zа-яё]/gi) || []).length;

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

function EditPostModal({ contentType = 'post', initialData = {}, onClose, onSuccess }) {
  useBodyScrollLock();

  const isPost = contentType === 'post';
  const postCategory = initialData.category || 'news';
  const requestCategory = initialData.category || 'help';
  const categoryCapabilities =
    CREATE_CONTENT_CATEGORY_CAPABILITIES[postCategory] || CREATE_CONTENT_CATEGORY_CAPABILITIES.news;
  const categoryItem = (isPost ? CREATE_CONTENT_POST_CATEGORIES : CREATE_CONTENT_REQUEST_CATEGORIES).find(
    (item) => item.value === (isPost ? postCategory : requestCategory)
  );

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

  const [postTitle, setPostTitle] = useState(initialData?.title || '');
  const [postBody, setPostBody] = useState(
    initialData?.category === 'polls'
      ? (initialData?.body || '')
      : composeSingleTextFromTitleBody(initialData?.title || '', initialData?.body || '')
  );
  const [reqTitle, setReqTitle] = useState(initialData?.title || '');
  const [reqBody, setReqBody] = useState(initialData?.body || '');
  const [videoFile, setVideoFile] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
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
  const [activePicker, setActivePicker] = useState(null);
  const [isPickerSheetOpen, setIsPickerSheetOpen] = useState(false);
  const pickerCloseTimerRef = useRef(null);

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

  const [showReqReward, setShowReqReward] = useState(false);
  const [reqRewardType, setReqRewardType] = useState(mapRewardTypeToUi(initialData?.reward_type));
  const [reqRewardValue, setReqRewardValue] = useState(initialData?.reward_value || '');
  const [showReqDeadline, setShowReqDeadline] = useState(false);
  const [reqDeadlineType, setReqDeadlineType] = useState(initialRequestDeadline.type);
  const [reqCustomDate, setReqCustomDate] = useState(initialRequestDeadline.custom);

  const openPicker = (which) => {
    clearTimeout(pickerCloseTimerRef.current);
    setActivePicker(which);
    setIsPickerSheetOpen(true);
  };

  const closePicker = () => {
    setIsPickerSheetOpen(false);
    clearTimeout(pickerCloseTimerRef.current);
    pickerCloseTimerRef.current = setTimeout(() => setActivePicker(null), 300);
  };

  const sheetRef = useRef(null);
  const dragHandleRef = useRef(null);
  const fileInputRef = useRef(null);
  const postTextareaRef = useRef(null);
  const reqTextareaRef = useRef(null);
  const tagInputRef = useRef(null);

  const postPlaceholder =
    CREATE_CONTENT_POST_PLACEHOLDERS[postCategory] || CREATE_CONTENT_POST_PLACEHOLDERS.default;
  const requestPlaceholder =
    CREATE_CONTENT_REQUEST_PLACEHOLDERS[requestCategory] || CREATE_CONTENT_REQUEST_PLACEHOLDERS.default;
  // requestParsed removed — using reqTitle/reqBody directly
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
      title: (initialData?.title || '').trim(),
      body: (isPost && initialData?.category !== 'polls')
        ? composeSingleTextFromTitleBody(initialData?.title || '', initialData?.body || '').trim()
        : (initialData?.body || '').trim(),
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
    [initialData, initialEventPreset.custom, initialEventPreset.mode, initialImages, initialTags, postCategory, isPost]
  );

  const hasChanges = useMemo(() => {
    const currentTitle = (isPost ? postTitle : reqTitle).trim();
    const currentBody = (isPost ? postBody : reqBody).trim();
    if (currentTitle !== baseline.title) return true;
    if (currentBody !== baseline.body) return true;

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
    postTitle,
    postBody,
    reqTitle,
    reqBody,
    reqRewardType,
    reqRewardValue,
    resolvedRequestExpiresAt,
    tags,
  ]);

  const isPostValid = () => {
    if (postCategory === 'polls') return postTitle.trim().length >= 3;
    if (postCategory === 'memes') return photos.length > 0 || countLetters(postBody) >= 3;
    if (postBody.trim().length < POST_LIMITS.BODY_MIN) return false;
    if (postCategory === 'lost_found') return location.trim().length >= 3;
    if (postCategory === 'events') {
      return Boolean(buildEventDateIso(eventDateMode, customDate)) && location.trim().length >= 3;
    }
    return true;
  };

  const isRequestValid = () =>
    reqTitle.trim().length >= REQUEST_LIMITS.TITLE_MIN &&
    reqBody.trim().length >= REQUEST_LIMITS.BODY_MIN &&
    Boolean(resolvedRequestExpiresAt);

  const canSend = hasChanges && (isPost ? isPostValid() : isRequestValid()) && !isSubmitting;

  const computeProgress = () => {
    if (!hasChanges) return 0;
    const segs = [];
    if (isPost) {
      if (postCategory === 'polls') {
        segs.push({ w: 60, v: postTitle.trim().length >= 3 ? 1 : 0 });
      } else if (postCategory === 'memes') {
        segs.push({ w: 60, v: (photos.length > 0 || countLetters(postBody) >= 3) ? 1 : 0 });
      } else {
        segs.push({ w: 60, v: Math.min(1, postBody.trim().length / POST_LIMITS.BODY_MIN) });
      }
      if (postCategory === 'events') {
        segs.push({ w: 20, v: buildEventDateIso(eventDateMode, customDate) ? 1 : 0 });
        segs.push({ w: 20, v: location.trim().length >= 3 ? 1 : 0 });
      } else if (postCategory === 'lost_found') {
        segs.push({ w: 40, v: location.trim().length >= 3 ? 1 : 0 });
      }
    } else {
      segs.push({ w: 40, v: Math.min(1, reqTitle.trim().length / REQUEST_LIMITS.TITLE_MIN) });
      segs.push({ w: 40, v: Math.min(1, reqBody.trim().length / REQUEST_LIMITS.BODY_MIN) });
      segs.push({ w: 20, v: resolvedRequestExpiresAt ? 1 : 0 });
    }
    const total = segs.reduce((s, seg) => s + seg.w, 0);
    const filled = segs.reduce((s, seg) => s + seg.w * seg.v, 0);
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  };

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
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
    setTimeout(onClose, BOTTOM_SHEET_EXIT_MS);
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
    activationRef: dragHandleRef,
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

  const captureVideoThumbnail = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    video.currentTime = 1;
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', 0.7));
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.load();
  });

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (isPost && !categoryCapabilities.allowImages) {
      toast.error('В этой категории фото недоступны');
      hapticFeedback('error');
      return;
    }

    // Видео-файл — обработать отдельно
    const videoCandidate = files.find((f) => isVideoFileCandidate(f));
    if (videoCandidate) {
      const validation = await validateVideoFile(videoCandidate);
      if (!validation.valid) {
        hapticFeedback('error');
        toast.error(validation.error);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setVideoFile(videoCandidate);
      captureVideoThumbnail(videoCandidate).then(setVideoThumb);
      hapticFeedback('success');
      if (fileInputRef.current) fileInputRef.current.value = '';
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

    const failedFiles = [];

    for (let i = 0; i < filesToProcess.length; i += 1) {
      const file = filesToProcess[i];
      const processorId = processors[i].id;

      try {
        if (file.type && !ALLOWED_FORMATS.includes(file.type) && !['image/jpg', 'image/heic', 'image/heif'].includes(file.type)) {
          throw new Error('недопустимый формат');
        }

        const compressed = await compressImage(file, (progress) =>
          setProcessingImages((prev) =>
            prev.map((item) => (item.id === processorId ? { ...item, progress } : item))
          )
        );

        const preview = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result || '');
          reader.onerror = () => reject(new Error('не удалось прочитать файл'));
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
      } catch (uploadError) {
        failedFiles.push({
          name: file?.name || `Файл ${i + 1}`,
          message: uploadError?.message || 'не удалось обработать',
        });
      } finally {
        setProcessingImages((prev) => prev.filter((item) => item.id !== processorId));
      }
    }

    if (failedFiles.length > 0) {
      const preview = failedFiles.slice(0, 2).map((item) => `${item.name}: ${item.message}`).join('; ');
      const suffix = failedFiles.length > 2 ? `; ещё ${failedFiles.length - 2}` : '';
      toast.warning(`Добавлено ${filesToProcess.length - failedFiles.length} из ${filesToProcess.length}. Не добавлено ${failedFiles.length}. ${preview}${suffix}`);
    }
    hapticFeedback(failedFiles.length < filesToProcess.length ? 'success' : 'error');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
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
        const formData = new FormData();
        formData.append('category', postCategory);
        if (postCategory === 'polls') {
          const question = postTitle.trim() || 'Опрос';
          formData.append('title', question.slice(0, POST_LIMITS.TITLE_MAX));
          formData.append('body', question);
        } else {
          formData.append('title', '');
          formData.append('body', postBody.trim());
        }
        formData.append('tags', JSON.stringify(tags));
        formData.append('is_anonymous', String(Boolean(isAnonymous)));

        if (postCategory === 'lost_found') {
          formData.append('lost_or_found', lfType);
          formData.append('item_description', postBody.trim());
          formData.append('location', location.trim());
        }

        if (postCategory === 'events') {
          const eventDateIso = buildEventDateIso(eventDateMode, customDate);
          formData.append('event_name', (postBody.trim().split('\n')[0] || postBody.trim()).slice(0, 200) || 'Событие');
          if (eventDateIso) formData.append('event_date', eventDateIso);
          formData.append('event_location', location.trim());
        }

        if (videoFile) formData.append('video', videoFile);

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
        const requestBody = {
          title: reqTitle.trim(),
          body: reqBody.trim(),
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

  const sendProgress = computeProgress();

  return createPortal(
    <>
      <style>{keyframeStyles}</style>
      <div
        {...modalBoundaryProps}
        {...modalTouchBoundaryHandlers}
        style={{ ...styles.overlay, opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none' }}
      >
        <div style={styles.backdrop} onClick={handleClose} />
        <div ref={sheetRef} style={{ ...styles.sheet, transform: isVisible ? 'translateY(0)' : 'translateY(100%)' }} onClick={(e) => e.stopPropagation()}>
          {isSubmitting && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
            </div>
          )}
          <DragHandle handlers={swipeHandlers} handleRef={dragHandleRef} gap={6} />

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
              <span>{categoryItem?.icon || '📌'} {categoryItem?.label || (isPost ? 'Пост' : 'Запрос')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--create-text-muted)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> не редактируется</span>
            </div>

            {!isPost && (
              <input
                type="text"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Заголовок запроса..."
                style={styles.reqTitleInput}
                maxLength={POST_LIMITS.TITLE_MAX}
                disabled={isSubmitting}
              />
            )}
            <div
              className="create-grow-wrap"
              data-replicated-value={(isPost ? (postCategory === 'polls' ? postTitle : postBody) : reqBody) || ' '}
              style={{ marginBottom: 16 }}
            >
              <textarea
                ref={isPost ? postTextareaRef : reqTextareaRef}
                value={isPost ? (postCategory === 'polls' ? postTitle : postBody) : reqBody}
                onChange={(e) => {
                  if (isPost) {
                    if (postCategory === 'polls') setPostTitle(e.target.value);
                    else setPostBody(e.target.value);
                  } else {
                    setReqBody(e.target.value);
                  }
                }}
                placeholder={isPost ? postPlaceholder : requestPlaceholder}
                className="hide-scroll create-post-input"
                style={isPost ? styles.postTextareaInput : styles.requestTextareaInput}
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

            {videoFile && (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: photos.length > 0 || processingImages.length > 0 ? 8 : 16, background: '#111' }}>
                {videoThumb
                  ? <img src={videoThumb} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: 130, background: '#1a1a1a' }} />
                }
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', padding: '24px 10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Видео · {(videoFile.size / 1024 / 1024).toFixed(1)} МБ</span>
                  <button
                    type="button"
                    className="create-spring-btn"
                    onClick={() => { setVideoFile(null); setVideoThumb(null); }}
                    style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: 0 }}
                    disabled={isSubmitting}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {(photos.length > 0 || processingImages.length > 0) && (
              <div className="hide-scroll smart-block" style={styles.photoRow}>
                {photos.map((photo) => (
                  <div key={photo.id} style={styles.photoCard}>
                    <img src={photo.preview} alt="" style={styles.photoImage} />
                    <button
                      type="button"
                      className="create-spring-btn"
                      style={styles.removePhotoBtn}
                      onClick={() => setPhotos((prev) => prev.filter((item) => item.id !== photo.id))}
                      disabled={isSubmitting}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {processingImages.map((processor) => (
                  <div key={processor.id} style={styles.photoCard}>
                    <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--create-primary)', fontSize: 13, fontWeight: 700 }}>
                      {Math.round(processor.progress)}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isPost && postCategory === 'lost_found' ? (
              <div style={styles.smartWrap}>
                <div style={styles.lfRow}>
                  <button type="button" className="create-spring-btn" style={lfType === 'lost' ? { ...styles.lfBtn, ...styles.lfBtnLost } : styles.lfBtn} onClick={() => setLfType('lost')} disabled={isSubmitting}>😢 Потерял</button>
                  <button type="button" className="create-spring-btn" style={lfType === 'found' ? { ...styles.lfBtn, ...styles.lfBtnFound } : styles.lfBtn} onClick={() => setLfType('found')} disabled={isSubmitting}>🎉 Нашёл</button>
                </div>
                <div style={styles.smartInputWrap}>
                  <MapPin size={18} color="var(--create-text-muted)" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Где это было?" style={styles.smartInput} disabled={isSubmitting} />
                </div>
              </div>
            ) : null}

            {isPost && postCategory === 'events' ? (
              <div style={styles.smartWrap}>
                <div style={styles.eventRow}>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'today' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn} onClick={() => { setEventDateMode('today'); closePicker(); }} disabled={isSubmitting}>Сегодня</button>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'tomorrow' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn} onClick={() => { setEventDateMode('tomorrow'); closePicker(); }} disabled={isSubmitting}>Завтра</button>
                  <button type="button" className="create-spring-btn" style={eventDateMode === 'custom' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn} onClick={() => { setEventDateMode('custom'); openPicker('event'); setShowTagTool(false); }} disabled={isSubmitting}>
                    {eventDateMode === 'custom' ? formatCustomDate(customDate) : 'Своя дата'}
                  </button>
                </div>
                <div style={styles.smartInputWrap}>
                  <MapPin size={18} color="var(--create-text-muted)" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Место проведения" style={styles.smartInput} disabled={isSubmitting} />
                </div>
              </div>
            ) : null}

            {isPost && (isAnonymous || postCategory === 'confessions') ? (
              <div style={styles.anonBlock}>
                <div style={styles.anonRow}>
                  <IncognitoIcon size={24} showCircle={false} shapeColor="var(--create-primary)" style={{ flexShrink: 0 }} />
                  <div style={styles.anonInfo}>
                    <div style={styles.anonTitle}>{postCategory === 'confessions' ? 'Полная анонимность' : 'Анонимный пост'}</div>
                    <div style={styles.anonSubtitle}>Авторство будет скрыто</div>
                  </div>
                </div>
              </div>
            ) : null}

            {isPost && (postCategory === 'polls' || poll) ? (
              <div style={{ ...styles.pollCard, ...(poll ? { border: 'none' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--create-text-muted)', fontWeight: 700 }}>ОПРОС</span>
                  <span style={{ fontSize: 11, color: 'var(--create-text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Lock size={12} /> не редактируется</span>
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
                <div style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  ...(poll ? {
                    marginLeft: -12, marginRight: -12, marginBottom: -12,
                    padding: '8px 12px 10px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottomLeftRadius: 14,
                    borderBottomRightRadius: 14,
                  } : {}),
                }}>
                  <span style={styles.pollFlag}><HelpCircle size={12} /> {pollType === 'quiz' ? 'Викторина' : 'Опрос'}</span>
                  <span style={styles.pollFlag}><Users size={12} /> {pollMulti ? 'Мультивыбор' : 'Один выбор'}</span>
                  <span style={styles.pollFlag}><IncognitoIcon size={12} showCircle={false} shapeColor="currentColor" /> {pollAnon ? 'Анонимный' : 'Публичный'}</span>
                </div>
              </div>
            ) : null}

            <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

            <div style={{ height: 200 }} />
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
                    <button key={option.value} type="button" className="create-spring-btn" style={reqDeadlineType === option.value ? { ...styles.optionBtn, ...styles.optionBtnActive } : styles.optionBtn} onClick={() => { setReqDeadlineType(option.value); closePicker(); }} disabled={isSubmitting}>
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="create-spring-btn"
                    style={reqDeadlineType === 'custom' ? { ...styles.optionBtn, ...styles.optionBtnActive } : styles.optionBtn}
                    onClick={() => {
                      setReqDeadlineType('custom');
                      openPicker('req');
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
                  <ImageIcon size={TOOL_ICON_SIZE} />
                </button>
                <button type="button" className="create-spring-btn" style={showTagTool ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowTagTool((prev) => !prev); setShowReqReward(false); setShowReqDeadline(false); }} disabled={isSubmitting}>
                  <Hash size={TOOL_ICON_SIZE} />
                </button>
                {isPost ? (
                  <button type="button" style={{ ...styles.toolBtn, opacity: 0.35, cursor: 'default' }} disabled>
                    <BarChart2 size={TOOL_ICON_SIZE} />
                  </button>
                ) : (
                  <button type="button" className="create-spring-btn" style={showReqReward ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowReqReward((prev) => !prev); setShowReqDeadline(false); setShowTagTool(false); }} disabled={isSubmitting}>
                    <Gift size={TOOL_ICON_SIZE} />
                  </button>
                )}
                {isPost ? (
                  <button type="button" style={{ ...styles.toolBtn, ...(isAnonymous ? styles.toolBtnActive : {}), opacity: 0.35, cursor: 'default' }} disabled>
                    <IncognitoIcon size={TOOL_ICON_SIZE} showCircle={false} shapeColor="currentColor" />
                  </button>
                ) : (
                  <button type="button" className="create-spring-btn" style={showReqDeadline ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} onClick={() => { setShowReqDeadline((prev) => !prev); setShowReqReward(false); setShowTagTool(false); }} disabled={isSubmitting}>
                    <Clock size={TOOL_ICON_SIZE} />
                  </button>
                )}
              </div>
            </div>

            <div style={styles.publishBtnWrap}>
              <button
                type="button"
                className="create-spring-btn"
                style={styles.publishBtn}
                onClick={handleSubmit}
                disabled={!canSend}
              >
                <div style={{ ...styles.publishFill, width: `${sendProgress}%` }} />
                <span style={{ position: 'relative', zIndex: 1, color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSubmitting ? <><Loader2 size={18} style={{ animation: 'createSpin 0.7s linear infinite' }} /> Сохраняем...</> : 'Сохранить'}
                </span>
                <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sendProgress}% 0 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transition: 'clip-path 0.35s ease', pointerEvents: 'none' }}>
                  <span style={{ color: '#000', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSubmitting ? <><Loader2 size={18} style={{ animation: 'createSpin 0.7s linear infinite' }} /> Сохраняем...</> : 'Сохранить'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...styles.pickerOverlay, pointerEvents: (isPickerSheetOpen || activePicker !== null) ? 'auto' : 'none' }}>
        <div
          style={{ ...styles.pickerBackdrop, opacity: isPickerSheetOpen ? 1 : 0 }}
          onClick={closePicker}
        />
        <div style={{
          ...styles.pickerSheet,
          transform: isPickerSheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: isPickerSheetOpen
            ? 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 0.25s ease-in',
        }}>
          {activePicker === 'event' && (
            <SmartDatePicker
              initialDate={customDate || new Date().toISOString()}
              onCancel={closePicker}
              onSave={(value) => {
                setCustomDate(value);
                setEventDateMode('custom');
                closePicker();
              }}
            />
          )}
          {activePicker === 'req' && (
            <SmartDatePicker
              initialDate={reqCustomDate || new Date().toISOString()}
              onCancel={closePicker}
              onSave={(value) => {
                setReqCustomDate(value);
                setReqDeadlineType('custom');
                closePicker();
              }}
            />
          )}
        </div>
      </div>

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
  overlay: { position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)', zIndex: getOverlayZIndex(Z_MODAL_EDIT_POST), transition: 'opacity 0.3s ease' },
  backdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '90%',
    background: 'var(--create-surface)',
    borderTop: '1px solid var(--create-border)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: BOTTOM_SHEET_TRANSITION,
    boxShadow: '0 -20px 60px rgba(0,0,0,0.65)',
  },
  progressBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', zIndex: 2 },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #D4FF00 0%, #8fff00 100%)', transition: 'width 0.3s ease' },
  content: { flex: 1, padding: '0 16px 16px', overflowY: 'auto', overflowX: 'hidden', color: '#fff', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' },
  postTitleInput: {
    width: '100%', border: 'none', background: 'transparent',
    color: '#fff', caretColor: '#fff',
    fontSize: 22, fontWeight: 700, lineHeight: 1.3, padding: 0, outline: 'none', fontFamily: 'inherit', marginBottom: 12,
  },
  postTextareaInput: {
    width: '100%', minHeight: 76, resize: 'none', overflow: 'hidden', border: 'none', background: 'transparent',
    color: '#fff', caretColor: '#fff',
    fontSize: 16, fontWeight: 400, lineHeight: 1.4, padding: 0, outline: 'none', fontFamily: 'inherit',
  },
  reqTitleInput: {
    width: '100%', border: 'none', background: 'transparent',
    color: '#fff', caretColor: '#fff',
    fontSize: 22, fontWeight: 700, lineHeight: 1.3, padding: 0, outline: 'none', fontFamily: 'inherit', marginBottom: 12,
  },
  requestTextareaInput: {
    width: '100%', minHeight: 76, resize: 'none', overflow: 'hidden', border: 'none', background: 'transparent',
    color: '#fff', caretColor: '#fff',
    fontSize: 16, fontWeight: 400, lineHeight: 1.4, padding: 0, outline: 'none', fontFamily: 'inherit',
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
  photoRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 16,
  },
  photoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  photoImage: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 16,
    border: '1px solid var(--create-border)',
  },
  removePhotoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    flexShrink: 0,
  },
  anonBlock: { borderRadius: 16, background: 'rgba(212,255,0,0.05)', border: '1px solid rgba(212,255,0,0.2)', marginBottom: 16, overflow: 'hidden' },
  anonRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' },
  anonInfo: { flex: 1 },
  anonTitle: { fontSize: 14, fontWeight: 700, color: 'var(--create-primary)' },
  anonSubtitle: { fontSize: 12, color: 'var(--create-text-muted)', marginTop: 1 },
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
    background: 'var(--create-surface-elevated)',
    border: '1px solid var(--create-border)',
    borderRadius: 12,
    padding: '0 12px',
  },
  smartInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    padding: '12px 8px',
    fontSize: 15,
    outline: 'none',
  },
  smartWrap: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 },
  lfRow: { display: 'flex', background: 'var(--create-surface-elevated)', borderRadius: 12, padding: 4 },
  lfBtn: { flex: 1, borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: 'var(--create-text-muted)', fontWeight: 600, fontSize: 14, padding: 10, cursor: 'pointer' },
  lfBtnLost: { color: '#FF453A', background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)' },
  lfBtnFound: { color: '#32D74B', background: 'rgba(50,215,75,0.15)', border: '1px solid rgba(50,215,75,0.3)' },
  eventRow: { display: 'flex', gap: 8 },
  eventBtn: { flex: 1, border: 'none', borderRadius: 12, background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', padding: '10px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  eventBtnActive: { background: 'var(--create-primary)', color: '#000' },
  pollCard: {
    borderRadius: 14,
    border: '1px solid var(--create-border)',
    background: 'var(--create-surface-elevated)',
    padding: 12,
    marginBottom: 12,
    overflow: 'hidden',
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
    padding: '16px',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1px solid rgba(255,255,255,0.1)',
    background: 'var(--create-surface)',
    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
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
    padding: '10px 16px',
    background: 'var(--create-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 20,
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
  toolBtnActive: { background: 'rgba(212,255,0,0.15)', color: 'var(--create-primary)' },
  publishBtnWrap: { padding: '8px 16px', paddingBottom: 'calc(10px + var(--screen-bottom-offset))', background: 'var(--create-surface)', position: 'relative', zIndex: 20 },
  publishBtn: { position: 'relative', width: '100%', height: 52, borderRadius: 26, border: 'none', background: 'var(--create-surface-elevated)', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.35)' },
  publishFill: { position: 'absolute', left: 0, top: 0, bottom: 0, background: 'linear-gradient(90deg, #D4FF00 0%, #8fff00 100%)', transition: 'width 0.35s ease', borderRadius: 26 },
  pickerOverlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    zIndex: getOverlayZIndex(Z_MODAL_EDIT_POST) + 3,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  pickerBackdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)', transition: 'opacity 0.3s' },
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

@keyframes createSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;

export default EditPostModal;
