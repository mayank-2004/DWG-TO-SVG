import React, { useState, useRef } from 'react';

const SVGElement = ({ element, isSelected, onClick, onMove, isSelecting }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const elementRef = useRef(null);

    const handleMouseDown = (e) => {
        if (!isSelecting) return;
        e.stopPropagation();
        setIsDragging(true);
        const rect = e.currentTarget.closest('svg').getBoundingClientRect();
        setDragStart({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        onClick?.(element.id, e);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !isSelecting) return;
        const svgElement = document.querySelector('svg');
        if (!svgElement) return;

        const rect = svgElement.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        onMove?.(deltaX, deltaY);
        setDragStart({ x: currentX, y: currentY });
    };

    const handleMouseUp = () => setIsDragging(false);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    const renderChildren = () => {
        return (element.children || []).map((child, index) => (
            <SVGElement
                key={child.id || index}
                element={child}
                isSelected={isSelected}
                onClick={onClick}
                onMove={onMove}
                isSelecting={isSelecting}
            />
        ));
    };

    const { type, attributes, transform } = element;
    const tag = (type || '').toLowerCase();
    const className = `svg-element ${isSelected ? 'selected' : ''}`;

    const selectionProps = isSelected ? {
        stroke: 'red',
        strokeWidth: 2,
        strokeDasharray: '4 2'
    } : {};

    const commonProps = {
        ref: elementRef,
        className,
        onMouseDown: handleMouseDown,
        style: { cursor: isSelecting ? 'move' : 'pointer' },
        ...selectionProps
    };

    // Core SVG elements
    const baseProps = {
        ...commonProps,
        ...attributes,
        stroke: attributes.stroke || 'black',
        strokeWidth: attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1,
        fill: attributes.fill || 'none'
    };

    switch (tag) {
        case 'line':
            return <line {...baseProps} />;
        case 'circle':
            return <circle {...baseProps} />;
        case 'ellipse':
            return <ellipse {...baseProps} />;
        case 'polygon':
            return <polygon {...baseProps} />;
        case 'lwpolyline':
            return <polyline {...baseProps} />;
        case 'polyline':
            return <polyline {...baseProps} />;
        case 'path':
            return <path {...baseProps} />;
        case 'text':
            return (
                <text {...baseProps} fontSize={attributes['fontSize'] || attributes.fontSize || 12}>
                    {attributes.text || attributes.textContent || element.textContent || ''}
                </text>
            );
        case 'rect':
            return <rect {...baseProps} />;
        case 'arc':
            const rx = attributes.rx || Math.abs(parseFloat(attributes.x2 || 0) - parseFloat(attributes.x1 || 0)) / 2;
            const ry = attributes.ry || Math.abs(parseFloat(attributes.y2 || 0) - parseFloat(attributes.y1 || 0)) / 2;
            return (
                <path
                    {...commonProps}
                    d={`M ${attributes.x1 || 0} ${attributes.y1 || 0} A ${rx} ${ry} 0 ${attributes['large-arc-flag'] || 0} ${attributes['sweep-flag'] || 0} ${attributes.x2 || 0} ${attributes.y2 || 0}`}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                    fill="none"
                />
            );
        case 'image':
            return <image {...baseProps} href={attributes.href || attributes['xlink:href'] || ''} />;
        case 'hatch':
        case 'solid':
            return (
                <polygon
                    {...commonProps}
                    points={attributes.points || ''}
                    fill={type === 'solid' ? (attributes.fill || 'gray') : 'none'}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                    fillRule="evenodd"
                />
            );
        case 'mtext':
            return (
                <text
                    {...commonProps}
                    x={attributes.x || 0}
                    y={attributes.y || 0}
                    fontSize={attributes['fontSize'] || attributes.fontSize || 16}
                    fill={attributes.fill || 'black'}
                    fontFamily={attributes['font-family'] || 'Arial, sans-serif'}
                >
                    {attributes.textContent || element.textContent || ''}
                </text>
            );

        case 'point':
            return (
                <circle
                    {...commonProps}
                    cx={attributes.x || 0}
                    cy={attributes.y || 0}
                    r={attributes.r || 2}
                    fill={attributes.fill || 'black'}
                    stroke="none"
                />
            );

        case 'ole2frame':
        case 'wipeout':
            return (
                <rect
                    {...commonProps}
                    x={attributes.x || 0}
                    y={attributes.y || 0}
                    width={attributes.width || 0}
                    height={attributes.height || 0}
                    fill={attributes.fill || (type === 'wipeout' ? 'white' : 'none')}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                />
            );

        case 'spline':
        case 'trace':
            return (
                <path
                    {...commonProps}
                    d={attributes.d || ''}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                    fill={attributes.fill || 'none'}
                />
            );

        case 'dimension':
            return (
                <g {...commonProps}>
                    <line
                        x1={attributes.x1 || 0}
                        y1={attributes.y1 || 0}
                        x2={attributes.x2 || 0}
                        y2={attributes.y2 || 0}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                    />
                    {attributes.text && (
                        <text
                            x={(parseFloat(attributes.x1 || 0) + parseFloat(attributes.x2 || 0)) / 2}
                            y={(parseFloat(attributes.y1 || 0) + parseFloat(attributes.y2 || 0)) / 2}
                            fontSize={attributes['fontSize'] || attributes.fontSize || 12}
                            fill={attributes.fill || 'black'}
                            textAnchor="middle"
                        >
                            {attributes.text}
                        </text>
                    )}
                </g>
            );

        case '3dface':
        case 'region':
            return (
                <polygon
                    {...commonProps}
                    points={attributes.points || ''}
                    fill={attributes.fill || 'none'}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                />
            );

        case 'attrib':
        case 'attdef':
            return (
                <text
                    {...commonProps}
                    x={attributes.x || 0}
                    y={attributes.y || 0}
                    fontSize={attributes['fontSize'] || attributes.fontSize || 12}
                    fill={attributes.fill || 'black'}
                    fontFamily={attributes['font-family'] || 'Arial, sans-serif'}
                >
                    {attributes.text || attributes.textContent || element.textContent || ''}
                </text>
            );

        case 'leader':
        case 'mleader':
            return (
                <g {...commonProps}>
                    <line
                        x1={attributes.x1 || 0}
                        y1={attributes.y1 || 0}
                        x2={attributes.x2 || 0}
                        y2={attributes.y2 || 0}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                    />
                    {attributes.text && (
                        <text
                            x={(parseFloat(attributes.x1 || 0) + parseFloat(attributes.x2 || 0)) / 2}
                            y={(parseFloat(attributes.y1 || 0) + parseFloat(attributes.y2 || 0)) / 2}
                            fontSize={attributes['fontSize'] || attributes.fontSize || 12}
                            fill={attributes.fill || 'black'}
                            textAnchor="middle"
                        >
                            {attributes.text}
                        </text>
                    )}
                </g>
            );

        case 'ray':
        case 'xline':
            return (
                <line
                    {...commonProps}
                    x1={attributes.x1 || 0}
                    y1={attributes.y1 || 0}
                    x2={attributes.x2 || 0}
                    y2={attributes.y2 || 0}
                    stroke={attributes.stroke || 'black'}
                    strokeWidth={attributes['strokeWidth'] ?? attributes.strokeWidth ?? 1}
                />
            );

        case 'insert':
            return (
                <g {...commonProps} transform={`translate(${attributes.x || 0}, ${attributes.y || 0})`}>
                    {attributes.blockName && (
                        <use href={`#${attributes.blockName}`} />
                    )}
                    {attributes.children && attributes.children.map((child, index) => (
                        <SVGElement
                            key={index}
                            element={child}
                            isSelected={isSelected}
                            onClick={onClick}
                            onMove={onMove}
                            isSelecting={isSelecting}
                        />
                    ))}
                </g>
            );

        case 'g':
            return (
                <g {...commonProps} transform={transform || attributes.transform}>
                    {renderChildren()}
                </g>
            );
        default:
            console.warn(`Unhandled SVG element type: ${tag}`);
            return null;
    }
};

export default SVGElement;