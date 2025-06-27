// export function convertToSvg(db) {
//   const entities = db.entities || [];
//   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//   let content = '';

//   const updateBounds = (x, y) => {
//     minX = Math.min(minX, x);
//     minY = Math.min(minY, y);
//     maxX = Math.max(maxX, x);
//     maxY = Math.max(maxY, y);
//   };

//   console.log("Full DB:", db);

//   for (const e of entities) {
//     const color = e.color || { r: 0, g: 0, b: 0 };

//     try {
//       if (e.type === 'LINE' && (e.start || e.startPoint) && (e.end || e.endPoint)) {
//         const start = e.start || e.startPoint;
//         const end = e.end || e.endPoint;
//         updateBounds(start.x, start.y);
//         updateBounds(end.x, end.y);
//         content += `<line x1="${start.x}" y1="${-start.y}" x2="${end.x}" y2="${-end.y}" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
//         const radius = Math.abs(e.radius);
//         if (radius <= 0) continue;
//         updateBounds(e.center.x - radius, e.center.y - radius);
//         updateBounds(e.center.x + radius, e.center.y + radius);
//         content += `<circle cx="${e.center.x}" cy="${-e.center.y}" r="${radius}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'TEXT' && e.insert && e.text) {
//         updateBounds(e.insert.x, e.insert.y);
//         content += `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="${e.height || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'MTEXT' && e.insertionPoint && e.text) {
//         const height = e.textHeight || 12;
//         updateBounds(e.insertionPoint.x, e.insertionPoint.y);
//         content += `<text x="${e.insertionPoint.x}" y="${-e.insertionPoint.y}" font-size="${height}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'ARC' && e.center && typeof e.radius === 'number') {
//         const { center, radius, startAngle, endAngle } = e;
//         const sx = center.x + radius * Math.cos(startAngle);
//         const sy = center.y + radius * Math.sin(startAngle);
//         const ex = center.x + radius * Math.cos(endAngle);
//         const ey = center.y + radius * Math.sin(endAngle);
//         updateBounds(sx, sy);
//         updateBounds(ex, ey);
//         const largeArc = (endAngle - startAngle) % (2 * Math.PI) > Math.PI ? 1 : 0;
//         content += `<path d="M ${sx} ${-sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${-ey}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'ELLIPSE' && e.center && e.majorAxisEndPoint) {
//         const rawRx = e.majorAxisEndPoint?.x ?? 0;
//         const rx = Math.abs(rawRx);
//         const ry = Math.abs((e.axisRatio || 1) * rawRx);
//         if (rx <= 0 || ry <= 0) continue;
//         updateBounds(e.center.x - rx, e.center.y - ry);
//         updateBounds(e.center.x + rx, e.center.y + ry);
//         content += `<ellipse cx="${e.center.x}" cy="${-e.center.y}" rx="${rx}" ry="${ry}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'POLYLINE' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => {
//           updateBounds(v.x, v.y);
//           return `${v.x},${-v.y}`;
//         }).join(' ');
//         content += `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'LWPOLYLINE' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => {
//           updateBounds(v.x, v.y);
//           return `${v.x},${-v.y}`;
//         }).join(' ');
//         content += `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="1"/>`;
//       }
//       else if (e.type === 'SOLID' && Array.isArray(e.points) && e.points.length === 4) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'POINT' && e.position) {
//         updateBounds(e.position.x, e.position.y);
//         content += `<circle cx="${e.position.x}" cy="${-e.position.y}" r="1.5" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'OLE2FRAME' && e.position) {
//         const width = 10, height = 10;
//         updateBounds(e.position.x, e.position.y);
//         content += `<rect x="${e.position.x}" y="${-e.position.y}" width="${width}" height="${height}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="2" />`;
//       }
//       else if (e.type === 'INSERT') {
//         console.log('DEBUG INSERT entity:', e);
//         console.log('Is db.blocks available?', Array.isArray(db.blocks), db.blocks);

//         if ((e.blockName || e.name) && Array.isArray(db.blocks)) {
//           const blockName = e.blockName || e.name;
//           const block = db.blocks.find(b => b.name === blockName);

//           if (!block) {
//             console.warn(`Block not found for INSERT: ${blockName}`, e);
//           }

//           if (block && block.entities) {
//             const pos = e.insert || e.insertionPoint || { x: 0, y: 0 };
//             const scaleX = e.xScale || 1;
//             const scaleY = e.yScale || 1;
//             const rotation = (e.rotation || 0) * (180 / Math.PI); // radians to degrees

//             const innerContent = block.entities.map(be => {
//               const cloned = { ...be };
//               if (cloned.start) cloned.start = { x: cloned.start.x + pos.x, y: cloned.start.y + pos.y };
//               if (cloned.end) cloned.end = { x: cloned.end.x + pos.x, y: cloned.end.y + pos.y };
//               if (cloned.center) cloned.center = { x: cloned.center.x + pos.x, y: cloned.center.y + pos.y };
//               if (cloned.insert) cloned.insert = { x: cloned.insert.x + pos.x, y: cloned.insert.y + pos.y };
//               if (cloned.insertionPoint) cloned.insertionPoint = { x: cloned.insertionPoint.x + pos.x, y: cloned.insertionPoint.y + pos.y };
//               if (cloned.vertices) cloned.vertices = cloned.vertices.map(v => ({ x: v.x + pos.x, y: v.y + pos.y }));

//               const nestedSvg = convertToSvg({ entities: [cloned], blocks: db.blocks });
//               return nestedSvg.slice(nestedSvg.indexOf('>') + 1, nestedSvg.lastIndexOf('<'));
//             }).join('');

//             const transform = `
//         translate(${pos.x}, ${-pos.y})
//         scale(${scaleX}, ${scaleY})
//         rotate(${-rotation})
//       `.trim();
//             content += `<g transform="${transform}">${innerContent}</g>`;
//           } else {
//             console.warn(`Block not found for INSERT: ${blockName}`);
//           }
//         } else {
//           console.warn(`INSERT entity skipped — missing blockName/name or invalid db.blocks`, e);
//         }
//       }
//       else if (e.type === 'HATCH' && Array.isArray(e.boundaryPaths)) {
//         e.boundaryPaths.forEach(boundary => {
//           if (boundary.type === 'POLYLINE' && Array.isArray(boundary.vertices)) {
//             const points = boundary.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//             content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" stroke="none" />`;
//           }
//         });
//       }
//       else {
//         console.warn(`Entity type not handled: ${e.type}`, e);
//       }
//     } catch (err) {
//       console.warn('Failed to render entity:', e, err);
//     }
//     console.log('Rendering entity type:', e.type);
//   }

//   const width = maxX - minX;
//   const height = maxY - minY;
//   const padding = 10;
//   const viewBox = `${minX - padding} ${-maxY - padding} ${width + padding * 2} ${height + padding * 2}`;
//   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
// }














// export function convertToSvg(db) {
//   const entities = db.entities || [];
//   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//   let content = '';

//   const updateBounds = (x, y) => {
//     minX = Math.min(minX, x);
//     minY = Math.min(minY, y);
//     maxX = Math.max(maxX, x);
//     maxY = Math.max(maxY, y);
//   };

//   const useUniformLineweight = true;

//   const normalizeStrokeWidth = (lw) => {
//     if (useUniformLineweight) return 1;
//     if (typeof lw !== 'number') return 1;
//     if (lw <= 0) return 0.5;
//     return Math.min(Math.max(lw / 10, 0.5), 3);
//   };

//   console.log("Full DB:", db);

//   for (const e of entities) {
//     const color = e.color || { r: 0, g: 0, b: 0 };

//     try {
//       if (e.type === 'LINE' && (e.start || e.startPoint) && (e.end || e.endPoint)) {
//         const start = e.start || e.startPoint;
//         const end = e.end || e.endPoint;
//         updateBounds(start.x, start.y);
//         updateBounds(end.x, end.y);
//         content += `<line x1="${start.x}" y1="${-start.y}" x2="${end.x}" y2="${-end.y}" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
//         const radius = Math.abs(e.radius);
//         if (radius <= 0) continue;
//         updateBounds(e.center.x - radius, e.center.y - radius);
//         updateBounds(e.center.x + radius, e.center.y + radius);
//         content += `<circle cx="${e.center.x}" cy="${-e.center.y}" r="${radius}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'TEXT' && e.insert && e.text) {
//         updateBounds(e.insert.x, e.insert.y);
//         content += `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="${e.height || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'MTEXT' && e.insertionPoint && e.text) {
//         const height = e.textHeight || 12;
//         updateBounds(e.insertionPoint.x, e.insertionPoint.y);
//         content += `<text x="${e.insertionPoint.x}" y="${-e.insertionPoint.y}" font-size="${height}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'ARC' && e.center && typeof e.radius === 'number') {
//         const { center, radius, startAngle, endAngle } = e;
//         const sx = center.x + radius * Math.cos(startAngle);
//         const sy = center.y + radius * Math.sin(startAngle);
//         const ex = center.x + radius * Math.cos(endAngle);
//         const ey = center.y + radius * Math.sin(endAngle);
//         updateBounds(sx, sy);
//         updateBounds(ex, ey);
//         const largeArc = (endAngle - startAngle) % (2 * Math.PI) > Math.PI ? 1 : 0;
//         content += `<path d="M ${sx} ${-sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${-ey}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'ELLIPSE' && e.center && e.majorAxisEndPoint) {
//         const rawRx = e.majorAxisEndPoint?.x ?? 0;
//         const rx = Math.abs(rawRx);
//         const ry = Math.abs((e.axisRatio || 1) * rawRx);
//         if (rx <= 0 || ry <= 0) continue;
//         updateBounds(e.center.x - rx, e.center.y - ry);
//         updateBounds(e.center.x + rx, e.center.y + ry);
//         content += `<ellipse cx="${e.center.x}" cy="${-e.center.y}" rx="${rx}" ry="${ry}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if ((e.type === 'POLYLINE' || e.type === 'LWPOLYLINE') && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => {
//           updateBounds(v.x, v.y);
//           return `${v.x},${-v.y}`;
//         }).join(' ');
//         content += `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'SOLID' && Array.isArray(e.points) && e.points.length === 4) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'POINT' && e.position) {
//         updateBounds(e.position.x, e.position.y);
//         content += `<circle cx="${e.position.x}" cy="${-e.position.y}" r="1.5" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'OLE2FRAME' && e.position) {
//         const width = 10, height = 10;
//         updateBounds(e.position.x, e.position.y);
//         content += `<rect x="${e.position.x}" y="${-e.position.y}" width="${width}" height="${height}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="2" />`;
//       }
//       else if (e.type === 'SPLINE' && Array.isArray(e.controlPoints)) {
//         const d = e.controlPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${-pt.y}`).join(' ');
//         e.controlPoints.forEach(pt => updateBounds(pt.x, pt.y));
//         content += `<path d="${d}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}" />`;
//       }
//       else if (e.type === 'DIMENSION' && e.textMidPoint && e.text) {
//         updateBounds(e.textMidPoint.x, e.textMidPoint.y);
//         content += `<text x="${e.textMidPoint.x}" y="${-e.textMidPoint.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === '3DFACE' && Array.isArray(e.points)) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         content += `<polygon points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'REGION' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         content += `<polygon points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if ((e.type === 'ATTRIB' || e.type === 'ATTDEF') && e.text && e.insert) {
//         updateBounds(e.insert.x, e.insert.y);
//         content += `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'LEADER' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//         e.vertices.forEach(v => updateBounds(v.x, v.y));
//         content += `<polyline points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'MLEADER' && Array.isArray(e.leaderLines)) {
//         e.leaderLines.forEach(line => {
//           const points = line.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//           line.vertices.forEach(v => updateBounds(v.x, v.y));
//           content += `<polyline points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//         });
//         if (e.text && e.textPosition) {
//           updateBounds(e.textPosition.x, e.textPosition.y);
//           content += `<text x="${e.textPosition.x}" y="${-e.textPosition.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//         }
//       }
//       else if (e.type === 'IMAGE' && e.insert && e.imageURL) {
//         const { x, y } = e.insert;
//         const width = e.uVector?.x || 100;
//         const height = e.vVector?.y || 100;
//         updateBounds(x, y);
//         content += `<image href="${e.imageURL}" x="${x}" y="${-y}" width="${width}" height="${height}" />`;
//       }
//       else if ((e.type === 'RAY' || e.type === 'XLINE') && e.basePoint && e.direction) {
//         const len = 10000; // arbitrary long line
//         const end = {
//           x: e.basePoint.x + e.direction.x * len,
//           y: e.basePoint.y + e.direction.y * len,
//         };
//         updateBounds(e.basePoint.x, e.basePoint.y);
//         updateBounds(end.x, end.y);
//         content += `<line x1="${e.basePoint.x}" y1="${-e.basePoint.y}" x2="${end.x}" y2="${-end.y}" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="5,5" strokeWidth="0.5" />`;
//       }
//       else if (e.type === 'TRACE' && Array.isArray(e.points) && e.points.length === 4) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'WIPEOUT' && e.insert && e.uVector && e.vVector) {
//         const { x, y } = e.insert;
//         const width = e.uVector.x;
//         const height = e.vVector.y;
//         updateBounds(x, y);
//         content += `<rect x="${x}" y="${-y}" width="${width}" height="${height}" fill="white" opacity="0.7"/>`;
//       }
// else if (e.type === 'INSERT') {
//   console.log('DEBUG INSERT entity:', e);
//   console.log('Is db.blocks available?', Array.isArray(db.blocks), db.blocks);

//   if ((e.blockName || e.name) && Array.isArray(db.blocks)) {
//     const blockName = e.blockName || e.name;
//     const block = db.blocks.find(b => b.name === blockName);

//     if (!block) {
//       console.warn(`Block not found for INSERT: ${blockName}`, e);
//     }

//     if (block && block.entities) {
//       const pos = e.insert || e.insertionPoint || { x: 0, y: 0 };
//       const scaleX = e.xScale || 1;
//       const scaleY = e.yScale || 1;
//       const rotation = (e.rotation || 0) * (180 / Math.PI);

//       const innerContent = block.entities.map(be => {
//         const cloned = { ...be };
//         if (cloned.start) cloned.start = { x: cloned.start.x + pos.x, y: cloned.start.y + pos.y };
//         if (cloned.end) cloned.end = { x: cloned.end.x + pos.x, y: cloned.end.y + pos.y };
//         if (cloned.center) cloned.center = { x: cloned.center.x + pos.x, y: cloned.center.y + pos.y };
//         if (cloned.insert) cloned.insert = { x: cloned.insert.x + pos.x, y: cloned.insert.y + pos.y };
//         if (cloned.insertionPoint) cloned.insertionPoint = { x: cloned.insertionPoint.x + pos.x, y: cloned.insertionPoint.y + pos.y };
//         if (cloned.vertices) cloned.vertices = cloned.vertices.map(v => ({ x: v.x + pos.x, y: v.y + pos.y }));

//         const nestedSvg = convertToSvg({ entities: [cloned], blocks: db.blocks });
//         return nestedSvg.slice(nestedSvg.indexOf('>') + 1, nestedSvg.lastIndexOf('<'));
//       }).join('');

//       const transform = `
//         translate(${pos.x}, ${-pos.y})
//         scale(${scaleX}, ${scaleY})
//         rotate(${-rotation})
//       `.trim();

//       content += `<g transform="${transform}">${innerContent}</g>`;
//     } else {
//       console.warn(`Block not found for INSERT: ${blockName}`);
//     }
//   } else {
//     console.warn(`INSERT entity skipped — missing blockName/name or invalid db.blocks`, e);
//   }
// }
// else if (e.type === 'HATCH' && Array.isArray(e.boundaryPaths)) {
//   e.boundaryPaths.forEach(boundary => {
//     if (boundary.type === 'POLYLINE' && Array.isArray(boundary.vertices)) {
//       const points = boundary.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//       content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" stroke="none" />`;
//     }
//   });
// }
//       else {
//         console.warn(`Entity type not handled: ${e.type}`, e);
//       }
//     } catch (err) {
//       console.warn('Failed to render entity:', e, err);
//     }
//     console.log('Rendering entity type:', e.type);
//   }

//   const width = maxX - minX;
//   const height = maxY - minY;
//   const padding = 10;
//   const viewBox = `${minX - padding} ${-maxY - padding} ${width + padding * 2} ${height + padding * 2}`;
//   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
// }













// export function convertToSvg(db) {
//   const entities = db.entities || [];
//   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//   let groupedContent = '';

//   const updateBounds = (x, y) => {
//     minX = Math.min(minX, x);
//     minY = Math.min(minY, y);
//     maxX = Math.max(maxX, x);
//     maxY = Math.max(maxY, y);
//   };

//   const useUniformLineweight = true;
//   const uniformStrokeWidth = 0.2; // Consistent stroke width for all entities

//   const normalizeStrokeWidth = (lw) => {
//     if (useUniformLineweight) return uniformStrokeWidth;
//     if (typeof lw !== 'number') return uniformStrokeWidth;
//     if (lw <= 0) return 0.8;
//     return Math.min(Math.max(lw / 10, 0.8), 3);
//   };

//   // Helper function to round coordinates to avoid precision gaps
//   const roundCoord = (value) => {
//     return Math.round(value * 1000) / 1000; // Round to 3 decimal places
//   };

//   // Helper function to create a group for each entity
//   const createEntityGroup = (entityType, entityContent, entityIndex, additionalAttributes = {}) => {
//     const baseAttributes = {
//       'data-entity-type': entityType,
//       'data-entity-index': entityIndex,
//       'class': `entity-${entityType.toLowerCase()}`
//     };

//     const allAttributes = { ...baseAttributes, ...additionalAttributes };
//     const attributeString = Object.entries(allAttributes)
//       .map(([key, value]) => `${key}="${value}"`)
//       .join(' ');

//     return `<g ${attributeString}>${entityContent}</g>`;
//   };

//   console.log("Full DB:", db);

//   entities.forEach((e, index) => {
//     const color = e.color || { r: 0, g: 0, b: 0 };
//     let entityContent = '';

//     try {
//       if (e.type === 'LINE' && (e.start || e.startPoint) && (e.end || e.endPoint)) {
//         const start = e.start || e.startPoint;
//         const end = e.end || e.endPoint;
//         const x1 = roundCoord(start.x);
//         const y1 = roundCoord(start.y);
//         const x2 = roundCoord(end.x);
//         const y2 = roundCoord(end.y);
//         updateBounds(x1, y1);
//         updateBounds(x2, y2);
//         entityContent = `<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}" stroke-linecap="round" stroke-linejoin="round"/>`;
//       }
//       else if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
//         const radius = Math.abs(e.radius);
//         if (radius <= 0) return;
//         const cx = roundCoord(e.center.x);
//         const cy = roundCoord(e.center.y);
//         updateBounds(cx - radius, cy - radius);
//         updateBounds(cx + radius, cy + radius);
//         entityContent = `<circle cx="${cx}" cy="${-cy}" r="${radius}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}" stroke-linecap="round"/>`;
//       }
//       else if (e.type === 'TEXT' && e.insert && e.text) {
//         updateBounds(e.insert.x, e.insert.y);
//         entityContent = `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="${e.height || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'MTEXT' && e.insertionPoint && e.text) {
//         const height = e.textHeight || 12;
//         updateBounds(e.insertionPoint.x, e.insertionPoint.y);
//         entityContent = `<text x="${e.insertionPoint.x}" y="${-e.insertionPoint.y}" font-size="${height}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'ARC' && e.center && typeof e.radius === 'number') {
//         const { center, radius, startAngle, endAngle } = e;
//         const sx = center.x + radius * Math.cos(startAngle);
//         const sy = center.y + radius * Math.sin(startAngle);
//         const ex = center.x + radius * Math.cos(endAngle);
//         const ey = center.y + radius * Math.sin(endAngle);
//         updateBounds(sx, sy);
//         updateBounds(ex, ey);
//         const largeArc = (endAngle - startAngle) % (2 * Math.PI) > Math.PI ? 1 : 0;
//         entityContent = `<path d="M ${sx} ${-sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${-ey}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'ELLIPSE' && e.center && e.majorAxisEndPoint) {
//         const rawRx = e.majorAxisEndPoint?.x ?? 0;
//         const rx = Math.abs(rawRx);
//         const ry = Math.abs((e.axisRatio || 1) * rawRx);
//         if (rx <= 0 || ry <= 0) return;
//         updateBounds(e.center.x - rx, e.center.y - ry);
//         updateBounds(e.center.x + rx, e.center.y + ry);
//         entityContent = `<ellipse cx="${e.center.x}" cy="${-e.center.y}" rx="${rx}" ry="${ry}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if ((e.type === 'POLYLINE' || e.type === 'LWPOLYLINE') && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => {
//           const x = roundCoord(v.x);
//           const y = roundCoord(v.y);
//           updateBounds(x, y);
//           return `${x},${-y}`;
//         }).join(' ');
//         entityContent = `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}" stroke-linecap="ro  und" stroke-linejoin="round"/>`;
//       }
//       else if (e.type === 'SOLID' && Array.isArray(e.points) && e.points.length === 4) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         entityContent = `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'POINT' && e.position) {
//         updateBounds(e.position.x, e.position.y);
//         entityContent = `<circle cx="${e.position.x}" cy="${-e.position.y}" r="1.5" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'OLE2FRAME' && e.position) {
//         const width = 10, height = 10;
//         updateBounds(e.position.x, e.position.y);
//         entityContent = `<rect x="${e.position.x}" y="${-e.position.y}" width="${width}" height="${height}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="2" />`;
//       }
//       else if (e.type === 'SPLINE' && Array.isArray(e.controlPoints)) {
//         const d = e.controlPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${-pt.y}`).join(' ');
//         e.controlPoints.forEach(pt => updateBounds(pt.x, pt.y));
//         entityContent = `<path d="${d}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" strokeWidth="${normalizeStrokeWidth(e.lineweight)}" />`;
//       }
//       else if (e.type === 'DIMENSION' && e.textMidPoint && e.text) {
//         updateBounds(e.textMidPoint.x, e.textMidPoint.y);
//         entityContent = `<text x="${e.textMidPoint.x}" y="${-e.textMidPoint.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === '3DFACE' && Array.isArray(e.points)) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         entityContent = `<polygon points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'REGION' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         entityContent = `<polygon points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if ((e.type === 'ATTRIB' || e.type === 'ATTDEF') && e.text && e.insert) {
//         updateBounds(e.insert.x, e.insert.y);
//         entityContent = `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//       }
//       else if (e.type === 'LEADER' && Array.isArray(e.vertices)) {
//         const points = e.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//         e.vertices.forEach(v => updateBounds(v.x, v.y));
//         entityContent = `<polyline points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//       }
//       else if (e.type === 'MLEADER' && Array.isArray(e.leaderLines)) {
//         let mleaderContent = '';
//         e.leaderLines.forEach(line => {
//           const points = line.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//           line.vertices.forEach(v => updateBounds(v.x, v.y));
//           mleaderContent += `<polyline points="${points}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`;
//         });
//         if (e.text && e.textPosition) {
//           updateBounds(e.textPosition.x, e.textPosition.y);
//           mleaderContent += `<text x="${e.textPosition.x}" y="${-e.textPosition.y}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
//         }
//         entityContent = mleaderContent;
//       }
//       else if (e.type === 'IMAGE' && e.insert && e.imageURL) {
//         const { x, y } = e.insert;
//         const width = e.uVector?.x || 100;
//         const height = e.vVector?.y || 100;
//         updateBounds(x, y);
//         entityContent = `<image href="${e.imageURL}" x="${x}" y="${-y}" width="${width}" height="${height}" />`;
//       }
//       else if ((e.type === 'RAY' || e.type === 'XLINE') && e.basePoint && e.direction) {
//         const len = 10000; // arbitrary long line
//         const end = {
//           x: e.basePoint.x + e.direction.x * len,
//           y: e.basePoint.y + e.direction.y * len,
//         };
//         updateBounds(e.basePoint.x, e.basePoint.y);
//         updateBounds(end.x, end.y);
//         entityContent = `<line x1="${e.basePoint.x}" y1="${-e.basePoint.y}" x2="${end.x}" y2="${-end.y}" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="5,5" strokeWidth="0.5" />`;
//       }
//       else if (e.type === 'TRACE' && Array.isArray(e.points) && e.points.length === 4) {
//         const points = e.points.map(p => {
//           updateBounds(p.x, p.y);
//           return `${p.x},${-p.y}`;
//         }).join(' ');
//         entityContent = `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
//       }
//       else if (e.type === 'WIPEOUT' && e.insert && e.uVector && e.vVector) {
//         const { x, y } = e.insert;
//         const width = e.uVector.x;
//         const height = e.vVector.y;
//         updateBounds(x, y);
//         entityContent = `<rect x="${x}" y="${-y}" width="${width}" height="${height}" fill="white" opacity="0.7"/>`;
//       }
//       else if (e.type === 'INSERT') {
//         console.log('DEBUG INSERT entity:', e);
//         console.log('Is db.blocks available?', Array.isArray(db.blocks), db.blocks);

//         if ((e.blockName || e.name) && Array.isArray(db.blocks)) {
//           const blockName = e.blockName || e.name;
//           const block = db.blocks.find(b => b.name === blockName);

//           if (!block) {
//             console.warn(`Block not found for INSERT: ${blockName}`, e);
//           }

//           if (block && block.entities) {
//             const pos = e.insert || e.insertionPoint || { x: 0, y: 0 };
//             const scaleX = e.xScale || 1;
//             const scaleY = e.yScale || 1;
//             const rotation = (e.rotation || 0) * (180 / Math.PI);

//             const innerContent = block.entities.map(be => {
//               const cloned = { ...be };
//               if (cloned.start) cloned.start = { x: cloned.start.x + pos.x, y: cloned.start.y + pos.y };
//               if (cloned.end) cloned.end = { x: cloned.end.x + pos.x, y: cloned.end.y + pos.y };
//               if (cloned.center) cloned.center = { x: cloned.center.x + pos.x, y: cloned.center.y + pos.y };
//               if (cloned.insert) cloned.insert = { x: cloned.insert.x + pos.x, y: cloned.insert.y + pos.y };
//               if (cloned.insertionPoint) cloned.insertionPoint = { x: cloned.insertionPoint.x + pos.x, y: cloned.insertionPoint.y + pos.y };
//               if (cloned.vertices) cloned.vertices = cloned.vertices.map(v => ({ x: v.x + pos.x, y: v.y + pos.y }));

//               const nestedSvg = convertToSvg({ entities: [cloned], blocks: db.blocks });
//               return nestedSvg.slice(nestedSvg.indexOf('>') + 1, nestedSvg.lastIndexOf('<'));
//             }).join('');

//             const transform = `
//               translate(${pos.x}, ${-pos.y})
//               scale(${scaleX}, ${scaleY})
//               rotate(${-rotation})
//             `.trim();

//             entityContent = `<g transform="${transform}" data-block-name="${blockName}">${innerContent}</g>`;
//           } else {
//             console.warn(`Block not found for INSERT: ${blockName}`);
//           }
//         } else {
//           console.warn(`INSERT entity skipped — missing blockName/name or invalid db.blocks`, e);
//         }
//       }
//       else if (e.type === 'HATCH' && Array.isArray(e.boundaryPaths)) {
//         let hatchContent = '';
//         e.boundaryPaths.forEach(boundary => {
//           if (boundary.type === 'POLYLINE' && Array.isArray(boundary.vertices)) {
//             const points = boundary.vertices.map(v => `${v.x},${-v.y}`).join(' ');
//             boundary.vertices.forEach(v => updateBounds(v.x, v.y));
//             hatchContent += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" stroke="none" />`;
//           }
//         });
//         entityContent = hatchContent;
//       }
//       else {
//         console.warn(`Entity type not handled: ${e.type}`, e);
//         return; // Skip creating group for unhandled entities
//       }

//       // Create additional attributes for the group
//       const additionalAttributes = {};
//       if (e.layer) additionalAttributes['data-layer'] = e.layer;
//       if (e.handle) additionalAttributes['data-handle'] = e.handle;
//       if (e.lineweight) additionalAttributes['data-lineweight'] = e.lineweight;
//       if (color.r !== 0 || color.g !== 0 || color.b !== 0) {
//         additionalAttributes['data-color'] = `rgb(${color.r},${color.g},${color.b})`;
//       }

//       // Add the entity content wrapped in a group
//       if (entityContent) {
//         groupedContent += createEntityGroup(e.type, entityContent, index, additionalAttributes);
//       }

//     } catch (err) {
//       console.warn('Failed to render entity:', e, err);
//     }
//     console.log('Rendering entity type:', e.type);
//   });

//   const width = maxX - minX;
//   const height = maxY - minY;
//   const padding = 10;
//   const viewBox = `${minX - padding} ${-maxY - padding} ${width + padding * 2} ${height + padding * 2}`;

//   // Add CSS for consistent rendering
//   const styles = `
//     <style>
//       .svg-content { 
//         shape-rendering: geometricPrecision; 
//         vector-effect: non-scaling-stroke;
//       }
//       .entity-line line { 
//         stroke-linecap: round; 
//         stroke-linejoin: round; 
//       }
//       .entity-polyline polyline, 
//       .entity-lwpolyline polyline { 
//         stroke-linecap: round; 
//         stroke-linejoin: round; 
//       }
//     </style>
//   `;

//   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${styles}<g class="svg-content">${groupedContent}</g></svg>`;
// }

// // Additional helper function to extract specific entity types
// export function getEntitiesByType(svgString, entityType) {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(svgString, 'image/svg+xml');
//   const groups = doc.querySelectorAll(`g[data-entity-type="${entityType}"]`);
//   return Array.from(groups);
// }

// // Helper function to get all entity groups
// export function getAllEntityGroups(svgString) {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(svgString, 'image/svg+xml');
//   const groups = doc.querySelectorAll('g[data-entity-type]');
//   return Array.from(groups);
// }












export function convertToSvg(db) {
  const entities = db.entities || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const layers = {}; 

  const updateBounds = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  const round = (num) => Math.round(num * 1000) / 1000;

  const appendToLayer = (layer, element) => {
    const key = layer || 'default';
    if (!layers[key]) layers[key] = '';
    layers[key] += element;
  };

  const normalizeStrokeWidth = () => 0.5; 

  for (const e of entities) {
    const color = e.color || { r: 0, g: 0, b: 0 };
    const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth()}"`;
    const layer = e.layer;

    try {
      if (e.type === 'LINE' && (e.start || e.startPoint) && (e.end || e.endPoint)) {
        const start = e.start || e.startPoint;
        const end = e.end || e.endPoint;
        updateBounds(start.x, start.y);
        updateBounds(end.x, end.y);
        appendToLayer(layer, `<line x1="${round(start.x)}" y1="${-round(start.y)}" x2="${round(end.x)}" y2="${-round(end.y)}" stroke="rgb(${color.r},${color.g},${color.b})" strokeWidth="${normalizeStrokeWidth(e.lineweight)}"/>`);
      }

      else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
        if (!Array.isArray(e.vertices)) continue;
        e.vertices.forEach(v => updateBounds(v.x, v.y));
        const points = e.vertices.map(v => `${round(v.x)},${-round(v.y)}`).join(' ');
        if (e.closed || e.isClosed) {
          appendToLayer(layer, `<polyline points="${points}" fill="none" ${stroke} />`);
        } else {
          appendToLayer(layer, `<polygon points="${points}" fill="none" ${stroke} />`);
        }
      }

      else if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
        const { x, y } = e.center;
        const r = Math.abs(e.radius);
        updateBounds(x - r, y - r);
        updateBounds(x + r, y + r);
        appendToLayer(layer, `<circle cx="${round(x)}" cy="${-round(y)}" r="${round(r)}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'ELLIPSE' && e.center && e.majorAxisEndPoint) {
        const { x, y } = e.center;
        const rx = Math.abs(e.majorAxisEndPoint.x);
        const ry = Math.abs((e.axisRatio || 1) * e.majorAxisEndPoint.x);
        updateBounds(x - rx, y - ry);
        updateBounds(x + rx, y + ry);
        appendToLayer(layer, `<ellipse cx="${round(x)}" cy="${-round(y)}" rx="${round(rx)}" ry="${round(ry)}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'ARC' && e.center && typeof e.radius === 'number') {
        const { center, radius, startAngle, endAngle } = e;
        const sx = center.x + radius * Math.cos(startAngle);
        const sy = center.y + radius * Math.sin(startAngle);
        const ex = center.x + radius * Math.cos(endAngle);
        const ey = center.y + radius * Math.sin(endAngle);
        updateBounds(sx, sy);
        updateBounds(ex, ey);
        const largeArc = (endAngle - startAngle) % (2 * Math.PI) > Math.PI ? 1 : 0;
        appendToLayer(layer, `<path d="M ${round(sx)} ${-round(sy)} A ${round(radius)} ${round(radius)} 0 ${largeArc} 0 ${round(ex)} ${-round(ey)}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'SOLID' && Array.isArray(e.points) && e.points.length === 4) {
        const points = e.points.map(p => {
          updateBounds(p.x, p.y);
          return `${round(p.x)},${-round(p.y)}`;
        }).join(' ');
        appendToLayer(layer, `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`);
      }

      else if (e.type === 'TEXT' && e.insert && e.text) {
        updateBounds(e.insert.x, e.insert.y);
        appendToLayer(layer, `<text x="${round(e.insert.x)}" y="${-round(e.insert.y)}" font-size="${e.height || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`);
      }

      else if (e.type === 'MTEXT' && e.insertionPoint && e.text) {
        updateBounds(e.insertionPoint.x, e.insertionPoint.y);
        appendToLayer(layer, `<text x="${round(e.insertionPoint.x)}" y="${-round(e.insertionPoint.y)}" font-size="${e.textHeight || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`);
      }

      else if (e.type === 'HATCH' && Array.isArray(e.boundaryPaths)) {
        e.boundaryPaths.forEach(boundary => {
          if (boundary.type === 'POLYLINE' && Array.isArray(boundary.vertices)) {
            const points = boundary.vertices.map(v => {
              updateBounds(v.x, v.y);
              return `${round(v.x)},${-round(v.y)}`;
            }).join(' ');
            appendToLayer(layer, `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" stroke="none" />`);
          }
        });
      }

      else if (e.type === 'POINT' && e.position) {
        updateBounds(e.position.x, e.position.y);
        appendToLayer(layer, `<circle cx="${round(e.position.x)}" cy="${-round(e.position.y)}" r="1.5" fill="rgb(${color.r},${color.g},${color.b})" />`);
      }

      else if (e.type === 'OLE2FRAME' && e.position) {
        const width = 10, height = 10;
        updateBounds(e.position.x, e.position.y);
        appendToLayer(layer, `<rect x="${round(e.position.x)}" y="${-round(e.position.y)}" width="${width}" height="${height}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="2" />`);
      }

      else if (e.type === 'SPLINE' && Array.isArray(e.controlPoints)) {
        e.controlPoints.forEach(pt => updateBounds(pt.x, pt.y));
        const d = e.controlPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${round(pt.x)} ${-round(pt.y)}`).join(' ');
        appendToLayer(layer, `<path d="${d}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'DIMENSION' && e.textMidPoint && e.text) {
        updateBounds(e.textMidPoint.x, e.textMidPoint.y);
        appendToLayer(layer, `<text x="${round(e.textMidPoint.x)}" y="${-round(e.textMidPoint.y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`);
      }

      else if (e.type === '3DFACE' && Array.isArray(e.points)) {
        const points = e.points.map(p => {
          updateBounds(p.x, p.y);
          return `${round(p.x)},${-round(p.y)}`;
        }).join(' ');
        appendToLayer(layer, `<polygon points="${points}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'REGION' && Array.isArray(e.vertices)) {
        const points = e.vertices.map(p => {
          updateBounds(p.x, p.y);
          return `${round(p.x)},${-round(p.y)}`;
        }).join(' ');
        appendToLayer(layer, `<polygon points="${points}" fill="none" ${stroke} />`);
      }

      else if ((e.type === 'ATTRIB' || e.type === 'ATTDEF') && e.text && e.insert) {
        updateBounds(e.insert.x, e.insert.y);
        appendToLayer(layer, `<text x="${round(e.insert.x)}" y="${-round(e.insert.y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`);
      }

      else if (e.type === 'LEADER' && Array.isArray(e.vertices)) {
        e.vertices.forEach(v => updateBounds(v.x, v.y));
        const points = e.vertices.map(v => `${round(v.x)},${-round(v.y)}`).join(' ');
        appendToLayer(layer, `<polyline points="${points}" fill="none" ${stroke} />`);
      }

      else if (e.type === 'MLEADER' && Array.isArray(e.leaderLines)) {
        e.leaderLines.forEach(line => {
          line.vertices.forEach(v => updateBounds(v.x, v.y));
          const points = line.vertices.map(v => `${round(v.x)},${-round(v.y)}`).join(' ');
          appendToLayer(layer, `<polyline points="${points}" fill="none" ${stroke} />`);
        });
        if (e.text && e.textPosition) {
          updateBounds(e.textPosition.x, e.textPosition.y);
          appendToLayer(layer, `<text x="${round(e.textPosition.x)}" y="${-round(e.textPosition.y)}" font-size="12" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`);
        }
      }

      else if (e.type === 'IMAGE' && e.insert && e.imageURL) {
        const { x, y } = e.insert;
        const width = e.uVector?.x || 100;
        const height = e.vVector?.y || 100;
        updateBounds(x, y);
        appendToLayer(layer, `<image href="${e.imageURL}" x="${round(x)}" y="${-round(y)}" width="${round(width)}" height="${round(height)}" />`);
      }

      else if ((e.type === 'RAY' || e.type === 'XLINE') && e.basePoint && e.direction) {
        const len = 10000;
        const end = {
          x: e.basePoint.x + e.direction.x * len,
          y: e.basePoint.y + e.direction.y * len,
        };
        updateBounds(e.basePoint.x, e.basePoint.y);
        updateBounds(end.x, end.y);
        appendToLayer(layer, `<line x1="${round(e.basePoint.x)}" y1="${-round(e.basePoint.y)}" x2="${round(end.x)}" y2="${-round(end.y)}" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="5,5" strokeWidth="0.5" />`);
      }

      else if (e.type === 'TRACE' && Array.isArray(e.points) && e.points.length === 4) {
        const points = e.points.map(p => {
          updateBounds(p.x, p.y);
          return `${round(p.x)},${-round(p.y)}`;
        }).join(' ');
        appendToLayer(layer, `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`);
      }

      else if (e.type === 'WIPEOUT' && e.insert && e.uVector && e.vVector) {
        const { x, y } = e.insert;
        const width = e.uVector.x;
        const height = e.vVector.y;
        updateBounds(x, y);
        appendToLayer(layer, `<rect x="${round(x)}" y="${-round(y)}" width="${round(width)}" height="${round(height)}" fill="white" opacity="0.7"/>`);
      }

      else if (e.type === 'INSERT') {
        if ((e.blockName || e.name) && Array.isArray(db.blocks)) {
          const blockName = e.blockName || e.name;
          const block = db.blocks.find(b => b.name === blockName);
          if (block && block.entities) {
            const pos = e.insert || e.insertionPoint || { x: 0, y: 0 };
            const scaleX = e.xScale || 1;
            const scaleY = e.yScale || 1;
            const rotation = (e.rotation || 0) * (180 / Math.PI);

            const innerContent = block.entities.map(be => {
              const cloned = { ...be };
              if (cloned.start) cloned.start = { x: cloned.start.x + pos.x, y: cloned.start.y + pos.y };
              if (cloned.end) cloned.end = { x: cloned.end.x + pos.x, y: cloned.end.y + pos.y };
              if (cloned.center) cloned.center = { x: cloned.center.x + pos.x, y: cloned.center.y + pos.y };
              if (cloned.insert) cloned.insert = { x: cloned.insert.x + pos.x, y: cloned.insert.y + pos.y };
              if (cloned.insertionPoint) cloned.insertionPoint = { x: cloned.insertionPoint.x + pos.x, y: cloned.insertionPoint.y + pos.y };
              if (cloned.vertices) cloned.vertices = cloned.vertices.map(v => ({ x: v.x + pos.x, y: v.y + pos.y }));
              return convertToSvg({ entities: [cloned], blocks: db.blocks }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
            }).join('');

            const transform = `translate(${round(pos.x)}, ${-round(pos.y)}) scale(${scaleX}, ${scaleY}) rotate(${-round(rotation)})`;
            appendToLayer(layer, `<g transform="${transform}">${innerContent}</g>`);
          } else {
            console.warn(`Block not found for INSERT: ${blockName}`, e);
          }
        } else {
          console.warn(`INSERT entity skipped — missing blockName/name or invalid db.blocks`, e);
        }
      }
      else {
        console.warn(`Unhandled entity: ${e.type}`, e);
      }
    } catch (err) {
      console.warn('Failed to render entity:', e, err);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = 10;
  const viewBox = `${round(minX - padding)} ${-round(maxY + padding)} ${round(width + padding * 2)} ${round(height + padding * 2)}`;

  const groupedContent = Object.entries(layers).map(([layer, elements]) => {
    return `<g data-layer="${layer}">${elements}</g>`;
  }).join('\n');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap: round; stroke-linejoin: round;">
  <style>
    text { dominant-baseline: middle; font-family: Arial, sans-serif; }
  </style>
  ${groupedContent}
</svg>
`.trim();
}
