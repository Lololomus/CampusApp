import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  BarChart2,
  VenetianMask,
  MapPin,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Hash,
  AlertCircle,
  Gift,
  Clock,
  Play,
  Globe,
} from 'lucide-react';
import { compressImage } from '../../utils/media';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from './SwipeableModal';
import { useStore } from '../../store';
import { createPost, createRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_CREATE_POST, getOverlayZIndex } from '../../constants/zIndex';
import { REWARD_TYPES } from '../../types';
import { POST_LIMITS, REQUEST_LIMITS, IMAGE_SETTINGS } from '../../constants/contentConstants';
import { isVideoFileCandidate, validateVideoFile } from '../../utils/videoValidation';
import PollCreator from '../posts/PollCreator';
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
import ConfirmationDialog from './ConfirmationDialog';
import { toast } from './Toast';
import { useTelegramScreen } from './telegram/useTelegramScreen';
import SmartDatePicker from './SmartDatePicker';
import { getUniversityName, getUniqueUniversities } from '../../constants/universityData';

const MAX_IMAGES = POST_LIMITS.IMAGES_MAX;
const MAX_TAGS = POST_LIMITS.TAGS_MAX;
const MAX_TITLE_LENGTH = POST_LIMITS.TITLE_MAX;
const TOOL_ICON_SIZE = 26;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;
const IMAGE_EXTENSIONS_ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];

const normalizeTag = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zа-яё0-9_-]/gi, '');

const countLetters = (raw) => (String(raw || '').match(/[a-zа-яё]/gi) || []).length;

const getFileExtension = (name = '') => {
  const parts = String(name).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
};

const isSupportedImageFile = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name);
  const isImageMime = mimeType.startsWith('image/');
  const isUnknownMime = mimeType === '' || mimeType === 'application/octet-stream';
  if (!isImageMime && !isUnknownMime) return false;
  if (ALLOWED_FORMATS.includes(mimeType)) return true;
  if (mimeType === 'image/jpg' || mimeType === 'image/heic' || mimeType === 'image/heif') return true;
  return IMAGE_EXTENSIONS_ALLOWED.includes(extension);
};

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

const hasCreateContentDraftData = (draft) => {
  if (!draft || typeof draft !== 'object') return false;

  const hasPostDraft =
    String(draft.postTitle || '').trim().length > 0 ||
    String(draft.postBody || '').trim().length > 0 ||
    (Array.isArray(draft.postTags) && draft.postTags.length > 0) ||
    (Array.isArray(draft.photos) && draft.photos.length > 0) ||
    Boolean(draft.videoFile) ||
    Boolean(draft.hasPoll) ||
    String(draft.location || '').trim().length > 0 ||
    String(draft.customDate || '').trim().length > 0;

  const hasRequestDraft =
    String(draft.reqTitle || '').trim().length > 0 ||
    String(draft.reqBody || '').trim().length > 0 ||
    draft.reqRewardType === 'money' ||
    draft.reqRewardType === 'barter' ||
    String(draft.reqRewardValue || '').trim().length > 0 ||
    (draft.reqDeadlineType && draft.reqDeadlineType !== '24h') ||
    String(draft.reqCustomDate || '').trim().length > 0;

  return hasPostDraft || hasRequestDraft;
};

function CreateContentModal({ onClose }) {
  const {
    addNewPost,
    addNewRequest,
    feedSubTab,
    setFeedSubTab,
    createContentDraft,
    setCreateContentDraft,
    clearCreateContentDraft,
    user,
  } = useStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingMedia, setIsAwaitingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState(feedSubTab === 'requests' ? 'request' : 'post');

  const [postCategory, setPostCategory] = useState(CREATE_CONTENT_POST_CATEGORIES[0]?.value || 'news');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTags, setPostTags] = useState([]);
  const [postTagInput, setPostTagInput] = useState('');
  const [showTagTool, setShowTagTool] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [processingImages, setProcessingImages] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonComments, setAnonComments] = useState(false);
  const [postScope, setPostScope] = useState('university');
  const [lfType, setLfType] = useState('lost');
  const [eventDateMode, setEventDateMode] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [location, setLocation] = useState('');

  const [hasPoll, setHasPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollType, setPollType] = useState('regular');
  const [pollCorrectOption, setPollCorrectOption] = useState(null);
  const [pollMulti, setPollMulti] = useState(false);
  const [pollAnon, setPollAnon] = useState(true);
  const [pollExplanation, setPollExplanation] = useState(null);

  const [reqCategory, setReqCategory] = useState(CREATE_CONTENT_REQUEST_CATEGORIES[0]?.value || 'help');
  const [reqTitle, setReqTitle] = useState('');
  const [reqBody, setReqBody] = useState('');
  const [showScopePanel, setShowScopePanel] = useState(false);
  const [scopePanelView, setScopePanelView] = useState('root');
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const [postTargetUniversity, setPostTargetUniversity] = useState('');
  const [isCrossUniversityScope, setIsCrossUniversityScope] = useState(false);
  const [showReqReward, setShowReqReward] = useState(false);
  const [reqRewardType, setReqRewardType] = useState('none');
  const [reqRewardValue, setReqRewardValue] = useState('');
  const [showReqDeadline, setShowReqDeadline] = useState(false);
  const [reqDeadlineType, setReqDeadlineType] = useState('24h');
  const [reqCustomDate, setReqCustomDate] = useState('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showReqPicker, setShowReqPicker] = useState(false);

  const sheetRef = useRef(null);
  const postBodyRef = useRef(null);
  const reqBodyRef = useRef(null);
  const postFileInputRef = useRef(null);
  const postTagInputRef = useRef(null);
  const skipPostCategoryResetRef = useRef(false);
  const hasCheckedInitialDraftRef = useRef(false);
  const mediaProcessingTasksRef = useRef(new Set());
  const photosRef = useRef(photos);
  const imageFilesRef = useRef(imageFiles);
  const videoFileRef = useRef(videoFile);
  const processingImagesRef = useRef(processingImages);

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

  const currentUniversityName = useMemo(() => getUniversityName(user || {}), [user]);

  const availableScopeUniversities = useMemo(
    () => getUniqueUniversities().filter((option) => option.value && option.value !== currentUniversityName),
    [currentUniversityName]
  );

  const filteredScopeUniversities = useMemo(() => {
    const query = scopeSearchQuery.trim().toLowerCase();
    if (!query) return availableScopeUniversities;
    return availableScopeUniversities.filter((option) => option.label.toLowerCase().includes(query));
  }, [availableScopeUniversities, scopeSearchQuery]);

  const selectedUniversityScopeLabel = useMemo(() => {
    if (isCrossUniversityScope && postTargetUniversity) return postTargetUniversity;
    return currentUniversityName || 'Мой вуз';
  }, [currentUniversityName, isCrossUniversityScope, postTargetUniversity]);

  const activeScopeOption = useMemo(() => {
    if (postScope === 'city') return 'city';
    if (postScope === 'all') return 'all';
    return 'university';
  }, [postScope]);

  const scopeAudienceLabel = useMemo(() => {
    if (postScope === 'city') return 'Виден студентам из твоего города';
    if (postScope === 'all') return 'Виден всем студентам';
    if (isCrossUniversityScope && postTargetUniversity) return `Виден в ленте ${postTargetUniversity}`;
    if (isCrossUniversityScope) return 'Выберите вуз, в чью ленту публикуется пост';
    if (currentUniversityName) return `Виден в ленте ${currentUniversityName}`;
    return 'Виден только в ленте твоего вуза';
  }, [currentUniversityName, isCrossUniversityScope, postScope, postTargetUniversity]);


  const resolvedRequestExpiresAt = useMemo(
    () => buildRequestExpiresAtIso(reqDeadlineType, reqCustomDate),
    [reqDeadlineType, reqCustomDate]
  );

  const isAnyPickerOpen = showEventPicker || showReqPicker;

  const registerMediaTask = (taskPromise) => {
    mediaProcessingTasksRef.current.add(taskPromise);
    taskPromise.finally(() => {
      mediaProcessingTasksRef.current.delete(taskPromise);
    });
    return taskPromise;
  };

  const waitForMediaTasks = async () => {
    while (mediaProcessingTasksRef.current.size > 0) {
      await Promise.allSettled(Array.from(mediaProcessingTasksRef.current));
    }
  };

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
      if (activeTab === 'post') postBodyRef.current?.focus();
      else reqBodyRef.current?.focus();
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
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    imageFilesRef.current = imageFiles;
  }, [imageFiles]);

  useEffect(() => {
    videoFileRef.current = videoFile;
  }, [videoFile]);

  useEffect(() => {
    processingImagesRef.current = processingImages;
  }, [processingImages]);

  useEffect(() => {
    setShowReqReward(false);
    setShowReqDeadline(false);
    setShowEventPicker(false);
    setShowReqPicker(false);
    setShowScopePanel(false);
    setScopePanelView('root');
    setScopeSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (skipPostCategoryResetRef.current) {
      skipPostCategoryResetRef.current = false;
      return;
    }

    setLocation('');
    setEventDateMode('today');
    setCustomDate('');
    setShowTagTool(false);
    setShowScopePanel(false);
    setScopePanelView('root');
    setHasPoll(false);
    setPollOptions(['', '']);

    setPollType('regular');
    setPollCorrectOption(null);
    setPollMulti(false);
    setPollAnon(true);

    if (postCategory === 'confessions') {
      setIsAnonymous(true);
      setAnonComments(true);
      setPhotos([]);
      setImageFiles([]);
      setProcessingImages([]);
    } else {
      setIsAnonymous(false);
      setAnonComments(false);
    }

    if (postCategory === 'polls') {
      setHasPoll(true);
      setPhotos([]);
      setImageFiles([]);
      setProcessingImages([]);
    }
  }, [postCategory]);

  useEffect(() => {
    if (hasCheckedInitialDraftRef.current) return;
    hasCheckedInitialDraftRef.current = true;

    if (hasCreateContentDraftData(createContentDraft)) {
      setShowRestoreDialog(true);
    }
  }, [createContentDraft]);

  const hasAnyContent = () => {
    const hasPostDraft =
      postTitle.trim().length > 0 ||
      postBody.trim().length > 0 ||
      postTags.length > 0 ||
      photos.length > 0 ||
      Boolean(videoFile) ||
      processingImages.length > 0 ||
      showTagTool ||
      hasPoll ||
      location.trim().length > 0 ||
      customDate.trim().length > 0;

    const hasRequestDraft =
      reqTitle.trim().length > 0 ||
      reqBody.trim().length > 0 ||
      reqRewardType !== 'none' ||
      reqRewardValue.trim().length > 0 ||
      reqDeadlineType !== '24h' ||
      reqCustomDate.trim().length > 0;

    return hasPostDraft || hasRequestDraft;
  };

  const buildDraftSnapshot = () => ({
    activeTab,
    postCategory,
    postTitle,
    postBody,
    postTags: [...postTags],
    photos: [...photos],
    imageFiles: [...imageFiles],
    videoFile,
    videoThumb,
    isAnonymous,
    anonComments,
    postScope,
    postTargetUniversity,
    isCrossUniversityScope,
    lfType,
    eventDateMode,
    customDate,
    location,
    hasPoll,
    pollOptions: [...pollOptions],
    pollType,
    pollCorrectOption,
    pollMulti,
    pollAnon,
    pollExplanation,
    reqCategory,
    reqTitle,
    reqBody,
    reqRewardType,
    reqRewardValue,
    reqDeadlineType,
    reqCustomDate,
    savedAt: Date.now(),
  });

  const restoreDraft = (draft) => {
    if (!draft || typeof draft !== 'object') return;

    const nextPhotos = Array.isArray(draft.photos) ? [...draft.photos] : [];
    const nextImageFiles = Array.isArray(draft.imageFiles) ? [...draft.imageFiles] : [];
    const nextVideo = draft.videoFile || null;

    setActiveTab(draft.activeTab === 'request' ? 'request' : 'post');

    skipPostCategoryResetRef.current = true;
    setPostCategory(draft.postCategory || CREATE_CONTENT_POST_CATEGORIES[0]?.value || 'news');
    setPostTitle(draft.postTitle || '');
    setPostBody(draft.postBody || '');
    setPostTags(Array.isArray(draft.postTags) ? [...draft.postTags] : []);
    setPhotos(nextPhotos);
    setImageFiles(nextImageFiles);
    setVideoFile(nextVideo);
    setVideoThumb(draft.videoThumb || null);
    setIsAnonymous(Boolean(draft.isAnonymous));
    setAnonComments(draft.postCategory === 'confessions' ? true : Boolean(draft.anonComments));
    const restoredPostScope = ['university', 'city', 'all'].includes(draft.postScope) ? draft.postScope : 'university';
    const restoredTargetUniversity = typeof draft.postTargetUniversity === 'string' ? draft.postTargetUniversity : '';
    setPostScope(restoredPostScope);
    setPostTargetUniversity(restoredPostScope === 'university' ? restoredTargetUniversity : '');
    setIsCrossUniversityScope(restoredPostScope === 'university' && Boolean(draft.isCrossUniversityScope || restoredTargetUniversity));
    setLfType(draft.lfType === 'found' ? 'found' : 'lost');
    setEventDateMode(draft.eventDateMode || 'today');
    setCustomDate(draft.customDate || '');
    setLocation(draft.location || '');
    setHasPoll(Boolean(draft.hasPoll));
    setPollOptions(Array.isArray(draft.pollOptions) && draft.pollOptions.length >= 2 ? [...draft.pollOptions] : ['', '']);
    setPollType(draft.pollType || 'regular');
    setPollCorrectOption(Number.isInteger(draft.pollCorrectOption) ? draft.pollCorrectOption : null);
    setPollMulti(Boolean(draft.pollMulti));
    setPollAnon(typeof draft.pollAnon === 'boolean' ? draft.pollAnon : true);
    setPollExplanation(draft.pollExplanation ?? null);

    setReqCategory(draft.reqCategory || CREATE_CONTENT_REQUEST_CATEGORIES[0]?.value || 'help');
    setReqTitle(draft.reqTitle || '');
    setReqBody(draft.reqBody || '');
    setReqRewardType(draft.reqRewardType || 'none');
    setReqRewardValue(draft.reqRewardValue || '');
    setReqDeadlineType(draft.reqDeadlineType || '24h');
    setReqCustomDate(draft.reqCustomDate || '');

    setProcessingImages([]);
    setScopeSearchQuery('');
    photosRef.current = nextPhotos;
    imageFilesRef.current = nextImageFiles;
    videoFileRef.current = nextVideo;
  };

  const closeWithDraft = ({ keepDraft = true } = {}) => {
    if (keepDraft) {
      if (hasAnyContent()) {
        setCreateContentDraft(buildDraftSnapshot());
      } else {
        clearCreateContentDraft();
      }
    } else {
      clearCreateContentDraft();
    }

    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => onClose(), 320);
  };

  const handleRestoreDraft = () => {
    restoreDraft(createContentDraft);
    setShowRestoreDialog(false);
  };

  const handleDiscardDraft = () => {
    clearCreateContentDraft();
    setShowRestoreDialog(false);
  };

  const switchContentTab = (nextTab) => {
    if (nextTab === activeTab || isSubmitting) return;

    if (nextTab === 'request') {
      setReqTitle(postTitle);
      setReqBody(postBody);
    } else {
      setPostTitle(reqTitle);
      setPostBody(reqBody);
    }

    setActiveTab(nextTab);
    hapticFeedback('light');
  };

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: () => {
      if (showConfirmation || showRestoreDialog) return false;
      if (hasAnyContent()) {
        setShowConfirmation(true);
        return false;
      }
      closeWithDraft();
      return true;
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
    const textValid = postBody.trim().length >= POST_LIMITS.BODY_MIN;
    if (postCategory === 'polls') return postTitle.trim().length >= 3 && isPollValid();
    if (postCategory === 'memes') return photos.length > 0 || countLetters(postTitle + postBody) >= 3;
    if (!textValid) return false;
    if (postScope === 'university' && isCrossUniversityScope && !postTargetUniversity.trim()) return false;
    if (postCategory === 'events') return Boolean(buildEventDateIso(eventDateMode, customDate)) && location.trim().length >= 3;
    if (postCategory === 'lost_found') return location.trim().length >= 3;
    if (hasPoll) return isPollValid();
    return true;
  };

  const isRequestFormValid = () =>
    reqTitle.trim().length >= REQUEST_LIMITS.TITLE_MIN &&
    reqBody.trim().length >= REQUEST_LIMITS.BODY_MIN &&
    Boolean(resolvedRequestExpiresAt);

  const canSend = activeTab === 'post' ? isPostFormValid() : isRequestFormValid();

  const handleClose = () => {
    if (isSubmitting) return;
    if (hasAnyContent()) {
      hapticFeedback('light');
      setShowConfirmation(true);
      return;
    }
    closeWithDraft();
  };

  const toggleTagTool = () => {
    hapticFeedback('light');
    setShowTagTool((prev) => !prev);
    setShowReqReward(false);
    setShowReqDeadline(false);
  };

  const toggleScopePanel = () => {
    hapticFeedback('light');
    setShowScopePanel((prev) => {
      const next = !prev;
      if (next) {
        setScopePanelView('root');
      } else {
        setScopeSearchQuery('');
      }
      return next;
    });
    setShowTagTool(false);
  };

  const selectScopeVisibility = (value) => {
    hapticFeedback('light');

    if (value === 'university') {
      setPostScope('university');
      if (postScope !== 'university') {
        setIsCrossUniversityScope(false);
        setPostTargetUniversity('');
      }
      setScopePanelView('root');
      return;
    }

    setPostScope(value);
    setIsCrossUniversityScope(false);
    setPostTargetUniversity('');
    setScopeSearchQuery('');
    setScopePanelView('root');
    setShowScopePanel(false);
  };

  const selectTargetUniversity = (universityValue) => {
    hapticFeedback('light');
    setPostScope('university');
    setIsCrossUniversityScope(true);
    setPostTargetUniversity(universityValue);
    setScopeSearchQuery('');
    setScopePanelView('root');
    setShowScopePanel(false);
  };

  const openUniversityScopePicker = () => {
    hapticFeedback('light');
    setPostScope('university');
    setScopePanelView('university');
    setScopeSearchQuery('');
  };

  const resetToOwnUniversityScope = () => {
    hapticFeedback('light');
    setPostScope('university');
    setIsCrossUniversityScope(false);
    setPostTargetUniversity('');
    setScopeSearchQuery('');
    setScopePanelView('root');
    setShowScopePanel(false);
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

  const handleSharedFileSelect = (event) => {
    const task = (async () => {
      const files = Array.from(event.target.files || []);
      const clearPostFileInput = () => {
        if (postFileInputRef.current) postFileInputRef.current.value = '';
      };
      if (files.length === 0) return;

      if (import.meta.env.DEV) {
        // [DIAG-1] Что пришло из input сразу после выбора
        console.log('[FileSelect][1] files.length:', files.length, files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
      }

    if (activeTab === 'post' && !categoryCapabilities.allowImages) {
      hapticFeedback('error');
      toast.error('В этой категории нельзя прикреплять медиа');
      clearPostFileInput();
      return;
    }

    // Handle video separately (no compression on client; backend processes it)
    const videoCandidate = files.find((file) => isVideoFileCandidate(file));
    if (videoCandidate) {
      if (activeTab === 'request') {
        hapticFeedback('error');
        toast.error('В запросах можно прикреплять только фото');
        clearPostFileInput();
        return;
      }

      const validation = await validateVideoFile(videoCandidate);
      if (!validation.valid) {
        hapticFeedback('error');
        toast.error(validation.error);
        clearPostFileInput();
        return;
      }

      setVideoFile(videoCandidate);
      captureVideoThumbnail(videoCandidate).then(setVideoThumb);
      hapticFeedback('success');
      clearPostFileInput();
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

    if (import.meta.env.DEV) {
      // [DIAG-2] Кол-во файлов после клиентской фильтрации слотами
      console.log('[FileSelect][2] remainingSlots:', remainingSlots, '| filesToProcess.length:', filesToProcess.length);
    }

    try {
      const failedFiles = [];

      for (let i = 0; i < filesToProcess.length; i += 1) {
        const file = filesToProcess[i];
        const processorId = processors[i].id;

        if (!isSupportedImageFile(file)) {
          failedFiles.push(file?.name || `Файл ${i + 1}`);
          setProcessingImages((prev) => prev.filter((p) => p.id !== processorId));
          continue;
        }

        try {
          let processedFile = file;
          try {
            processedFile = await compressImage(file, (progress) => {
              setProcessingImages((prev) => prev.map((p) => (p.id === processorId ? { ...p, progress } : p)));
            });
          } catch (compressionError) {
            // Keep original file if compression fails to avoid silently dropping media.
            if (import.meta.env.DEV) console.warn('Image compression failed, using original file:', file?.name, compressionError);
            processedFile = file;
          }

          if (!processedFile) {
            if (import.meta.env.DEV) console.warn('[FileSelect] compressImage вернул falsy, используем оригинал:', file?.name);
            processedFile = file;
          }

          if (import.meta.env.DEV) {
            // [DIAG-3] Состояние файла перед FileReader
            console.log(`[FileSelect][3] file[${i}] before FileReader:`, { name: processedFile?.name, type: processedFile?.type, size: processedFile?.size });
          }

          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (readEvent) => {
              if (import.meta.env.DEV) {
                // [DIAG-4] FileReader.onload сработал — данные есть
                console.log(`[FileSelect][4] FileReader.onload file[${i}]: dataURL length=${readEvent.target.result?.length}`);
              }
              // Обновляем рефы синхронно ДО React-коммита: handleSubmit читает рефы сразу
              // после waitForMediaTasks(), до того как useEffect успевает их обновить.
              const nextPhotos = [...photosRef.current, readEvent.target.result];
              const nextImageFiles = [...imageFilesRef.current, processedFile];
              photosRef.current = nextPhotos;
              imageFilesRef.current = nextImageFiles;
              setPhotos(nextPhotos);
              setImageFiles(nextImageFiles);
              setProcessingImages((prev) => prev.filter((p) => p.id !== processorId));
              resolve();
            };
            // [FIX] Без onerror Promise висел вечно при ошибке FileReader,
            // блокируя submit через waitForMediaTasks.
            reader.onerror = (errorEvent) => {
              if (import.meta.env.DEV) console.error(`[FileSelect] FileReader.onerror file[${i}]:`, errorEvent);
              reject(new Error(`FileReader failed: ${file?.name}`));
            };
            reader.readAsDataURL(processedFile);
          });
        } catch (fileError) {
          failedFiles.push(file?.name || `Файл ${i + 1}`);
          setProcessingImages((prev) => prev.filter((p) => p.id !== processorId));
          console.error('Image processing failed:', fileError);
        }
      }

      if (filesToProcess.length > failedFiles.length) {
        hapticFeedback('success');
      }

      if (failedFiles.length > 0) {
        const preview = failedFiles.slice(0, 2).join(', ');
        const suffix = failedFiles.length > 2 ? '…' : '';
        toast.warning(`Не удалось добавить ${failedFiles.length} файл(а): ${preview}${suffix}`);
      }
    } finally {
      clearPostFileInput();
    }
    })();

    registerMediaTask(task);
  };

  const buildPollPayload = () => {
    const options = pollOptions.map((opt) => opt.trim()).filter(Boolean);
    return {
      question: postTitle.trim() || 'Опрос',
      options,
      type: pollType,
      correct_option: pollType === 'quiz' ? (pollCorrectOption ?? 0) : null,
      explanation: pollType === 'quiz' ? (pollExplanation || null) : null,
      allow_multiple: pollType === 'quiz' ? false : pollMulti,
      is_anonymous: pollAnon || isAnonymous,
    };
  };

  const handlePollChange = (data) => {
    setPollOptions(data.options);
    setPollType(data.type);
    setPollCorrectOption(data.correctOption);
    setPollMulti(data.allowMultiple);
    setPollAnon(data.isAnonymous);
    setPollExplanation(data.explanation);
  };

  const handleSubmit = async () => {
    setError('');

    if (mediaProcessingTasksRef.current.size > 0 || processingImagesRef.current.length > 0) {
      setIsAwaitingMedia(true);
      try {
        await waitForMediaTasks();
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        setIsAwaitingMedia(false);
      }
    }

    const currentPhotos = photosRef.current;
    const currentImageFiles = imageFilesRef.current;
    const currentVideoFile = videoFileRef.current;

    if (import.meta.env.DEV) {
      // [DIAG-5] Кол-во фото и файлов перед submit
      console.log('[Submit][5] photos.length:', currentPhotos.length, '| imageFiles.length:', currentImageFiles.length);
    }

    const isPostFormValidForSubmit = () => {
      const textValid = postBody.trim().length >= POST_LIMITS.BODY_MIN;
      if (postCategory === 'polls') return postTitle.trim().length >= 3 && isPollValid();
      if (postCategory === 'memes') return currentPhotos.length > 0 || countLetters(postTitle + postBody) >= 3;
      if (!textValid) return false;
      if (postScope === 'university' && isCrossUniversityScope && !postTargetUniversity.trim()) return false;
      if (postCategory === 'events') return Boolean(buildEventDateIso(eventDateMode, customDate)) && location.trim().length >= 3;
      if (postCategory === 'lost_found') return location.trim().length >= 3;
      if (hasPoll) return isPollValid();
      return true;
    };

    if (activeTab === 'post') {
      if (!isPostFormValidForSubmit()) {
        hapticFeedback('error');
        if (postScope === 'university' && isCrossUniversityScope && !postTargetUniversity.trim()) {
          setError('Выберите вуз, в чью ленту публикуется пост');
          return;
        }
        if (postCategory === 'polls') setError('Введите текст вопроса и минимум 2 варианта ответа');
        else if (postCategory === 'memes') setError('Для категории Мемы добавьте фото или текст от 3 букв');
        else if (postCategory === 'lost_found') setError('Укажите место для категории Находки');
        else if (postCategory === 'events') setError('Укажите дату и место события');
        else setError(`Минимум ${POST_LIMITS.BODY_MIN} символов текста`);
        return;
      }

      setIsSubmitting(true);
      setUploadProgress(10);

      try {
        const normalizedTargetUniversity =
          postScope === 'university' && isCrossUniversityScope
            ? postTargetUniversity.trim()
            : '';
        const formData = new FormData();
        formData.append('category', postCategory);

        if (postCategory === 'polls') {
          const pollQuestion = postTitle.trim() || 'Опрос';
          formData.append('title', pollQuestion.slice(0, MAX_TITLE_LENGTH));
          formData.append('body', pollQuestion);
        } else {
          formData.append('title', postTitle.trim().slice(0, POST_LIMITS.TITLE_MAX));
          formData.append('body', postBody.trim());
        }

        formData.append('tags', JSON.stringify(postTags));
        formData.append('scope', postScope);
        formData.append('is_anonymous', isAnonymous);
        formData.append('enable_anonymous_comments', postCategory === 'confessions' ? true : anonComments);
        if (normalizedTargetUniversity) formData.append('target_university', normalizedTargetUniversity);

        if (postCategory === 'lost_found') {
          formData.append('lost_or_found', lfType);
          formData.append('item_description', postBody.trim());
          formData.append('location', location.trim());
        }

        if (postCategory === 'events') {
          const eventDateIso = buildEventDateIso(eventDateMode, customDate);
          const eventName = (postTitle.trim() || postBody.trim()).slice(0, 200);
          formData.append('event_name', eventName || 'Событие');
          formData.append('event_date', eventDateIso || new Date().toISOString());
          formData.append('event_location', location.trim());
        }

        if (hasPoll || postCategory === 'polls') {
          formData.append('poll_data', JSON.stringify(buildPollPayload()));
        }

        currentImageFiles.forEach((file) => formData.append('images', file));
        if (currentVideoFile) formData.append('video', currentVideoFile);

        if (import.meta.env.DEV) {
          // [DIAG-6] Кол-во images в FormData перед отправкой
          console.log('[Submit][6] FormData images count:', formData.getAll('images').length, formData.getAll('images').map((f) => ({ name: f.name, type: f.type, size: f.size })));
        }

        const newPost = await createPost(formData, (progressEvent) => {
          if (!progressEvent?.total) return;
          const next = Math.round(40 + (progressEvent.loaded / progressEvent.total) * 50);
          setUploadProgress(next);
        });

        addNewPost(newPost);
        setUploadProgress(100);
        hapticFeedback('success');
        toast.success('Пост успешно опубликован!');
        setTimeout(() => closeWithDraft({ keepDraft: false }), 120);
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
      setError(`Заголовок — мин. ${REQUEST_LIMITS.TITLE_MIN} симв., описание — мин. ${REQUEST_LIMITS.BODY_MIN} симв.`);
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('category', reqCategory);
      formData.append('title', reqTitle.trim());
      formData.append('body', reqBody.trim());
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

      currentImageFiles.forEach((file) => formData.append('images', file));

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
      setTimeout(() => closeWithDraft({ keepDraft: false }), 120);
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
      onClick: () => {
        if (showRestoreDialog) {
          handleDiscardDraft();
          return;
        }
        if (showConfirmation) {
          setShowConfirmation(false);
          return;
        }
        handleClose();
      },
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
  const sendDisabled = !canSend || isSubmitting || isAwaitingMedia;
  const sendLoading = isSubmitting || isAwaitingMedia;
  const mediaInputAccept = activeTab === 'request' ? 'image/*' : 'image/*,video/mp4,video/quicktime,video/webm';

  const content = (
    <>
      <style>{keyframeStyles}</style>
      <div style={{ ...styles.overlay, opacity: isVisible ? 1 : 0, pointerEvents: (showConfirmation || showRestoreDialog) ? 'none' : 'auto' }}>
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

          <DragHandle handlers={swipeHandlers} gap={0} />

          <div style={styles.switcherWrap}>
            <div style={styles.switcherInner}>
              <button
                type="button"
                onClick={() => switchContentTab('post')}
                style={activeTab === 'post' ? { ...styles.switchBtn, ...styles.switchBtnActive } : styles.switchBtn}
                className="create-spring-btn"
                disabled={isSubmitting}
              >
                Пост
              </button>
              <button
                type="button"
                onClick={() => switchContentTab('request')}
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
                    {/* Медиа-блок сверху: сначала видео, затем фото */}
                    {videoFile && (
                      <div className="smart-block" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: photos.length > 0 || processingImages.length > 0 ? 8 : 16, background: '#111' }}>
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
                            onClick={() => { setVideoFile(null); setVideoThumb(null); }}
                            style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: 0 }}
                            className="create-spring-btn"
                            disabled={isSubmitting}
                          >
                            <X size={13} />
                          </button>
                        </div>
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

                    {postCategory !== 'polls' && (
                      <input
                        type="text"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder={postPlaceholder.split('\n')[0] || 'Заголовок...'}
                        style={styles.postTitleInput}
                        maxLength={POST_LIMITS.TITLE_MAX}
                        disabled={isSubmitting}
                      />
                    )}
                    <div className="create-grow-wrap" data-replicated-value={(postCategory === 'polls' ? postTitle : postBody) || ' '} style={{ marginBottom: 16 }}>
                      <textarea
                        ref={postBodyRef}
                        value={postCategory === 'polls' ? postTitle : postBody}
                        onChange={(e) => postCategory === 'polls' ? setPostTitle(e.target.value) : setPostBody(e.target.value)}
                        placeholder={postCategory === 'polls' ? postPlaceholder : (postPlaceholder.split('\n')[1] || 'Подробности...')}
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

                    {pollVisible && (
                      <div className="smart-block" style={styles.pollCard}>
                        <PollCreator
                          pollData={{
                            options: pollOptions,
                            type: pollType,
                            correctOption: pollCorrectOption,
                            allowMultiple: pollMulti,
                            isAnonymous: pollAnon,
                            explanation: pollExplanation,
                          }}
                          onChange={handlePollChange}
                          onClose={postCategory !== 'polls' && !isSubmitting ? () => setHasPoll(false) : undefined}
                        />
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

                    {(isAnonymous || postCategory === 'confessions') && (
                      <div className="smart-block" style={styles.anonBlock}>
                        <div style={styles.anonRow}>
                          <VenetianMask size={20} color="var(--create-primary)" />
                          <div style={styles.anonInfo}>
                            <div style={styles.anonTitle}>Анонимный пост</div>
                            <div style={styles.anonSubtitle}>Авторство будет скрыто</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { if (postCategory !== 'confessions') setAnonComments((prev) => !prev); }}
                          style={styles.anonCommentsRow}
                          disabled={postCategory === 'confessions'}
                        >
                          <span style={styles.anonCommentsLabel}>Анонимные комментарии</span>
                          <div style={{ ...styles.anonToggleTrack, ...(anonComments ? styles.anonToggleTrackOn : {}) }}>
                            <div style={{ ...styles.anonToggleDot, ...(anonComments ? styles.anonToggleDotOn : {}) }} />
                          </div>
                        </button>
                      </div>
                    )}

                    {(postScope !== 'university' || isCrossUniversityScope) && (
                      <div className="smart-block" style={styles.scopeSummaryBlock}>
                        <div style={styles.scopeSummaryRow}>
                          <Globe size={18} color="var(--create-primary)" />
                          <div style={styles.scopeSummaryInfo}>
                            <div style={styles.scopeSummaryTitle}>Видимость</div>
                            <div style={styles.scopeSummaryText}>{scopeAudienceLabel}</div>
                          </div>
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

                    <input
                      type="text"
                      value={reqTitle}
                      onChange={(e) => setReqTitle(e.target.value)}
                      placeholder="Заголовок запроса..."
                      style={styles.reqTitleInput}
                      maxLength={REQUEST_LIMITS.TITLE_MAX}
                      disabled={isSubmitting}
                    />
                    <div className="create-grow-wrap" data-replicated-value={reqBody || ' '} style={{ marginBottom: 16 }}>
                      <textarea
                        ref={reqBodyRef}
                        value={reqBody}
                        onChange={(e) => setReqBody(e.target.value)}
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

              {activeTab === 'post' && showScopePanel && (
                <div className="smart-block" style={styles.popupPanel}>
                  <div style={styles.popupHead}>
                    <div style={styles.scopePanelHead}>
                      {scopePanelView === 'university' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => { setScopePanelView('root'); setScopeSearchQuery(''); }}
                            style={styles.scopeBackBtn}
                            className="create-spring-btn"
                            disabled={isSubmitting}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span style={styles.popupCaption}>ЛЕНТА ВУЗА</span>
                        </>
                      ) : (
                        <span style={styles.popupCaption}>ВИДИМОСТЬ</span>
                      )}
                    </div>
                    <button type="button" onClick={() => setShowScopePanel(false)} style={styles.pollX} className="create-spring-btn" disabled={isSubmitting}>
                      <X size={16} />
                    </button>
                  </div>
                  {scopePanelView === 'root' && (
                    <div style={styles.popupOptionRow}>
                      {[
                        { value: 'university', label: '🎓 Вуз' },
                        { value: 'city', label: '🏙 Город' },
                        { value: 'all', label: '🌍 Все' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => selectScopeVisibility(opt.value)}
                          style={activeScopeOption === opt.value ? { ...styles.smartOptionBtn, ...styles.smartOptionBtnActive } : styles.smartOptionBtn}
                          className="create-spring-btn"
                          disabled={isSubmitting}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {scopePanelView === 'root' ? (
                    <>
                      {activeScopeOption === 'university' && (
                        <button
                          type="button"
                          onClick={openUniversityScopePicker}
                          style={styles.scopeDrillCard}
                          className="create-spring-btn"
                          disabled={isSubmitting}
                        >
                          <div style={styles.scopeDrillInfo}>
                            <span style={styles.scopeDrillCaption}>ЛЕНТА</span>
                            <span style={styles.scopeDrillTitle}>{selectedUniversityScopeLabel}</span>
                            <span style={styles.scopeDrillMeta}>
                              {isCrossUniversityScope ? 'Публикация уйдет в выбранный вуз' : 'По умолчанию пост попадет в твой вуз'}
                            </span>
                          </div>
                          <div style={styles.scopeDrillAction}>
                            <span style={styles.scopeDrillActionText}>{isCrossUniversityScope ? 'Изменить' : 'Другой вуз'}</span>
                            <ChevronRight size={16} />
                          </div>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={resetToOwnUniversityScope}
                        style={!isCrossUniversityScope ? { ...styles.scopeUniversityBtn, ...styles.scopeUniversityBtnActive } : styles.scopeUniversityBtn}
                        className="create-spring-btn"
                        disabled={isSubmitting}
                      >
                        <span style={styles.scopeUniversityBtnLabel}>{currentUniversityName ? `Мой вуз: ${currentUniversityName}` : 'Мой вуз'}</span>
                        <span style={styles.scopeUniversityBtnMeta}>Оставить публикацию в своей ленте</span>
                      </button>

                      <input
                        value={scopeSearchQuery}
                        onChange={(e) => setScopeSearchQuery(e.target.value)}
                        placeholder="Найти другой вуз"
                        style={{ ...styles.popupInput, marginTop: 12, marginBottom: 12 }}
                        disabled={isSubmitting}
                      />

                      {postTargetUniversity && (
                        <div style={styles.scopeSelectedPill}>Выбрано: {postTargetUniversity}</div>
                      )}

                      <div className="hide-scroll" style={styles.scopeUniversityList}>
                        {filteredScopeUniversities.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => selectTargetUniversity(option.value)}
                            style={postTargetUniversity === option.value ? { ...styles.scopeUniversityBtn, ...styles.scopeUniversityBtnActive } : styles.scopeUniversityBtn}
                            className="create-spring-btn"
                            disabled={isSubmitting}
                          >
                            <span style={styles.scopeUniversityBtnLabel}>{option.label}</span>
                            <span style={styles.scopeUniversityBtnMeta}>
                              {postTargetUniversity === option.value ? 'Будет опубликовано сюда' : 'Открыть ленту этого вуза для поста'}
                            </span>
                          </button>
                        ))}

                        {filteredScopeUniversities.length === 0 && (
                          <div style={styles.scopeUniversityEmpty}>
                            {availableScopeUniversities.length === 0 ? 'Список вузов пока пуст' : 'Ничего не найдено'}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={activeTab === 'request' ? { ...styles.toolbar, borderTop: '1px solid var(--create-border)' } : styles.toolbar}>
                <input ref={postFileInputRef} type="file" multiple accept={mediaInputAccept} onChange={handleSharedFileSelect} style={{ display: 'none' }} />
                {activeTab === 'post' ? (
                  <>
                    <div style={styles.toolGroup}>
                      <button type="button" onClick={() => { if (!categoryCapabilities.allowImages) { hapticFeedback('error'); return; } postFileInputRef.current?.click(); }} style={photos.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : categoryCapabilities.allowImages ? styles.toolBtn : { ...styles.toolBtn, ...styles.toolBtnDisabled }} className="create-spring-btn" disabled={isSubmitting}><ImageIcon size={TOOL_ICON_SIZE} /></button>
                      <button type="button" onClick={toggleTagTool} style={showTagTool || postTags.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Hash size={TOOL_ICON_SIZE} /></button>
                      {canUsePollByCategory && <button type="button" onClick={() => { if (postCategory !== 'polls') setHasPoll((prev) => !prev); }} style={pollVisible ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><BarChart2 size={TOOL_ICON_SIZE} /></button>}
                      <button type="button" onClick={() => { if (!categoryCapabilities.forceAnonymous) { setIsAnonymous((prev) => { if (prev) setAnonComments(false); return !prev; }); } }} style={isAnonymous ? { ...styles.toolBtn, ...styles.toolBtnActive } : categoryCapabilities.forceAnonymous ? { ...styles.toolBtn, ...styles.toolBtnDisabled } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><VenetianMask size={TOOL_ICON_SIZE} /></button>
                      <button type="button" onClick={toggleScopePanel} style={showScopePanel || postScope !== 'university' || isCrossUniversityScope ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Globe size={TOOL_ICON_SIZE} /></button>
                    </div>
                  </>
                ) : (
                  <div style={styles.toolGroup}>
                    <button type="button" onClick={() => postFileInputRef.current?.click()} style={photos.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><ImageIcon size={TOOL_ICON_SIZE} /></button>
                    <button type="button" onClick={toggleTagTool} style={showTagTool || postTags.length > 0 ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Hash size={TOOL_ICON_SIZE} /></button>
                    <button type="button" onClick={toggleReqReward} style={showReqReward || reqRewardType !== 'none' ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Gift size={TOOL_ICON_SIZE} /></button>
                    <button type="button" onClick={toggleReqDeadline} style={showReqDeadline || reqDeadlineType !== '24h' ? { ...styles.toolBtn, ...styles.toolBtnActive } : styles.toolBtn} className="create-spring-btn" disabled={isSubmitting}><Clock size={TOOL_ICON_SIZE} /></button>
                  </div>
                )}

                <button type="button" onClick={handleSubmit} style={canSend ? { ...styles.sendBtn, ...styles.sendBtnActive } : styles.sendBtn} className="create-spring-btn" disabled={sendDisabled}>
                  {sendLoading ? <Loader2 size={TOOL_ICON_SIZE} style={{ animation: 'createSpin 0.7s linear infinite' }} /> : <Check size={TOOL_ICON_SIZE} />}
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
        message="Черновик сохранится в текущей сессии и его можно будет восстановить."
        confirmText="Выйти"
        cancelText="Продолжить"
        confirmType="danger"
        onConfirm={() => closeWithDraft()}
        onCancel={() => setShowConfirmation(false)}
      />
      <ConfirmationDialog
        isOpen={showRestoreDialog}
        title="Восстановить черновик?"
        message="Найден незавершенный черновик из текущей сессии."
        confirmText="Восстановить"
        cancelText="Начать заново"
        confirmType="primary"
        onConfirm={handleRestoreDraft}
        onCancel={handleDiscardDraft}
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
    background: 'rgba(0, 0, 0, 0.75)',
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
  switcherWrap: { padding: '12px 16px 10px', borderBottom: '1px solid var(--create-border)', flexShrink: 0 },
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
    gap: 8, padding: '12px 16px', overflowX: 'auto', flexShrink: 0,
  },
  requestCategoriesRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    overflowX: 'auto',
    flexShrink: 0,
  },
  categoryChip: {
    border: '1px solid transparent', borderRadius: 20, background: 'var(--create-surface-elevated)', color: '#fff',
    padding: '8px 16px', fontSize: 14, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', cursor: 'pointer',
  },
  categoryChipActive: { border: '1px solid var(--create-primary)', background: 'rgba(212,255,0,0.1)', color: 'var(--create-primary)' },
  slideContent: { padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', flex: '1 0 auto' },
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
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.3,
    padding: 0,
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: 12,
    caretColor: '#fff',
  },
  requestTextareaInput: {
    width: '100%',
    minHeight: 76,
    resize: 'none',
    overflow: 'hidden',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 16,
    fontWeight: 400,
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
  photoRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 },
  photoCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  photoImage: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 16, border: '1px solid var(--create-border)' },
  removePhotoBtn: {
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
  processingPlaceholder: { width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--create-primary)', fontSize: 13, fontWeight: 600, borderRadius: 16, border: '1px solid var(--create-border)', background: 'var(--create-surface-elevated)' },
  pollCard: { marginBottom: 16 },
  pollCloseRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 },
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
  anonBlock: { borderRadius: 16, background: 'rgba(212,255,0,0.05)', border: '1px solid rgba(212,255,0,0.2)', marginBottom: 16, overflow: 'hidden' },
  anonRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' },
  anonInfo: { flex: 1 },
  anonTitle: { fontSize: 14, fontWeight: 700, color: 'var(--create-primary)' },
  anonSubtitle: { fontSize: 12, color: 'var(--create-text-muted)', marginTop: 1 },
  anonCommentsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: 'none', borderTop: '1px solid rgba(212,255,0,0.1)', cursor: 'pointer' },
  anonCommentsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  anonToggleTrack: { width: 40, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  anonToggleTrackOn: { background: 'var(--create-primary)' },
  anonToggleDot: { width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: 2, transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  anonToggleDotOn: { transform: 'translateX(18px)' },
  scopeSummaryBlock: { borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 },
  scopeSummaryRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' },
  scopeSummaryInfo: { flex: 1 },
  scopeSummaryTitle: { fontSize: 14, fontWeight: 700, color: '#fff' },
  scopeSummaryText: { fontSize: 12, color: 'var(--create-text-muted)', marginTop: 2, lineHeight: 1.35 },
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
  scopePanelHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  scopeBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
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
  scopeDrillCard: {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
    textAlign: 'left',
  },
  scopeDrillInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0 },
  scopeDrillCaption: { fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', color: 'var(--create-text-muted)' },
  scopeDrillTitle: { fontSize: 15, fontWeight: 700, color: '#fff' },
  scopeDrillMeta: { fontSize: 12, color: 'var(--create-text-muted)', lineHeight: 1.35 },
  scopeDrillAction: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--create-primary)', flexShrink: 0 },
  scopeDrillActionText: { fontSize: 13, fontWeight: 700 },
  scopeSelectedPill: {
    marginBottom: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(212,255,0,0.08)',
    border: '1px solid rgba(212,255,0,0.22)',
    color: 'var(--create-primary)',
    fontSize: 13,
    fontWeight: 600,
  },
  scopeUniversityList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' },
  scopeUniversityBtn: {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '12px 14px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    textAlign: 'left',
  },
  scopeUniversityBtnActive: {
    background: 'rgba(212,255,0,0.1)',
    border: '1px solid var(--create-primary)',
  },
  scopeUniversityBtnLabel: { fontSize: 14, fontWeight: 600, color: 'inherit' },
  scopeUniversityBtnMeta: { fontSize: 12, color: 'var(--create-text-muted)', lineHeight: 1.35 },
  scopeUniversityEmpty: {
    padding: '14px 12px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.12)',
    color: 'var(--create-text-muted)',
    fontSize: 13,
    textAlign: 'center',
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
  toolbar: { padding: '10px 16px', paddingBottom: 'calc(10px + var(--screen-bottom-offset))', background: 'var(--create-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 20 },
  toolGroup: { display: 'flex', gap: 8 },
  toolBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  toolBtnActive: { background: 'rgba(212,255,0,0.15)', color: 'var(--create-primary)' },
  toolBtnDisabled: { opacity: 0.5 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--create-surface-elevated)', color: 'var(--create-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  sendBtnActive: { background: 'rgba(212,255,0,0.15)', color: 'var(--create-primary)' },
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

@keyframes createSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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


