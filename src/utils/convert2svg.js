// main working code - 
// export function convertToSvg(db, transformStack = []) {
//   const entities = db.entities || [];
//   console.log('Total entities:', entities.length);

//   // Enhanced bounds tracking with debugging
//   const bounds = {
//     minX: Infinity,
//     minY: Infinity,
//     maxX: -Infinity,
//     maxY: -Infinity,
//     valid: false
//   };

//   let processedElements = 0;
//   let entityStats = {};

//   // Cached calculations
//   const round = (num) => Math.round(num * 1000) / 1000;
//   const normalizeStrokeWidth = () => 1; // Increased for better visibility

//   // Simple transformation function - let's start basic
//   const applyTransform = (x, y) => {
//     if (!isFinite(x) || !isFinite(y)) return [0, 0];

//     return transformStack.reduce(
//       ([px, py], tf) => {
//         const cos = Math.cos(tf.rotation || 0);
//         const sin = Math.sin(tf.rotation || 0);
//         const sx = tf.scaleX || 1;
//         const sy = tf.scaleY || 1;

//         return [
//           (px * cos - py * sin) * sx + (tf.x || 0),
//           (px * sin + py * cos) * sy + (tf.y || 0)
//         ];
//       },
//       [x, y]
//     );
//   };

//   // Enhanced bounds update with debugging
//   const updateBounds = (x, y, entityType = 'unknown') => {
//     if (!isFinite(x) || !isFinite(y)) {
//       console.warn(`Invalid coordinates for ${entityType}:`, x, y);
//       return;
//     }

//     // For CAD drawings, we often need to flip Y coordinate
//     const [tx, ty] = applyTransform(x, -y); // Try flipping Y again

//     if (!isFinite(tx) || !isFinite(ty)) {
//       console.warn(`Invalid transformed coordinates for ${entityType}:`, tx, ty);
//       return;
//     }

//     if (bounds.minX > tx) bounds.minX = tx;
//     if (bounds.minY > ty) bounds.minY = ty;
//     if (bounds.maxX < tx) bounds.maxX = tx;
//     if (bounds.maxY < ty) bounds.maxY = ty;
//     bounds.valid = true;
//   };

//   // Enhanced validation
//   const isValidPoint = (point) => {
//     return point && 
//            typeof point.x === 'number' && 
//            typeof point.y === 'number' && 
//            isFinite(point.x) && 
//            isFinite(point.y);
//   };

//   // Entity type handlers with enhanced debugging
//   const entityHandlers = {
//     LINE: (e, color, stroke) => {
//       const start = e.startPoint || e.start || e.from;
//       const end = e.endPoint || e.end || e.to;

//       if (!isValidPoint(start) || !isValidPoint(end)) {
//         console.warn('Invalid LINE points:', { start, end });
//         return null;
//       }

//       updateBounds(start.x, start.y, 'LINE');
//       updateBounds(end.x, end.y, 'LINE');

//       const [x1, y1] = applyTransform(start.x, -start.y);
//       const [x2, y2] = applyTransform(end.x, -end.y);

//       console.log(`LINE: (${round(x1)},${round(y1)}) to (${round(x2)},${round(y2)})`);
//       return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke} />`;
//     },

//     CIRCLE: (e, color, stroke) => {
//       if (!isValidPoint(e.center) || !isFinite(e.radius) || e.radius <= 0) {
//         console.warn('Invalid CIRCLE:', e);
//         return null;
//       }

//       updateBounds(e.center.x - e.radius, e.center.y - e.radius, 'CIRCLE');
//       updateBounds(e.center.x + e.radius, e.center.y + e.radius, 'CIRCLE');

//       const [cx, cy] = applyTransform(e.center.x, -e.center.y);

//       console.log(`CIRCLE: center(${round(cx)},${round(cy)}) radius=${round(e.radius)}`);
//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke} fill="none"/>`;
//     },

//     ELLIPSE: (e, color, stroke) => {
//       if (!isValidPoint(e.center) || !isValidPoint(e.majorAxisEndPoint)) {
//         console.warn('Invalid ELLIPSE:', e);
//         return null;
//       }

//       const rx = Math.sqrt(Math.pow(e.majorAxisEndPoint.x, 2) + Math.pow(e.majorAxisEndPoint.y, 2));
//       const ry = rx * (e.axisRatio || 1);

//       updateBounds(e.center.x - rx, e.center.y - ry, 'ELLIPSE');
//       updateBounds(e.center.x + rx, e.center.y + ry, 'ELLIPSE');

//       const [cx, cy] = applyTransform(e.center.x, -e.center.y);

//       console.log(`ELLIPSE: center(${round(cx)},${round(cy)}) rx=${round(rx)} ry=${round(ry)}`);
//       return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" ${stroke} fill="none"/>`;
//     },

//     ARC: (e, color, stroke) => {
//       if (!isValidPoint(e.center) || !isFinite(e.radius) || e.radius <= 0) {
//         console.warn('Invalid ARC:', e);
//         return null;
//       }

//       const { center, radius } = e;
//       const startAngle = e.startAngle || 0;
//       const endAngle = e.endAngle || Math.PI * 2;

//       const sx = center.x + radius * Math.cos(startAngle);
//       const sy = center.y + radius * Math.sin(startAngle);
//       const ex = center.x + radius * Math.cos(endAngle);
//       const ey = center.y + radius * Math.sin(endAngle);

//       updateBounds(sx, sy, 'ARC');
//       updateBounds(ex, ey, 'ARC');

//       const [x1, y1] = applyTransform(sx, -sy);
//       const [x2, y2] = applyTransform(ex, -ey);

//       let angleDiff = endAngle - startAngle;
//       if (angleDiff < 0) angleDiff += 2 * Math.PI;
//       const largeArc = angleDiff > Math.PI ? 1 : 0;
//       const sweep = angleDiff > 0 ? 1 : 0;

//       console.log(`ARC: from(${round(x1)},${round(y1)}) to(${round(x2)},${round(y2)}) radius=${round(radius)}`);
//       return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweep} ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
//     },

//     LWPOLYLINE: (e, color, stroke) => entityHandlers.POLYLINE(e, color, stroke),
//     POLYLINE: (e, color, stroke) => {
//       if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
//         console.warn('Invalid POLYLINE vertices:', e.vertices);
//         return null;
//       }

//       const validVertices = e.vertices.filter(isValidPoint);
//       if (validVertices.length === 0) {
//         console.warn('No valid vertices in POLYLINE');
//         return null;
//       }

//       const transformedPoints = validVertices.map(v => {
//         updateBounds(v.x, v.y, 'POLYLINE');
//         const [x, y] = applyTransform(v.x, -v.y);
//         return `${round(x)},${round(y)}`;
//       }).join(' ');

//       const tag = e.closed || e.isClosed ? 'polygon' : 'polyline';
//       console.log(`${tag.toUpperCase()}: ${validVertices.length} points`);
//       return `<${tag} points="${transformedPoints}" ${stroke} fill="none" />`;
//     },

//     POLYGON: (e, color, stroke) => {
//       if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
//         console.warn('Invalid POLYGON vertices:', e.vertices);
//         return null;
//       }

//       const validVertices = e.vertices.filter(isValidPoint);
//       if (validVertices.length === 0) return null;

//       const pts = validVertices.map(v => {
//         updateBounds(v.x, v.y, 'POLYGON');
//         const [x, y] = applyTransform(v.x, -v.y);
//         return `${round(x)},${round(y)}`;
//       }).join(' ');

//       console.log(`POLYGON: ${validVertices.length} points`);
//       return `<polygon points="${pts}" ${stroke} fill="none" />`;
//     },

//     HATCH: (e, color, stroke, lineWeight, currentTransformStack) => {
//       if (!Array.isArray(e.boundaryPaths) || e.boundaryPaths.length === 0) {
//         console.warn('Invalid HATCH boundary paths');
//         return null;
//       }

//       const paths = [];

//       for (const boundary of e.boundaryPaths) {
//         if (Array.isArray(boundary.edges)) {
//           let pathData = '';

//           for (let i = 0; i < boundary.edges.length; i++) {
//             const edge = boundary.edges[i];

//             if (edge.type === 'line') {
//               const [x1, y1] = applyTransform(edge.start.x, edge.start.y, currentTransformStack);
//               const [x2, y2] = applyTransform(edge.end.x, edge.end.y, currentTransformStack);

//               if (i === 0) pathData += `M ${round(x1)} ${round(y1)}`;
//               pathData += ` L ${round(x2)} ${round(y2)}`;

//               updateBounds(edge.start.x, edge.start.y, 'HATCH');
//               updateBounds(edge.end.x, edge.end.y, 'HATCH');
//             }
//           }

//           if (pathData) {
//             pathData += ' Z';
//             paths.push(`<path d="${pathData}" fill="rgba(${color.r},${color.g},${color.b},0.3)" ${stroke} stroke-width="${lineWeight}" />`);
//           }
//         }
//       }

//       return paths.join('\n');
//     },

//     TEXT: (e, color, stroke) => entityHandlers.MTEXT(e, color, stroke),
//     MTEXT: (e, color, stroke) => {
//       if (!e.text || !(e.insert || e.insertionPoint)) {
//         console.warn('Invalid TEXT:', e);
//         return null;
//       }

//       const pt = e.insert || e.insertionPoint;
//       if (!isValidPoint(pt)) return null;

//       updateBounds(pt.x, pt.y, 'TEXT');
//       const [x, y] = applyTransform(pt.x, -pt.y);

//       const fontSize = Math.max(1, e.height || e.textHeight || 12);
//       console.log(`TEXT: "${e.text}" at (${round(x)},${round(y)})`);
//       return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})">${escapeXml(e.text)}</text>`;
//     },

//     POINT: (e, color, stroke) => {
//       if (!isValidPoint(e.position)) {
//         console.warn('Invalid POINT:', e);
//         return null;
//       }

//       updateBounds(e.position.x, e.position.y, 'POINT');
//       const [cx, cy] = applyTransform(e.position.x, -e.position.y);

//       console.log(`POINT: (${round(cx)},${round(cy)})`);
//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="3" fill="red" />`;
//     },

//     SPLINE: (e, color, stroke) => {
//       if (!Array.isArray(e.controlPoints) || e.controlPoints.length === 0) {
//         console.warn('Invalid SPLINE controlPoints:', e.controlPoints);
//         return null;
//       }

//       const validPoints = e.controlPoints.filter(isValidPoint);
//       if (validPoints.length === 0) return null;

//       validPoints.forEach(pt => updateBounds(pt.x, pt.y, 'SPLINE'));

//       const d = validPoints.map((pt, i) => {
//         const [x, y] = applyTransform(pt.x, -pt.y);
//         return `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`;
//       }).join(' ');

//       console.log(`SPLINE: ${validPoints.length} control points`);
//       return `<path d="${d}" fill="none" ${stroke} />`;
//     }
//   };

//   // XML escaping utility
//   const escapeXml = (text) => {
//     return String(text)
//       .replace(/&/g, '&amp;')
//       .replace(/</g, '&lt;')
//       .replace(/>/g, '&gt;')
//       .replace(/"/g, '&quot;')
//       .replace(/'/g, '&#39;');
//   };

//   // Main element generation function with stats
//   const generateElement = (e, color, stroke) => {
//     if (!e || !e.type) return null;

//     // Count entity types
//     entityStats[e.type] = (entityStats[e.type] || 0) + 1;

//     const handler = entityHandlers[e.type];
//     if (handler) {
//       try {
//         const result = handler(e, color, stroke);
//         if (result) processedElements++;
//         return result;
//       } catch (error) {
//         console.warn(`Error processing ${e.type}:`, error, e);
//         return null;
//       }
//     }

//     console.warn(`Unhandled entity: ${e.type}`, e);
//     return null;
//   };

//   // Generate SVG content
//   const generateSVGContent = (entities) => {
//     const content = [];

//     for (const e of entities) {
//       if (!e || !e.type) continue;

//       // Skip INSERT blocks for now to simplify debugging
//       if (e.type === 'INSERT') {
//         console.log('Skipping INSERT block:', e.blockName || e.name);
//         continue;
//       }

//       // Handle regular entities
//       const color = e.color || { r: 0, g: 0, b: 0 };
//       const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${normalizeStrokeWidth()}"`;

//       const element = generateElement(e, color, stroke);
//       if (element) {
//         content.push(element);
//       }
//     }

//     return content.join('\n');
//   };

//   // Generate SVG content
//   const svgContent = generateSVGContent(entities);

//   // Enhanced debugging output
//   console.log('Entity Statistics:', entityStats);
//   console.log('Processed Elements:', processedElements);
//   console.log('Raw Bounds:', bounds);

//   // Set fallback bounds if no valid bounds found
//   if (!bounds.valid || bounds.minX === Infinity) {
//     console.warn('No valid bounds found, using fallback');
//     Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
//   }

//   // Calculate final dimensions
//   const width = bounds.maxX - bounds.minX;
//   const height = bounds.maxY - bounds.minY;

//   console.log(`Drawing dimensions: ${width} x ${height}`);

//   // Adjust padding based on drawing size
//   const padding = Math.max(width * 0.1, height * 0.1, 50);
//   const viewBox = `${round(bounds.minX - padding)} ${round(bounds.minY - padding)} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

//   console.log('ViewBox:', viewBox);

//   // Generate final SVG with debug background
//   const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap: round; stroke-linejoin: round; background: #f0f0f0; border: 1px solid #ccc;">

//   <!-- Debug: Drawing bounds -->
//   <rect x="${round(bounds.minX)}" y="${round(bounds.minY)}" width="${round(width)}" height="${round(height)}" fill="none" stroke="red" stroke-width="2" stroke-dasharray="10,5"/>
//   <!-- Actual content -->
// ${svgContent}
// </svg>`;

//   console.log('SVG Content Length:', svgContent.length);
//   console.log('First 500 chars of SVG content:', svgContent.substring(0, 500));

//   return finalSvg;
// }












// working code -
// export function convertToSvg(db, transformStack = []) {
//   const tables = db.tables || {};

//   // Early validation
//   if (!tables.BLOCK_RECORD?.entries?.length) {
//     console.warn('No BLOCK_RECORD entries found');
//     return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
//   }

//   console.log('Tables found:', Object.keys(tables));

//   const bounds = {
//     minX: Infinity,
//     minY: Infinity,
//     maxX: -Infinity,
//     maxY: -Infinity,
//     valid: false
//   };

//   let processedElements = 0;
//   const entityStats = new Map();

//   // Configuration options
//   const config = {
//     hideDimensions: true,        // Hide dimension text
//     hideText: false,             // Keep other text visible
//     hidePoints: true,            // Hide point markers
//     simplifySplines: true,       // Convert splines to polylines
//     strokeWidth: 0.5,           // Thinner lines for better visibility
//     textSizeMultiplier: 0.8     // Smaller text
//   };

//   // Pre-compile frequently used functions
//   const round = (num) => Math.round(num * 10000) / 10000; // Higher precision
//   const normalizeStrokeWidth = () => 6;

//   // Optimized transform application
//   const applyTransform = (x, y, transforms = transformStack) => {
//     if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];

//     return transforms.reduce(
//       ([px, py], tf) => {
//         const cos = Math.cos(tf.rotation || 0);
//         const sin = Math.sin(tf.rotation || 0);
//         const sx = tf.scaleX || 1;
//         const sy = tf.scaleY || 1;
//         const tx = tf.x || 0;
//         const ty = tf.y || 0;

//         const scaledX = px * sx;
//         const scaledY = py * sy;
//         const rotatedX = scaledX * cos - scaledY * sin;
//         const rotatedY = scaledX * sin + scaledY * cos;

//         return [rotatedX + tx, rotatedY + ty];
//       },
//       [x, y]
//     );
//   };

//   const updateBounds = (x, y, entityType = 'unknown') => {
//     if (!Number.isFinite(x) || !Number.isFinite(y)) {
//       return;
//     }

//     const [tx, ty] = applyTransform(x, -y);

//     if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
//       return;
//     }

//     bounds.minX = Math.min(bounds.minX, tx);
//     bounds.minY = Math.min(bounds.minY, ty);
//     bounds.maxX = Math.max(bounds.maxX, tx);
//     bounds.maxY = Math.max(bounds.maxY, ty);
//     bounds.valid = true;
//   };

//   const isValidPoint = (point) => {
//     return point &&
//       Number.isFinite(point.x) &&
//       Number.isFinite(point.y);
//   };

//   // Pre-process block definitions
//   const blockDefinitions = new Map();
//   if (tables.BLOCK_RECORD?.entries) {
//     for (const blockRecord of tables.BLOCK_RECORD.entries) {
//       if (blockRecord.name && blockRecord.entities) {
//         blockDefinitions.set(blockRecord.name, blockRecord.entities);
//       }
//     }
//   }

//   // Enhanced entity handlers with better coordinate handling
//   const entityHandlers = {
//     LINE: (e, color, stroke, currentTransforms) => {
//       const start = e.startPoint || e.start || e.from;
//       const end = e.endPoint || e.end || e.to;

//       if (!isValidPoint(start) || !isValidPoint(end)) {
//         return null;
//       }

//       updateBounds(start.x, start.y, 'LINE');
//       updateBounds(end.x, end.y, 'LINE');

//       const [x1, y1] = applyTransform(start.x, -start.y, currentTransforms);
//       const [x2, y2] = applyTransform(end.x, -end.y, currentTransforms);

//       return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`;
//     },

//     CIRCLE: (e, color, stroke, currentTransforms) => {
//       if (!isValidPoint(e.center) || !Number.isFinite(e.radius) || e.radius <= 0) {
//         return null;
//       }

//       updateBounds(e.center.x - e.radius, e.center.y - e.radius, 'CIRCLE');
//       updateBounds(e.center.x + e.radius, e.center.y + e.radius, 'CIRCLE');

//       const [cx, cy] = applyTransform(e.center.x, -e.center.y, currentTransforms);
//       const transformedRadius = e.radius * Math.abs(currentTransforms[0]?.scaleX || 1);

//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(transformedRadius)}" ${stroke} fill="none"/>`;
//     },

//     ELLIPSE: (e, color, stroke, currentTransforms) => {
//       if (!isValidPoint(e.center) || !isValidPoint(e.majorAxisEndPoint)) {
//         return null;
//       }

//       const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
//       const ry = rx * (e.axisRatio || 1);

//       updateBounds(e.center.x - rx, e.center.y - ry, 'ELLIPSE');
//       updateBounds(e.center.x + rx, e.center.y + ry, 'ELLIPSE');

//       const [cx, cy] = applyTransform(e.center.x, -e.center.y, currentTransforms);
//       const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

//       return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke} fill="none"/>`;
//     },

//     ARC: (e, color, stroke, currentTransforms) => {
//       if (!isValidPoint(e.center) || !Number.isFinite(e.radius) || e.radius <= 0) {
//         return null;
//       }

//       const { center, radius } = e;
//       const startAngle = e.startAngle || 0;
//       const endAngle = e.endAngle || Math.PI * 2;

//       // Calculate arc bounds more accurately
//       const angles = [startAngle, endAngle];
//       const cardinalAngles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];

//       for (const angle of cardinalAngles) {
//         if (angle >= startAngle && angle <= endAngle) {
//           angles.push(angle);
//         }
//       }

//       for (const angle of angles) {
//         const x = center.x + radius * Math.cos(angle);
//         const y = center.y + radius * Math.sin(angle);
//         updateBounds(x, y, 'ARC');
//       }

//       const sx = center.x + radius * Math.cos(startAngle);
//       const sy = center.y + radius * Math.sin(startAngle);
//       const ex = center.x + radius * Math.cos(endAngle);
//       const ey = center.y + radius * Math.sin(endAngle);

//       const [cx, cy] = applyTransform(center.x, -center.y, currentTransforms);
//       const [x1, y1] = applyTransform(sx, -sy, currentTransforms);
//       const [x2, y2] = applyTransform(ex, -ey, currentTransforms);

//       let angleDiff = endAngle - startAngle;
//       if (angleDiff < 0) angleDiff += 2 * Math.PI;
//       const largeArc = angleDiff > Math.PI ? 1 : 0;

//       return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
//     },

//     LWPOLYLINE: (e, color, stroke, currentTransforms) => entityHandlers.POLYLINE(e, color, stroke, currentTransforms),

//     POLYLINE: (e, color, stroke, currentTransforms) => {
//       if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
//         return null;
//       }

//       const validVertices = e.vertices.filter(isValidPoint);
//       if (validVertices.length < 2) {
//         return null;
//       }

//       const points = [];
//       for (const vertex of validVertices) {
//         updateBounds(vertex.x, vertex.y, 'POLYLINE');
//         const [x, y] = applyTransform(vertex.x, -vertex.y, currentTransforms);
//         points.push(`${round(x)},${round(y)}`);
//       }

//       const pointsStr = points.join(' ');
//       const tag = e.closed || e.isClosed ? 'polygon' : 'polyline';
//       return `<${tag} points="${pointsStr}" ${stroke} fill="none"/>`;
//     },

//     POLYGON: (e, color, stroke, currentTransforms) => {
//       if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
//         return null;
//       }

//       const validVertices = e.vertices.filter(isValidPoint);
//       if (validVertices.length < 3) return null;

//       const points = [];
//       for (const vertex of validVertices) {
//         updateBounds(vertex.x, vertex.y, 'POLYGON');
//         const [x, y] = applyTransform(vertex.x, -vertex.y, currentTransforms);
//         points.push(`${round(x)},${round(y)}`);
//       }

//       return `<polygon points="${points.join(' ')}" ${stroke} fill="none"/>`;
//     },

//     HATCH: (e, color, stroke, currentTransforms) => {
//       if (!Array.isArray(e.boundaryPaths) || e.boundaryPaths.length === 0) {
//         return null;
//       }

//       const paths = [];
//       for (const boundary of e.boundaryPaths) {
//         if (!Array.isArray(boundary.edges)) continue;

//         let pathData = '';
//         let firstPoint = true;

//         for (const edge of boundary.edges) {
//           if (edge.type === 'line' && isValidPoint(edge.start) && isValidPoint(edge.end)) {
//             const [x1, y1] = applyTransform(edge.start.x, -edge.start.y, currentTransforms);
//             const [x2, y2] = applyTransform(edge.end.x, -edge.end.y, currentTransforms);

//             if (firstPoint) {
//               pathData += `M ${round(x1)} ${round(y1)}`;
//               firstPoint = false;
//             }
//             pathData += ` L ${round(x2)} ${round(y2)}`;

//             updateBounds(edge.start.x, edge.start.y, 'HATCH');
//             updateBounds(edge.end.x, edge.end.y, 'HATCH');
//           }
//         }

//         if (pathData) {
//           pathData += ' Z';
//           paths.push(`<path d="${pathData}" fill="rgba(${color.r},${color.g},${color.b},0.1)" ${stroke}/>`);
//         }
//       }

//       return paths.length > 0 ? paths.join('') : null;
//     },

//     TEXT: (e, color, stroke, currentTransforms) => entityHandlers.MTEXT(e, color, stroke, currentTransforms),

//     MTEXT: (e, color, stroke, currentTransforms) => {
//       // Skip text if configured to hide it
//       if (config.hideText) return null;

//       if (!e.text || !(e.insert || e.insertionPoint)) {
//         return null;
//       }

//       const pt = e.insert || e.insertionPoint;
//       if (!isValidPoint(pt)) return null;

//       updateBounds(pt.x, pt.y, 'TEXT');
//       const [x, y] = applyTransform(pt.x, -pt.y, currentTransforms);

//       const fontSize = Math.max(6, (e.height || e.textHeight || 12) * config.textSizeMultiplier);
//       const textContent = escapeXml(e.text);

//       return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" font-family="Arial,sans-serif">${textContent}</text>`;
//     },

//     DIMENSION: (e, color, stroke, currentTransforms) => {
//       const elements = [];

//       // Always draw dimension lines
//       if (e.dimensionLine && isValidPoint(e.dimensionLine.start) && isValidPoint(e.dimensionLine.end)) {
//         const [x1, y1] = applyTransform(e.dimensionLine.start.x, -e.dimensionLine.start.y, currentTransforms);
//         const [x2, y2] = applyTransform(e.dimensionLine.end.x, -e.dimensionLine.end.y, currentTransforms);

//         updateBounds(e.dimensionLine.start.x, e.dimensionLine.start.y, 'DIMENSION');
//         updateBounds(e.dimensionLine.end.x, e.dimensionLine.end.y, 'DIMENSION');

//         elements.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
//       }

//       // Draw extension lines
//       if (Array.isArray(e.extensionLines)) {
//         for (const line of e.extensionLines) {
//           if (isValidPoint(line.start) && isValidPoint(line.end)) {
//             const [x1, y1] = applyTransform(line.start.x, -line.start.y, currentTransforms);
//             const [x2, y2] = applyTransform(line.end.x, -line.end.y, currentTransforms);

//             updateBounds(line.start.x, line.start.y, 'DIMENSION');
//             updateBounds(line.end.x, line.end.y, 'DIMENSION');

//             elements.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
//           }
//         }
//       }

//       // SKIP dimension text if configured to hide dimensions
//       if (!config.hideDimensions && e.text && e.textPosition && isValidPoint(e.textPosition)) {
//         const [x, y] = applyTransform(e.textPosition.x, -e.textPosition.y, currentTransforms);
//         updateBounds(e.textPosition.x, e.textPosition.y, 'DIMENSION');

//         const fontSize = Math.max(6, (e.textHeight || 8) * config.textSizeMultiplier);
//         elements.push(`<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" font-family="Arial,sans-serif" text-anchor="middle">${escapeXml(e.text)}</text>`);
//       }

//       return elements.length > 0 ? elements.join('') : null;
//     },

//     POINT: (e, color, stroke, currentTransforms) => {
//       // Skip points if configured to hide them
//       if (config.hidePoints) return null;

//       if (!isValidPoint(e.position)) {
//         return null;
//       }

//       updateBounds(e.position.x, e.position.y, 'POINT');
//       const [cx, cy] = applyTransform(e.position.x, -e.position.y, currentTransforms);

//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="1" fill="rgb(${color.r},${color.g},${color.b})"/>`;
//     },

//     SPLINE: (e, color, stroke, currentTransforms) => {
//       if (!Array.isArray(e.controlPoints) || e.controlPoints.length === 0) {
//         return null;
//       }

//       const validPoints = e.controlPoints.filter(isValidPoint);
//       if (validPoints.length < 2) return null;

//       validPoints.forEach(pt => updateBounds(pt.x, pt.y, 'SPLINE'));

//       if (config.simplifySplines) {
//         // Convert to polyline for better compatibility
//         const points = [];
//         for (const pt of validPoints) {
//           const [x, y] = applyTransform(pt.x, -pt.y, currentTransforms);
//           points.push(`${round(x)},${round(y)}`);
//         }
//         return `<polyline points="${points.join(' ')}" fill="none" ${stroke}/>`;
//       } else {
//         // Keep as path
//         const pathCommands = [];
//         for (let i = 0; i < validPoints.length; i++) {
//           const pt = validPoints[i];
//           const [x, y] = applyTransform(pt.x, -pt.y, currentTransforms);
//           pathCommands.push(`${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`);
//         }
//         return `<path d="${pathCommands.join(' ')}" fill="none" ${stroke}/>`;
//       }
//     },

//     INSERT: (e, color, stroke, currentTransforms) => {
//       const blockName = e.blockName || e.name;
//       if (!blockName) {
//         return null;
//       }

//       const blockEntities = blockDefinitions.get(blockName);
//       if (!blockEntities || !Array.isArray(blockEntities)) {
//         return null;
//       }

//       const insertPoint = e.insertionPoint || e.position || { x: 0, y: 0 };
//       const insertTransform = {
//         x: insertPoint.x,
//         y: insertPoint.y,
//         scaleX: e.xScale || e.scaleFactors || 1,
//         scaleY: e.yScale || e.scaleFactors || 1,
//         rotation: e.rotation || 0
//       };

//       const newTransformStack = [...currentTransforms, insertTransform];
//       const blockContent = processEntities(blockEntities, `INSERT.${blockName}`, newTransformStack);

//       return blockContent.length > 0 ? blockContent.join('') : null;
//     }
//   };

//   // XML escaping
//   const xmlEscapeMap = new Map([
//     ['&', '&amp;'],
//     ['<', '&lt;'],
//     ['>', '&gt;'],
//     ['"', '&quot;'],
//     ["'", '&#39;']
//   ]);

//   const escapeXml = (text) => {
//     return String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));
//   };

//   const generateElement = (e, color, stroke, source, currentTransforms) => {
//     if (!e?.type) return null;

//     const key = `${e.type}(${source})`;
//     entityStats.set(key, (entityStats.get(key) || 0) + 1);

//     const handler = entityHandlers[e.type];
//     if (!handler) {
//       return null;
//     }

//     try {
//       const result = handler(e, color, stroke, currentTransforms);
//       if (result) processedElements++;
//       return result;
//     } catch (error) {
//       console.warn(`Error processing ${e.type} from ${source}:`, error);
//       return null;
//     }
//   };

//   const processEntities = (entities, source, currentTransforms) => {
//     if (!Array.isArray(entities)) return [];

//     const content = [];
//     const strokeWidth = normalizeStrokeWidth();

//     for (const entity of entities) {
//       if (!entity?.type) continue;

//       const color = entity.color || { r: 0, g: 0, b: 0 };
//       const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${strokeWidth}"`;

//       const element = generateElement(entity, color, stroke, source, currentTransforms);
//       if (element) {
//         content.push(element);
//       }
//     }

//     return content;
//   };

//   // Main processing
//   const generateSVGContent = () => {
//     const content = [];
//     const entries = tables.BLOCK_RECORD.entries;

//     console.log(`Processing BLOCK_RECORD with ${entries.length} entries`);

//     for (const entry of entries) {
//       if (entry.entities && Array.isArray(entry.entities)) {
//         const entryName = entry.name || 'unnamed_block';
//         const entryContent = processEntities(entry.entities, `BLOCK_RECORD.${entryName}`, transformStack);
//         content.push(...entryContent);
//       }
//     }

//     return content;
//   };

//   const allContent = generateSVGContent();
//   const svgContent = allContent.join('');

//   console.log('Entity Statistics:', Object.fromEntries(entityStats));
//   console.log('Total Processed Elements:', processedElements);

//   if (!bounds.valid || bounds.minX === Infinity) {
//     console.warn('No valid bounds found, using fallback');
//     Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
//   }

//   const width = bounds.maxX - bounds.minX;
//   const height = bounds.maxY - bounds.minY;

//   console.log(`Drawing dimensions: ${width} x ${height}`);

//   // Better padding calculation
//   const padding = Math.max(Math.min(width, height) * 0.02, 10);
//   const viewBox = `${round(bounds.minX - padding)} ${round(bounds.minY - padding)} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

//   console.log('ViewBox:', viewBox);

//   const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap:round;stroke-linejoin:round;background:white">
//   <!-- Processed Elements: ${processedElements} -->
//   <!-- Config: hideDimensions=${config.hideDimensions}, hideText=${config.hideText}, hidePoints=${config.hidePoints} -->
//   ${svgContent}
// </svg>`;

//   console.log('SVG Content Length:', svgContent.length);
//   console.log('Final SVG generated successfully');

//   return finalSvg;
// }











// export function convertToSvg(db, transformStack = []) {
//   const tables = db.tables || {};

//   if (!tables.BLOCK_RECORD?.entries?.length) {
//     console.warn('No BLOCK_RECORD entries found');
//     return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
//   }

//   const bounds = {
//     minX: Infinity,
//     minY: Infinity,
//     maxX: -Infinity,
//     maxY: -Infinity,
//     valid: false
//   };

//   let processedElements = 0;
//   const entityStats = new Map();
//   const renderedHandles = new Set();

//   const config = {
//     hideDimensions: true,
//     hideText: false,
//     hidePoints: true,
//     simplifySplines: true,
//     strokeWidth: 0.5,
//     textSizeMultiplier: 0.8
//   };

//   const round = (num) => Math.round(num * 10000) / 10000;
//   const normalizeStrokeWidth = () => 6;

//   const applyTransform = (x, y, transforms = transformStack) => {
//     if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];

//     return transforms.reduce(
//       ([px, py], tf) => {
//         const cos = Math.cos(tf.rotation || 0);
//         const sin = Math.sin(tf.rotation || 0);
//         const sx = tf.scaleX || 1;
//         const sy = tf.scaleY || 1;
//         const tx = tf.x || 0;
//         const ty = tf.y || 0;

//         const scaledX = px * sx;
//         const scaledY = py * sy;
//         const rotatedX = scaledX * cos - scaledY * sin;
//         const rotatedY = scaledX * sin + scaledY * cos;

//         return [rotatedX + tx, rotatedY + ty];
//       },
//       [x, y]
//     );
//   };

//   const updateBounds = (x, y) => {
//     const [tx, ty] = applyTransform(x, -y);
//     bounds.minX = Math.min(bounds.minX, tx);
//     bounds.minY = Math.min(bounds.minY, ty);
//     bounds.maxX = Math.max(bounds.maxX, tx);
//     bounds.maxY = Math.max(bounds.maxY, ty);
//     bounds.valid = true;
//   };

//   // const isValidPoint = (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y);

//   const xmlEscapeMap = new Map([
//     ['&', '&amp;'],
//     ['<', '&lt;'],
//     ['>', '&gt;'],
//     ['"', '&quot;'],
//     ["'", '&#39;']
//   ]);

//   const escapeXml = (text) => String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));

//   const blockDefinitions = new Map();
//   if (tables.BLOCK_RECORD?.entries) {
//     for (const blockRecord of tables.BLOCK_RECORD.entries) {
//       if (blockRecord.name && blockRecord.entities) {
//         blockDefinitions.set(blockRecord.name, blockRecord.entities);
//       }
//     }
//   }

//   const entityHandlers = {
//     LINE: (e, color, stroke, transforms) => {
//       const start = e.startPoint;
//       const end = e.endPoint;
//       if (!start || !end) return null;
//       updateBounds(start.x, start.y);
//       updateBounds(end.x, end.y);
//       const [x1, y1] = applyTransform(start.x, -start.y, transforms);
//       const [x2, y2] = applyTransform(end.x, -end.y, transforms);
//       return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`;
//     },
//     CIRCLE: (e, color, stroke, transforms) => {
//       if (!e.center || !Number.isFinite(e.radius)) return null;
//       updateBounds(e.center.x - e.radius, e.center.y - e.radius);
//       updateBounds(e.center.x + e.radius, e.center.y + e.radius);
//       const [cx, cy] = applyTransform(e.center.x, -e.center.y, transforms);
//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke} fill="none"/>`;
//     },
//     ARC: (e, color, stroke, transforms) => {
//       if (!e.center || !Number.isFinite(e.radius)) return null;

//       const { center, radius } = e;
//       const startAngle = e.startAngle || 0;
//       const endAngle = e.endAngle || 2 * Math.PI;

//       const sx = center.x + radius * Math.cos(startAngle);
//       const sy = center.y + radius * Math.sin(startAngle);
//       const ex = center.x + radius * Math.cos(endAngle);
//       const ey = center.y + radius * Math.sin(endAngle);

//       updateBounds(sx, sy);
//       updateBounds(ex, ey);

//       const [x1, y1] = applyTransform(sx, -sy, transforms);
//       const [x2, y2] = applyTransform(ex, -ey, transforms);

//       const angleDiff = endAngle - startAngle;
//       const largeArc = angleDiff > Math.PI ? 1 : 0;

//       return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
//     },

//     ELLIPSE: (e, color, stroke, transforms) => {
//       if (!e.center || !e.majorAxisEndPoint) return null;

//       const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
//       const ry = rx * (e.axisRatio || 1);

//       updateBounds(e.center.x - rx, e.center.y - ry);
//       updateBounds(e.center.x + rx, e.center.y + ry);

//       const [cx, cy] = applyTransform(e.center.x, -e.center.y, transforms);
//       const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

//       return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke} fill="none"/>`;
//     },

//     LWPOLYLINE: (e, color, stroke, transforms) => {
//       if (!Array.isArray(e.vertices)) return null;
//       const points = e.vertices.map(v => {
//         updateBounds(v.x, v.y);
//         const [x, y] = applyTransform(v.x, -v.y, transforms);
//         return `${round(x)},${round(y)}`;
//       });
//       const tag = e.closed ? "polygon" : "polyline";
//       return `<${tag} points="${points.join(' ')}" ${stroke} fill="none"/>`;
//     },

//     POLYGON: (e, color, stroke, transforms) => {
//       if (!Array.isArray(e.vertices) || e.vertices.length < 3) return null;
//       const points = e.vertices.map(v => {
//         updateBounds(v.x, v.y);
//         const [x, y] = applyTransform(v.x, -v.y, transforms);
//         return `${round(x)},${round(y)}`;
//       });
//       return `<polygon points="${points.join(' ')}" ${stroke} fill="none"/>`;
//     },

//     HATCH: (e, color, stroke, transforms) => {
//       if (!Array.isArray(e.boundaryPaths)) return null;
//       const paths = [];

//       for (const boundary of e.boundaryPaths) {
//         if (!Array.isArray(boundary.edges)) continue;
//         let pathData = '';
//         let first = true;

//         for (const edge of boundary.edges) {
//           // if (edge.type === 'line' && edge.start && edge.end) {
//           if (edge.type === 1 && edge.start && edge.end) {
//             const [x1, y1] = applyTransform(edge.start.x, -edge.start.y, transforms);
//             const [x2, y2] = applyTransform(edge.end.x, -edge.end.y, transforms);

//             if (first) {
//               pathData += `M ${round(x1)} ${round(y1)}`;
//               first = false;
//             }
//             pathData += ` L ${round(x2)} ${round(y2)}`;

//             updateBounds(edge.start.x, edge.start.y);
//             updateBounds(edge.end.x, edge.end.y);
//           }
//         }

//         if (pathData) {
//           pathData += ' Z';
//           paths.push(`<path d="${pathData}" fill="rgba(${color.r},${color.g},${color.b},0.2)" ${stroke}/>`); 
//         }
//       }

//       return paths.join('');
//     },

//     MTEXT: (e, color, stroke, transforms) => {
//       if (config.hideText || !e.text || !(e.insert || e.insertionPoint)) return null;

//       const pt = e.insert || e.insertionPoint;
//       const [x, y] = applyTransform(pt.x, -pt.y, transforms);
//       updateBounds(pt.x, pt.y);

//       return `<text x="${round(x)}" y="${round(y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${escapeXml(e.text)}</text>`;
//     },

//     DIMENSION: (e, color, stroke, transforms) => {
//       const items = [];

//       if (e.dimensionLine?.start && e.dimensionLine?.end) {
//         const [x1, y1] = applyTransform(e.dimensionLine.start.x, -e.dimensionLine.start.y, transforms);
//         const [x2, y2] = applyTransform(e.dimensionLine.end.x, -e.dimensionLine.end.y, transforms);
//         items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
//         updateBounds(e.dimensionLine.start.x, e.dimensionLine.start.y);
//         updateBounds(e.dimensionLine.end.x, e.dimensionLine.end.y);
//       }

//       for (const line of e.extensionLines || []) {
//         if (line.start && line.end) {
//           const [x1, y1] = applyTransform(line.start.x, -line.start.y, transforms);
//           const [x2, y2] = applyTransform(line.end.x, -line.end.y, transforms);
//           items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
//           updateBounds(line.start.x, line.start.y);
//           updateBounds(line.end.x, line.end.y);
//         }
//       }

//       if (!config.hideDimensions && e.text && e.textPosition) {
//         const [x, y] = applyTransform(e.textPosition.x, -e.textPosition.y, transforms);
//         updateBounds(e.textPosition.x, e.textPosition.y);
//         items.push(`<text x="${round(x)}" y="${round(y)}" font-size="10" fill="rgb(${color.r},${color.g},${color.b})" text-anchor="middle">${escapeXml(e.text)}</text>`);
//       }

//       return items.join('');
//     },

//     POINT: (e, color, stroke, transforms) => {
//       if (config.hidePoints || !e.position) return null;
//       updateBounds(e.position.x, e.position.y);
//       const [cx, cy] = applyTransform(e.position.x, -e.position.y, transforms);
//       return `<circle cx="${round(cx)}" cy="${round(cy)}" r="2" fill="rgb(${color.r},${color.g},${color.b})"/>`;
//     },

//     SPLINE: (e, color, stroke, transforms) => {
//       if (!Array.isArray(e.controlPoints)) return null;
//       const validPoints = e.controlPoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
//       if (validPoints.length < 2) return null;

//       const points = validPoints.map(pt => {
//         updateBounds(pt.x, pt.y);
//         const [x, y] = applyTransform(pt.x, -pt.y, transforms);
//         return `${round(x)},${round(y)}`;
//       });

//       return config.simplifySplines
//         ? `<polyline points="${points.join(' ')}" fill="none" ${stroke}/>`
//         : `<path d="${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`).join(' ')}" fill="none" ${stroke}/>`;
//     },
//     POLYLINE: (e, color, stroke, transforms) => {
//       if (!Array.isArray(e.vertices)) return null;
//       const points = e.vertices.map(v => {
//         updateBounds(v.x, v.y);
//         const [x, y] = applyTransform(v.x, -v.y, transforms);
//         return `${round(x)},${round(y)}`;
//       });
//       return `<polyline points="${points.join(' ')}" ${stroke} fill="none"/>`;
//     },
//     TEXT: (e, color, stroke, transforms) => {
//       if (config.hideText || !e.text || !e.position) return null;
//       updateBounds(e.position.x, e.position.y);
//       const [x, y] = applyTransform(e.position.x, -e.position.y, transforms);
//       return `<text x="${round(x)}" y="${round(y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${escapeXml(e.text)}</text>`;
//     },
//     INSERT: (e, color, stroke, currentTransforms) => {
//       const blockName = e.blockName || e.name;
//       if (!blockName) return null;

//       const blockEntities = blockDefinitions.get(blockName);
//       if (!blockEntities || !Array.isArray(blockEntities)) return null;

//       // Get basePoint from blockRecord
//       const blockRecord = (tables.BLOCK_RECORD?.entries || []).find(b => b.name === blockName);
//       const base = blockRecord?.basePoint || { x: 0, y: 0 };

//       const insertPoint = e.insertionPoint || e.position || { x: 0, y: 0, z: 0 };
//       const xScale = e.xScale ?? e.scaleX ?? 1;
//       const yScale = e.yScale ?? e.scaleY ?? 1;
//       const zScale = e.ZScale ?? e.scaleZ ?? 1;
//       const rotation = e.rotation || 0;

//       // First translate to center around base point, then apply normal transform
//       const insertTransform = {
//         x: insertPoint.x - base.x * xScale,
//         y: insertPoint.y - base.y * yScale,
//         z: insertPoint.z - base.z * zScale,
//         scaleX: xScale,
//         scaleY: yScale,
//         scaleZ: zScale,
//         rotation
//       };

//       const newTransformStack = [...currentTransforms, insertTransform];
//       const blockContent = processEntities(blockEntities, `INSERT.${blockName}`, newTransformStack);

//       return blockContent.length > 0 ? blockContent.join('') : null;
//     }

//   };

//   const generateElement = (e, color, stroke, source, currentTransforms) => {
//     if (!e?.type || renderedHandles.has(e.handle)) return null;
//     renderedHandles.add(e.handle);
//     const key = `${e.type}(${source})`;
//     entityStats.set(key, (entityStats.get(key) || 0) + 1);

//     const handler = entityHandlers[e.type];
//     if (!handler) return null;

//     try {
//       const result = handler(e, color, stroke, currentTransforms);
//       if (result) processedElements++;
//       return result;
//     } catch (err) {
//       console.warn(`Error processing ${e.type} from ${source}:`, err);
//       return null;
//     }
//   };

//   const processEntities = (entities, source, currentTransforms) => {
//     if (!Array.isArray(entities)) return [];
//     const content = [];
//     const strokeWidth = normalizeStrokeWidth();

//     for (const e of entities) {
//       if (!e?.type) continue;
//       const layerFlags = tables.LAYER?.entries?.find(l => l.name === e.layer)?.flags;
//       if (layerFlags & 1) continue; // Skip frozen/invisible layers

//       if (!e?.handle) continue;
//       const color = e.color || { r: 0, g: 0, b: 0 };
//       const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${strokeWidth}"`;
//       const element = generateElement(e, color, stroke, source, currentTransforms);
//       if (element) content.push(element);
//     }
//     return content;
//   };

//   const generateSVGContent = () => {
//     const content = [];

//     // Render db.entities first
//     if (Array.isArray(db.entities)) {
//       const modelContent = processEntities(db.entities, 'MODEL_SPACE', transformStack);
//       content.push(...modelContent);
//     }

//     const entries = tables.BLOCK_RECORD?.entries || [];
//     for (const entry of entries) {
//       const entryName = entry.name || 'unnamed_block';
//       const isModelSpace = entryName === '*Model_Space';
//       const isSameAsDbEntities = entry.entities === db.entities;
//       if (isModelSpace || isSameAsDbEntities) continue;

//       if (Array.isArray(entry.entities)) {
//         const entryContent = processEntities(entry.entities, `BLOCK_RECORD.${entryName}`, transformStack);
//         content.push(...entryContent);
//       }
//     }

//     return content;
//   };

//   // const collectAllEntities = () => {
//   //   const all = [...(db.entities || [])];
//   //   for (const blkName in db.blocks || {}) {
//   //     const blk = db.blocks[blkName];
//   //     if (Array.isArray(blk.entities)) all.push(...blk.entities);
//   //   }
//   //   return all;
//   // };

//   const svgElements = generateSVGContent();
//   const svgContent = svgElements.join('');

//   if (!bounds.valid || bounds.minX === Infinity) {
//     Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
//   }

//   const width = bounds.maxX - bounds.minX;
//   const height = bounds.maxY - bounds.minY;
//   const padding = Math.max(Math.min(width, height) * 0.02, 10);
//   const viewBox = `${round(bounds.minX - padding)} ${round(bounds.minY - padding)} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

//   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap:round;stroke-linejoin:round;background:white">
//     ${svgContent}
//   </svg>`;
// }
















export function convertToSvg(db, transformStack = []) {
  const tables = db.tables || {};

  if (!tables.BLOCK_RECORD?.entries?.length && !db.entities?.length) {
    console.warn('No BLOCK_RECORD entries or entities found');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    valid: false
  };

  let processedElements = 0;
  const entityStats = new Map();
  const renderedHandles = new Set();

  const config = {
    hideDimensions: false,
    hideText: false,
    hidePoints: true,
    simplifySplines: true,
    strokeWidth: 0.5,
    textSizeMultiplier: 0.8,
  };

  const round = (num) => Math.round(num * 10000) / 10000;
  const normalizeStrokeWidth = () => 4;

  const applyTransform = (x, y, transforms = transformStack) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];

    return transforms.reduce(
      ([px, py], tf) => {
        const cos = Math.cos(tf.rotation || 0);
        const sin = Math.sin(tf.rotation || 0);
        const sx = tf.scaleX || 1;
        const sy = tf.scaleY || 1;
        const tx = tf.x || 0;
        const ty = tf.y || 0;

        const scaledX = px * sx;
        const scaledY = py * sy;
        const rotatedX = scaledX * cos - scaledY * sin;
        const rotatedY = scaledX * sin + scaledY * cos;
        return [rotatedX + tx, rotatedY + ty];
      },
      [x, y]
    );
  };

  const updateBounds = (x, y, skipExclusionCheck = false) => {

    const [tx, ty] = applyTransform(x, y);
    bounds.minX = Math.min(bounds.minX, tx);
    bounds.minY = Math.min(bounds.minY, ty);
    bounds.maxX = Math.max(bounds.maxX, tx);
    bounds.maxY = Math.max(bounds.maxY, ty);
    bounds.valid = true;
  };

  const xmlEscapeMap = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ]);

  const escapeXml = (text) => String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));

  const blockDefinitions = new Map();
  if (tables.BLOCK_RECORD?.entries) {
    for (const blockRecord of tables.BLOCK_RECORD.entries) {
      if (blockRecord.name && blockRecord.entities) {
        blockDefinitions.set(blockRecord.name, blockRecord.entities);
      }
    }
  }

  const entityHandlers = {
    LINE: (e, color, stroke, transforms) => {
      const start = e.startPoint;
      const end = e.endPoint;
      if (!start || !end) return null;

      const [x1, y1] = applyTransform(start.x, start.y, transforms);
      const [x2, y2] = applyTransform(end.x, end.y, transforms);

      updateBounds(start.x, start.y);
      updateBounds(end.x, end.y);

      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`;
    },

    CIRCLE: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      updateBounds(e.center.x - e.radius, e.center.y - e.radius);
      updateBounds(e.center.x + e.radius, e.center.y + e.radius);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke} fill="none"/>`;
    },

    ARC: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const { center, radius } = e;
      const startAngle = e.startAngle || 0;
      const endAngle = e.endAngle || 2 * Math.PI;

      const sx = center.x + radius * Math.cos(startAngle);
      const sy = center.y + radius * Math.sin(startAngle);
      const ex = center.x + radius * Math.cos(endAngle);
      const ey = center.y + radius * Math.sin(endAngle);

      const [x1, y1] = applyTransform(sx, sy, transforms);
      const [x2, y2] = applyTransform(ex, ey, transforms);

      updateBounds(sx, sy);
      updateBounds(ex, ey);

      const angleDiff = Math.abs(endAngle - startAngle);
      const largeArc = angleDiff > Math.PI ? 1 : 0;
      const sweepFlag = endAngle > startAngle ? 1 : 0;

      return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweepFlag} ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
    },

    ELLIPSE: (e, color, stroke, transforms) => {
      if (!e.center || !e.majorAxisEndPoint) return null;

      const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
      const ry = rx * (e.axisRatio || 1);

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);

      updateBounds(e.center.x - rx, e.center.y - ry);
      updateBounds(e.center.x + rx, e.center.y + ry);

      const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

      return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke} fill="none"/>`;
    },

    LWPOLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = [];
      for (const v of e.vertices) {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(v.x, v.y);
        points.push(`${round(x)},${round(y)}`);
      }

      const tag = e.closed ? "polygon" : "polyline";
      return `<${tag} points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },

    POLYGON: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 3) return null;

      const points = [];
      for (const v of e.vertices) {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(v.x, v.y);
        points.push(`${round(x)},${round(y)}`);
      }

      return `<polygon points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },

    POLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = [];
      for (const v of e.vertices) {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(v.x, v.y);
        points.push(`${round(x)},${round(y)}`);
      }

      return `<polyline points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },

    HATCH: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.boundaryPaths)) return null;
      const paths = [];

      for (const boundary of e.boundaryPaths) {
        if (!Array.isArray(boundary.edges)) continue;

        let pathData = '';
        let first = true;

        for (const edge of boundary.edges) {
          if (edge.type === 1 && edge.start && edge.end) {
            const [x1, y1] = applyTransform(edge.start.x, edge.start.y, transforms);
            const [x2, y2] = applyTransform(edge.end.x, edge.end.y, transforms);

            if (first) {
              pathData += `M ${round(x1)} ${round(y1)}`;
              first = false;
            }
            pathData += ` L ${round(x2)} ${round(y2)}`;

            updateBounds(edge.start.x, edge.start.y);
            updateBounds(edge.end.x, edge.end.y);
          }
        }

        if (pathData) {
          pathData += ' Z';
          paths.push(`<path d="${pathData}" fill="rgba(${color.r},${color.g},${color.b},0.2)" ${stroke}/>`);
        }
      }

      return paths.join('');
    },

    MTEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !(e.insert || e.insertionPoint)) return null;

      const pt = e.insert || e.insertionPoint;
      const [x, y] = applyTransform(pt.x, -pt.y, transforms);
      updateBounds(pt.x, pt.y);

      return `<text x="${round(x)}" y="${round(y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${escapeXml(e.text)}</text>`;
    },

    TEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);

      updateBounds(e.position.x, e.position.y);

      const fontSize = (e.height || 12) * config.textSizeMultiplier;
      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})">${escapeXml(e.text)}</text>`;
    },

    DIMENSION: (e, color, stroke, transforms) => {
      if (config.hideDimensions) return null;

      const items = [];

      if (e.dimensionLine?.start && e.dimensionLine?.end) {
        const [x1, y1] = applyTransform(e.dimensionLine.start.x, e.dimensionLine.start.y, transforms);
        const [x2, y2] = applyTransform(e.dimensionLine.end.x, e.dimensionLine.end.y, transforms);

        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);

        updateBounds(e.dimensionLine.start.x, e.dimensionLine.start.y);
        updateBounds(e.dimensionLine.end.x, e.dimensionLine.end.y);
      }

      for (const line of e.extensionLines || []) {
        if (line.start && line.end) {
          const [x1, y1] = applyTransform(line.start.x, line.start.y, transforms);
          const [x2, y2] = applyTransform(line.end.x, line.end.y, transforms);

          items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);

          updateBounds(line.start.x, line.start.y);
          updateBounds(line.end.x, line.end.y);
        }
      }

      if (e.text && e.textPosition) {
        const [x, y] = applyTransform(e.textPosition.x, e.textPosition.y, transforms);
        updateBounds(e.textPosition.x, e.textPosition.y);
        items.push(`<text x="${round(x)}" y="${round(y)}" font-size="10" fill="rgb(${color.r},${color.g},${color.b})" text-anchor="middle">${escapeXml(e.text)}</text>`);
      }

      return items.join('');
    },

    POINT: (e, color, stroke, transforms) => {
      if (config.hidePoints || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);

      updateBounds(e.position.x, e.position.y);
      return `<circle cx="${round(x)}" cy="${round(y)}" r="2" fill="rgb(${color.r},${color.g},${color.b})"/>`;
    },

    SPLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.controlPoints)) return null;

      const validPoints = e.controlPoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (validPoints.length < 2) return null;

      for (const pt of validPoints) {
        const [x, y] = applyTransform(pt.x, pt.y, transforms);
        updateBounds(pt.x, pt.y);
      }

      const points = validPoints.map(pt => {
        const [x, y] = applyTransform(pt.x, pt.y, transforms);
        return `${round(x)},${round(y)}`;
      });

      return config.simplifySplines
        ? `<polyline points="${points.join(' ')}" fill="none" ${stroke}/>`
        : `<path d="${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`).join(' ')}" fill="none" ${stroke}/>`;
    },

    INSERT: (e, color, stroke, currentTransforms) => {
      const blockName = e.blockName || e.name;
      if (!blockName) return null;

      const blockEntities = blockDefinitions.get(blockName);
      if (!blockEntities || !Array.isArray(blockEntities)) return null;

      // Get basePoint from blockRecord
      const blockRecord = (tables.BLOCK_RECORD?.entries || []).find(b => b.name === blockName);
      const base = blockRecord?.basePoint || { x: 0, y: 0 };

      const insertPoint = e.insertionPoint || e.position || { x: 0, y: 0, z: 0 };
      const xScale = e.xScale ?? 1;
      const yScale = e.yScale ?? 1;
      const zScale = e.zScale ?? 1;
      const rotation = e.rotation || 0;

      // First translate to center around base point, then apply normal transform
      const insertTransform = {
        x: (insertPoint.x - base.x) * xScale,
        y: (insertPoint.y - base.y) * yScale,
        z: (insertPoint.z - base.z) * zScale,
        scaleX: xScale,
        scaleY: yScale,
        scaleZ: zScale,
        rotation
      };

      const newTransformStack = [...currentTransforms, insertTransform];
      const blockContent = processEntities(blockEntities, `INSERT.${blockName}`, newTransformStack);

      return blockContent.length > 0 ? blockContent.join('') : null;
    }

    // INSERT: (e, color, stroke, currentTransforms) => {
    //   const blockName = e.blockName || e.name;
    //   if (!blockName) return null;

    //   const blockEntities = blockDefinitions.get(blockName);
    //   if (!blockEntities || !Array.isArray(blockEntities)) return null;

    //   const blockRecord = (tables.BLOCK_RECORD?.entries || []).find(b => b.name === blockName);
    //   const base = blockRecord?.basePoint || { x: 0, y: 0 };

    //   const insertPoint = e.insertionPoint || e.position;
    //   const [ix, iy] = applyTransform(insertPoint.x, insertPoint.y, currentTransforms);
    //   const xScale = e.xScale ?? 1;
    //   const yScale = e.yScale ?? 1;
    //   const rotation = e.rotation || 0;

    //   const insertTransform = {
    //     x: insertPoint.x - base.x * xScale,
    //     y: insertPoint.y - base.y * yScale,
    //     scaleX: xScale,
    //     scaleY: yScale,
    //     rotation
    //   };

    //   const newTransformStack = [...currentTransforms, insertTransform];
    //   const blockContent = processEntities(blockEntities, `INSERT.${blockName}`, newTransformStack);

    //   return blockContent.length > 0 ? blockContent.join('') : null;
    // },
  };

  const generateElement = (e, color, stroke, source, currentTransforms) => {
    if (!e?.type) {
      console.log(`${e.type} not an entity`);
      return null;
    }

    if (e.handle) {
      renderedHandles.add(e.handle);
    }

    const key = `${e.type}(${source})`;
    entityStats.set(key, (entityStats.get(key) || 0) + 1);

    const handler = entityHandlers[e.type];
    if (!handler) {
      console.warn(`No handler for entity type: ${e.type}`);
      return null;
    }

    try {
      const result = handler(e, color, stroke, currentTransforms);
      if (result) processedElements++;
      return result;
    } catch (err) {
      console.warn(`Error processing ${e.type} from ${source}:`, err);
      return null;
    }
  };

  const processEntities = (entities, source, currentTransforms) => {
    if (!Array.isArray(entities)) return [];

    const content = [];
    const strokeWidth = normalizeStrokeWidth();

    for (const e of entities) {
      if (!e?.type) continue;

      const color = e.color || { r: 0, g: 0, b: 0 };
      const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${strokeWidth}"`;
      const element = generateElement(e, color, stroke, source, currentTransforms);
      if (element) {
        content.push(element);
      }
    }

    return content;
  };

  const generateSVGContent = () => {
    const content = [];

    const entries = tables.BLOCK_RECORD?.entries || [];
    for (const entry of entries) {
      const entryName = entry.name || 'unnamed_block';

      if (Array.isArray(entry.entities) && entry.entities.length > 0) {
        if (entry.name === '*Model_Space') continue;
        const entryContent = processEntities(entry.entities, `BLOCK_RECORD.${entryName}`, transformStack);
        content.push(...entryContent);
      }
    }

    return content;
  };

  const svgElements = generateSVGContent();
  const svgContent = svgElements.join('');

  console.log(`Processed ${processedElements} elements`);
  console.log('Entity stats:', Object.fromEntries(entityStats));

  if (!bounds.valid || bounds.minX === Infinity) {
    console.warn('No valid bounds found, using default');
    Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padding = Math.max(Math.min(width, height) * 0.05, 10);

  const viewBox = `${round(bounds.minX - padding)} ${round(bounds.minY - padding)} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap:round;stroke-linejoin:round;background:white" transform="scale(1,-1)">
    ${svgContent}
  </svg>`;
}