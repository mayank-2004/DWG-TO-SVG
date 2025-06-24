import React, { useState } from 'react';
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import { convertToSvg } from './convert2svg';

export default function App() {
  const [svg, setSvg] = useState('');
  const [name, setName] = useState('');

  const handle = async (e) => {
    const file = e.target.files[0];
    console.log("Selected file:", file.name);
    if (!file) return;
    setName(file.name.replace(/\.dwg$/, '.svg'));
    const buf = await file.arrayBuffer();
    console.log("file:", file, "buf:", buf);
    console.log('Buffer size:', buf.byteLength);

    const lib = await LibreDwg.create({
      locateFile: f => `/wasm/${f}`
    });
    console.log('lib methods:', Object.keys(lib));
    const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
    console.log('DWG object:', dwg);
    const db = lib.convert(dwg);
    if (!db || !Array.isArray(db.entities) || db.entities.length === 0) {
      console.warn('DWG file contains no drawable entities.');
      alert('This DWG file could not be parsed or has no drawable entities.');
      return;
    }
    // Fix: inject blocks from BLOCK_RECORD into db.blocks
    if (
      db.tables &&
      db.tables.BLOCK_RECORD &&
      Array.isArray(db.tables.BLOCK_RECORD.entries)
    ) {
      db.blocks = db.tables.BLOCK_RECORD.entries;
    }
    console.log("db:", db);
    console.log('Converted DB:', JSON.stringify(db, null, 2));
    lib.dwg_free(dwg);

    const svgText = convertToSvg(db);
    setSvg(svgText);
  };

  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name || "drawing.svg";
    a.click();
  };

  return (
    <div style={{ margin: "2rem", fontFamily: "sans-serif" }}>
      <h1>DWG → SVG Viewer</h1>
      <input type="file" accept=".dwg" onChange={handle} />
      {svg && <>
        <div style={{ border: "1px solid #ccc", padding: "1rem", marginTop: "1rem" }}
          dangerouslySetInnerHTML={{ __html: svg }} />
        <button onClick={download}>Download SVG</button>
      </>}
    </div>
  );
}
