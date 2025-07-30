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
  // const [selectedEntityForDelete, setSelectedEntityForDelete] = useState(null);

  const dbRef = useRef(null);

  // Handler to open entity list for a layer
  const handleViewEntities = (layerName) => {
    setSelectedLayer(layerName);
    setShowEntitiesDialog(true);
  };

  // Handler to delete an entity by handle
  const handleDeleteEntity = (entityHandle) => {
    if (!dbRef.current) return;
    // Remove entity from db.entities
    dbRef.current.entities = dbRef.current.entities.filter(e => e.handle !== entityHandle);
    // Re-render SVG
    const svgText = convertToSvg(dbRef.current, [], visibleLayers);
    setSvg(svgText);
    // Optionally update fileInfo/entity counts
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
      const svgText = convertToSvg(db, [], layers);

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
      const svgText = convertToSvg(dbRef.current, [], updated);
      setSvg(svgText);
    }
  };

  const openLayerDialog = () => setShowLayerDialog(true);
  const closeLayerDialog = () => setShowLayerDialog(false);

  const handleSelectAllLayers = () => {
    setVisibleLayers([...allLayers]);
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], allLayers);
      setSvg(svgText);
    }
  };

  const handleDeselectAllLayers = () => {
    setVisibleLayers([]);
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], []);
      setSvg(svgText);
    }
  };

  useEffect(() => {
    const savedSvg = localStorage.getItem('svgContent');
    const savedDb = localStorage.getItem('dbData');
    const savedLayers = localStorage.getItem('visibleLayers');
    const savedZoom = localStorage.getItem('zoom');
    const savedName = localStorage.getItem('fileName');

    if (savedSvg && savedDb) {
      setSvg(savedSvg);
      dbRef.current = JSON.parse(savedDb);
      setVisibleLayers(JSON.parse(savedLayers || '[]'));
      setZoom(JSON.parse(savedZoom || '1'));
      setName(savedName || 'drawing.svg');
    }
  }, []);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 10));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.1));
  const handleResetZoom = () => setZoom(1);

  const handleDeleteLayer = (layerName) => {
    // Remove from allLayers and visibleLayers
    const updatedAllLayers = allLayers.filter(l => l !== layerName);
    const updatedVisibleLayers = visibleLayers.filter(l => l !== layerName);
    setAllLayers(updatedAllLayers);
    setVisibleLayers(updatedVisibleLayers);

    // Re-render SVG without the deleted layer
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], updatedVisibleLayers);
      setSvg(svgText);
    }
  };

  const handleDeleteAllLayers = () => {
    setAllLayers([]);
    setVisibleLayers([]);
    // Clear SVG as there are no layers left
    setSvg('');
  };

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

  useEffect(() => {
    if (dbRef.current) {
      const svgText = convertToSvg(dbRef.current, [], visibleLayers, highlightedEntity);
      setSvg(svgText);
    }
  }, [visibleLayers, highlightedEntity]);

  useEffect(() => {
    if (svg && dbRef.current) {
      localStorage.setItem('svgContent', svg);
      localStorage.setItem('dbData', JSON.stringify(dbRef.current));
      localStorage.setItem('visibleLayers', JSON.stringify(visibleLayers));
      localStorage.setItem('zoom', JSON.stringify(zoom));
      localStorage.setItem('fileName', name);
    }
  }, [svg, visibleLayers, zoom, name]);

  // function removeEntity(handle) {
  //   const selector = `[data-handle="${handle}"]`;
  //   const element = document.querySelector(selector);
  //   if (element) {
  //     element.remove();  // or element.style.display = 'none';
  //     console.log(`Entity with handle ${handle} removed.`);
  //   } else {
  //     console.warn(`Entity ${handle} not found in SVG.`);
  //   }

  //   // Remove from DWG memory
  //   if (dbRef.current) {
  //     dbRef.current.entities = dbRef.current.entities.filter(e => e.handle !== handle);
  //     console.log(`Entity with handle ${handle} deleted from memory and SVG.`);
  //   }
  // }

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
    localStorage.removeItem('svgContent');
    localStorage.removeItem('dbData');
    localStorage.removeItem('visibleLayers');
    localStorage.removeItem('zoom');
    localStorage.removeItem('fileName');

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

            {/* Layer Controls */}
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
            </div>
          </div>
        )}

        {/* Layer Dialog */}
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

              {/* Layer List */}
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
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
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
                          backgroundColor: '#f8f8f8',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                          onClick={() => {
                            setHighlightedEntity(e.handle);
                            setPendingDeleteHandle(e.handle);
                            setShowDeleteConfirm(true);
                          }}
                        // onClick={() => setSelectedEntityForDelete(e.handle)}
                        >
                          <span style={{ flex: 1, color: 'black' }}>
                            <strong>{e.type}</strong> (handle: {e.handle})
                          </span>
                          <button
                            style={{
                              marginLeft: '8px',
                              padding: '4px 10px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85em'
                            }}
                            onClick={() => {
                              setHighlightedEntity(e.handle);
                              setPendingDeleteHandle(e.handle);
                              setShowDeleteConfirm(true);
                              // removeEntity(e.handle);
                              // Optionally scroll SVG to entity if you have that logic
                            }}
                            title="Delete this entity"
                          >
                            Delete
                          </button>
                          {/* You can add an Edit button here */}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.2)',
            zIndex: 20000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ marginBottom: '1rem', color: '#dc3545', fontWeight: 'bold' }}>
                <strong>Are you sure you want to delete this entity?</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    handleDeleteEntity(pendingDeleteHandle);
                    setShowDeleteConfirm(false);
                    // setSelectedEntityForDelete(null);
                    setHighlightedEntity(null);
                    setPendingDeleteHandle(null);
                  }}
                >
                  Yes, Delete
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
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    // setSelectedEntityForDelete(null);
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
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                marginBottom: '10px',
                padding: '5px 10px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                <strong style={{ color: 'black' }}>SVG Preview</strong>
                <p style={{ display: 'inline', color: 'black' }}> - Use mouse wheel to zoom, drag to pan</p>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '400px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'auto'
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.2s'
                  }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}