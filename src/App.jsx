import React, { useState, useRef, useEffect } from 'react';
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import { convertToSvg } from './utils/convert2svg';
import SVGEditor from './components/SVGEditor';

export default function App() {
  const [svg, setSvg] = useState('');
  const [name, setName] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [allLayers, setAllLayers] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState([]);
  const [showLayerDialog, setShowLayerDialog] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [showEntitiesDialog, setShowEntitiesDialog] = useState(false);
  const [highlightedEntity, setHighlightedEntity] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteHandle, setPendingDeleteHandle] = useState(null);
  const [selectedEntityInfo, setSelectedEntityInfo] = useState(null);
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const [showInlineDeleteDialog, setShowInlineDeleteDialog] = useState(false);
  const [inlineDeletePosition, setInlineDeletePosition] = useState({ x: 0, y: 0 });
  const [inlineDeleteEntity, setInlineDeleteEntity] = useState(null);

  const dbRef = useRef(null);
  const svgContainerRef = useRef(null);

  // Helper function to find entity by handle in all locations
  const findEntityByHandle = (handle, db) => {
    if (!db || !handle) {
      console.log('findEntityByHandle: Missing db or handle');
      return null;
    }

    // Convert handle to both string and number for comparison
    const handleStr = String(handle);
    const handleNum = parseInt(handle);

    console.log(`Searching for handle ${handle} (string: "${handleStr}", number: ${handleNum}) in database`);

    // First check main entities
    if (db.entities && Array.isArray(db.entities)) {
      console.log(`Searching in ${db.entities.length} main entities`);
      const entity = db.entities.find(e => e.handle === handleNum || e.handle === handleStr || String(e.handle) === handleStr);
      if (entity) {
        console.log(`Found entity in main entities:`, entity.type, 'handle:', entity.handle);
        return { entity, location: 'main', blockName: null };
      }
    }

    // Check in block definitions
    if (db.tables?.BLOCK_RECORD?.entries) {
      console.log(`Searching in ${db.tables.BLOCK_RECORD.entries.length} blocks`);
      for (const block of db.tables.BLOCK_RECORD.entries) {
        if (block.entities && Array.isArray(block.entities)) {
          console.log(`Searching in block "${block.name}" with ${block.entities.length} entities`);
          const entity = block.entities.find(e => e.handle === handleNum || e.handle === handleStr || String(e.handle) === handleStr);
          if (entity) {
            console.log(`Found entity in block "${block.name}":`, entity.type, 'handle:', entity.handle);
            return { entity, location: 'block', blockName: block.name };
          }
        }
      }
    }

    // Additional search in header/tables if entities might be there
    if (db.tables) {
      console.log('Checking other tables...');
      for (const [tableName, table] of Object.entries(db.tables)) {
        if (table.entries && Array.isArray(table.entries)) {
          for (const entry of table.entries) {
            if (entry.handle === handleNum || entry.handle === handleStr || String(entry.handle) === handleStr) {
              console.log(`Found entity in table "${tableName}"`);
              return { entity: entry, location: 'table', blockName: tableName };
            }
          }
        }
      }
    }

    console.log(`Entity with handle ${handle} not found anywhere`);
    return null;
  };

  // Helper function to remove entity by handle from all locations
  const removeEntityByHandle = (handle, db) => {
    if (!db || !handle) return false;

    // Convert handle to both string and number for comparison
    const handleStr = String(handle);
    const handleNum = parseInt(handle);

    let removed = false;

    // Remove from main entities
    if (db.entities && Array.isArray(db.entities)) {
      const initialLength = db.entities.length;
      db.entities = db.entities.filter(e => e.handle !== handleNum && e.handle !== handleStr && String(e.handle) !== handleStr);
      if (db.entities.length < initialLength) {
        removed = true;
        console.log('Entity removed from main entities');
      }
    }

    // Remove from block definitions
    if (db.tables?.BLOCK_RECORD?.entries) {
      for (const block of db.tables.BLOCK_RECORD.entries) {
        if (block.entities && Array.isArray(block.entities)) {
          const initialLength = block.entities.length;
          block.entities = block.entities.filter(e => e.handle !== handleNum && e.handle !== handleStr && String(e.handle) !== handleStr);
          if (block.entities.length < initialLength) {
            removed = true;
            console.log(`Entity removed from block: ${block.name}`);
          }
        }
      }
    }

    return removed;
  };

  const debugDatabaseStructure = () => {
    if (!dbRef.current) {
      console.log('No database loaded');
      return;
    }

    console.log('=== DATABASE STRUCTURE DEBUG ===');
    console.log('Main entities:', dbRef.current.entities?.length || 0);

    if (dbRef.current.entities && dbRef.current.entities.length > 0) {
      console.log('First 10 main entity handles:',
        dbRef.current.entities.slice(0, 10).map(e => ({ handle: e.handle, type: e.type }))
      );
    }

    console.log('Tables:', Object.keys(dbRef.current.tables || {}));

    if (dbRef.current.tables?.BLOCK_RECORD?.entries) {
      console.log('Blocks found:', dbRef.current.tables.BLOCK_RECORD.entries.length);
      dbRef.current.tables.BLOCK_RECORD.entries.forEach((block, idx) => {
        if (block.entities && block.entities.length > 0 && idx < 5) {
          console.log(`Block "${block.name}":`,
            block.entities.slice(0, 5).map(e => ({ handle: e.handle, type: e.type }))
          );
        }
      });
    }

    // Check what handles are actually in the SVG
    const svgContainer = svgContainerRef.current;
    if (svgContainer) {
      const clickableEntities = svgContainer.querySelectorAll('[data-handle]');
      console.log('SVG handles found:', Array.from(clickableEntities).slice(0, 10).map(el => el.getAttribute('data-handle')));
    }
  };

  const handleViewEntities = (layerName) => {
    setSelectedLayer(layerName);
    setShowEntitiesDialog(true);
  };

  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setName(file.name.replace(/\.dwg$/, '.svg'));

    try {
      const buf = await file.arrayBuffer();
      const lib = await LibreDwg.create({
        locateFile: f => `/wasm/${f}`
      });

      const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
      const db = lib.convert(dwg);
      dbRef.current = db;
      console.log("db ref.current set:", dbRef.current);

      console.log("Full database structure:", db);
      console.log("Entities:", db.entities);
      console.log("Tables:", db.tables);
      console.log("BLOCK_RECORD entries:", db.tables?.BLOCK_RECORD?.entries);

      const layers = db.tables?.LAYER?.entries?.map(l => l.name) || [];
      setAllLayers(layers);
      setVisibleLayers(layers);

      let hasDrawableContent = false;
      let entityCount = 0;
      const entityTypes = new Set();

      if (db.entities && Array.isArray(db.entities) && db.entities.length > 0) {
        hasDrawableContent = true;
        entityCount += db.entities.length;
        db.entities.forEach(entity => {
          if (entity.type) entityTypes.add(entity.type);
        });
        console.log(`Found ${db.entities.length} main entities`);
      }

      const blockInfo = [];
      if (db.tables?.BLOCK_RECORD?.entries) {
        for (const block of db.tables.BLOCK_RECORD.entries) {
          if (block.entities && Array.isArray(block.entities) && block.entities.length > 0) {
            if (block.name === '*Model_Space') {
              console.log(`Skipping block: ${block.name}`);
              continue;
            }
            hasDrawableContent = true;
            entityCount += block.entities.length;
            block.entities.forEach(entity => {
              if (entity.type) entityTypes.add(entity.type);
            });
            blockInfo.push({
              name: block.name,
              entityCount: block.entities.length,
              hasBasePoint: !!block.basePoint
            });
          }
        }
      }

      setFileInfo({
        totalEntities: entityCount,
        entityTypes: Array.from(entityTypes),
        blocks: blockInfo,
        layers: layers.length,
        layerNames: layers,
        dwgVersion: db.header?.version || 'Unknown'
      });

      if (db.tables?.LAYER?.entries && db.tables.LAYER.entries.length > 0) {
        console.log(`Found ${db.tables.LAYER.entries.length} layers:`);
        db.tables.LAYER.entries.forEach(layer => {
          console.log(`- Layer: ${layer.name}, ColorIndex: ${JSON.stringify(layer.colorIndex)}, Visible: ${!layer.off}`);
        });
      }

      if (!hasDrawableContent) {
        throw new Error('DWG file contains no drawable entities or the file format is not supported.');
      }

      lib.dwg_free(dwg);

      console.log('Converting to SVG with visible layers:', layers);
      const svgText = convertToSvg(db, [], layers, null);

      if (!svgText || svgText.includes('No data')) {
        throw new Error('Failed to convert DWG content to SVG. The file may contain unsupported entity types.');
      }

      setSvg(svgText);
      setShowEditor(false);

    } catch (err) {
      console.error('Error processing DWG file:', err);
      let errorMessage = 'Failed to process DWG file. ';

      if (err.message.includes('WASM')) {
        errorMessage += 'WebAssembly loading failed. Please ensure the WASM files are available.';
      } else if (err.message.includes('format')) {
        errorMessage += 'The file format may not be supported or the file may be corrupted.';
      } else if (err.message.includes('drawable entities')) {
        errorMessage += 'The file appears to be empty or contains only non-drawable elements.';
      } else {
        errorMessage += err.message || 'Please ensure it is a valid DWG file.';
      }

      setError(errorMessage);
      setSvg('');
      setFileInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSvgClick = (event) => {
    console.log('SVG clicked!', event);

    event.preventDefault();
    event.stopPropagation();

    let target = event.target;
    let entityHandle = null;
    let attempts = 0;

    while (target && !entityHandle && attempts < 100) {
      // console.log(`Target value:`, target, `Checking target tagname:`, target.tagName, ', attempts:', attempts);
      entityHandle = target.getAttribute('data-handle');
      console.log(`Checking element:`, target.tagName, ', handle:', entityHandle);

      if (!entityHandle) {
        target = target.parentElement;
      }
      attempts++;
    }

    console.log('Found entity handle:', entityHandle);

    if (entityHandle && dbRef.current) {
      // Use the helper function to find the entity
      const entityResult = findEntityByHandle(entityHandle, dbRef.current);

      console.log('Entity search result:', entityResult);

      if (entityResult) {
        // Calculate position relative to the viewport
        const dialogX = event.clientX;
        const dialogY = Math.max(50, event.clientY - 120);

        setInlineDeleteEntity({
          handle: entityHandle,
          type: entityResult.entity.type,
          layer: entityResult.entity.layer,
          location: entityResult.location,
          blockName: entityResult.blockName,
          source: 'svg-click'
        });

        setInlineDeletePosition({ x: dialogX, y: dialogY });
        setShowInlineDeleteDialog(true);
        setHighlightedEntity(entityHandle);

        console.log('Showing inline delete dialog for:', entityHandle, 'in', entityResult.location);

        // Hide any existing tooltip
        const tooltip = document.querySelector('.entity-tooltip');
        if (tooltip) {
          tooltip.remove();
        }
      } else {
        console.warn('Entity not found in database:', entityHandle);
        console.log('Available entities in main:', dbRef.current.entities?.length || 0);
        console.log('Available blocks:', dbRef.current.tables?.BLOCK_RECORD?.entries?.length || 0);

        // Debug: Let's see what's actually in the database
        if (dbRef.current.entities && dbRef.current.entities.length > 0) {
          console.log('Sample main entities handles:', dbRef.current.entities.slice(0, 5).map(e => e.handle));
        }

        if (dbRef.current.tables?.BLOCK_RECORD?.entries) {
          dbRef.current.tables.BLOCK_RECORD.entries.forEach(block => {
            if (block.entities && block.entities.length > 0) {
              console.log(`Block ${block.name} entities:`, block.entities.slice(0, 3).map(e => e.handle));
            }
          });
        }

        // Refresh SVG to ensure consistency
        const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
        setSvg(svgText);
      }
    } else {
      console.log('No entity handle found or no dbRef');
    }
  };

  const handleDeleteEntity = (entityHandle, entityInfo = null) => {
    if (!dbRef.current) return;

    const entityToDelete = dbRef.current.entities.find(e => e.handle === entityHandle);

    if (entityToDelete) {
      setSelectedEntityInfo({
        handle: entityHandle,
        type: entityToDelete.type,
        layer: entityToDelete.layer,
        source: entityInfo?.source || 'dialog'
      });
      setPendingDeleteHandle(entityHandle);
      setHighlightedEntity(entityHandle);
      setShowDeleteConfirm(true);
    }
  };

  // function to debug SVG elements
  const debugSvgElements = () => {
    const svgContainer = svgContainerRef.current;
    if (svgContainer) {
      console.log('=== SVG CONTAINER DEBUG ===');
      console.log('Container element:', svgContainer);

      // Find the actual SVG element
      const svgElement = svgContainer.querySelector('svg');
      console.log('SVG element:', svgElement);

      // Find all clickable entities
      const clickableEntities = svgContainer.querySelectorAll('[data-handle]');
      console.log('Clickable entities found:', clickableEntities.length);

      clickableEntities.forEach((entity, index) => {
        console.log(`Entity ${index}:`, {
          tagName: entity.tagName,
          handle: entity.getAttribute('data-handle'),
          type: entity.getAttribute('data-type'),
          layer: entity.getAttribute('data-layer')
        });
      });

      return {
        svgElement,
        clickableEntities: Array.from(clickableEntities)
      };
    }
    return null;
  };

  const handleCloseInlineDelete = () => {
    setShowInlineDeleteDialog(false);
    setInlineDeleteEntity(null);
    setHighlightedEntity(null);
  };

  const handleConfirmInlineDelete = () => {
    if (inlineDeleteEntity && dbRef.current) {
      console.log('Inline delete - Before deletion:', dbRef.current.entities.length, ' Entity info:', inlineDeleteEntity);

      // Remove entity from database
      // const entityToDelete = dbRef.current.entities.find(e => e.handle === inlineDeleteEntity.handle);
      // dbRef.current.entities = dbRef.current.entities.filter(e => e.handle !== inlineDeleteEntity.handle);

      // console.log('Inline delete - After deletion:', dbRef.current.entities.length);

      // Use the helper function to remove the entity
      const removed = removeEntityByHandle(inlineDeleteEntity.handle, dbRef.current);

      if (removed) {
        console.log('Inline delete - Entity successfully removed');

        // FORCE immediate SVG update
        const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
        setSvg(svgText);

        // Update file info
        if (fileInfo) {
          setFileInfo({
            ...fileInfo,
            totalEntities: fileInfo.totalEntities - 1
          });
        }

        console.log(`Inline delete completed: ${inlineDeleteEntity.type} (handle: ${inlineDeleteEntity.handle}) from ${inlineDeleteEntity.location}`);
      } else {
        console.warn('Failed to remove entity:', inlineDeleteEntity.handle);
      }
      // Close dialog and reset state
      setShowInlineDeleteDialog(false);
      setInlineDeleteEntity(null);
      setHighlightedEntity(null);
    }
  };

  const handleSvgMouseOver = (event) => {
    let target = event.target;
    let entityHandle = null;

    while (target && !entityHandle) {
      entityHandle = target.getAttribute('data-handle');
      if (!entityHandle) {
        target = target.parentElement;
      }
    }

    if (entityHandle) {
      setHoveredEntity(entityHandle);
      target.style.cursor = 'pointer';
      target.style.opacity = '0.7';

      createTooltip(entityHandle, event.clientX, event.clientY);
    }
  };

  const handleSvgMouseOut = (event) => {
    setHoveredEntity(null);

    const target = event.target;
    target.style.cursor = 'default';
    target.style.opacity = '1';

    const tooltip = document.querySelector('.entity-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  };

  // const confirmDeleteEntity = () => {
  //   if (!pendingDeleteHandle || !dbRef.current) return;

  //   console.log('Before deletion - Total entities:', dbRef.current.entities?.length || 0);

  //   // Remove entity from db.entities
  //   const entityToDelete = dbRef.current.entities?.find(e => e.handle === pendingDeleteHandle);

  //   if (dbRef.current.entities) {
  //     dbRef.current.entities = dbRef.current.entities.filter(e => e.handle !== pendingDeleteHandle);
  //   }

  //   // Also remove from block definitions if it exists there
  //   if (dbRef.current.tables?.BLOCK_RECORD?.entries) {
  //     for (const block of dbRef.current.tables.BLOCK_RECORD.entries) {
  //       if (block.entities) {
  //         const beforeCount = block.entities.length;
  //         block.entities = block.entities.filter(e => e.handle !== pendingDeleteHandle);
  //         if (block.entities.length < beforeCount) {
  //           console.log(`Entity removed from block: ${block.name}`);
  //         }
  //       }
  //     }
  //   }

  //   console.log('After deletion - Total entities:', dbRef.current.entities?.length || 0);
  //   console.log('Deleted entity:', entityToDelete);

  //   // Force re-render SVG immediately
  //   const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
  //   setSvg(svgText);

  //   console.log('SVG regenerated and updated');

  //   // Update file info if needed
  //   if (fileInfo) {
  //     const updatedFileInfo = {
  //       ...fileInfo,
  //       totalEntities: Math.max(0, fileInfo.totalEntities - 1)
  //     };
  //     setFileInfo(updatedFileInfo);
  //   }

  //   // Close dialogs and reset state
  //   setShowDeleteConfirm(false);
  //   setSelectedEntityInfo(null);
  //   setHighlightedEntity(null);
  //   setPendingDeleteHandle(null);

  //   console.log(`Entity deleted: ${entityToDelete?.type} (handle: ${pendingDeleteHandle}) from layer: ${entityToDelete?.layer}`);
  // };
  const confirmDeleteEntity = () => {
    if (!pendingDeleteHandle || !dbRef.current) return;

    console.log('Confirming deletion of entity:', pendingDeleteHandle);
    console.log('Current database structure:', {
      mainEntities: dbRef.current.entities?.length || 0,
      blocks: dbRef.current.tables?.BLOCK_RECORD?.entries?.length || 0
    });

    // Use the helper function to find the entity first
    const entityResult = findEntityByHandle(pendingDeleteHandle, dbRef.current);
    console.log('Entity found:', entityResult);

    if (!entityResult) {
      console.warn('Entity not found in database:', pendingDeleteHandle);
      // Close dialogs and return
      setShowDeleteConfirm(false);
      setSelectedEntityInfo(null);
      setHighlightedEntity(null);
      setPendingDeleteHandle(null);
      return;
    }

    // Use the helper function to remove the entity
    const removed = removeEntityByHandle(pendingDeleteHandle, dbRef.current);

    if (removed) {
      console.log(`Entity successfully deleted from ${entityResult.location}:`, {
        type: entityResult.entity.type,
        handle: pendingDeleteHandle,
        layer: entityResult.entity.layer,
        blockName: entityResult.blockName
      });

      // Force re-render SVG immediately
      const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
      setSvg(svgText);

      // Update file info if needed
      if (fileInfo) {
        const updatedFileInfo = {
          ...fileInfo,
          totalEntities: Math.max(0, fileInfo.totalEntities - 1)
        };
        setFileInfo(updatedFileInfo);
      }
      console.log(`Entity deleted: ${selectedEntityInfo?.type} (handle: ${pendingDeleteHandle})`);
    } else {
      console.warn('Failed to delete entity:', pendingDeleteHandle);
    }

    // Close dialogs and reset state
    setShowDeleteConfirm(false);
    setSelectedEntityInfo(null);
    setHighlightedEntity(null);
    setPendingDeleteHandle(null);
  };

  const handleLayerToggle = (layerName) => {
    let updated;
    if (visibleLayers.includes(layerName)) {
      updated = visibleLayers.filter(l => l !== layerName);
    } else {
      updated = [...visibleLayers, layerName];
    }

    console.log(`Layer ${layerName} toggled. New visible layers:`, updated);
    setVisibleLayers(updated);

    if (dbRef.current) {
      console.log('Re-rendering SVG with visible layers:', updated);
      const svgText = convertToSvg(dbRef.current, [], updated, null);
      setSvg(svgText);
    }
  };

  const openLayerDialog = () => setShowLayerDialog(true);
  const closeLayerDialog = () => setShowLayerDialog(false);

  const handleSelectAllLayers = () => {
    setVisibleLayers([...allLayers]);
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], allLayers, null);
      setSvg(svgText);
    }
  };

  const handleDeselectAllLayers = () => {
    setVisibleLayers([]);
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], [], null);
      setSvg(svgText);
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 10));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.1));
  const handleResetZoom = () => setZoom(1);

  const handleDeleteLayer = (layerName) => {
    const updatedAllLayers = allLayers.filter(l => l !== layerName);
    const updatedVisibleLayers = visibleLayers.filter(l => l !== layerName);
    setAllLayers(updatedAllLayers);
    setVisibleLayers(updatedVisibleLayers);

    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], updatedVisibleLayers, null);
      setSvg(svgText);
    }
  };

  const handleDeleteAllLayers = () => {
    setAllLayers([]);
    setVisibleLayers([]);
    setSvg('');
  };

  const createHighlightOverlay = (entityHandle) => {
    if (!entityHandle || !dbRef.current) return null;

    const entity = dbRef.current.entities.find(e => e.handle === entityHandle);
    if (!entity) return null;

    let bounds = null;

    switch (entity.type) {
      case 'LINE':
        if (entity.startPoint && entity.endPoint) {
          bounds = {
            x: Math.min(entity.startPoint.x, entity.endPoint.x) - 10,
            y: Math.min(entity.startPoint.y, entity.endPoint.y) - 10,
            width: Math.abs(entity.endPoint.x - entity.startPoint.x) + 20,
            height: Math.abs(entity.endPoint.y - entity.startPoint.y) + 20
          };
        }
        break;
      case 'CIRCLE':
        if (entity.center && entity.radius) {
          bounds = {
            x: entity.center.x - entity.radius - 10,
            y: entity.center.y - entity.radius - 10,
            width: (entity.radius * 2) + 20,
            height: (entity.radius * 2) + 20
          };
        }
        break;
      case 'ARC':
        if (entity.center && entity.radius) {
          bounds = {
            x: entity.center.x - entity.radius - 10,
            y: entity.center.y - entity.radius - 10,
            width: (entity.radius * 2) + 20,
            height: (entity.radius * 2) + 20
          };
        }
        break;
      case 'INSERT':
        if (entity.insertionPoint) {
          bounds = {
            x: entity.insertionPoint.x - 25,
            y: entity.insertionPoint.y - 25,
            width: 50,
            height: 50
          };
        }
        break;
      default:
        if (entity.position) {
          bounds = {
            x: entity.position.x - 15,
            y: entity.position.y - 15,
            width: 30,
            height: 30
          };
        }
    }

    return bounds;
  };

  const createTooltip = (entityHandle, x, y) => {
    const existingTooltip = document.querySelector('.entity-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    if (!entityHandle || !dbRef.current) return;

    const entity = dbRef.current.entities.find(e => e.handle === entityHandle);
    if (!entity) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'entity-tooltip';
    tooltip.innerHTML = `
    <div>Entity: ${entity.type}</div>
    <div>Handle: ${entityHandle}</div>
    ${entity.layer ? `<div>Layer: ${entity.layer}</div>` : ''}
    <div style="margin-top: 4px; font-size: 10px;">Click to delete</div>
  `;

    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y - 10}px`;

    document.body.appendChild(tooltip);

    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.remove();
      }
    }, 3000);
  };

  // Update getAllEntities function to work with the new helper
  const getAllEntities = () => {
    if (!dbRef.current) return [];

    const allEntities = [];

    // Add main entities
    // if (dbRef.current.entities && Array.isArray(dbRef.current.entities)) {
    //   dbRef.current.entities.forEach(entity => {
    //     allEntities.push({ ...entity, location: 'main', blockName: null });
    //   });
    // }

    // Add block entities
    if (dbRef.current.tables?.BLOCK_RECORD?.entries) {
      dbRef.current.tables.BLOCK_RECORD.entries.forEach(block => {
        if (block.entities && Array.isArray(block.entities)) {
          block.entities.forEach(entity => {
            allEntities.push({ ...entity, location: 'block', blockName: block.name });
          });
        }
      });
    }

    return allEntities;
  };

  // useEffect(() => {
  //   if (svg && dbRef.current) {
  //     localStorage.setItem('svgContent', svg);
  //     localStorage.setItem('dbData', JSON.stringify(dbRef.current));
  //     localStorage.setItem('visibleLayers', JSON.stringify(visibleLayers));
  //     localStorage.setItem('zoom', JSON.stringify(zoom));
  //     localStorage.setItem('fileName', name);
  //   }
  // }, [svg, visibleLayers, zoom, name]);

  useEffect(() => {
    const attachListeners = () => {
      const svgContainer = svgContainerRef.current;
      console.log('SVG container:', svgContainer);

      if (svgContainer && svg && !showEditor) {
        // Remove existing listeners first
        svgContainer.removeEventListener('click', handleSvgClick);
        svgContainer.removeEventListener('mouseover', handleSvgMouseOver);
        svgContainer.removeEventListener('mouseout', handleSvgMouseOut);

        // Check if SVG elements with data-handle attributes are actually rendered
        const clickableEntities = svgContainer.querySelectorAll('[data-handle]');
        console.log('Clickable entities found:', clickableEntities.length);

        if (clickableEntities.length > 0) {
          // Add new listeners only if entities are found
          svgContainer.addEventListener('click', handleSvgClick);
          svgContainer.addEventListener('mouseover', handleSvgMouseOver);
          svgContainer.addEventListener('mouseout', handleSvgMouseOut);
          console.log('Event listeners attached successfully to', clickableEntities.length, 'entities');
        } else {
          // If no entities found, try again after a longer delay
          console.log('No clickable entities found, retrying in 2 seconds...');
          setTimeout(attachListeners, 4000);
        }
      }
    };

    if (svg && !showEditor) {
      // Add a small delay to ensure SVG DOM is rendered
      const timeout = setTimeout(attachListeners, 4000);

      return () => {
        clearTimeout(timeout);
        const svgContainer = svgContainerRef.current;
        if (svgContainer) {
          svgContainer.removeEventListener('click', handleSvgClick);
          svgContainer.removeEventListener('mouseover', handleSvgMouseOver);
          svgContainer.removeEventListener('mouseout', handleSvgMouseOut);
        }
      };
    }
  }, [svg, showEditor]);

  // Additional useEffect to ensure listeners are attached when SVG content changes
  useEffect(() => {
    if (svg && !showEditor && svgContainerRef.current) {
      const checkAndAttach = () => {
        const svgContainer = svgContainerRef.current;
        const clickableEntities = svgContainer?.querySelectorAll('[data-handle]');

        if (clickableEntities && clickableEntities.length > 0) {
          console.log('Re-attaching listeners after SVG update to', clickableEntities.length, 'entities');

          // Remove existing listeners
          svgContainer.removeEventListener('click', handleSvgClick);
          svgContainer.removeEventListener('mouseover', handleSvgMouseOver);
          svgContainer.removeEventListener('mouseout', handleSvgMouseOut);

          // Add new listeners
          svgContainer.addEventListener('click', handleSvgClick);
          svgContainer.addEventListener('mouseover', handleSvgMouseOver);
          svgContainer.addEventListener('mouseout', handleSvgMouseOut);
        }
      };

      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        setTimeout(checkAndAttach, 100);
      });
    }
  }, [svg]);

  // useEffect(() => {
  //   const savedSvg = localStorage.getItem('svgContent');
  //   const savedDb = localStorage.getItem('dbData');
  //   const savedLayers = localStorage.getItem('visibleLayers');
  //   const savedZoom = localStorage.getItem('zoom');
  //   const savedName = localStorage.getItem('fileName');

  //   if (savedSvg && savedDb) {
  //     setSvg(savedSvg);
  //     dbRef.current = JSON.parse(savedDb);
  //     setVisibleLayers(JSON.parse(savedLayers || '[]'));
  //     setZoom(JSON.parse(savedZoom || '1'));
  //     setName(savedName || 'drawing.svg');
  //   }
  // }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showInlineDeleteDialog && !event.target.closest('.inline-delete-dialog')) {
        handleCloseInlineDelete();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInlineDeleteDialog]);

  const download = () => {
    if (!svg) return;

    try {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name || "drawing.svg";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Error downloading SVG:', err);
      alert('Failed to download SVG file.');
    }
  };

  const handleSvgChange = (newSvg) => {
    setSvg(newSvg);
  };

  const clearFile = () => {
    setSvg('');
    setName('');
    setShowEditor(false);
    setError('');
    setFileInfo(null);
    setAllLayers([]);
    setVisibleLayers([]);
    dbRef.current = null;
    // localStorage.removeItem('svgContent');
    // localStorage.removeItem('dbData');
    // localStorage.removeItem('visibleLayers');
    // localStorage.removeItem('zoom');
    // localStorage.removeItem('fileName');

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const exportRawSvg = () => {
    if (!svg) return;

    const blob = new Blob([svg], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name.replace('.svg', '_raw.svg') || "drawing_raw.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ margin: "2rem", fontFamily: "sans-serif", maxWidth: '1200px' }}>
      <h1>DWG → SVG Viewer & Editor</h1>

      <div style={{
        marginBottom: '20px',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9'
      }}>
        <div >
          <label htmlFor="dwg-file" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>
            Select DWG File:
          </label>
        </div>
        <div>
          <input
            id="dwg-file"
            type="file"
            accept=".dwg"
            onChange={handle}
            disabled={isLoading}
            style={{ marginBottom: '10px', color: 'black' }}
          />
        </div>

        {isLoading && (
          <div style={{
            color: '#007bff',
            fontWeight: 'bold',
            padding: '10px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            <div>Processing DWG file...</div>
            <div style={{ fontSize: '0.9em', marginTop: '5px', opacity: 0.8 }}>
              This may take a moment for large files
            </div>
          </div>
        )}

        {error && (
          <div style={{
            color: '#721c24',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {fileInfo && (
          <div style={{
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '10px',
            fontSize: '0.9em'
          }}>
            <strong style={{ color: 'black' }}>File Analysis:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px', color: 'black' }}>
              <li>Total Entities: {fileInfo.totalEntities}</li>
              <li>Entity Types: {fileInfo.entityTypes.join(', ')}</li>
              <li>Blocks: {fileInfo.blocks.length}</li>
              <li>Layers: {fileInfo.layers} ({visibleLayers.length} visible)</li>
              {fileInfo.dwgVersion && <li>DWG Version: {fileInfo.dwgVersion}</li>}
            </ul>
            {fileInfo.blocks.length > 0 && (
              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'black' }}>Block Details</summary>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {fileInfo.blocks.map((block, idx) => (
                    <li key={idx}>
                      {block.name}: {block.entityCount} entities
                      {block.hasBasePoint && ' (has base point)'}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={openLayerDialog}
              >
                Manage Layers ({visibleLayers.length}/{allLayers.length})
              </button>

              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={handleSelectAllLayers}
                disabled={visibleLayers.length === allLayers.length}
              >
                Show All Layers
              </button>

              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={handleDeselectAllLayers}
                disabled={visibleLayers.length === 0}
              >
                Hide All Layers
              </button>

              <button
                onClick={debugSvgElements}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffc107',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Debug SVG Elements
              </button>

              <button
                onClick={debugDatabaseStructure}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Debug Database Structure
              </button>
            </div>
          </div>
        )}

        {showLayerDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100vh',
            width: '420px',
            background: 'white',
            zIndex: 9999,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            borderLeft: '1px solid #eee',
            overflowY: 'auto',
            transition: 'right 0.2s'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              minWidth: '360px',
              maxHeight: '100vh',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #eee',
                paddingBottom: '1rem'
              }}>
                <h2 style={{ margin: 0, color: 'black' }}>Layer Visibility Control</h2>
                <span style={{
                  color: '#666',
                  fontSize: '0.9em'
                }}>
                  {visibleLayers.length}/{allLayers.length} visible
                </span>
              </div>

              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {allLayers.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No layers found</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {allLayers.map(layer => (
                      <li key={layer} style={{
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: visibleLayers.includes(layer) ? '#e8f5e8' : '#f8f8f8',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <label style={{
                          color: 'black',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: '0.9em',
                          flex: 1
                        }}>
                          <input
                            type="checkbox"
                            checked={visibleLayers.includes(layer)}
                            onChange={() => handleLayerToggle(layer)}
                            style={{ marginRight: '8px' }}
                          />
                          <span style={{
                            fontWeight: visibleLayers.includes(layer) ? 'bold' : 'normal'
                          }}>
                            {layer}
                          </span>
                          {!visibleLayers.includes(layer) && (
                            <span style={{
                              marginLeft: 'auto',
                              color: '#999',
                              fontSize: '0.8em'
                            }}>
                              hidden
                            </span>
                          )}
                        </label>
                        <button
                          style={{
                            marginLeft: '12px',
                            padding: '4px 10px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85em'
                          }}
                          onClick={() => handleViewEntities(layer)}
                          title="View entities in this layer"
                        >
                          View Entities
                        </button>
                        <button
                          style={{
                            marginLeft: '12px',
                            padding: '4px 10px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85em'
                          }}
                          onClick={() => handleDeleteLayer(layer)}
                          title="Delete this layer"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Dialog Actions */}
              <div style={{
                marginTop: '1rem',
                marginLeft: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #eee',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}>
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={handleSelectAllLayers}
                >
                  Select All
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={handleDeselectAllLayers}
                >
                  Deselect All
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={handleDeleteAllLayers}
                  disabled={allLayers.length === 0}
                  title="Delete all layers"
                >
                  Delete All Layers
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={closeLayerDialog}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showEntitiesDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100vh',
            width: '420px',
            background: 'white',
            zIndex: 10000,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            borderLeft: '1px solid #eee',
            overflowY: 'auto',
            transition: 'right 0.2s'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              minWidth: '360px',
              maxHeight: '100vh',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #eee',
                paddingBottom: '1rem'
              }}>
                <h3 style={{ margin: 0, color: 'black' }}>
                  Entities in Layer: <span style={{ color: '#007bff' }}>{selectedLayer}</span>
                </h3>
                <button
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowEntitiesDialog(false)}
                >
                  Close
                </button>
              </div>
              {/* <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {dbRef.current && dbRef.current.entities.filter(e => e.layer === selectedLayer).length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No entities found in this layer.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {dbRef.current && dbRef.current.entities
                      .filter(e => e.layer === selectedLayer)
                      .map(e => (
                        <li key={e.handle} style={{
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: highlightedEntity === e.handle ? '#ffebee' : '#f8f8f8',
                          borderRadius: '6px',
                          border: highlightedEntity === e.handle ? '3px solid #dc3545' : '1px solid #ddd',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          transform: highlightedEntity === e.handle ? 'scale(1.01)' : 'scale(1)',
                          boxShadow: highlightedEntity === e.handle ? '0 4px 12px rgba(220, 53, 69, 0.3)' : 'none'
                        }}
                          // onMouseOver={() => setHighlightedEntity(e.handle)}
                          // onMouseOut={() => setHighlightedEntity(null)}
                          onMouseEnter={() => {
                            setHighlightedEntity(e.handle);
                            // Force re-render of SVG with highlighting
                            if (dbRef.current) {
                              const svgText = convertToSvg(dbRef.current, [], visibleLayers, e.handle);
                              setSvg(svgText);
                            }
                          }}
                          onMouseLeave={() => {
                            setHighlightedEntity(null);
                            // Re-render SVG without highlighting
                            if (dbRef.current) {
                              const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
                              setSvg(svgText);
                            }
                          }}
                        >
                          {highlightedEntity === e.handle && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#dc3545',
                              borderRadius: '50%',
                              marginRight: '8px',
                              animation: 'pulse 1s infinite'
                            }} />
                          )}
                          <span style={{ flex: 1, color: 'black', fontWeight: highlightedEntity === e.handle ? 'bold' : 'normal' }}>
                            <strong style={{ color: highlightedEntity === e.handle ? '#dc3545' : 'black' }}>{e.type}</strong> (handle: {e.handle})
                            {e.layer && <span style={{ color: highlightedEntity === e.handle ? '#dc3545' : '#666', fontSize: '0.8em' }}> Layer: {e.layer}</span>}
                          </span>
                          {highlightedEntity === e.handle && (
                            <span style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              borderRadius: '3px',
                              fontSize: '0.7em',
                              fontWeight: 'bold'
                            }}>
                              HIGHLIGHTED
                            </span>
                          )}
                          <button
                            style={{
                              marginLeft: '8px',
                              padding: '6px 12px',
                              backgroundColor: highlightedEntity === e.handle ? '#0056b3' : '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8em',
                              fontWeight: highlightedEntity === e.handle ? 'bold' : 'normal'
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setHighlightedEntity(e.handle);
                            }}
                            title="Highlight this entity"
                          >
                            {highlightedEntity === e.handle ? 'Viewing' : 'Highlight'}
                          </button>
                          <button
                            style={{
                              marginLeft: '8px',
                              padding: '6px 12px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8em',
                              fontWeight: 'bold'
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteEntity(e.handle, { source: 'entity-dialog' });
                            }}
                            title="Delete this entity"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div> */}
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {(() => {
                  const allEntities = getAllEntities();
                  console.log('All entities:', allEntities);
                  const layerEntities = allEntities.filter(e => e.layer === selectedLayer);
                  console.log('Layer entities:', layerEntities);

                  return layerEntities.length === 0 ? (
                    <p style={{ color: '#666', fontStyle: 'italic' }}>No entities found in this layer.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {layerEntities.map(e => (
                        <li key={e.handle} style={{
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: highlightedEntity === e.handle ? '#ffebee' : '#f8f8f8',
                          borderRadius: '6px',
                          border: highlightedEntity === e.handle ? '3px solid #dc3545' : '1px solid #ddd',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          transform: highlightedEntity === e.handle ? 'scale(1.01)' : 'scale(1)',
                          boxShadow: highlightedEntity === e.handle ? '0 4px 12px rgba(220, 53, 69, 0.3)' : 'none'
                        }}
                          onMouseEnter={() => {
                            setHighlightedEntity(e.handle);
                            if (dbRef.current) {
                              const svgText = convertToSvg(dbRef.current, [], visibleLayers, e.handle);
                              setSvg(svgText);
                            }
                          }}
                          onMouseLeave={() => {
                            setHighlightedEntity(null);
                            if (dbRef.current) {
                              const svgText = convertToSvg(dbRef.current, [], visibleLayers, null);
                              setSvg(svgText);
                            }
                          }}
                        >
                          {highlightedEntity === e.handle && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#dc3545',
                              borderRadius: '50%',
                              marginRight: '8px',
                              animation: 'pulse 1s infinite'
                            }} />
                          )}
                          <span style={{ flex: 1, color: 'black', fontWeight: highlightedEntity === e.handle ? 'bold' : 'normal' }}>
                            <strong style={{ color: highlightedEntity === e.handle ? '#dc3545' : 'black' }}>{e.type}</strong> (handle: {e.handle})
                            {e.layer && <span style={{ color: highlightedEntity === e.handle ? '#dc3545' : '#666', fontSize: '0.8em' }}> Layer: {e.layer}</span>}
                            <span style={{ color: '#999', fontSize: '0.7em' }}> [{e.location}]</span>
                          </span>
                          {highlightedEntity === e.handle && (
                            <span style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              borderRadius: '3px',
                              fontSize: '0.7em',
                              fontWeight: 'bold'
                            }}>
                              HIGHLIGHTED
                            </span>
                          )}
                          <button
                            style={{
                              marginLeft: '8px',
                              padding: '6px 12px',
                              backgroundColor: highlightedEntity === e.handle ? '#0056b3' : '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8em',
                              fontWeight: highlightedEntity === e.handle ? 'bold' : 'normal'
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setHighlightedEntity(e.handle);
                            }}
                            title="Highlight this entity"
                          >
                            {highlightedEntity === e.handle ? 'Viewing' : 'Highlight'}
                          </button>
                          <button
                            style={{
                              marginLeft: '8px',
                              padding: '6px 12px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8em',
                              fontWeight: 'bold'
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteEntity(e.handle, { source: 'entity-dialog' });
                            }}
                            title="Delete this entity"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && selectedEntityInfo && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 20000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '400px',
              width: '90%'
            }}>
              <div style={{ marginBottom: '1rem', color: '#dc3545', fontWeight: 'bold' }}>
                <strong>Delete Entity Confirmation</strong>
              </div>

              <div style={{ marginBottom: '1.5rem', color: '#333' }}>
                <p><strong>Type:</strong> {selectedEntityInfo.type}</p>
                <p><strong>Handle:</strong> {selectedEntityInfo.handle}</p>
                <p><strong>Layer:</strong> {selectedEntityInfo.layer}</p>
                <p><strong>Source:</strong> {selectedEntityInfo.source === 'svg-preview' ? 'SVG Preview' : 'Entity Dialog'}</p>
              </div>

              <div style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9em' }}>
                Are you sure you want to delete this entity? This action cannot be undone.
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  onClick={confirmDeleteEntity}
                >
                  Yes, Delete Entity
                </button>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedEntityInfo(null);
                    setHighlightedEntity(null);
                    setPendingDeleteHandle(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showInlineDeleteDialog && inlineDeleteEntity && (
          <div
            className="inline-delete-dialog"
            style={{
              position: 'fixed',
              left: `${Math.max(10, Math.min(inlineDeletePosition.x - 100, window.innerWidth - 220))}px`,
              top: `${Math.max(10, inlineDeletePosition.y)}px`,
              background: 'white',
              border: '2px solid #dc3545',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              zIndex: 25000,
              padding: '12px',
              minWidth: '200px',
              maxWidth: '250px'
            }}
          >
            <div style={{
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#dc3545',
              borderBottom: '1px solid #eee',
              paddingBottom: '6px'
            }}>
              🗑️ Delete Entity
            </div>

            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              <div><strong>Type:</strong> {inlineDeleteEntity.type}</div>
              <div><strong>Handle:</strong> {inlineDeleteEntity.handle}</div>
              {inlineDeleteEntity.layer && (
                <div><strong>Layer:</strong> {inlineDeleteEntity.layer}</div>
              )}
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
              marginTop: '12px'
            }}>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                onClick={handleConfirmInlineDelete}
                onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
              >
                Delete
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onClick={handleCloseInlineDelete}
                onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Cancel
              </button>
            </div>

            {/* Small arrow pointing down to the entity */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #dc3545'
            }} />
          </div>
        )}

        {svg && !isLoading && (
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={() => setShowEditor(!showEditor)}
              style={{
                padding: '10px 20px',
                backgroundColor: showEditor ? '#28a745' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              {showEditor ? 'View Mode' : 'Edit Mode'}
            </button>

            <button
              onClick={download}
              style={{
                padding: '10px 20px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Download SVG
            </button>

            <button
              onClick={exportRawSvg}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Export Raw SVG
            </button>

            <button
              onClick={clearFile}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* --- Zoom Controls --- */}
        {svg && !isLoading && (
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleZoomIn}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >Zoom In</button>
            <button
              onClick={handleZoomOut}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >Zoom Out</button>
            <button
              onClick={handleResetZoom}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >Reset</button>
            <span style={{ marginLeft: 8, color: '#333' }}>Zoom: {(zoom * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {svg && (
        <div>
          {showEditor ? (
            <SVGEditor
              svgContent={svg}
              onSvgChange={handleSvgChange}
            />
          ) : (
            <div style={{
              border: "2px solid #dee2e6",
              borderRadius: "4px",
              padding: "1rem",
              marginTop: "1rem",
              maxHeight: '70vh',
              overflow: 'auto',
              backgroundColor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              position: 'relative'
            }}>
              <div style={{
                marginBottom: '10px',
                padding: '5px 10px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                <strong style={{ color: 'black' }}>SVG Preview</strong>
                <p style={{ display: 'inline', color: 'black' }}> - Click on entities to delete them</p>
                {highlightedEntity && (
                  <span style={{
                    marginLeft: '10px',
                    color: '#dc3545',
                    fontWeight: 'bold',
                    animation: 'pulse 1s infinite'
                  }}>
                    🎯 Entity {highlightedEntity} highlighted
                  </span>
                )}
              </div>
              <div
                // data-svg-container
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '400px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'auto',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* <div dangerouslySetInnerHTML={{ __html: svg }} /> */}
                  <div
                    ref={svgContainerRef}
                    data-svg-container
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />

                  {highlightedEntity && (() => {
                    const bounds = createHighlightOverlay(highlightedEntity);
                    return bounds ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${bounds.x}px`,
                          top: `${bounds.y}px`,
                          width: `${bounds.width}px`,
                          height: `${bounds.height}px`,
                          border: '3px solid #FF0000',
                          backgroundColor: 'rgba(255, 0, 0, 0.1)',
                          borderRadius: '4px',
                          pointerEvents: 'none',
                          zIndex: 1000,
                          animation: 'highlight-pulse 1s infinite alternate',
                          boxShadow: '0 0 15px rgba(255, 0, 0, 0.5)'
                        }}
                      />
                    ) : null;
                  })()}
                </div>

                {hoveredEntity && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(255, 0, 0, 0.9)',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                      zIndex: 1001,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      border: '2px solid white'
                    }}
                  >
                    Entity: {hoveredEntity}
                    <br />
                    <small style={{ opacity: 0.9 }}>Click to delete</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes highlight-pulse {
          0% { opacity: 0.3; transform: scale(1); }
          100% { opacity: 0.8; transform: scale(1.02); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}