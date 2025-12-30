// ===== 📄 ФАЙЛ: src/utils/media.js =====

import imageCompression from 'browser-image-compression';

// Конфигурация сжатия (Единый стандарт для всего приложения)
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,          // Макс вес: 1МБ
  maxWidthOrHeight: 1280, // Макс разрешение: 1280px (хватит для мобилок)
  useWebWorker: true,    // Использовать поток, чтобы не зависал интерфейс
  fileType: 'image/jpeg' // Конвертировать всё в JPEG (лучше совместимость)
};

/**
 * Сжимает изображение
 * @param {File} file - Исходный файл
 * @returns {Promise<File>} - Сжатый файл или оригинал (при ошибке)
 */
export const compressImage = async (file) => {
  // 1. Проверка типа (Security)
  if (!file.type.startsWith('image/')) {
    throw new Error('Файл не является изображением');
  }

  // 2. Если файл меньше 1МБ, можно не сжимать (опционально, но лучше прогнать для стандартизации)
  // if (file.size / 1024 / 1024 < 1) return file;

  try {
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
    return compressedFile;
  } catch (error) {
    console.error("⚠️ Ошибка сжатия (используем оригинал):", error);
    return file;
  }
};

/**
 * Обрабатывает массив файлов: сжимает и создает превью
 * @param {FileList|Array} files - Файлы из input
 * @returns {Promise<Array<{file: File, preview: string}>>}
 */
export const processImageFiles = async (files) => {
  const fileArray = Array.from(files);
  const results = [];

  for (const file of fileArray) {
    try {
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);
      
      results.push({
        file: compressed,
        preview: preview
      });
    } catch (err) {
      console.warn("Skipping invalid file:", file.name);
    }
  }

  return results;
};