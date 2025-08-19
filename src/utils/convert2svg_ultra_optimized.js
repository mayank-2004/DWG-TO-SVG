export function convertToSvg(db, transformStack = [], visibleLayers = null, highlightedEntityHandle = null) {
  const tables = db.tables || {};

  if (!tables.BLOCK_RECORD?.entries?.length && !db.entities?.length) {
    console.warn('No BLOCK_RECORD entries or entities found');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  const shouldShowAllLayers = !visibleLayers || !Array.isArray(visibleLayers);

  console.log('Ultra-optimized SVG conversion starting...');

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
    // More aggressive dropping of entity types
    dropEntityTypes: new Set(['DIMENSION', 'LEADER', 'HATCH', 'POINT', 'ATTDEF', 'TOLERANCE', 'MLINE', 'TABLE', 'VIEWPORT', 'REGION', 'BODY', 'SURFACE', 'MESH']),
    dropLayersLike: ['DEFPOINTS', 'DIMS', 'DIM', 'DIMENSIONS', 'ANNOTATION', 'ANNO', 'TEXT', 'MTEXT', 'TITLE', 'BORDER', 'SHEET', 'PLOT', 'HATCH', 'PATTERN', 'SYMB', 'SYMBOL', 'SYMBOLS', 'XREF', 'TEMP', 'TMP', 'CONST', 'CONSTRUCTION']
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

  // Spatial hashing for efficient duplicate detection
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
      case 'ARC':
        if (!entity.center || !entity.radius) return null;
        return {
          minX: entity.center.x - entity.radius,
          maxX: entity.center.x + entity.radius,
          minY: entity.center.y - entity.radius,
          maxY: entity.center.y + entity.radius
        };
      case 'TEXT':
      case 'MTEXT':
        const pos = entity.position || entity.insertionPoint || entity.insert;
        if (!pos) return null;
        const size = (entity.height || entity.textHeight || 12) * 2;
        return {
          minX: pos.x - size,
          maxX: pos.x + size,
          minY: pos.y - size,
          maxY: pos.y + size
        };
      case 'INSERT':
        const insertPos = entity.insertionPoint || entity.position;
        if (!insertPos) return null;
        const scale = Math.max(entity.xScale || 1, entity.yScale || 1) * 50;
        return {
          minX: insertPos.x - scale,
          maxX: insertPos.x + scale,
          minY: insertPos.y - scale,
          maxY: insertPos.y + scale
        };
      default:
        return null;
    }
  };

  const areEntitiesIdentical = (entity1, entity2, tolerance = 0.1) => {
    if (entity1.type !== entity2.type) return false;

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

      case 'ARC':
        if (!entity1.center || !entity2.center) return false;
        return Math.abs(entity1.center.x - entity2.center.x) < tolerance &&
          Math.abs(entity1.center.y - entity2.center.y) < tolerance &&
          Math.abs(entity1.radius - entity2.radius) < tolerance &&
          Math.abs((entity1.startAngle || 0) - (entity2.startAngle || 0)) < 0.01 &&
          Math.abs((entity1.endAngle || 0) - (entity2.endAngle || 0)) < 0.01;

      default:
        return false;
    }
  };

  // Ultra-aggressive layer consolidation
  const ultraAggressiveLayerConsolidation = (entities) => {
    console.log(`Starting ultra-aggressive layer consolidation with ${entities.length} entities`);

    // Step 1: Group entities by type and geometric similarity
    const geometricGroups = new Map();
    
    entities.forEach(entity => {
      const key = generateGeometricKey(entity);
      if (key) {
        if (!geometricGroups.has(key)) {
          geometricGroups.set(key, []);
        }
        geometricGroups.get(key).push(entity);
      }
    });

    // Step 2: For each geometric group, keep only the best representative
    const consolidatedEntities = [];
    let removedCount = 0;

    geometricGroups.forEach((group, key) => {
      if (group.length === 1) {
        consolidatedEntities.push(group[0]);
      } else {
        // Sort by layer priority and keep the best one
        group.sort((a, b) => {
          const priorityA = getLayerPriority(a.layer);
          const priorityB = getLayerPriority(b.layer);
          if (priorityA !== priorityB) return priorityB - priorityA;
          
          // Secondary sort by completeness of entity data
          const scoreA = getEntityCompleteness(a);
          const scoreB = getEntityCompleteness(b);
          return scoreB - scoreA;
        });

        consolidatedEntities.push(group[0]);
        removedCount += group.length - 1;
        
        if (group.length > 1) {
          console.log(`Consolidated ${group.length} identical ${group[0].type} entities, kept layer: ${group[0].layer}`);
        }
      }
    });

    console.log(`Ultra-aggressive consolidation: ${entities.length} → ${consolidatedEntities.length} entities (removed ${removedCount})`);
    return consolidatedEntities;
  };

  const generateGeometricKey = (entity) => {
    const tolerance = 0.05; // Very tight tolerance for geometric matching
    
    switch (entity.type) {
      case 'LINE':
        const start = entity.startPoint || entity.start;
        const end = entity.endPoint || entity.end;
        if (!start || !end) return null;
        
        const x1 = Math.round(start.x / tolerance) * tolerance;
        const y1 = Math.round(start.y / tolerance) * tolerance;
        const x2 = Math.round(end.x / tolerance) * tolerance;
        const y2 = Math.round(end.y / tolerance) * tolerance;
        
        // Normalize line direction for consistent keys
        const p1 = `${x1},${y1}`;
        const p2 = `${x2},${y2}`;
        return `LINE:${p1 < p2 ? p1 + '-' + p2 : p2 + '-' + p1}`;

      case 'CIRCLE':
        if (!entity.center || !entity.radius) return null;
        const cx = Math.round(entity.center.x / tolerance) * tolerance;
        const cy = Math.round(entity.center.y / tolerance) * tolerance;
        const r = Math.round(entity.radius / tolerance) * tolerance;
        return `CIRCLE:${cx},${cy}:${r}`;

      case 'ARC':
        if (!entity.center || !entity.radius) return null;
        const acx = Math.round(entity.center.x / tolerance) * tolerance;
        const acy = Math.round(entity.center.y / tolerance) * tolerance;
        const ar = Math.round(entity.radius / tolerance) * tolerance;
        const sa = Math.round((entity.startAngle || 0) * 1000) / 1000;
        const ea = Math.round((entity.endAngle || 0) * 1000) / 1000;
        return `ARC:${acx},${acy}:${ar}:${sa}:${ea}`;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (!entity.vertices || entity.vertices.length === 0) return null;
        const points = entity.vertices.map(v => {
          const x = Math.round(v.x / tolerance) * tolerance;
          const y = Math.round(v.y / tolerance) * tolerance;
          return `${x},${y}`;
        }).join('|');
        return `${entity.type}:${points}:${entity.closed || false}`;

      case 'TEXT':
      case 'MTEXT':
        const textPos = entity.position || entity.insertionPoint || entity.insert;
        if (!textPos) return null;
        const tx = Math.round(textPos.x / tolerance) * tolerance;
        const ty = Math.round(textPos.y / tolerance) * tolerance;
        const text = (entity.text || '').substring(0, 50); // Limit text length for key
        return `${entity.type}:${tx},${ty}:${text}`;

      case 'INSERT':
        const insertPos = entity.insertionPoint || entity.position;
        if (!insertPos) return null;
        const ix = Math.round(insertPos.x / tolerance) * tolerance;
        const iy = Math.round(insertPos.y / tolerance) * tolerance;
        const blockName = entity.blockName || entity.name || 'UNKNOWN';
        const scale = `${entity.xScale || 1}:${entity.yScale || 1}`;
        const rotation = Math.round((entity.rotation || 0) * 1000) / 1000;
        return `INSERT:${blockName}:${ix},${iy}:${scale}:${rotation}`;

      default:
        return null;
    }
  };

  const getLayerPriority = (layerName) => {
    if (!layerName) return 0;
    
    const upper = layerName.toUpperCase();
    
    // Structural elements get highest priority
    if (['WALL', 'COLUMN', 'BEAM', 'STRUCTURE', 'STRUCTURAL'].some(k => upper.includes(k))) return 100;
    if (['OUTLINE', 'BOUNDARY', 'PERIMETER', 'FRAME'].some(k => upper.includes(k))) return 90;
    if (layerName === '0') return 85; // Default layer
    
    // Architectural elements
    if (['DOOR', 'WINDOW', 'OPENING'].some(k => upper.includes(k))) return 80;
    if (['STAIR', 'ELEVATOR', 'LIFT'].some(k => upper.includes(k))) return 75;
    if (['FIXTURE', 'EQUIPMENT', 'FURNITURE'].some(k => upper.includes(k))) return 70;
    
    // MEP elements
    if (['ELECTRIC', 'ELECTRICAL', 'POWER', 'LIGHTING'].some(k => upper.includes(k))) return 65;
    if (['PLUMB', 'WATER', 'DRAIN', 'SEWER'].some(k => upper.includes(k))) return 60;
    if (['HVAC', 'DUCT', 'VENT', 'AIR'].some(k => upper.includes(k))) return 55;
    
    // Detail elements
    if (['DETAIL', 'SECTION', 'ELEVATION'].some(k => upper.includes(k))) return 50;
    
    // Text and annotations (lower priority)
    if (['TEXT', 'MTEXT', 'LABEL', 'TAG'].some(k => upper.includes(k))) return 30;
    if (['ANNO', 'ANNOTATION', 'NOTE'].some(k => upper.includes(k))) return 25;
    if (['DIM', 'DIMENSION', 'MEASURE'].some(k => upper.includes(k))) return 20;
    
    // Temporary/construction (very low priority)
    if (['TEMP', 'TMP', 'TEMPORARY'].some(k => upper.includes(k))) return 5;
    if (['CONST', 'CONSTRUCTION', 'WORK'].some(k => upper.includes(k))) return 5;
    if (['COPY', 'OLD', 'BAK', 'BACKUP'].some(k => upper.includes(k))) return 1;
    
    // Unwanted layers (negative priority)
    if (['DEFPOINTS', 'XREF', 'HATCH', 'PATTERN'].some(k => upper.includes(k))) return -10;
    
    return 40; // Default priority for unknown layers
  };

  const getEntityCompleteness = (entity) => {
    let score = 0;
    
    if (entity.handle) score += 3;
    if (entity.layer && entity.layer !== '0') score += 2;
    if (entity.color) score += 1;
    if (entity.lineType && entity.lineType !== 'BYLAYER') score += 1;
    if (entity.lineWeight) score += 1;
    
    // Type-specific completeness
    switch (entity.type) {
      case 'TEXT':
      case 'MTEXT':
        if (entity.text && entity.text.trim()) score += 5;
        if (entity.height || entity.textHeight) score += 2;
        break;
      case 'INSERT':
        if (entity.blockName) score += 5;
        if (entity.xScale && entity.yScale) score += 2;
        break;
      default:
        score += 1;
    }
    
    return score;
  };

  // Enhanced identical entity removal with spatial hashing
  const removeIdenticalEntities = (entities) => {
    console.log(`Starting spatial-hashed identical entity removal with ${entities.length} entities`);

    const grid = spatialHashEntities(entities, 100);
    const toRemove = new Set();
    const processed = new Set();

    entities.forEach((entity, index) => {
      if (processed.has(index) || toRemove.has(index)) return;

      const bounds = getEntityBounds(entity);
      if (!bounds) return;

      // Check all nearby grid cells
      const minGridX = Math.floor(bounds.minX / 100);
      const maxGridX = Math.floor(bounds.maxX / 100);
      const minGridY = Math.floor(bounds.minY / 100);
      const maxGridY = Math.floor(bounds.maxY / 100);

      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          const gridKey = `${gx}_${gy}`;
          const nearbyEntities = grid.get(gridKey) || [];

          nearbyEntities.forEach(otherEntity => {
            const otherIndex = entities.indexOf(otherEntity);
            if (otherIndex <= index || processed.has(otherIndex) || toRemove.has(otherIndex)) return;

            if (areEntitiesIdentical(entity, otherEntity, 0.5)) {
              // Keep the entity with higher layer priority
              const priority1 = getLayerPriority(entity.layer);
              const priority2 = getLayerPriority(otherEntity.layer);
              
              if (priority2 > priority1) {
                toRemove.add(index);
              } else {
                toRemove.add(otherIndex);
              }
            }
          });
        }
      }

      processed.add(index);
    });

    const result = entities.filter((_, index) => !toRemove.has(index));
    console.log(`Spatial identical entity removal: ${entities.length} → ${result.length} entities`);
    return result;
  };

  // Optimized block instance consolidation
  const consolidateBlockInstances = (entities) => {
    const insertEntities = entities.filter(e => e.type === 'INSERT');
    const nonInsertEntities = entities.filter(e => e.type !== 'INSERT');

    if (insertEntities.length === 0) return entities;

    console.log(`Consolidating ${insertEntities.length} INSERT entities`);

    const blockGroups = new Map();

    insertEntities.forEach(insert => {
      const key = `${insert.blockName}_${Math.round((insert.xScale || 1) * 100)}_${Math.round((insert.yScale || 1) * 100)}_${Math.round((insert.rotation || 0) * 1000)}`;
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

      // Group by spatial proximity with tighter tolerance
      const spatialGroups = [];
      const tolerance = 5; // Tighter tolerance

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

      // Keep only the best instance per spatial group
      spatialGroups.forEach(group => {
        if (group.length === 1) {
          consolidated.push(group[0]);
        } else {
          // Sort by layer priority and completeness
          group.sort((a, b) => {
            const priorityA = getLayerPriority(a.layer);
            const priorityB = getLayerPriority(b.layer);
            if (priorityA !== priorityB) return priorityB - priorityA;
            return getEntityCompleteness(b) - getEntityCompleteness(a);
          });
          
          consolidated.push(group[0]);
          removedCount += group.length - 1;
        }
      });
    });

    console.log(`Block consolidation: removed ${removedCount} duplicate block instances`);
    return [...nonInsertEntities, ...consolidated];
  };

  // Optimized circular entity consolidation
  const optimizeCircularEntities = (entities) => {
    const circles = entities.filter(e => e.type === 'CIRCLE');
    const arcs = entities.filter(e => e.type === 'ARC');
    const others = entities.filter(e => !['CIRCLE', 'ARC'].includes(e.type));

    let optimizedCircles = [];
    let optimizedArcs = [];
    let removedCount = 0;

    // Process circles
    if (circles.length > 0) {
      const circleGroups = new Map();

      circles.forEach(circle => {
        if (!circle.center || !circle.radius) return;

        const key = `${Math.round(circle.center.x * 10)}_${Math.round(circle.center.y * 10)}_${Math.round(circle.radius * 100)}`;
        if (!circleGroups.has(key)) circleGroups.set(key, []);
        circleGroups.get(key).push(circle);
      });

      circleGroups.forEach(group => {
        if (group.length === 1) {
          optimizedCircles.push(group[0]);
        } else {
          // Keep the circle with highest layer priority and completeness
          group.sort((a, b) => {
            const priorityA = getLayerPriority(a.layer);
            const priorityB = getLayerPriority(b.layer);
            if (priorityA !== priorityB) return priorityB - priorityA;
            return getEntityCompleteness(b) - getEntityCompleteness(a);
          });

          optimizedCircles.push(group[0]);
          removedCount += group.length - 1;
        }
      });
    }

    // Process arcs similarly
    if (arcs.length > 0) {
      const arcGroups = new Map();

      arcs.forEach(arc => {
        if (!arc.center || !arc.radius) return;

        const key = `${Math.round(arc.center.x * 10)}_${Math.round(arc.center.y * 10)}_${Math.round(arc.radius * 100)}_${Math.round((arc.startAngle || 0) * 1000)}_${Math.round((arc.endAngle || 0) * 1000)}`;
        if (!arcGroups.has(key)) arcGroups.set(key, []);
        arcGroups.get(key).push(arc);
      });

      arcGroups.forEach(group => {
        if (group.length === 1) {
          optimizedArcs.push(group[0]);
        } else {
          group.sort((a, b) => {
            const priorityA = getLayerPriority(a.layer);
            const priorityB = getLayerPriority(b.layer);
            if (priorityA !== priorityB) return priorityB - priorityA;
            return getEntityCompleteness(b) - getEntityCompleteness(a);
          });

          optimizedArcs.push(group[0]);
          removedCount += group.length - 1;
        }
      });
    }

    console.log(`Circular entity optimization: removed ${removedCount} duplicate circles/arcs`);
    return [...others, ...optimizedCircles, ...optimizedArcs];
  };

  // Single unified layer approach - merge all similar entities regardless of layer
  const createUnifiedSingleLayer = (entities) => {
    console.log(`Creating unified single layer from ${entities.length} entities`);

    // Group entities by geometric type and merge layers
    const typeGroups = {
      structural: [], // walls, columns, beams, outlines
      architectural: [], // doors, windows, stairs
      mep: [], // electrical, plumbing, hvac
      text: [], // all text entities
      details: [], // dimensions, annotations, details
      other: [] // everything else
    };

    entities.forEach(entity => {
      const layerName = (entity.layer || '').toUpperCase();
      const entityType = entity.type;

      // Categorize by function rather than layer
      if (['WALL', 'COLUMN', 'BEAM', 'STRUCTURE', 'OUTLINE', 'BOUNDARY', 'PERIMETER'].some(k => layerName.includes(k)) ||
          (entityType === 'LINE' && getLayerPriority(entity.layer) >= 85)) {
        typeGroups.structural.push(entity);
      } else if (['DOOR', 'WINDOW', 'STAIR', 'ELEVATOR'].some(k => layerName.includes(k))) {
        typeGroups.architectural.push(entity);
      } else if (['ELECTRIC', 'PLUMB', 'HVAC', 'DUCT', 'POWER', 'WATER'].some(k => layerName.includes(k))) {
        typeGroups.mep.push(entity);
      } else if (['TEXT', 'MTEXT'].includes(entityType)) {
        typeGroups.text.push(entity);
      } else if (['DIM', 'ANNO', 'LEADER', 'DETAIL'].some(k => layerName.includes(k) || entityType.includes(k))) {
        typeGroups.details.push(entity);
      } else {
        typeGroups.other.push(entity);
      }
    });

    // Assign unified layer names and colors
    const unifiedEntities = [];
    
    // Process each group with consistent styling
    Object.entries(typeGroups).forEach(([groupName, groupEntities]) => {
      if (groupEntities.length === 0) return;

      groupEntities.forEach(entity => {
        // Create a copy with unified layer assignment
        const unifiedEntity = { ...entity };
        
        switch (groupName) {
          case 'structural':
            unifiedEntity.layer = 'UNIFIED-STRUCTURE';
            unifiedEntity.color = { r: 0, g: 0, b: 0 }; // Black
            break;
          case 'architectural':
            unifiedEntity.layer = 'UNIFIED-ARCHITECTURE';
            unifiedEntity.color = { r: 128, g: 128, b: 128 }; // Gray
            break;
          case 'mep':
            unifiedEntity.layer = 'UNIFIED-MEP';
            unifiedEntity.color = { r: 0, g: 128, b: 255 }; // Blue
            break;
          case 'text':
            unifiedEntity.layer = 'UNIFIED-TEXT';
            unifiedEntity.color = { r: 255, g: 0, b: 0 }; // Red
            break;
          case 'details':
            unifiedEntity.layer = 'UNIFIED-DETAILS';
            unifiedEntity.color = { r: 128, g: 128, b: 128 }; // Gray
            break;
          default:
            unifiedEntity.layer = 'UNIFIED-OTHER';
            unifiedEntity.color = { r: 64, g: 64, b: 64 }; // Dark gray
        }
        
        unifiedEntities.push(unifiedEntity);
      });
    });

    console.log(`Created unified single layer: ${entities.length} → ${unifiedEntities.length} entities`);
    console.log(`Layer distribution:`, Object.fromEntries(
      Object.entries(typeGroups).map(([name, entities]) => [name, entities.length])
    ));

    return unifiedEntities;
  };

  // Rest of the helper functions (bounds calculation, transforms, etc.)
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

      switch (entity.type) {
        case 'LINE':
          if (entity.startPoint && entity.endPoint) {
            const [x1, y1] = applyTransform(entity.startPoint.x, entity.startPoint.y, transformStack);
            const [x2, y2] = applyTransform(entity.endPoint.x, entity.endPoint.y, transformStack);
            addPoint(x1, y1, 'LINE', entity.handle);
            addPoint(x2, y2, 'LINE', entity.handle);
          }
          break;

        case 'CIRCLE':
          if (entity.center && Number.isFinite(entity.radius)) {
            const [cx, cy] = applyTransform(entity.center.x, entity.center.y, transformStack);
            addPoint(cx - entity.radius, cy - entity.radius, 'CIRCLE', entity.handle);
            addPoint(cx + entity.radius, cy + entity.radius, 'CIRCLE', entity.handle);
          }
          break;

        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (entity.vertices && Array.isArray(entity.vertices)) {
            entity.vertices.forEach(vertex => {
              if (vertex && Number.isFinite(vertex.x) && Number.isFinite(vertex.y)) {
                const [x, y] = applyTransform(vertex.x, vertex.y, transformStack);
                addPoint(x, y, entity.type, entity.handle);
              }
            });
          }
          break;

        case 'ARC':
          if (entity.center && Number.isFinite(entity.radius)) {
            const [cx, cy] = applyTransform(entity.center.x, entity.center.y, transformStack);
            addPoint(cx - entity.radius, cy - entity.radius, 'ARC', entity.handle);
            addPoint(cx + entity.radius, cy + entity.radius, 'ARC', entity.handle);
          }
          break;

        case 'TEXT':
        case 'MTEXT':
          const textPos = entity.position || entity.insertionPoint || entity.insert;
          if (textPos) {
            const [x, y] = applyTransform(textPos.x, textPos.y, transformStack);
            addPoint(x, y, entity.type, entity.handle);
          }
          break;

        case 'INSERT':
          const insertPos = entity.insertionPoint || entity.position;
          if (insertPos) {
            const [x, y] = applyTransform(insertPos.x, insertPos.y, transformStack);
            addPoint(x, y, 'INSERT', entity.handle);
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
    // More aggressive filtering
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

  // Simplified entity handlers for better performance
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

    ARC: (e, color, stroke, transforms) => {
      if (!e.center || !Number.isFinite(e.radius) || e.startAngle === undefined || e.endAngle === undefined) return null;

      const [cx, cy] = applyTransform(e.center.x, e.center.y, transforms);
      updateBounds(cx - e.radius, cy - e.radius, 'ARC', e.handle);
      updateBounds(cx + e.radius, cy + e.radius, 'ARC', e.handle);

      const startAngle = e.startAngle;
      const endAngle = e.endAngle;
      const x1 = cx + e.radius * Math.cos(startAngle);
      const y1 = cy + e.radius * Math.sin(startAngle);
      const x2 = cx + e.radius * Math.cos(endAngle);
      const y2 = cy + e.radius * Math.sin(endAngle);

      const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
      const sweepFlag = endAngle > startAngle ? 1 : 0;

      const pathData = `M ${round(x1)} ${round(y1)} A ${round(e.radius)} ${round(e.radius)} 0 ${largeArcFlag} ${sweepFlag} ${round(x2)} ${round(y2)}`;
      return `<path d="${pathData}" ${stroke}/>`;
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
    },

    INSERT: (e, color, stroke, transforms) => {
      const insertPos = e.insertionPoint || e.position;
      if (!insertPos) return null;

      const [x, y] = applyTransform(insertPos.x, insertPos.y, transforms);
      updateBounds(x, y, 'INSERT', e.handle);

      // Simplified INSERT rendering - just a small square
      const size = 5;
      return `<rect x="${round(x - size/2)}" y="${round(y - size/2)}" width="${size}" height="${size}" ${stroke}/>`;
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
    // Use unified colors based on layer
    if (entity.color && typeof entity.color === 'object') {
      return entity.color;
    }
    
    // Default to black
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

  // Main ultra-optimized processing pipeline
  console.log(`Starting ultra-optimized SVG conversion with ${db.entities?.length || 0} entities`);

  // Step 1: Initial filtering
  let entities = db.entities || [];
  if (entities.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle">No data</text></svg>';
  }

  // Step 2: Apply all optimization steps in sequence
  entities = entities.filter(entity => {
    // Basic filtering
    if (entity.layer === 'G-ANNO-SYMB' || entity.layer === 'A-GLAZ-CWMG') return false;
    if (!entity?.type) return false;
    if (config.dropEntityTypes.has(entity.type)) return false;
    
    // Layer filtering
    if (entity.layer) {
      const lname = entity.layer.toUpperCase();
      for (const key of config.dropLayersLike) {
        if (lname.includes(key)) return false;
      }
    }
    
    return true;
  });

  console.log(`After basic filtering: ${entities.length} entities`);

  // Step 3: Apply spatial-based optimizations
  entities = removeIdenticalEntities(entities);
  entities = optimizeCircularEntities(entities);
  entities = consolidateBlockInstances(entities);

  // Step 4: Ultra-aggressive layer consolidation
  entities = ultraAggressiveLayerConsolidation(entities);

  // Step 5: Create unified single layer
  entities = createUnifiedSingleLayer(entities);

  console.log(`Final optimized entity count: ${entities.length}`);

  // Step 6: Generate SVG elements
  const svgElements = [];
  entities.forEach(entity => {
    const element = generateElement(entity, 'Unified_Layer', transformStack);
    if (element) {
      svgElements.push(element);
    }
  });

  // Step 7: Calculate bounds and create final SVG
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

  // Step 8: Optimize SVG string
  svgString = svgString
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`Ultra-optimized SVG generation complete:`);
  console.log(`- Processed ${processedElements} elements`);
  console.log(`- Final entity count: ${entities.length}`);
  console.log(`- Created truly single-layered output with unified styling`);

  return svgString;
}