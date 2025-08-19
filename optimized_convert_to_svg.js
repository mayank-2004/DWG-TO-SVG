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
    dropLayersLike: ['DEFPOINTS', 'DIMS', 'DIM', 'DIMENSIONS', 'ANNOTATION', 'ANNO', 'TEXT', 'MTEXT', 'TITLE', 'BORDER', 'SHEET', 'PLOT', 'HATCH', 'PATTERN', 'SYMB', 'SYMBOL', 'SYMBOLS', 'XREF']
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

  // Improved layer consolidation - more aggressive approach
  const consolidateLayersAggressively = (entities) => {
    console.log(`Starting aggressive layer consolidation with ${entities.length} entities`);

    // Group entities by layer
    const layerGroups = new Map();
    entities.forEach(entity => {
      if (!entity?.type || !entity.layer) return;
      const layerName = entity.layer;
      if (!layerGroups.has(layerName)) {
        layerGroups.set(layerName, []);
      }
      layerGroups.get(layerName).push(entity);
    });

    // Calculate comprehensive metrics for each layer
    const layerMetrics = new Map();
    layerGroups.forEach((layerEntities, layerName) => {
      const metrics = calculateLayerMetrics(layerEntities, layerName);
      layerMetrics.set(layerName, metrics);
    });

    // More aggressive layer removal strategy
    const layersToRemove = new Set();
    const layerNames = Array.from(layerGroups.keys());

    // Sort layers by priority (highest priority first)
    layerNames.sort((a, b) => {
      const priorityA = calculateLayerPriority(a, layerMetrics.get(a));
      const priorityB = calculateLayerPriority(b, layerMetrics.get(b));
      return priorityB - priorityA;
    });

    // Remove layers with high overlap and low priority
    for (let i = 0; i < layerNames.length; i++) {
      if (layersToRemove.has(layerNames[i])) continue;

      const layer1 = layerNames[i];
      const metrics1 = layerMetrics.get(layer1);

      for (let j = i + 1; j < layerNames.length; j++) {
        if (layersToRemove.has(layerNames[j])) continue;

        const layer2 = layerNames[j];
        const metrics2 = layerMetrics.get(layer2);

        // Check for overlap and similarity
        const overlapRatio = calculateLayerOverlap(metrics1, metrics2);
        const similarity = calculateEntityTypeSimilarity(metrics1.entities, metrics2.entities);

        // More aggressive thresholds
        const shouldRemove = (
          (overlapRatio > 0.4 && similarity > 0.6) || // Lower overlap threshold
          (overlapRatio > 0.7) || // High overlap regardless of similarity
          (similarity > 0.9 && overlapRatio > 0.2) || // Very similar entities
          isRedundantLayer(layer2, layer1) // Known redundant patterns
        );

        if (shouldRemove) {
          layersToRemove.add(layer2);
          console.log(`Removing redundant layer: ${layer2} (overlap: ${(overlapRatio*100).toFixed(1)}%, similarity: ${(similarity*100).toFixed(1)}%)`);
        }
      }
    }

    // Filter out removed layers
    const consolidatedEntities = entities.filter(entity => !layersToRemove.has(entity.layer));
    
    // Apply final deduplication
    const finalEntities = aggressiveEntityDeduplication(consolidatedEntities);

    console.log(`Aggressive consolidation complete: ${entities.length} → ${finalEntities.length} entities`);
    console.log(`Removed ${layersToRemove.size} layers: [${Array.from(layersToRemove).join(', ')}]`);

    return finalEntities;
  };

  const calculateLayerMetrics = (entities, layerName) => {
    let totalLength = 0;
    let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    let entityTypes = new Map();
    let geometricComplexity = 0;

    entities.forEach(entity => {
      entityTypes.set(entity.type, (entityTypes.get(entity.type) || 0) + 1);

      switch (entity.type) {
        case 'LINE':
          if (entity.startPoint && entity.endPoint) {
            const dx = entity.endPoint.x - entity.startPoint.x;
            const dy = entity.endPoint.y - entity.startPoint.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            totalLength += length;
            geometricComplexity += 1;
            updateBoundsFromPoints(bounds, [entity.startPoint, entity.endPoint]);
          }
          break;

        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (entity.vertices && entity.vertices.length > 1) {
            for (let i = 0; i < entity.vertices.length - 1; i++) {
              const v1 = entity.vertices[i];
              const v2 = entity.vertices[i + 1];
              const dx = v2.x - v1.x;
              const dy = v2.y - v1.y;
              totalLength += Math.sqrt(dx * dx + dy * dy);
            }
            geometricComplexity += entity.vertices.length;
            updateBoundsFromPoints(bounds, entity.vertices);
          }
          break;

        case 'CIRCLE':
          if (entity.radius) {
            totalLength += 2 * Math.PI * entity.radius;
            geometricComplexity += 2;
            updateBoundsFromPoints(bounds, [{
              x: entity.center.x - entity.radius,
              y: entity.center.y - entity.radius
            }, {
              x: entity.center.x + entity.radius,
              y: entity.center.y + entity.radius
            }]);
          }
          break;

        case 'ARC':
          if (entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
            const angleDiff = Math.abs(entity.endAngle - entity.startAngle);
            totalLength += entity.radius * angleDiff;
            geometricComplexity += 2;
            updateBoundsFromPoints(bounds, [{
              x: entity.center.x - entity.radius,
              y: entity.center.y - entity.radius
            }, {
              x: entity.center.x + entity.radius,
              y: entity.center.y + entity.radius
            }]);
          }
          break;

        default:
          geometricComplexity += 0.5;
          break;
      }
    });

    const boundingArea = bounds.minX !== Infinity ?
      (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) : 0;

    return {
      totalLength,
      bounds,
      boundingArea,
      entityCount: entities.length,
      entityTypes,
      entities,
      geometricComplexity,
      layerName
    };
  };

  const updateBoundsFromPoints = (bounds, points) => {
    points.forEach(point => {
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    });
  };

  const calculateLayerOverlap = (metrics1, metrics2) => {
    const bounds1 = metrics1.bounds;
    const bounds2 = metrics2.bounds;

    if (bounds1.minX === Infinity || bounds2.minX === Infinity) return 0;

    const overlapMinX = Math.max(bounds1.minX, bounds2.minX);
    const overlapMaxX = Math.min(bounds1.maxX, bounds2.maxX);
    const overlapMinY = Math.max(bounds1.minY, bounds2.minY);
    const overlapMaxY = Math.min(bounds1.maxY, bounds2.maxY);

    if (overlapMinX >= overlapMaxX || overlapMinY >= overlapMaxY) return 0;

    const overlapArea = (overlapMaxX - overlapMinX) * (overlapMaxY - overlapMinY);
    const area1 = metrics1.boundingArea;
    const area2 = metrics2.boundingArea;
    
    const maxArea = Math.max(area1, area2);
    return maxArea > 0 ? overlapArea / maxArea : 0;
  };

  const isRedundantLayer = (layer1, layer2) => {
    const redundantPatterns = [
      // Same base name with different suffixes
      [/^(.+)-\d+$/, /^(.+)-\d+$/],
      [/^(.+)_\d+$/, /^(.+)_\d+$/],
      // Annotation layers
      [/ANNO/, /TEXT|MTEXT|DIM/],
      // Temporary or construction layers
      [/TEMP|TMP/, /.*/],
      [/CONST|CONSTRUCTION/, /.*/],
      // Duplicate naming patterns
      [/(.+)-COPY/, /\1$/],
      [/(.+)-OLD/, /\1$/],
      [/(.+)-BAK/, /\1$/]
    ];

    const upper1 = layer1.toUpperCase();
    const upper2 = layer2.toUpperCase();

    return redundantPatterns.some(([pattern1, pattern2]) => {
      const match1 = upper1.match(pattern1);
      const match2 = upper2.match(pattern2);
      
      if (match1 && match2) {
        // If both patterns have capture groups, check if they match
        if (match1[1] && match2[1]) {
          return match1[1] === match2[1];
        }
        return true;
      }
      return false;
    });
  };

  const calculateLayerPriority = (layerName, metrics) => {
    let priority = 0;
    const upperLayer = layerName.toUpperCase();

    // Base priority from entity count and geometric complexity
    priority += Math.log(metrics.entityCount + 1) * 0.3;
    priority += Math.log(metrics.totalLength + 1) * 0.4;
    priority += Math.log(metrics.geometricComplexity + 1) * 0.2;

    // High priority keywords (structural elements)
    const highPriorityKeywords = ['WALL', 'COLUMN', 'BEAM', 'STRUCTURE', 'OUTLINE', 'BOUNDARY', 'PERIMETER', 'FRAME'];
    if (highPriorityKeywords.some(k => upperLayer.includes(k))) priority += 5;

    // Medium priority keywords (architectural elements)
    const mediumPriorityKeywords = ['DOOR', 'WINDOW', 'STAIR', 'ELEVATOR', 'FIXTURE'];
    if (mediumPriorityKeywords.some(k => upperLayer.includes(k))) priority += 3;

    // Low priority keywords (annotations, temporary)
    const lowPriorityKeywords = ['HATCH', 'PATTERN', 'FILL', 'TEMP', 'XREF', 'DEFPOINTS', 'ANNO', 'TEXT', 'DIM'];
    if (lowPriorityKeywords.some(k => upperLayer.includes(k))) priority -= 3;

    // Layer naming conventions
    if (layerName.length <= 3) priority += 2; // Short names often more important
    if (layerName === '0') priority += 3; // Default layer
    if (upperLayer.includes('COPY') || upperLayer.includes('OLD') || upperLayer.includes('BAK')) priority -= 5;

    // Penalize layers with very few entities
    if (metrics.entityCount < 3) priority -= 2;

    return priority;
  };

  const aggressiveEntityDeduplication = (entities) => {
    console.log(`Starting aggressive entity deduplication with ${entities.length} entities`);
    
    const entityMap = new Map();
    const uniqueEntities = [];
    const tolerance = 0.1; // Tighter tolerance

    entities.forEach(entity => {
      const key = generateEntityKey(entity, tolerance);
      
      if (!entityMap.has(key)) {
        entityMap.set(key, entity);
        uniqueEntities.push(entity);
      } else {
        // Keep the entity from the higher priority layer
        const existing = entityMap.get(key);
        const existingPriority = getLayerPriorityScore(existing.layer);
        const currentPriority = getLayerPriorityScore(entity.layer);
        
        if (currentPriority > existingPriority) {
          // Replace with higher priority entity
          const index = uniqueEntities.indexOf(existing);
          if (index !== -1) {
            uniqueEntities[index] = entity;
            entityMap.set(key, entity);
          }
        }
        // Otherwise keep the existing one
      }
    });

    console.log(`Aggressive deduplication: ${entities.length} → ${uniqueEntities.length} entities`);
    return uniqueEntities;
  };

  const generateEntityKey = (entity, tolerance) => {
    switch (entity.type) {
      case 'LINE':
        const start = entity.startPoint || entity.start;
        const end = entity.endPoint || entity.end;
        if (start && end) {
          const x1 = Math.round(start.x / tolerance) * tolerance;
          const y1 = Math.round(start.y / tolerance) * tolerance;
          const x2 = Math.round(end.x / tolerance) * tolerance;
          const y2 = Math.round(end.y / tolerance) * tolerance;
          const p1 = `${x1},${y1}`;
          const p2 = `${x2},${y2}`;
          return `LINE:${p1 < p2 ? p1 + '-' + p2 : p2 + '-' + p1}`;
        }
        break;

      case 'CIRCLE':
        if (entity.center && entity.radius) {
          const cx = Math.round(entity.center.x / tolerance) * tolerance;
          const cy = Math.round(entity.center.y / tolerance) * tolerance;
          const r = Math.round(entity.radius / tolerance) * tolerance;
          return `CIRCLE:${cx},${cy}:${r}`;
        }
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && entity.vertices.length > 0) {
          const points = entity.vertices.map(v => {
            const x = Math.round(v.x / tolerance) * tolerance;
            const y = Math.round(v.y / tolerance) * tolerance;
            return `${x},${y}`;
          }).join('|');
          return `${entity.type}:${points}:${entity.closed || false}`;
        }
        break;

      default:
        // For other entities, use a combination of type, position, and key properties
        const pos = entity.position || entity.insertionPoint || entity.center || { x: 0, y: 0 };
        const x = Math.round(pos.x / tolerance) * tolerance;
        const y = Math.round(pos.y / tolerance) * tolerance;
        return `${entity.type}:${x},${y}:${entity.handle || 'no-handle'}`;
    }

    return `${entity.type}:${entity.handle || Math.random()}`;
  };

  const getLayerPriorityScore = (layerName) => {
    if (!layerName) return 0;
    
    const upper = layerName.toUpperCase();
    
    if (['WALL', 'COLUMN', 'BEAM', 'STRUCTURE'].some(k => upper.includes(k))) return 10;
    if (['DOOR', 'WINDOW', 'STAIR'].some(k => upper.includes(k))) return 8;
    if (['OUTLINE', 'BOUNDARY', 'PERIMETER'].some(k => upper.includes(k))) return 7;
    if (layerName === '0') return 6;
    if (['ANNO', 'TEXT', 'DIM', 'HATCH'].some(k => upper.includes(k))) return 2;
    if (['TEMP', 'COPY', 'OLD', 'BAK'].some(k => upper.includes(k))) return 1;
    
    return 5; // Default priority
  };

  function calculateEntityTypeSimilarity(entities1, entities2) {
    const getTypeDistribution = (entities) => {
      const distribution = {};
      entities.forEach(entity => {
        distribution[entity.type] = (distribution[entity.type] || 0) + 1;
      });
      return distribution;
    };

    const dist1 = getTypeDistribution(entities1);
    const dist2 = getTypeDistribution(entities2);

    const allTypes = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
    let similarity = 0;
    let totalWeight = 0;

    allTypes.forEach(type => {
      const count1 = dist1[type] || 0;
      const count2 = dist2[type] || 0;
      const maxCount = Math.max(count1, count2);
      const minCount = Math.min(count1, count2);

      if (maxCount > 0) {
        similarity += (minCount / maxCount) * maxCount;
        totalWeight += maxCount;
      }
    });

    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  // Rest of the helper functions remain the same but optimized...
  const calculateTightBounds = (entities) => {
    const tightBounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      valid: false
    };

    const addPoint = (x, y, entityType = 'unknown', handle = '') => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) return;
      
      tightBounds.minX = Math.min(tightBounds.minX, x);
      tightBounds.minY = Math.min(tightBounds.minY, y);
      tightBounds.maxX = Math.max(tightBounds.maxX, x);
      tightBounds.maxY = Math.max(tightBounds.maxY, y);
      tightBounds.valid = true;
    };

    entities.forEach(entity => {
      if (!entity?.type) return;
      if (entity.layer && !isLayerVisible(entity.layer)) return;

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

        case 'CIRCLE':
          if (entity.center && Number.isFinite(entity.radius)) {
            const [cx, cy] = applyTransform(entity.center.x, entity.center.y, transformStack);
            addPoint(cx - entity.radius, cy - entity.radius, 'CIRCLE', entity.handle);
            addPoint(cx + entity.radius, cy + entity.radius, 'CIRCLE', entity.handle);
          }
          break;

        // Add other entity types as needed...
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

  const updateBounds = (x, y, entityType = 'unknown', entityHandle = '') => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) return;

    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.valid = true;
  };

  const isLayerVisible = (layerName) => {
    if (shouldShowAllLayers) return true;
    if (!layerName) return true;
    
    const isVisible = visibleLayers.includes(layerName);
    if (!isVisible) {
      skippedByLayer.set(layerName, (skippedByLayer.get(layerName) || 0) + 1);
    }
    return isVisible;
  };

  const shouldRenderEntity = (entity, layers = {}) => {
    if (entity.layer && !isLayerVisible(entity.layer)) return false;

    const layerInfo = layers[entity.layer];
    if (layerInfo) {
      if (layerInfo.frozen === true || (layerInfo.flags && (layerInfo.flags & 4))) return false;
      if (layerInfo.off === true || (layerInfo.flags && (layerInfo.flags & 2))) return false;
      if (layerInfo.flags && (layerInfo.flags & 1)) return false;
    }

    if (entity.invisible === true || (entity.flags && (entity.flags & 1))) return false;
    if (entity.plotFlag === false) return false;
    if (config.dropEntityTypes.has(entity.type)) return false;

    if (entity.layer) {
      const lname = entity.layer.toUpperCase();
      for (const key of config.dropLayersLike) {
        if (lname.includes(key)) return false;
      }
    }

    return true;
  };

  // Simplified entity handlers (keeping the essential ones)
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

    CIRCLE: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius)) return null;

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      updateBounds(cx - e.radius, cy - e.radius, 'CIRCLE', e.handle);
      updateBounds(cx + e.radius, cy + e.radius, 'CIRCLE', e.handle);

      return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(e.radius)}" ${stroke}/>`;
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

    POLYLINE: (e, color, stroke, transforms) => {
      if (!Array.isArray(e.vertices) || e.vertices.length < 2) return null;

      const points = e.vertices.map(v => {
        const [x, y] = applyTransform(v.x, v.y, transforms);
        updateBounds(x, y, 'POLYLINE', e.handle);
        return `${round(x)},${round(y)}`;
      });

      return `<polyline points="${points.join(' ')}" ${stroke}/>`;
    },

    TEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !e.position) return null;

      const [x, y] = applyTransform(e.position.x, e.position.y, transforms);
      updateBounds(x, y, 'TEXT', e.handle);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 6);
      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" transform="scale(1,-1)">${escapeXml(e.text)}</text>`;
    },

    MTEXT: (e, color, stroke, transforms) => {
      if (config.hideText || !e.text || !(e.insert || e.insertionPoint)) return null;

      const pt = e.insert || e.insertionPoint;
      const [x, y] = applyTransform(pt.x, pt.y, transforms);
      updateBounds(x, y, 'MTEXT', e.handle);

      const fontSize = Math.max((e.height || 12) * config.textSizeMultiplier, 6);
      return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="rgb(${color.r},${color.g},${color.b})" transform="scale(1,-1)">${escapeXml(e.text)}</text>`;
    }
  };

  const escapeXml = (text) => {
    const xmlEscapeMap = new Map([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#39;']
    ]);
    return String(text).replace(/[&<>"']/g, (match) => xmlEscapeMap.get(match));
  };

  const getEntityColor = (entity, layers = {}) => {
    // Simplified color logic
    if (entity.layer && layers[entity.layer]) {
      const layerInfo = layers[entity.layer];
      if (layerInfo.color && typeof layerInfo.color === 'object') {
        return layerInfo.color;
      }
    }
    return { r: 0, g: 0, b: 0 };
  };

  const generateElement = (e, source, currentTransforms) => {
    if (!e?.type) return null;

    const layerInfo = tables.LAYER?.entries?.reduce((acc, layer) => {
      acc[layer.name] = layer;
      return acc;
    }, {}) || {};

    if (!shouldRenderEntity(e, layerInfo)) return null;

    const handler = entityHandlers[e.type];
    if (!handler) return null;

    try {
      const color = getEntityColor(e, layerInfo);
      const strokeWidth = normalizeStrokeWidth();

      const isHighlighted = highlightedEntityHandle && e.handle === highlightedEntityHandle;
      
      let strokeColor, strokeWidth_final, fillColor;
      if (isHighlighted) {
        strokeColor = '#FF0000';
        strokeWidth_final = '15';
        fillColor = 'rgba(255, 0, 0, 0.3)';
      } else {
        strokeColor = `rgb(${color.r},${color.g},${color.b})`;
        strokeWidth_final = strokeWidth;
        fillColor = 'none';
      }

      const stroke = `stroke="${strokeColor}" stroke-width="${strokeWidth_final}" fill="${fillColor}"`;
      const result = handler(e, color, stroke, currentTransforms);

      if (result) {
        processedElements++;
        const dataHandle = e.handle ? `data-handle="${e.handle}"` : '';
        const entityClass = `class="dwg-entity deletable-entity"`;
        
        // Add attributes to the element
        if (result.startsWith('<')) {
          const tagEnd = result.indexOf('>');
          return result.slice(0, tagEnd) + ` ${dataHandle} ${entityClass}` + result.slice(tagEnd);
        }
      }
      
      return result;
    } catch (err) {
      console.warn(`Error processing ${e.type}:`, err);
      return null;
    }
  };

  // Main processing pipeline
  console.log(`Starting SVG conversion with ${db.entities?.length || 0} entities`);

  // Step 1: Filter and prepare entities
  let entities = db.entities || [];
  if (entities.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  // Step 2: Apply aggressive layer consolidation
  entities = consolidateLayersAggressively(entities);

  // Step 3: Generate SVG elements
  const svgElements = [];
  entities.forEach(entity => {
    const element = generateElement(entity, 'Model_Space', transformStack);
    if (element) {
      svgElements.push(element);
    }
  });

  // Step 4: Calculate bounds and create final SVG
  const tightBounds = calculateTightBounds(entities);
  
  if (!tightBounds.valid) {
    console.warn('No valid bounds found, using defaults');
    Object.assign(tightBounds, { minX: 0, minY: 0, maxX: 1000, maxY: 1000, valid: true });
  }

  const fit = computeFitTransform(tightBounds, 1200, 640, 0.02);
  
  const svgContent = svgElements.join('\n');
  
  let svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640">
    <g transform="${fit.transform}">
      ${svgContent}
    </g>
  </svg>`;

  // Optimize SVG string
  svgString = svgString
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`SVG generation complete: ${processedElements} elements processed`);
  console.log(`Final entity count: ${entities.length}`);

  return svgString;
}