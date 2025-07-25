// import React, { useState, useRef } from 'react';
// import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
// import { convertToSvg } from './utils/convert2svg';
// import SVGEditor from './components/SVGEditor';

// export default function App() {
//   const [svg, setSvg] = useState('');
//   const [name, setName] = useState('');
//   const [showEditor, setShowEditor] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [fileInfo, setFileInfo] = useState(null);
//   const [allLayers, setAllLayers] = useState([]); // Array of layer names
//   const [visibleLayers, setVisibleLayers] = useState([]); // Array of visible layer names
//   const [showLayerDialog, setShowLayerDialog] = useState(false);

//   const dbRef = useRef(null);

//   const handle = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     setIsLoading(true);
//     setError('');
//     setName(file.name.replace(/\.dwg$/, '.svg'));

//     try {
//       const buf = await file.arrayBuffer();
//       const lib = await LibreDwg.create({
//         locateFile: f => `/wasm/${f}`
//       });

//       const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
//       const db = lib.convert(dwg);
//       dbRef.current = db; // Store db for later use

//       console.log("Full database structure:", db);
//       console.log("Entities:", db.entities);
//       console.log("Tables:", db.tables);
//       console.log("BLOCK_RECORD entries:", db.tables?.BLOCK_RECORD?.entries);

//       // Get all layer names
//       const layers = db.tables?.LAYER?.entries?.map(l => l.name) || [];
//       console.log(`Found ${layers.length} layers:`, layers);
//       setAllLayers(layers);
//       setVisibleLayers(layers);

//       // Enhanced content analysis
//       let hasDrawableContent = false;
//       let entityCount = 0;
//       const entityTypes = new Set();

//       // Analyze main entities
//       if (db.entities && Array.isArray(db.entities) && db.entities.length > 0) {
//         hasDrawableContent = true;
//         entityCount += db.entities.length;
//         db.entities.forEach(entity => {
//           if (entity.type) entityTypes.add(entity.type);
//         });
//         console.log(`Found ${db.entities.length} main entities`);
//       }

//       // Analyze block records for entities
//       const blockInfo = [];
//       if (db.tables?.BLOCK_RECORD?.entries) {
//         for (const block of db.tables.BLOCK_RECORD.entries) {
//           if (block.entities && Array.isArray(block.entities) && block.entities.length > 0) {
//             hasDrawableContent = true;
//             entityCount += block.entities.length;
//             block.entities.forEach(entity => {
//               if (entity.type) entityTypes.add(entity.type);
//             });
//             blockInfo.push({
//               name: block.name,
//               entityCount: block.entities.length,
//               hasBasePoint: !!block.basePoint
//             });
//             console.log(`Found ${block.entities.length} entities in block: ${block.name}`);
//           }
//         }
//       }

//       // Store file information for debugging
//       setFileInfo({
//         totalEntities: entityCount,
//         entityTypes: Array.from(entityTypes),
//         blocks: blockInfo,
//         layers: layers.length,
//         layerNames: layers,
//         dwgVersion: db.header?.version || 'Unknown'
//       });

//       // Enhanced layer analysis
//       if (db.tables?.LAYER?.entries && db.tables.LAYER.entries.length > 0) {
//         console.log(`Found ${db.tables.LAYER.entries.length} layers:`);
//         db.tables.LAYER.entries.forEach(layer => {
//           console.log(`- Layer: ${layer.name}, Color: ${JSON.stringify(layer.color)}, Visible: ${!layer.off}`);
//         });
//       }

//       if (!hasDrawableContent) {
//         throw new Error('DWG file contains no drawable entities or the file format is not supported.');
//       }

//       lib.dwg_free(dwg);

//       // Enhanced SVG conversion with better error handling
//       const svgText = convertToSvg(db, [], layers);

//       // Validate that SVG was generated successfully
//       if (!svgText || svgText.includes('No data')) {
//         throw new Error('Failed to convert DWG content to SVG. The file may contain unsupported entity types.');
//       }

//       // Additional validation - check if SVG has actual drawing elements
//       const hasDrawingElements = svgText.includes('<line') ||
//         svgText.includes('<circle') ||
//         svgText.includes('<path') ||
//         svgText.includes('<polyline') ||
//         svgText.includes('<polygon') ||
//         svgText.includes('<ellipse');

//       if (!hasDrawingElements) {
//         console.warn('Generated SVG contains no drawing elements. This might indicate conversion issues.');
//       }

//       setSvg(svgText);
//       setShowEditor(false);

//     } catch (err) {
//       console.error('Error processing DWG file:', err);
//       let errorMessage = 'Failed to process DWG file. ';

//       if (err.message.includes('WASM')) {
//         errorMessage += 'WebAssembly loading failed. Please ensure the WASM files are available.';
//       } else if (err.message.includes('format')) {
//         errorMessage += 'The file format may not be supported or the file may be corrupted.';
//       } else if (err.message.includes('drawable entities')) {
//         errorMessage += 'The file appears to be empty or contains only non-drawable elements.';
//       } else {
//         errorMessage += err.message || 'Please ensure it is a valid DWG file.';
//       }

//       setError(errorMessage);
//       setSvg('');
//       setFileInfo(null);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // --- Layer dialog logic ---
//   const handleLayerToggle = (layerName) => {
//     let updated;
//     if (visibleLayers.includes(layerName)) {
//       updated = visibleLayers.filter(l => l !== layerName);
//     } else {
//       updated = [...visibleLayers, layerName];
//     }
//     setVisibleLayers(updated);
//     // Re-render SVG with new visible layers
//     // if (dbRef.current) {
//     //   const svgText = convertToSvg(dbRef.current, [], updated);
//     //   setSvg(svgText);
//     // }
//     if (fileInfo) {
//       // You need to keep the original db somewhere, or reload it
//       // For simplicity, reload from fileInfo (not ideal for large files)
//       // Ideally, keep db in a useRef or state
//       // Here, just skip reloading for brevity
//     }
//   };

//   // --- Show/hide layer dialog ---
//   const openLayerDialog = () => setShowLayerDialog(true);
//   const closeLayerDialog = () => setShowLayerDialog(false);

//   // --- When visibleLayers changes, re-render SVG ---
//   React.useEffect(() => {
//     if (!fileInfo || !fileInfo.layerNames) return;
//     // You need to keep the original db in a ref/state for this to work
//     // For demo, skip if not available
//     // If you have db in a ref, call: setSvg(convertToSvg(db, [], visibleLayers));
//   }, [visibleLayers]);

//   const download = () => {
//     if (!svg) return;

//     try {
//       const blob = new Blob([svg], { type: "image/svg+xml" });
//       const a = document.createElement("a");
//       a.href = URL.createObjectURL(blob);
//       a.download = name || "drawing.svg";
//       a.click();
//       URL.revokeObjectURL(a.href); // Clean up
//     } catch (err) {
//       console.error('Error downloading SVG:', err);
//       alert('Failed to download SVG file.');
//     }
//   };

//   const handleSvgChange = (newSvg) => {
//     setSvg(newSvg);
//   };

//   const clearFile = () => {
//     setSvg('');
//     setName('');
//     setShowEditor(false);
//     setError('');
//     setFileInfo(null);
//     // Reset file input
//     const fileInput = document.querySelector('input[type="file"]');
//     if (fileInput) {
//       fileInput.value = '';
//     }
//   };

//   const exportRawSvg = () => {
//     if (!svg) return;

//     const blob = new Blob([svg], { type: "text/plain" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = name.replace('.svg', '_raw.svg') || "drawing_raw.svg";
//     a.click();
//     URL.revokeObjectURL(a.href);
//   };

//   return (
//     <div style={{ margin: "2rem", fontFamily: "sans-serif", maxWidth: '1200px' }}>
//       <h1>DWG → SVG Viewer & Editor</h1>

//       <div style={{
//         marginBottom: '20px',
//         padding: '20px',
//         border: '1px solid #ddd',
//         borderRadius: '4px',
//         backgroundColor: '#f9f9f9'
//       }}>
//         <div style={{ marginBottom: '10px' }}>
//           <label htmlFor="dwg-file" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
//             Select DWG File:
//           </label>
//           <input
//             id="dwg-file"
//             type="file"
//             accept=".dwg"
//             onChange={handle}
//             disabled={isLoading}
//             style={{ marginBottom: '10px' }}
//           />
//         </div>

//         {isLoading && (
//           <div style={{
//             color: '#007bff',
//             fontWeight: 'bold',
//             padding: '10px',
//             backgroundColor: '#d4edda',
//             border: '1px solid #c3e6cb',
//             borderRadius: '4px'
//           }}>
//             <div>Processing DWG file...</div>
//             <div style={{ fontSize: '0.9em', marginTop: '5px', opacity: 0.8 }}>
//               This may take a moment for large files
//             </div>
//           </div>
//         )}

//         {error && (
//           <div style={{
//             color: '#721c24',
//             backgroundColor: '#f8d7da',
//             border: '1px solid #f5c6cb',
//             padding: '15px',
//             borderRadius: '4px',
//             marginTop: '10px'
//           }}>
//             <strong>Error:</strong> {error}
//           </div>
//         )}
//         {console.log('File Info:', fileInfo)}
//         {fileInfo && (
//           <div style={{
//             backgroundColor: '#d1ecf1',
//             border: '1px solid #bee5eb',
//             padding: '15px',
//             borderRadius: '4px',
//             marginTop: '10px',
//             fontSize: '0.9em'
//           }}>
//             <strong style={{ color: 'black' }}>File Analysis:</strong>
//             <ul style={{ margin: '10px 0', paddingLeft: '20px', color: 'black' }}>
//               <li>Total Entities: {fileInfo.totalEntities}</li>
//               <li>Entity Types: {fileInfo.entityTypes.join(', ')}</li>
//               <li>Blocks: {fileInfo.blocks.length}</li>
//               <li>Layers: {fileInfo.layers}</li>
//               {fileInfo.dwgVersion && <li>DWG Version: {fileInfo.dwgVersion}</li>}
//             </ul>
//             {fileInfo.blocks.length > 0 && (
//               <details style={{ marginTop: '10px' }}>
//                 <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'black' }}>Block Details</summary>
//                 <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
//                   {fileInfo.blocks.map((block, idx) => (
//                     <li key={idx}>
//                       {block.name}: {block.entityCount} entities
//                       {block.hasBasePoint && ' (has base point)'}
//                     </li>
//                   ))}
//                 </ul>
//               </details>
//             )}
//             {/* Show Layers Button */}
//             <button
//               style={{
//                 marginTop: '10px',
//                 padding: '8px 16px',
//                 backgroundColor: '#007bff',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer'
//               }}
//               onClick={openLayerDialog}
//             >
//               Show Layers
//             </button>
//           </div>
//         )}

//         {/* Layer Dialog */}
//         {showLayerDialog && (
//           <div style={{
//             position: 'fixed',
//             top: 0, left: 0, right: 0, bottom: 0,
//             background: 'rgba(0,0,0,0.3)',
//             zIndex: 9999,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center'
//           }}>
//             <div style={{
//               background: 'white',
//               padding: '2rem',
//               borderRadius: '8px',
//               minWidth: '300px',
//               boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
//             }}>
//               <h2 style={{ marginBottom: '1rem' }}>Layers</h2>
//               <ul style={{ listStyle: 'none', padding: 0 }}>
//                 {console.log('All Layers:', allLayers)}
//                 {allLayers.map(layer => (
//                   <li key={layer} style={{ marginBottom: '8px' }}>
//                     <label style={{ color: 'black' }}>
//                       <input
//                         type="checkbox"
//                         checked={visibleLayers.includes(layer)}
//                         onChange={() => handleLayerToggle(layer)}
//                         style={{ marginRight: '8px' }}
//                       />
//                       {layer}
//                     </label>
//                   </li>
//                 ))}
//               </ul>
//               <button
//                 style={{
//                   marginTop: '1rem',
//                   padding: '8px 16px',
//                   backgroundColor: '#dc3545',
//                   color: 'white',
//                   border: 'none',
//                   borderRadius: '4px',
//                   cursor: 'pointer'
//                 }}
//                 onClick={closeLayerDialog}
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         )}

//         {svg && !isLoading && (
//           <div style={{ marginTop: '15px' }}>
//             <button
//               onClick={() => setShowEditor(!showEditor)}
//               style={{
//                 padding: '10px 20px',
//                 backgroundColor: showEditor ? '#28a745' : '#007bff',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer',
//                 marginRight: '10px'
//               }}
//             >
//               {showEditor ? 'View Mode' : 'Edit Mode'}
//             </button>

//             <button
//               onClick={download}
//               style={{
//                 padding: '10px 20px',
//                 backgroundColor: '#17a2b8',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer',
//                 marginRight: '10px'
//               }}
//             >
//               Download SVG
//             </button>

//             <button
//               onClick={exportRawSvg}
//               style={{
//                 padding: '10px 20px',
//                 backgroundColor: '#6c757d',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer',
//                 marginRight: '10px'
//               }}
//             >
//               Export Raw SVG
//             </button>

//             <button
//               onClick={clearFile}
//               style={{
//                 padding: '10px 20px',
//                 backgroundColor: '#dc3545',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer'
//               }}
//             >
//               Clear
//             </button>
//           </div>
//         )}
//       </div>

//       {svg && (
//         <div>
//           {showEditor ? (
//             <SVGEditor
//               svgContent={svg}
//               onSvgChange={handleSvgChange}
//             />
//           ) : (
//             <div style={{
//               border: "2px solid #dee2e6",
//               borderRadius: "4px",
//               padding: "1rem",
//               marginTop: "1rem",
//               maxHeight: '70vh',
//               overflow: 'auto',
//               backgroundColor: 'white',
//               boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
//             }}>
//               <div style={{
//                 marginBottom: '10px',
//                 padding: '5px 10px',
//                 backgroundColor: '#e9ecef',
//                 borderRadius: '4px',
//                 fontSize: '0.9em'
//               }}>
//                 <strong style={{ color: 'black' }}>SVG Preview</strong><p style={{ display: 'inline', color: 'black' }}> - Use mouse wheel to zoom, drag to pan</p>
//               </div>
//               <div
//                 style={{
//                   width: '100%',
//                   height: 'auto',
//                   minHeight: '400px',
//                   display: 'flex',
//                   justifyContent: 'center',
//                   alignItems: 'center'
//                 }}
//                 dangerouslySetInnerHTML={{ __html: svg }}
//               />
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

















import React, { useState, useRef } from 'react';
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
  const [allLayers, setAllLayers] = useState([]); // Array of layer names
  const [visibleLayers, setVisibleLayers] = useState([]); // Array of visible layer names
  const [showLayerDialog, setShowLayerDialog] = useState(false);

  const dbRef = useRef(null);

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
      dbRef.current = db; // Store db for later use

      console.log("Full database structure:", db);
      console.log("Entities:", db.entities);
      console.log("Tables:", db.tables);
      console.log("BLOCK_RECORD entries:", db.tables?.BLOCK_RECORD?.entries);

      // Get all layer names
      const layers = db.tables?.LAYER?.entries?.map(l => l.name) || [];
      console.log(`Found ${layers.length} layers:`, layers);
      setAllLayers(layers);
      setVisibleLayers(layers); // Initially all layers are visible

      // Enhanced content analysis
      let hasDrawableContent = false;
      let entityCount = 0;
      const entityTypes = new Set();

      // Analyze main entities
      if (db.entities && Array.isArray(db.entities) && db.entities.length > 0) {
        hasDrawableContent = true;
        entityCount += db.entities.length;
        db.entities.forEach(entity => {
          if (entity.type) entityTypes.add(entity.type);
        });
        console.log(`Found ${db.entities.length} main entities`);
      }

      // Analyze block records for entities
      const blockInfo = [];
      if (db.tables?.BLOCK_RECORD?.entries) {
        for (const block of db.tables.BLOCK_RECORD.entries) {
          if (block.entities && Array.isArray(block.entities) && block.entities.length > 0) {
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
            console.log(`Found ${block.entities.length} entities in block: ${block.name}`);
          }
        }
      }

      // Store file information for debugging
      setFileInfo({
        totalEntities: entityCount,
        entityTypes: Array.from(entityTypes),
        blocks: blockInfo,
        layers: layers.length,
        layerNames: layers,
        dwgVersion: db.header?.version || 'Unknown'
      });

      // Enhanced layer analysis
      if (db.tables?.LAYER?.entries && db.tables.LAYER.entries.length > 0) {
        console.log(`Found ${db.tables.LAYER.entries.length} layers:`);
        db.tables.LAYER.entries.forEach(layer => {
          console.log(`- Layer: ${layer.name}, Color: ${JSON.stringify(layer.color)}, Visible: ${!layer.off}`);
        });
      }

      if (!hasDrawableContent) {
        throw new Error('DWG file contains no drawable entities or the file format is not supported.');
      }

      lib.dwg_free(dwg);

      // Enhanced SVG conversion with layer visibility control
      console.log('Converting to SVG with visible layers:', layers);
      const svgText = convertToSvg(db, [], layers); // Pass all layers as initially visible

      // Validate that SVG was generated successfully
      if (!svgText || svgText.includes('No data')) {
        throw new Error('Failed to convert DWG content to SVG. The file may contain unsupported entity types.');
      }

      // Additional validation - check if SVG has actual drawing elements
      const hasDrawingElements = svgText.includes('<line') ||
        svgText.includes('<circle') ||
        svgText.includes('<path') ||
        svgText.includes('<polyline') ||
        svgText.includes('<polygon') ||
        svgText.includes('<ellipse');

      if (!hasDrawingElements) {
        console.warn('Generated SVG contains no drawing elements. This might indicate conversion issues.');
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

  // --- Layer dialog logic ---
  const handleLayerToggle = (layerName) => {
    let updated;
    if (visibleLayers.includes(layerName)) {
      updated = visibleLayers.filter(l => l !== layerName);
    } else {
      updated = [...visibleLayers, layerName];
    }

    console.log(`Layer ${layerName} toggled. New visible layers:`, updated);
    setVisibleLayers(updated);

    // Re-render SVG with new visible layers
    if (dbRef.current) {
      console.log('Re-rendering SVG with visible layers:', updated);
      const svgText = convertToSvg(dbRef.current, [], updated);
      setSvg(svgText);
    }
  };

  // --- Show/hide layer dialog ---
  const openLayerDialog = () => setShowLayerDialog(true);
  const closeLayerDialog = () => setShowLayerDialog(false);

  // --- Select All / Deselect All functionality ---
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

  const download = () => {
    if (!svg) return;

    try {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name || "drawing.svg";
      a.click();
      URL.revokeObjectURL(a.href); // Clean up
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

    // Reset file input
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
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="dwg-file" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Select DWG File:
          </label>
          <input
            id="dwg-file"
            type="file"
            accept=".dwg"
            onChange={handle}
            disabled={isLoading}
            style={{ marginBottom: '10px' }}
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
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              minWidth: '400px',
              maxHeight: '70vh',
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
                        border: '1px solid #ddd'
                      }}>
                        <label style={{
                          color: 'black',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: '0.9em'
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Dialog Actions */}
              <div style={{
                marginTop: '1rem',
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
                <strong style={{ color: 'black' }}>SVG Preview</strong><p style={{ display: 'inline', color: 'black' }}> - Use mouse wheel to zoom, drag to pan</p>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 'auto',
                  minHeight: '400px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}