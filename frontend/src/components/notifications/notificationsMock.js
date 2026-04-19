// ===== FILE: frontend/src/components/notifications/notificationsMock.js =====
// Только для dev-режима. Не импортировать в проде.

const now = new Date();
const minsAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();
const daysAgo = (d) => new Date(now - d * 86400 * 1000).toISOString();

const cloneNotifications = (items) => items.map((notif) => ({
  ...notif,
  payload: { ...(notif.payload || {}) },
}));

export const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'market_contact',
    is_read: false,
    created_at: minsAgo(2),
    payload: {
      item_id: 42,
      item_title: 'Конспект по Вышмату',
      item_type: 'service',
      buyer_name: 'Артём',
      buyer_username: 'artem_dev',
      approval_required: true,
      contact_request_id: 1001,
      contact_status: 'pending',
    },
  },
  {
    id: 2,
    type: 'match',
    is_read: false,
    created_at: hoursAgo(1),
    payload: {
      matched_name: 'Вика',
      matched_age: 20,
      matched_username: 'vika_uni',
    },
  },
  {
    id: 3,
    type: 'dating_like',
    is_read: false,
    created_at: hoursAgo(2),
    payload: {},
  },
  {
    id: 4,
    type: 'milestone',
    is_read: true,
    created_at: hoursAgo(3),
    payload: {
      post_id: 77,
      post_title: 'Как я сдал сопромат за ночь',
      milestone: 50,
    },
  },
  {
    id: 5,
    type: 'comment',
    is_read: true,
    created_at: daysAgo(1),
    payload: {
      post_id: 77,
      post_title: 'Как я сдал сопромат за ночь',
      commenter_name: 'Макс',
      comment_text: 'Огонь пост, сам так делал на 3-м курсе',
    },
  },
  {
    id: 6,
    type: 'comment_reply',
    is_read: true,
    created_at: daysAgo(1),
    payload: {
      post_id: 77,
      replier_name: 'Соня',
      comment_text: 'Согл, препод вообще жестит на сессии...',
    },
  },
  {
    id: 7,
    type: 'request_response',
    is_read: true,
    created_at: daysAgo(1),
    payload: {
      request_id: 12,
      request_title: 'Нужен зарядник Type-C на пару',
      responder_name: 'Егор',
      responder_username: 'egor_campus',
    },
  },
  {
    id: 8,
    type: 'market_contact',
    is_read: true,
    created_at: daysAgo(5),
    payload: {
      item_id: 19,
      item_title: 'Свитшот M серый',
      item_type: 'product',
      buyer_name: 'Саша',
      buyer_username: 'sasha_x',
    },
  },
  {
    id: 9,
    type: 'milestone',
    is_read: true,
    created_at: daysAgo(6),
    payload: {
      post_id: 55,
      post_title: 'Топ мест для учёбы в кампусе',
      milestone: 100,
    },
  },
];

let mockNotificationsState = cloneNotifications(MOCK_NOTIFICATIONS);

export function getDevMockNotifications() {
  return cloneNotifications(mockNotificationsState);
}

export function getDevMockUnreadNotificationsCount() {
  const count = mockNotificationsState.reduce((acc, notif) => {
    return acc + (notif.is_read ? 0 : 1);
  }, 0);

  return { count };
}

export function markAllDevMockNotificationsRead() {
  mockNotificationsState = mockNotificationsState.map((notif) => (
    notif.is_read ? notif : { ...notif, is_read: true }
  ));

  return { success: true };
}

export function decideDevMockContactRequest(contactRequestId, decision) {
  const normalizedId = Number(contactRequestId);
  let sourcePayload = null;

  mockNotificationsState = mockNotificationsState.map((notif) => {
    if (Number(notif.payload?.contact_request_id) !== normalizedId) {
      return notif;
    }

    sourcePayload = notif.payload;
    return {
      ...notif,
      is_read: true,
      payload: {
        ...notif.payload,
        contact_status: decision,
        decided_at: new Date().toISOString(),
      },
    };
  });

  if (sourcePayload) {
    mockNotificationsState = [
      {
        id: Date.now(),
        type: 'contact_request_decision',
        is_read: false,
        created_at: new Date().toISOString(),
        payload: {
          contact_request_id: normalizedId,
          source_type: 'market_item',
          source_id: sourcePayload.item_id,
          source_title: sourcePayload.item_title || '',
          source_item_type: sourcePayload.item_type || 'product',
          contact_status: decision,
          decision,
          owner_name: 'Демо-пользователь',
          owner_username: decision === 'accepted' ? 'campus_demo' : null,
        },
      },
      ...mockNotificationsState,
    ];
  }

  return {
    id: normalizedId,
    status: decision,
    source_type: 'market_item',
    source_id: sourcePayload?.item_id,
    owner_contact: decision === 'accepted' ? 'campus_demo' : null,
    requester_contact: sourcePayload?.buyer_username || null,
    decided_at: new Date().toISOString(),
  };
}

export function resetDevMockNotifications() {
  mockNotificationsState = cloneNotifications(MOCK_NOTIFICATIONS);
}
