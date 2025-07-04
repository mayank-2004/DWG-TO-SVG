import React, { useState } from 'react';
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import { convertToSvg } from './utils/convert2svg';
import SVGEditor from './components/SVGEditor';

export default function App() {
  const [svg, setSvg] = useState('');
  const [name, setName] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setName(file.name.replace(/\.dwg$/, '.svg'));
    const buf = await file.arrayBuffer();

    const lib = await LibreDwg.create({
      locateFile: f => `/wasm/${f}`
    });
    const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
    const db = lib.convert(dwg);
    console.log("db:", db)
    if (!db || !Array.isArray(db.entities) || db.entities.length === 0) {
      console.warn('DWG file contains no drawable entities.');
      alert('This DWG file could not be parsed or has no drawable entities.');
      return;
    }
    if (
      db.tables &&
      db.tables.BLOCK_RECORD &&
      Array.isArray(db.tables.BLOCK_RECORD.entries)
    ) {
      // console.log("entries:",db.tables.BLOCK_RECORD.entries)
      db.blocks = db.tables.BLOCK_RECORD.entries;
    }
    lib.dwg_free(dwg);

    const svgText = convertToSvg(db);
    setSvg(svgText);
    setShowEditor(false);
  };

  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name || "drawing.svg";
    a.click();
  };

  const handleSvgChange = (newSvg) => {
    setSvg(newSvg);
  };

  return (
    <div style={{ margin: "2rem", fontFamily: "sans-serif" }}>
      <h1>DWG → SVG Viewer & Editor</h1>

      <div style={{ marginBottom: '20px' }}>
        <input type="file" accept=".dwg" onChange={handle} />
        {svg && (
          <div style={{ marginTop: '10px' }}>
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
                cursor: 'pointer'
              }}
            >
              Download SVG
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
            <div
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                marginTop: "1rem",
                maxHeight: '600px',
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      )}
    </div>
  );
}
