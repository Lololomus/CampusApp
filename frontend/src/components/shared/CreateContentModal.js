import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Hash, Plus, Check, AlertCircle, MapPin, Calendar, 
  Image as ImageIcon, Trash2, BarChart2, Clock, EyeOff, Eye,
  Star, Gift
} from 'lucide-react';
import { useStore } from '../../store';
import { createPost, createRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_CREATE_POST, getOverlayZIndex } from '../../constants/zIndex';
import imageCompression from 'browser-image-compression';
import { REWARD_TYPES, REWARD_TYPE_LABELS, REWARD_TYPE_ICONS, CATEGORIES } from '../../types';
import PollCreator from '../posts/PollCreator'; 
import ConfirmationDialog from './ConfirmationDialog';
import { CharCounter, getBorderColor } from './FormValidation';
import { toast } from './Toast';
import { useTelegramScreen } from './telegram/useTelegramScreen';
import DrilldownHeader from './DrilldownHeader';
import { 
  POST_LIMITS, 
  REQUEST_LIMITS, 
  IMAGE_SETTINGS 
} from '../../constants/contentConstants';

// ===== CONSTANTS =====
const POPULAR_TAGS = ['python', 'react', 'помощь', 'курсовая', 'сопромат'];
const REQUEST_TAGS = ['помощь', 'срочно', 'курсовая', 'спорт', 'подвезти'];

const MAX_TITLE_LENGTH = POST_LIMITS.TITLE_MAX;
const MAX_BODY_LENGTH = POST_LIMITS.BODY_MAX;
const MAX_TAGS = POST_LIMITS.TAGS_MAX;
const MAX_IMAGES = POST_LIMITS.IMAGES_MAX;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;

const POST_CATEGORIES = CATEGORIES.map(cat => ({
  ...cat,
  color: theme.colors[cat.value] || theme.colors.primary
}));

const REQUEST_CATEGORIES = [
  { value: 'study', label: 'Учёба', icon: '📚', color: '#3b82f6' },
  { value: 'help', label: 'Помощь', icon: '🤝', color: '#10b981' },
  { value: 'hangout', label: 'Движ', icon: '🎉', color: '#f59e0b' }
];

function CreateContentModal({ onClose }) {
  const { addNewPost, addNewRequest, feedSubTab, setFeedSubTab } = useStore();

  // ===== GLOBAL STATE =====
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // ===== POST STATE =====
  const [postCategory, setPostCategory] = useState('news');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTags, setPostTags] = useState([]);
  const [postTagInput, setPostTagInput] = useState('');
   
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [processingImages, setProcessingImages] = useState([]);

  const [isAnonymous, setIsAnonymous] = useState(false);
   
  const [lostOrFound, setLostOrFound] = useState('lost');
  const [itemDescription, setItemDescription] = useState('');
  const [location, setLocation] = useState('');
  const [rewardType, setRewardType] = useState(REWARD_TYPES.NONE);
  const [rewardValue, setRewardValue] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventContact, setEventContact] = useState('');
  const [activeEventDateBtn, setActiveEventDateBtn] = useState(null);
  const [isImportant, setIsImportant] = useState(false);

  const [activeTab, setActiveTab] = useState(
  feedSubTab === 'requests' ? 'request' : 'post'
  );
   
  const [hasPoll, setHasPoll] = useState(false);
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', ''],
    type: 'regular',
    correctOption: null,
    allowMultiple: false,
    isAnonymous: true,
  });

  // ===== REQUEST STATE =====
  const [reqCategory, setReqCategory] = useState('study');
  const [reqTitle, setReqTitle] = useState('');
  const [reqBody, setReqBody] = useState('');
  const [reqTags, setReqTags] = useState([]);
  const [reqTagInput, setReqTagInput] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [activeTimeBtn, setActiveTimeBtn] = useState(72);
  const [reqRewardType, setReqRewardType] = useState(REWARD_TYPES.NONE);
  const [reqRewardValue, setReqRewardValue] = useState('');
  const [reqImages, setReqImages] = useState([]);
  const [reqImageFiles, setReqImageFiles] = useState([]);
  const [reqProcessingImages, setReqProcessingImages] = useState([]);


  // ===== REFS =====
  const postTitleRef = useRef(null);
  const reqTitleRef = useRef(null);
  const fileInputRef = useRef(null);
  const reqFileInputRef = useRef(null);

  // ===== EFFECTS =====

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 768 && !isSubmitting) {
      if (activeTab === 'post') setTimeout(() => postTitleRef.current?.focus(), 300);
      else setTimeout(() => reqTitleRef.current?.focus(), 300);
    }
  }, [activeTab, isSubmitting]);

  useEffect(() => {
    if (isAnonymous) {
      setPollData(prev => ({ ...prev, isAnonymous: true }));
    }
  }, [isAnonymous]);

  useEffect(() => {
    const draft = localStorage.getItem('createPostDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setPostCategory(parsed.postCategory || 'news');
          setPostTitle(parsed.postTitle || '');
          setPostBody(parsed.postBody || '');
        }
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (!expiresAt) {
      const hours = reqCategory === 'study' ? 72 : 24;
      const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
      setExpiresAt(targetDate.toISOString());
      setActiveTimeBtn(hours);
    }
  }, [reqCategory, expiresAt]);

  useEffect(() => {
    setItemDescription(''); setLocation(''); 
    setEventName(''); setEventDate(''); setEventLocation(''); setEventContact('');
    setRewardType(REWARD_TYPES.NONE); setRewardValue('');
    setIsImportant(false);
    setActiveEventDateBtn(null);
    
    if (postCategory === 'confessions') {
      setIsAnonymous(true);
      setImages([]); setImageFiles([]);
      setError('');
    } else {
      setIsAnonymous(false);
    }
    
    if (postCategory === 'polls') {
      setHasPoll(true);
      setImages([]); setImageFiles([]);
    } else {
      setHasPoll(false);
    }
  }, [postCategory]);

  // ===== HANDLERS =====

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (postCategory === 'confessions' || postCategory === 'polls') {
      hapticFeedback('error');
      toast.error(`В категории ${postCategory === 'confessions' ? 'Признания' : 'Опросы'} нельзя прикреплять изображения`);
      return;
    }

    const remainingSlots = MAX_IMAGES - images.length - processingImages.length;
    if (remainingSlots <= 0) {
      hapticFeedback('error');
      toast.error(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const newProcessors = filesToProcess.map(() => ({ id: Math.random().toString(36).substr(2, 9), progress: 0 }));
    setProcessingImages(prev => [...prev, ...newProcessors]);
    hapticFeedback('light');

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const procId = newProcessors[i].id;

        if (!ALLOWED_FORMATS.includes(file.type)) {
          setProcessingImages(prev => prev.filter(p => p.id !== procId));
          continue;
        }

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          onProgress: (prog) => {
            setProcessingImages(prev => prev.map(p => p.id === procId ? { ...p, progress: prog } : p));
          }
        };

        const compressedFile = await imageCompression(file, options);
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImages(prev => [...prev, ev.target.result]);
          setImageFiles(prev => [...prev, compressedFile]);
          setProcessingImages(prev => prev.filter(p => p.id !== procId));
        };
        reader.readAsDataURL(compressedFile);
      }
      hapticFeedback('success');
    } catch (err) { 
      console.error(err);
      setProcessingImages([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReqFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - reqImages.length - reqProcessingImages.length;
    if (remainingSlots <= 0) {
      hapticFeedback('error');
      toast.error(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const newProcessors = filesToProcess.map(() => ({ id: Math.random().toString(36).substr(2, 9), progress: 0 }));
    setReqProcessingImages(prev => [...prev, ...newProcessors]);
    hapticFeedback('light');

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const procId = newProcessors[i].id;

        if (!ALLOWED_FORMATS.includes(file.type)) {
          setReqProcessingImages(prev => prev.filter(p => p.id !== procId));
          continue;
        }

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          onProgress: (prog) => {
            setReqProcessingImages(prev => prev.map(p => p.id === procId ? { ...p, progress: prog } : p));
          }
        };

        const compressedFile = await imageCompression(file, options);
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          setReqImages(prev => [...prev, ev.target.result]);
          setReqImageFiles(prev => [...prev, compressedFile]);
          setReqProcessingImages(prev => prev.filter(p => p.id !== procId));
        };
        reader.readAsDataURL(compressedFile);
      }
      hapticFeedback('success');
    } catch (err) { 
      console.error(err);
      setReqProcessingImages([]);
    }
    if (reqFileInputRef.current) reqFileInputRef.current.value = '';
  };

  const handleAddImageClick = () => {
    if (postCategory === 'confessions' || postCategory === 'polls') {
      hapticFeedback('error');
      return;
    }
    fileInputRef.current?.click();
  };

  const addPostTag = (tag) => {
    const val = (tag || postTagInput).trim().toLowerCase();
    if (val && !postTags.includes(val) && postTags.length < MAX_TAGS && val.length <= 20) {
      setPostTags([...postTags, val]);
      setPostTagInput('');
      hapticFeedback('light');
    }
  };

  const addReqTag = (tag) => {
    const val = (tag || reqTagInput).trim().toLowerCase();
    if (val && !reqTags.includes(val) && reqTags.length < MAX_TAGS && val.length <= 20) {
      setReqTags([...reqTags, val]);
      setReqTagInput('');
      hapticFeedback('light');
    }
  };

  const setQuickTime = (hours) => {
    hapticFeedback('light');
    const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    setExpiresAt(targetDate.toISOString());
    setActiveTimeBtn(hours);
  };

  const setQuickDate = (type) => {
    hapticFeedback('light');
    const now = new Date();
    let targetDate = new Date();
    if (type === 'today') targetDate.setHours(18, 0, 0, 0);
    else if (type === 'tomorrow') { targetDate.setDate(now.getDate() + 1); targetDate.setHours(18, 0, 0, 0); }
    else if (type === 'week') { targetDate.setDate(now.getDate() + 7); targetDate.setHours(18, 0, 0, 0); }
    
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    
    setEventDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setActiveEventDateBtn(type);
  };

  // ===== VALIDATION =====
  const isPostFormValid = () => {
    if (postCategory === 'polls') {
      const validOptions = pollData.options.filter(o => o.trim()).length;
      return pollData.question.trim().length >= 3 && validOptions >= 2;
    }
    const basicValid = postTitle.trim().length >= 3 && postBody.trim().length >= 10;
    if (postCategory === 'lost_found') return basicValid && itemDescription.trim().length >= 5 && location.trim().length >= 3;
    if (postCategory === 'events') return basicValid && eventName.trim().length >= 3 && eventDate && eventLocation.trim().length >= 3;
    return basicValid;
  };

  const isRequestFormValid = () => {
    return reqTitle.trim().length >= 10 && reqBody.trim().length >= 20 && !!expiresAt;
  };

  const hasAnyContent = () => {
    if (activeTab === 'post') return postTitle.trim().length >= 3 || postBody.trim().length >= 10;
    return reqTitle.trim().length >= 10 || reqBody.trim().length >= 20;
  };

  const handleClose = () => {
    if (hasAnyContent() && !isSubmitting) {
      hapticFeedback('light');
      setShowConfirmation(true);
    } else {
      confirmClose();
    }
  };

  const confirmClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      localStorage.removeItem('createPostDraft');
      localStorage.removeItem('createRequestDraft');
    }, 300);
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    setError('');
    
    if (activeTab === 'post') {
      if (!isPostFormValid()) {
        hapticFeedback('error');
        if (postCategory === 'polls') setError('Введите вопрос (3+) и минимум 2 варианта ответа');
        else if (postCategory === 'lost_found') setError('Заполните описание предмета и место');
        else if (postCategory === 'events') setError('Заполните название, дату и место события');
        else setError('Заполните заголовок (3+) и описание (10+)');
        return;
      }

      if (hasPoll && postCategory !== 'polls') {
        if (!pollData.question.trim() || pollData.options.filter(o=>o.trim()).length < 2) {
          setError('Заполните опрос корректно');
          return;
        }
      }

      setIsSubmitting(true);
      setUploadProgress(10);
      
      try {
        const formData = new FormData();
        formData.append('category', postCategory);
        
        if (postCategory === 'polls') {
          formData.append('title', pollData.question.trim() || 'Опрос');
          formData.append('body', postBody.trim() || 'Опрос');
        } else {
          formData.append('title', postTitle.trim());
          formData.append('body', postBody.trim());
        }
        
        formData.append('tags', JSON.stringify(postTags));
        formData.append('is_anonymous', isAnonymous);
        formData.append('enable_anonymous_comments', postCategory === 'confessions' ? true : isAnonymous);
        
        if (postCategory === 'lost_found') {
          formData.append('lost_or_found', lostOrFound);
          formData.append('item_description', itemDescription);
          formData.append('location', location);
          if (lostOrFound === 'lost' && rewardType !== REWARD_TYPES.NONE) {
            formData.append('reward_type', rewardType);
            formData.append('reward_value', rewardValue);
          }
        }
        
        if (postCategory === 'events') {
          formData.append('event_name', eventName);
          formData.append('event_date', new Date(eventDate).toISOString());
          formData.append('event_location', eventLocation);
          if (eventContact) formData.append('event_contact', eventContact);
        }
        
        if (postCategory === 'news') formData.append('is_important', isImportant);
        
        if (hasPoll || postCategory === 'polls') {
          const cleanPoll = { ...pollData, options: pollData.options.filter(o => o.trim()) };
          if (isAnonymous) cleanPoll.isAnonymous = true;
          formData.append('poll_data', JSON.stringify(cleanPoll));
        }
        
        imageFiles.forEach(f => formData.append('images', f));

        setUploadProgress(50);
        const newPost = await createPost(formData, (pe) => setUploadProgress(Math.round(40 + (pe.loaded / pe.total) * 50)));
        addNewPost(newPost);
        localStorage.removeItem('createPostDraft');
        setUploadProgress(100);
        hapticFeedback('success');
        toast.success('Пост опубликован!');
        setTimeout(confirmClose, 100);
      } catch (e) {
        console.error(e); 

        let errorMsg = 'Ошибка публикации';
        
        if (e.response?.data?.detail) {
          const detail = e.response.data.detail;
          
          if (Array.isArray(detail)) {
            errorMsg = detail.map(err => err.msg || err.type).join(', ');
          } else if (typeof detail === 'string') {
            errorMsg = detail;
          }
        }
        
        toast.error(errorMsg);
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    } else {
      if (!isRequestFormValid()) {
        hapticFeedback('error');
        setError('Заполните обязательные поля (Заголовок 10+, Описание 20+)');
        return;
      }
      
      setIsSubmitting(true);
      setUploadProgress(20);
      
      try {
        const formData = new FormData();
        formData.append('category', reqCategory);
        formData.append('title', reqTitle.trim());
        formData.append('body', reqBody.trim());
        formData.append('expires_at', expiresAt); // ✅ ISO строка
        
        if (reqTags && reqTags.length > 0) {
          formData.append('tags', JSON.stringify(reqTags));
        } else {
          formData.append('tags', JSON.stringify([]));
        }
        
        formData.append('max_responses', '5');

        if (reqRewardType && reqRewardType !== REWARD_TYPES.NONE) {
          formData.append('reward_type', reqRewardType);
          if (reqRewardValue && reqRewardValue.trim()) {
            formData.append('reward_value', reqRewardValue.trim());
          }
        }

        if (reqImageFiles && reqImageFiles.length > 0) {
          reqImageFiles.forEach(f => formData.append('images', f));
        }

        setUploadProgress(60);
        const newReq = await createRequest(formData, (pe) => {
          setUploadProgress(Math.round(50 + (pe.loaded / pe.total) * 40));
        });
        
        addNewRequest(newReq);
        localStorage.removeItem('createRequestDraft');
        setUploadProgress(100);
        hapticFeedback('success');
        toast.success('Запрос создан!');

        if (feedSubTab !== 'requests') {
          setFeedSubTab('requests');
        }

        setTimeout(confirmClose, 100);
      } catch (e) {
        console.error('❌ Ошибка создания запроса:', e);
        console.error('Response:', e.response?.data);
        
        let errorMsg = 'Ошибка создания запроса';
        
        if (e.response?.data?.detail) {
          const detail = e.response.data.detail;
          
          // Validation errors (массив)
          if (Array.isArray(detail)) {
            errorMsg = detail.map(err => {
              const field = err.loc ? err.loc[err.loc.length - 1] : '';
              return `${field}: ${err.msg || err.type}`;
            }).join('; ');
          } 
          // Строка
          else if (typeof detail === 'string') {
            errorMsg = detail;
          }
        }
        
        toast.error(errorMsg);
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    }
  };

  // ===== RENDER HELPERS =====
  
  const TagBadge = ({ tag, onRemove }) => (
    <span style={styles.tag}>
      #{tag}
      <button style={styles.tagRemove} onClick={(e) => { e.stopPropagation(); onRemove(tag); }} disabled={isSubmitting}>
        <X size={16} />
      </button>
    </span>
  );

  const CircularProgress = ({ progress }) => (
    <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle 
          cx="20" cy="20" r="16" fill="none" stroke={theme.colors.primary} strokeWidth="4" 
          strokeDasharray={`${2 * Math.PI * 16}`} 
          strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`} 
          strokeLinecap="round" 
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
    </div>
  );

  const getFeatureBtnStyle = (isActive) => ({
    ...styles.featureBtn,
    borderColor: isActive ? theme.colors.primary : theme.colors.border,
    background: isActive ? `${theme.colors.primary}15` : 'transparent',
    color: isActive ? theme.colors.primary : theme.colors.textSecondary
  });

  const getPlaceholders = () => {
    switch(postCategory) {
      case 'confessions': return { title: 'О чём признание?', body: 'Напишите всё, что на душе (полностью анонимно)...' };
      case 'lost_found': return { title: 'Кратко: что случилось?', body: 'Дополнительные детали, если нужно...' };
      case 'events': return { title: 'Анонс мероприятия', body: 'Программа, условия входа и детали...' };
      default: return { title: 'Например: Как пройти в библиотеку?', body: 'Опишите подробнее...' };
    }
  };
  
  const placeholders = getPlaceholders();
  const canSubmit = activeTab === 'post' ? isPostFormValid() : isRequestFormValid();
  const editorTitle = activeTab === 'post' ? 'Создание поста' : 'Создание запроса';
  const submitText = activeTab === 'post' ? 'Опубликовать' : 'Создать запрос';

  useTelegramScreen({
    id: 'create-content-modal',
    title: editorTitle,
    priority: 120,
    back: {
      visible: isVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: showConfirmation
      ? {
          visible: isVisible,
          text: 'Выйти',
          onClick: confirmClose,
          enabled: !isSubmitting,
          loading: false,
          color: theme.colors.error,
        }
      : {
          visible: isVisible,
          text: submitText,
          onClick: handleSubmit,
          enabled: canSubmit && !isSubmitting,
          loading: isSubmitting,
        },
    secondary: {
      visible: isVisible && showConfirmation,
      text: 'Вернуться',
      onClick: () => setShowConfirmation(false),
      enabled: !isSubmitting,
      loading: false,
    },
  });

  return (
    <>
      <style>{keyframesStyles}</style>
      
      <div 
        style={{
          ...styles.overlay,
          opacity: isVisible ? 1 : 0,
          pointerEvents: showConfirmation ? 'none' : 'auto'
        }}
        onClick={handleClose}
      >
        <div 
          style={{
            ...styles.modal,
            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
            opacity: isVisible ? 1 : 0
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isSubmitting && (
            <div style={styles.topProgressBar}>
              <div style={{ ...styles.topProgressFill, width: `${uploadProgress}%` }} />
            </div>
          )}

          {/* Telegram/local header */}
          <DrilldownHeader title={editorTitle} onBack={handleClose} />

          {/* TAB SWITCHER */}
          <div style={styles.contentTypeSection}>
            <div style={styles.contentTypeSwitcher}>
              <button
                onClick={() => { setActiveTab('post'); hapticFeedback('light'); }}
                style={activeTab === 'post' ? {...styles.contentTypeBtn, ...styles.contentTypeBtnActive} : styles.contentTypeBtn}
                disabled={isSubmitting}
              >
                Пост
              </button>
              <button
                onClick={() => { setActiveTab('request'); hapticFeedback('light'); }}
                style={activeTab === 'request' ? {...styles.contentTypeBtn, ...styles.contentTypeBtnActive} : styles.contentTypeBtn}
                disabled={isSubmitting}
              >
                Запрос
              </button>
            </div>
            <p style={styles.contentTypeHint}>
              {activeTab === 'post' ? 'Посты для обсуждения' : 'Запросы для срочных задач'}
            </p>
          </div>

          {/* CONTENT SLIDER */}
          <div style={styles.contentWrapper}>
            <div style={{
              ...styles.slidingTrack,
              transform: `translateX(${activeTab === 'post' ? '0' : '-50%'})`
            }}>
              
              {/* ===== POST FORM (LEFT) ===== */}
              <div style={styles.formSlide}>
                <div style={styles.formScrollContent}>
                  
                  {/* Category */}
                  <div style={styles.section}>
                    <label style={styles.label}>Категория</label>
                    <div style={styles.categoriesGrid}>
                      {POST_CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => { setPostCategory(cat.value); hapticFeedback('light'); }}
                          style={postCategory === cat.value ? { ...styles.categoryButton, background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`, color: '#fff', borderColor: 'transparent', boxShadow: `0 4px 12px ${cat.color}40` } : styles.categoryButton}
                          disabled={isSubmitting}
                        >
                          <span style={styles.categoryIcon}>{cat.icon}</span>
                          <span style={styles.categoryLabel}>{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    {postCategory === 'news' && (
                        <div style={styles.optionsGrid}>
                            <button 
                                style={getFeatureBtnStyle(isImportant)}
                                onClick={() => { setIsImportant(!isImportant); hapticFeedback('light'); }}
                                disabled={isSubmitting}
                            >
                                <Star size={18} fill={isImportant ? theme.colors.primary : 'none'} />
                                <span>{isImportant ? 'Закреплено' : 'Закрепить?'}</span>
                            </button>

                            <button 
                                style={getFeatureBtnStyle(isAnonymous)}
                                onClick={() => { setIsAnonymous(!isAnonymous); hapticFeedback('light'); }}
                                disabled={isSubmitting}
                            >
                                {isAnonymous ? <EyeOff size={18} /> : <Eye size={18} />}
                                <span>{isAnonymous ? 'Анонимно' : 'Анонимно?'}</span>
                            </button>
                        </div>
                    )}
                    
                    {postCategory !== 'news' && postCategory !== 'confessions' && postCategory !== 'polls' && (
                        <button 
                            style={getFeatureBtnStyle(isAnonymous)}
                            onClick={() => { setIsAnonymous(!isAnonymous); hapticFeedback('light'); }}
                            disabled={isSubmitting}
                        >
                            {isAnonymous ? <EyeOff size={18} /> : <Eye size={18} />}
                            <span>{isAnonymous ? 'Анонимно' : 'Анонимно?'}</span>
                        </button>
                    )}
                    
                    {postCategory === 'confessions' && (
                        <div style={styles.confessionHint}>
                            <EyeOff size={16} style={{marginRight:8}} />
                            Публикуется полностью анонимно
                        </div>
                    )}
                  </div>

                  {/* Main Inputs */}
                  {postCategory !== 'polls' && (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>
                          Заголовок*
                          <CharCounter current={postTitle.length} min={3} max={MAX_TITLE_LENGTH} isValid={postTitle.trim().length >= 3} />
                        </label>
                        <div style={styles.inputWrapper}>
                          <input 
                            ref={postTitleRef}
                            type="text" 
                            placeholder={placeholders.title} 
                            value={postTitle} 
                            onChange={(e) => setPostTitle(e.target.value)}
                            style={{
                              ...styles.input, 
                              borderColor: getBorderColor(postTitle.trim().length >= 3, attemptedSubmit)
                            }} 
                            maxLength={MAX_TITLE_LENGTH} 
                            disabled={isSubmitting}
                          />
                          {postTitle.trim().length >= 3 && <Check size={20} style={styles.inputCheckIcon} />}
                        </div>
                      </div>
                      <div style={styles.section}>
                        <label style={styles.label}>
                          Описание*
                          <CharCounter current={postBody.length} min={10} max={MAX_BODY_LENGTH} isValid={postBody.trim().length >= 10} />
                        </label>
                        <div style={styles.inputWrapper}>
                          <textarea 
                            placeholder={placeholders.body}
                            value={postBody} 
                            onChange={(e) => setPostBody(e.target.value)}
                            style={{
                              ...styles.textarea, 
                              borderColor: getBorderColor(postBody.trim().length >= 10, attemptedSubmit)
                            }}
                            rows={6} 
                            maxLength={MAX_BODY_LENGTH} 
                            disabled={isSubmitting}
                          />
                          {postBody.trim().length >= 10 && <Check size={20} style={styles.textareaCheckIcon} />}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* LOST & FOUND */}
                  {postCategory === 'lost_found' && (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>Что случилось?</label>
                        <div style={styles.toggleWrapper}>
                            <button onClick={()=>{setLostOrFound('lost'); hapticFeedback('light');}} style={lostOrFound==='lost' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}>😢 Потерял</button>
                            <button onClick={()=>{setLostOrFound('found'); hapticFeedback('light');}} style={lostOrFound==='found' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}>🎉 Нашёл</button>
                        </div>
                      </div>
                        <div style={styles.section}>
                          <label style={styles.label}>Что именно?*</label>
                          <input 
                            type="text" 
                            placeholder="Например: Чёрный рюкзак Nike" 
                            value={itemDescription} 
                            onChange={e => setItemDescription(e.target.value)} 
                            style={{
                              ...styles.input, 
                              borderColor: getBorderColor(itemDescription.trim().length >= 5, attemptedSubmit)
                            }} 
                            disabled={isSubmitting} 
                          />
                        </div>
                        <div style={styles.section}>
                          <label style={styles.label}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                              <MapPin size={14} /> Где?*
                            </div>
                          </label>
                          <input 
                            type="text" 
                            placeholder="Например: Возле столовой ГУК" 
                            value={location} 
                            onChange={e => setLocation(e.target.value)} 
                            style={{
                              ...styles.input, 
                              borderColor: getBorderColor(location.trim().length >= 3, attemptedSubmit)
                            }} 
                            disabled={isSubmitting} 
                          />
                        </div>
                      
                      {lostOrFound === 'lost' && (
                        <div style={styles.section}>
                            <label style={styles.label}>Вознаграждение (опционально)</label>
                            <select value={rewardType} onChange={e=>setRewardType(e.target.value)} style={{...styles.input, marginBottom: 8}}>
                                {Object.entries(REWARD_TYPE_LABELS).map(([k,l])=><option key={k} value={k}>{REWARD_TYPE_ICONS[k]} {l}</option>)}
                            </select>
                            {rewardType !== REWARD_TYPES.NONE && (
                                <input type="text" placeholder={rewardType==='money'?"Сумма (500р)":"Что подарите?"} value={rewardValue} onChange={e=>setRewardValue(e.target.value)} style={styles.input} />
                            )}
                        </div>
                      )}
                    </>
                  )}

                  {/* EVENTS */}
                  {postCategory === 'events' && (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>Название события*</label>
                        <input 
                          type="text" 
                          placeholder="Например: Хакатон 2025" 
                          value={eventName} 
                          onChange={e => setEventName(e.target.value)} 
                          style={{
                            ...styles.input, 
                            borderColor: getBorderColor(eventName.trim().length >= 3, attemptedSubmit)
                          }} 
                          disabled={isSubmitting} 
                        />
                      </div>
                      <div style={styles.section}>
                         <label style={styles.label}><div style={{display:'flex',alignItems:'center',gap:6}}><Calendar size={14}/> Дата и время*</div></label>
                         <div style={styles.quickDateButtons}>
                             <button 
                                onClick={()=>setQuickDate('today')} 
                                style={activeEventDateBtn === 'today' ? styles.quickDateBtnActive : styles.quickDateBtn} 
                                type="button"
                             >
                                Сегодня
                             </button>
                             <button 
                                onClick={()=>setQuickDate('tomorrow')} 
                                style={activeEventDateBtn === 'tomorrow' ? styles.quickDateBtnActive : styles.quickDateBtn} 
                                type="button"
                             >
                                Завтра
                             </button>
                             <button 
                                onClick={()=>setQuickDate('week')} 
                                style={activeEventDateBtn === 'week' ? styles.quickDateBtnActive : styles.quickDateBtn} 
                                type="button"
                             >
                                Через неделю
                             </button>
                         </div>
                         <input 
                            type="datetime-local" 
                            value={eventDate} 
                            onChange={e => { setEventDate(e.target.value); setActiveEventDateBtn(null); }} 
                            style={{
                              ...styles.input, 
                              marginTop: theme.spacing.sm, 
                              borderColor: getBorderColor(!!eventDate, attemptedSubmit)
                            }} 
                            disabled={isSubmitting} 
                          />
                      </div>
                      <div style={styles.section}>
                        <label style={styles.label}>
                          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                            <MapPin size={14} /> Место проведения*
                          </div>
                        </label>
                        <input 
                          type="text" 
                          placeholder="Например: Актовый зал" 
                          value={eventLocation} 
                          onChange={e => setEventLocation(e.target.value)} 
                          style={{
                            ...styles.input, 
                            borderColor: getBorderColor(eventLocation.trim().length >= 3, attemptedSubmit)
                          }} 
                          disabled={isSubmitting} 
                        />
                      </div>
                      <div style={styles.section}>
                          <label style={styles.label}>Контакт (опционально)</label>
                          <input type="text" placeholder="@username" value={eventContact} onChange={e=>setEventContact(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                    </>
                  )}
                  
                  {/* POLLS SECTION */}
                  <div style={styles.section}>
                    {postCategory !== 'polls' && (
                        <button 
                            style={getFeatureBtnStyle(hasPoll)}
                            onClick={() => { setHasPoll(!hasPoll); hapticFeedback('light'); }}
                            disabled={isSubmitting}
                        >
                            <BarChart2 size={18} />
                            <span>{hasPoll ? 'Убрать опрос' : 'Добавить опрос'}</span>
                        </button>
                    )}
                    
                    <div style={{
                        maxHeight: (hasPoll || postCategory === 'polls') ? (postCategory === 'polls' ? 'none' : '2000px') : '0',
                        opacity: (hasPoll || postCategory === 'polls') ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        marginTop: (hasPoll || postCategory === 'polls') ? theme.spacing.md : 0,
                    }}>
                        <div style={styles.pollEditorWrapper}>
                            <PollCreator pollData={pollData} onChange={setPollData} />
                        </div>
                    </div>
                  </div>

                  {/* IMAGES */}
                  {postCategory !== 'polls' && postCategory !== 'confessions' && (
                    <div style={styles.section}>
                      <label style={styles.label}>
                          Изображения (опционально)
                          <span style={styles.charCount}>{images.length + processingImages.length}/{MAX_IMAGES}</span>
                      </label>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                      
                      {(images.length > 0 || processingImages.length > 0) ? (
                        <div style={styles.imagesPreview}>
                            {images.map((img, i) => (
                            <div key={i} style={styles.imagePreviewItem}>
                                <img src={img} style={styles.previewImage} alt="" />
                                <button onClick={() => { setImages(p => p.filter((_, idx) => idx !== i)); setImageFiles(p => p.filter((_, idx) => idx !== i)); }} style={styles.removeImageButton}><Trash2 size={16} /></button>
                            </div>
                            ))}
                            {processingImages.map((proc) => (
                                <div key={proc.id} style={styles.imagePreviewItem}>
                                    <div style={styles.loadingOverlay}>
                                        <CircularProgress progress={proc.progress} />
                                        <span style={styles.loadingPercent}>{Math.round(proc.progress)}%</span>
                                    </div>
                                </div>
                            ))}
                            {(images.length + processingImages.length) < MAX_IMAGES && (
                            <button onClick={handleAddImageClick} style={styles.addImagePlaceholder} disabled={isSubmitting}>
                                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <Plus size={24} />
                                </div>
                            </button>
                            )}
                        </div>
                      ) : (
                          <button onClick={handleAddImageClick} style={styles.addImageButton} disabled={isSubmitting}>
                              <ImageIcon size={20} /> Добавить фото
                          </button>
                      )}
                    </div>
                  )}

                  {/* TAGS */}
                  <div style={styles.section}>
                    <label style={styles.label}>Теги (опционально)</label>
                    {postTags.length < MAX_TAGS && (
                      <div style={styles.quickTagsWrapper}>
                        {POPULAR_TAGS.filter(t => !postTags.includes(t)).slice(0, 5).map(t => (
                          <button key={t} onClick={() => addPostTag(t)} style={styles.quickTagBtn}>#{t}</button>
                        ))}
                      </div>
                    )}
                    <div style={styles.tagInputWrapper}>
                      <Hash size={18} style={{ color: theme.colors.primary, flexShrink: 0 }} />
                      <input type="text" value={postTagInput} onChange={(e) => setPostTagInput(e.target.value)} style={styles.tagInput} placeholder="python, react..." onKeyPress={(e) => e.key === 'Enter' && addPostTag()} disabled={isSubmitting || postTags.length>=MAX_TAGS} />
                      <button onClick={() => addPostTag()} style={postTagInput.trim() ? {...styles.addTagButton, opacity: 1, background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`} : styles.addTagButton} disabled={!postTagInput.trim()}><Plus size={18} /></button>
                    </div>
                    {postTags.length > 0 && (
                        <div style={styles.tagsList}>
                        {postTags.map(tag => <TagBadge key={tag} tag={tag} onRemove={(t) => setPostTags(p => p.filter(x => x !== t))} />)}
                        </div>
                    )}
                  </div>
                  <div style={{ height: theme.spacing.xl }} />
                </div>
              </div>

              {/* ===== REQUEST FORM (RIGHT) ===== */}
              <div style={styles.formSlide}>
                <div style={styles.formScrollContent}>
                  
                  {/* Category */}
                  <div style={styles.section}>
                    <label style={styles.label}>Категория запроса</label>
                    <div style={styles.categoriesGrid}>
                      {REQUEST_CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => { setReqCategory(cat.value); hapticFeedback('light'); }}
                          style={reqCategory === cat.value ? { ...styles.categoryButton, background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`, color: '#fff', borderColor: 'transparent', boxShadow: `0 4px 12px ${cat.color}40` } : styles.categoryButton}
                          disabled={isSubmitting}
                        >
                          <span style={styles.categoryIcon}>{cat.icon}</span>
                          <span style={styles.categoryLabel}>{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Inputs */}
                  <div style={styles.section}>
                    <label style={styles.label}>
                        Краткая суть*
                        <CharCounter current={reqTitle.length} min={10} max={MAX_TITLE_LENGTH} isValid={reqTitle.length >= 10} />
                    </label>
                    <div style={styles.inputWrapper}>
                      <input 
                        ref={reqTitleRef}
                        type="text" 
                        placeholder="Помогите с курсовой по сопромату" 
                        value={reqTitle} 
                        onChange={e => setReqTitle(e.target.value)}
                        style={{
                          ...styles.input, 
                          borderColor: getBorderColor(reqTitle.trim().length >= 10, attemptedSubmit)
                        }} 
                        maxLength={MAX_TITLE_LENGTH} 
                        disabled={isSubmitting}
                      />
                      {reqTitle.trim().length >= 10 && <Check size={20} style={styles.inputCheckIcon} />}
                    </div>
                  </div>
                  <div style={styles.section}>
                    <label style={styles.label}>
                        Подробности*
                        <CharCounter current={reqBody.length} min={20} max={MAX_BODY_LENGTH} isValid={reqBody.length >= 20} />
                    </label>
                    <div style={styles.inputWrapper}>
                      <textarea 
                        placeholder="Описание, сроки, требования..."
                        value={reqBody} 
                        onChange={e => setReqBody(e.target.value)}
                        style={{
                          ...styles.textarea, 
                          borderColor: getBorderColor(reqBody.trim().length >= 20, attemptedSubmit)
                        }}
                        rows={6} 
                        maxLength={MAX_BODY_LENGTH} 
                        disabled={isSubmitting}
                      />
                      {reqBody.trim().length >= 20 && <Check size={20} style={styles.textareaCheckIcon} />}
                    </div>
                  </div>

                  {/* ✅✅✅ НАГРАДА ДЛЯ REQUEST ✅✅✅ */}
                  <div style={styles.section}>
                    <label style={styles.label}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <Gift size={16}/> Награда
                      </div>
                      <span style={{fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, fontWeight: 400}}>опционально</span>
                    </label>
                    <div style={{
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      background: `linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,165,0,0.08) 100%)`,
                      border: `2px dashed rgba(255,215,0,0.25)`
                    }}>
                      <select 
                        value={reqRewardType} 
                        onChange={e=>setReqRewardType(e.target.value)} 
                        style={{...styles.input, marginBottom: reqRewardType !== REWARD_TYPES.NONE ? theme.spacing.sm : 0}}
                        disabled={isSubmitting}
                      >
                        {Object.entries(REWARD_TYPE_LABELS).map(([k,l])=>(
                          <option key={k} value={k}>{REWARD_TYPE_ICONS[k]} {l}</option>
                        ))}
                      </select>
                      {reqRewardType !== REWARD_TYPES.NONE && (
                        <input 
                          type="text" 
                          placeholder={
                            reqRewardType==='money' ? "Например: 500₽" :
                            reqRewardType==='help_back' ? "Например: Помогу с программированием" :
                            reqRewardType==='food' ? "Например: Кофе в буфете" :
                            "Опишите награду"
                          }
                          value={reqRewardValue} 
                          onChange={e=>setReqRewardValue(e.target.value)} 
                          style={styles.input}
                          maxLength={100}
                          disabled={isSubmitting}
                        />
                      )}
                    </div>
                  </div>

                  {/* ✅✅✅ ИЗОБРАЖЕНИЯ ДЛЯ REQUEST ✅✅✅ */}
                  <div style={styles.section}>
                    <label style={styles.label}>
                        Изображения (опционально)
                        <span style={styles.charCount}>{reqImages.length + reqProcessingImages.length}/{MAX_IMAGES}</span>
                    </label>
                    <input 
                      ref={reqFileInputRef} 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={handleReqFileSelect} 
                      style={{ display: 'none' }} 
                    />
                    
                    {(reqImages.length > 0 || reqProcessingImages.length > 0) ? (
                      <div style={styles.imagesPreview}>
                          {reqImages.map((img, i) => (
                          <div key={i} style={styles.imagePreviewItem}>
                              <img src={img} style={styles.previewImage} alt="" />
                              <button 
                                onClick={() => { 
                                  setReqImages(p => p.filter((_, idx) => idx !== i)); 
                                  setReqImageFiles(p => p.filter((_, idx) => idx !== i)); 
                                }} 
                                style={styles.removeImageButton}
                                disabled={isSubmitting}
                              >
                                <Trash2 size={16} />
                              </button>
                          </div>
                          ))}
                          {reqProcessingImages.map((proc) => (
                              <div key={proc.id} style={styles.imagePreviewItem}>
                                  <div style={styles.loadingOverlay}>
                                      <CircularProgress progress={proc.progress} />
                                      <span style={styles.loadingPercent}>{Math.round(proc.progress)}%</span>
                                  </div>
                              </div>
                          ))}
                          {(reqImages.length + reqProcessingImages.length) < MAX_IMAGES && (
                          <button 
                            onClick={() => reqFileInputRef.current?.click()} 
                            style={styles.addImagePlaceholder} 
                            disabled={isSubmitting}
                          >
                              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                  <Plus size={24} />
                              </div>
                          </button>
                          )}
                      </div>
                    ) : (
                        <button 
                          onClick={() => reqFileInputRef.current?.click()} 
                          style={styles.addImageButton} 
                          disabled={isSubmitting}
                        >
                            <ImageIcon size={20} /> Добавить фото
                        </button>
                    )}
                  </div>

                  {/* Expires At */}
                  <div style={styles.section}>
                    <label style={styles.label}><div style={{display:'flex',alignItems:'center',gap:6}}><Clock size={16}/> Актуально до*</div></label>
                    <div style={styles.quickDateButtons}>
                      {[3, 24, 72].map(h => (
                          <button 
                            key={h}
                            onClick={() => { setQuickTime(h); setActiveTimeBtn(h); }} 
                            style={activeTimeBtn === h ? styles.quickDateBtnActive : styles.quickDateBtn}
                            type="button"
                            disabled={isSubmitting}
                          >
                              {h === 72 ? '3 дня' : `${h}ч`}
                          </button>
                      ))}
                    </div>
                    <input 
                      type="datetime-local" 
                      value={expiresAt ? expiresAt.slice(0, 16) : ''} 
                      onChange={e => { 
                        setExpiresAt(new Date(e.target.value).toISOString()); 
                        setActiveTimeBtn(0); 
                      }}
                      style={{
                        ...styles.input, 
                        marginTop: theme.spacing.sm, 
                        borderColor: getBorderColor(!!expiresAt, attemptedSubmit)
                      }} 
                      disabled={isSubmitting} 
                    />
                  </div>

                  {/* Tags */}
                  <div style={styles.section}>
                    <label style={styles.label}>Теги (опционально)</label>
                    {reqTags.length < MAX_TAGS && (
                      <div style={styles.quickTagsWrapper}>
                        {REQUEST_TAGS.filter(t => !reqTags.includes(t)).slice(0, 5).map(t => (
                          <button key={t} onClick={() => addReqTag(t)} style={styles.quickTagBtn} disabled={isSubmitting}>#{t}</button>
                        ))}
                      </div>
                    )}
                    <div style={styles.tagInputWrapper}>
                      <Hash size={18} style={{ color: theme.colors.primary, flexShrink: 0 }} />
                      <input type="text" value={reqTagInput} onChange={(e) => setReqTagInput(e.target.value)} style={styles.tagInput} placeholder="помощь, срочно..." onKeyPress={(e) => e.key === 'Enter' && addReqTag()} disabled={isSubmitting || reqTags.length>=MAX_TAGS} />
                      <button onClick={() => addReqTag()} style={reqTagInput.trim() ? {...styles.addTagButton, opacity: 1, background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`} : styles.addTagButton} disabled={!reqTagInput.trim() || isSubmitting}><Plus size={18} /></button>
                    </div>
                    {reqTags.length > 0 && (
                        <div style={styles.tagsList}>
                        {reqTags.map(tag => <TagBadge key={tag} tag={tag} onRemove={(t) => setReqTags(p => p.filter(x => x !== t))} />)}
                        </div>
                    )}
                  </div>
                  <div style={{ height: theme.spacing.xl }} />
                </div>
              </div>

            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

        </div>
      </div>

      {/* CONFIRMATION DIALOG */}
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
}

// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
    zIndex: getOverlayZIndex(Z_MODAL_CREATE_POST), display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    transition: 'opacity 0.3s ease',
  },
  modal: {
    position: 'fixed', inset: 0,
    background: theme.colors.bg,
    display: 'flex', flexDirection: 'column',
    boxShadow: theme.shadows.lg,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  },
  topProgressBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: theme.colors.bgSecondary, zIndex: 1000,
  },
  topProgressFill: {
    height: '100%', background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.success} 100%)`,
    transition: 'width 0.3s ease',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderBottom: `1px solid ${theme.colors.border}`, flexShrink: 0,
  },
  closeButton: {
    background: 'none', border: 'none', color: theme.colors.text,
    padding: 8, borderRadius: theme.radius.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, margin: 0,
  },
  
  contentTypeSection: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderBottom: `1px solid ${theme.colors.border}`, flexShrink: 0,
  },
  contentTypeSwitcher: {
    display: 'flex', background: theme.colors.bgSecondary,
    borderRadius: theme.radius.md, padding: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  contentTypeBtn: {
    flex: 1, padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    background: 'transparent', border: 'none', borderRadius: theme.radius.sm,
    color: theme.colors.textSecondary, fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium, cursor: 'pointer', transition: 'all 0.2s ease',
  },
  contentTypeBtnActive: {
    background: theme.colors.primary, color: '#fff',
  },
  contentTypeHint: {
    fontSize: theme.fontSize.xs, color: theme.colors.textTertiary,
    textAlign: 'center', margin: 0,
  },

  contentWrapper: {
    flex: 1, overflow: 'hidden', position: 'relative',
  },
  slidingTrack: {
    display: 'flex', width: '200%', height: '100%',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  formSlide: {
    width: '50%', height: '100%',
    overflowY: 'auto', overflowX: 'hidden',
  },
  formScrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: `calc(${theme.spacing.lg}px + var(--screen-bottom-offset))`,
  },

  section: { marginBottom: theme.spacing.lg },
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text, marginBottom: theme.spacing.sm,
  },
  charCount: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.normal, display: 'flex', alignItems: 'center', gap: 4 },
  categoriesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.sm, marginBottom: theme.spacing.md,
  },
  categoryButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.xs}px`,
    background: theme.colors.bgSecondary, 
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: theme.spacing.xs, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium,
    cursor: 'pointer', transition: 'all 0.2s ease',
  },
  categoryIcon: { fontSize: 20 },
  categoryLabel: { fontSize: theme.fontSize.xs },
  
  inputWrapper: { position: 'relative' },
  
  input: {
    width: '100%', padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary, 
    borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border,
    borderRadius: theme.radius.md, color: theme.colors.text, fontSize: theme.fontSize.md,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s ease',
  },
  textarea: {
    width: '100%', padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary, 
    borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border,
    borderRadius: theme.radius.md, color: theme.colors.text, fontSize: theme.fontSize.md,
    outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
    boxSizing: 'border-box', transition: 'border-color 0.2s ease',
  },
  inputCheckIcon: {
    position: 'absolute', right: theme.spacing.md, top: '50%', transform: 'translateY(-50%)',
    color: theme.colors.success,
  },
  textareaCheckIcon: {
    position: 'absolute', right: theme.spacing.md, top: theme.spacing.md, color: theme.colors.success,
  },

  confessionHint: {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.sm,
    background: `${theme.colors.confessions}15`,
    border: `1px solid ${theme.colors.confessions}30`,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    lineHeight: 1.5,
    display: 'flex', alignItems: 'center'
  },

  toggleWrapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm },
  toggleButton: {
      padding: theme.spacing.md, 
      borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      background: theme.colors.bgSecondary, color: theme.colors.text, cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, transition: 'all 0.2s ease'
  },
  toggleButtonActive: { borderColor: theme.colors.primary, background: `${theme.colors.primary}15`, color: theme.colors.primary },

  featureBtn: {
      width: '100%',
      padding: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      borderWidth: '2px', borderStyle: 'solid', borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      background: 'transparent',
      color: theme.colors.textSecondary,
      fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium,
      cursor: 'pointer',
      marginBottom: theme.spacing.md,
      transition: 'all 0.2s ease'
  },

  optionsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
  },

  pollEditorWrapper: {
      background: `${theme.colors.bgSecondary}80`, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg, padding: theme.spacing.lg, backdropFilter: 'blur(8px)',
  },

  imagesPreview: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  imagePreviewItem: { position: 'relative', paddingTop: '100%', borderRadius: theme.radius.md, overflow: 'hidden', backgroundColor: theme.colors.bgSecondary },
  previewImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  removeImageButton: {
    position: 'absolute', top: theme.spacing.xs, right: theme.spacing.xs,
    padding: theme.spacing.xs, background: 'rgba(0,0,0,0.7)', border: 'none',
    borderRadius: theme.radius.sm, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: `${theme.colors.bgSecondary}CC`,
    zIndex: 5
  },
  loadingPercent: {
    fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary, marginTop: 4
  },
  addImagePlaceholder: {
    paddingTop: '100%', position: 'relative', border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md, background: theme.colors.bgSecondary,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.textTertiary,
    cursor: 'pointer', transition: 'all 0.2s ease', padding: 0
  },
  addImageButton: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    border: `2px dashed ${theme.colors.border}`, borderRadius: theme.radius.md, background: 'transparent',
    color: theme.colors.textSecondary, cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium,
    transition: 'all 0.2s ease', width: '100%', justifyContent: 'center'
  },

  quickTagsWrapper: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  quickTagBtn: {
    padding: `8px 16px`,
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm,
    color: theme.colors.textSecondary, fontSize: theme.fontSize.sm, cursor: 'pointer', transition: 'all 0.2s ease'
  },
  tagInputWrapper: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.md}px`, background: theme.colors.bgSecondary,
    border: `2px solid ${theme.colors.border}`, borderRadius: theme.radius.md, transition: 'border-color 0.2s ease',
  },
  tagInput: { flex: 1, background: 'transparent', border: 'none', color: theme.colors.text, fontSize: theme.fontSize.md, outline: 'none' },
  addTagButton: { 
      padding: `${theme.spacing.sm}px`, background: theme.colors.bgTertiary, border: 'none', 
      borderRadius: theme.radius.sm, color: theme.colors.textTertiary, cursor: 'pointer', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', opacity: 0.5 
  },
  tagsList: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`, background: `${theme.colors.primary}15`,
    color: theme.colors.primary, borderRadius: theme.radius.sm, fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium, animation: 'tagAppear 0.3s ease',
  },
  tagRemove: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  quickDateButtons: { display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  
  quickDateBtn: {
    flex: 1, 
    padding: `12px 14px`,
    background: theme.colors.bgSecondary, 
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm, 
    color: theme.colors.textSecondary, 
    fontSize: theme.fontSize.sm,
    cursor: 'pointer', 
    transition: 'all 0.2s ease',
  },
  quickDateBtnActive: {
      flex: 1,
      padding: `12px 14px`,
      background: theme.colors.primary,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.colors.primary, 
      borderRadius: theme.radius.sm,
      color: '#fff',
      fontSize: theme.fontSize.sm,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
  },

  errorAlert: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: theme.spacing.md, background: `${theme.colors.error}15`,
    border: `1px solid ${theme.colors.error}`, borderRadius: theme.radius.md,
    color: theme.colors.error, fontSize: theme.fontSize.sm, margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
    animation: 'shake 0.3s ease',
  },
  footer: { padding: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}`, flexShrink: 0 },
  publishButton: {
    width: '100%', padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    borderRadius: theme.radius.md, fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm,
    transition: 'all 0.2s ease',
  },
  spinner: {
    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },

  confirmationOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)', zIndex: Z_MODAL_CREATE_POST,
    display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease',
  },
  confirmationDialog: {
    background: theme.colors.bg, borderRadius: theme.radius.xl,
    padding: theme.spacing.xl, margin: theme.spacing.lg, maxWidth: 340, width: '100%',
  },
  confirmationTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, margin: `0 0 ${theme.spacing.sm}px` },
  confirmationText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, margin: `0 0 ${theme.spacing.lg}px` },
  confirmationButtons: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm },
  confirmationCancel: {
    padding: theme.spacing.md, background: theme.colors.bgSecondary,
    border: `2px solid ${theme.colors.border}`, borderRadius: theme.radius.md,
    color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, cursor: 'pointer', transition: 'all 0.2s ease',
  },
  confirmationConfirm: {
    padding: theme.spacing.md, background: theme.colors.error, border: 'none',
    borderRadius: theme.radius.md, color: '#fff', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, cursor: 'pointer', transition: 'all 0.2s ease',
  },
};

const keyframesStyles = `
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tagAppear { from { opacity: 0; transform: scale(0.8) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

export default CreateContentModal;
