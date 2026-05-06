const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getMoscowWeekBounds() {
  const now = new Date();
  const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const day = moscowNow.getDay() || 7;
  const weekStartMoscow = new Date(moscowNow.getTime() - (day - 1) * MS_PER_DAY);
  weekStartMoscow.setHours(0, 0, 0, 0);

  const weekEndMoscow = new Date(weekStartMoscow.getTime() + 7 * MS_PER_DAY);

  return {
    period_start: weekStartMoscow.toISOString(),
    period_end: weekEndMoscow.toISOString(),
  };
}

const peopleLeaderboard = [
  { rank: 1, user_id: 101, name: 'Илья', avatar: null, referrals_count: 18, is_me: true },
  { rank: 2, user_id: 102, name: 'Саша', avatar: null, referrals_count: 15, is_me: false },
  { rank: 3, user_id: 103, name: 'Алина', avatar: null, referrals_count: 12, is_me: false },
  { rank: 4, user_id: 104, name: 'Марк', avatar: null, referrals_count: 9, is_me: false },
  { rank: 5, user_id: 105, name: 'Вика', avatar: null, referrals_count: 7, is_me: false },
  { rank: 6, user_id: 106, name: 'Даня', avatar: null, referrals_count: 5, is_me: false },
];

const universityLeaderboard = [
  {
    rank: 1,
    key: 'campus:ruk',
    label: 'РУК',
    referrals_count: 84,
    is_my_group: true,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 2,
    key: 'campus:msu',
    label: 'МГУ',
    referrals_count: 72,
    is_my_group: false,
    campus_id: 'msu',
    university: 'МГУ',
    city: 'Москва',
  },
  {
    rank: 3,
    key: 'campus:hse',
    label: 'ВШЭ',
    referrals_count: 61,
    is_my_group: false,
    campus_id: 'hse',
    university: 'ВШЭ',
    city: 'Москва',
  },
  {
    rank: 4,
    key: 'campus:spbu',
    label: 'СПбГУ',
    referrals_count: 56,
    is_my_group: false,
    campus_id: 'spbu',
    university: 'СПбГУ',
    city: 'Санкт-Петербург',
  },
  {
    rank: 5,
    key: 'campus:ranepa',
    label: 'РАНХиГС',
    referrals_count: 43,
    is_my_group: false,
    campus_id: 'ranepa',
    university: 'РАНХиГС',
    city: 'Москва',
  },
  {
    rank: 6,
    key: 'campus:mirea',
    label: 'МИРЭА',
    referrals_count: 31,
    is_my_group: false,
    campus_id: 'mirea',
    university: 'МИРЭА',
    city: 'Москва',
  },
];

const instituteLeaderboard = [
  {
    rank: 1,
    key: 'institute:iir',
    label: 'ИиР',
    referrals_count: 84,
    is_my_group: true,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 2,
    key: 'institute:ef',
    label: 'Экфак',
    referrals_count: 72,
    is_my_group: false,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 3,
    key: 'institute:ggf',
    label: 'ГГФ',
    referrals_count: 61,
    is_my_group: false,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 4,
    key: 'institute:east',
    label: 'Восточка',
    referrals_count: 56,
    is_my_group: false,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 5,
    key: 'institute:fit',
    label: 'ФИТ',
    referrals_count: 43,
    is_my_group: false,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
  {
    rank: 6,
    key: 'institute:none',
    label: 'Без факультета',
    referrals_count: 18,
    is_my_group: false,
    campus_id: 'ruk',
    university: 'РУК',
    city: 'Москва',
  },
];

export function getDevMockReferralSummary() {
  return {
    ...getMoscowWeekBounds(),
    referral_code: 'DevRef2026',
    invite_url: null,
    my_count: 18,
    my_rank: 1,
    leaderboard: peopleLeaderboard,
    people_leaderboard: peopleLeaderboard,
    university_leaderboard: universityLeaderboard,
    institute_leaderboard: instituteLeaderboard,
    institute_scope: {
      key: 'campus:ruk',
      label: 'РУК',
      campus_id: 'ruk',
      university: 'РУК',
      city: 'Москва',
    },
  };
}
