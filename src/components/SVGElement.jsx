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
        onClick(element.id, e);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !isSelecting) return;

        // Find the SVG element in the DOM instead of using closest()
        const svgElement = document.querySelector('svg');
        if (!svgElement) return;

        const rect = svgElement.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        onMove(deltaX, deltaY);

        setDragStart({ x: currentX, y: currentY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Add event listeners for mouse move and up to the document
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

    const renderElement = () => {
        let { type, attributes } = element;
        const className = `svg-element ${isSelected ? 'selected' : ''}`;

        // Add selection outline for selected elements
        const selectionProps = isSelected ? {
            stroke: 'red',
            strokeWidth: '2',
            strokeDasharray: '5,5'
        } : {};

        const commonProps = {
            ref: elementRef,
            className,
            onMouseDown: handleMouseDown,
            style: { cursor: isSelecting ? 'move' : 'pointer' },
            ...selectionProps
        };

        // Ensure type is lowercase
        type = (element?.type || '').toLowerCase();

        switch (type) {
            case 'line':
                return (
                    <line
                        {...commonProps}
                        x1={attributes.x1 || 0}
                        y1={attributes.y1 || 0}
                        x2={attributes.x2 || 0}
                        y2={attributes.y2 || 0}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill="none"
                    />
                );

            case 'circle':
                return (
                    <circle
                        {...commonProps}
                        cx={attributes.cx || 0}
                        cy={attributes.cy || 0}
                        r={attributes.r || 1}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'ellipse':
                return (
                    <ellipse
                        {...commonProps}
                        cx={attributes.cx || 0}
                        cy={attributes.cy || 0}
                        rx={attributes.rx || 1}
                        ry={attributes.ry || 1}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'polyline':
            case 'lwpolyline':
                return (
                    <polyline
                        {...commonProps}
                        points={attributes.points || ''}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'polygon':
                return (
                    <polygon
                        {...commonProps}
                        points={attributes.points || ''}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'path':
                return (
                    <path
                        {...commonProps}
                        d={attributes.d || ''}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'text':
                return (
                    <text
                        {...commonProps}
                        x={attributes.x || 0}
                        y={attributes.y || 0}
                        fontSize={attributes['font-size'] || attributes.fontSize || 12}
                        fill={attributes.fill || 'black'}
                        fontFamily={attributes['font-family'] || 'Arial, sans-serif'}
                    >
                        {attributes.textContent || element.textContent || ''}
                    </text>
                );

            case 'rect':
                return (
                    <rect
                        {...commonProps}
                        x={attributes.x || 0}
                        y={attributes.y || 0}
                        width={attributes.width || 0}
                        height={attributes.height || 0}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill={attributes.fill || 'none'}
                    />
                );

            case 'arc':
                const rx = attributes.rx || Math.abs(parseFloat(attributes.x2 || 0) - parseFloat(attributes.x1 || 0)) / 2;
                const ry = attributes.ry || Math.abs(parseFloat(attributes.y2 || 0) - parseFloat(attributes.y1 || 0)) / 2;
                return (
                    <path
                        {...commonProps}
                        d={`M ${attributes.x1 || 0} ${attributes.y1 || 0} A ${rx} ${ry} 0 ${attributes['large-arc-flag'] || 0} ${attributes['sweep-flag'] || 0} ${attributes.x2 || 0} ${attributes.y2 || 0}`}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fill="none"
                    />
                );

            case 'image':
                return (
                    <image
                        {...commonProps}
                        x={attributes.x || 0}
                        y={attributes.y || 0}
                        width={attributes.width || 0}
                        height={attributes.height || 0}
                        href={attributes.href || attributes['xlink:href'] || ''}
                    />
                );

            case 'hatch':
            case 'solid':
                return (
                    <polygon
                        {...commonProps}
                        points={attributes.points || ''}
                        fill={type === 'solid' ? (attributes.fill || 'gray') : 'none'}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        fillRule="evenodd"
                    />
                );

            case 'mtext':
                return (
                    <text
                        {...commonProps}
                        x={attributes.x || 0}
                        y={attributes.y || 0}
                        fontSize={attributes['font-size'] || attributes.fontSize || 16}
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
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                    />
                );

            case 'spline':
            case 'trace':
                return (
                    <path
                        {...commonProps}
                        d={attributes.d || ''}
                        stroke={attributes.stroke || 'black'}
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
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
                            strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        />
                        {attributes.text && (
                            <text
                                x={(parseFloat(attributes.x1 || 0) + parseFloat(attributes.x2 || 0)) / 2}
                                y={(parseFloat(attributes.y1 || 0) + parseFloat(attributes.y2 || 0)) / 2}
                                fontSize={attributes['font-size'] || attributes.fontSize || 12}
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
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                    />
                );

            case 'attrib':
            case 'attdef':
                return (
                    <text
                        {...commonProps}
                        x={attributes.x || 0}
                        y={attributes.y || 0}
                        fontSize={attributes['font-size'] || attributes.fontSize || 12}
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
                            strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
                        />
                        {attributes.text && (
                            <text
                                x={(parseFloat(attributes.x1 || 0) + parseFloat(attributes.x2 || 0)) / 2}
                                y={(parseFloat(attributes.y1 || 0) + parseFloat(attributes.y2 || 0)) / 2}
                                fontSize={attributes['font-size'] || attributes.fontSize || 12}
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
                        strokeWidth={attributes['stroke-width'] ?? attributes.strokeWidth ?? 1}
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
                    <g {...commonProps} transform={attributes.transform}>
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

            default:
                console.warn(`Unsupported element type: ${type}`);
                // Return a placeholder rect for unsupported elements
                return (
                    <rect
                        {...commonProps}
                        x={element.bounds?.minX || 0}
                        y={element.bounds?.minY || 0}
                        width={Math.max(1, (element.bounds?.maxX || 1) - (element.bounds?.minX || 0))}
                        height={Math.max(1, (element.bounds?.maxY || 1) - (element.bounds?.minY || 0))}
                        fill="none"
                        stroke="red"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.5"
                    />
                );
        }
    };

    return renderElement();
};

export default SVGElement;