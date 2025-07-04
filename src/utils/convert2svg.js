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
export function convertToSvg(db, transformStack = []) {
  const tables = db.tables || {};

  console.log('Processing all tables with proper INSERT handling');
  console.log('Tables found:', Object.keys(tables));

  // Enhanced bounds tracking
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    valid: false
  };

  let processedElements = 0;
  let entityStats = {};
  let processedBlocks = {};

  // Cached calculations
  const round = (num) => Math.round(num * 1000) / 1000;
  const normalizeStrokeWidth = () => 5;

  // Enhanced transform application with proper matrix multiplication
  const applyTransform = (x, y, transforms = transformStack) => {
    if (!isFinite(x) || !isFinite(y)) return [0, 0];

    return transforms.reduce(
      ([px, py], tf) => {
        const cos = Math.cos(tf.rotation || 0);
        const sin = Math.sin(tf.rotation || 0);
        const sx = tf.scaleX || 1;
        const sy = tf.scaleY || 1;
        const tx = tf.x || 0;
        const ty = tf.y || 0;

        // Apply scale, rotation, then translation
        const scaledX = px * sx;
        const scaledY = py * sy;
        const rotatedX = scaledX * cos - scaledY * sin;
        const rotatedY = scaledX * sin + scaledY * cos;

        return [rotatedX + tx, rotatedY + ty];
      },
      [x, y]
    );
  };

  // Enhanced bounds update
  const updateBounds = (x, y, entityType = 'unknown') => {
    if (!isFinite(x) || !isFinite(y)) {
      console.warn(`Invalid coordinates for ${entityType}:`, x, y);
      return;
    }

    const [tx, ty] = applyTransform(x, -y);

    if (!isFinite(tx) || !isFinite(ty)) {
      console.warn(`Invalid transformed coordinates for ${entityType}:`, tx, ty);
      return;
    }

    if (bounds.minX > tx) bounds.minX = tx;
    if (bounds.minY > ty) bounds.minY = ty;
    if (bounds.maxX < tx) bounds.maxX = tx;
    if (bounds.maxY < ty) bounds.maxY = ty;
    bounds.valid = true;
  };

  // Enhanced validation
  const isValidPoint = (point) => {
    return point &&
      typeof point.x === 'number' &&
      typeof point.y === 'number' &&
      isFinite(point.x) &&
      isFinite(point.y);
  };

  // Build block definition map for INSERT resolution
  const blockDefinitions = {};

  // Process BLOCK table to build block definitions
  // if (tables.BLOCK && tables.BLOCK.entries) {
  //   tables.BLOCK.entries.forEach(block => {
  //     if (block.name && block.entities) {
  //       blockDefinitions[block.name] = block.entities;
  //     }
  //   });
  // }

  // Process BLOCK_RECORD table to build additional block definitions
  if (tables.BLOCK_RECORD && tables.BLOCK_RECORD.entries) {
    tables.BLOCK_RECORD.entries.forEach(blockRecord => {
      if (blockRecord.name && blockRecord.entities) {
        blockDefinitions[blockRecord.name] = blockRecord.entities;
      }
    });
  }

  // console.log('Block definitions found:', Object.keys(blockDefinitions));

  // Enhanced entity type handlers
  const entityHandlers = {
    LINE: (e, color, stroke, currentTransforms) => {
      const start = e.startPoint || e.start || e.from;
      const end = e.endPoint || e.end || e.to;

      if (!isValidPoint(start) || !isValidPoint(end)) {
        console.warn('Invalid LINE points:', { start, end });
        return null;
      }

      updateBounds(start.x, start.y, 'LINE');
      updateBounds(end.x, end.y, 'LINE');

      const [x1, y1] = applyTransform(start.x, -start.y, currentTransforms);
      const [x2, y2] = applyTransform(end.x, -end.y, currentTransforms);

      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke} />`;
    },

    CIRCLE: (e, color, stroke, currentTransforms) => {
      if (!isValidPoint(e.center) || !isFinite(e.radius) || e.radius <= 0) {
        console.warn('Invalid CIRCLE:', e);
        return null;
      }

      updateBounds(e.center.x - e.radius, e.center.y - e.radius, 'CIRCLE');
      updateBounds(e.center.x + e.radius, e.center.y + e.radius, 'CIRCLE');

      const [cx, cy] = applyTransform(e.center.x, -e.center.y, currentTransforms);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke} fill="none"/>`;
    },

    ELLIPSE: (e, color, stroke, currentTransforms) => {
      if (!isValidPoint(e.center) || !isValidPoint(e.majorAxisEndPoint)) {
        console.warn('Invalid ELLIPSE:', e);
        return null;
      }

      const rx = Math.sqrt(Math.pow(e.majorAxisEndPoint.x, 2) + Math.pow(e.majorAxisEndPoint.y, 2));
      const ry = rx * (e.axisRatio || 1);

      updateBounds(e.center.x - rx, e.center.y - ry, 'ELLIPSE');
      updateBounds(e.center.x + rx, e.center.y + ry, 'ELLIPSE');

      const [cx, cy] = applyTransform(e.center.x, -e.center.y, currentTransforms);

      return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" ${stroke} fill="none"/>`;
    },

    ARC: (e, color, stroke, currentTransforms) => {
      if (!isValidPoint(e.center) || !isFinite(e.radius) || e.radius <= 0) {
        console.warn('Invalid ARC:', e);
        return null;
      }

      const { center, radius } = e;
      const startAngle = e.startAngle || 0;
      const endAngle = e.endAngle || Math.PI * 2;

      const sx = center.x + radius * Math.cos(startAngle);
      const sy = center.y + radius * Math.sin(startAngle);
      const ex = center.x + radius * Math.cos(endAngle);
      const ey = center.y + radius * Math.sin(endAngle);

      updateBounds(sx, sy, 'ARC');
      updateBounds(ex, ey, 'ARC');

      const [x1, y1] = applyTransform(sx, -sy, currentTransforms);
      const [x2, y2] = applyTransform(ex, -ey, currentTransforms);

      let angleDiff = endAngle - startAngle;
      if (angleDiff < 0) angleDiff += 2 * Math.PI;
      const largeArc = angleDiff > Math.PI ? 1 : 0;
      const sweep = angleDiff > 0 ? 1 : 0;

      return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweep} ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
    },

    LWPOLYLINE: (e, color, stroke, currentTransforms) => entityHandlers.POLYLINE(e, color, stroke, currentTransforms),
    POLYLINE: (e, color, stroke, currentTransforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
        console.warn('Invalid POLYLINE vertices:', e.vertices);
        return null;
      }

      const validVertices = e.vertices.filter(isValidPoint);
      if (validVertices.length === 0) {
        console.warn('No valid vertices in POLYLINE');
        return null;
      }

      const transformedPoints = validVertices.map(v => {
        updateBounds(v.x, v.y, 'POLYLINE');
        const [x, y] = applyTransform(v.x, -v.y, currentTransforms);
        return `${round(x)},${round(y)}`;
      }).join(' ');

      const tag = e.closed || e.isClosed ? 'polygon' : 'polyline';
      return `<${tag} points="${transformedPoints}" ${stroke} fill="none" />`;
    },

    POLYGON: (e, color, stroke, currentTransforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length === 0) {
        console.warn('Invalid POLYGON vertices:', e.vertices);
        return null;
      }

      const validVertices = e.vertices.filter(isValidPoint);
      if (validVertices.length === 0) return null;

      const pts = validVertices.map(v => {
        updateBounds(v.x, v.y, 'POLYGON');
        const [x, y] = applyTransform(v.x, -v.y, currentTransforms);
        return `${round(x)},${round(y)}`;
      }).join(' ');

      return `<polygon points="${pts}" ${stroke} fill="none" />`;
    },

    HATCH: (e, color, stroke, currentTransforms) => {
      if (!Array.isArray(e.boundaryPaths) || e.boundaryPaths.length === 0) {
        console.warn('Invalid HATCH boundary paths');
        return null;
      }

      const paths = [];
      const lineWeight = normalizeStrokeWidth();

      for (const boundary of e.boundaryPaths) {
        if (Array.isArray(boundary.edges)) {
          let pathData = '';

          for (let i = 0; i < boundary.edges.length; i++) {
            const edge = boundary.edges[i];

            if (edge.type === 'line') {
              const [x1, y1] = applyTransform(edge.start.x, -edge.start.y, currentTransforms);
              const [x2, y2] = applyTransform(edge.end.x, -edge.end.y, currentTransforms);

              if (i === 0) pathData += `M ${round(x1)} ${round(y1)}`;
              pathData += ` L ${round(x2)} ${round(y2)}`;

              updateBounds(edge.start.x, edge.start.y, 'HATCH');
              updateBounds(edge.end.x, edge.end.y, 'HATCH');
            }
          }

          if (pathData) {
            pathData += ' Z';
            paths.push(`<path d="${pathData}" fill="rgba(${color.r},${color.g},${color.b},0.3)" ${stroke} stroke-width="${lineWeight}" />`);
          }
        }
      }

      return paths.join('\n');
    },

    TEXT: (e, color, stroke, currentTransforms) => entityHandlers.MTEXT(e, color, stroke, currentTransforms),
    MTEXT: (e, color, stroke, currentTransforms) => {
      if (!e.text || !(e.insert || e.insertionPoint)) {
        console.warn('Invalid TEXT:', e);
        return null;
      }

      const pt = e.insert || e.insertionPoint;
      if (!isValidPoint(pt)) return null;

      updateBounds(pt.x, pt.y, 'TEXT');
      const [x, y] = applyTransform(pt.x, -pt.y, currentTransforms);

      const fontSize = Math.max(8, e.height || e.textHeight || 12);
      const textContent = escapeXml(e.text);

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" font-family="Arial, sans-serif">${textContent}</text>`;
    },

    DIMENSION: (e, color, stroke, currentTransforms) => {
      // Process dimension entities instead of filtering them out
      const elements = [];

      // Dimension line
      if (e.dimensionLine && isValidPoint(e.dimensionLine.start) && isValidPoint(e.dimensionLine.end)) {
        const [x1, y1] = applyTransform(e.dimensionLine.start.x, -e.dimensionLine.start.y, currentTransforms);
        const [x2, y2] = applyTransform(e.dimensionLine.end.x, -e.dimensionLine.end.y, currentTransforms);

        updateBounds(e.dimensionLine.start.x, e.dimensionLine.start.y, 'DIMENSION');
        updateBounds(e.dimensionLine.end.x, e.dimensionLine.end.y, 'DIMENSION');

        elements.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke} />`);
      }

      // Extension lines
      if (e.extensionLines) {
        e.extensionLines.forEach(line => {
          if (isValidPoint(line.start) && isValidPoint(line.end)) {
            const [x1, y1] = applyTransform(line.start.x, -line.start.y, currentTransforms);
            const [x2, y2] = applyTransform(line.end.x, -line.end.y, currentTransforms);

            updateBounds(line.start.x, line.start.y, 'DIMENSION');
            updateBounds(line.end.x, line.end.y, 'DIMENSION');

            elements.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke} />`);
          }
        });
      }

      // Dimension text
      if (e.text && e.textPosition && isValidPoint(e.textPosition)) {
        const [x, y] = applyTransform(e.textPosition.x, -e.textPosition.y, currentTransforms);
        updateBounds(e.textPosition.x, e.textPosition.y, 'DIMENSION');

        const fontSize = Math.max(8, e.textHeight || 10);
        elements.push(`<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" font-family="Arial, sans-serif" text-anchor="middle">${escapeXml(e.text)}</text>`);
      }

      return elements.join('\n');
    },

    POINT: (e, color, stroke, currentTransforms) => {
      if (!isValidPoint(e.position)) {
        console.warn('Invalid POINT:', e);
        return null;
      }

      updateBounds(e.position.x, e.position.y, 'POINT');
      const [cx, cy] = applyTransform(e.position.x, -e.position.y, currentTransforms);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="2" fill="rgb(${color.r},${color.g},${color.b})" />`;
    },

    SPLINE: (e, color, stroke, currentTransforms) => {
      if (!Array.isArray(e.controlPoints) || e.controlPoints.length === 0) {
        console.warn('Invalid SPLINE controlPoints:', e.controlPoints);
        return null;
      }

      const validPoints = e.controlPoints.filter(isValidPoint);
      if (validPoints.length === 0) return null;

      validPoints.forEach(pt => updateBounds(pt.x, pt.y, 'SPLINE'));

      const d = validPoints.map((pt, i) => {
        const [x, y] = applyTransform(pt.x, -pt.y, currentTransforms);
        return `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`;
      }).join(' ');

      return `<path d="${d}" fill="none" ${stroke} />`;
    },

    INSERT: (e, color, stroke, currentTransforms) => {
      const blockName = e.blockName || e.name;    // INSERT entities name
      if (!blockName) {
        console.warn('INSERT block without name:', e);
        return null;
      }

      const blockEntities = blockDefinitions[blockName];
      // console.log("block entities:", blockEntities);
      if (!blockEntities || !Array.isArray(blockEntities)) {
        console.warn(`Block definition "${blockName}" not found`);
        return `<!-- INSERT: Block "${blockName}" not found -->`;
      }

      const insertPoint = e.insertionPoint || e.position || { x: 0, y: 0 };
      const Xscale = e.xScale || e.scaleFactors;
      const Yscale = e.yScale || e.scaleFactors;
      const rotation = e.rotation || 0;

      // Create transformation for this insert
      const insertTransform = {
        x: insertPoint.x,
        y: insertPoint.y,
        scaleX: Xscale,
        scaleY: Yscale,
        rotation: rotation
      };

      const newTransformStack = [...currentTransforms, insertTransform];

      const blockContent = processEntities(blockEntities, `INSERT.${blockName}`, newTransformStack);

      return blockContent.join('\n');
    }
  };

  // XML escaping utility
  const escapeXml = (text) => {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Main element generation function
  const generateElement = (e, color, stroke, source = 'unknown', currentTransforms = transformStack) => {
    if (!e || !e.type) return null;

    // Count entity types
    const key = `${e.type}(${source})`;
    entityStats[key] = (entityStats[key] || 0) + 1;

    const handler = entityHandlers[e.type];
    if (handler) {
      try {
        const result = handler(e, color, stroke, currentTransforms);
        if (result) processedElements++;
        return result;
      } catch (error) {
        console.warn(`Error processing ${e.type} from ${source}:`, error, e);
        return null;
      }
    }

    console.warn(`Unhandled entity: ${e.type} from ${source}`, e);
    return null;
  };

  // Process entities from a collection
  const processEntities = (entities, source = 'unknown', currentTransforms = transformStack) => {
    if (!Array.isArray(entities)) return [];

    const content = [];

    for (const e of entities) {
      if (!e || !e.type) continue;

      const color = e.color || { r: 0, g: 0, b: 0 };
      const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${normalizeStrokeWidth()}"`;

      const element = generateElement(e, color, stroke, source, currentTransforms);
      if (element) {
        content.push(element);
      }
    }

    return content;
  };

  // Generate SVG content from all relevant tables
  const generateSVGContent = () => {
    const content = [];

    // Process entities from MODEL_SPACE (main drawing space)
    // if (tables.MODEL_SPACE && tables.MODEL_SPACE.entities) {
    //   console.log(`Processing MODEL_SPACE with ${tables.MODEL_SPACE.entities.length} entities`);
    //   const modelSpaceContent = processEntities(tables.MODEL_SPACE.entities, 'MODEL_SPACE');
    //   content.push(...modelSpaceContent);
    // }

    // Process entities from ENTITIES table
    // if (tables.ENTITIES && tables.ENTITIES.entities) {
    //   console.log(`Processing ENTITIES with ${tables.ENTITIES.entities.length} entities`);
    //   const entitiesContent = processEntities(tables.ENTITIES.entities, 'ENTITIES');
    //   content.push(...entitiesContent);
    // }

    // Process BLOCK_RECORD entries
    if (tables.BLOCK_RECORD && tables.BLOCK_RECORD.entries) {
      console.log(`Processing BLOCK_RECORD with ${tables.BLOCK_RECORD.entries.length} entries`);

      for (const entry of tables.BLOCK_RECORD.entries) {
        if (entry.entities && Array.isArray(entry.entities)) {
          const entryName = entry.name || 'unnamed_block';
          const entryContent = processEntities(entry.entities, `BLOCK_RECORD.${entryName}`);
          content.push(...entryContent);
        }
      }
    }

    return content;
  };

  // Generate all SVG content
  const allContent = generateSVGContent();
  const svgContent = allContent.join('\n');

  // Enhanced debugging output
  console.log('Entity Statistics:', entityStats);
  console.log('Processed Blocks:', processedBlocks);
  console.log('Total Processed Elements:', processedElements);
  console.log('Raw Bounds:', bounds);

  // Set fallback bounds if no valid bounds found
  if (!bounds.valid || bounds.minX === Infinity) {
    console.warn('No valid bounds found, using fallback');
    Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  }

  // Calculate final dimensions
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  console.log(`Drawing dimensions: ${width} x ${height}`);

  // Adjust padding based on drawing size
  const padding = Math.max(width * 0.05, height * 0.05, 20);
  const viewBox = `${round(bounds.minX - padding)} ${round(bounds.minY - padding)} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

  console.log('ViewBox:', viewBox);

  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap: round; stroke-linejoin: round; background: white;">
  <!-- Processed Elements: ${processedElements} -->
  ${svgContent}
</svg>`;

  console.log('SVG Content Length:', svgContent.length);
  console.log('Final SVG generated successfully');

  return finalSvg;
}
