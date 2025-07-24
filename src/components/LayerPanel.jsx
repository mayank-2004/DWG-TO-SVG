import React, { useState, useEffect } from 'react';

const LayerPanel = ({ elements, hiddenLayers, onLayerVisibilityChange }) => {
  const [layerCounts, setLayerCounts] = useState({});

  const collectLayers = (items, counts = {}) => {
    for (const el of items) {
      const layer = el.layer || 'default';
      counts[layer] = (counts[layer] || 0) + 1;
      if (el.children?.length) collectLayers(el.children, counts);
    }
    return counts;
  };

  useEffect(() => {
    setLayerCounts(collectLayers(elements));
  }, [elements]);

  const toggleLayerVisibility = (layer) => {
    const currentlyHidden = hiddenLayers.has(layer);
    onLayerVisibilityChange(layer, currentlyHidden); 
  };

  const panelStyle = {
    width: '250px',
    height: '400px',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    background: 'white',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    padding: '12px 16px',
    background: '#f8f9fa',
    borderBottom: '1px solid #dee2e6',
    fontWeight: '600',
    fontSize: '14px',
    color: '#495057'
  };

  const layerItemStyle = {
    padding: '8px 16px',
    borderBottom: '1px solid #f1f3f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background-color 0.2s ease'
  };

  const sortedLayers = Object.keys(layerCounts).sort();

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        Layers ({sortedLayers.length})
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedLayers.map(layer => {
          const isHidden = hiddenLayers.has(layer);
          const count = layerCounts[layer];

          return (
            <div
              key={layer}
              style={layerItemStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              onClick={() => toggleLayerVisibility(layer)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', opacity: isHidden ? 0.3 : 1 }}>
                  {isHidden ? '🙈' : '👁️'}
                </span>
                <span style={{
                  color: isHidden ? '#6c757d' : '#495057',
                  textDecoration: isHidden ? 'line-through' : 'none'
                }}>
                  {layer}
                </span>
              </div>
              <span style={{
                background: isHidden ? '#6c757d' : '#007bff',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                {count}
              </span>
            </div>
          );
        })}

        {sortedLayers.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '13px'
          }}>
            No layers found
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerPanel;