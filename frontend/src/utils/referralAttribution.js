const REFERRAL_CODE_STORAGE_KEY = 'campus:referral-code';
const REFERRAL_CODE_RE = /^[A-Za-z0-9]{6,32}$/;

export function normalizeReferralCode(value) {
  const code = String(value || '').trim();
  return REFERRAL_CODE_RE.test(code) ? code : '';
}

export function parseReferralStartParam(startParam) {
  const normalized = String(startParam || '').trim();
  const match = normalized.match(/^ref_([A-Za-z0-9]{6,32})$/);
  return match ? match[1] : '';
}

export function getStoredReferralCode() {
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function storeReferralCode(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || getStoredReferralCode()) return false;

  try {
    window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredReferralCode() {
  try {
    window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in restricted webviews.
  }
}
