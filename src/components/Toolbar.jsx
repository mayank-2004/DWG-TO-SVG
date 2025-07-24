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

    const NumberInput = ({ label, value, onChange }) => (
        <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>{label}:</label>
            <input
                type="number"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{ ...inputStyle, width: '80px', strokeWidth: '4px' }}
            />
        </div>
    );

    const TextInput = ({ label, value, onChange }) => (
        <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>{label}:</label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{ padding: '4px 8px', border: '1px solid #ccc', strokeWidth: '4px', borderRadius: '4px', fontSize: '14px', width: '200px' }}
            />
        </div>
    );

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
        color: 'black',
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>Stroke Color:</label>
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>Stroke Width:</label>
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>Fill Color:</label>
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
                        <NumberInput label="CX" value={attributes.cx || 0} onChange={val => handlePropertyChange('cx', val)} />
                        <NumberInput label="CY" value={attributes.cy || 0} onChange={val => handlePropertyChange('cy', val)} />
                        <NumberInput label="R" value={attributes.r || 0} onChange={val => handlePropertyChange('r', val)} />

                    </>
                )}

                {type === 'line' && (
                    <>
                        <NumberInput label="X1" value={attributes.x1 || 0} onChange={val => handlePropertyChange('x1', val)} />
                        <NumberInput label="Y1" value={attributes.y1 || 0} onChange={val => handlePropertyChange('y1', val)} />
                        <NumberInput label="X2" value={attributes.x2 || 0} onChange={val => handlePropertyChange('x2', val)} />
                        <NumberInput label="Y2" value={attributes.y2 || 0} onChange={val => handlePropertyChange('y2', val)} />

                    </>
                )}

                {(type === 'text' || type === 'mtext') && (
                    <>
                        <TextInput label="Text" value={attributes.text || ''} onChange={val => handlePropertyChange('text', val)} />
                        <NumberInput label="X" value={attributes.x || 0} onChange={val => handlePropertyChange('x', val)} />
                        <NumberInput label="Y" value={attributes.y || 0} onChange={val => handlePropertyChange('y', val)} />
                        <NumberInput label="Font Size" value={attributes['fontSize'] || 12} onChange={val => handlePropertyChange('fontSize', val)} />

                    </>
                )}

                {['arc', 'dimension', 'leader', 'mleader', 'ray', 'xline'].includes(type) && (
                    <>
                        <NumberInput label="X1" value={attributes.x1 || 0} onChange={val => handlePropertyChange('x1', val)} />
                        <NumberInput label="Y1" value={attributes.y1 || 0} onChange={val => handlePropertyChange('y1', val)} />
                        <NumberInput label="X2" value={attributes.x2 || 0} onChange={val => handlePropertyChange('x2', val)} />
                        <NumberInput label="Y2" value={attributes.y2 || 0} onChange={val => handlePropertyChange('y2', val)} />
                    </>
                )}

                {type === 'ellipse' && (
                    <>
                        <NumberInput label="CX" value={attributes.cx || 0} onChange={val => handlePropertyChange('cx', val)} />
                        <NumberInput label="CY" value={attributes.cy || 0} onChange={val => handlePropertyChange('cy', val)} />
                        <NumberInput label="RX" value={attributes.rx || 0} onChange={val => handlePropertyChange('rx', val)} />
                        <NumberInput label="RY" value={attributes.ry || 0} onChange={val => handlePropertyChange('ry', val)} />
                    </>
                )}

                {(type === 'polyline' || type === 'lwpolyline' || type === 'solid' || type === 'hatch' || type === '3dface' || type === 'region' || type === 'polygon') && (
                    <TextInput label="Points" value={attributes.points || ''} onChange={val => handlePropertyChange('points', val)} />
                )}

                {(type === 'spline' || type === 'trace' || type === 'path') && (
                    <TextInput label="Path (d)" value={attributes.d || ''} onChange={val => handlePropertyChange('d', val)} />
                )}

                {type === 'point' && (
                    <>
                        <NumberInput label="X" value={attributes.x || 0} onChange={val => handlePropertyChange('x', val)} />
                        <NumberInput label="Y" value={attributes.y || 0} onChange={val => handlePropertyChange('y', val)} />
                        <NumberInput label="Radius" value={attributes.r || 2} onChange={val => handlePropertyChange('r', val)} />
                    </>
                )}

                {(type === 'attrib' || type === 'attdef') && (
                    <>
                        <NumberInput label="X" value={attributes.x || 0} onChange={val => handlePropertyChange('x', val)} />
                        <NumberInput label="Y" value={attributes.y || 0} onChange={val => handlePropertyChange('y', val)} />
                        <TextInput label="Text" value={attributes.text || ''} onChange={val => handlePropertyChange('text', val)} />
                    </>
                )}

                {(type === 'ole2frame' || type === 'wipeout' || type === 'insert' || type === 'image' || type === 'rect') && (
                    <>
                        <NumberInput label="X" value={attributes.x || 0} onChange={val => handlePropertyChange('x', val)} />
                        <NumberInput label="Y" value={attributes.y || 0} onChange={val => handlePropertyChange('y', val)} />
                        <NumberInput label="Width" value={attributes.width || 0} onChange={val => handlePropertyChange('width', val)} />
                        <NumberInput label="Height" value={attributes.height || 0} onChange={val => handlePropertyChange('height', val)} />
                    </>
                )}

                {type === 'g' && (
                    <TextInput label="Group ID" value={attributes.id || ''} onChange={val => handlePropertyChange('id', val)} />
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