export const CONTENT_REPORT_REASONS = [
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'scam', label: 'Скам', icon: '🎣' },
  { value: 'inappropriate', label: 'Неприемлемо', icon: '⚠️' },
  { value: 'fake', label: 'Фейк', icon: '🎭' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export const PEOPLE_REPORT_REASONS = [
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'scam', label: 'Скам', icon: '🎣' },
  { value: 'fake_account', label: 'Фейк-аккаунт', icon: '🎭' },
  { value: 'inappropriate', label: 'Неприемлемо', icon: '⚠️' },
  { value: 'threat', label: 'Угроза', icon: '🛑' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export const AD_REPORT_REASONS = [
  { value: 'misleading', label: 'Обман', icon: '🤥' },
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'scam', label: 'Скам', icon: '🎣' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export const REPORT_REASONS_BY_TARGET = {
  post: CONTENT_REPORT_REASONS,
  comment: CONTENT_REPORT_REASONS,
  request: CONTENT_REPORT_REASONS,
  market_item: CONTENT_REPORT_REASONS,
  dating_profile: PEOPLE_REPORT_REASONS,
  user: PEOPLE_REPORT_REASONS,
  ad: AD_REPORT_REASONS,
};

export const REPORT_TARGET_LABELS = {
  post: 'пост',
  comment: 'комментарий',
  request: 'запрос',
  market_item: 'товар',
  dating_profile: 'профиль',
  user: 'пользователя',
  ad: 'рекламу',
};

export function getReportReasons(targetType) {
  return REPORT_REASONS_BY_TARGET[targetType] || CONTENT_REPORT_REASONS;
}
