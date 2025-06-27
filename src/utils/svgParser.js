// import { v4 as uuidv4 } from 'uuid';

// export const parseSvgContent = (svgString) => {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(svgString, 'image/svg+xml');
//   const svgElement = doc.querySelector('svg');

//   if (!svgElement) {
//     console.error('Invalid SVG content');
//     return { elements: [], viewBox: '0 0 800 600' };
//   }

//   const viewBox = svgElement.getAttribute('viewBox') || '0 0 800 600';
//   const elements = [];

//   // Parse groups with layers
//   const groups = svgElement.querySelectorAll('g[data-layer]');

//   groups.forEach((group) => {
//     const layer = group.getAttribute('data-layer');
//     const children = Array.from(group.children);

//     children.forEach((child) => {
//       const element = parseElement(child, layer);
//       if (element) {
//         elements.push(element);
//       }
//     });
//   });

//   // Also parse direct children of SVG (elements without layers)
//   const directChildren = Array.from(svgElement.children).filter(
//     child => child.tagName !== 'g' && child.tagName !== 'style' && child.tagName !== 'defs'
//   );

//   directChildren.forEach((child) => {
//     const element = parseElement(child, 'default');
//     if (element) {
//       elements.push(element);
//     }
//   });

//   console.log('Parsed SVG elements:', elements, 'ViewBox:', viewBox);

//   return { elements, viewBox };
// };

// const parseElement = (domElement, layer) => {
//   const tagName = domElement.tagName.toLowerCase();
//   const attributes = getElementAttributes(domElement);

//   // Handle text content for text elements
//   if (tagName === 'text') {
//     attributes.textContent = domElement.textContent || '';
//   }

//   return {
//     id: uuidv4(),
//     type: tagName,
//     layer: layer || 'default',
//     attributes,
//     bounds: calculateElementBounds(tagName, attributes)
//   };
// };

// const getElementAttributes = (element) => {
//   const attrs = {};
//   for (let i = 0; i < element.attributes.length; i++) {
//     const attr = element.attributes[i];
//     attrs[attr.name] = attr.value;
//   }
//   return attrs;
// };

// const calculateElementBounds = (type, attributes) => {
//   let bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

//   try {
//     switch (type) {
//       case 'line':
//         const x1 = parseFloat(attributes.x1 || 0);
//         const y1 = parseFloat(attributes.y1 || 0);
//         const x2 = parseFloat(attributes.x2 || 0);
//         const y2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(x1, x2),
//           minY: Math.min(y1, y2),
//           maxX: Math.max(x1, x2),
//           maxY: Math.max(y1, y2)
//         };
//         break;

//       case 'circle':
//         const cx = parseFloat(attributes.cx || 0);
//         const cy = parseFloat(attributes.cy || 0);
//         const r = parseFloat(attributes.r || 0);
//         bounds = {
//           minX: cx - r,
//           minY: cy - r,
//           maxX: cx + r,
//           maxY: cy + r
//         };
//         break;

//       case 'ellipse':
//         const ecx = parseFloat(attributes.cx || 0);
//         const ecy = parseFloat(attributes.cy || 0);
//         const rx = parseFloat(attributes.rx || 0);
//         const ry = parseFloat(attributes.ry || 0);
//         bounds = {
//           minX: ecx - rx,
//           minY: ecy - ry,
//           maxX: ecx + rx,
//           maxY: ecy + ry
//         };
//         break;

//       case 'lwpolyline':
//       case 'polyline':
//         if (attributes.points) {
//           const points = parsePoints(attributes.points);
//           bounds = getPointsBounds(points);
//         }
//         break;

//       case 'text':
//         const tx = parseFloat(attributes.x || 0);
//         const ty = parseFloat(attributes.y || 0);
//         const fontSize = parseFloat(attributes['font-size'] || 12);
//         bounds = {
//           minX: tx,
//           minY: ty - fontSize,
//           maxX: tx + (attributes.textContent?.length || 0) * fontSize * 0.6,
//           maxY: ty
//         };
//         break;

//       case 'arc':
//         const ax1 = parseFloat(attributes.x1 || 0);
//         const ay1 = parseFloat(attributes.y1 || 0);
//         const ax2 = parseFloat(attributes.x2 || 0);
//         const ay2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(ax1, ax2),
//           minY: Math.min(ay1, ay2),
//           maxX: Math.max(ax1, ax2),
//           maxY: Math.max(ay1, ay2)
//         };
//         break;

//       case 'image':
//         const imgX = parseFloat(attributes.x || 0);
//         const imgY = parseFloat(attributes.y || 0);
//         const imgWidth = parseFloat(attributes.width || 0);
//         const imgHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: imgX,
//           minY: imgY,
//           maxX: imgX + imgWidth,
//           maxY: imgY + imgHeight
//         };
//         break;

//       case 'hatch':
//       case 'solid':
//         if (attributes.points) {
//           const points = parsePoints(attributes.points);
//           bounds = getPointsBounds(points);
//         }
//         break;
//       case 'mtext':
//         const mtx = parseFloat(attributes.x || 0);
//         const mty = parseFloat(attributes.y || 0);
//         const mtextWidth = parseFloat(attributes.width || 0);
//         const mtextHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: mtx,
//           minY: mty,
//           maxX: mtx + mtextWidth,
//           maxY: mty + mtextHeight
//         };
//         break;
//       case 'point':
//         const px = parseFloat(attributes.x || 0);
//         const py = parseFloat(attributes.y || 0);
//         const pr = parseFloat(attributes.r || 2);
//         bounds = {
//           minX: px - pr,
//           minY: py - pr,
//           maxX: px + pr,
//           maxY: py + pr
//         };
//         break;

//       case 'ole2frame':
//         const oleX = parseFloat(attributes.x || 0);
//         const oleY = parseFloat(attributes.y || 0);
//         const oleWidth = parseFloat(attributes.width || 0);
//         const oleHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: oleX,
//           minY: oleY,
//           maxX: oleX + oleWidth,
//           maxY: oleY + oleHeight
//         };
//         break;

//       case 'spline':
//         const splinePoints = parsePoints(attributes.points);
//         bounds = getPointsBounds(splinePoints);
//         break;
//       case 'dimension':
//         const dimX1 = parseFloat(attributes.x1 || 0);
//         const dimY1 = parseFloat(attributes.y1 || 0);
//         const dimX2 = parseFloat(attributes.x2 || 0);
//         const dimY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(dimX1, dimX2),
//           minY: Math.min(dimY1, dimY2),
//           maxX: Math.max(dimX1, dimX2),
//           maxY: Math.max(dimY1, dimY2)
//         };
//         break;

//       case '3dface':
//         if (attributes.points) {
//           const points = parsePoints(attributes.points);
//           bounds = getPointsBounds(points);
//         }
//         break;
//       case 'region':
//         if (attributes.points) {
//           const points = parsePoints(attributes.points);
//           bounds = getPointsBounds(points);
//         }
//         break;

//       case 'attrib':
//         const attribX = parseFloat(attributes.x || 0);
//         const attribY = parseFloat(attributes.y || 0);
//         const attribFontSize = parseFloat(attributes['font-size'] || 12);
//         bounds = {
//           minX: attribX,
//           minY: attribY - attribFontSize,
//           maxX: attribX + (attributes.textContent?.length || 0) * attribFontSize * 0.6,
//           maxY: attribY
//         };
//         break;

//       case 'attdef':
//         const attdefX = parseFloat(attributes.x || 0);
//         const attdefY = parseFloat(attributes.y || 0);
//         const attdefFontSize = parseFloat(attributes['font-size'] || 12);
//         bounds = {
//           minX: attdefX,
//           minY: attdefY - attdefFontSize,
//           maxX: attdefX + (attributes.textContent?.length || 0) * attdefFontSize * 0.6,
//           maxY: attdefY
//         };
//         break;

//       case 'leader':
//         const leaderX1 = parseFloat(attributes.x1 || 0);
//         const leaderY1 = parseFloat(attributes.y1 || 0);
//         const leaderX2 = parseFloat(attributes.x2 || 0);
//         const leaderY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(leaderX1, leaderX2),
//           minY: Math.min(leaderY1, leaderY2),
//           maxX: Math.max(leaderX1, leaderX2),
//           maxY: Math.max(leaderY1, leaderY2)
//         };
//         break;
//       case 'mleader':
//         const mleaderX1 = parseFloat(attributes.x1 || 0);
//         const mleaderY1 = parseFloat(attributes.y1 || 0);
//         const mleaderX2 = parseFloat(attributes.x2 || 0);
//         const mleaderY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(mleaderX1, mleaderX2),
//           minY: Math.min(mleaderY1, mleaderY2),
//           maxX: Math.max(mleaderX1, mleaderX2),
//           maxY: Math.max(mleaderY1, mleaderY2)
//         };
//         break;

//       case 'insert':
//         const insertX = parseFloat(attributes.x || 0);
//         const insertY = parseFloat(attributes.y || 0);
//         const insertWidth = parseFloat(attributes.width || 0);
//         const insertHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: insertX,
//           minY: insertY,
//           maxX: insertX + insertWidth,
//           maxY: insertY + insertHeight
//         };
//         break;

//       case 'ray':
//         const rayX1 = parseFloat(attributes.x1 || 0);
//         const rayY1 = parseFloat(attributes.y1 || 0);
//         const rayX2 = parseFloat(attributes.x2 || 0);
//         const rayY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(rayX1, rayX2),
//           minY: Math.min(rayY1, rayY2),
//           maxX: Math.max(rayX1, rayX2),
//           maxY: Math.max(rayY1, rayY2)
//         };
//         break;
//       case 'xline':
//         const xlineX1 = parseFloat(attributes.x1 || 0);
//         const xlineY1 = parseFloat(attributes.y1 || 0);
//         const xlineX2 = parseFloat(attributes.x2 || 0);
//         const xlineY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(xlineX1, xlineX2),
//           minY: Math.min(xlineY1, xlineY2),
//           maxX: Math.max(xlineX1, xlineX2),
//           maxY: Math.max(xlineY1, xlineY2)
//         };
//         break;

//       case 'trace':
//         if (attributes.d) {
//           bounds = approximatePathBounds(attributes.d);
//         }
//         break;

//       case 'wipeout':
//         const wipeoutX = parseFloat(attributes.x || 0);
//         const wipeoutY = parseFloat(attributes.y || 0);
//         const wipeoutWidth = parseFloat(attributes.width || 0);
//         const wipeoutHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: wipeoutX,
//           minY: wipeoutY,
//           maxX: wipeoutX + wipeoutWidth,
//           maxY: wipeoutY + wipeoutHeight
//         };
//         break;
//       case 'g':
//         const groupChildren = Array.from(domElement.children);
//         if (groupChildren.length > 0) {
//           const groupBounds = groupChildren.reduce((acc, child) => {
//             const childBounds = calculateElementBounds(child.tagName.toLowerCase(), getElementAttributes(child));
//             return {
//               minX: Math.min(acc.minX, childBounds.minX),
//               minY: Math.min(acc.minY, childBounds.minY),
//               maxX: Math.max(acc.maxX, childBounds.maxX),
//               maxY: Math.max(acc.maxY, childBounds.maxY)
//             };
//           }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
//           bounds = groupBounds;
//         }
//         break;
//     }
//   } catch (error) {
//     console.warn('Error calculating bounds for element:', type, error);
//   }

//   return bounds;
// };

// const parsePoints = (pointsStr) => {
//   return pointsStr.trim().split(/[\s,]+/).reduce((acc, val, i, arr) => {
//     if (i % 2 === 0) {
//       acc.push({
//         x: parseFloat(val),
//         y: parseFloat(arr[i + 1] || 0)
//       });
//     }
//     return acc;
//   }, []);
// };

// const getPointsBounds = (points) => {
//   if (points.length === 0) {
//     return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
//   }

//   const xs = points.map(p => p.x);
//   const ys = points.map(p => p.y);

//   return {
//     minX: Math.min(...xs),
//     minY: Math.min(...ys),
//     maxX: Math.max(...xs),
//     maxY: Math.max(...ys)
//   };
// };

// const approximatePathBounds = (pathData) => {
//   // Simple approximation - extract numbers from path data
//   if (!pathData) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

//   const numbers = pathData.match(/-?\d+\.?\d*/g);
//   if (!numbers || numbers.length === 0) {
//     return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
//   }

//   const coords = numbers.map(n => parseFloat(n));
//   const xs = coords.filter((_, i) => i % 2 === 0);
//   const ys = coords.filter((_, i) => i % 2 === 1);

//   return {
//     minX: Math.min(...xs),
//     minY: Math.min(...ys),
//     maxX: Math.max(...xs),
//     maxY: Math.max(...ys)
//   };
// };

// export const generateSvgString = (elements, viewBox) => {
//   const layers = {};

//   // Group elements by layer
//   elements.forEach(el => {
//     const layer = el.layer || 'default';
//     if (!layers[layer]) layers[layer] = [];
//     layers[layer].push(el);
//   });

//   // Generate SVG content for each layer
//   const groupedContent = Object.entries(layers).map(([layer, layerElements]) => {
//     const elementsString = layerElements.map(el => {
//       return generateElementString(el);
//     }).join('\n    ');

//     return `  <g data-layer="${layer}">
//     ${elementsString}
//   </g>`;
//   }).join('\n');

//   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap: round; stroke-linejoin: round;">
//   <style>
//     text { dominant-baseline: middle; font-family: Arial, sans-serif; }
//   </style>
// ${groupedContent}
// </svg>`;
// };

// const generateElementString = (element) => {
//   const { type, attributes } = element;

//   // Filter out internal attributes
//   const cleanAttributes = { ...attributes };
//   delete cleanAttributes.textContent;

//   const attrs = Object.entries(cleanAttributes)
//     .map(([key, value]) => `${key}="${value}"`)
//     .join(' ');

//   if (type === 'text') {
//     return `<${type} ${attrs}>${attributes.textContent || ''}</${type}>`;
//   } else {
//     return `<${type} ${attrs} />`;
//   }
// };













// import { v4 as uuidv4 } from 'uuid';

// function applyTransformToAttributes(attrs, transform) {
//   if (!transform) return {...attrs};

//   const translateMatch = transform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
//   if (!translateMatch) return {...attrs};

//   const dx = parseFloat(translateMatch[1]);
//   const dy = parseFloat(translateMatch[2]);
//   const newAttrs = { ...attrs };

//   const applyOffset = (keyX, keyY) => {
//     if (newAttrs[keyX] !== undefined) newAttrs[keyX] = parseFloat(newAttrs[keyX]) + dx;
//     if (newAttrs[keyY] !== undefined) newAttrs[keyY] = parseFloat(newAttrs[keyY]) + dy;
//   };

//   if ('x' in newAttrs && 'y' in newAttrs) applyOffset('x', 'y');
//   else if ('cx' in newAttrs && 'cy' in newAttrs) applyOffset('cx', 'cy');
//   else if ('x1' in newAttrs && 'y1' in newAttrs && 'x2' in newAttrs && 'y2' in newAttrs) {
//     newAttrs.x1 = parseFloat(newAttrs.x1) + dx;
//     newAttrs.y1 = parseFloat(newAttrs.y1) + dy;
//     newAttrs.x2 = parseFloat(newAttrs.x2) + dx;
//     newAttrs.y2 = parseFloat(newAttrs.y2) + dy;
//   } else if ('points' in newAttrs) {
//     newAttrs.points = newAttrs.points.split(' ').map(pair => {
//       const [x, y] = pair.split(',').map(parseFloat);
//       return `${x + dx},${y + dy}`;
//     }).join(' ');
//   }

//   return newAttrs;
// }

// export const parseSvgContent = (svgString) => {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(svgString, 'image/svg+xml');
//   const svgElement = doc.querySelector('svg');

//   if (!svgElement) {
//     console.error('Invalid SVG content');
//     return { elements: [], viewBox: '0 0 800 600' };
//   }

//   const viewBox = svgElement.getAttribute('viewBox') || '0 0 800 600';
//   const elements = [];

//   // Parse groups with layers
//   const groups = svgElement.querySelectorAll('g[data-layer]');
//   groups.forEach(group => {
//     const transform = group.getAttribute('transform');
//     const layer = group.getAttribute('data-layer');
//     const children = Array.from(group.children);

//     children.forEach(child => {
//       const rawAttrs = getElementAttributes(child);
//       const adjustedAttrs = applyTransformToAttributes(rawAttrs, transform);
//       parsedElements.push({
//         id: uuidv4(),
//         type: child.tagName.toLowerCase(),
//         layer,
//         attributes: adjustedAttrs
//       });
//     });
//   });

//   // Also parse direct children of SVG (elements without layers)
//   const directChildren = Array.from(svgElement.children).filter(
//     child => child.tagName !== 'g' && child.tagName !== 'style' && child.tagName !== 'defs'
//   );
//   directChildren.forEach((child) => {
//     const element = parseElement(child, 'default');
//     if (element) {
//       elements.push(element);
//     }
//   });

//   console.log('Parsed SVG elements:', elements, 'ViewBox:', viewBox);
//   return { elements, viewBox };
// };

// const parseElement = (domElement, layer) => {
//   const tagName = domElement.tagName.toLowerCase();
//   const attributes = getElementAttributes(domElement);

//   // Handle text content for text elements
//   if (tagName === 'text' || tagName === 'mtext') {
//     attributes.textContent = domElement.textContent || '';
//   }

//   // Handle standard SVG attributes with proper naming
//   if (attributes['stroke-width']) {
//     attributes.strokeWidth = attributes['stroke-width'];
//   }
//   if (attributes['font-size']) {
//     attributes.fontSize = attributes['font-size'];
//   }
//   if (attributes['font-family']) {
//     attributes.fontFamily = attributes['font-family'];
//   }

//   const element = {
//     id: uuidv4(),
//     type: tagName,
//     layer: layer || 'default',
//     attributes,
//     bounds: calculateElementBounds(tagName, attributes, domElement)
//   };

//   // Handle text content separately for better access
//   if (domElement.textContent && (tagName === 'text' || tagName === 'mtext')) {
//     element.textContent = domElement.textContent;
//   }

//   return element;
// };

// const getElementAttributes = (element) => {
//   const attrs = {};
//   for (let i = 0; i < element.attributes.length; i++) {
//     const attr = element.attributes[i];
//     attrs[attr.name] = attr.value;
//   }
//   return attrs;
// };

// const calculateElementBounds = (type, attributes, domElement) => {
//   let bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

//   try {
//     switch (type) {
//       case 'line':
//         const x1 = parseFloat(attributes.x1 || 0);
//         const y1 = parseFloat(attributes.y1 || 0);
//         const x2 = parseFloat(attributes.x2 || 0);
//         const y2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(x1, x2),
//           minY: Math.min(y1, y2),
//           maxX: Math.max(x1, x2),
//           maxY: Math.max(y1, y2)
//         };
//         break;

//       case 'circle':
//         const cx = parseFloat(attributes.cx || 0);
//         const cy = parseFloat(attributes.cy || 0);
//         const r = parseFloat(attributes.r || 0);
//         bounds = {
//           minX: cx - r,
//           minY: cy - r,
//           maxX: cx + r,
//           maxY: cy + r
//         };
//         break;

//       case 'ellipse':
//         const ecx = parseFloat(attributes.cx || 0);
//         const ecy = parseFloat(attributes.cy || 0);
//         const rx = parseFloat(attributes.rx || 0);
//         const ry = parseFloat(attributes.ry || 0);
//         bounds = {
//           minX: ecx - rx,
//           minY: ecy - ry,
//           maxX: ecx + rx,
//           maxY: ecy + ry
//         };
//         break;

//       case 'rect':
//         const x = parseFloat(attributes.x || 0);
//         const y = parseFloat(attributes.y || 0);
//         const width = parseFloat(attributes.width || 0);
//         const height = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: x,
//           minY: y,
//           maxX: x + width,
//           maxY: y + height
//         };
//         break;

//       case 'polygon':
//       case 'polyline':
//       case 'lwpolyline':
//         if (attributes.points) {
//           const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//           if (points.length >= 2) {
//             let minX = points[0], maxX = points[0];
//             let minY = points[1], maxY = points[1];

//             for (let i = 2; i < points.length; i += 2) {
//               if (i + 1 < points.length) {
//                 minX = Math.min(minX, points[i]);
//                 maxX = Math.max(maxX, points[i]);
//                 minY = Math.min(minY, points[i + 1]);
//                 maxY = Math.max(maxY, points[i + 1]);
//               }
//             }
//             bounds = { minX, minY, maxX, maxY };
//           }
//         }
//         break;

//       case 'path':
//         // For path elements, try to use getBBox if available, otherwise use a simple fallback
//         if (domElement && typeof domElement.getBBox === 'function') {
//           try {
//             const bbox = domElement.getBBox();
//             bounds = {
//               minX: bbox.x,
//               minY: bbox.y,
//               maxX: bbox.x + bbox.width,
//               maxY: bbox.y + bbox.height
//             };
//           } catch (e) {
//             // Fallback for path bounds calculation
//             bounds = calculatePathBounds(attributes.d || '');
//           }
//         } else {
//           bounds = calculatePathBounds(attributes.d || '');
//         }
//         break;

//       case 'text':
//       case 'mtext':
//         const tx = parseFloat(attributes.x || 0);
//         const ty = parseFloat(attributes.y || 0);
//         const fontSize = parseFloat(attributes.fontSize || attributes['font-size'] || 12);
//         const textLength = (attributes.textContent || domElement.textContent || '').length;
//         const estimatedWidth = textLength * fontSize * 0.6; // Rough estimation
//         bounds = {
//           minX: tx,
//           minY: ty - fontSize,
//           maxX: tx + estimatedWidth,
//           maxY: ty
//         };
//         break;

//       case 'image':
//         const ix = parseFloat(attributes.x || 0);
//         const iy = parseFloat(attributes.y || 0);
//         const iw = parseFloat(attributes.width || 0);
//         const ih = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: ix,
//           minY: iy,
//           maxX: ix + iw,
//           maxY: iy + ih
//         };
//         break;

//       case 'arc':
//         const ax1 = parseFloat(attributes.x1 || 0);
//         const ay1 = parseFloat(attributes.y1 || 0);
//         const ax2 = parseFloat(attributes.x2 || 0);
//         const ay2 = parseFloat(attributes.y2 || 0);
//         const arx = parseFloat(attributes.rx || Math.abs(ax2 - ax1) / 2);
//         const ary = parseFloat(attributes.ry || Math.abs(ay2 - ay1) / 2);
//         const centerX = (ax1 + ax2) / 2;
//         const centerY = (ay1 + ay2) / 2;
//         bounds = {
//           minX: centerX - arx,
//           minY: centerY - ary,
//           maxX: centerX + arx,
//           maxY: centerY + ary
//         };
//         break;

//       case 'hatch':
//       case 'solid':
//         if (attributes.points) {
//           const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//           if (points.length >= 2) {
//             let minX = points[0], maxX = points[0];
//             let minY = points[1], maxY = points[1];
//             for (let i = 2; i < points.length; i += 2) {
//               if (i + 1 < points.length) {
//                 minX = Math.min(minX, points[i]);
//                 maxX = Math.max(maxX, points[i]);
//                 minY = Math.min(minY, points[i + 1]);
//                 maxY = Math.max(maxY, points[i + 1]);
//               }
//             }
//             bounds = { minX, minY, maxX, maxY };
//           }
//         }
//         break;

//       case 'point':
//         const px = parseFloat(attributes.x || 0);
//         const py = parseFloat(attributes.y || 0);
//         bounds = {
//           minX: px,
//           minY: py,
//           maxX: px,
//           maxY: py
//         };
//         break;

//       case 'ole2frame':
//         const oleX = parseFloat(attributes.x || 0);
//         const oleY = parseFloat(attributes.y || 0);
//         const oleWidth = parseFloat(attributes.width || 0);
//         const oleHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: oleX,
//           minY: oleY,
//           maxX: oleX + oleWidth,
//           maxY: oleY + oleHeight
//         };
//         break;

//       case 'spline':
//         if (attributes.points) {
//           const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//           if (points.length >= 2) {
//             let minX = points[0], maxX = points[0];
//             let minY = points[1], maxY = points[1];
//             for (let i = 2; i < points.length; i += 2) {
//               if (i + 1 < points.length) {
//                 minX = Math.min(minX, points[i]);
//                 maxX = Math.max(maxX, points[i]);
//                 minY = Math.min(minY, points[i + 1]);
//                 maxY = Math.max(maxY, points[i + 1]);
//               }
//             }
//             bounds = { minX, minY, maxX, maxY };
//           }
//         }
//         break;

//       case 'dimension':
//         const dimX1 = parseFloat(attributes.x1 || 0);
//         const dimY1 = parseFloat(attributes.y1 || 0);
//         const dimX2 = parseFloat(attributes.x2 || 0);
//         const dimY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(dimX1, dimX2),
//           minY: Math.min(dimY1, dimY2),
//           maxX: Math.max(dimX1, dimX2),
//           maxY: Math.max(dimY1, dimY2)
//         };
//         break;

//       case '3dface':
//         if (attributes.points) {
//           const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//           if (points.length >= 6) {
//             const zValues = [points[2], points[4], points[5]];
//             const minZ = Math.min(...zValues);
//             const maxZ = Math.max(...zValues);
//             bounds = {
//               minX: Math.min(points[0], points[1]),
//               minY: Math.min(points[2], points[3]),
//               maxX: Math.max(points[0], points[1]),
//               maxY: Math.max(points[2], points[3]),
//               minZ,
//               maxZ
//             };
//           }
//         }
//         break;

//       case 'region':
//         if (attributes.points) {
//           const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//           if (points.length >= 4) {
//             const minX = Math.min(points[0], points[2]);
//             const minY = Math.min(points[1], points[3]);
//             const maxX = Math.max(points[0], points[2]);
//             const maxY = Math.max(points[1], points[3]);
//             bounds = { minX, minY, maxX, maxY };
//           }
//         }
//         break;

//       case 'attrib':
//         const attribX = parseFloat(attributes.x || 0);
//         const attribY = parseFloat(attributes.y || 0);
//         const attribWidth = parseFloat(attributes.width || 0);
//         const attribHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: attribX,
//           minY: attribY,
//           maxX: attribX + attribWidth,
//           maxY: attribY + attribHeight
//         };
//         break;

//       case 'attdef':
//         const attdefX = parseFloat(attributes.x || 0);
//         const attdefY = parseFloat(attributes.y || 0);
//         const attdefWidth = parseFloat(attributes.width || 0);
//         const attdefHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: attdefX,
//           minY: attdefY,
//           maxX: attdefX + attdefWidth,
//           maxY: attdefY + attdefHeight
//         };
//         break;

//       case 'leader':
//         const leaderX1 = parseFloat(attributes.x1 || 0);
//         const leaderY1 = parseFloat(attributes.y1 || 0);
//         const leaderX2 = parseFloat(attributes.x2 || 0);
//         const leaderY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(leaderX1, leaderX2),
//           minY: Math.min(leaderY1, leaderY2),
//           maxX: Math.max(leaderX1, leaderX2),
//           maxY: Math.max(leaderY1, leaderY2)
//         };
//         break;

//       case 'mleader':
//         const mleaderX1 = parseFloat(attributes.x1 || 0);
//         const mleaderY1 = parseFloat(attributes.y1 || 0);
//         const mleaderX2 = parseFloat(attributes.x2 || 0);
//         const mleaderY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(mleaderX1, mleaderX2),
//           minY: Math.min(mleaderY1, mleaderY2),
//           maxX: Math.max(mleaderX1, mleaderX2),
//           maxY: Math.max(mleaderY1, mleaderY2)
//         };
//         break;

//       case 'ray':
//         const rayX1 = parseFloat(attributes.x1 || 0);
//         const rayY1 = parseFloat(attributes.y1 || 0);
//         const rayX2 = parseFloat(attributes.x2 || 0);
//         const rayY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(rayX1, rayX2),
//           minY: Math.min(rayY1, rayY2),
//           maxX: Math.max(rayX1, rayX2),
//           maxY: Math.max(rayY1, rayY2)
//         };
//         break;

//       case 'xline':
//         const xlineX1 = parseFloat(attributes.x1 || 0);
//         const xlineY1 = parseFloat(attributes.y1 || 0);
//         const xlineX2 = parseFloat(attributes.x2 || 0);
//         const xlineY2 = parseFloat(attributes.y2 || 0);
//         bounds = {
//           minX: Math.min(xlineX1, xlineX2),
//           minY: Math.min(xlineY1, xlineY2),
//           maxX: Math.max(xlineX1, xlineX2),
//           maxY: Math.max(xlineY1, xlineY2)
//         };
//         break;

//       case 'trace':
//         if (attributes.d) {
//           bounds = calculatePathBounds(attributes.d);
//         }
//         break;

//       case 'wipeout':
//         const wipeoutX = parseFloat(attributes.x || 0);
//         const wipeoutY = parseFloat(attributes.y || 0);
//         const wipeoutWidth = parseFloat(attributes.width || 0);
//         const wipeoutHeight = parseFloat(attributes.height || 0);
//         bounds = {
//           minX: wipeoutX,
//           minY: wipeoutY,
//           maxX: wipeoutX + wipeoutWidth,
//           maxY: wipeoutY + wipeoutHeight
//         };
//         break;

//       case 'g':
//       case 'insert':
//         const gx = parseFloat(attributes.x || 0);
//         const gy = parseFloat(attributes.y || 0);
//         bounds = {
//           minX: gx,
//           minY: gy,
//           maxX: gx + 10,
//           maxY: gy + 10
//         };
//         break;

//       default:
//         bounds = {
//           minX: 0,
//           minY: 0,
//           maxX: 10,
//           maxY: 10
//         };
//         break;
//     }
//   } catch (error) {
//     console.warn(`Error calculating bounds for ${type}:`, error);
//     bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
//   }

//   return bounds;
// };

// const calculatePathBounds = (pathData) => {
//   // Simple path bounds calculation - extracts M and L commands
//   const commands = pathData.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || [];
//   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//   let currentX = 0, currentY = 0;

//   commands.forEach(command => {
//     const type = command[0];
//     const coords = command.slice(1).trim().split(/[\s,]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));

//     switch (type.toLowerCase()) {
//       case 'm':
//       case 'l':
//         if (coords.length >= 2) {
//           if (type === type.toLowerCase()) {
//             // Relative coordinates
//             currentX += coords[0];
//             currentY += coords[1];
//           } else {
//             // Absolute coordinates
//             currentX = coords[0];
//             currentY = coords[1];
//           }
//           minX = Math.min(minX, currentX);
//           minY = Math.min(minY, currentY);
//           maxX = Math.max(maxX, currentX);
//           maxY = Math.max(maxY, currentY);
//         }
//         break;
//       case 'h':
//         if (coords.length >= 1) {
//           currentX += coords[0];
//           minX = Math.min(minX, currentX);
//           maxX = Math.max(maxX, currentX);
//         }
//         break;
//       case 'v':
//         if (coords.length >= 1) {
//           currentY += coords[0];
//           minY = Math.min(minY, currentY);
//           maxY = Math.max(maxY, currentY);
//         }
//         break;
//       case 'c':
//         if (coords.length >= 6) {
//           for (let i = 0; i < coords.length; i += 2) {
//             if (i + 1 < coords.length) {
//               if (type === type.toLowerCase()) {
//                 currentX += coords[i];
//                 currentY += coords[i + 1];
//               } else {
//                 currentX = coords[i];
//                 currentY = coords[i + 1];
//               }
//               minX = Math.min(minX, currentX);
//               minY = Math.min(minY, currentY);
//               maxX = Math.max(maxX, currentX);
//               maxY = Math.max(maxY, currentY);
//             }
//           }
//         }
//         break;
//     }
//   });

//   if (minX === Infinity) {
//     return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
//   }

//   return { minX, minY, maxX, maxY };
// };

// export const generateSvgString = (elements, viewBox) => {
//   const svgStart = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;
//   const svgEnd = '</svg>';

//   // Group elements by layer
//   const elementsByLayer = {};
//   elements.forEach(element => {
//     const layer = element.layer || 'default';
//     if (!elementsByLayer[layer]) {
//       elementsByLayer[layer] = [];
//     }
//     elementsByLayer[layer].push(element);
//   });

//   let svgContent = '';

//   // Generate SVG for each layer
//   Object.keys(elementsByLayer).forEach(layer => {
//     if (layer !== 'default') {
//       svgContent += `<g data-layer="${layer}">`;
//     }

//     elementsByLayer[layer].forEach(element => {
//       svgContent += generateElementSvg(element);
//     });

//     if (layer !== 'default') {
//       svgContent += '</g>';
//     }
//   });

//   return svgStart + svgContent + svgEnd;
// };

// const generateElementSvg = (element) => {
//   const { type, attributes } = element;
//   const attrs = Object.keys(attributes)
//     .filter(key => key !== 'textContent')
//     .map(key => `${key}="${attributes[key]}"`)
//     .join(' ');

//   switch (type.toLowerCase()) {
//     case 'line':
//       return `<line ${attrs} />`;
//     case 'circle':
//       return `<circle ${attrs} />`;
//     case 'ellipse':
//       return `<ellipse ${attrs} />`;
//     case 'arc':
//       return `<path d="M ${attributes.x1} ${attributes.y1} A ${attributes.rx} ${attributes.ry} 0 0 1 ${attributes.x2} ${attributes.y2}" ${attrs} />`;
//     case 'solid':
//     case 'hatch':
//       return `<pattern ${attrs}></pattern>`;
//     case 'point':
//       return `<circle ${attrs} r="${attributes.r || 2}" />`;
//     case 'ole2frame':
//       return `<rect ${attrs} />`;
//     case 'attrib':
//     case 'attdef':
//       return `<text ${attrs}>${attributes.textContent || ''}</text>`;
//     case 'leader':
//       return `<line ${attrs} />`;
//     case 'mleader':
//       return `<line ${attrs} />`;
//     case 'insert':
//       return `<image ${attrs} />`;
//     case 'ray':
//       return `<line ${attrs} />`;
//     case 'xline':
//       return `<line ${attrs} />`;
//     case 'dimension':
//       return `<line ${attrs} />`;
//     case '3dface':
//       if (attributes.points) {
//         const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//         if (points.length >= 6) {
//           const pathData = `M ${points[0]} ${points[1]} L ${points[2]} ${points[3]} L ${points[4]} ${points[5]} Z`;
//           return `<path d="${pathData}" ${attrs} />`;
//         }
//       }
//       return `<path ${attrs} />`;
//     case 'region':
//       if (attributes.points) {
//         const points = attributes.points.trim().split(/[\s,]+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
//         if (points.length >= 6) {
//           const pathData = `M ${points[0]} ${points[1]} L ${points[2]} ${points[3]} L ${points[4]} ${points[5]} Z`;
//           return `<path d="${pathData}" ${attrs} />`;
//         }
//       }
//       return `<path ${attrs} />`;
//     case 'wipeout':
//       return `<rect ${attrs} />`;
//     case 'rect':
//       return `<rect ${attrs} />`;
//     case 'polygon':
//       return `<polygon ${attrs} />`;
//     case 'polyline':
//     case 'lwpolyline':
//       return `<polyline ${attrs} />`;
//     case 'path':
//     case 'spline':
//     case 'trace':
//       return `<path ${attrs} />`;
//     case 'text':
//     case 'mtext':
//       return `<text ${attrs}>${attributes.textContent || element.textContent || ''}</text>`;
//     case 'image':
//       return `<image ${attrs} />`;
//     case 'g':
//       return `<g ${attrs}></g>`;
//     default:
//       return `<${type} ${attrs} />`;
//   }
// };












import { v4 as uuidv4 } from 'uuid';

export function getElementAttributes(element) {
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function applyTransformToAttributes(attrs, transform) {
  if (!transform) return { ...attrs };

  const translateMatch = transform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
  if (!translateMatch) return { ...attrs };

  const dx = parseFloat(translateMatch[1]);
  const dy = parseFloat(translateMatch[2]);
  const updated = { ...attrs };

  const offsetPair = (xKey, yKey) => {
    if (xKey in updated) updated[xKey] = (parseFloat(updated[xKey]) + dx).toString();
    if (yKey in updated) updated[yKey] = (parseFloat(updated[yKey]) + dy).toString();
  };

  if ('x' in updated && 'y' in updated) offsetPair('x', 'y');
  else if ('cx' in updated && 'cy' in updated) offsetPair('cx', 'cy');
  else if ('x1' in updated && 'y1' in updated && 'x2' in updated && 'y2' in updated) {
    updated.x1 = (parseFloat(updated.x1) + dx).toString();
    updated.y1 = (parseFloat(updated.y1) + dy).toString();
    updated.x2 = (parseFloat(updated.x2) + dx).toString();
    updated.y2 = (parseFloat(updated.y2) + dy).toString();
  } else if ('points' in updated) {
    updated.points = updated.points.split(' ').map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return `${x + dx},${y + dy}`;
    }).join(' ');
  } else if ('d' in updated) {
    // Basic M/L parser for paths — can be extended for more commands
    updated.d = updated.d.replace(/([ML])\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)/gi, (match, cmd, x, y) => {
      return `${cmd} ${parseFloat(x) + dx},${parseFloat(y) + dy}`;
    });
  }

  return updated;
}

/**
 * Parses an SVG string and extracts all elements grouped by <g data-layer=...>
 */
export function parseSvgContent(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  const elements = [];
  let viewBox = '0 0 800 600';

  if (svg) {
    const vb = svg.getAttribute('viewBox');
    if (vb) viewBox = vb;

    const groups = svg.querySelectorAll('g[data-layer]');

    groups.forEach(group => {
      const layer = group.getAttribute('data-layer') || 'default';
      const transform = group.getAttribute('transform');
      const children = Array.from(group.children);

      children.forEach(child => {
        const rawAttrs = getElementAttributes(child);
        const adjustedAttrs = applyTransformToAttributes(rawAttrs, transform);
        const type = child.tagName.toLowerCase();

        elements.push({
          id: uuidv4(),
          type,
          layer,
          attributes: adjustedAttrs
        });
      });
    });
  }

  // console.log('Parsed SVG elements:', elements, 'ViewBox:', viewBox);

  return { elements, viewBox };
}

/**
 * Rebuilds SVG string from current elements and viewBox
 */
export function generateSvgString(elements, viewBox = '0 0 800 600') {
  const grouped = {};

  elements.forEach(el => {
    const layer = el.layer || 'default';
    if (!grouped[layer]) grouped[layer] = [];
    grouped[layer].push(el);
  });

  const groupContent = Object.entries(grouped).map(([layer, els]) => {
    const content = els.map(el => {
      const { type, attributes } = el;
      const attrString = Object.entries(attributes)
        .map(([k, v]) => `${k}="${v}"`).join(' ');

      const isText = type === 'text' && attributes.children;
      const tag = isText
        ? `<${type} ${attrString}>${attributes.children}</${type}>`
        : `<${type} ${attrString} />`;

      return tag;
    }).join('\n');

    return `<g data-layer="${layer}">\n${content}\n</g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${groupContent}\n</svg>`;
}
