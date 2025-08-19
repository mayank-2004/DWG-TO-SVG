export function convertToSvg(db, transformStack = [], visibleLayers = null, highlightedEntityHandle = null) {
  const tables = db.tables || {};

  if (!tables.BLOCK_RECORD?.entries?.length && !db.entities?.length) {
    console.warn('No BLOCK_RECORD entries or entities found');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  const shouldShowAllLayers = !visibleLayers || !Array.isArray(visibleLayers);

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

  const config = {
    hideDimensions: true,
    hideText: false,
    hidePoints: true,
    simplifySplines: true,
    strokeWidth: 0.5,
    textSizeMultiplier: 0.3,
    minBigTextFactor: 0.018,
    dropEntityTypes: new Set(['DIMENSION', 'LEADER', 'HATCH', 'POINT', 'ATTDEF', 'TOLERANCE', 'MLINE', 'TABLE', 'VIEWPORT']),
    dropLayersLike: ['DEFPOINTS', 'DIMS', 'DIM', 'DIMENSIONS', 'ANNOTATION', 'ANNO', 'TEXT', 'MTEXT', 'TITLE', 'BORDER', 'SHEET', 'PLOT', 'HATCH', 'PATTERN', 'SYMB', 'SYMBOL', 'SYMBOLS', 'XREF'],
    flattenToSingleLayer: true,
  };

  const round = (num, precision = 1) => {
    if (!Number.isFinite(num)) return 0;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  };
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

  const calculateTightBounds = (entities) => {
    const tightBounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      valid: false
    };

    const addPoint = (x, y, entityType = 'unknown', handle = '') => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.warn(`Invalid point: (${x}, ${y}) from ${entityType}:${handle}`);
        return;
      }

      if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
        console.warn(`Extreme coordinate filtered: (${x}, ${y}) from ${entityType}:${handle}`);
        return;
      }
      tightBounds.minX = Math.min(tightBounds.minX, x);
      tightBounds.minY = Math.min(tightBounds.minY, y);
      tightBounds.maxX = Math.max(tightBounds.maxX, x);
      tightBounds.maxY = Math.max(tightBounds.maxY, y);
      tightBounds.valid = true;
    };

    entities.forEach(entity => {
      if (!entity?.type) return;

      if (entity.layer === 'G-ANNO-SYMB' || entity.layer === 'A-GLAZ-CWMG') return;
      if (entity.layer && !isLayerVisible(entity.layer)) return;
      if (isUnwantedCircularEntity(entity)) return;

      switch (entity.type) {
        case 'LINE':
          if (entity.startPoint && entity.endPoint) {
            const [x1, y1] = applyTransform(entity.startPoint.x, entity.startPoint.y, transformStack);
            const [x2, y2] = applyTransform(entity.endPoint.x, entity.endPoint.y, transformStack);
            addPoint(x1, y1, 'LINE', entity.handle);
            addPoint(x2, y2, 'LINE', entity.handle);
          }
          break;

        case 'LWPOLYLINE':
        case 'POLYLINE':
        case 'POLYGON':
          if (entity.vertices && Array.isArray(entity.vertices)) {
            entity.vertices.forEach(vertex => {
              if (vertex && Number.isFinite(vertex.x) && Number.isFinite(vertex.y)) {
                const [x, y] = applyTransform(vertex.x, vertex.y, transformStack);
                addPoint(x, y, entity.type, entity.handle);
              }
            });
          }
          break;

        case 'TEXT':
        case 'MTEXT': {
          const textPos = entity.position || entity.insertionPoint || entity.insert;
          if (textPos) {
            const [x, y] = applyTransform(textPos.x, textPos.y, transformStack);
            addPoint(x, y, entity.type, entity.handle);
          }
          break;
        }

        case 'INSERT': {
          const insertPos = entity.insertionPoint || entity.position;
          if (insertPos) {
            const [x, y] = applyTransform(insertPos.x, insertPos.y, transformStack);
            addPoint(x, y, 'INSERT', entity.handle);

            const blockName = entity.blockName || entity.name;
            const blockEntities = blockDefinitions.get(blockName);
            if (blockEntities) {
              const blockTransforms = [...transformStack, {
                x: insertPos.x,
                y: insertPos.y,
                rotation: entity.rotation || 0,
                scaleX: entity.xScale || entity.scaleX || 1,
                scaleY: entity.yScale || entity.scaleY || 1
              }];

              blockEntities.forEach(blockEntity => {
                if (blockEntity.type === 'LINE' && blockEntity.startPoint && blockEntity.endPoint) {
                  const [bx1, by1] = applyTransform(blockEntity.startPoint.x, blockEntity.startPoint.y, blockTransforms);
                  const [bx2, by2] = applyTransform(blockEntity.endPoint.x, blockEntity.endPoint.y, blockTransforms);
                  addPoint(bx1, by1, 'INSERT-BLOCK', entity.handle);
                  addPoint(bx2, by2, 'INSERT-BLOCK', entity.handle);
                }
              });
            }
          }
          break;
        }

        case 'OLE2FRAME':
          if (entity.lowerLeft && entity.upperRight) {
            const [x1, y1] = applyTransform(entity.lowerLeft.x, entity.lowerLeft.y, transformStack);
            const [x2, y2] = applyTransform(entity.upperRight.x, entity.upperRight.y, transformStack);
            addPoint(x1, y1, 'OLE2FRAME', entity.handle);
            addPoint(x2, y2, 'OLE2FRAME', entity.handle);
          }
          break;

        case 'HATCH': // already filtered from rendering; keep out of bounds too
          break;

        case 'SPLINE': {
          const points = entity.controlPoints || entity.fitPoints;
          if (Array.isArray(points)) {
            points.forEach(pt => {
              if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
                const [x, y] = applyTransform(pt.x, pt.y, transformStack);
                addPoint(x, y, 'SPLINE', entity.handle);
              }
            });
          }
          break;
        }

        case 'SOLID':
        case '3DFACE': {
          const corners = entity.corners || [entity.corner1, entity.corner2, entity.corner3, entity.corner4].filter(Boolean);
          if (Array.isArray(corners)) {
            corners.forEach(corner => {
              if (corner) {
                const [x, y] = applyTransform(corner.x, corner.y, transformStack);
                addPoint(x, y, entity.type, entity.handle);
              }
            });
          }
          break;
        }
        case 'LEADER':
          if (Array.isArray(entity.vertices)) {
            entity.vertices.forEach(vertex => {
              if (vertex) {
                const [x, y] = applyTransform(vertex.x, vertex.y, transformStack);
                addPoint(x, y, 'LEADER', entity.handle);
              }
            });
          }
          break;
        case 'DIMENSION':
          if (entity.dimensionLine?.start && entity.dimensionLine?.end) {
            const [x1, y1] = applyTransform(entity.dimensionLine.start.x, entity.dimensionLine.start.y, transformStack);
            const [x2, y2] = applyTransform(entity.dimensionLine.end.x, entity.dimensionLine.end.y, transformStack);
            addPoint(x1, y1, 'DIMENSION', entity.handle);
            addPoint(x2, y2, 'DIMENSION', entity.handle);
          }

          if (Array.isArray(entity.extensionLines)) {
            entity.extensionLines.forEach(line => {
              if (line?.start && line?.end) {
                const [x1, y1] = applyTransform(line.start.x, line.start.y, transformStack);
                const [x2, y2] = applyTransform(line.end.x, line.end.y, transformStack);
                addPoint(x1, y1, 'DIMENSION', entity.handle);
                addPoint(x2, y2, 'DIMENSION', entity.handle);
              }
            });
          }

          if (entity.text && entity.textPosition) {
            const [x, y] = applyTransform(entity.textPosition.x, entity.textPosition.y, transformStack);
            addPoint(x, y, 'DIMENSION', entity.handle);
          }

          if (entity.defPoint1 && entity.defPoint2) {
            const [x1, y1] = applyTransform(entity.defPoint1.x, entity.defPoint1.y, transformStack);
            const [x2, y2] = applyTransform(entity.defPoint2.x, entity.defPoint2.y, transformStack);
            addPoint(x1, y1, 'DIMENSION', entity.handle);
            addPoint(x2, y2, 'DIMENSION', entity.handle);
          }
          break;

        case 'POINT':
          if (entity.position) {
            const [cx, cy] = applyTransform(entity.position.x, entity.position.y, transformStack);
            addPoint(cx, cy, 'POINT', entity.handle);
          }
          break;

        case 'MLINE':
          if (Array.isArray(entity.vertices) && entity.vertices.length >= 2) {
            const numLines = entity.numberOfLines || entity.elements?.length || 2;
            const spacing = entity.lineSpacing || 10;

            for (let i = 0; i < entity.vertices.length - 1; i++) {
              const start = entity.vertices[i];
              const end = entity.vertices[i + 1];

              if (!start || !end) continue;

              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const length = Math.sqrt(dx * dx + dy * dy);

              if (length === 0) continue;
              const perpX = -dy / length;
              const perpY = dx / length;

              for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
                const offset = (lineIndex - (numLines - 1) / 2) * spacing;

                const startX = start.x + perpX * offset;
                const startY = start.y + perpY * offset;
                const endX = end.x + perpX * offset;
                const endY = end.y + perpY * offset;

                const [x1, y1] = applyTransform(startX, startY, transformStack);
                const [x2, y2] = applyTransform(endX, endY, transformStack);

                addPoint(x1, y1, 'MLINE', entity.handle);
                addPoint(x2, y2, 'MLINE', entity.handle);
              }
            }

            if (entity.startCap || entity.endCap) {
              const firstVertex = entity.vertices[0];
              const lastVertex = entity.vertices[entity.vertices.length - 1];

              if (firstVertex && entity.startCap && entity.vertices.length > 1) {
                const secondVertex = entity.vertices[1];
                const dx = secondVertex.x - firstVertex.x;
                const dy = secondVertex.y - firstVertex.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length > 0) {
                  const perpX = -dy / length;
                  const perpY = dx / length;
                  const halfWidth = (numLines - 1) * spacing / 2;

                  const capStart = {
                    x: firstVertex.x + perpX * halfWidth,
                    y: firstVertex.y + perpY * halfWidth
                  };
                  const capEnd = {
                    x: firstVertex.x - perpX * halfWidth,
                    y: firstVertex.y - perpY * halfWidth
                  };

                  const [cx1, cy1] = applyTransform(capStart.x, capStart.y, transformStack);
                  const [cx2, cy2] = applyTransform(capEnd.x, capEnd.y, transformStack);
                  addPoint(cx1, cy1, 'MLINE', entity.handle);
                  addPoint(cx2, cy2, 'MLINE', entity.handle);
                }
              }

              if (lastVertex && entity.endCap && entity.vertices.length > 1) {
                const secondLastVertex = entity.vertices[entity.vertices.length - 2];
                const dx = lastVertex.x - secondLastVertex.x;
                const dy = lastVertex.y - secondLastVertex.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length > 0) {
                  const perpX = -dy / length;
                  const perpY = dx / length;
                  const halfWidth = (numLines - 1) * spacing / 2;

                  const capStart = {
                    x: lastVertex.x + perpX * halfWidth,
                    y: lastVertex.y + perpY * halfWidth
                  };
                  const capEnd = {
                    x: lastVertex.x - perpX * halfWidth,
                    y: lastVertex.y - perpY * halfWidth
                  };

                  const [cx1, cy1] = applyTransform(capStart.x, capStart.y, transformStack);
                  const [cx2, cy2] = applyTransform(capEnd.x, capEnd.y, transformStack);
                  addPoint(cx1, cy1, 'MLINE', entity.handle);
                  addPoint(cx2, cy2, 'MLINE', entity.handle);
                }
              }
            }
          }
          break;

        case 'ATTDEF':
          const insertPoint = entity.insertionPoint || entity.position || entity.startPoint;
          if (insertPoint) {
            const [x, y] = applyTransform(insertPoint.x, insertPoint.y, transformStack);
            addPoint(x, y, 'ATTDEF', entity.handle);

            const displayText = entity.defaultValue || entity.tag || entity.prompt || 'ATTDEF';
            const fontSize = (entity.height || 10) * (config.textSizeMultiplier || 0.3);
            const textWidth = displayText.length * fontSize * 0.6;
            const textHeight = fontSize;

            addPoint(x + textWidth, y + textHeight, 'ATTDEF', entity.handle);
            addPoint(x - 2, y - textHeight - 2, 'ATTDEF', entity.handle);

            if (entity.verify || entity.flags & 4) {
              const indicatorX = x + textWidth + 15;
              addPoint(indicatorX, y + 10, 'ATTDEF', entity.handle);
            }
          }
          break;
      }
    });
    return tightBounds;
  };

  const computeFitTransform = (bounds, targetW = 1200, targetH = 640, padding = 0.02) => {
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;

    const padX = contentW * padding;
    const padY = contentH * padding;

    const paddedMinX = bounds.minX - padX;
    const paddedMaxX = bounds.maxX + padX;
    const paddedMinY = bounds.minY - padY;
    const paddedMaxY = bounds.maxY + padY;

    const paddedW = paddedMaxX - paddedMinX;
    const paddedH = paddedMaxY - paddedMinY;

    const scale = Math.min(targetW / paddedW, targetH / paddedH);

    const offsetX = (targetW - paddedW * scale) / 2;
    const offsetY = (targetH - paddedH * scale) / 2;

    const innerTranslateX = -paddedMinX;
    const innerTranslateY = -paddedMaxY;

    const transform = `translate(${round(offsetX)}, ${round(offsetY)}) scale(${scale}, ${-scale}) translate(${round(innerTranslateX)}, ${round(innerTranslateY)})`;

    return { scale, offsetX, offsetY, innerTranslateX, innerTranslateY, targetW, targetH, transform };
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
    // Skip circular entities from annotation and symbol layers
    if (['CIRCLE', 'ARC', 'ELLIPSE'].includes(entity.type)) {
      const problematicLayers = [
        'G-ANNO-SYMB', 'A-GLAZ-CWMG', 'DEFPOINTS', 'Dims', 'DIMENSIONS',
        'TEXT', 'ANNOTATION', 'SYMBOLS', 'TITLE', 'BORDER', 'VIEWPORT',
        'XREF', 'BLOCKS', 'HATCH', 'PATTERN'
      ];

      if (entity.layer && problematicLayers.some(layer =>
        entity.layer.toUpperCase().includes(layer.toUpperCase())
      )) {
        console.log(`Filtering out ${entity.type} from annotation layer: ${entity.layer}`);
        return false;
      }
    }

    if (entity.layer && !isLayerVisible(entity.layer)) {
      console.log(`Skipping entity on hidden layer: ${entity.layer} (type: ${entity.type})`);
      return false;
    }

    const layerInfo = layers[entity.layer];
    if (layerInfo) {
      if (layerInfo.frozen === true || (layerInfo.flags && (layerInfo.flags & 4))) return false;
      if (layerInfo.off === true || (layerInfo.flags && (layerInfo.flags & 2))) return false;
      if (layerInfo.flags && (layerInfo.flags & 1)) return false;
    }

    if (entity.invisible === true || (entity.flags && (entity.flags & 1))) return false;
    if (entity.plotFlag === false) return false;

    // Drop certain entity types entirely for a cleaner single-layer output
    if (config.dropEntityTypes && config.dropEntityTypes.has(entity.type)) {
      return false;
    }

    // Drop layers that look like annotation/symbol layers
    if (entity.layer && Array.isArray(config.dropLayersLike)) {
      const lname = entity.layer.toUpperCase();
      for (const key of config.dropLayersLike) {
        if (lname.includes(key)) return false;
      }
    }

    if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      return true;
    }

    if (isUnwantedCircularEntity(entity)) return false;

    return true;
  };

  const isUnwantedCircularEntity = (entity) => {
    if (!['CIRCLE', 'ARC', 'ELLIPSE'].includes(entity.type)) return false;

    // Filter out very large circles that are likely viewport boundaries or construction geometry
    if (entity.type === 'CIRCLE' && entity.radius > 1000) {
      console.log(`Filtering out large circle with radius: ${entity.radius}`);
      return true;
    }

    // Filter out circles at origin (0,0) which are often construction geometry
    if (entity.center && entity.center.x === 0 && entity.center.y === 0) {
      console.log(`Filtering out circular entity at origin`);
      return true;
    }

    // Filter out circles that are part of dimension or annotation blocks
    const annotationLayers = [
      'DEFPOINTS', 'Dims', 'DIMENSIONS', 'TEXT', 'ANNOTATION', 'SYMBOLS',
      'TITLE', 'BORDER', 'VIEWPORT', 'XREF', 'BLOCKS'
    ];

    if (entity.layer && annotationLayers.some(layer =>
      entity.layer.toUpperCase().includes(layer.toUpperCase())
    )) {
      console.log(`Filtering out ${entity.type} from annotation layer: ${entity.layer}`);
      return true;
    }

    // Filter out very small circles that might be point markers
    if (entity.type === 'CIRCLE' && entity.radius < 0.5) {
      console.log(`Filtering out tiny circle with radius: ${entity.radius}`);
      return true;
    }

    return false;
  };

  const spatialHashEntities = (entities, gridSize = 50) => {
    const grid = new Map();
    const getGridKey = (x, y) => `${Math.floor(x / gridSize)}_${Math.floor(y / gridSize)}`;

    entities.forEach(entity => {
      const bounds = getEntityBounds(entity);
      if (bounds) {
        const minGridX = Math.floor(bounds.minX / gridSize);
        const maxGridX = Math.floor(bounds.maxX / gridSize);
        const minGridY = Math.floor(bounds.minY / gridSize);
        const maxGridY = Math.floor(bounds.maxY / gridSize);

        for (let gx = minGridX; gx <= maxGridX; gx++) {
          for (let gy = minGridY; gy <= maxGridY; gy++) {
            const key = `${gx}_${gy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(entity);
          }
        }
      }
    });

    return grid;
  };

  const getEntityBounds = (entity) => {
    switch (entity.type) {
      case 'CIRCLE':
        if (!entity.center || !entity.radius) return null;
        return {
          minX: entity.center.x - entity.radius,
          maxX: entity.center.x + entity.radius,
          minY: entity.center.y - entity.radius,
          maxY: entity.center.y + entity.radius
        };
      case 'LINE':
        const start = entity.startPoint || entity.start;
        const end = entity.endPoint || entity.end;
        if (!start || !end) return null;
        return {
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxY: Math.max(start.y, end.y)
        };
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (!entity.vertices || entity.vertices.length === 0) return null;
        const xs = entity.vertices.map(v => v.x);
        const ys = entity.vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        };
      default:
        return null;
    }
  };

  const areEntitiesIdentical = (entity1, entity2, tolerance = 0.1) => {
    if (entity1.type !== entity2.type) return false;
    if (entity1.layer !== entity2.layer) return false;

    switch (entity1.type) {
      case 'CIRCLE':
        if (!entity1.center || !entity2.center) return false;
        return Math.abs(entity1.center.x - entity2.center.x) < tolerance &&
          Math.abs(entity1.center.y - entity2.center.y) < tolerance &&
          Math.abs(entity1.radius - entity2.radius) < tolerance;

      case 'LINE':
        const s1 = entity1.startPoint || entity1.start;
        const e1 = entity1.endPoint || entity1.end;
        const s2 = entity2.startPoint || entity2.start;
        const e2 = entity2.endPoint || entity2.end;

        if (!s1 || !e1 || !s2 || !e2) return false;

        // Check both directions (line could be reversed)
        const forward = Math.abs(s1.x - s2.x) < tolerance && Math.abs(s1.y - s2.y) < tolerance &&
          Math.abs(e1.x - e2.x) < tolerance && Math.abs(e1.y - e2.y) < tolerance;
        const reverse = Math.abs(s1.x - e2.x) < tolerance && Math.abs(s1.y - e2.y) < tolerance &&
          Math.abs(e1.x - s2.x) < tolerance && Math.abs(e1.y - s2.y) < tolerance;
        return forward || reverse;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (!entity1.vertices || !entity2.vertices) return false;
        if (entity1.vertices.length !== entity2.vertices.length) return false;

        return entity1.vertices.every((v1, i) => {
          const v2 = entity2.vertices[i];
          return Math.abs(v1.x - v2.x) < tolerance && Math.abs(v1.y - v2.y) < tolerance;
        });

      default:
        return false;
    }
  };

  const removeIdenticalEntities = (entities) => {
    console.log(`Starting identical entity removal with ${entities.length} entities`);

    const grid = spatialHashEntities(entities, 100);
    const toRemove = new Set();
    const processed = new Set();

    entities.forEach((entity, index) => {
      if (processed.has(index) || toRemove.has(index)) return;

      const bounds = getEntityBounds(entity);
      if (!bounds) return;

      const gridKey = `${Math.floor(bounds.minX / 100)}_${Math.floor(bounds.minY / 100)}`;
      const nearbyEntities = grid.get(gridKey) || [];

      nearbyEntities.forEach(otherEntity => {
        const otherIndex = entities.indexOf(otherEntity);
        if (otherIndex <= index || processed.has(otherIndex) || toRemove.has(otherIndex)) return;

        if (areEntitiesIdentical(entity, otherEntity, 0.5)) {
          toRemove.add(otherIndex);
          console.log(`Marking identical ${entity.type} for removal`);
        }
      });

      processed.add(index);
    });

    const result = entities.filter((_, index) => !toRemove.has(index));
    console.log(`Identical entity removal: ${entities.length} → ${result.length} entities`);
    return result;
  };

  const consolidateBlockInstances = (entities) => {
    const insertEntities = entities.filter(e => e.type === 'INSERT');
    const nonInsertEntities = entities.filter(e => e.type !== 'INSERT');

    if (insertEntities.length === 0) return entities;

    const blockGroups = new Map();

    insertEntities.forEach(insert => {
      const key = `${insert.blockName}_${insert.layer}`;
      if (!blockGroups.has(key)) blockGroups.set(key, []);
      blockGroups.get(key).push(insert);
    });

    const consolidated = [];
    let removedCount = 0;

    blockGroups.forEach((instances, blockKey) => {
      if (instances.length <= 1) {
        consolidated.push(...instances);
        return;
      }

      // Group by spatial proximity
      const spatialGroups = [];
      const tolerance = 10;

      instances.forEach(instance => {
        const insertPoint = instance.insertionPoint || instance.position;
        if (!insertPoint) {
          consolidated.push(instance);
          return;
        }

        let addedToGroup = false;
        for (const group of spatialGroups) {
          const groupCenter = group[0].insertionPoint || group[0].position;
          if (Math.abs(insertPoint.x - groupCenter.x) < tolerance &&
            Math.abs(insertPoint.y - groupCenter.y) < tolerance) {
            group.push(instance);
            addedToGroup = true;
            break;
          }
        }

        if (!addedToGroup) {
          spatialGroups.push([instance]);
        }
      });

      // Keep only one instance per spatial group
      spatialGroups.forEach(group => {
        consolidated.push(group[0]); // Keep the first one
        removedCount += group.length - 1;
      });
    });

    console.log(`Block consolidation: removed ${removedCount} duplicate block instances`);
    return [...nonInsertEntities, ...consolidated];
  };

  const optimizeCircularEntities = (entities) => {
    const circles = entities.filter(e => e.type === 'CIRCLE');
    const others = entities.filter(e => e.type !== 'CIRCLE');

    if (circles.length === 0) return entities;

    // Group circles by position and size
    const circleGroups = new Map();

    circles.forEach(circle => {
      if (!circle.center || !circle.radius) return;

      const key = `${Math.round(circle.center.x)}_${Math.round(circle.center.y)}_${Math.round(circle.radius * 10)}`;
      if (!circleGroups.has(key)) circleGroups.set(key, []);
      circleGroups.get(key).push(circle);
    });

    const optimizedCircles = [];
    let removedCount = 0;

    circleGroups.forEach(group => {
      if (group.length === 1) {
        optimizedCircles.push(group[0]);
      } else {
        // Keep the circle with the most complete data
        const best = group.reduce((a, b) => {
          const aScore = (a.layer ? 1 : 0) + (a.color ? 1 : 0) + (a.handle ? 1 : 0);
          const bScore = (b.layer ? 1 : 0) + (b.color ? 1 : 0) + (b.handle ? 1 : 0);
          return aScore >= bScore ? a : b;
        });

        optimizedCircles.push(best);
        removedCount += group.length - 1;
      }
    });

    console.log(`Circle optimization: removed ${removedCount} duplicate circles`);
    return [...others, ...optimizedCircles];
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
    if (entity.layer && layers[entity.layer]) {
      const layerInfo = layers[entity.layer];
      if (layerInfo.color && typeof layerInfo.color === 'object') {
        return layerInfo.color;
      }
      if (layerInfo.colorIndex !== undefined && layerInfo.colorIndex !== 256) {
        const colorPalette = [
          { r: 0, g: 0, b: 0 },
          { r: 255, g: 0, b: 0 },
          { r: 255, g: 255, b: 0 },
          { r: 0, g: 255, b: 0 },
          { r: 0, g: 255, b: 255 },
          { r: 0, g: 0, b: 255 },
          { r: 255, g: 0, b: 255 },
          { r: 255, g: 255, b: 255 },
          { r: 128, g: 128, b: 128 },
          { r: 192, g: 192, b: 192 },
          { r: 255, g: 127, b: 0 },
          { r: 127, g: 255, b: 127 },
          { r: 127, g: 127, b: 255 },
          { r: 255, g: 127, b: 127 },
          { r: 255, g: 255, b: 127 },
        ];
        return colorPalette[layerInfo.colorIndex] || { r: 0, g: 0, b: 0 };
      }
    }

    if (entity.color && typeof entity.color === 'object') {
      return entity.color;
    }

    if (entity.colorIndex !== undefined && entity.colorIndex !== 256 && entity.colorIndex !== 0) {
      const colorPalette = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 255, b: 255 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 255 },
        { r: 255, g: 255, b: 255 },
        { r: 128, g: 128, b: 128 },
        { r: 192, g: 192, b: 192 },
        { r: 255, g: 127, b: 0 },
        { r: 127, g: 255, b: 127 },
        { r: 127, g: 127, b: 255 },
        { r: 255, g: 127, b: 127 },
        { r: 255, g: 255, b: 127 },
      ];
      return colorPalette[entity.colorIndex] || { r: 0, g: 0, b: 0 };
    }

    return { r: 0, g: 0, b: 0 };
  };

  const pointToLineDistance = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const simplifyPolyline = (points, tolerance = 0.1) => {
    if (!Array.isArray(points) || points.length <= 2) return points || [];

    const simplified = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      if (!prev || !curr || !next) continue;
      const dist = pointToLineDistance(curr, prev, next);

      if (dist > tolerance) {
        simplified.push(curr);
      }
    }

    simplified.push(points[points.length - 1]);
    return simplified;
  };

  const removePreciseDuplicates = (entities) => {
    const entityMap = new Map();
    const uniqueEntities = [];
    const safeRound = (n) => Math.round(n * 10) / 10;

    for (const entity of entities) {
      let key = '';
      switch (entity.type) {
        case 'LINE': {
          const start = entity.startPoint || entity.start;
          const end = entity.endPoint || entity.end;
          if (start && end) {
            key = `LINE:${safeRound(start.x)},${safeRound(start.y)}-${safeRound(end.x)},${safeRound(end.y)}:${entity.layer || ''}`;
          }
          break;
        }
        case 'LWPOLYLINE':
        case 'POLYLINE': {
          if (Array.isArray(entity.vertices)) {
            const points = entity.vertices.map(v => `${safeRound(v.x)},${safeRound(v.y)}`).join('|');
            key = `${entity.type}:${points}:${entity.layer || ''}:${entity.closed || false}`;
          }
          break;
        }
        case 'CIRCLE': {
          if (entity.center && Number.isFinite(entity.radius)) {
            key = `CIRCLE:${safeRound(entity.center.x)},${safeRound(entity.center.y)}:${safeRound(entity.radius)}:${entity.layer || ''}`;
          }
          break;
        }
        default: {
          key = entity.handle || `${entity.type}:${JSON.stringify(entity).slice(0, 64)}`;
        }
      }
      if (key && !entityMap.has(key)) {
        entityMap.set(key, true);
        uniqueEntities.push(entity);
      }
    }
    console.log(`Precise deduplication: ${entities.length} → ${uniqueEntities.length} entities`);
    return uniqueEntities;
  };

  const deduplicateLines = (entities) => {
    const lineMap = new Map();
    const kept = [];
    for (const entity of entities) {
      if (entity.type !== 'LINE') { kept.push(entity); continue; }
      const start = entity.startPoint || entity.start;
      const end = entity.endPoint || entity.end;
      if (!start || !end) { kept.push(entity); continue; }
      const x1 = Math.round(start.x * 10) / 10;
      const y1 = Math.round(start.y * 10) / 10;
      const x2 = Math.round(end.x * 10) / 10;
      const y2 = Math.round(end.y * 10) / 10;
      const key = (x1 < x2 || (x1 === x2 && y1 < y2)) ? `${x1},${y1}-${x2},${y2}` : `${x2},${y2}-${x1},${y1}`;
      if (!lineMap.has(key)) { lineMap.set(key, true); kept.push(entity); }
    }
    console.log(`Line deduplication: ${entities.length} → ${kept.length} entities`);
    return kept;
  };

  const polylinesOverlap = (poly1, poly2) => {
    if (!Array.isArray(poly1.vertices) || !Array.isArray(poly2.vertices)) return false;
    if (poly1.vertices.length !== poly2.vertices.length) return false;
    const tolerance = 1.0;
    let matching = 0;
    for (const v1 of poly1.vertices) {
      const match = poly2.vertices.some(v2 => Math.abs(v1.x - v2.x) < tolerance && Math.abs(v1.y - v2.y) < tolerance);
      if (match) matching++;
    }
    return matching / poly1.vertices.length > 0.8;
  };

  const mergeOverlappingPolylines = (entities) => {
    const polylines = entities.filter(e => ['LWPOLYLINE', 'POLYLINE'].includes(e.type));
    const others = entities.filter(e => !['LWPOLYLINE', 'POLYLINE'].includes(e.type));
    if (polylines.length === 0) return entities;
    const merged = [];
    const processed = new Set();
    for (let i = 0; i < polylines.length; i++) {
      if (processed.has(i)) continue;
      const a = polylines[i];
      let removedAny = false;
      for (let j = i + 1; j < polylines.length; j++) {
        if (processed.has(j)) continue;
        const b = polylines[j];
        if (polylinesOverlap(a, b)) { processed.add(j); removedAny = true; }
      }
      merged.push(a);
      processed.add(i);
    }
    console.log(`Polyline overlap consolidation: ${polylines.length} → ${merged.length}`);
    return [...others, ...merged];
  };

  const consolidateBoundaryLayers = (entities) => {
    const boundaryLayers = ['BOUNDARY', 'BORDER', 'OUTLINE', 'WALL', 'PARTITION', 'FRAME', 'PERIMETER', 'EDGE', 'LINE', '0'];
    const boundary = [];
    const non = [];
    for (const e of entities) {
      const lname = e.layer?.toUpperCase() || '';
      const isBoundary = boundaryLayers.some(k => lname.includes(k) || lname === k);
      if (isBoundary && ['LINE', 'LWPOLYLINE', 'POLYLINE'].includes(e.type)) boundary.push(e); else non.push(e);
    }
    if (boundary.length === 0) return entities;
    const dedup = deduplicateLines(boundary);
    console.log(`Boundary consolidation: ${boundary.length} → ${dedup.length}`);
    return [...non, ...dedup];
  };

  function calculateEntityTypeSimilarity(entities1, entities2) {
    const dist = (entities) => {
      const d = {};
      for (const e of entities) d[e.type] = (d[e.type] || 0) + 1;
      return d;
    };
    const d1 = dist(entities1);
    const d2 = dist(entities2);
    const all = new Set([...Object.keys(d1), ...Object.keys(d2)]);
    let sim = 0; let total = 0;
    for (const t of all) {
      const c1 = d1[t] || 0; const c2 = d2[t] || 0; const max = Math.max(c1, c2); const min = Math.min(c1, c2);
      if (max > 0) { sim += (min / max) * max; total += max; }
    }
    return total > 0 ? sim / total : 0;
  };

  const calculateLayerPriority = (layerName, metrics) => {
    let p = 0;
    const upper = (layerName || '').toUpperCase();
    p += Math.log((metrics.entityCount || 0) + 1) * 0.3;
    p += Math.log((metrics.totalLength || 0) + 1) * 0.4;
    const high = ['WALL', 'COLUMN', 'BEAM', 'STRUCTURE', 'OUTLINE', 'BOUNDARY'];
    const med = ['DOOR', 'WINDOW', 'STAIR', 'ELEVATOR'];
    const low = ['HATCH', 'PATTERN', 'FILL', 'TEMP', 'XREF', 'DEFPOINTS'];
    if (high.some(k => upper.includes(k))) p += 3; else if (med.some(k => upper.includes(k))) p += 2; else if (low.some(k => upper.includes(k))) p -= 2;
    if ((layerName || '').length <= 5) p += 1; if (layerName === '0') p += 2;
    return p;
  };

  const consolidateOverlappingLayers = (entities) => {
    const layerGroups = new Map();
    for (const e of entities) { if (!e?.layer) continue; if (!layerGroups.has(e.layer)) layerGroups.set(e.layer, []); layerGroups.get(e.layer).push(e); }
    const layerMetrics = new Map();
    for (const [lname, ents] of layerGroups) {
      let totalLength = 0;
      let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      const types = new Map();
      for (const e of ents) {
        types.set(e.type, (types.get(e.type) || 0) + 1);
        switch (e.type) {
          case 'LINE': {
            const s = e.startPoint || e.start; const t = e.endPoint || e.end; if (!s || !t) break;
            const dx = t.x - s.x; const dy = t.y - s.y; totalLength += Math.sqrt(dx * dx + dy * dy);
            bounds.minX = Math.min(bounds.minX, s.x, t.x); bounds.maxX = Math.max(bounds.maxX, s.x, t.x);
            bounds.minY = Math.min(bounds.minY, s.y, t.y); bounds.maxY = Math.max(bounds.maxY, s.y, t.y);
            break;
          }
          case 'LWPOLYLINE':
          case 'POLYLINE': {
            if (Array.isArray(e.vertices) && e.vertices.length > 1) {
              for (let i = 0; i < e.vertices.length - 1; i++) {
                const v1 = e.vertices[i]; const v2 = e.vertices[i + 1]; const dx = v2.x - v1.x; const dy = v2.y - v1.y; totalLength += Math.sqrt(dx * dx + dy * dy);
                bounds.minX = Math.min(bounds.minX, v1.x, v2.x); bounds.maxX = Math.max(bounds.maxX, v1.x, v2.x);
                bounds.minY = Math.min(bounds.minY, v1.y, v2.y); bounds.maxY = Math.max(bounds.maxY, v1.y, v2.y);
              }
            }
            break;
          }
          case 'ARC':
            if (e.radius && e.startAngle !== undefined && e.endAngle !== undefined) {
              const angleDiff = Math.abs(e.endAngle - e.startAngle); totalLength += e.radius * angleDiff;
              bounds.minX = Math.min(bounds.minX, e.center.x - e.radius); bounds.maxX = Math.max(bounds.maxX, e.center.x + e.radius);
              bounds.minY = Math.min(bounds.minY, e.center.y - e.radius); bounds.maxY = Math.max(bounds.maxY, e.center.y + e.radius);
            }
            break;
          case 'CIRCLE':
            if (e.radius) {
              totalLength += 2 * Math.PI * e.radius;
              bounds.minX = Math.min(bounds.minX, e.center.x - e.radius); bounds.maxX = Math.max(bounds.maxX, e.center.x + e.radius);
              bounds.minY = Math.min(bounds.minY, e.center.y - e.radius); bounds.maxY = Math.max(bounds.maxY, e.center.y + e.radius);
            }
            break;
          case 'INSERT': {
            const pos = e.insertionPoint || e.position; if (pos) { bounds.minX = Math.min(bounds.minX, pos.x); bounds.maxX = Math.max(bounds.maxX, pos.x); bounds.minY = Math.min(bounds.minY, pos.y); bounds.maxY = Math.max(bounds.maxY, pos.y); totalLength += 10; }
            break;
          }
        }
      }
      const boundingArea = bounds.minX !== Infinity ? (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) : 0;
      layerMetrics.set(lname, { totalLength, bounds, boundingArea, entityCount: ents.length, entityTypes: types, entities: ents });
    }
    const layersToRemove = new Set();
    const names = Array.from(layerGroups.keys());
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const l1 = names[i], l2 = names[j]; if (layersToRemove.has(l1) || layersToRemove.has(l2)) continue;
        const m1 = layerMetrics.get(l1), m2 = layerMetrics.get(l2); if (!m1 || !m2) continue;
        const b1 = m1.bounds, b2 = m2.bounds; if (b1.minX === Infinity || b2.minX === Infinity) continue;
        const ox1 = Math.max(b1.minX, b2.minX), ox2 = Math.min(b1.maxX, b2.maxX), oy1 = Math.max(b1.minY, b2.minY), oy2 = Math.min(b1.maxY, b2.maxY);
        if (ox1 >= ox2 || oy1 >= oy2) continue;
        const oArea = (ox2 - ox1) * (oy2 - oy1);
        const r1 = m1.boundingArea > 0 ? oArea / m1.boundingArea : 0;
        const r2 = m2.boundingArea > 0 ? oArea / m2.boundingArea : 0;
        const isInterior = (name) => {
          const keys = ['FURNITURE', 'CHAIR', 'TABLE', 'DESK', 'BED', 'CABINET', 'SHELF', 'FIXTURE', 'APPLIANCE', 'EQUIP', 'SYMBOL', 'BLOCK', 'DETAIL', 'PATTERN', 'FILL', 'SHADE', 'INTERIOR', 'ROOM', 'SPACE', 'ELEV', 'SECTION', 'PLAN', 'VIEW'];
          const upper = (name || '').toUpperCase();
          return keys.some(k => upper.includes(k));
        };
        let overlapThreshold = 0.6; let similarityThreshold = 0.7;
        if (isInterior(l1) || isInterior(l2)) { overlapThreshold = 0.4; similarityThreshold = 0.5; }
        if (r1 > overlapThreshold || r2 > overlapThreshold) {
          const sim = calculateEntityTypeSimilarity(m1.entities, m2.entities);
          if (sim > similarityThreshold) {
            const p1 = calculateLayerPriority(l1, m1); const p2 = calculateLayerPriority(l2, m2);
            if (p1 > p2) layersToRemove.add(l2); else layersToRemove.add(l1);
          }
        }
      }
    }
    const consolidated = entities.filter(e => !layersToRemove.has(e.layer));
    console.log(`Comprehensive consolidation: ${entities.length} → ${consolidated.length} entities; removed ${layersToRemove.size} overlapping layers`);
    return consolidated;
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

      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`;
    },
    // ARC: (e, color, stroke, transforms) => {
    //   if (!e.center || !Number.isFinite(e.radius)) return null;

    //   const { center, radius } = e;
    //   const startAngle = e.startAngle || 0;
    //   const endAngle = e.endAngle || 2 * Math.PI;

    //   // Check if this is actually a full circle (skip if so to avoid duplicates)
    //   const angleDiff = Math.abs(endAngle - startAngle);
    //   if (angleDiff >= 2 * Math.PI - 0.001) {
    //     console.log(`Skipping full-circle ARC entity: ${e.handle} (angle diff: ${angleDiff})`);
    //     return null;
    //   }

    //   const sx = center.x + radius * Math.cos(startAngle);
    //   const sy = center.y + radius * Math.sin(startAngle);
    //   const ex = center.x + radius * Math.cos(endAngle);
    //   const ey = center.y + radius * Math.sin(endAngle);

    //   const [x1, y1] = applyTransform(sx, sy, transforms);
    //   const [x2, y2] = applyTransform(ex, ey, transforms);

    //   updateBounds(x1, y1, 'ARC', e.handle);
    //   updateBounds(x2, y2, 'ARC', e.handle);

    //   const [cx, cy] = applyTransform(center.x, center.y, transforms);
    //   updateBounds(cx - radius, cy - radius, 'ARC', e.handle);
    //   updateBounds(cx + radius, cy + radius, 'ARC', e.handle);

    //   const largeArc = angleDiff > Math.PI ? 1 : 0;
    //   const sweepFlag = endAngle > startAngle ? 0 : 1;

    //   // Use stroke-only rendering for arcs, no fill
    //   const arcStroke = stroke.replace(/fill="[^"]*"/, 'fill="none"');
    //   return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweepFlag} ${round(x2)} ${round(y2)}" ${arcStroke}/>`;
    //   // return `<path d="M ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweepFlag} ${round(x2)} ${round(y2)}" ${stroke}/>`;
    // },
    CIRCLE: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      const originalRadius = e.radius;

      updateBounds(cx - originalRadius, cy - originalRadius, 'CIRCLE', e.handle);
      updateBounds(cx + originalRadius, cy + originalRadius, 'CIRCLE', e.handle);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(originalRadius)}" fill="yellow" />`;
    },
    // ELLIPSE: (e, color, stroke, transforms) => {
    //   if (!e.center || !e.majorAxisEndPoint) return null;

    //   const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
    //   const ry = rx * (e.axisRatio || 1);

    //   const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
    //   const angle = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;

    //   updateBounds(cx - rx, cy - ry, 'ELLIPSE', e.handle);
    //   updateBounds(cx + rx, cy + ry, 'ELLIPSE', e.handle);

    //   // Use stroke-only rendering for ellipses, no fill
    //   const ellipseStroke = stroke.replace(/fill="[^"]*"/, 'fill="none"');
    //   return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${ellipseStroke}/>`;
    //   // return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})" ${stroke}/>`;
    // },
    LWPOLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const simplifiedVertices = simplifyPolyline(e.vertices, 0.1);

      const points = simplifiedVertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'LWPOLYLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      const tag = e.closed || e.flags === 1 ? "polygon" : "polyline";
      return `<${tag} points="${points.join(' ')}" ${stroke}/>`;
    },

    POLYGON: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 3) return null;

      const simplifiedVertices = simplifyPolyline(e.vertices, 0.1);

      const points = simplifiedVertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'LWPOLYLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return `<polygon points="${points.join(' ')}" ${stroke}/>`;
    },

    POLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const simplifiedVertices = simplifyPolyline(e.vertices, 0.1);

      const points = simplifiedVertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'LWPOLYLINE', e.handle);
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

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 6);
      const rotation = e.rotation ? ` transform="rotate(${e.rotation * 180 / Math.PI} ${round(x)} ${round(y)}) scale(1,-1)"` : ' transform="scale(1,-1)"';

      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})"${rotation}>${escapeXml(e.text)}</text>`;
    },

    TEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(x, y, 'TEXT', e.handle);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 6);
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

      const pointSize = Math.max(0.5, config.strokeWidth || 0.5);
      const pointColor = `rgb(${color.r},${color.g},${color.b})`;

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${pointSize}" fill="${pointColor}" opacity="0.3" />`;
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

      const solidStroke = stroke.replace(/fill="[^"]*"/, `fill="rgb(${color},${color},${color})"`);
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

    LEADER: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const items = [];
      for (let i = 0; i < e.vertices.length - 1; i++) {
        const start = e.vertices[i];
        const end = e.vertices[i + 1];

        if (!start || !end) continue;

        const [x1, y1] = applyTransform(start.x, start.y, transforms);
        const [x2, y2] = applyTransform(end.x, end.y, transforms);

        updateBounds(x1, y1, 'LEADER', e.handle);
        updateBounds(x2, y2, 'LEADER', e.handle);

        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
      }

      if (e.hasArrowhead !== false && e.vertices.length >= 2) {
        const start = e.vertices[0];
        const second = e.vertices[1];

        if (start && second) {
          const [x1, y1] = applyTransform(start.x, start.y, transforms);
          const [x2, y2] = applyTransform(second.x, second.y, transforms);

          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);

          if (length > 0) {
            const unitX = dx / length;
            const unitY = dy / length;

            const arrowSize = 8;

            const arrowX1 = x1 + arrowSize * (-unitX + unitY * 0.5);
            const arrowY1 = y1 + arrowSize * (-unitY - unitX * 0.5);
            const arrowX2 = x1 + arrowSize * (-unitX - unitY * 0.5);
            const arrowY2 = y1 + arrowSize * (-unitY + unitX * 0.5);

            const arrowStroke = stroke.replace(/fill="[^"]*"/, `fill="rgb(${color.r},${color.g},${color.b})"`);
            const arrowPoints = `${round(x1)},${round(y1)} ${round(arrowX1)},${round(arrowY1)} ${round(arrowX2)},${round(arrowY2)}`;
            items.push(`<polygon points="${arrowPoints}" ${arrowStroke}/>`);
          }
        }
      }
      if (!config.hideText && e.text && (e.textPosition || e.annotationOffset)) {
        const textPos = e.textPosition || e.annotationOffset;
        if (textPos) {
          const [tx, ty] = applyTransform(textPos.x, textPos.y, transforms);
          updateBounds(tx, ty, 'LEADER', e.handle);

          const fontSize = Math.max((e.textHeight || 8) * config.textSizeMultiplier, 6);
          const rotation = e.textRotation ? ` transform="rotate(${e.textRotation * 180 / Math.PI} ${round(tx)} ${round(ty)}) scale(1,-1)"` : ' transform="scale(1,-1)"';

          items.push(`<text x="${round(tx)}" y="${round(ty)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})"${rotation}>${escapeXml(e.text)}</text>`);
        }
      }

      if (items.length === 0 && e.startPoint && e.endPoint) {
        const [x1, y1] = applyTransform(e.startPoint.x, e.startPoint.y, transforms);
        const [x2, y2] = applyTransform(e.endPoint.x, e.endPoint.y, transforms);

        updateBounds(x1, y1, 'LEADER', e.handle);
        updateBounds(x2, y2, 'LEADER', e.handle);

        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${stroke}/>`);
      }

      return items.length > 0 ? items.join('') : null;
    },
    MLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;
      const items = [];

      for (let i = 0; i < e.vertices.length - 1; i++) {
        const start = e.vertices[i];
        const end = e.vertices[i + 1];
        if (!start || !end) continue;

        // Just draw the centerline, ignore the multiple parallel lines
        const [x1, y1] = applyTransform(start.x, start.y, transforms);
        const [x2, y2] = applyTransform(end.x, end.y, transforms);
        updateBounds(x1, y1, 'MLINE', e.handle);
        updateBounds(x2, y2, 'MLINE', e.handle);
        const mlineStroke = stroke.replace(/stroke-width="[^"]*"/, 'stroke-width="2"');
        items.push(`<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${mlineStroke}/>`);
      }

      return items.length > 0 ? items.join('') : null;
    },

    ATTDEF: (e, color, stroke, transforms) => {
      if (config.hideText) return null;

      const items = [];
      const insertPoint = e.insertionPoint || e.position || e.startPoint;

      if (!insertPoint) return null;

      const [x, y] = applyTransform(insertPoint.x, insertPoint.y, transforms);
      updateBounds(x, y, 'ATTDEF', e.handle);

      const displayText = e.defaultValue || e.tag || e.prompt || 'ATTDEF';
      const fontSize = Math.max((e.height || 10) * config.textSizeMultiplier, 8);

      const rotation = e.rotation || e.rotationAngle || 0;
      const rotationTransform = rotation !== 0 ?
        ` transform="rotate(${round(rotation * 180 / Math.PI)} ${round(x)} ${round(y)}) scale(1,-1)"` :
        ' transform="scale(1,-1)"';

      let textAnchor = 'start';
      if (e.horizontalAlignment === 1) textAnchor = 'middle';
      else if (e.horizontalAlignment === 2) textAnchor = 'end';

      items.push(`<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" text-anchor="${textAnchor}"${rotationTransform}>${escapeXml(displayText)}</text>`);

      if (e.tag && e.tag !== displayText) {
        const tagY = y - fontSize - 2;
        items.push(`<text x="${round(x)}" y="${round(tagY)}" font-size="${Math.max(fontSize * 0.7, 6)}" fill="rgb(${Math.max(color.r - 50, 0)},${Math.max(color.g - 50, 0)},${Math.max(color.b - 50, 0)})" text-anchor="${textAnchor}" transform="scale(1,-1)">${escapeXml(e.tag)}</text>`);
        updateBounds(x, tagY, 'ATTDEF', e.handle);
      }

      if (e.invisible || e.flags & 1) {
        const indicatorSize = fontSize * 0.3;
        items.push(`<rect x="${round(x - indicatorSize)}" y="${round(y - indicatorSize)}" width="${round(indicatorSize * 2)}" height="${round(indicatorSize * 2)}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="0.5" stroke-dasharray="2,2"/>`);
      }

      if (e.preset || e.flags & 8) {
        const textWidth = displayText.length * fontSize * 0.6;
        const textHeight = fontSize;
        const padding = 2;

        items.push(`<rect x="${round(x - padding)}" y="${round(y - textHeight - padding)}" width="${round(textWidth + padding * 2)}" height="${round(textHeight + padding * 2)}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="0.5"/>`);
        updateBounds(x + textWidth + padding, y + padding, 'ATTDEF', e.handle);
      }

      if (e.verify || e.flags & 4) {
        const indicatorX = x + displayText.length * fontSize * 0.6 + 5;
        items.push(`<text x="${round(indicatorX)}" y="${round(y)}" font-size="${Math.max(fontSize * 0.8, 6)}" fill="orange" transform="scale(1,-1)">✓</text>`);
        updateBounds(indicatorX + 10, y, 'ATTDEF', e.handle);
      }

      return items.length > 0 ? items.join('') : null;
    },

    INSERT: (e, color, stroke, transforms) => {
      const blockName = e.blockName || e.name;
      if (!blockName) {
        console.warn('INSERT entity missing blockName:', e);
        return null;
      }

      const blockEntities = blockDefinitions.get(blockName);
      if (!blockEntities || !blockEntities.some(be => be?.type && entityHandlers[be.type])) {
        return null;
      }

      const insertPoint = e.insertionPoint || e.position;

      console.log(`Processing INSERT: ${blockName} at (${insertPoint.x}, ${insertPoint.y}) on layer ${e.layer}`);

      let xScale = e.xScale ?? e.scaleX ?? e.scale?.x ?? 1;
      let yScale = e.yScale ?? e.scaleY ?? e.scale?.y ?? 1;
      const rotation = e.rotation ?? e.rotationAngle ?? 0;

      xScale = Math.max(Math.min(xScale, 1000), 0.001);
      yScale = Math.max(Math.min(yScale, 1000), 0.001);

      const translate = `translate(${round(insertPoint.x)},${round(insertPoint.y)})`;
      const rotate = rotation !== 0 ? ` rotate(${round(rotation * 180 / Math.PI)})` : '';
      const scale = (xScale !== 1 || yScale !== 1) ? ` scale(${round(xScale)},${round(yScale)})` : '';
      const transformAttr = `${translate}${rotate}${scale}`;

      updateBounds(insertPoint.x, insertPoint.y, 'INSERT', e.handle);

      const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;

      let useAttributes;
      if (isHighlighted) {
        useAttributes = `stroke="red" stroke-width="12" fill="rgba(255,0,0,0.4)" opacity="1"`;
      } else {
        useAttributes = `stroke="black" fill="none" stroke-width="1"`;
      }

      const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
      const entityClass = `class="dwg-entity deletable-entity insert-block"`;

      return `<use href="#${escapeXml(blockName)}" transform="${transformAttr}" ${useAttributes} ${dataHandle} ${entityClass} />`;
    },
  };

  function calculateOptimalDisplaySize(bounds) {
    const contentWidth = Math.abs(bounds.maxX - bounds.minX);
    const contentHeight = Math.abs(bounds.maxY - bounds.minY);
    const aspectRatio = contentWidth / contentHeight;

    const sizeCategories = {
      tiny: { maxDim: 100, containerHeight: 400 },
      small: { maxDim: 1000, containerHeight: 500 },
      medium: { maxDim: 10000, containerHeight: 600 },
      large: { maxDim: 100000, containerHeight: 700 },
      huge: { maxDim: Infinity, containerHeight: 800 }
    };

    const maxContentDim = Math.max(contentWidth, contentHeight);
    let category = 'medium';

    for (const [catName, catData] of Object.entries(sizeCategories)) {
      if (maxContentDim <= catData.maxDim) {
        category = catName;
        break;
      }
    }

    const containerHeight = sizeCategories[category].containerHeight;

    let adjustedContainerHeight = containerHeight;
    if (aspectRatio > 3) {
      adjustedContainerHeight = Math.min(containerHeight * 0.7, 500);
    } else if (aspectRatio < 0.3) {
      adjustedContainerHeight = Math.min(containerHeight * 1.3, 900);
    }

    return {
      contentWidth: Math.round(contentWidth),
      contentHeight: Math.round(contentHeight),
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      containerHeight: adjustedContainerHeight,
      category: category,
      maxContentDim: Math.round(maxContentDim)
    };
  }

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

      let strokeColor, strokeWidth_final, fillColor, strokeDashArray;

      if (isHighlighted) {
        strokeColor = '#FF0000';
        strokeWidth_final = '15';
        fillColor = 'rgba(255, 0, 0, 0.3)';
        strokeDashArray = '8,4';
      } else {
        strokeColor = `rgb(${color.r},${color.g},${color.b})`;
        strokeWidth_final = strokeWidth;
        if (['CIRCLE', 'ELLIPSE', 'ARC'].includes(e.type)) {
          fillColor = 'none'; // Never fill circular entities
        } else if (['POLYGON', 'SOLID', '3DFACE', 'HATCH'].includes(e.type)) {
          fillColor = `rgba(${color.r},${color.g},${color.b},0.1)`;
        } else {
          fillColor = 'none';
        }

        strokeDashArray = 'none';
      }

      const stroke = `stroke="${strokeColor}" stroke-width="${strokeWidth_final}" fill="${fillColor}" stroke-dasharray="${strokeDashArray}"`;

      const result = handler(e, color, stroke, currentTransforms);
      if (result && e.handle) {
        const dataHandle = `data-handle="${e.handle}"`;
        const highlightClass = isHighlighted ? 'highlighted-entity' : 'dwg-entity';
        const entityClass = `class="${highlightClass} deletable-entity clickable-entity"`;

        if (!result.includes('data-handle="')) {
          if (result.startsWith('<g ') || result.startsWith('<g>')) {
            const insertPos = result.indexOf('>');
            const updatedResult = result.slice(0, insertPos) +
              ` ${dataHandle} ${entityClass}` +
              result.slice(insertPos);
            if (updatedResult) processedElements++;
            return updatedResult;
          } else {
            const tagMatch = result.match(/^<(\w+)/);
            if (tagMatch) {
              const insertPos = result.indexOf(' ') > 0 ? result.indexOf(' ') : result.indexOf('>');
              const updatedResult = result.slice(0, insertPos) +
                ` ${dataHandle} ${entityClass}` +
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
      // console.log(`INSERT entity filtered out by shouldRenderEntity: ${blockName} on layer ${e.layer}`);
      return null;
    }

    const blockEntities = blockDefinitions.get(blockName);
    if (!blockEntities || !Array.isArray(blockEntities)) {
      console.warn(`Block definition not found for: ${blockName}`);
      return null;
    }

    const insertPoint = e.insertionPoint || e.position;

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

    updateBounds(insertPoint.x, insertPoint.y, 'INSERT', e.handle);

    const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;

    // When flattening, inline the block geometry instead of <use/defs>
    if (config.flattenToSingleLayer) {
      const childTransforms = [
        ...currentTransforms,
        { x: insertPoint.x, y: insertPoint.y, rotation, scaleX: xScale, scaleY: yScale }
      ];
      const childContent = [];
      for (const be of blockEntities) {
        if (!be?.type) continue;
        // Force child entities to inherit the INSERT's layer to have a single visible layer
        const beClone = { ...be, layer: e.layer };
        const element = generateElement(beClone, `Block_${blockName}`, childTransforms, highlightedEntityHandle);
        if (element) childContent.push(element);
      }
      if (childContent.length === 0) return null;
      const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
      const entityClass = isHighlighted ?
        `class="dwg-entity deletable-entity insert-block highlighted-entity"` :
        `class="dwg-entity deletable-entity insert-block"`;
      return `<g id="${e.handle || groupId}" ${dataHandle} ${entityClass}>${childContent.join('')}</g>`;
    }

    let strokeStyle, fillStyle, strokeWidth_final;
    if (isHighlighted) {
      strokeStyle = 'stroke="red"';
      fillStyle = 'fill="rgba(255, 0, 0, 1)"';
      strokeWidth_final = '10';
    } else {
      strokeStyle = 'stroke="rgb(0,0,0)"';
      fillStyle = 'fill="none"';
      strokeWidth_final = normalizeStrokeWidth();
    }

    const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
    const entityClass = isHighlighted ?
      `class="dwg-entity deletable-entity insert-block highlighted-entity"` :
      `class="dwg-entity deletable-entity insert-block"`;

    const useAttributes = `${strokeStyle} ${fillStyle}`.trim();

    return `<g id="${e.handle || groupId}" stroke-width="${strokeWidth_final}" ${dataHandle} ${entityClass}>
  <use href="#${escapeXml(blockName)}" transform="${transformAttr}" ${useAttributes} />
</g>`;
  };

  const generateBlockDefinitions = () => {
    if (config.flattenToSingleLayer) {
      // No <defs> when flattening blocks inline
      return '';
    }
    const defs = [];

    for (const [blockName, blockEntities] of blockDefinitions) {
      if (!Array.isArray(blockEntities) || blockEntities.length === 0) continue;

      const blockContent = [];
      for (const entity of blockEntities) {
        if (!entity?.type) continue;

        if (isUnwantedCircularEntity(entity)) {
          console.log(`Skipping ${entity.type} in block ${blockName}`);
          continue;
        }

        const element = generateElement(entity, `Block_${blockName}`, [], highlightedEntityHandle);
        if (element) {
          blockContent.push(element);
        }
      }

      if (blockContent.length > 0) {
        defs.push(`  <g id="${escapeXml(blockName)}">
${blockContent.map(content => ` ${content}`).join('\n')}
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
    const processedHandles = new Set();
    let usedEntities = [];

    if (Array.isArray(db.entities) && db.entities.length > 0) {
      console.log(`Starting with ${db.entities.length} entities`);

      let filteredEntities = db.entities.filter(entity => {
        if (!entity?.type) return false;
        if (entity.layer === 'G-ANNO-SYMB' || entity.layer === 'A-GLAZ-CWMG') return false;
        if (isUnwantedCircularEntity(entity)) return false;
        if (entity.handle && processedHandles.has(entity.handle)) return false;
        if (entity.handle) processedHandles.add(entity.handle);
        if (entity.type === 'ARC' && entity.startAngle !== undefined && entity.endAngle !== undefined) {
          const angleDiff = Math.abs(entity.endAngle - entity.startAngle);
          if (angleDiff >= 2 * Math.PI - 0.001) return false;
        }
        const layerInfo = tables.LAYER?.entries?.reduce((acc, layer) => { acc[layer.name] = layer; return acc; }, {}) || {};
        return shouldRenderEntity(entity, layerInfo);
      });

      console.log(`After initial filtering: ${filteredEntities.length} entities`);

      // Apply new optimization functions
      filteredEntities = removeIdenticalEntities(filteredEntities);
      filteredEntities = consolidateBlockInstances(filteredEntities);
      filteredEntities = optimizeCircularEntities(filteredEntities);
      filteredEntities = removePreciseDuplicates(filteredEntities);
      filteredEntities = consolidateBoundaryLayers(filteredEntities);
      filteredEntities = mergeOverlappingPolylines(filteredEntities);
      filteredEntities = deduplicateLines(filteredEntities);
      filteredEntities = consolidateOverlappingLayers(filteredEntities);

      console.log(`After all optimizations: ${filteredEntities.length} entities`);

      usedEntities = filteredEntities;
      const modelContent = processEntities(filteredEntities, '*Model_Space', transformStack);
      content.push(...modelContent);
    } else {
      console.warn('No db.entities found or empty array');
    }

    return { content, usedEntities };
  };

  const blockDefs = generateBlockDefinitions();
  const { content: svgElements, usedEntities } = generateSVGContent();
  const svgContent = svgElements.join('\n');

  if (!bounds.valid || bounds.minX === Infinity || bounds.maxX === -Infinity) {
    console.error('CRITICAL: No valid bounds found after processing all entities!');
    console.log('Attempting emergency bounds from entity positions...');

    if (!bounds.valid) {
      console.error('Using default bounds as last resort');
      Object.assign(bounds, { minX: -100, minY: -100, maxX: 100, maxY: 100, valid: true });
    }
  }

  const allPoints = [];
  for (const entity of (usedEntities || db.entities || [])) {
    if (entity.layer === '-ANNO-SYMB' || entity.layer === 'A-GLAZ-CWMG') continue;

    if (entity.startPoint) allPoints.push([entity.startPoint.x, entity.startPoint.y]);
    if (entity.endPoint) allPoints.push([entity.endPoint.x, entity.endPoint.y]);
    if (entity.center) allPoints.push([entity.center.x, entity.center.y]);
    if (entity.position) allPoints.push([entity.position.x, entity.position.y]);
    if (entity.vertices) entity.vertices.forEach(v => allPoints.push([v.x, v.y]));
    if (entity.corners) entity.corners.forEach(c => allPoints.push([c.x, c.y]));
    if (entity.lowerLeft) allPoints.push([entity.lowerLeft.x, entity.lowerLeft.y]);
    if (entity.upperRight) allPoints.push([entity.upperRight.x, entity.upperRight.y]);
  }
  if (allPoints.length > 0) {
    bounds.minX = Math.min(...allPoints.map(p => p[0]));
    bounds.maxX = Math.max(...allPoints.map(p => p[0]));
    bounds.minY = Math.min(...allPoints.map(p => p[1]));
    bounds.maxY = Math.max(...allPoints.map(p => p[1]));
    bounds.valid = true;
  }

  validateAndFixBounds();

  if (skippedByLayer.size > 0) {
    console.log('Entities skipped by layer:', Object.fromEntries(skippedByLayer));
  }

  console.log(`Final processed ${processedElements} elements`);

  if (!bounds.valid || bounds.minX === Infinity) {
    console.warn('No valid bounds found, using default');
    Object.assign(bounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  }

  console.log('Total unique entities processed for bounds:', processedForBounds.size);

  const tightBounds = calculateTightBounds(usedEntities || db.entities || []);

  const displayDimensions = calculateOptimalDisplaySize(tightBounds);
  console.log('Display dimensions calculated:', displayDimensions);

  const targetWidth = 1200;
  const targetHeight = 640;

  const fit = computeFitTransform(tightBounds, targetWidth, targetHeight, 0.02);
  console.log('Fit-to-viewbox transform:', fit);

  let svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetWidth} ${targetHeight}">
    ${blockDefs}
    <g transform="${fit.transform}">
      ${svgContent}
    </g>
  </svg>`;

  svgString = svgString
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .replace(/(\d+\.\d{3})\d+/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*=\s*"/g, '="')
    .replace(/"\s+/g, '" ')
    .replace(/stroke-width="[^"]*"/g, (match) => {
      const value = match.match(/stroke-width="([^"]*)"/)[1];
      return `stroke-width="${Math.max(round(parseFloat(value) || 1, 1), 0.5)}"`;
    })
    .replace(/fill="none"\s+stroke="none"/g, 'style="display:none"')
    .replace(/opacity="0"/g, 'style="display:none"');

  return svgString;
}