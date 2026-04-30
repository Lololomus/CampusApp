// ===== FILE: frontend/src/components/media/MediaGrid.js =====
import React, { useState, useCallback, useMemo } from 'react';
import theme from '../../theme';
import { IMAGE_ASPECT_RATIO_MIN } from '../../constants/layoutConstants';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { captureSourceRect } from '../../utils/mediaRect';

function getItemThumbnailUrl(item) {
  if (!item) return '';
  if (typeof item === 'object' && item.type === 'video') {
    return item.thumbnail_url ? resolveImageUrl(item.thumbnail_url, 'thumbs') : '';
  }
  if (typeof item === 'object' && item.thumbnail_url) {
    return resolveImageUrl(item.thumbnail_url, 'thumbs');
  }
  const filename = (typeof item === 'object') ? item.url : item;
  return resolveImageUrl(filename, 'images');
}

const SINGLE_MEDIA_MAX_HEIGHT = 'min(640px, 78vh)';
const LOW_TRUST_SQUARE_SIZES = new Set([800, 1000]);
const MULTI_SIDE_CROP_CONTAIN_THRESHOLD = 0.12;
const MULTI_VERTICAL_CROP_CONTAIN_THRESHOLD = 0.42;
const CONTAIN_BACKGROUND_OPACITY = 0.42;

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function getItemIdentity(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  const mediaUrl = item.type === 'video'
    ? `${item.url || ''}:${item.thumbnail_url || ''}`
    : item.url || '';
  return [
    item.type || 'image',
    mediaUrl,
    item.w || '',
    item.h || '',
    item.thumbnail_w || '',
    item.thumbnail_h || '',
  ].join(':');
}

function isLowTrustDimensionPair(w, h) {
  return w === h && LOW_TRUST_SQUARE_SIZES.has(w);
}

function getAspectRatioCandidate(rawW, rawH) {
  const w = toPositiveNumber(rawW);
  const h = toPositiveNumber(rawH);
  if (!w || !h) return null;
  return {
    ar: w / h,
    lowTrust: isLowTrustDimensionPair(w, h),
  };
}

function getMetadataAspectRatioCandidates(item) {
  if (!item || typeof item !== 'object') return [];
  const candidates = item.type === 'video'
    ? [
        [item.thumbnail_w, item.thumbnail_h],
        [item.w, item.h],
      ]
    : [[item.w, item.h]];

  return candidates
    .map(([rawW, rawH]) => getAspectRatioCandidate(rawW, rawH))
    .filter(Boolean);
}

function getTrustedMediaAspectRatio(item) {
  return getMetadataAspectRatioCandidates(item).find((candidate) => !candidate.lowTrust)?.ar || null;
}

function getLowTrustMediaAspectRatio(item) {
  return getMetadataAspectRatioCandidates(item).find((candidate) => candidate.lowTrust)?.ar || null;
}

function getEffectiveMediaAspectRatio(item, measuredAr) {
  return toPositiveNumber(measuredAr) || getTrustedMediaAspectRatio(item);
}

function getInitialLayoutAr(item) {
  const ar = getTrustedMediaAspectRatio(item) || getLowTrustMediaAspectRatio(item);
  if (ar) return ar;
  if (item?.type === 'video') return 16 / 9;
  return 3 / 4;
}

function getSingleDisplayAr(item, measuredAr) {
  const ar = getEffectiveMediaAspectRatio(item, measuredAr);
  if (ar) return ar;
  return item?.type === 'video' ? 1 : 3 / 4;
}

function shouldContainSingleMedia(item, measuredAr) {
  const ar = getEffectiveMediaAspectRatio(item, measuredAr);
  if (item?.type === 'video') return !ar || ar < 1;
  return !ar || ar < IMAGE_ASPECT_RATIO_MIN;
}

function getSingleMediaFit(item, measuredAr) {
  return shouldContainSingleMedia(item, measuredAr) ? 'contain' : 'cover';
}

function getCoverCropFractions(mediaAr, cellAr) {
  const media = toPositiveNumber(mediaAr);
  const cell = toPositiveNumber(cellAr);
  if (!media || !cell) return { sideCrop: 0, verticalCrop: 0 };

  if (media > cell) {
    return { sideCrop: 1 - (cell / media), verticalCrop: 0 };
  }

  if (media < cell) {
    return { sideCrop: 0, verticalCrop: 1 - (media / cell) };
  }

  return { sideCrop: 0, verticalCrop: 0 };
}

function getMultiMediaFit(item, measuredAr, cellAr) {
  const ar = getEffectiveMediaAspectRatio(item, measuredAr);
  if (!ar) return 'cover';

  const { sideCrop, verticalCrop } = getCoverCropFractions(ar, cellAr);
  return (
    sideCrop >= MULTI_SIDE_CROP_CONTAIN_THRESHOLD
    || verticalCrop >= MULTI_VERTICAL_CROP_CONTAIN_THRESHOLD
  ) ? 'contain' : 'cover';
}

function getSourceRect(target, objectFit = 'cover') {
  return captureSourceRect(target, {
    objectFit,
    hasContainFill: objectFit === 'contain',
  });
}

const shimmerStyle = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(110deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.04) 65%)',
  backgroundSize: '200% 100%',
  animation: 'mediaGridShimmer 1.25s linear infinite',
  zIndex: 1,
};

const fallbackStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.colors.premium.textMuted,
  fontSize: 13,
  fontWeight: 600,
  background: theme.colors.surfaceElevated,
  zIndex: 1,
};

const playIconStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: theme.colors.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
  pointerEvents: 'none',
};

const overflowStyle = {
  position: 'absolute',
  inset: 0,
  background: theme.colors.overlayDark,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3,
};

const GRID_GAP = 2;
const MULTI_MOSAIC_ASPECT_MIN = 0.75;
const MULTI_MOSAIC_ASPECT_MAX = 3.6;

function clampLayoutAr(value) {
  const ar = toPositiveNumber(value) || 1;
  return Math.max(0.35, Math.min(ar, 4));
}

function rowAspect(indices, ars) {
  return indices.reduce((sum, index) => sum + clampLayoutAr(ars[index]), 0);
}

function heightWeightForAspect(aspectRatio) {
  return Math.max(0.62, Math.min(1 / clampLayoutAr(aspectRatio), 1.5));
}

function stackAspect(indices, ars) {
  const inverseAspectSum = indices.reduce((sum, index) => sum + heightWeightForAspect(ars[index]), 0);
  return inverseAspectSum > 0 ? 1 / inverseAspectSum : 1;
}

function columnAspect(topAspect, bottomAspect) {
  const inverseAspectSum = heightWeightForAspect(topAspect) + heightWeightForAspect(bottomAspect);
  return inverseAspectSum > 0 ? 1 / inverseAspectSum : 1;
}

function columnChildAspect(aspectRatio) {
  return 1 / heightWeightForAspect(aspectRatio);
}

function rowChildAspect(rowActualAspect, childWeight, rowWeightSum) {
  const rowAr = toPositiveNumber(rowActualAspect) || 1;
  const weight = Math.max(0.001, childWeight || 1);
  const sum = Math.max(0.001, rowWeightSum || weight);
  return rowAr * (weight / sum);
}

function clampMosaicAspect(value) {
  const ar = toPositiveNumber(value) || 1;
  return Math.max(MULTI_MOSAIC_ASPECT_MIN, Math.min(ar, MULTI_MOSAIC_ASPECT_MAX));
}

function mosaicPaddingTop(aspectRatio) {
  return `${100 / clampMosaicAspect(aspectRatio)}%`;
}

function MosaicFrame({ aspectRatio, style, children }) {
  return (
    <div style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'block', width: '100%', paddingTop: mosaicPaddingTop(aspectRatio) }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          minWidth: 0,
          minHeight: 0,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FlexCell({ weight, children }) {
  const flexWeight = Math.max(0.001, weight || 1);
  return (
    <div
      style={{
        flexGrow: flexWeight,
        flexShrink: 1,
        flexBasis: 0,
        display: 'flex',
        alignSelf: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

// РЇС‡РµР№РєР° РјРµРґРёР° вЂ” РІСЃРµРіРґР° 100% СЂРѕРґРёС‚РµР»СЏ РїРѕ СЂР°Р·РјРµСЂСѓ
function readNaturalAspectRatio(img) {
  const w = toPositiveNumber(img?.naturalWidth);
  const h = toPositiveNumber(img?.naturalHeight);
  return w && h ? w / h : null;
}

function ContainFillBackground({ hidden }) {
  if (hidden) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 42%, rgba(255,255,255,${CONTAIN_BACKGROUND_OPACITY * 0.12}) 0%, transparent 58%), #000`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

const MediaCell = React.memo(function MediaCell({ item, index, total, maxVisible, cellAspect, measuredAr, onItemClick, onNaturalAspectRatio, isHidden, spanStyle }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = getItemThumbnailUrl(item);
  const isVideo = typeof item === 'object' && item?.type === 'video';
  const isOverflowCell = index === maxVisible - 1 && total > maxVisible;
  const overflowCount = total - maxVisible + 1;
  const mediaFit = getMultiMediaFit(item, measuredAr, cellAspect);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onItemClick(index, getSourceRect(e.currentTarget, mediaFit));
  }, [index, mediaFit, onItemClick]);

  return (
    <div
      data-media-grid-index={index}
      data-media-fit={mediaFit}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        width: '100%',
        height: '100%',
        backgroundColor: mediaFit === 'contain' ? '#000' : theme.colors.surfaceElevated,
        ...spanStyle,
      }}
      onClick={handleClick}
    >
      {mediaFit === 'contain' && !failed && (
        <ContainFillBackground hidden={isHidden} />
      )}
      {!isHidden && !loaded && !failed && <div style={shimmerStyle} />}
      {!isHidden && failed && <div style={fallbackStyle}>Р¤РѕС‚Рѕ РЅРµРґРѕСЃС‚СѓРїРЅРѕ</div>}
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: mediaFit,
            objectPosition: 'center center',
            position: 'relative',
            zIndex: 2,
            display: 'block',
            opacity: loaded && !failed ? 1 : 0,
            visibility: isHidden ? 'hidden' : 'visible',
            transition: 'opacity 0.2s ease',
          }}
          onLoad={(e) => {
            setLoaded(true);
            const ar = readNaturalAspectRatio(e.currentTarget);
            if (ar) onNaturalAspectRatio?.(index, ar);
          }}
          onError={() => setFailed(true)}
        />
      )}
      {!isHidden && isVideo && !failed && (
        <div style={playIconStyle}>
          <svg width={18} height={18} viewBox="0 0 18 18" fill="white">
            <polygon points="5,2 16,9 5,16" />
          </svg>
        </div>
      )}
      {!isHidden && isOverflowCell && (
        <div style={overflowStyle}>
          <span style={{ color: theme.colors.text, fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>
            +{overflowCount}
          </span>
        </div>
      )}
    </div>
  );
});

const MediaGrid = React.memo(function MediaGrid({ mediaItems, onItemClick, maxVisible = 4, containerStyle, hiddenIndex = null }) {
  const total = mediaItems.length;
  const count = Math.min(total, maxVisible);
  const visibleItems = mediaItems.slice(0, maxVisible);
  const mediaKey = useMemo(() => visibleItems.map(getItemIdentity).join('|'), [visibleItems]);
  const [naturalAspectState, setNaturalAspectState] = useState({ key: '', values: {} });
  const naturalAspectRatios = naturalAspectState.key === mediaKey ? naturalAspectState.values : {};

  const handleNaturalAspectRatio = useCallback((index, ar) => {
    setNaturalAspectState((prev) => {
      const values = prev.key === mediaKey ? prev.values : {};
      if (Math.abs((values[index] || 0) - ar) < 0.001) return prev;
      return { key: mediaKey, values: { ...values, [index]: ar } };
    });
  }, [mediaKey]);

  const wrapStyle = {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.premium.border}`,
    ...containerStyle,
  };

  const cellProps = (index) => ({
    item: visibleItems[index],
    index,
    total,
    maxVisible,
    measuredAr: naturalAspectRatios[index],
    onItemClick,
    onNaturalAspectRatio: handleNaturalAspectRatio,
    isHidden: hiddenIndex === index,
  });

  if (count === 0) return null;

  // 1 СЌР»РµРјРµРЅС‚ вЂ” РЅР°С‚СѓСЂР°Р»СЊРЅР°СЏ РІС‹СЃРѕС‚Р°
  if (count === 1) {
    const item = visibleItems[0];
    const measuredAr = naturalAspectRatios[0];
    const knownAr = getEffectiveMediaAspectRatio(item, measuredAr);
    const mediaFit = getSingleMediaFit(item, measuredAr);
    return (
      <div style={wrapStyle}>
        <style>{`@keyframes mediaGridShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div
          data-media-grid-index={0}
          data-media-fit={mediaFit}
          style={{
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: mediaFit === 'contain' ? '#000' : theme.colors.surfaceElevated,
            minHeight: knownAr ? undefined : 200,
            maxHeight: SINGLE_MEDIA_MAX_HEIGHT,
            aspectRatio: `${getSingleDisplayAr(item, measuredAr)}`,
          }}
          onClick={(e) => { e.stopPropagation(); onItemClick(0, getSourceRect(e.currentTarget, mediaFit)); }}
        >
          <SingleCell
            item={item}
            total={total}
            maxVisible={maxVisible}
            measuredAr={measuredAr}
            onNaturalAspectRatio={handleNaturalAspectRatio}
            isHidden={hiddenIndex === 0}
          />
        </div>
      </div>
    );
  }

  const ars = visibleItems.map(getInitialLayoutAr);

  // 2 СЌР»РµРјРµРЅС‚Р° вЂ” СѓРјРЅС‹Рµ РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅС‹Рµ РєРѕР»РѕРЅРєРё, РЅРѕ РІСЃРµРіРґР° РЅР° РІСЃСЋ С€РёСЂРёРЅСѓ.
  if (count === 2) {
    const layoutAr = rowAspect([0, 1], ars);
    return (
      <div style={wrapStyle}>
        <style>{`@keyframes mediaGridShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <MosaicFrame aspectRatio={layoutAr} style={{ display: 'flex', alignItems: 'stretch', gap: GRID_GAP }}>
          <FlexCell weight={clampLayoutAr(ars[0])}>
            <MediaCell {...cellProps(0)} cellAspect={clampLayoutAr(ars[0])} />
          </FlexCell>
          <FlexCell weight={clampLayoutAr(ars[1])}>
            <MediaCell {...cellProps(1)} cellAspect={clampLayoutAr(ars[1])} />
          </FlexCell>
        </MosaicFrame>
      </div>
    );
  }

  // 3 elements.
  if (count === 3) {
    const STYLE = `@keyframes mediaGridShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
    const firstAr = clampLayoutAr(ars[0]);

    if (firstAr < 1.0) {
      // Preserve order: item 0 stays left, items 1 and 2 stack on the right.
      const leftAr = clampLayoutAr(ars[0]);
      const rightAr = stackAspect([1, 2], ars);
      const layoutAr = leftAr + rightAr;
      return (
        <div style={wrapStyle}>
          <style>{STYLE}</style>
          <MosaicFrame aspectRatio={layoutAr} style={{ display: 'flex', alignItems: 'stretch', gap: GRID_GAP }}>
            <FlexCell weight={leftAr}>
              <MediaCell {...cellProps(0)} cellAspect={leftAr} />
            </FlexCell>
            <FlexCell weight={rightAr}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: GRID_GAP, width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
                <FlexCell weight={heightWeightForAspect(ars[1])}>
                  <MediaCell {...cellProps(1)} cellAspect={columnChildAspect(ars[1])} />
                </FlexCell>
                <FlexCell weight={heightWeightForAspect(ars[2])}>
                  <MediaCell {...cellProps(2)} cellAspect={columnChildAspect(ars[2])} />
                </FlexCell>
              </div>
            </FlexCell>
          </MosaicFrame>
        </div>
      );
    }

    // Preserve order: item 0 stays on top, items 1 and 2 stay below left-to-right.
    const topAr = clampLayoutAr(ars[0]);
    const bottomAr = rowAspect([1, 2], ars);
    const layoutAr = columnAspect(topAr, bottomAr);
    return (
      <div style={wrapStyle}>
        <style>{STYLE}</style>
        <MosaicFrame aspectRatio={layoutAr} style={{ display: 'flex', flexDirection: 'column', gap: GRID_GAP }}>
          <FlexCell weight={heightWeightForAspect(topAr)}>
            <MediaCell {...cellProps(0)} cellAspect={columnChildAspect(topAr)} />
          </FlexCell>
          <FlexCell weight={heightWeightForAspect(bottomAr)}>
            <div style={{ display: 'flex', gap: GRID_GAP, width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
              <FlexCell weight={clampLayoutAr(ars[1])}>
                <MediaCell
                  {...cellProps(1)}
                  cellAspect={rowChildAspect(columnChildAspect(bottomAr), clampLayoutAr(ars[1]), bottomAr)}
                />
              </FlexCell>
              <FlexCell weight={clampLayoutAr(ars[2])}>
                <MediaCell
                  {...cellProps(2)}
                  cellAspect={rowChildAspect(columnChildAspect(bottomAr), clampLayoutAr(ars[2]), bottomAr)}
                />
              </FlexCell>
            </div>
          </FlexCell>
        </MosaicFrame>
      </div>
    );
  }

  // 4 elements: two adaptive rows, preserving item order.
  const topRowAr = rowAspect([0, 1], ars);
  const bottomRowAr = rowAspect([2, 3], ars);
  const layoutAr = columnAspect(topRowAr, bottomRowAr);
  const topRowActualAr = columnChildAspect(topRowAr);
  const bottomRowActualAr = columnChildAspect(bottomRowAr);
  return (
    <div style={wrapStyle}>
      <style>{`@keyframes mediaGridShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <MosaicFrame aspectRatio={layoutAr} style={{ display: 'flex', flexDirection: 'column', gap: GRID_GAP }}>
        <FlexCell weight={heightWeightForAspect(topRowAr)}>
          <div style={{ display: 'flex', gap: GRID_GAP, width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
            <FlexCell weight={clampLayoutAr(ars[0])}>
              <MediaCell
                {...cellProps(0)}
                cellAspect={rowChildAspect(topRowActualAr, clampLayoutAr(ars[0]), topRowAr)}
              />
            </FlexCell>
            <FlexCell weight={clampLayoutAr(ars[1])}>
              <MediaCell
                {...cellProps(1)}
                cellAspect={rowChildAspect(topRowActualAr, clampLayoutAr(ars[1]), topRowAr)}
              />
            </FlexCell>
          </div>
        </FlexCell>
        <FlexCell weight={heightWeightForAspect(bottomRowAr)}>
          <div style={{ display: 'flex', gap: GRID_GAP, width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
            <FlexCell weight={clampLayoutAr(ars[2])}>
              <MediaCell
                {...cellProps(2)}
                cellAspect={rowChildAspect(bottomRowActualAr, clampLayoutAr(ars[2]), bottomRowAr)}
              />
            </FlexCell>
            <FlexCell weight={clampLayoutAr(ars[3])}>
              <MediaCell
                {...cellProps(3)}
                cellAspect={rowChildAspect(bottomRowActualAr, clampLayoutAr(ars[3]), bottomRowAr)}
              />
            </FlexCell>
          </div>
        </FlexCell>
      </MosaicFrame>
    </div>
  );
});

// РћС‚РґРµР»СЊРЅС‹Р№ СЂРµРЅРґРµСЂ РґР»СЏ 1 СЌР»РµРјРµРЅС‚Р° (РЅР°С‚СѓСЂР°Р»СЊРЅР°СЏ РІС‹СЃРѕС‚Р° + skeleton/fallback)
function SingleCell({ item, total, maxVisible, measuredAr, onNaturalAspectRatio, isHidden }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = getItemThumbnailUrl(item);
  const isVideo = typeof item === 'object' && item?.type === 'video';
  const isOverflowCell = 0 === maxVisible - 1 && total > maxVisible;
  const overflowCount = total - maxVisible + 1;
  const mediaFit = getSingleMediaFit(item, measuredAr);

  return (
    <>
      {mediaFit === 'contain' && !failed && (
        <ContainFillBackground hidden={isHidden} />
      )}
      {!isHidden && !loaded && !failed && <div style={shimmerStyle} />}
      {!isHidden && failed && <div style={fallbackStyle}>Р¤РѕС‚Рѕ РЅРµРґРѕСЃС‚СѓРїРЅРѕ</div>}
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: mediaFit,
            objectPosition: 'center center',
            position: 'relative',
            zIndex: 2,
            display: 'block',
            opacity: loaded && !failed ? 1 : 0,
            visibility: isHidden ? 'hidden' : 'visible',
            transition: 'opacity 0.2s ease',
          }}
          onLoad={(e) => {
            setLoaded(true);
            const ar = readNaturalAspectRatio(e.currentTarget);
            if (ar) onNaturalAspectRatio?.(0, ar);
          }}
          onError={() => setFailed(true)}
        />
      )}
      {!isHidden && isVideo && !failed && (
        <div style={playIconStyle}>
          <svg width={18} height={18} viewBox="0 0 18 18" fill="white">
            <polygon points="5,2 16,9 5,16" />
          </svg>
        </div>
      )}
      {!isHidden && isOverflowCell && (
        <div style={overflowStyle}>
          <span style={{ color: theme.colors.text, fontSize: 28, fontWeight: 700 }}>+{overflowCount}</span>
        </div>
      )}
    </>
  );
}

export default MediaGrid;
