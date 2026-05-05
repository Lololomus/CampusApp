import { Network } from 'lucide-react';
import { getFacultyGraphNode } from '../../constants/universityData';

const PRIMARY = '#D4FF00';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#8E8E93';

function FacultyGraphPicker({
  campus,
  value,
  onSelect,
  disabled = false,
  onDisabledClick,
}) {
  const graph = campus?.facultyGraph;
  if (!graph) return null;

  const selectedNode = getFacultyGraphNode(campus, value);

  const handleSelect = (nodeValue) => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    onSelect?.(nodeValue);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.canvas}>
        <div style={styles.hubRow}>
          <div style={styles.hubNode}>
            <Network size={17} />
            <span>{graph.center || campus.university}</span>
          </div>
        </div>

        <div style={styles.flowRows}>
          {(graph.clusters || []).map((cluster) => (
            <div key={cluster.id || cluster.label} style={styles.flowRow}>
              <div style={styles.branchCol}>
                <span style={styles.branchLine} />
                <span style={{ ...styles.branchDot, background: cluster.accent || PRIMARY }} />
              </div>

              <div
                style={{
                  ...styles.clusterPanel,
                  borderColor: colorWithAlpha(cluster.accent, 0.34),
                  boxShadow: `inset 3px 0 0 ${cluster.accent || PRIMARY}`,
                }}
              >
                <div style={styles.clusterHeader}>
                  <span style={styles.clusterTitle}>{cluster.label}</span>
                  <span style={styles.clusterCount}>{(cluster.nodes || []).length}</span>
                </div>

                <div style={styles.leafGrid}>
                  {(cluster.nodes || []).map((node) => {
                    const isActive = value === node.value;

                    return (
                      <button
                        key={node.value}
                        type="button"
                        onClick={() => handleSelect(node.value)}
                        style={{
                          ...styles.leafNode,
                          ...(isActive ? styles.leafNodeActive : {}),
                          ...(disabled ? styles.nodeDisabled : {}),
                        }}
                      >
                        <span style={styles.leafTop}>
                          <span style={styles.leafLabel}>{node.label}</span>
                          <span style={styles.nodeType}>{getNodeTypeLabel(node.officialType)}</span>
                        </span>
                        <span style={styles.leafFullName}>{node.fullName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {graph.other && (
          <div style={styles.otherRow}>
            <div style={styles.branchCol}>
              <span style={styles.branchLine} />
              <span style={{ ...styles.branchDot, background: MUTED }} />
            </div>
            <button
              type="button"
              onClick={() => handleSelect(graph.other.value)}
              style={{
                ...styles.otherNode,
                ...(value === graph.other.value ? styles.leafNodeActive : {}),
                ...(disabled ? styles.nodeDisabled : {}),
              }}
            >
              <span style={styles.otherLabel}>{graph.other.label}</span>
              <span style={styles.leafFullName}>{graph.other.fullName}</span>
            </button>
          </div>
        )}
      </div>

      {selectedNode ? (
        <div style={styles.pathPill}>
          <span style={styles.pathMuted}>Путь:</span>
          <span>{campus.university} → {selectedNode.cluster} → {selectedNode.value}</span>
        </div>
      ) : (
        <div style={styles.pathEmpty}>Выберите свой институт или факультет</div>
      )}
    </div>
  );
}

function getNodeTypeLabel(type) {
  if (type === 'institute') return 'институт';
  if (type === 'school') return 'школа';
  if (type === 'other') return 'другое';
  return 'факультет';
}

function colorWithAlpha(hex, alpha) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(212,255,0,${alpha})`;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0,
  },
  canvas: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 0,
    padding: '8px 0 0',
    backgroundColor: 'transparent',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.075) 1px, transparent 1px)',
    backgroundSize: '18px 18px',
  },
  hubRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    paddingLeft: 22,
    marginBottom: 12,
  },
  hubNode: {
    minHeight: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 14px',
    borderRadius: 13,
    background: '#1C1C1E',
    border: `1px solid ${PRIMARY}`,
    color: '#fff',
    fontSize: 16,
    fontWeight: 900,
    boxShadow: '0 10px 22px rgba(0,0,0,0.3), 0 0 20px rgba(212,255,0,0.13)',
    zIndex: 2,
  },
  flowRows: {
    display: 'grid',
    gap: 8,
  },
  flowRow: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '22px minmax(0, 1fr)',
    gap: 8,
    alignItems: 'stretch',
    minWidth: 0,
  },
  branchCol: {
    position: 'relative',
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  branchDot: {
    position: 'relative',
    zIndex: 2,
    width: 9,
    height: 9,
    borderRadius: '50%',
    boxShadow: '0 0 12px rgba(255,255,255,0.24)',
  },
  branchLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    borderRadius: 2,
    background: 'linear-gradient(180deg, rgba(212,255,0,0.45), rgba(255,255,255,0.12))',
    transform: 'translateX(-50%)',
  },
  clusterPanel: {
    position: 'relative',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 10px 10px 12px',
    borderRadius: 14,
    background: 'rgba(12,12,13,0.46)',
    border: `1px solid ${BORDER}`,
    minWidth: 0,
  },
  clusterHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  clusterTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clusterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.07)',
    color: MUTED,
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  },
  leafGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))',
    gap: 7,
    minWidth: 0,
  },
  leafNode: {
    position: 'relative',
    minHeight: 56,
    border: `1px solid ${BORDER}`,
    background: 'rgba(255,255,255,0.045)',
    color: '#fff',
    borderRadius: 12,
    padding: '8px 9px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    cursor: 'pointer',
    transition: 'background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
    minWidth: 0,
    overflow: 'hidden',
  },
  leafNodeActive: {
    background: PRIMARY,
    color: '#000',
    border: `1px solid ${PRIMARY}`,
    boxShadow: '0 10px 24px rgba(212,255,0,0.18)',
  },
  nodeDisabled: {
    opacity: 0.48,
  },
  leafTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minWidth: 0,
  },
  leafLabel: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nodeType: {
    fontSize: 10,
    fontWeight: 900,
    opacity: 0.58,
    flexShrink: 0,
  },
  leafFullName: {
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.18,
    opacity: 0.74,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
  otherRow: {
    display: 'grid',
    gridTemplateColumns: '22px minmax(0, 1fr)',
    gap: 8,
    alignItems: 'stretch',
    marginTop: 8,
  },
  otherNode: {
    position: 'relative',
    minHeight: 52,
    border: `1px solid ${BORDER}`,
    background: 'rgba(255,255,255,0.045)',
    color: '#fff',
    borderRadius: 14,
    padding: '9px 10px 9px 12px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    cursor: 'pointer',
  },
  otherLabel: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.05,
  },
  pathPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    padding: '0 4px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  pathMuted: {
    color: MUTED,
    fontWeight: 600,
  },
  pathEmpty: {
    color: MUTED,
    fontSize: 13,
    padding: '0 4px',
  },
};

export default FacultyGraphPicker;
