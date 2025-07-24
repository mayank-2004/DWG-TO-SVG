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
  const blockIdCounter = { value: 0 };

  const config = {
    hideDimensions: false,
    hideText: false,
    hidePoints: true,
    simplifySplines: true,
    strokeWidth: 0.5,
    textSizeMultiplier: 0.3
  };

  const round = (num) => Math.round(num * 10000) / 10000;
  const normalizeStrokeWidth = () => 1;

  const applyTransform = (x, y, transforms = transformStack) => {
    let px = x;
    let py = y;

    for (const tf of transforms) {
      const cos = Math.cos(tf.rotation || 0);
      const sin = Math.sin(tf.rotation || 0);
      const sx = tf.scaleX ?? 1;
      const sy = tf.scaleY ?? 1;
      const tx = tf.x ?? 0;
      const ty = tf.y ?? 0;

      // Apply scaling first
      const scaledX = px * sx;
      const scaledY = py * sy;

      // Apply rotation
      const rotatedX = scaledX * cos - scaledY * sin;
      const rotatedY = scaledX * sin + scaledY * cos;

      // Apply translation
      px = rotatedX + tx;
      py = rotatedY + ty;
    }

    return [px, py];
  };

  const updateBounds = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn(`Invalid bounds update: (${x}, ${y})`);
      return;
    }

    // Ignore extremely large values that might be errors
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
      console.warn(`Ignoring extreme coordinate: (${x}, ${y})`);
      return;
    }

    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.valid = true;
  };

  const xmlEscapeMap = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ]);

  // Add this function to check layer visibility
  const isLayerVisible = (layerName, layers = {}) => {
    const layer = layers[layerName];
    if (!layer) return true; // Default to visible if layer not found

    // Check common layer visibility flags
    if (layer.frozen === true || layer.flags & 4) return false; // Frozen
    if (layer.off === true || layer.flags & 2) return false; // Off
    if (layer.flags & 1) return false; // Frozen in new viewports

    return true;
  };

  // Enhanced entity filtering function
  const shouldRenderEntity = (entity, layers = {}) => {
    // Skip entities on invisible layers
    if (entity.layer && !isLayerVisible(entity.layer, layers)) {
      console.log(`Skipping entity on invisible layer: ${entity.layer}`);
      return false;
    }

    // Skip entities with invisible flag
    if (entity.invisible === true || (entity.flags && entity.flags & 1)) {
      console.log(`Skipping invisible entity: ${entity.type}`);
      return false;
    }

    // Skip entities that are set to not plot
    if (entity.plotFlag === false) {
      console.log(`Skipping non-plotting entity: ${entity.type}`);
      return false;
    }

    return true;
  };

  const escapeXml = (text) => String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));

  // Build block definitions
  const blockDefinitions = new Map();
  if (tables.BLOCK_RECORD?.entries) {
    for (const blockRecord of tables.BLOCK_RECORD.entries) {
      if (blockRecord.name && blockRecord.entities) {
        blockDefinitions.set(blockRecord.name, blockRecord.entities);
      }
    }
  }

  // Also check block definitions for circular entities
  // const analyzeBlockDefinitions = (blockDefs) => {
  //   // console.log(`\n=== ANALYZING BLOCK DEFINITIONS ===`);

  //   for (const [blockName, entities] of blockDefs.entries()) {
  //     console.log(`Block "${blockName}" has ${entities.length} entities`);

  //     const blockCircular = entities.filter(e =>
  //       ['CIRCLE', 'ELLIPSE', 'ARC'].includes(e.type)
  //     );

  //     if (blockCircular.length > 0) {
  //       console.log(`Block "${blockName}" contains circular entities:`, blockCircular);

  //       // This could be your problem - blocks with circles being inserted!
  //       // blockCircular.forEach(entity => {
  //       //   console.log(`  - ${entity.type} in block "${blockName}":`, {
  //       //     center: entity.center,
  //       //     radius: entity.radius,
  //       //     layer: entity.layer
  //       //   });
  //       // });
  //     }
  //   }
  // };

  // analyzeBlockDefinitions(blockDefinitions);

  // Get color from entity or layer
  // const getEntityColor = (entity, layers = {}) => {
  //   // If entity has explicit color
  //   if (entity.color && typeof entity.color === 'object') {
  //     return entity.color;
  //   }

  //   // If entity has color index
  //   if (entity.colorIndex !== undefined) {
  //     // Basic AutoCAD color palette
  //     const colorPalette = [
  //       { r: 0, g: 0, b: 0 },     // 0 - ByBlock
  //       { r: 255, g: 0, b: 0 },   // 1 - Red
  //       { r: 255, g: 255, b: 0 }, // 2 - Yellow
  //       { r: 0, g: 255, b: 0 },   // 3 - Green
  //       { r: 0, g: 255, b: 255 }, // 4 - Cyan
  //       { r: 0, g: 0, b: 255 },   // 5 - Blue
  //       { r: 255, g: 0, b: 255 }, // 6 - Magenta
  //       { r: 0, g: 0, b: 0 },     // 7 - Black/White
  //     ];
  //     return colorPalette[entity.colorIndex] || { r: 0, g: 0, b: 0 };
  //   }

  //   // Try to get color from layer
  //   if (entity.layer && layers[entity.layer]?.color) {
  //     return layers[entity.layer].color;
  //   }

  //   // Default to black
  //   return { r: 0, g: 0, b: 0 };
  // };
  // Enhanced color detection function
  const getEntityColor = (entity, layers = {}) => {
    // Check for ByLayer color (colorIndex 256)
    if (entity.colorIndex === 256 && entity.layer && layers[entity.layer]) {
      const layerColor = layers[entity.layer].color;
      if (layerColor) return layerColor;
    }

    // If entity has explicit color
    if (entity.color && typeof entity.color === 'object') {
      return entity.color;
    }

    // If entity has color index
    if (entity.colorIndex !== undefined && entity.colorIndex !== 256) {
      // Extended AutoCAD color palette
      const colorPalette = [
        { r: 0, g: 0, b: 0 },     // 0 - ByBlock
        { r: 255, g: 0, b: 0 },   // 1 - Red
        { r: 255, g: 255, b: 0 }, // 2 - Yellow  
        { r: 0, g: 255, b: 0 },   // 3 - Green
        { r: 0, g: 255, b: 255 }, // 4 - Cyan
        { r: 0, g: 0, b: 255 },   // 5 - Blue
        { r: 255, g: 0, b: 255 }, // 6 - Magenta
        { r: 0, g: 0, b: 0 },     // 7 - Black/White
        { r: 128, g: 128, b: 128 }, // 8 - Gray
        { r: 192, g: 192, b: 192 }  // 9 - Light Gray
      ];
      return colorPalette[entity.colorIndex] || { r: 0, g: 0, b: 0 };
    }

    // Try to get color from layer
    if (entity.layer && layers[entity.layer]?.color) {
      return layers[entity.layer].color;
    }

    // Default to black
    return { r: 0, g: 0, b: 0 };
  };

  // Add comprehensive entity analysis function
  const analyzeAllEntities = (entities) => {
    // console.log(`\n=== ANALYZING ${entities.length} ENTITIES ===`);

    const typeCount = {};
    const circularEntities = [];

    entities.forEach((entity, index) => {
      typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;

      // Track anything that could create circles/ellipses
      if (['CIRCLE', 'ELLIPSE', 'ARC'].includes(entity.type)) {
        circularEntities.push({
          index,
          type: entity.type,
          layer: entity.layer,
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle,
          majorAxisEndPoint: entity.majorAxisEndPoint,
          axisRatio: entity.axisRatio,
          handle: entity.handle
        });
      }
    });

    console.log('Entity type counts:', typeCount);
    console.log('Potential circular entities:', circularEntities);

    return { typeCount, circularEntities };
  };

  // Enhanced INSERT debugging
  const debugInsertElement = (e, source, currentTransforms) => {
    const blockName = e.blockName || e.name;
    console.log(`\n=== INSERT DEBUG ===`);
    console.log(`INSERT block: ${blockName}`);
    console.log(`INSERT position:`, e.insertionPoint || e.position);
    console.log(`INSERT scale:`, { x: e.xScale, y: e.yScale });
    console.log(`INSERT rotation:`, e.rotation);

    const blockEntities = blockDefinitions.get(blockName);
    if (blockEntities) {
      const circularInBlock = blockEntities.filter(entity =>
        ['CIRCLE', 'ELLIPSE', 'ARC'].includes(entity.type)
      );

      if (circularInBlock.length > 0) {
        console.log(`WARNING: Block "${blockName}" contains ${circularInBlock.length} circular entities!`);
        console.log('These will be rendered as circles/ellipses in your SVG');
        circularInBlock.forEach(entity => {
          console.log(`  - ${entity.type}:`, entity.center, entity.radius);
        });
      }
    }
  };

  const entityHandlers = {
    LINE: (e, color, stroke, transforms) => {
      const start = e.startPoint || e.start;
      const end = e.endPoint || e.end;
      if (!start || !end) return null;

      const [x1, y1] = applyTransform(start.x, start.y, transforms);
      const [x2, y2] = applyTransform(end.x, end.y, transforms);

      // console.log(`LINE: (${round(x1)}, ${round(y1)}) to (${round(x2)}, ${round(y2)})`);

      updateBounds(x1, y1);
      updateBounds(x2, y2);

      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`;
    },

    ARC: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const { center, radius } = e;
      const startAngle = e.startAngle || 0;
      const endAngle = e.endAngle || 2 * Math.PI;

      // DEBUG: Log arc details
      // console.log(`ARC DEBUG: center(${center.x}, ${center.y}), radius=${radius}`);
      // console.log(`ARC angles: start=${startAngle}, end=${endAngle}, diff=${Math.abs(endAngle - startAngle)}`);
      // console.log(`ARC entity:`, e);

      // Check if this is actually a full circle (this might be the issue!)
      const angleDiff = Math.abs(endAngle - startAngle);
      if (angleDiff >= 2 * Math.PI - 0.001) {
        console.warn(`ARC is actually a full circle! Converting to circle.`);
        // This might be creating your phantom circles!
      }

      const sx = center.x + radius * Math.cos(startAngle);
      const sy = center.y + radius * Math.sin(startAngle);
      const ex = center.x + radius * Math.cos(endAngle);
      const ey = center.y + radius * Math.sin(endAngle);

      const [x1, y1] = applyTransform(sx, sy, transforms);
      const [x2, y2] = applyTransform(ex, ey, transforms);

      updateBounds(x1, y1);
      updateBounds(x2, y2);

      const [cx, cy] = applyTransform(center.x, center.y, transforms);
      updateBounds(cx - radius, cy - radius);
      updateBounds(cx + radius, cy + radius);

      const largeArc = angleDiff > Math.PI ? 1 : 0;
      const sweepFlag = endAngle > startAngle ? 1 : 0;

      return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweepFlag} ${round(x2)} ${round(y2)}" ${stroke} fill="none"/>`;
    },

    // Add this debugging version of your CIRCLE handler
    CIRCLE: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      // DEBUG: Log every circle being created
      // console.log(`CIRCLE DEBUG: center(${e.center.x}, ${e.center.y}), radius=${e.radius}`);
      // console.log(`CIRCLE layer: ${e.layer || 'none'}, colorIndex: ${e.colorIndex}`);
      // console.log(`CIRCLE entity:`, e);

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);

      updateBounds(cx - e.radius, cy - e.radius);
      updateBounds(cx + e.radius, cy + e.radius);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke} fill="none"/>`;
    },

    // Add this debugging version of your ELLIPSE handler  
    ELLIPSE: (e, color, stroke, transforms) => {
      if (!e.center || !e.majorAxisEndPoint) return null;

      // DEBUG: Log every ellipse being created
      // console.log(`ELLIPSE DEBUG: center(${e.center.x}, ${e.center.y})`);
      // console.log(`ELLIPSE majorAxis:`, e.majorAxisEndPoint);
      // console.log(`ELLIPSE axisRatio: ${e.axisRatio}`);
      // console.log(`ELLIPSE layer: ${e.layer || 'none'}, colorIndex: ${e.colorIndex}`);
      // console.log(`ELLIPSE entity:`, e);

      const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
      const ry = rx * (e.axisRatio || 1);

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

      updateBounds(cx - rx, cy - ry);
      updateBounds(cx + rx, cy + ry);

      return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke} fill="none"/>`;
    },

    LWPOLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      const tag = e.closed || e.flags === 1 ? "polygon" : "polyline";
      return `<${tag} points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },

    POLYGON: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 3) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },

    POLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      return `<polyline points="${points.join(' ')}" ${stroke} fill="none"/>`;
    },
    OLE2FRAME: (e, color, stroke, transforms) => {
      // OLE2FRAME typically represents embedded objects (images, documents, etc.)
      // We'll render it as a rectangle with optional border
      if (!e.lowerLeft || !e.upperRight) return null;

      const [x1, y1] = applyTransform(e.lowerLeft.x, e.lowerLeft.y, transforms);
      const [x2, y2] = applyTransform(e.upperRight.x, e.upperRight.y, transforms);

      // Ensure we have proper rectangle coordinates
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      updateBounds(minX, minY);
      updateBounds(minX + width, minY + height);

      console.log(`OLE2FRAME: (${round(minX)}, ${round(minY)}) size ${round(width)}x${round(height)}`);

      // Render as a dashed rectangle to indicate it's an embedded object
      return `<rect x="${round(minX)}" y="${round(minY)}" width="${round(width)}" height="${round(height)}" ${stroke} fill="none" stroke-dasharray="5,5"/>`;
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

            updateBounds(x1, y1);
            updateBounds(x2, y2);
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
      const [x, y] = applyTransform(pt.x, pt.y, transforms);
      updateBounds(x, y);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 8);
      const rotation = e.rotation ? ` transform="rotate(${e.rotation * 180 / Math.PI} ${round(x)} ${round(y)})"` : '';

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" transform="scale(1,-1)" ${rotation}>${escapeXml(e.text)}</text>`;
    },

    TEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(x, y);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 8);
      const rotation = e.rotation ? ` transform="rotate(${e.rotation * 180 / Math.PI} ${round(x)} ${round(y)})"` : '';

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" transform="scale(1,-1)" ${rotation}>${escapeXml(e.text)}</text>`;
    },

    DIMENSION: (e, color, stroke, transforms) => {
      if (config.hideDimensions) return null;

      const items = [];

      if (e.dimensionLine?.start && e.dimensionLine?.end) {
        const [x1, y1] = applyTransform(e.dimensionLine.start.x, e.dimensionLine.start.y, transforms);
        const [x2, y2] = applyTransform(e.dimensionLine.end.x, e.dimensionLine.end.y, transforms);
        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
        updateBounds(x1, y1);
        updateBounds(x2, y2);
      }

      for (const line of e.extensionLines || []) {
        if (line.start && line.end) {
          const [x1, y1] = applyTransform(line.start.x, line.start.y, transforms);
          const [x2, y2] = applyTransform(line.end.x, line.end.y, transforms);
          items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
          updateBounds(x1, y1);
          updateBounds(x2, y2);
        }
      }

      if (e.text && e.textPosition) {
        const [x, y] = applyTransform(e.textPosition.x, e.textPosition.y, transforms);
        updateBounds(x, y);
        items.push(`<text x="${round(x)}" y="${round(y)}" font-size="8" fill="rgb(${color.r},${color.g},${color.b})" text-anchor="middle" transform="scale(1,-1)">${escapeXml(e.text)}</text>`);
      }

      return items.join('');
    },

    POINT: (e, color, stroke, transforms) => {
      if (config.hidePoints || !e.position) return null;

      const [cx, cy] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(cx, cy);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="2" fill="rgb(${color.r},${color.g},${color.b})"/>`;
    },

    SPLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.controlPoints) && !Array.isArray(e.fitPoints)) return null;

      const points = e.controlPoints || e.fitPoints;
      const validPoints = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (validPoints.length < 2) return null;

      const transformedPoints = validPoints.map(pt => {
        const [x, y] = applyTransform(pt.x, pt.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      return config.simplifySplines
        ? `<polyline points="${transformedPoints.join(' ')}" fill="none" ${stroke}/>`
        : `<path d="${transformedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.replace(',', ' ')}`).join(' ')}" fill="none" ${stroke}/>`;
    },

    SOLID: (e, color, stroke, transforms) => {
      if (!e.corners || e.corners.length < 3) return null;

      const points = e.corners.map(corner => {
        const [x, y] = applyTransform(corner.x, corner.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" fill="rgb(${color.r},${color.g},${color.b})" ${stroke}/>`;
    },

    '3DFACE': (e, color, stroke, transforms) => {
      const corners = [e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean);
      if (corners.length < 3) return null;

      const points = corners.map(corner => {
        const [x, y] = applyTransform(corner.x, corner.y, transforms);
        updateBounds(x, y);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" fill="none" ${stroke}/>`;
    }
  };

  // const generateElement = (e, source, currentTransforms) => {
  //   if (!e?.type) {
  //     return null;
  //   }

  //   console.log(`Processing entity: type=${e.type}, source=${source}, handle=${e.handle || 'no-handle'}`);

  //   if (
  //     (e.insertionPoint?.x === 0 && e.insertionPoint?.y === 0) ||
  //     (e.position?.x === 0 && e.position?.y === 0)
  //   ) {
  //     console.warn(`ENTITY AT ORIGIN: type=${e.type}, source=${source}, handle=${e.handle}`);
  //   }

  //   if (e.handle) {
  //     renderedHandles.add(e.handle);
  //   }

  //   const key = `${e.type}(${source})`;
  //   entityStats.set(key, (entityStats.get(key) || 0) + 1);

  //   const handler = entityHandlers[e.type];
  //   if (!handler) {
  //     console.warn(`No handler for entity type: ${e.type}`);
  //     return null;
  //   }

  //   try {
  //     const layers = tables.LAYER?.entries || {};
  //     const color = getEntityColor(e, layers);
  //     const strokeWidth = normalizeStrokeWidth();
  //     const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${strokeWidth}"`;

  //     const result = handler(e, color, stroke, currentTransforms);
  //     if (result) processedElements++;
  //     return result;
  //   } catch (err) {
  //     console.warn(`Error processing ${e.type} from ${source}:`, err);
  //     return null;
  //   }
  // };

  // Modified generateElement function
  const generateElement = (e, source, currentTransforms) => {
    if (!e?.type) {
      return null;
    }

    // console.log(`Processing entity: type=${e.type}, source=${source}, handle=${e.handle || 'no-handle'}`);

    // Check if entity should be rendered based on layer visibility and flags
    const layers = tables.LAYER?.entries || {};
    if (!shouldRenderEntity(e, layers)) {
      return null;
    }

    if (
      (e.insertionPoint?.x === 0 && e.insertionPoint?.y === 0) ||
      (e.position?.x === 0 && e.position?.y === 0)
    ) {
      console.warn(`ENTITY AT ORIGIN: type=${e.type}, source=${source}, handle=${e.handle}`);
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
      const color = getEntityColor(e, layers);
      const strokeWidth = normalizeStrokeWidth();
      const stroke = `stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="${strokeWidth}"`;

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
    const insertEntities = [];
    const regularEntities = [];

    // Separate INSERT entities from regular entities
    for (const e of entities) {
      if (!e?.type) continue;

      if (e.type === 'INSERT') {
        insertEntities.push(e);
      } else {
        regularEntities.push(e);
      }
    }

    // Process regular entities first
    if (regularEntities.length > 0) {
      const regularElements = [];
      for (const e of regularEntities) {
        const element = generateElement(e, source, currentTransforms);
        if (element) {
          regularElements.push(element);
        }
      }

      if (regularElements.length > 0) {
        content.push(`<g id="${escapeXml(source)}_entities">
${regularElements.join('\n')}
</g>`);
      }
    }

    // Process INSERT entities with <use> tags
    for (const e of insertEntities) {
      const useElement = generateInsertUseElement(e, source, currentTransforms);
      if (useElement) {
        content.push(useElement);
      }
    }

    return content;
  };

  const generateInsertUseElement = (e, source, currentTransforms) => {
    const blockName = e.blockName || e.name;
    if (!blockName) {
      console.warn('INSERT entity missing blockName');
      return null;
    }

    debugInsertElement(e, source, currentTransforms);

    const blockEntities = blockDefinitions.get(blockName);
    if (!blockEntities || !Array.isArray(blockEntities)) {
      console.warn(`Block definition not found for: ${blockName}`);
      return null;
    }

    // Get insertion point with defaults
    const insertPoint = e.insertionPoint || e.position || { x: 0, y: 0, z: 0 };

    // Get scale factors with defaults and validation
    let xScale = e.xScale ?? e.scaleX ?? e.scale?.x ?? 1;
    let yScale = e.yScale ?? e.scaleY ?? e.scale?.y ?? 1;

    // Clamp scale values to reasonable range
    xScale = Math.max(Math.min(xScale, 1000), 0.001);
    yScale = Math.max(Math.min(yScale, 1000), 0.001);

    const rotation = e.rotation ?? e.rotationAngle ?? 0;

    console.log(`INSERT ${blockName}: pos(${insertPoint.x}, ${insertPoint.y}), scale(${xScale}, ${yScale}), rot(${rotation})`);

    // Generate unique ID for this INSERT instance
    const insertId = blockIdCounter.value++;
    const groupId = `${insertId}`;

    // Create transform string
    const translateTransform = `translate(${round(insertPoint.x)},${round(insertPoint.y)})`;
    const rotateTransform = rotation !== 0 ? ` rotate(${round(rotation * 180 / Math.PI)})` : '';
    const scaleTransform = (xScale !== 1 || yScale !== 1) ? ` scale(${round(xScale)},${round(yScale)})` : '';
    const transformAttr = `${translateTransform}${rotateTransform}${scaleTransform}`;

    // Update bounds for the insertion point
    updateBounds(insertPoint.x, insertPoint.y);

    return `<g id="${groupId}" stroke="rgb(0,0,0)" fill="none">
  <use href="#${escapeXml(blockName)}" transform="${transformAttr}"/>
</g>`;
  };

  const generateBlockDefinitions = () => {
    const defs = [];

    for (const [blockName, blockEntities] of blockDefinitions) {
      if (!Array.isArray(blockEntities) || blockEntities.length === 0) continue;

      const blockContent = [];
      for (const entity of blockEntities) {
        if (!entity?.type) continue;

        const element = generateElement(entity, `Block_${blockName}`, []);
        if (element) {
          blockContent.push(element);
        }
      }

      if (blockContent.length > 0) {
        defs.push(`  <g id="${escapeXml(blockName)}">
${blockContent.map(content => `    ${content}`).join('\n')}
  </g>`);
      }
    }

    return defs.length > 0 ? `<defs>
${defs.join('\n')}
</defs>` : '';
  };

  const validateAndFixBounds = () => {
    if (!bounds.valid || bounds.minX === Infinity || bounds.maxX === -Infinity) {
      console.warn('Invalid bounds detected, resetting...');
      bounds.minX = 0;
      bounds.minY = 0;
      bounds.maxX = 100;
      bounds.maxY = 100;
      bounds.valid = true;
      return;
    }

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Check for tiny bounds (less than 1 unit)
    if (width < 1 || height < 1) {
      console.warn(`Tiny bounds detected: ${width} x ${height}, expanding...`);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const minSize = 100;

      bounds.minX = centerX - minSize / 2;
      bounds.maxX = centerX + minSize / 2;
      bounds.minY = centerY - minSize / 2;
      bounds.maxY = centerY + minSize / 2;
    }

    // Check for extremely large bounds
    if (width > 1000000 || height > 1000000) {
      console.warn(`Huge bounds detected: ${width} x ${height}, capping...`);
      bounds.minX = Math.max(bounds.minX, -50000);
      bounds.maxX = Math.min(bounds.maxX, 50000);
      bounds.minY = Math.max(bounds.minY, -50000);
      bounds.maxY = Math.min(bounds.maxY, 50000);
    }
  };

  const generateSVGContent = () => {
    const content = [];

    // Only handle MODEL_SPACE entities from db.entities
    if (Array.isArray(db.entities) && db.entities.length > 0) {
      console.log(`Processing ${db.entities.length} entities from db.entities`);
      analyzeAllEntities(db.entities);
      const modelContent = processEntities(db.entities, '*Model_Space', transformStack);
      content.push(...modelContent);
    } else {
      console.warn('No db.entities found or empty array');
    }

    return content;
  };

  const blockDefs = generateBlockDefinitions();
  const svgElements = generateSVGContent();
  const svgContent = svgElements.join('\n');

  validateAndFixBounds();

  console.log(`Final processed ${processedElements} elements`);
  console.log('Entity stats:', Object.fromEntries(entityStats));
  console.log('Final bounds:', bounds);

  if (!bounds.valid || bounds.minX === Infinity) {
    console.warn('No valid bounds found, using default');
    Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  console.log(`Calculated width: ${width}, height: ${height}`);
  const padding = Math.min(width, height) * 0.25;
  console.log(`Calculated padding: ${padding}`);
  const viewBox = `${round(bounds.minX - padding)} ${round(-(bounds.maxY + padding))} ${round(width + 2 * padding)} ${round(height + 2 * padding)}`;

  console.log(`SVG viewBox: ${viewBox}`);
  console.log(`SVG dimensions: ${round(width)} x ${round(height)}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap:round;stroke-linejoin:round;background:white">
  ${blockDefs}
  <g transform="scale(1,-1)">
    ${svgContent}
  </g>
</svg>`;
}