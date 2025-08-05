export function convertToSvg(db, transformStack = [], visibleLayers = null, highlightedEntityHandle = null) {
  const tables = db.tables || {};

  if (!tables.BLOCK_RECORD?.entries?.length && !db.entities?.length) {
    console.warn('No BLOCK_RECORD entries or entities found');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  const shouldShowAllLayers = !visibleLayers || !Array.isArray(visibleLayers);

  console.log('Layer visibility control:', {
    visibleLayers,
    shouldShowAllLayers,
    totalVisibleLayers: visibleLayers?.length || 'all'
  });

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
  const skippedByLayer = new Map();
  const existingHandles = new Set((db.entities || []).map(e => e.handle));

  const config = {
    hideDimensions: false,
    hideText: false,
    hidePoints: true,
    simplifySplines: true,
    strokeWidth: 0.5,
    textSizeMultiplier: 0.3
  };

  const round = (num) => Math.round(num * 10000) / 10000;
  const normalizeStrokeWidth = () => 8;

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

      const scaledX = px * sx;
      const scaledY = py * sy;

      const rotatedX = scaledX * cos - scaledY * sin;
      const rotatedY = scaledX * sin + scaledY * cos;

      px = rotatedX + tx;
      py = rotatedY + ty;
    }

    return [px, py];
  };

  const processedForBounds = new Set();
  const updateBounds = (x, y, entityType = 'unknown', entityHandle = '') => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn(`Invalid bounds update: (${x}, ${y}) from ${entityType}:${entityHandle}`);
      return;
    }

    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
      console.warn(`Ignoring extreme coordinate: (${x}, ${y}) from ${entityType}:${entityHandle}`);
      return;
    }

    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.valid = true;

    const entityKey = `${entityType}:${entityHandle}`;
    if (!processedForBounds.has(entityKey)) {
      processedForBounds.add(entityKey);
    }
  };

  const xmlEscapeMap = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ]);

  const isLayerVisible = (layerName) => {
    if (shouldShowAllLayers) {
      return true;
    }

    if (!layerName) {
      return true;
    }

    const isVisible = visibleLayers.includes(layerName);

    if (!isVisible) {
      skippedByLayer.set(layerName, (skippedByLayer.get(layerName) || 0) + 1);
    }

    return isVisible;
  };

  const shouldRenderEntity = (entity, layers = {}) => {
    if (entity.layer && !isLayerVisible(entity.layer)) {
      console.log(`Skipping entity on hidden layer: ${entity.layer} (type: ${entity.type})`);
      return false;
    }

    const layerInfo = layers[entity.layer];
    if (layerInfo) {
      if (layerInfo.frozen === true || (layerInfo.flags && layerInfo.flags & 4)) return false;
      if (layerInfo.off === true || (layerInfo.flags && layerInfo.flags & 2)) return false;
      if (layerInfo.flags && layerInfo.flags & 1) return false;
    }

    if (entity.invisible === true || (entity.flags && entity.flags & 1)) {
      console.log(`Skipping invisible entity: ${entity.type}`);
      return false;
    }

    if (entity.plotFlag === false) {
      console.log(`Skipping non-plotting entity: ${entity.type}`);
      return false;
    }

    return true;
  };

  const escapeXml = (text) => String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));

  const blockDefinitions = new Map();
  if (tables.BLOCK_RECORD?.entries) {
    for (const blockRecord of tables.BLOCK_RECORD.entries) {
      if (blockRecord.name && blockRecord.entities) {
        blockDefinitions.set(blockRecord.name, blockRecord.entities);
      }
    }
  }

  const getEntityColor = (entity, layers = {}) => {
    if (entity.colorIndex === 256 && entity.layer && layers[entity.layer]) {
      const layerColor = layers[entity.layer].color;
      if (layerColor) return layerColor;
    }

    if (entity.color && typeof entity.color === 'object') {
      return entity.color;
    }

    if (entity.colorIndex !== undefined && entity.colorIndex !== 256) {
      const colorPalette = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 255, b: 255 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 255 },
        { r: 0, g: 0, b: 0 },
        { r: 128, g: 128, b: 128 },
        { r: 192, g: 192, b: 192 }
      ];
      return colorPalette[entity.colorIndex] || { r: 0, g: 0, b: 0 };
    }

    if (entity.layer && layers[entity.layer]?.color) {
      return layers[entity.layer].color;
    }

    return { r: 0, g: 0, b: 0 };
  };

  const analyzeAllEntities = (entities) => {
    const typeCount = {};
    const circularEntities = [];
    const layerCount = {};

    entities.forEach((entity, index) => {
      typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;

      if (entity.layer) {
        layerCount[entity.layer] = (layerCount[entity.layer] || 0) + 1;
      }

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


    return { typeCount, circularEntities, layerCount };
  };

  const debugInsertElement = (e, source, currentTransforms) => {
    const blockName = e.blockName || e.name;

    const blockEntities = blockDefinitions.get(blockName);
    if (blockEntities) {
      const circularInBlock = blockEntities.filter(entity =>
        ['CIRCLE', 'ELLIPSE', 'ARC'].includes(entity.type)
      );
    }
  };

  const entityHandlers = {
    LINE: (e, color, stroke, transforms) => {
      const start = e.startPoint || e.start;
      const end = e.endPoint || e.end;
      if (!start || !end) return null;

      const [x1, y1] = applyTransform(start.x, start.y, transforms);
      const [x2, y2] = applyTransform(end.x, end.y, transforms);

      updateBounds(x1, y1, 'LINE', e.handle);
      updateBounds(x2, y2, 'LINE', e.handle);

      let finalStroke = stroke;

      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${finalStroke}/>`;
    },

    ARC: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const { center, radius } = e;
      const startAngle = e.startAngle || 0;
      const endAngle = e.endAngle || 2 * Math.PI;

      const angleDiff = Math.abs(endAngle - startAngle);
      if (angleDiff >= 2 * Math.PI - 0.001) {
        console.warn(`ARC is actually a full circle! Converting to circle.`);
      }

      const sx = center.x + radius * Math.cos(startAngle);
      const sy = center.y + radius * Math.sin(startAngle);
      const ex = center.x + radius * Math.cos(endAngle);
      const ey = center.y + radius * Math.sin(endAngle);

      const [x1, y1] = applyTransform(sx, sy, transforms);
      const [x2, y2] = applyTransform(ex, ey, transforms);

      updateBounds(x1, y1, 'ARC', e.handle);
      updateBounds(x2, y2, 'ARC', e.handle);

      const [cx, cy] = applyTransform(center.x, center.y, transforms);
      updateBounds(cx - radius, cy - radius, 'ARC', e.handle);
      updateBounds(cx + radius, cy + radius, 'ARC', e.handle);

      const largeArc = angleDiff > Math.PI ? 1 : 0;
      const sweepFlag = endAngle > startAngle ? 0 : 1;

      return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweepFlag} ${round(x2)} ${round(y2)}" ${stroke}/>`;
    },

    CIRCLE: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);

      updateBounds(cx - e.radius, cy - e.radius, 'CIRCLE', e.handle);
      updateBounds(cx + e.radius, cy + e.radius, 'CIRCLE', e.handle);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke}/>`;
    },

    ELLIPSE: (e, color, stroke, transforms) => {
      if (!e.center || !e.majorAxisEndPoint) return null;

      const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
      const ry = rx * (e.axisRatio || 1);

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

      updateBounds(cx - rx, cy - ry, 'ELLIPSE', e.handle);
      updateBounds(cx + rx, cy + ry, 'ELLIPSE', e.handle);

      return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke}/>`;
    },

    LWPOLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'LWPOLYLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      const tag = e.closed || e.flags === 1 ? "polygon" : "polyline";
      return `<${tag} points="${points.join(' ')}" ${stroke}/>`;
    },

    POLYGON: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 3) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'POLYGON', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" ${stroke}/>`;
    },

    POLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'POLYLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return `<polyline points="${points.join(' ')}" ${stroke}/>`;
    },

    OLE2FRAME: (e, color, stroke, transforms) => {
      if (!e.lowerLeft || !e.upperRight) return null;

      const [x1, y1] = applyTransform(e.lowerLeft.x, e.lowerLeft.y, transforms);
      const [x2, y2] = applyTransform(e.upperRight.x, e.upperRight.y, transforms);

      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      updateBounds(minX, minY, 'OLE2FRAME', e.handle);
      updateBounds(minX + width, minY + height, 'OLE2FRAME', e.handle);

      // Remove fill="none" from stroke since it's already included, add stroke-dasharray
      const frameStroke = stroke.replace(/fill="[^"]*"\s*/, '') + ' stroke-dasharray="5,5"';
      return `<rect x="${round(minX)}" y="${round(minY)}" width="${round(width)}" height="${round(height)}" ${frameStroke}/>`;
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

            updateBounds(x1, y1, 'HATCH', e.handle);
            updateBounds(x2, y2, 'HATCH', e.handle);
          }
        }

        if (pathData) {
          pathData += ' Z';
          // Use the stroke as-is since it already contains the correct fill value
          paths.push(`<path d="${pathData}" ${stroke}/>`);
        }
      }

      return paths.join('');
    },

    MTEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !(e.insert || e.insertionPoint)) return null;

      const pt = e.insert || e.insertionPoint;
      const [x, y] = applyTransform(pt.x, pt.y, transforms);
      updateBounds(x, y, 'MTEXT', e.handle);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 8);
      const rotation = e.rotation ? ` transform="rotate(${e.rotation * 180 / Math.PI} ${round(x)} ${round(y)}) scale(1,-1)"` : ' transform="scale(1,-1)"';

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})"${rotation}>${escapeXml(e.text)}</text>`;
    },

    TEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(x, y, 'TEXT', e.handle);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 8);
      const rotation = e.rotation ? ` transform="rotate(${e.rotation * 180 / Math.PI} ${round(x)} ${round(y)}) scale(1,-1)"` : ' transform="scale(1,-1)"';

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})"${rotation}>${escapeXml(e.text)}</text>`;
    },

    DIMENSION: (e, color, stroke, transforms) => {
      if (config.hideDimensions) return null;

      const items = [];

      if (e.dimensionLine?.start && e.dimensionLine?.end) {
        const [x1, y1] = applyTransform(e.dimensionLine.start.x, e.dimensionLine.start.y, transforms);
        const [x2, y2] = applyTransform(e.dimensionLine.end.x, e.dimensionLine.end.y, transforms);
        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
        updateBounds(x1, y1, 'DIMENSION', e.handle);
        updateBounds(x2, y2, 'DIMENSION', e.handle);
      }

      if (Array.isArray(e.extensionLines)) {
        for (const line of e.extensionLines) {
          if (line?.start && line?.end) {
            const [x1, y1] = applyTransform(line.start.x, line.start.y, transforms);
            const [x2, y2] = applyTransform(line.end.x, line.end.y, transforms);
            items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
            updateBounds(x1, y1, 'DIMENSION', e.handle);
            updateBounds(x2, y2, 'DIMENSION', e.handle);
          }
        }
      }

      if (e.text && e.textPosition) {
        const [x, y] = applyTransform(e.textPosition.x, e.textPosition.y, transforms);
        updateBounds(x, y, 'DIMENSION', e.handle);
        items.push(`<text x="${round(x)}" y="${round(y)}" font-size="8" fill="rgb(${color.r},${color.g},${color.b})" text-anchor="middle" transform="scale(1,-1)">${escapeXml(e.text)}</text>`);
      }

      if (items.length === 0 && e.defPoint1 && e.defPoint2) {
        const [x1, y1] = applyTransform(e.defPoint1.x, e.defPoint1.y, transforms);
        const [x2, y2] = applyTransform(e.defPoint2.x, e.defPoint2.y, transforms);
        const dashedStroke = stroke + ' stroke-dasharray="2,2"';
        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${dashedStroke}/>`);
        updateBounds(x1, y1, 'DIMENSION', e.handle);
        updateBounds(x2, y2, 'DIMENSION', e.handle);
      }

      return items.length > 0 ? items.join('') : null;
    },

    POINT: (e, color, stroke, transforms) => {
      if (config.hidePoints || !e.position) return null;

      const [cx, cy] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(cx, cy, 'POINT', e.handle);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="2" fill="rgb(${color.r},${color.g},${color.b})"/>`;
    },

    SPLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.controlPoints) && !Array.isArray(e.fitPoints)) return null;

      const points = e.controlPoints || e.fitPoints;
      const validPoints = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (validPoints.length < 2) return null;

      const transformedPoints = validPoints.map(pt => {
        const [x, y] = applyTransform(pt.x, pt.y, transforms);
        updateBounds(x, y, 'SPLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return config.simplifySplines
        ? `<polyline points="${transformedPoints.join(' ')}" ${stroke}/>`
        : `<path d="${transformedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.replace(',', ' ')}`).join(' ')}" ${stroke}/>`;
    },

    SOLID: (e, color, stroke, transforms) => {
      if (!e.corners || e.corners.length < 3) return null;

      const points = e.corners.map(corner => {
        const [x, y] = applyTransform(corner.x, corner.y, transforms);
        updateBounds(x, y, 'SOLID', e.handle);
        return `${round(x)},${round(y)}`;
      });

      // For SOLID entities, we want to fill with color and use stroke for border
      const solidStroke = stroke.replace(/fill="[^"]*"/, `fill="rgb(${color.r},${color.g},${color.b})"`);
      return `<polygon points="${points.join(' ')}" ${solidStroke}/>`;
    },

    '3DFACE': (e, color, stroke, transforms) => {
      const corners = [e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean);
      if (corners.length < 3) return null;

      const points = corners.map(corner => {
        const [x, y] = applyTransform(corner.x, corner.y, transforms);
        updateBounds(x, y, '3DFACE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" ${stroke}/>`;
    },

    INSERT: (e, color, stroke, transforms) => {
      const blockName = e.blockName || e.name;
      if (!blockName) return null;

      const blockEntities = blockDefinitions.get(blockName);
      if (!blockEntities || !blockEntities.some(be => be?.type && entityHandlers[be.type])) {
        return null;
      }

      const insertPoint = e.insertionPoint || e.position;
      let xScale = e.xScale ?? e.scaleX ?? e.scale?.x ?? 1;
      let yScale = e.yScale ?? e.scaleY ?? e.scale?.y ?? 1;
      const rotation = e.rotation ?? e.rotationAngle ?? 0;

      xScale = Math.max(Math.min(xScale, 1000), 0.001);
      yScale = Math.max(Math.min(yScale, 1000), 0.001);

      const translate = `translate(${round(insertPoint.x)},${round(insertPoint.y)})`;
      const rotate = rotation !== 0 ? ` rotate(${round(rotation * 180 / Math.PI)})` : '';
      const scale = (xScale !== 1 || yScale !== 1) ? ` scale(${round(xScale)},${round(yScale)})` : '';
      const transformAttr = `${translate}${rotate}${scale}`;

      const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;

      let useAttributes;
      if (isHighlighted) {
        useAttributes = `stroke="red" stroke-width="12" fill="rgba(255,0,0,0.4)" opacity="1"`;
      } else {
        useAttributes = `stroke="black" fill="none" stroke-width="1"`;
      }

      const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
      const dataLayer = e.layer ? `data-layer="${e.layer}"` : '';
      const dataType = `data-type="INSERT"`;
      const dataBlock = `data-block="${blockName}"`;
      const entityClass = `class="dwg-entity deletable-entity insert-block"`;
      const hoverStyle = `style="cursor: pointer; transition: all 0.2s;"`;

      return `<use href="#${escapeXml(blockName)}" transform="${transformAttr}" ${useAttributes} ${dataHandle} ${dataLayer} ${dataType} ${dataBlock} ${entityClass} ${hoverStyle} />`;
    },
  };

  const generateElement = (e, source, currentTransforms, highlightedEntityHandle) => {
    if (!e?.type) {
      return null;
    }

    const layerInfo = tables.LAYER?.entries?.reduce((acc, layer) => {
      acc[layer.name] = layer;
      return acc;
    }, {}) || {};

    if (!shouldRenderEntity(e, layerInfo)) {
      return null;
    }

    if (
      (e.insertionPoint?.x === 0 && e.insertionPoint?.y === 0) ||
      (e.position?.x === 0 && e.position?.y === 0)
    ) {
      if (e.type !== 'DIMENSION') {
        console.warn(`ENTITY AT ORIGIN: type=${e.type}, source=${source}, handle=${e.handle}, layer=${e.layer}`);
        return null;
      }
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
      const color = getEntityColor(e, layerInfo);
      const strokeWidth = normalizeStrokeWidth();

      const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;

      let strokeColor, strokeWidth_final, fillColor, strokeDashArray, strokeOpacity;

      if (isHighlighted) {
        strokeColor = '#FF0000';
        strokeWidth_final = '15';
        fillColor = e.type === 'HATCH' ? 'rgba(255, 0, 0, 0.3)' : 'none';
        strokeDashArray = '8,4';
        strokeOpacity = '1';
      } else {
        strokeColor = `rgb(${color.r},${color.g},${color.b})`;
        strokeWidth_final = strokeWidth;
        fillColor = e.type === 'HATCH' ? 'rgba(0,0,0,0.2)' : 'none';
        strokeDashArray = 'none';
        strokeOpacity = '0.8';
      }

      const stroke = `stroke="${strokeColor}" stroke-width="${strokeWidth_final}" fill="${fillColor}" stroke-dasharray="${strokeDashArray}" stroke-opacity="${strokeOpacity}"`;

      const result = handler(e, color, stroke, currentTransforms);
      if (result && e.handle) {
        const dataHandle = `data-handle="${e.handle}"`;
        const dataLayer = e.layer ? `data-layer="${e.layer}"` : '';
        const dataType = `data-type="${e.type}"`;
        const highlightClass = isHighlighted ? 'highlighted-entity' : 'dwg-entity';
        const entityClass = `class="${highlightClass} deletable-entity clickable-entity"`;
        const clickAttributes = `style="cursor: pointer; transition: opacity 0.2s;"`;

        if (!result.includes('data-handle="')) {
          if (result.startsWith('<g ') || result.startsWith('<g>')) {
            const insertPos = result.indexOf('>');
            const updatedResult = result.slice(0, insertPos) +
              ` ${dataHandle} ${dataLayer} ${dataType} ${entityClass} ${clickAttributes}` +
              result.slice(insertPos);
            if (updatedResult) processedElements++;
            return updatedResult;
          } else {
            const tagMatch = result.match(/^<(\w+)/);
            if (tagMatch) {
              const insertPos = result.indexOf(' ') > 0 ? result.indexOf(' ') : result.indexOf('>');
              const updatedResult = result.slice(0, insertPos) +
                ` ${dataHandle} ${dataLayer} ${dataType} ${entityClass} ${clickAttributes}` +
                result.slice(insertPos);
              if (updatedResult) processedElements++;
              return updatedResult;
            }
          }
        }
      }

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

    for (const e of entities) {
      if (!e?.type) continue;

      if (e.type === 'INSERT') {
        insertEntities.push(e);
      } else {
        regularEntities.push(e);
      }
    }

    if (regularEntities.length > 0) {
      const regularElements = [];
      for (const e of regularEntities) {
        const element = generateElement(e, source, currentTransforms, highlightedEntityHandle);
        if (element) {
          regularElements.push(element);
        }
      }

      if (regularElements.length > 0) {
        content.push(`<g id="${escapeXml(source)}" class="entity-group">
${regularElements.join('\n')}
</g>`);
      }
    }

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

    const layerInfo = tables.LAYER?.entries?.reduce((acc, layer) => {
      acc[layer.name] = layer;
      return acc;
    }, {}) || {};

    if (!shouldRenderEntity(e, layerInfo)) {
      return null;
    }

    debugInsertElement(e, source, currentTransforms);

    const blockEntities = blockDefinitions.get(blockName);
    if (!blockEntities || !Array.isArray(blockEntities)) {
      console.warn(`Block definition not found for: ${blockName}`);
      return null;
    }

    const insertPoint = e.insertionPoint || e.position;
    if (!insertPoint || Math.abs(insertPoint.x) < 1e-6 && Math.abs(insertPoint.y) < 1e-6) {
      console.warn(`Skipping INSERT at origin or missing insertion point: block=${blockName}, handle=${e.handle}, layer=${e.layer}`);
      return null;
    }

    let xScale = e.xScale ?? e.scaleX ?? e.scale?.x ?? 1;
    let yScale = e.yScale ?? e.scaleY ?? e.scale?.y ?? 1;

    xScale = Math.max(Math.min(xScale, 1000), 0.001);
    yScale = Math.max(Math.min(yScale, 1000), 0.001);

    const rotation = e.rotation ?? e.rotationAngle ?? 0;

    const insertId = blockIdCounter.value++;
    const groupId = `${insertId}`;

    const translateTransform = `translate(${round(insertPoint.x)},${round(insertPoint.y)})`;
    const rotateTransform = rotation !== 0 ? ` rotate(${round(rotation * 180 / Math.PI)})` : '';
    const scaleTransform = (xScale !== 1 || yScale !== 1) ? ` scale(${round(xScale)},${round(yScale)})` : '';
    const transformAttr = `${translateTransform}${rotateTransform}${scaleTransform}`;

    updateBounds(insertPoint.x, insertPoint.y);

    const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;

    let strokeStyle, fillStyle, filterStyle, strokeWidth_final;
    if (isHighlighted) {
      strokeStyle = 'stroke="red"';
      fillStyle = 'fill="rgba(255, 0, 0, 1)"';
      filterStyle = 'style="filter: drop-shadow(0 0 10px red);"';
      strokeWidth_final = '10';
    } else {
      strokeStyle = 'stroke="rgb(0,0,0)"';
      fillStyle = 'fill="none"';
      filterStyle = '';
      strokeWidth_final = normalizeStrokeWidth();
    }

    // Add data attributes for identification
    const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
    const dataLayer = e.layer ? `data-layer="${e.layer}"` : '';
    const dataType = `data-type="INSERT"`;
    const dataBlock = `data-block="${blockName}"`;
    const entityClass = isHighlighted ?
      `class="dwg-entity deletable-entity insert-block highlighted-entity"` :
      `class="dwg-entity deletable-entity insert-block"`;

    // Combine all attributes for the use element, avoiding duplicates
    const useAttributes = `${strokeStyle} ${fillStyle} ${filterStyle}`.trim();

    return `<g id="${e.handle}" stroke-width="${strokeWidth_final}" ${dataHandle} ${dataLayer} ${dataType} ${dataBlock} ${entityClass}>
  <use href="#${escapeXml(blockName)}" transform="${transformAttr}" ${useAttributes} />
</g>`;
  };

  const generateBlockDefinitions = () => {
    const defs = [];

    for (const [blockName, blockEntities] of blockDefinitions) {
      if (!Array.isArray(blockEntities) || blockEntities.length === 0) continue;

      const blockContent = [];
      for (const entity of blockEntities) {
        if (!entity?.type) continue;

        const element = generateElement(entity, `Block_${blockName}`, [], highlightedEntityHandle);
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

    if (width < 10 || height < 10) {
      console.warn(`Tiny bounds detected: ${width} x ${height}, expanding...`);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const minSize = Math.max(width * 10, height * 10, 1000);

      bounds.minX = centerX - minSize / 2;
      bounds.maxX = centerX + minSize / 2;
      bounds.minY = centerY - minSize / 2;
      bounds.maxY = centerY + minSize / 2;
    }

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

    if (Array.isArray(db.entities) && db.entities.length > 0) {
      console.log(`Processing ${db.entities.length} entities from db.entities`);

      const analysis = analyzeAllEntities(db.entities);
      console.log('Layer analysis from entities:', analysis.layerCount);

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

  if (!bounds.valid || bounds.minX === Infinity || bounds.maxX === -Infinity) {
    console.error('CRITICAL: No valid bounds found after processing all entities!');
    console.log('Attempting emergency bounds from entity positions...');

    if (!bounds.valid) {
      console.error('Using default bounds as last resort');
      Object.assign(bounds, { minX: -100, minY: -100, maxX: 100, maxY: 100, valid: true });
    }
  }

  // db.entities = db.entities.filter(e => {
  //   if (e.type !== 'INSERT') return true;
  //   const pt = e.insertionPoint || e.position;
  //   if (!pt) return false;

  //   const nearOrigin = Math.abs(pt.x) < 1e-6 && Math.abs(pt.y) < 1e-6;
  //   const isClutterLayer = e.layer === 'I-FURN';

  //   if (nearOrigin && isClutterLayer) {
  //     console.warn(`Skipping INSERT at origin on I-FURN: block=${e.blockName}, handle=${e.handle}`);
  //     return false;
  //   }

  //   return true;
  // });

  // --- Outlier filtering for bounds ---
  const allPoints = [];
  for (const entity of db.entities || []) {
    if (entity.startPoint) allPoints.push([entity.startPoint.x, entity.startPoint.y]);
    if (entity.endPoint) allPoints.push([entity.endPoint.x, entity.endPoint.y]);
    if (entity.center) allPoints.push([entity.center.x, entity.center.y]);
    if (entity.position) allPoints.push([entity.position.x, entity.position.y]);
    if (entity.vertices) entity.vertices.forEach(v => allPoints.push([v.x, v.y]));
    if (entity.corners) entity.corners.forEach(c => allPoints.push([c.x, c.y]));
    if (entity.lowerLeft) allPoints.push([entity.lowerLeft.x, entity.lowerLeft.y]);
    if (entity.upperRight) allPoints.push([entity.upperRight.x, entity.upperRight.y]);
  }
  if (allPoints.length > 10) { // Only filter if enough points
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const xs = allPoints.map(p => p[0]);
    const ys = allPoints.map(p => p[1]);
    const cx = mean(xs);
    const cy = mean(ys);
    const stdX = Math.sqrt(mean(xs.map(x => (x - cx) ** 2)));
    const stdY = Math.sqrt(mean(ys.map(y => (y - cy) ** 2)));
    const filteredPoints = allPoints.filter(([x, y]) =>
      Math.abs(x - cx) < 3 * stdX && Math.abs(y - cy) < 3 * stdY
    );
    if (filteredPoints.length > 0) {
      bounds.minX = Math.min(...filteredPoints.map(p => p[0]));
      bounds.maxX = Math.max(...filteredPoints.map(p => p[0]));
      bounds.minY = Math.min(...filteredPoints.map(p => p[1]));
      bounds.maxY = Math.max(...filteredPoints.map(p => p[1]));
      bounds.valid = true;
    }
  }

  validateAndFixBounds();

  if (skippedByLayer.size > 0) {
    console.log('Entities skipped by layer:', Object.fromEntries(skippedByLayer));
  }

  console.log(`Final processed ${processedElements} elements`);
  console.log('Entity stats:', Object.fromEntries(entityStats));
  console.log('Final bounds:', bounds);
  console.log('Layer visibility summary:', {
    visibleLayers: visibleLayers,
    totalSkippedLayers: skippedByLayer.size,
    skippedLayerNames: Array.from(skippedByLayer.keys())
  });

  if (!bounds.valid || bounds.minX === Infinity) {
    console.warn('No valid bounds found, using default');
    Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  }

  console.log('=== FINAL BOUNDS CALCULATION ===');
  console.log('Final bounds:', bounds);
  console.log('Total unique entities processed for bounds:', processedForBounds.size);

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  console.log(`Calculated width: ${width}, height: ${height}`);

  if (width < 1 || height < 1) {
    console.error('⚠️ BOUNDS TOO SMALL!');
    console.log('This suggests entities are not being processed correctly or coordinates are very small');
  }

  if (width > 100000 || height > 100000) {
    console.warn('⚠️ BOUNDS VERY LARGE!');
    console.log('This might indicate coordinate system issues');
  }

  const svgStyles = `
<style>
  .dwg-entity:hover {
    opacity: 0.7 !important;
    stroke-width: 3 !important;
  }
  .deletable-entity {
    cursor: pointer;
  }
  .clickable-entity:hover {
    stroke: #ff6b6b !important;
    stroke-width: 4 !important;
    opacity: 0.8 !important;
  }
  .insert-block:hover {
    stroke: #ff6b6b !important;
    stroke-width: 3 !important;
    fill: rgba(255, 107, 107, 0.2) !important;
  }
  .highlighted-entity {
    stroke: red !important;
    stroke-width: 6 !important;
    fill: rgba(255, 0, 0, 0.3) !important;
    animation: pulse-highlight 1s infinite alternate;
  }
  .highlighted-entity use {
    stroke: red !important;
    stroke-width: 8 !important;
    fill: rgba(255, 0, 0, 0.4) !important;
  }
  g.highlighted-entity {
    filter: drop-shadow(0 0 15px rgba(255, 0, 0, 0.8)) !important;
  }
  
  @keyframes pulse-highlight {
    from { opacity: 0.8; }
    to { opacity: 1; }
  }
  
  /* Entity hover tooltip */
  .entity-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
</style>
`;

  const padding = Math.max(width, height) * 0.1;
  console.log(`Final calculated padding: ${padding}`);

  const viewBoxMinX = bounds.minX - padding;
  const viewBoxMinY = -(bounds.maxY + padding);
  const viewBoxWidth = width + (2 * padding);
  const viewBoxHeight = height + (2 * padding);

  const viewBox = `${round(viewBoxMinX)} ${round(viewBoxMinY)} ${round(viewBoxWidth)} ${round(viewBoxHeight)}`;

  console.log(`FINAL SVG viewBox: ${viewBox}`);
  console.log(`FINAL SVG dimensions: ${round(viewBoxWidth)} x ${round(viewBoxHeight)}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="stroke-linecap:round;stroke-linejoin:round;background:white;width:100%;height:100%">
   ${svgStyles}
  ${blockDefs}
  <g transform="scale(1,-1)">
    ${svgContent}
  </g>
</svg>`;
}