export function convertToSvg(db) {
  const entities = db.entities || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let content = '';

  const updateBounds = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  console.log("Full DB:", db);

  for (const e of entities) {
    const color = e.color || { r: 0, g: 0, b: 0 };

    try {
      if (e.type === 'LINE' && (e.start || e.startPoint) && (e.end || e.endPoint)) {
        const start = e.start || e.startPoint;
        const end = e.end || e.endPoint;
        updateBounds(start.x, start.y);
        updateBounds(end.x, end.y);
        content += `<line x1="${start.x}" y1="${-start.y}" x2="${end.x}" y2="${-end.y}" stroke="rgb(${color.r},${color.g},${color.b})" stroke-width="1"/>`;
      }
      else if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
        const radius = Math.abs(e.radius);
        if (radius <= 0) continue;
        updateBounds(e.center.x - radius, e.center.y - radius);
        updateBounds(e.center.x + radius, e.center.y + radius);
        content += `<circle cx="${e.center.x}" cy="${-e.center.y}" r="${radius}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" stroke-width="1"/>`;
      }
      else if (e.type === 'TEXT' && e.insert && e.text) {
        updateBounds(e.insert.x, e.insert.y);
        content += `<text x="${e.insert.x}" y="${-e.insert.y}" font-size="${e.height || 12}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
      }
      else if (e.type === 'MTEXT' && e.insertionPoint && e.text) {
        const height = e.textHeight || 12;
        updateBounds(e.insertionPoint.x, e.insertionPoint.y);
        content += `<text x="${e.insertionPoint.x}" y="${-e.insertionPoint.y}" font-size="${height}" fill="rgb(${color.r},${color.g},${color.b})">${e.text}</text>`;
      }
      else if (e.type === 'ARC' && e.center && typeof e.radius === 'number') {
        const { center, radius, startAngle, endAngle } = e;
        const sx = center.x + radius * Math.cos(startAngle);
        const sy = center.y + radius * Math.sin(startAngle);
        const ex = center.x + radius * Math.cos(endAngle);
        const ey = center.y + radius * Math.sin(endAngle);
        updateBounds(sx, sy);
        updateBounds(ex, ey);
        const largeArc = (endAngle - startAngle) % (2 * Math.PI) > Math.PI ? 1 : 0;
        content += `<path d="M ${sx} ${-sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${-ey}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" stroke-width="1"/>`;
      }
      else if (e.type === 'ELLIPSE' && e.center && e.majorAxisEndPoint) {
        const rawRx = e.majorAxisEndPoint?.x ?? 0;
        const rx = Math.abs(rawRx);
        const ry = Math.abs((e.axisRatio || 1) * rawRx);
        if (rx <= 0 || ry <= 0) continue;
        updateBounds(e.center.x - rx, e.center.y - ry);
        updateBounds(e.center.x + rx, e.center.y + ry);
        content += `<ellipse cx="${e.center.x}" cy="${-e.center.y}" rx="${rx}" ry="${ry}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" stroke-width="1"/>`;
      }
      else if (e.type === 'POLYLINE' && Array.isArray(e.vertices)) {
        const points = e.vertices.map(v => {
          updateBounds(v.x, v.y);
          return `${v.x},${-v.y}`;
        }).join(' ');
        content += `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" stroke-width="1"/>`;
      }
      else if (e.type === 'LWPOLYLINE' && Array.isArray(e.vertices)) {
        const points = e.vertices.map(v => {
          updateBounds(v.x, v.y);
          return `${v.x},${-v.y}`;
        }).join(' ');
        content += `<polyline points="${points}" stroke="rgb(${color.r},${color.g},${color.b})" fill="none" stroke-width="1"/>`;
      }
      else if (e.type === 'SOLID' && Array.isArray(e.points) && e.points.length === 4) {
        const points = e.points.map(p => {
          updateBounds(p.x, p.y);
          return `${p.x},${-p.y}`;
        }).join(' ');
        content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" />`;
      }
      else if (e.type === 'POINT' && e.position) {
        updateBounds(e.position.x, e.position.y);
        content += `<circle cx="${e.position.x}" cy="${-e.position.y}" r="1.5" fill="rgb(${color.r},${color.g},${color.b})" />`;
      }
      else if (e.type === 'OLE2FRAME' && e.position) {
        const width = 10, height = 10;
        updateBounds(e.position.x, e.position.y);
        content += `<rect x="${e.position.x}" y="${-e.position.y}" width="${width}" height="${height}" fill="none" stroke="rgb(${color.r},${color.g},${color.b})" stroke-dasharray="2" />`;
      }
      else if (e.type === 'INSERT') {
        console.log('DEBUG INSERT entity:', e);
        console.log('Is db.blocks available?', Array.isArray(db.blocks), db.blocks);

        if ((e.blockName || e.name) && Array.isArray(db.blocks)) {
          const blockName = e.blockName || e.name;
          const block = db.blocks.find(b => b.name === blockName);

          if (!block) {
            console.warn(`Block not found for INSERT: ${blockName}`, e);
          }

          if (block && block.entities) {
            const pos = e.insert || e.insertionPoint || { x: 0, y: 0 };
            const scaleX = e.xScale || 1;
            const scaleY = e.yScale || 1;
            const rotation = (e.rotation || 0) * (180 / Math.PI); // radians to degrees

            const innerContent = block.entities.map(be => {
              const cloned = { ...be };
              if (cloned.start) cloned.start = { x: cloned.start.x + pos.x, y: cloned.start.y + pos.y };
              if (cloned.end) cloned.end = { x: cloned.end.x + pos.x, y: cloned.end.y + pos.y };
              if (cloned.center) cloned.center = { x: cloned.center.x + pos.x, y: cloned.center.y + pos.y };
              if (cloned.insert) cloned.insert = { x: cloned.insert.x + pos.x, y: cloned.insert.y + pos.y };
              if (cloned.insertionPoint) cloned.insertionPoint = { x: cloned.insertionPoint.x + pos.x, y: cloned.insertionPoint.y + pos.y };
              if (cloned.vertices) cloned.vertices = cloned.vertices.map(v => ({ x: v.x + pos.x, y: v.y + pos.y }));

              const nestedSvg = convertToSvg({ entities: [cloned], blocks: db.blocks });
              return nestedSvg.slice(nestedSvg.indexOf('>') + 1, nestedSvg.lastIndexOf('<'));
            }).join('');

            const transform = `
        translate(${pos.x}, ${-pos.y})
        scale(${scaleX}, ${scaleY})
        rotate(${-rotation})
      `.trim();
            content += `<g transform="${transform}">${innerContent}</g>`;
          } else {
            console.warn(`Block not found for INSERT: ${blockName}`);
          }
        } else {
          console.warn(`INSERT entity skipped — missing blockName/name or invalid db.blocks`, e);
        }
      }
      else if (e.type === 'HATCH' && Array.isArray(e.boundaryPaths)) {
        e.boundaryPaths.forEach(boundary => {
          if (boundary.type === 'POLYLINE' && Array.isArray(boundary.vertices)) {
            const points = boundary.vertices.map(v => `${v.x},${-v.y}`).join(' ');
            content += `<polygon points="${points}" fill="rgb(${color.r},${color.g},${color.b})" stroke="none" />`;
          }
        });
      }
      else {
        console.warn(`Entity type not handled: ${e.type}`, e);
      }
    } catch (err) {
      console.warn('Failed to render entity:', e, err);
    }
    console.log('Rendering entity type:', e.type);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = 10;
  const viewBox = `${minX - padding} ${-maxY - padding} ${width + padding * 2} ${height + padding * 2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
}
