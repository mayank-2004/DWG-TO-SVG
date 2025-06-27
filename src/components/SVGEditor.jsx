// import React, { useState, useRef, useCallback, useEffect } from 'react';
// import SVGElement from './SVGElement';
// import Toolbar from './Toolbar';
// import { v4 as uuidv4 } from 'uuid';
// import LayerPanel from './LayerPanel';
// import { parseSvgContent, generateSvgString } from '../utils/svgParser';

// const SVGEditor = ({ svgContent, onSvgChange }) => {
//   const [elements, setElements] = useState([]);
//   const [selectedElement, setSelectedElement] = useState(null);
//   const [isSelecting, setIsSelecting] = useState(true);
//   const [viewBox, setViewBox] = useState('0 0 800 600');
//   const [hiddenLayers, setHiddenLayers] = useState(new Set());
//   const [showLayers, setShowLayers] = useState(false);
//   const svgRef = useRef(null);

//   useEffect(() => {
//     if (svgContent) {
//       const { elements: parsedElements, viewBox: parsedViewBox } = parseSvgContent(svgContent);
//       parseSvgContent(svgContent);
//       setElements(parsedElements);
//       setViewBox(parsedViewBox);
//     }
//   }, [svgContent]);

//     const parseSvgContent = (svgString) => {
//       const parser = new DOMParser();
//       const doc = parser.parseFromString(svgString, 'image/svg+xml');
//       const svgElement = doc.querySelector('svg');

//       if (svgElement) {
//         const vb = svgElement.getAttribute('viewBox');
//         if (vb) setViewBox(vb);

//         const parsedElements = [];
//         const groups = svgElement.querySelectorAll('g[data-layer]');

//         groups.forEach((group, groupIndex) => {
//           const layer = group.getAttribute('data-layer');
//           const children = Array.from(group.children);

//           children.forEach((child, childIndex) => {
//             const element = {
//               id: uuidv4(),
//               type: child.tagName.toLowerCase(),
//               layer: layer,
//               attributes: getElementAttributes(child),
//               originalElement: child.outerHTML
//             };
//             parsedElements.push(element);
//           });
//         });

//         setElements(parsedElements);
//       }
//     };

//   const getElementAttributes = (element) => {
//     const attrs = {};
//     for (let i = 0; i < element.attributes.length; i++) {
//       const attr = element.attributes[i];
//       attrs[attr.name] = attr.value;
//     }
//     return attrs;
//   };

//   const handleElementClick = (elementId, event) => {
//     event.stopPropagation();
//     if (isSelecting) {
//       setSelectedElement(elementId);
//     }
//   };

//   const handleElementMove = (elementId, deltaX, deltaY) => {
//     setElements(prevElements =>
//       prevElements.map(el => {
//         if (el.id === elementId) {
//           const updatedAttrs = { ...el.attributes };

//           switch (el.type) {
//             case 'line':
//               updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX;
//               updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
//               updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX;
//               updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
//               break;
//             case 'circle':
//               updatedAttrs.cx = parseFloat(updatedAttrs.cx || 0) + deltaX;
//               updatedAttrs.cy = parseFloat(updatedAttrs.cy || 0) + deltaY;
//               break;
//             case 'ellipse':
//               updatedAttrs.cx = parseFloat(updatedAttrs.cx || 0) + deltaX;
//               updatedAttrs.cy = parseFloat(updatedAttrs.cy || 0) + deltaY;
//               break;
//             case 'text':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'lwpolyline':
//             case 'polyline':
//               if (updatedAttrs.points) {
//                 const points = updatedAttrs.points.split(' ').map(point => {
//                   const [x, y] = point.split(',').map(Number);
//                   return `${x + deltaX},${y + deltaY}`;
//                 }).join(' ');
//                 updatedAttrs.points = points;
//               }
//               break;
//             case 'arc':
//               updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX
//               updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
//               updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX
//               updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
//               break;

//             case 'image':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               updatedAttrs.width = parseFloat(updatedAttrs.width || 0) + deltaX;
//               updatedAttrs.height = parseFloat(updatedAttrs.height || 0) + deltaY;
//               break;

//             case 'hatch':
//             case 'solid':
//               if (updatedAttrs.points) {
//                 const points = updatedAttrs.points.split(' ').map(point => {
//                   const [x, y] = point.split(',').map(Number);
//                   return `${x + deltaX},${y + deltaY}`;
//                 }).join(' ');
//                 updatedAttrs.points = points;
//               }
//               break;
//             case 'mtext':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'point':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'ole2frame':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               updatedAttrs.width = parseFloat(updatedAttrs.width || 0) + deltaX;
//               updatedAttrs.height = parseFloat(updatedAttrs.height || 0) + deltaY;
//               break;
//             case 'spline':
//               if (updatedAttrs.d) {
//                 const path = new Path2D(updatedAttrs.d);
//                 const ctx = svgRef.current.getContext('2d');
//                 ctx.translate(deltaX, deltaY);
//                 updatedAttrs.d = ctx.toString();
//                 ctx.resetTransform();
//               }
//               break;
//             case 'dimension':
//               updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX
//               updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
//               updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX
//               updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
//               if (updatedAttrs.text) {
//                 updatedAttrs.textX = parseFloat(updatedAttrs.textX || 0) + deltaX;
//                 updatedAttrs.textY = parseFloat(updatedAttrs.textY || 0) + deltaY
//               }
//               break;
//             case '3dface':
//               if (updatedAttrs.points) {
//                 const points = updatedAttrs.points.split(' ').map(point => {
//                   const [x, y] = point.split(',').map(Number);
//                   return `${x + deltaX},${y + deltaY}`;
//                 }).join(' ');
//                 updatedAttrs.points = points;
//               }
//               break;
//             case 'region':
//               if (updatedAttrs.points) {
//                 const points = updatedAttrs.points.split(' ').map(point => {
//                   const [x, y] = point.split(',').map(Number);
//                   return `${x + deltaX},${y + deltaY}`;
//                 }).join(' ');
//                 updatedAttrs.points = points;
//               }
//               break;
//             case 'attrib':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'attdef':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'leader':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'mleader':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'ray':
//               updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX
//               updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
//               updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX
//               updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
//               break;
//             case 'xline':
//               updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX
//               updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
//               updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX
//               updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
//               break;
//             case 'trace':
//               if (updatedAttrs.d) {
//                 const path = new Path2D(updatedAttrs.d);
//                 const ctx = svgRef.current.getContext('2d');
//                 ctx.translate(deltaX, deltaY);
//                 updatedAttrs.d = ctx.toString();
//                 ctx.resetTransform();
//               }
//               break;
//             case 'insert':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               break;
//             case 'wipeout':
//               updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
//               updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
//               updatedAttrs.width = parseFloat(updatedAttrs.width || 0) + deltaX;
//               updatedAttrs.height = parseFloat(updatedAttrs.height || 0) + deltaY;
//               break;
//             case 'g':
//               updatedAttrs.transform = `translate(${deltaX}, ${deltaY})`;
//               break;
//             default:
//               console.warn(`Unhandled element type: ${el.type}`);
//               break;
//           }

//           return { ...el, attributes: updatedAttrs };
//         }
//         return el;
//       })
//     );
//   };

//   const handleElementDelete = (elementId) => {
//     setElements(prevElements => prevElements.filter(el => el.id !== elementId));
//     if (selectedElement === elementId) {
//       setSelectedElement(null);
//     }
//   };

//   const handleElementUpdate = (elementId, newAttributes) => {
//     setElements(prevElements =>
//       prevElements.map(el =>
//         el.id === elementId ? { ...el, attributes: { ...el.attributes, ...newAttributes } } : el
//       )
//     );
//   };

//   const handleLayerVisibilityChange = (layer, isVisible) => {
//     const newHiddenLayers = new Set(hiddenLayers);
//     if (isVisible) {
//       newHiddenLayers.delete(layer);
//     } else {
//       newHiddenLayers.add(layer);
//     }
//     setHiddenLayers(newHiddenLayers);
//   };

//   const handleCanvasClick = () => {
//     setSelectedElement(null);
//   };

//   const exportSvg = () => {
//     const svgString = generateSvgString(elements, viewBox);
//     if (onSvgChange) {
//       onSvgChange(svgString);
//     }
//     return svgString;
//   };

//   return (
//     <div className="svg-editor">
//       <Toolbar
//         selectedElement={selectedElement ? elements.find(el => el.id === selectedElement) : null}
//         onElementUpdate={handleElementUpdate}
//         onElementDelete={() => selectedElement && handleElementDelete(selectedElement)}
//         onModeChange={setIsSelecting}
//         isSelecting={isSelecting}
//         onExport={exportSvg}
//         onToggleLayers={() => setShowLayers(!showLayers)}
//         showLayers={showLayers}
//       />

//       <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
//         <div style={{ flex: 1 }}>
//           <svg
//             ref={svgRef}
//             viewBox={viewBox}
//             className="svg-canvas"
//             style={{
//               width: '100%',
//               height: '500px',
//               cursor: isSelecting ? 'pointer' : 'crosshair',
//               border: '1px solid #ccc',
//               background: '#fafafa'
//             }}
//             onClick={handleCanvasClick}
//           >
//             <style>
//               {`
//                 text { dominant-baseline: middle; font-family: Arial, sans-serif; }
//                 .svg-element { cursor: pointer; }
//                 .svg-element:hover { opacity: 0.8; }
//                 .svg-element.selected { stroke: red; strokeWidth: 2; stroke-dasharray: 5,5; }
//               `}
//             </style>

//             {elements.map(element => (
//               <SVGElement
//                 key={element.id}
//                 element={element}
//                 isSelected={selectedElement === element.id}
//                 onClick={(e) => handleElementClick(element.id, e)}
//                 onMove={(deltaX, deltaY) => handleElementMove(element.id, deltaX, deltaY)}
//                 isSelecting={isSelecting}
//               />
//             ))}
//           </svg>
//         </div>

//         {showLayers && (
//           <LayerPanel
//             elements={elements}
//             onLayerVisibilityChange={handleLayerVisibilityChange}
//             onElementSelect={setSelectedElement}
//           />
//         )}
//       </div>
//     </div>
//   );
// };

// export default SVGEditor;















import React, { useState, useRef, useCallback, useEffect } from 'react';
import SVGElement from './SVGElement';
import Toolbar from './Toolbar';
import { v4 as uuidv4 } from 'uuid';
import LayerPanel from './LayerPanel';
import { parseSvgContent, generateSvgString } from '../utils/svgParser';

const SVGEditor = ({ svgContent, onSvgChange }) => {
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isSelecting, setIsSelecting] = useState(true);
  const [viewBox, setViewBox] = useState('0 0 800 600');
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [showLayers, setShowLayers] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgContent) {
      const { elements: parsedElements, viewBox: parsedViewBox } = parseSvgContent(svgContent);
      setElements(parsedElements);
      setViewBox(parsedViewBox);
    }
  }, [svgContent]);

  const handleElementClick = (elementId, event) => {
    event.stopPropagation();
    if (isSelecting) {
      setSelectedElement(elementId);
    }
  };

  const handleElementMove = (elementId, deltaX, deltaY) => {
    setElements(prevElements =>
      prevElements.map(el => {
        if (el.id === elementId) {
          const updatedAttrs = { ...el.attributes };

          switch (el.type) {
            case 'line':
              updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX;
              updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
              updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX;
              updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
              break;
            case 'circle':
              updatedAttrs.cx = parseFloat(updatedAttrs.cx || 0) + deltaX;
              updatedAttrs.cy = parseFloat(updatedAttrs.cy || 0) + deltaY;
              break;
            case 'ellipse':
              updatedAttrs.cx = parseFloat(updatedAttrs.cx || 0) + deltaX;
              updatedAttrs.cy = parseFloat(updatedAttrs.cy || 0) + deltaY;
              break;
            case 'text':
            case 'mtext':
            case 'attrib':
            case 'attdef':
            case 'point':
              updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
              updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
              break;
            case 'rect':
            case 'image':
            case 'ole2frame':
            case 'wipeout':
            case 'insert':
              updatedAttrs.x = parseFloat(updatedAttrs.x || 0) + deltaX;
              updatedAttrs.y = parseFloat(updatedAttrs.y || 0) + deltaY;
              break;
            case 'lwpolyline':
            case 'polyline':
            case 'polygon':
            case 'hatch':
            case 'solid':
            case '3dface':
            case 'region':
              if (updatedAttrs.points) {
                const points = updatedAttrs.points.trim().split(/[\s,]+/);
                const updatedPoints = [];
                for (let i = 0; i < points.length; i += 2) {
                  const x = parseFloat(points[i] || 0) + deltaX;
                  const y = parseFloat(points[i + 1] || 0) + deltaY;
                  updatedPoints.push(x, y);
                }
                updatedAttrs.points = updatedPoints.join(' ');
              }
              break;
            case 'arc':
            case 'dimension':
            case 'leader':
            case 'mleader':
            case 'ray':
            case 'xline':
              updatedAttrs.x1 = parseFloat(updatedAttrs.x1 || 0) + deltaX;
              updatedAttrs.y1 = parseFloat(updatedAttrs.y1 || 0) + deltaY;
              updatedAttrs.x2 = parseFloat(updatedAttrs.x2 || 0) + deltaX;
              updatedAttrs.y2 = parseFloat(updatedAttrs.y2 || 0) + deltaY;
              break;
            case 'path':
            case 'spline':
            case 'trace':
              if (updatedAttrs.d) {
                // Simple path translation - this is a basic implementation
                // For more complex paths, you'd need a proper SVG path parser
                updatedAttrs.d = updatedAttrs.d.replace(/([ML])\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)/g, 
                  (match, command, x, y) => {
                    const newX = parseFloat(x) + deltaX;
                    const newY = parseFloat(y) + deltaY;
                    return `${command} ${newX} ${newY}`;
                  });
              }
              break;
            case 'g':
              const currentTransform = updatedAttrs.transform || '';
              const translateMatch = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
              if (translateMatch) {
                const currentX = parseFloat(translateMatch[1]);
                const currentY = parseFloat(translateMatch[2]);
                updatedAttrs.transform = currentTransform.replace(
                  /translate\([^)]+\)/,
                  `translate(${currentX + deltaX}, ${currentY + deltaY})`
                );
              } else {
                updatedAttrs.transform = `translate(${deltaX}, ${deltaY}) ${currentTransform}`.trim();
              }
              break;
            default:
              console.warn(`Unhandled element type for movement: ${el.type}`);
              break;
          }

          return { ...el, attributes: updatedAttrs };
        }
        return el;
      })
    );
  };

  const handleElementDelete = (elementId) => {
    setElements(prevElements => prevElements.filter(el => el.id !== elementId));
    if (selectedElement === elementId) {
      setSelectedElement(null);
    }
  };

  const handleElementUpdate = (elementId, newAttributes) => {
    setElements(prevElements =>
      prevElements.map(el =>
        el.id === elementId ? { ...el, attributes: { ...el.attributes, ...newAttributes } } : el
      )
    );
  };

  const handleLayerVisibilityChange = (layer, isVisible) => {
    const newHiddenLayers = new Set(hiddenLayers);
    if (isVisible) {
      newHiddenLayers.delete(layer);
    } else {
      newHiddenLayers.add(layer);
    }
    setHiddenLayers(newHiddenLayers);
  };

  const handleCanvasClick = () => {
    setSelectedElement(null);
  };

  const exportSvg = () => {
    const svgString = generateSvgString(elements, viewBox);
    if (onSvgChange) {
      onSvgChange(svgString);
    }
    return svgString;
  };

  // Filter elements based on layer visibility
  const visibleElements = elements.filter(element => 
    !hiddenLayers.has(element.layer || 'default')
  );

  // console.log('Visible elements:', visibleElements);

  return (
    <div className="svg-editor">
      <Toolbar
        selectedElement={selectedElement ? elements.find(el => el.id === selectedElement) : null}
        onElementUpdate={handleElementUpdate}
        onElementDelete={() => selectedElement && handleElementDelete(selectedElement)}
        onModeChange={setIsSelecting}
        isSelecting={isSelecting}
        onExport={exportSvg}
        onToggleLayers={() => setShowLayers(!showLayers)}
        showLayers={showLayers}
      />

      <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="svg-canvas"
            style={{
              width: '100%',
              height: '500px',
              cursor: isSelecting ? 'pointer' : 'crosshair',
              border: '1px solid #ccc',
              background: '#fafafa'
            }}
            onClick={handleCanvasClick}
          >
            <style>
              {`
                text { 
                  dominant-baseline: middle; 
                  font-family: Arial, sans-serif; 
                  user-select: none;
                }
                .svg-element { 
                  cursor: pointer; 
                }
                .svg-element:hover { 
                  opacity: 0.8; 
                }
                .svg-element.selected { 
                  filter: drop-shadow(0 0 3px red);
                }
              `}
            </style>

            {visibleElements.map(element => (
              <SVGElement
                key={element.id}
                element={element}
                isSelected={selectedElement === element.id}
                onClick={(e) => handleElementClick(element.id, e)}
                onMove={(deltaX, deltaY) => handleElementMove(element.id, deltaX, deltaY)}
                isSelecting={isSelecting}
              />
            ))}
          </svg>
        </div>

        {showLayers && (
          <LayerPanel
            elements={elements}
            hiddenLayers={hiddenLayers}
            onLayerVisibilityChange={handleLayerVisibilityChange}
            onElementSelect={setSelectedElement}
            selectedElement={selectedElement}
          />
        )}
      </div>
    </div>
  );
};

export default SVGEditor;