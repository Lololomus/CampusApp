export const getDatingPhotoList = (profile) => {
  if (!Array.isArray(profile?.photos)) return [];

  return profile.photos
    .map((photo) => {
      if (!photo) return null;
      if (typeof photo === 'string') return photo;
      if (typeof photo?.url === 'string' && photo.url.trim()) return photo.url;
      return null;
    })
    .filter(Boolean);
};

export const getPrimaryDatingPhoto = (profile) => getDatingPhotoList(profile)[0] || null;
