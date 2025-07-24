// import React, { useState } from 'react';
// import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
// import { convertToSvg } from './utils/convert2svg';
// import SVGEditor from './components/SVGEditor';

// export default function App() {
//   const [svg, setSvg] = useState('');
//   const [name, setName] = useState('');
//   const [showEditor, setShowEditor] = useState(false);

//   const handle = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     setName(file.name.replace(/\.dwg$/, '.svg'));
//     const buf = await file.arrayBuffer();

//     const lib = await LibreDwg.create({
//       locateFile: f => `/wasm/${f}`
//     });
//     const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
//     const db = lib.convert(dwg);
//     console.log("db:", db)
//     if (!db || !Array.isArray(db.entities) || db.entities.length === 0) {
//       console.warn('DWG file contains no drawable entities.');
//       alert('This DWG file could not be parsed or has no drawable entities.');
//       return;
//     }
    
//     lib.dwg_free(dwg);

//     const svgText = convertToSvg(db);
//     setSvg(svgText);
//     setShowEditor(false);
//   };

//   const download = () => {
//     const blob = new Blob([svg], { type: "image/svg+xml" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = name || "drawing.svg";
//     a.click();
//   };

//   const handleSvgChange = (newSvg) => {
//     setSvg(newSvg);
//   };

//   return (
//     <div style={{ margin: "2rem", fontFamily: "sans-serif" }}>
//       <h1>DWG → SVG Viewer & Editor</h1>

//       <div style={{ marginBottom: '20px' }}>
//         <input type="file" accept=".dwg" onChange={handle} />
//         {svg && (
//           <div style={{ marginTop: '10px' }}>
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
//                 cursor: 'pointer'
//               }}
//             >
//               Download SVG
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
//             <div
//               style={{
//                 border: "1px solid #ccc",
//                 padding: "1rem",
//                 marginTop: "1rem",
//                 maxHeight: '600px',
//                 overflow: 'auto'
//               }}
//               dangerouslySetInnerHTML={{ __html: svg }}
//             />
//           )}
//         </div>       
//       )}
//     </div>
//   );
// }










import React, { useState } from 'react';
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
      
      console.log("Full database structure:", db);
      console.log("Entities:", db.entities);
      console.log("Tables:", db.tables);
      console.log("BLOCK_RECORD entries:", db.tables?.BLOCK_RECORD?.entries);
      
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
        layers: db.tables?.LAYER?.entries?.length || 0,
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

      // Enhanced SVG conversion with better error handling
      const svgText = convertToSvg(db);
      
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
            <strong style={{color: 'black'}}>File Analysis:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px', color: 'black' }}>
              <li>Total Entities: {fileInfo.totalEntities}</li>
              <li>Entity Types: {fileInfo.entityTypes.join(', ')}</li>
              <li>Blocks: {fileInfo.blocks.length}</li>
              <li>Layers: {fileInfo.layers}</li>
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
                <strong style={{color: 'black'}}>SVG Preview</strong><p style={{display: 'inline', color: 'black'}}> - Use mouse wheel to zoom, drag to pan</p>
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