import { useEffect, useState } from 'react';

const UNI_GRADIENTS = [
  'linear-gradient(135deg, #0A84FF, #005BBB)',
  'linear-gradient(135deg, #FF453A, #D70015)',
  'linear-gradient(135deg, #FF9F0A, #FF375F)',
  'linear-gradient(135deg, #32D74B, #30D158)',
  'linear-gradient(135deg, #BF5AF2, #5E5CE6)',
  'linear-gradient(135deg, #FFD60A, #FF9F0A)',
  'linear-gradient(135deg, #5E5CE6, #0A84FF)',
  'linear-gradient(135deg, #FF6B6B, #FF8E53)',
  'linear-gradient(135deg, #00C6FF, #0072FF)',
];

function getCampusGradient(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return UNI_GRADIENTS[hash % UNI_GRADIENTS.length];
}

function CampusLogoAvatar({
  campus,
  size = 48,
  radius = 14,
  letterSize = 18,
  style,
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = campus?.logo;
  const showLogo = Boolean(logo) && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [logo]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: getCampusGradient(campus?.id || campus?.university || ''),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {showLogo ? (
        <img
          src={logo}
          alt=""
          onError={() => setLogoFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            boxSizing: 'border-box',
            padding: Math.max(3, Math.round(size * 0.08)),
            background: '#fff',
          }}
        />
      ) : (
        <span style={{ fontSize: letterSize, fontWeight: 800, color: '#fff' }}>
          {(campus?.university || '?').charAt(0)}
        </span>
      )}
    </div>
  );
}

export default CampusLogoAvatar;
