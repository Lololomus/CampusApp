export const CONTENT_REPORT_REASONS = [
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'abuse', label: 'Оскорбления', icon: '🤬' },
  { value: 'inappropriate', label: 'Неприемл. контент', icon: '⚠️' },
  { value: 'scam', label: 'Мошенничество', icon: '🎣' },
  { value: 'nsfw', label: 'NSFW', icon: '🔞' },
  { value: 'harassment', label: 'Травля/хейт', icon: '😡' },
  { value: 'misinformation', label: 'Ложная инф-а', icon: '🤥' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export const USER_REPORT_REASONS = [
  { value: 'spam_scam', label: 'Спам/скам', icon: '📨' },
  { value: 'impersonation', label: 'Фейк/выдача себя', icon: '🎭' },
  { value: 'harassment_hate', label: 'Травля/хейт', icon: '😡' },
  { value: 'sexual_content', label: 'Сексуальный контент', icon: '🔞' },
  { value: 'underage_risk', label: 'Риск с несоверш.', icon: '🛑' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export const REPORT_REASONS_BY_TARGET = {
  post: CONTENT_REPORT_REASONS,
  comment: CONTENT_REPORT_REASONS,
  request: CONTENT_REPORT_REASONS,
  market_item: CONTENT_REPORT_REASONS,
  dating_profile: CONTENT_REPORT_REASONS,
  user: USER_REPORT_REASONS,
};

export const REPORT_TARGET_LABELS = {
  post: 'пост',
  comment: 'комментарий',
  request: 'запрос',
  market_item: 'товар',
  dating_profile: 'профиль',
  user: 'пользователя',
};

export function getReportReasons(targetType) {
  return REPORT_REASONS_BY_TARGET[targetType] || CONTENT_REPORT_REASONS;
}
