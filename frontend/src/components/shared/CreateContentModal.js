import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  BarChart2,
  VenetianMask,
  MapPin,
  Send,
  Plus,
  Hash,
  Settings,
  Users,
  CheckCircle,
  Circle,
  HelpCircle,
  AlertCircle,
  Gift,
  Clock,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useSwipe } from '../../hooks/useSwipe';
import { useStore } from '../../store';
import { createPost, createRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_CREATE_POST, getOverlayZIndex } from '../../constants/zIndex';
import { REWARD_TYPES } from '../../types';
import { POST_LIMITS, REQUEST_LIMITS, IMAGE_SETTINGS } from '../../constants/contentConstants';
import {
  CREATE_CONTENT_CATEGORY_CAPABILITIES,
  CREATE_CONTENT_POST_CATEGORIES,
  CREATE_CONTENT_POST_PLACEHOLDERS,
  CREATE_CONTENT_REQUEST_DEADLINE_OPTIONS,
  CREATE_CONTENT_REQUEST_CATEGORIES,
  CREATE_CONTENT_REQUEST_PLACEHOLDERS,
  CREATE_CONTENT_REQUEST_REWARD_OPTIONS,
  CREATE_CONTENT_SUGGESTED_TAGS,
} from '../../constants/createContentUiConfig';
import { parsePostSingleText, parseRequestSingleText } from '../../utils/contentTextParser';
import ConfirmationDialog from './ConfirmationDialog';
import { toast } from './Toast';
import { useTelegramScreen } from './telegram/useTelegramScreen';
import SmartDatePicker from './SmartDatePicker';

const MAX_IMAGES = POST_LIMITS.IMAGES_MAX;
const MAX_TAGS = POST_LIMITS.TAGS_MAX;
const MAX_TITLE_LENGTH = POST_LIMITS.TITLE_MAX;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;

const normalizeTag = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zа-яё0-9_-]/gi, '');

const formatCustomDate = (value) => {
  if (!value) return 'Выбрать 📅';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Выбрать 📅';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFirstNonEmptyLine = (rawText) =>
  String(rawText || '')
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
  if (mode === 'custom' && customDate) {
    const picked = new Date(customDate);
    if (!Number.isNaN(picked.getTime())) return picked.toISOString();
  }
  return null;
};

const formatRequestDeadlineLabel = (deadlineType, customDate) => {
  if (deadlineType === '3h') return 'До 3 часов';
  if (deadlineType === '3d') return 'До 3 дней';
  if (deadlineType === 'custom') return formatCustomDate(customDate);
  return '';
};

const buildRequestExpiresAtIso = (deadlineType, customDate) => {
  const now = Date.now();
  if (deadlineType === '3h') return new Date(now + 3 * 60 * 60 * 1000).toISOString();
  if (deadlineType === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (deadlineType === '3d') return new Date(now + 72 * 60 * 60 * 1000).toISOString();
  if (deadlineType === 'custom') {
    const picked = new Date(customDate || '');
    if (!Number.isNaN(picked.getTime())) return picked.toISOString();
  }
  return null;
};

function CreateContentModal({ onClose }) {
  const { addNewPost, addNewRequest, feedSubTab, setFeedSubTab } = useStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [activeTab, setActiveTab] = useState(feedSubTab === 'requests' ? 'request' : 'post');

  const [postCategory, setPostCategory] = useState(CREATE_CONTENT_POST_CATEGORIES[0]?.value || 'news');
  const [postText, setPostText] = useState('');
  const [postTags, setPostTags] = useState([]);
  const [postTagInput, setPostTagInput] = useState('');
  const [showTagTool, setShowTagTool] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [processingImages, setProcessingImages] = useState([]);

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [lfType, setLfType] = useState('lost');
  const [eventDateMode, setEventDateMode] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [location, setLocation] = useState('');

  const [hasPoll, setHasPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPollSettings, setShowPollSettings] = useState(false);
  const [pollType, setPollType] = useState('regular');
  const [pollCorrectOption, setPollCorrectOption] = useState(null);
  const [pollMulti, setPollMulti] = useState(false);
  const [pollAnon, setPollAnon] = useState(true);

  const [reqCategory, setReqCategory] = useState(CREATE_CONTENT_REQUEST_CATEGORIES[0]?.value || 'help');
  const [reqText, setReqText] = useState('');
  const [showReqReward, setShowReqReward] = useState(false);
  const [reqRewardType, setReqRewardType] = useState('none');
  const [reqRewardValue, setReqRewardValue] = useState('');
  const [showReqDeadline, setShowReqDeadline] = useState(false);
  const [reqDeadlineType, setReqDeadlineType] = useState('24h');
  const [reqCustomDate, setReqCustomDate] = useState('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showReqPicker, setShowReqPicker] = useState(false);

  const sheetRef = useRef(null);
  const postTextareaRef = useRef(null);
  const reqTextareaRef = useRef(null);
  const postFileInputRef = useRef(null);
  const postTagInputRef = useRef(null);

  const categoryCapabilities =
    CREATE_CONTENT_CATEGORY_CAPABILITIES[postCategory] || CREATE_CONTENT_CATEGORY_CAPABILITIES.news;
  const postPlaceholder =
    CREATE_CONTENT_POST_PLACEHOLDERS[postCategory] || CREATE_CONTENT_POST_PLACEHOLDERS.default;
  const requestPlaceholder =
    CREATE_CONTENT_REQUEST_PLACEHOLDERS[reqCategory] || CREATE_CONTENT_REQUEST_PLACEHOLDERS.default;

  const filteredSuggestions = useMemo(() => {
    const query = postTagInput.trim().toLowerCase();
    return CREATE_CONTENT_SUGGESTED_TAGS.filter((tag) => {
      if (postTags.includes(tag)) return false;
      return query ? tag.includes(query) : true;
    });
  }, [postTagInput, postTags]);

  const parsedRequestText = useMemo(
    () => parseRequestSingleText(reqText, { titleMax: REQUEST_LIMITS.TITLE_MAX }),
    [reqText]
  );

  const resolvedRequestExpiresAt = useMemo(
    () => buildRequestExpiresAtIso(reqDeadlineType, reqCustomDate),
    [reqDeadlineType, reqCustomDate]
  );

  const isAnyPickerOpen = showEventPicker || showReqPicker;

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prevBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const prevRootOverflow = root?.style.overflow || '';
    const prevHtmlOverflow = html.style.overflow;
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
    if (window.innerWidth < 768 || isSubmitting) return;
    const timer = setTimeout(() => {
      if (activeTab === 'post') postTextareaRef.current?.focus();
      else reqTextareaRef.current?.focus();
    }, 220);
    return () => clearTimeout(timer);
  }, [activeTab, isSubmitting]);

  useEffect(() => {
    if (showTagTool) {
      const timer = setTimeout(() => postTagInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showTagTool]);

  useEffect(() => {
    setShowReqReward(false);
    setShowReqDeadline(false);
    setShowEventPicker(false);
    setShowReqPicker(false);
  }, [activeTab]);

  useEffect(() => {
    setLocation('');
    setEventDateMode('today');
    setCustomDate('');
    setShowTagTool(false);
    setHasPoll(false);
    setPollOptions(['', '']);
    setShowPollSettings(false);
    setPollType('regular');
    setPollCorrectOption(null);
    setPollMulti(false);
    setPollAnon(true);

    if (postCategory === 'confessions') {
      setIsAnonymous(true);
      setPhotos([]);
      setImageFiles([]);
      setProcessingImages([]);
    } else {
      setIsAnonymous(false);
    }

    if (postCategory === 'polls') {
      setHasPoll(true);
      setPhotos([]);
      setImageFiles([]);
      setProcessingImages([]);
    }
  }, [postCategory]);

  const hasAnyContent = () => {
    const hasPostDraft =
      postText.trim().length > 0 ||
      postTags.length > 0 ||
      photos.length > 0 ||
      processingImages.length > 0 ||
      showTagTool ||
      hasPoll ||
      location.trim().length > 0 ||
      customDate.trim().length > 0;

    const hasRequestDraft =
      reqText.trim().length > 0 ||
      reqRewardType !== 'none' ||
      reqRewardValue.trim().length > 0 ||
      reqDeadlineType !== '24h' ||
      reqCustomDate.trim().length > 0;

    return hasPostDraft || hasRequestDraft;
  };

  const confirmClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => onClose(), 320);
  };

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: () => {
      if (showConfirmation) return;
      if (hasAnyContent()) setShowConfirmation(true);
      else confirmClose();
    },
    isModal: true,
    threshold: 120,
  });

  const canUsePollByCategory =
    postCategory !== 'lost_found' &&
    postCategory !== 'confessions' &&
    categoryCapabilities.allowPoll;

  const isPollValid = () => {
    const filled = pollOptions.map((v) => v.trim()).filter(Boolean);
    if (filled.length < 2) return false;
    if (pollType === 'quiz') {
      if (pollCorrectOption === null || pollCorrectOption < 0) return false;
      if (pollCorrectOption >= pollOptions.length) return false;
      if (!pollOptions[pollCorrectOption]?.trim()) return false;
    }
    return true;
  };

  const isPostFormValid = () => {
    const textValid = postText.trim().length >= POST_LIMITS.BODY_MIN;
    if (postCategory === 'polls') return postText.trim().length >= 3 && isPollValid();
    if (!textValid) return false;
    if (postCategory === 'events') return Boolean(buildEventDateIso(eventDateMode, customDate)) && location.trim().length >= 3;
    if (postCategory === 'lost_found') return location.trim().length >= 3;
    if (hasPoll) return isPollValid();
    return true;
  };

  const isRequestFormValid = () =>
    parsedRequestText.title.length >= REQUEST_LIMITS.TITLE_MIN &&
    parsedRequestText.body.length >= REQUEST_LIMITS.BODY_MIN &&
    Boolean(resolvedRequestExpiresAt);

  const canSend = activeTab === 'post' ? isPostFormValid() : isRequestFormValid();

  const handleClose = () => {
    if (isSubmitting) return;
    if (hasAnyContent()) {
      hapticFeedback('light');
      setShowConfirmation(true);
      return;
    }
    confirmClose();
  };

  const toggleTagTool = () => {
    hapticFeedback('light');
    setShowTagTool((prev) => !prev);
    setShowReqReward(false);
    setShowReqDeadline(false);
  };

  const toggleReqReward = () => {
    hapticFeedback('light');
    setShowReqReward((prev) => !prev);
    setShowReqDeadline(false);
    setShowTagTool(false);
  };

  const toggleReqDeadline = () => {
    hapticFeedback('light');
    setShowReqDeadline((prev) => !prev);
    setShowReqReward(false);
    setShowTagTool(false);
  };

  const selectReqDeadline = (value) => {
    setReqDeadlineType(value);
    if (value !== 'custom') setShowReqPicker(false);
  };

  const addPostTag = (tagValue) => {
    const tag = normalizeTag(tagValue || postTagInput);
    if (!tag || postTags.includes(tag) || postTags.length >= MAX_TAGS || tag.length > 20) return;
    setPostTags((prev) => [...prev, tag]);
    setPostTagInput('');
    hapticFeedback('light');
  };

  const handleSharedFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (activeTab === 'post' && !categoryCapabilities.allowImages) {
      hapticFeedback('error');
      toast.error(`В категории ${postCategory === 'confessions' ? 'Признания' : 'Опросы'} нельзя прикреплять изображения`);
      return;
    }

    const remainingSlots = MAX_IMAGES - photos.length - processingImages.length;
    if (remainingSlots <= 0) {
      hapticFeedback('error');
      toast.error(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const processors = filesToProcess.map(() => ({ id: Math.random().toString(36).slice(2, 10), progress: 0 }));
    setProcessingImages((prev) => [...prev, ...processors]);

    try {
      for (let i = 0; i < filesToProcess.length; i += 1) {
        const file = filesToProcess[i];
        const processorId = processors[i].id;

        if (!ALLOWED_FORMATS.includes(file.type)) {
          setProcessingImages((prev) => prev.filter((p) => p.id !== processorId));
          continue;
        }

        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          onProgress: (progress) => {
            setProcessingImages((prev) => prev.map((p) => (p.id === processorId ? { ...p, progress } : p)));
          },
        });

        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (readEvent) => {
            setPhotos((prev) => [...prev, readEvent.target.result]);
            setImageFiles((prev) => [...prev, compressed]);
            setProcessingImages((prev) => prev.filter((p) => p.id !== processorId));
            resolve();
          };
          reader.readAsDataURL(compressed);
        });
      }

      hapticFeedback('success');
    } catch (err) {
      console.error(err);
      setProcessingImages([]);
      toast.error('Ошибка обработки изображений');
    } finally {
      if (postFileInputRef.current) postFileInputRef.current.value = '';
    }
  };

  const buildPollPayload = () => {
    const options = pollOptions.map((opt) => opt.trim()).filter(Boolean);
    return {
      question: postText.trim() || 'Опрос',
      options,
      type: pollType,
      correct_option: pollType === 'quiz' ? (pollCorrectOption ?? 0) : null,
      allow_multiple: pollType === 'quiz' ? false : pollMulti,
      is_anonymous: pollAnon || isAnonymous,
    };
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    setError('');

    if (activeTab === 'post') {
      if (!isPostFormValid()) {
        hapticFeedback('error');
        if (postCategory === 'polls') setError('Введите текст вопроса и минимум 2 варианта ответа');
        else if (postCategory === 'lost_found') setError('Укажите место для категории Находки');
        else if (postCategory === 'events') setError('Укажите дату и место события');
        else setError(`Минимум ${POST_LIMITS.BODY_MIN} символов текста`);
        return;
      }

      setIsSubmitting(true);
      setUploadProgress(10);

      try {
        const formData = new FormData();
        formData.append('category', postCategory);

        if (postCategory === 'polls') {
          const pollQuestion = postText.trim() || 'Опрос';
          formData.append('title', pollQuestion.slice(0, MAX_TITLE_LENGTH));
          formData.append('body', pollQuestion);
        } else {
          const parsedPost = parsePostSingleText(postText, {
            titleMax: POST_LIMITS.TITLE_MAX,
            bodyMin: POST_LIMITS.BODY_MIN,
          });
          formData.append('title', parsedPost.title || '');
          formData.append('body', parsedPost.body || '');
        }

        formData.append('tags', JSON.stringify(postTags));
        formData.append('is_anonymous', isAnonymous);
        formData.append('enable_anonymous_comments', postCategory === 'confessions' ? true : isAnonymous);

        if (postCategory === 'lost_found') {
          formData.append('lost_or_found', lfType);
          formData.append('item_description', postText.trim());
          formData.append('location', location.trim());
        }

        if (postCategory === 'events') {
          const eventDateIso = buildEventDateIso(eventDateMode, customDate);
          const eventName = getFirstNonEmptyLine(postText).slice(0, 200);
          formData.append('event_name', eventName || 'Событие');
          formData.append('event_date', eventDateIso || new Date().toISOString());
          formData.append('event_location', location.trim());
        }

        if (hasPoll || postCategory === 'polls') {
          formData.append('poll_data', JSON.stringify(buildPollPayload()));
        }

        imageFiles.forEach((file) => formData.append('images', file));

        const newPost = await createPost(formData, (progressEvent) => {
          if (!progressEvent?.total) return;
          const next = Math.round(40 + (progressEvent.loaded / progressEvent.total) * 50);
          setUploadProgress(next);
        });

        addNewPost(newPost);
        setUploadProgress(100);
        hapticFeedback('success');
        toast.success('Пост успешно опубликован!');
        setTimeout(confirmClose, 120);
      } catch (submitError) {
        console.error(submitError);
        const detail = submitError?.response?.data?.detail;
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg || item.type).join(', ')
          : typeof detail === 'string'
            ? detail
            : 'Ошибка публикации поста';
        setError(message);
        toast.error(message);
        setIsSubmitting(false);
        setUploadProgress(0);
      }

      return;
    }

    if (!isRequestFormValid()) {
      hapticFeedback('error');
      setError('Заполните текст запроса: заголовок 10+ и описание 20+');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      const requestPayload = parsedRequestText;
      formData.append('category', reqCategory);
      formData.append('title', requestPayload.title);
      formData.append('body', requestPayload.body);
      formData.append('expires_at', resolvedRequestExpiresAt);
      formData.append('tags', JSON.stringify(postTags));
      formData.append('max_responses', '5');

      if (reqRewardType !== 'none') {
        const mappedRewardType = reqRewardType === 'barter' ? REWARD_TYPES.FAVOR : REWARD_TYPES.MONEY;
        formData.append('reward_type', mappedRewardType);
        if (reqRewardValue.trim()) {
          formData.append('reward_value', reqRewardValue.trim());
        } else if (reqRewardType === 'barter') {
          formData.append('reward_value', 'Бартер');
        }
      }

      imageFiles.forEach((file) => formData.append('images', file));

      const newRequest = await createRequest(formData, (progressEvent) => {
        if (!progressEvent?.total) return;
        const next = Math.round(45 + (progressEvent.loaded / progressEvent.total) * 45);
        setUploadProgress(next);
      });

      addNewRequest(newRequest);
      if (feedSubTab !== 'requests') setFeedSubTab('requests');
      setUploadProgress(100);
      hapticFeedback('success');
      toast.success('Запрос успешно создан!');
      setTimeout(confirmClose, 120);
    } catch (submitError) {
      console.error(submitError);
      const detail = submitError?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg || item.type).join(', ')
        : typeof detail === 'string'
          ? detail
          : 'Ошибка создания запроса';
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  useTelegramScreen({
    id: 'create-content-modal',
    title: activeTab === 'post' ? 'Создание поста' : 'Создание запроса',
    priority: 120,
    back: {
      visible: isVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: {
      visible: false,
      text: '',
      onClick: undefined,
      enabled: false,
      loading: false,
    },
    secondary: {
      visible: false,
      text: '',
      onClick: undefined,
      enabled: false,
      loading: false,
    },
  });

  if (!isMounted) return null;

  const pollVisible = hasPoll || postCategory === 'polls';
  const sendDisabled = !canSend || isSubmitting;

  const content = (
    <>
      <style>{keyframeStyles}</style>
      <div style={{ ...styles.overlay, opacity: isVisible ? 1 : 0, pointerEvents: showConfirmation ? 'none' : 'auto' }}>
        <div style={{ ...styles.backdrop, opacity: isVisible ? 1 : 0 }} onClick={handleClose} />
        <div
          ref={sheetRef}
          style={{ ...styles.sheet, transform: isVisible ? 'translateY(0)' : 'translateY(100%)' }}
          onClick={(event) => event.stopPropagation()}
        >
          {isSubmitting && (
            <div style={styles.topProgressBar}>
              <div style={{ ...styles.topProgressFill, width: `${uploadProgress}%` }} />
            </div>
          )}

          <div style={styles.sheetHeader} {...swipeHandlers}>
            <div style={styles.dragHandle} />
          </div>

          <div style={styles.switcherWrap}>
            <div style={styles.switcherInner}>
              <button
                type="button"
                onClick={() => { setActiveTab('post'); hapticFeedback('light'); }}
                style={activeTab === 'post' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn}
                className="create-spring-btn"
                disabled={isSubmitting}
              >
                Пост
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('request'); hapticFeedback('light'); }}
                style={activeTab === 'request' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn}
                className="create-spring-btn"
                disabled={isSubmitting}
              >
                Запрос
              </button>
            </div>
          </div>
          <div style={styles.contentViewport}>
            <div className="hide-scroll" style={styles.globalScroll}>
              <div style={{ ...styles.track, transform: `translateX(${activeTab === 'post' ? '0' : '-50%'})` }}>
                <div style={styles.slide}>
                  <div className="hide-scroll" style={styles.categoriesRow}>
                    {CREATE_CONTENT_POST_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => { setPostCategory(cat.value); hapticFeedback('light'); }}
                        style={postCategory === cat.value ? { ...styles.categoryChip, ...styles.categoryChipActive } : styles.categoryChip}
                        className="create-spring-btn"
                        disabled={isSubmitting}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div style={styles.slideContent}>
                    <div className="create-grow-wrap" data-replicated-value={postText || ' '} style={{ marginBottom: 16 }}>
                      <textarea
                        ref={postTextareaRef}
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder={postPlaceholder}
                        className="hide-scroll create-post-input"
                        style={styles.postTextareaInput}
                        maxLength={POST_LIMITS.BODY_MAX}
                        disabled={isSubmitting}
                      />
                    </div>

                    {postTags.length > 0 && (
                      <div className="smart-block" style={styles.tagsWrap}>
                        {postTags.map((tag) => (
                          <span key={tag} style={styles.tagChip}>
                            #{tag}
                            <button
                              type="button"
                              onClick={() => setPostTags((prev) => prev.filter((item) => item !== tag))}
                              style={styles.tagRemove}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {(photos.length > 0 || processingImages.length > 0) && (
                      <div className="hide-scroll smart-block" style={styles.photoRow}>
                        {photos.map((photo, i) => (
                          <div key={`photo-${i}`} style={styles.photoCard}>
                            <img src={photo} alt="" style={styles.photoImage} />
                            <button
                              type="button"
                              onClick={() => {
                                setPhotos((prev) => prev.filter((_, idx) => idx !== i));
                                setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
                              }}
                              style={styles.removePhotoBtn}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}

                        {processingImages.map((proc) => (
                          <div key={proc.id} style={styles.photoCard}>
                            <div style={styles.processingPlaceholder}>{Math.round(proc.progress)}%</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pollVisible && (
                      <div className="smart-block" style={styles.pollCard}>
                        <div style={styles.pollHead}>
                          <span style={styles.pollCaption}>ОПРОС</span>
                          {postCategory !== 'polls' && (
                            <button type="button" onClick={() => setHasPoll(false)} style={styles.pollX} className="create-spring-btn" disabled={isSubmitting}>
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        <div style={styles.pollOptions}>
                          {pollOptions.map((opt, i) => (
                            <div key={`opt-${i}`} style={styles.pollOptionRow}>
                              {pollType === 'quiz' && (
                                <button
                                  type="button"
                                  onClick={() => setPollCorrectOption(i)}
                                  style={{ ...styles.quizSelect, color: pollCorrectOption === i ? '#32D74B' : 'var(--create-text-muted)' }}
                                  className="create-spring-btn"
                                  disabled={isSubmitting}
                                >
                                  {pollCorrectOption === i ? <CheckCircle size={20} /> : <Circle size={20} />}
                                </button>
                              )}

                              <input
                                value={opt}
                                onChange={(e) => {
                                  const next = [...pollOptions];
                                  next[i] = e.target.value;
                                  setPollOptions(next);
                                }}
                                placeholder={`Вариант ${i + 1}`}
                                style={styles.pollOptionInput}
                                disabled={isSubmitting}
                              />

                              {i > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}
                                  style={styles.pollRemove}
                                  className="create-spring-btn"
                                  disabled={isSubmitting}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}

                          {pollOptions.length < 5 && (
                            <button type="button" onClick={() => setPollOptions((prev) => [...prev, ''])} style={styles.addPollOption} className="create-spring-btn" disabled={isSubmitting}>
                              <Plus size={16} /> Добавить вариант
                            </button>
                          )}
                        </div>

                        <div style={styles.pollSettingsWrap}>
                          <div style={styles.pollSettingsTop}>
                            <button type="button" onClick={() => setShowPollSettings((prev) => !prev)} style={styles.pollSettingsBtn} className="create-spring-btn" disabled={isSubmitting}>
                              <Settings size={14} /> Настройки опроса
                            </button>
                            <div style={styles.pollIndicators}>
                              {pollAnon && <VenetianMask size={14} />}
                              {pollMulti && <Users size={14} />}
                              {pollType === 'quiz' && <HelpCircle size={14} />}
                            </div>
                          </div>

                          {showPollSettings && (
                            <div className="smart-block" style={styles.pollSettingsPanel}>
                              <div style={styles.pollTypeRow}>
                                <button type="button" onClick={() => { setPollType('regular'); setPollCorrectOption(null); }} style={pollType === 'regular' ? { ...styles.pollTypeBtn, ...styles.pollTypeBtnActive } : styles.pollTypeBtn} className="create-spring-btn" disabled={isSubmitting}>
                                  <BarChart2 size={14} /> Опрос
                                </button>
                                <button type="button" onClick={() => { setPollType('quiz'); setPollCorrectOption(0); setPollMulti(false); }} style={pollType === 'quiz' ? { ...styles.pollTypeBtn, ...styles.pollTypeBtnActive } : styles.pollTypeBtn} className="create-spring-btn" disabled={isSubmitting}>
                                  <HelpCircle size={14} /> Викторина
                                </button>
                              </div>

                              <div style={styles.pollFlags}>
                                <button type="button" onClick={() => setPollMulti((prev) => !prev)} style={pollMulti ? { ...styles.flagBtn, ...styles.flagBtnActive } : styles.flagBtn} className="create-spring-btn" disabled={isSubmitting || pollType === 'quiz'}>
                                  <Users size={14} /> Мультивыбор
                                </button>
                                <button type="button" onClick={() => setPollAnon((prev) => !prev)} style={pollAnon ? { ...styles.flagBtn, ...styles.flagBtnActive } : styles.flagBtn} className="create-spring-btn" disabled={isSubmitting}>
                                  <VenetianMask size={14} /> Анонимно
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {postCategory === 'lost_found' && (
                      <div className="smart-block" style={styles.smartWrap}>
                        <div style={styles.lfRow}>
                          <button type="button" onClick={() => setLfType('lost')} style={lfType === 'lost' ? { ...styles.lfBtn, ...styles.lfBtnLost } : styles.lfBtn} className="create-spring-btn" disabled={isSubmitting}>😢 Потерял</button>
                          <button type="button" onClick={() => setLfType('found')} style={lfType === 'found' ? { ...styles.lfBtn, ...styles.lfBtnFound } : styles.lfBtn} className="create-spring-btn" disabled={isSubmitting}>🎉 Нашёл</button>
                        </div>
                        <div style={styles.smartInputWrap}>
                          <MapPin size={18} color="var(--create-text-muted)" />
                          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Где это было?" style={styles.smartInput} disabled={isSubmitting} />
                        </div>
                      </div>
                    )}

                    {postCategory === 'events' && (
                      <div className="smart-block" style={styles.smartWrap}>
                        <div style={styles.eventRow}>
                          <button type="button" onClick={() => { setEventDateMode('today'); setShowEventPicker(false); }} style={eventDateMode === 'today' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn} className="create-spring-btn" disabled={isSubmitting}>Сегодня</button>
                          <button type="button" onClick={() => { setEventDateMode('tomorrow'); setShowEventPicker(false); }} style={eventDateMode === 'tomorrow' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn} className="create-spring-btn" disabled={isSubmitting}>Завтра</button>
                          <div style={styles.eventPicker}>
                            <button
                              type="button"
                              onClick={() => {
                                setEventDateMode('custom');
                                setShowEventPicker(true);
                                setShowReqPicker(false);
                                setShowReqDeadline(false);
                                setShowReqReward(false);
                              }}
                              style={eventDateMode === 'custom' ? { ...styles.eventBtn, ...styles.eventBtnActive } : styles.eventBtn}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              {eventDateMode === 'custom' && customDate ? formatCustomDate(customDate) : 'Своя дата 📅'}
                            </button>
                          </div>
                        </div>
                        <div style={styles.smartInputWrap}>
                          <MapPin size={18} color="var(--create-text-muted)" />
                          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Место проведения" style={styles.smartInput} disabled={isSubmitting} />
                        </div>
                      </div>
                    )}

                    {postCategory === 'confessions' && (
                      <div className="smart-block" style={styles.confessionBlock}>
                        <VenetianMask size={22} color="var(--create-primary)" />
                        <div>
                          <div style={styles.confessionTitle}>Полная анонимность</div>
                          <div style={styles.confessionText}>Авторство скрыто. Комментарии также будут анонимными.</div>
                        </div>
                      </div>
                    )}

                    <div style={{ height: 150 }} />
                  </div>
                </div>

                <div style={styles.slide}>
                  <div className="hide-scroll" style={styles.requestCategoriesRow}>
                    {CREATE_CONTENT_REQUEST_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => { setReqCategory(cat.value); hapticFeedback('light'); }}
                        style={reqCategory === cat.value ? { ...styles.categoryChip, ...styles.categoryChipActive } : styles.categoryChip}
                        className="create-spring-btn"
                        disabled={isSubmitting}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div style={styles.slideContent}>
                    <div className="create-grow-wrap" data-replicated-value={reqText || ' '} style={{ marginBottom: 16 }}>
                      <textarea
                        ref={reqTextareaRef}
                        value={reqText}
                        onChange={(e) => setReqText(e.target.value)}
                        placeholder={requestPlaceholder}
                        className="hide-scroll"
                        style={styles.requestTextareaInput}
                        maxLength={REQUEST_LIMITS.BODY_MAX}
                        disabled={isSubmitting}
                      />
                    </div>

                    {(reqRewardType !== 'none' || reqDeadlineType !== '24h' || postTags.length > 0) && (
                      <div className="smart-block" style={styles.tagsWrap}>
                        {reqRewardType !== 'none' && (
                          <span style={styles.requestMetaChip}>
                            {reqRewardType === 'money' ? '💰' : '☕'} {reqRewardValue || 'Награда'}
                            <button
                              type="button"
                              onClick={() => { setReqRewardType('none'); setReqRewardValue(''); }}
                              style={styles.requestMetaRemove}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        )}

                        {reqDeadlineType !== '24h' && (
                          <span style={styles.requestMetaChip}>
                            ⏳ {formatRequestDeadlineLabel(reqDeadlineType, reqCustomDate)}
                            <button
                              type="button"
                              onClick={() => { setReqDeadlineType('24h'); setReqCustomDate(''); }}
                              style={styles.requestMetaRemove}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        )}

                        {postTags.map((tag) => (
                          <span key={`req-shared-tag-${tag}`} style={styles.tagChip}>
                            #{tag}
                            <button
                              type="button"
                              onClick={() => setPostTags((prev) => prev.filter((item) => item !== tag))}
                              style={styles.tagRemove}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {(photos.length > 0 || processingImages.length > 0) && (
                      <div className="hide-scroll smart-block" style={styles.photoRow}>
                        {photos.map((photo, i) => (
                          <div key={`req-photo-${i}`} style={styles.photoCard}>
                            <img src={photo} alt="" style={styles.photoImage} />
                            <button
                              type="button"
                              onClick={() => {
                                setPhotos((prev) => prev.filter((_, idx) => idx !== i));
                                setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
                              }}
                              style={styles.removePhotoBtn}
                              className="create-spring-btn"
                              disabled={isSubmitting}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {processingImages.map((proc) => (
                          <div key={`req-proc-${proc.id}`} style={styles.photoCard}>
                            <div style={styles.processingPlaceholder}>{Math.round(proc.progress)}%</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ height: 150 }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.bottomDock}>
              {showTagTool && (
                <div className="smart-block" style={styles.popupPanel}>
                  <div className="hide-scroll" style={styles.tagSuggestions}>
                    {filteredSuggestions.map((tag) => (
                      <button key={tag} type="button" onClick={() => addPostTag(tag)} style={styles.tagSuggestionBtn} className="create-spring-btn" disabled={isSubmitting}>#{tag}</button>
                    ))}
                    {filteredSuggestions.length === 0 && <span style={styles.noSuggestions}>Нет подсказок</span>}
                  </div>

                  <div style={styles.tagInputRow}>
                    <div style={styles.tagInputWrap}>
                      <Hash size={16} color="var(--create-text-muted)" />
                      <input
                        ref={postTagInputRef}
                        value={postTagInput}
                        onChange={(e) => setPostTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addPostTag();
                          }
                        }}
                        placeholder="Свой тег (например: курсач)"
                        style={styles.tagInput}
                        disabled={isSubmitting}
                      />
                    </div>
                    <button type="button" onClick={() => addPostTag()} style={postTagInput.trim() ? { ...styles.tagAddBtn, ...styles.tagAddBtnActive } : styles.tagAddBtn} className="create-spring-btn" disabled={isSubmitting}><Plus size={20} /></button>
                  </div>
                </div>
              )}

              {activeTab === 'request' && showReqReward && (
                <div className="smart-block" style={styles.popupPanel}>
                  <div style={styles.popupHead}>
                    <span style={styles.popupCaption}>НАГРАДА</span>
                    <button type="button" onClick={() => setShowReqReward(false)} style={styles.pollX} className="create-spring-btn" disabled={isSubmitting}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={styles.popupOptionRow}>
                    {CREATE_CONTENT_REQUEST_REWARD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReqRewardType(opt.value)}
                        style={reqRewardType === opt.value ? { ...styles.smartOptionBtn, ...styles.smartOptionBtnActive } : styles.smartOptionBtn}
                        className="create-spring-btn"
                        disabled={isSubmitting}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>

                  {reqRewardType === 'money' && (
                    <input
                      value={reqRewardValue}
                      onChange={(e) => setReqRewardValue(e.target.value)}
                      placeholder="Сумма (например, 500 ₽)"
                      style={styles.popupInput}
                      disabled={isSubmitting}
                    />
                  )}
                  {reqRewardType === 'barter' && (
                    <input
                      value={reqRewardValue}
                      onChange={(e) => setReqRewardValue(e.target.value)}
                      placeholder="Что взамен? (кофе, шоколадка...)"
                      style={styles.popupInput}
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              )}

              {activeTab === 'request' && showReqDeadline && (
                <div className="smart-block" style={styles.popupPanel}>
                  <div style={styles.popupHead}>
                    <span style={styles.popupCaption}>АКТУАЛЬНО ДО</span>
                    <button type="button" onClick={() => setShowReqDeadline(false)} style={styles.pollX} className="create-spring-btn" disabled={isSubmitting}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={styles.popupOptionRow}>
                    {CREATE_CONTENT_REQUEST_DEADLINE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => selectReqDeadline(opt.value)}
                        style={reqDeadlineType === opt.value ? { ...styles.smartOptionBtn, ...styles.smartOptionBtnActive } : styles.smartOptionBtn}
                        className="create-spring-btn"
                        disabled={isSubmitting}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setReqDeadlineType('custom'); setShowReqPicker(true); }}
                      style={reqDeadlineType === 'custom' ? { ...styles.smartOptionBtn, ...styles.smartOptionBtnActive, ...styles.deadlineCustomBtn } : { ...styles.smartOptionBtn, ...styles.deadlineCustomBtn }}
                      className="create-spring-btn"
                      disabled={isSubmitting}
                    >
                      {reqDeadlineType === 'custom' && reqCustomDate ? '📅 Выбрано' : 'Своя дата'}
                    </button>
                  </div>
                </div>
              )}

              <div style={styles.toolbar}>
                <input ref={postFileInputRef} type="file" multiple accept="image/*" onChange={handleSharedFileSelect} style={{ display: 'none' }} />
                {activeTab === 'post' ? (
                  <>
                    <div style={styles.toolGroup}>
                      <button type="button" onClick={() => { if (!categoryCapabilities.allowImages) { hapticFeedback('error'); return; } postFileInputRef.current?.click(); }} style={photos.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : categoryCapabilities.allowImages ? styles.toolBtn : { ...styles.toolBtn, ...styles.toolBtnDisabled }} className="create-spring-btn" disabled={isSubmitting}><ImageIcon size={20} /></button>
                      <button type="button" onClick={toggleTagTool} style={showTagTool || postTags.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Hash size={20} /></button>
                      {canUsePollByCategory && <button type="button" onClick={() => { if (postCategory !== 'polls') setHasPoll((prev) => !prev); }} style={pollVisible ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><BarChart2 size={20} /></button>}
                      <button type="button" onClick={() => { if (!categoryCapabilities.forceAnonymous) setIsAnonymous((prev) => !prev); }} style={isAnonymous ? { ...styles.toolBtn, ...styles.toolBtnActive } : categoryCapabilities.forceAnonymous ? { ...styles.toolBtn, ...styles.toolBtnDisabled } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><VenetianMask size={20} /></button>
                    </div>
                  </>
                ) : (
                  <div style={styles.toolGroup}>
                    <button type="button" onClick={() => postFileInputRef.current?.click()} style={photos.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><ImageIcon size={20} /></button>
                    <button type="button" onClick={toggleTagTool} style={showTagTool || postTags.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Hash size={20} /></button>
                    <button type="button" onClick={toggleReqReward} style={showReqReward || reqRewardType !== 'none' ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Gift size={20} /></button>
                    <button type="button" onClick={toggleReqDeadline} style={showReqDeadline || reqDeadlineType !== '24h' ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Clock size={20} /></button>
                  </div>
                )}

                <button type="button" onClick={handleSubmit} style={sendDisabled ? styles.sendBtn : { ...styles.sendBtn, ...styles.sendBtnActive }} className="create-spring-btn" disabled={isSubmitting}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={styles.errorBar}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.pickerOverlay, pointerEvents: isAnyPickerOpen ? 'auto' : 'none' }}>
        <div
          style={{ ...styles.pickerBackdrop, opacity: isAnyPickerOpen ? 1 : 0 }}
          onClick={() => {
            setShowEventPicker(false);
            setShowReqPicker(false);
          }}
        />
        <div style={{ ...styles.pickerSheet, transform: isAnyPickerOpen ? 'translateY(0)' : 'translateY(100%)' }}>
          {showEventPicker && (
            <SmartDatePicker
              initialDate={customDate}
              onSave={(iso) => {
                setCustomDate(iso);
                setEventDateMode('custom');
                setShowEventPicker(false);
              }}
              onCancel={() => {
                setShowEventPicker(false);
                if (!customDate) setEventDateMode('today');
              }}
            />
          )}
          {showReqPicker && (
            <SmartDatePicker
              initialDate={reqCustomDate}
              onSave={(iso) => {
                setReqCustomDate(iso);
                setReqDeadlineType('custom');
                setShowReqPicker(false);
              }}
              onCancel={() => {
                setShowReqPicker(false);
                if (!reqCustomDate) setReqDeadlineType('24h');
              }}
            />
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Выйти из редактора?"
        message="Весь введённый текст будет потерян"
        confirmText="Да, выйти"
        cancelText="Продолжить"
        confirmType="danger"
        onConfirm={confirmClose}
        onCancel={() => setShowConfirmation(false)}
      />
    </>
  );

  return createPortal(content, document.body);
}
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: getOverlayZIndex(Z_MODAL_CREATE_POST),
    transition: 'opacity 0.3s ease',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.62)',
    backdropFilter: 'blur(2px)',
    transition: 'opacity 0.3s ease',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '92%',
    background: 'var(--create-surface)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1px solid var(--create-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
    boxShadow: '0 -20px 60px rgba(0,0,0,0.65)',
  },
  topProgressBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', zIndex: 2 },
  topProgressFill: { height: '100%', background: 'linear-gradient(90deg, #D4FF00 0%, #8fff00 100%)', transition: 'width 0.3s ease' },
  sheetHeader: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    width: '100%',
    padding: '0 16px',
    flexShrink: 0,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'grab',
  },
  dragHandle: { width: 64, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.2)' },
  switcherWrap: { padding: '0 16px 12px', borderBottom: '1px solid var(--create-border)', flexShrink: 0 },
  switcherInner: { display: 'flex', background: 'var(--create-surface-elevated)', borderRadius: 12, padding: 4 },
  switchBtn: {
    flex: 1, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--create-text-muted)',
    padding: '8px', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',
  },
  switchBtnActive: { background: 'var(--create-primary)', color: '#000' },
  contentViewport: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' },
  globalScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  },
  track: { display: 'flex', width: '200%', minHeight: '100%', transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)' },
  slide: { width: '50%', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  categoriesRow: {
    display: 'grid', gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', gridAutoColumns: 'max-content',
    gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--create-border)', overflowX: 'auto', flexShrink: 0,
  },
  requestCategoriesRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--create-border)',
    overflowX: 'auto',
    flexShrink: 0,
  },
  categoryChip: {
    border: '1px solid transparent', borderRadius: 20, background: 'var(--create-surface-elevated)', color: '#fff',
    padding: '8px 16px', fontSize: 14, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', cursor: 'pointer',
  },
  categoryChipActive: { border: '1px solid var(--create-primary)', background: 'rgba(212,255,0,0.1)', color: 'var(--create-primary)' },
  slideContent: { padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', flex: '1 0 auto' },
  postTextareaInput: {
    width: '100%', minHeight: 76, resize: 'none', overflow: 'hidden', border: 'none', background: 'transparent',
    color: '#fff', caretColor: '#fff',
    fontSize: 18, fontWeight: 500, lineHeight: 1.4, padding: 0, outline: 'none', fontFamily: 'inherit',
  },
  requestTextareaInput: {
    width: '100%',
    minHeight: 76,
    resize: 'none',
    overflow: 'hidden',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.4,
    padding: 0,
    outline: 'none',
    fontFamily: 'inherit',
  },
  tagsWrap: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagChip: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
    padding: '6px 12px', borderRadius: 16, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
  },
  requestMetaChip: {
    background: 'rgba(212,255,0,0.1)',
    border: '1px solid var(--create-primary)',
    color: 'var(--create-primary)',
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  requestMetaRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    border: 'none',
    background: 'rgba(212,255,0,0.2)',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  tagRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  photoRow: { display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16 },
  photoCard: { position: 'relative', width: 100, height: 100, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--create-border)', flexShrink: 0, background: 'var(--create-surface-elevated)' },
  photoImage: { width: '100%', height: '100%', objectFit: 'cover' },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  processingPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--create-primary)', fontSize: 13, fontWeight: 600 },
  pollCard: { background: 'var(--create-surface-elevated)', border: '1px solid var(--create-border)', borderRadius: 16, padding: 16, marginBottom: 16 },
  pollHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pollCaption: { fontSize: 13, fontWeight: 700, color: 'var(--create-text-muted)', letterSpacing: '0.5px' },
  pollX: {
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  pollOptions: { display: 'flex', flexDirection: 'column', gap: 8 },
  pollOptionRow: { display: 'flex', gap: 8, alignItems: 'center' },
  quizSelect: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  pollOptionInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--create-border)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 15, outline: 'none' },
  pollRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
  },
  addPollOption: { background: 'transparent', border: '1px dashed var(--create-border)', borderRadius: 10, color: 'var(--create-primary)', fontWeight: 600, padding: 10, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  pollSettingsWrap: { marginTop: 12, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 12 },
  pollSettingsTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pollSettingsBtn: { background: 'none', border: 'none', color: 'var(--create-text-muted)', fontSize: 13, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', padding: 0 },
  pollIndicators: { display: 'flex', gap: 6, color: 'var(--create-text-muted)' },
  pollSettingsPanel: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  pollTypeRow: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 },
  pollTypeBtn: { flex: 1, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--create-text-muted)', padding: 8, fontSize: 13, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  pollTypeBtnActive: { background: 'var(--create-surface)', color: '#fff' },
  pollFlags: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  flagBtn: { borderRadius: 10, border: '1px solid transparent', background: 'rgba(255,255,255,0.05)', color: 'var(--create-text-muted)', padding: 10, fontSize: 13, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  flagBtnActive: { border: '1px solid var(--create-primary)', color: 'var(--create-primary)' },
  smartWrap: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 },
  lfRow: { display: 'flex', background: 'var(--create-surface-elevated)', borderRadius: 12, padding: 4 },
  lfBtn: { flex: 1, borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: 'var(--create-text-muted)', fontWeight: 600, fontSize: 14, padding: 10, cursor: 'pointer' },
  lfBtnLost: { color: '#FF453A', background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)' },
  lfBtnFound: { color: '#32D74B', background: 'rgba(50,215,75,0.15)', border: '1px solid rgba(50,215,75,0.3)' },
  smartInputWrap: { display: 'flex', alignItems: 'center', background: 'var(--create-surface-elevated)', border: '1px solid var(--create-border)', borderRadius: 12, padding: '0 12px' },
  smartInput: { flex: 1, border: 'none', background: 'transparent', color: '#fff', padding: '12px 8px', fontSize: 15, outline: 'none' },
  eventRow: { display: 'flex', gap: 8 },
  eventBtn: { flex: 1, border: 'none', borderRadius: 12, background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', padding: '10px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  eventBtnActive: { background: 'var(--create-primary)', color: '#000' },
  eventPicker: { flex: 1, position: 'relative' },
  hiddenDateInput: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
  confessionBlock: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderRadius: 16, background: 'rgba(212,255,0,0.05)', border: '1px solid rgba(212,255,0,0.2)', marginBottom: 16 },
  confessionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--create-primary)' },
  confessionText: { fontSize: 12, color: 'var(--create-text-muted)', marginTop: 2, lineHeight: 1.3 },
  reqSection: { marginBottom: 16 },
  reqLabel: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 8 },
  reqInput: { width: '100%', borderRadius: 12, border: '1px solid var(--create-border)', background: 'var(--create-surface-elevated)', color: '#fff', padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  reqTextarea: { width: '100%', borderRadius: 12, border: '1px solid var(--create-border)', background: 'var(--create-surface-elevated)', color: '#fff', padding: '12px 14px', fontSize: 14, lineHeight: 1.45, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  reqTimeRow: { display: 'flex', gap: 8, marginBottom: 8 },
  reqTimeBtn: { flex: 1, borderRadius: 10, border: '1px solid var(--create-border)', background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', fontSize: 13, fontWeight: 600, padding: '10px 8px', cursor: 'pointer' },
  reqTimeBtnActive: { flex: 1, borderRadius: 10, border: '1px solid var(--create-primary)', background: 'var(--create-primary)', color: '#000', fontSize: 13, fontWeight: 700, padding: '10px 8px', cursor: 'pointer' },
  reqTagsQuick: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  reqQuickTagBtn: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  reqTagInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    border: '1px solid var(--create-border)',
    background: 'rgba(0,0,0,0.4)',
    padding: '8px 12px',
  },
  reqTagInput: { flex: 1, border: 'none', background: 'transparent', color: '#fff', fontSize: 14, outline: 'none' },
  reqTagAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    background: 'var(--create-surface-elevated)',
    color: 'var(--create-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bottomDock: { position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 3 },
  popupPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    zIndex: 10,
    padding: '16px',
    background: 'rgba(28,28,30,0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
  },
  popupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  popupCaption: { fontSize: 13, fontWeight: 700, color: 'var(--create-text-muted)', letterSpacing: '0.5px' },
  popupOptionRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  smartOptionBtn: {
    flex: 1,
    minWidth: 84,
    padding: '10px 4px',
    borderRadius: 12,
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--create-text-muted)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  smartOptionBtnActive: {
    background: 'rgba(212,255,0,0.1)',
    border: '1px solid var(--create-primary)',
    color: 'var(--create-primary)',
  },
  deadlineCustomBtn: { flex: 1.2 },
  popupInput: {
    width: '100%',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    color: '#fff',
    fontSize: 15,
    padding: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  tagSuggestions: { display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 },
  tagSuggestionBtn: { padding: '6px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  noSuggestions: { color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '6px 0' },
  tagInputRow: { display: 'flex', gap: 8, alignItems: 'center' },
  tagInputWrap: { flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '8px 12px' },
  tagInput: { flex: 1, marginLeft: 8, border: 'none', background: 'transparent', color: '#fff', fontSize: 15, outline: 'none' },
  tagAddBtn: { width: 38, height: 38, borderRadius: 19, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'var(--create-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  tagAddBtnActive: { background: 'var(--create-primary)', color: '#000' },
  toolbar: { padding: '10px 16px', paddingBottom: 'calc(10px + var(--screen-bottom-offset))', borderTop: '1px solid var(--create-border)', background: 'var(--create-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 20 },
  toolGroup: { display: 'flex', gap: 8 },
  toolBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  toolBtnActive: { background: 'rgba(212,255,0,0.15)', color: 'var(--create-primary)' },
  toolBtnDisabled: { opacity: 0.5 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  sendBtnActive: { background: 'var(--create-primary)', color: '#000' },
  pickerOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: getOverlayZIndex(Z_MODAL_CREATE_POST) + 3,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(2px)',
    transition: 'opacity 0.3s',
  },
  pickerSheet: {
    position: 'relative',
    background: 'var(--create-surface)',
    borderTop: '1px solid var(--create-border)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '24px 16px calc(var(--screen-bottom-offset) + 16px)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  errorBar: { position: 'absolute', left: 16, right: 16, bottom: 'calc(76px + var(--screen-bottom-offset))', borderRadius: 12, border: '1px solid rgba(255,69,58,0.35)', background: 'rgba(255,69,58,0.14)', color: '#ff9d98', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 500 },
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

.smart-block { animation: createSlideDown 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards; }

@keyframes createSlideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.create-grow-wrap { display: grid; position: relative; }
.create-grow-wrap::after {
  content: attr(data-replicated-value) " ";
  white-space: pre-wrap;
  visibility: hidden;
  min-height: 76px;
}
.create-grow-wrap > textarea,
.create-grow-wrap::after {
  grid-area: 1 / 1 / 2 / 2;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  padding: 0;
  font-family: inherit;
  word-break: break-word;
}

.create-post-input::placeholder {
  color: #666;
  -webkit-text-fill-color: #666;
}
`;

export default CreateContentModal;

