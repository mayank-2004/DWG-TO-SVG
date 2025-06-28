import React, { useState } from 'react';

const Toolbar = ({
    selectedElement,
    onElementUpdate,
    onElementDelete,
    onModeChange,
    isSelecting,
    onExport
}) => {
    const [showProperties, setShowProperties] = useState(false);

    const handlePropertyChange = (property, value) => {
        if (selectedElement && onElementUpdate) {
            onElementUpdate(selectedElement.id, { [property]: value });
        }
    };

    const toolbarStyle = {
        padding: '10px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginBottom: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center'
    };

    const buttonStyle = {
        padding: '8px 12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: 'white',
        cursor: 'pointer',
        fontSize: '14px'
    };

    const activeButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#007bff',
        color: 'white'
    };

    const inputStyle = {
        padding: '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '14px'
    };

    // Helper function to convert RGB to hex
    const rgbToHex = (rgb) => {
        if (!rgb || rgb === 'none') return '#000000';
        if (typeof rgb === 'string' && rgb.startsWith('#')) return rgb;

        if (typeof rgb === 'string') {
            const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                const r = parseInt(match[1]).toString(16).padStart(2, '0');
                const g = parseInt(match[2]).toString(16).padStart(2, '0');
                const b = parseInt(match[3]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        return '#000000';
    };

    const PropertyPanel = () => {
        if (!selectedElement || !showProperties) return null;

        const { attributes, type, layer } = selectedElement;

        return (
            <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '15px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: 1000,
                minWidth: '300px',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
                <h4 style={{ margin: '0 0 15px 0' }}>Element Properties</h4>
                <div style={{ marginBottom: '15px', fontSize: '14px' }}>
                    <strong>Type:</strong> {type} | <strong>Layer:</strong> {layer}
                </div>

                {/* Common properties */}
                {attributes.stroke && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stroke Color:</label>
                        <input
                            type="color"
                            value={rgbToHex(attributes.stroke)}
                            onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                            style={{ width: '50px', height: '30px' }}
                        />
                    </div>
                )}

                {attributes.strokeWidth !== undefined && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stroke Width:</label>
                        <input
                            type="number"
                            value={attributes.strokeWidth}
                            onChange={(e) => handlePropertyChange('strokeWidth', parseFloat(e.target.value))}
                            style={{ ...inputStyle, width: '80px' }}
                        />
                    </div>
                )}

                {attributes.fill && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fill Color:</label>
                        <input
                            type="color"
                            value={rgbToHex(attributes.fill)}
                            onChange={(e) => handlePropertyChange('fill', e.target.value)}
                            style={{ width: '50px', height: '30px' }}
                        />
                    </div>
                )}

                {/* Element-specific properties */}
                {type === 'circle' && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Center X:</label>
                            <input
                                type="number"
                                value={attributes.cx || 0}
                                onChange={(e) => handlePropertyChange('cx', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Center Y:</label>
                            <input
                                type="number"
                                value={attributes.cy || 0}
                                onChange={(e) => handlePropertyChange('cy', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius:</label>
                            <input
                                type="number"
                                value={attributes.r || 0}
                                onChange={(e) => handlePropertyChange('r', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {type === 'line' && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X1:</label>
                            <input
                                type="number"
                                value={attributes.x1 || 0}
                                onChange={(e) => handlePropertyChange('x1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y1:</label>
                            <input
                                type="number"
                                value={attributes.y1 || 0}
                                onChange={(e) => handlePropertyChange('y1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X2:</label>
                            <input
                                type="number"
                                value={attributes.x2 || 0}
                                onChange={(e) => handlePropertyChange('x2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y2:</label>
                            <input
                                type="number"
                                value={attributes.y2 || 0}
                                onChange={(e) => handlePropertyChange('y2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {(type === 'text' || type === 'mtext') && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Text:</label>
                            <input
                                type="text"
                                value={attributes.children || ''}
                                onChange={(e) => handlePropertyChange('children', e.target.value)}
                                style={{ ...inputStyle, width: '200px' }}
                            />
                        </div>
                        {type === 'mtext' && (
                            <>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Position X:</label>
                                    <input
                                        type="number"
                                        value={attributes.x || 0}
                                        onChange={(e) => handlePropertyChange('x', parseFloat(e.target.value))}
                                        style={{ ...inputStyle, width: '80px' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Position Y:</label>
                                    <input
                                        type="number"
                                        value={attributes.y || 0}
                                        onChange={(e) => handlePropertyChange('y', parseFloat(e.target.value))}
                                        style={{ ...inputStyle, width: '80px' }}
                                    />
                                </div>
                            </>
                        )}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Font Size:</label>
                            <input
                                type="number"
                                value={attributes['font-size'] || 12}
                                onChange={(e) => handlePropertyChange('font-size', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {type === 'arc' && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X1:</label>
                            <input
                                type="number"
                                value={attributes.x1 || 0}
                                onChange={(e) => handlePropertyChange('x1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y1:</label>
                            <input
                                type="number"
                                value={attributes.y1 || 0}
                                onChange={(e) => handlePropertyChange('y1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius X:</label>
                            <input
                                type="number"
                                value={attributes.rx || 0}
                                onChange={(e) => handlePropertyChange('rx', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius Y:</label>
                            <input
                                type="number"
                                value={attributes.ry || 0}
                                onChange={(e) => handlePropertyChange('ry', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X2:</label>
                            <input
                                type="number"
                                value={attributes.x2 || 0}
                                onChange={(e) => handlePropertyChange('x2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y2:</label>
                            <input
                                type="number"
                                value={attributes.y2 || 0}
                                onChange={(e) => handlePropertyChange('y2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {type === 'ellipse' && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Center X:</label>
                            <input
                                type="number"
                                value={attributes.cx || 0}
                                onChange={(e) => handlePropertyChange('cx', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Center Y:</label>
                            <input
                                type="number"
                                value={attributes.cy || 0}
                                onChange={(e) => handlePropertyChange('cy', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius X:</label>
                            <input
                                type="number"
                                value={attributes.rx || 0}
                                onChange={(e) => handlePropertyChange('rx', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius Y:</label>
                            <input
                                type="number"
                                value={attributes.ry || 0}
                                onChange={(e) => handlePropertyChange('ry', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {(type === 'polyline' || type === 'lwpolyline' || type === 'solid' || type === 'hatch' || type === '3dface' || type === 'region') && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Points:</label>
                        <input
                            type="text"
                            value={attributes.points || ''}
                            onChange={(e) => handlePropertyChange('points', e.target.value)}
                            style={{ ...inputStyle, width: '200px' }}
                        />
                    </div>
                )}

                {(type === 'spline' || type === 'trace') && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Path Data:</label>
                        <input
                            type="text"
                            value={attributes.d || ''}
                            onChange={(e) => handlePropertyChange('d', e.target.value)}
                            style={{ ...inputStyle, width: '200px' }}
                        />
                    </div>
                )}

                {type === 'point' && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X:</label>
                            <input
                                type="number"
                                value={attributes.x || 0}
                                onChange={(e) => handlePropertyChange('x', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y:</label>
                            <input
                                type="number"
                                value={attributes.y || 0}
                                onChange={(e) => handlePropertyChange('y', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Radius:</label>
                            <input
                                type="number"
                                value={attributes.r || 2}
                                onChange={(e) => handlePropertyChange('r', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {(type === 'dimension' || type === 'leader' || type === 'mleader') && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X1:</label>
                            <input
                                type="number"
                                value={attributes.x1 || 0}
                                onChange={(e) => handlePropertyChange('x1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y1:</label>
                            <input
                                type="number"
                                value={attributes.y1 || 0}
                                onChange={(e) => handlePropertyChange('y1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X2:</label>
                            <input
                                type="number"
                                value={attributes.x2 || 0}
                                onChange={(e) => handlePropertyChange('x2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y2:</label>
                            <input
                                type="number"
                                value={attributes.y2 || 0}
                                onChange={(e) => handlePropertyChange('y2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Text:</label>
                            <input
                                type="text"
                                value={attributes.text || ''}
                                onChange={(e) => handlePropertyChange('text', e.target.value)}
                                style={{ ...inputStyle, width: '200px' }}
                            />
                        </div>
                    </>
                )}

                {(type === 'attrib' || type === 'attdef') && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X:</label>
                            <input
                                type="number"
                                value={attributes.x || 0}
                                onChange={(e) => handlePropertyChange('x', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y:</label>
                            <input
                                type="number"
                                value={attributes.y || 0}
                                onChange={(e) => handlePropertyChange('y', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Text:</label>
                            <input
                                type="text"
                                value={attributes.text || ''}
                                onChange={(e) => handlePropertyChange('text', e.target.value)}
                                style={{ ...inputStyle, width: '200px' }}
                            />
                        </div>
                    </>
                )}

                {(type === 'ole2frame' || type === 'wipeout' || type === 'insert') && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X:</label>
                            <input
                                type="number"
                                value={attributes.x || 0}
                                onChange={(e) => handlePropertyChange('x', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y:</label>
                            <input
                                type="number"
                                value={attributes.y || 0}
                                onChange={(e) => handlePropertyChange('y', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Width:</label>
                            <input
                                type="number"
                                value={attributes.width || 0}
                                onChange={(e) => handlePropertyChange('width', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Height:</label>
                            <input
                                type="number"
                                value={attributes.height || 0}
                                onChange={(e) => handlePropertyChange('height', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        {(type === 'insert' || type === 'image') && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Image URL:</label>
                                <input
                                    type="text"
                                    value={attributes.href || ''}
                                    onChange={(e) => handlePropertyChange('href', e.target.value)}
                                    style={{ ...inputStyle, width: '200px' }}
                                />
                            </div>
                        )}
                    </>
                )}

                {(type === 'ray' || type === 'xline') && (
                    <>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X1:</label>
                            <input
                                type="number"
                                value={attributes.x1 || 0}
                                onChange={(e) => handlePropertyChange('x1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y1:</label>
                            <input
                                type="number"
                                value={attributes.y1 || 0}
                                onChange={(e) => handlePropertyChange('y1', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>X2:</label>
                            <input
                                type="number"
                                value={attributes.x2 || 0}
                                onChange={(e) => handlePropertyChange('x2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Y2:</label>
                            <input
                                type="number"
                                value={attributes.y2 || 0}
                                onChange={(e) => handlePropertyChange('y2', parseFloat(e.target.value))}
                                style={{ ...inputStyle, width: '80px' }}
                            />
                        </div>
                    </>
                )}

                {type === 'image' && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Image URL:</label>
                        <input
                            type="text"
                            value={attributes.href || ''}
                            onChange={(e) => handlePropertyChange('href', e.target.value)}
                            style={{ ...inputStyle, width: '200px' }}
                        />
                    </div>
                )}

                {type ==='g' && (
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Group ID:</label>
                        <input
                            type="text"
                            value={attributes.id || ''}
                            onChange={(e) => handlePropertyChange('id', e.target.value)}
                            style={{ ...inputStyle, width: '200px' }}
                        />
                    </div>
                )}

                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <button
                        onClick={() => selectedElement && onElementDelete && onElementDelete(selectedElement.id)}
                        style={{
                            ...buttonStyle,
                            backgroundColor: '#dc3545',
                            color: 'white',
                            marginRight: '10px'
                        }}
                    >
                        Delete Element
                    </button>
                    <button
                        onClick={() => setShowProperties(false)}
                        style={buttonStyle}
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={toolbarStyle}>
                <button
                    onClick={() => onModeChange && onModeChange('select')}
                    style={isSelecting ? activeButtonStyle : buttonStyle}
                >
                    Select Mode
                </button>

                <button
                    onClick={() => onModeChange && onModeChange('pan')}
                    style={{ ...buttonStyle, color: 'black' }}
                >
                    Pan Mode
                </button>

                <button
                    onClick={() => onModeChange && onModeChange('zoom')}
                    style={{ ...buttonStyle, color: 'black' }}
                >
                    Zoom Mode
                </button>

                {selectedElement && (
                    <button
                        onClick={() => setShowProperties(!showProperties)}
                        style={{ ...(showProperties ? activeButtonStyle : buttonStyle), color: 'black', backgroundColor: 'white' }}
                    >
                        Properties
                    </button>
                )}

                {selectedElement && (
                    <button
                        onClick={() => selectedElement && onElementDelete && onElementDelete(selectedElement.id)}
                        style={{
                            ...buttonStyle,
                            backgroundColor: '#dc3545',
                            color: 'white'
                        }}
                    >
                        Delete
                    </button>
                )}

                <button
                    onClick={onExport}
                    style={{ ...buttonStyle, color: 'black' }}
                >
                    Export SVG
                </button>

                {selectedElement && (
                    <div style={{ fontSize: '14px', color: '#666' }}>
                        Selected: {selectedElement.type} (Layer: {selectedElement.layer})
                    </div>
                )}
            </div>

            <PropertyPanel />
        </div>
    );
};

export default Toolbar;