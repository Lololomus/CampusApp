// ===== 📄 ФАЙЛ: src/utils/media.js =====

import imageCompression from 'browser-image-compression';

// ===== КОНФИГУРАЦИЯ =====

const MAX_FILE_SIZE_MB = 10; // Макс размер ДО сжатия: 10MB

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.8, // ✅ Помогает удалить EXIF
  alwaysKeepResolution: false,
};

// Белый список расширений
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Проверка валидности файла
 */
const validateImageFile = (file) => {
  // 1. Проверка типа MIME
  if (!file.type.startsWith('image/')) {
    throw new Error('Файл не является изображением');
  }

  // 2. Проверка расширения (защита от .php.jpg)
  const extension = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(`Недопустимый формат: .${extension}`);
  }

  // 3. Проверка размера ДО сжатия
  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Файл слишком большой: ${fileSizeMB.toFixed(1)}MB (макс ${MAX_FILE_SIZE_MB}MB)`);
  }

  return true;
};

/**
 * Очистка EXIF метаданных (дополнительная защита)
 * browser-image-compression уже удаляет EXIF с initialQuality < 1
 */
const stripExifData = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          const cleanFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(cleanFile);
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// ===== ОСНОВНЫЕ ФУНКЦИИ =====

/**
 * Сжимает изображение с валидацией и очисткой EXIF
 * @param {File} file - Исходный файл
 * @returns {Promise<File>} - Сжатый файл
 */
export const compressImage = async (file) => {
  // 1. Валидация
  validateImageFile(file);

  try {
    // 2. Сжатие (библиотека удаляет EXIF благодаря initialQuality)
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    
    // 3. Дополнительная очистка EXIF через Canvas (paranoid mode)
    const cleaned = await stripExifData(compressed);
    
    return cleaned;
    
  } catch (error) {
    console.error('❌ Ошибка сжатия:', error);
    throw error; // НЕ возвращаем оригинал при ошибке
  }
};

/**
 * Обрабатывает массив файлов: валидация + сжатие + превью
 * @param {FileList|Array} files - Файлы из input
 * @returns {Promise<Array<{file: File, preview: string, width: number, height: number}>>}
 */
export const processImageFiles = async (files) => {
  const fileArray = Array.from(files);
  const results = [];

  for (const file of fileArray) {
    try {
      // 1. Сжатие с валидацией
      const compressed = await compressImage(file);
      
      // 2. Создание превью
      const preview = URL.createObjectURL(compressed);
      
      // 3. Получение размеров (для backend metadata)
      const dimensions = await getImageDimensions(preview);
      
      results.push({
        file: compressed,
        preview: preview,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Пропускаем файл:', file.name, err.message);
      // Можно добавить alert для пользователя
      alert(`Не удалось обработать ${file.name}: ${err.message}`);
    }
  }

  return results;
};

/**
 * Получить размеры изображения
 */
const getImageDimensions = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      img.src = ''; // Очистка
    };
    img.src = url;
  });
};

/**
 * Очистка URL.createObjectURL (вызывать при размонтировании компонента)
 * @param {Array<string>} urls - Массив URL для очистки
 */
export const revokeObjectURLs = (urls) => {
  urls.forEach(url => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
};