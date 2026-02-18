const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDiff(baseDate, targetDate) {
  const baseStart = getDayStart(baseDate).getTime();
  const targetStart = getDayStart(targetDate).getTime();
  return Math.floor((baseStart - targetStart) / DAY_MS);
}

function formatSectionLabel(date, now = new Date(), locale = 'ru-RU') {
  const diff = getDayDiff(now, date);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
    });
  }

  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getSectionKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildFeedSections(items, getDateValue, options = {}) {
  const {
    locale = 'ru-RU',
    now = new Date(),
    unknownLabel = 'Без даты',
    getItemKey,
  } = options;

  const result = [];
  let lastSectionKey = null;

  items.forEach((item, index) => {
    const rawDate = getDateValue(item, index, items);
    const parsedDate = parseDate(rawDate);
    const sectionKey = parsedDate ? getSectionKey(parsedDate) : 'unknown';
    const sectionLabel = parsedDate
      ? formatSectionLabel(parsedDate, now, locale)
      : unknownLabel;

    if (sectionKey !== lastSectionKey) {
      result.push({
        type: 'divider',
        key: `divider-${sectionKey}-${index}`,
        sectionKey,
        label: sectionLabel,
      });
      lastSectionKey = sectionKey;
    }

    result.push({
      type: 'item',
      key: getItemKey ? getItemKey(item, index) : `item-${index}`,
      item,
      index,
      sectionKey,
    });
  });

  return result;
}

