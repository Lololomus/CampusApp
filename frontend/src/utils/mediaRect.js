export const captureSourceRect = (element, options = {}) => {
  const rect = element?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return null;

  const {
    objectFit = 'cover',
    objectPosition = 'center center',
    borderRadius,
    fallbackBorderRadius = 0,
    hasContainFill,
    zIndex,
    readBorderRadius = true,
  } = options;

  let resolvedBorderRadius = borderRadius;
  if (resolvedBorderRadius === undefined && readBorderRadius && typeof window !== 'undefined') {
    const parsed = Number.parseFloat(window.getComputedStyle(element).borderRadius);
    if (Number.isFinite(parsed)) resolvedBorderRadius = parsed;
  }
  if (resolvedBorderRadius === undefined) {
    resolvedBorderRadius = fallbackBorderRadius;
  }

  const sourceRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    objectFit,
    objectPosition,
    borderRadius: resolvedBorderRadius,
  };

  if (hasContainFill !== undefined) sourceRect.hasContainFill = Boolean(hasContainFill);
  if (Number.isFinite(zIndex)) sourceRect.zIndex = zIndex;

  return sourceRect;
};
