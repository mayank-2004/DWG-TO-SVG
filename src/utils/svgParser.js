import { v4 as uuidv4 } from 'uuid';

export function getElementAttributes(element) {
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function applyTransformToAttributes(attrs, transform) {
  if (!transform) return { ...attrs };

  const translateMatch = transform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
  if (!translateMatch) return { ...attrs };

  const dx = parseFloat(translateMatch[1]);
  const dy = parseFloat(translateMatch[2]);
  const updated = { ...attrs };

  const offsetPair = (xKey, yKey) => {
    if (xKey in updated) updated[xKey] = (parseFloat(updated[xKey]) + dx).toString();
    if (yKey in updated) updated[yKey] = (parseFloat(updated[yKey]) + dy).toString();
  };

  if ('x' in updated && 'y' in updated) offsetPair('x', 'y');
  else if ('cx' in updated && 'cy' in updated) offsetPair('cx', 'cy');
  else if ('x1' in updated && 'y1' in updated && 'x2' in updated && 'y2' in updated) {
    updated.x1 = (parseFloat(updated.x1) + dx).toString();
    updated.y1 = (parseFloat(updated.y1) + dy).toString();
    updated.x2 = (parseFloat(updated.x2) + dx).toString();
    updated.y2 = (parseFloat(updated.y2) + dy).toString();
  } else if ('points' in updated) {
    updated.points = updated.points.split(' ').map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return `${x + dx},${y + dy}`;
    }).join(' ');
  } else if ('d' in updated) {
    updated.d = updated.d.replace(/([ML])\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)/gi, (match, cmd, x, y) => {
      return `${cmd} ${parseFloat(x) + dx},${parseFloat(y) + dy}`;
    });
  }

  return updated;
}

export function parseSvgContent(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  const elements = [];
  let viewBox = '0 0 800 600';

  if (svg) {
    const vb = svg.getAttribute('viewBox');
    if (vb) viewBox = vb;

    const groups = svg.querySelectorAll('g[data-layer]');

    groups.forEach(group => {
      const layer = group.getAttribute('data-layer') || 'default';
      const transform = group.getAttribute('transform');
      const children = Array.from(group.children);

      children.forEach(child => {
        const rawAttrs = getElementAttributes(child);
        const adjustedAttrs = applyTransformToAttributes(rawAttrs, transform);
        const type = child.tagName.toLowerCase();

        elements.push({
          id: uuidv4(),
          type,
          layer,
          attributes: adjustedAttrs
        });
      });
    });
  }


  return { elements, viewBox };
}

export function generateSvgString(elements, viewBox = '0 0 800 600') {
  const grouped = {};

  elements.forEach(el => {
    const layer = el.layer || 'default';
    if (!grouped[layer]) grouped[layer] = [];
    grouped[layer].push(el);
  });

  const groupContent = Object.entries(grouped).map(([layer, els]) => {
    const content = els.map(el => {
      const { type, attributes } = el;
      const attrString = Object.entries(attributes)
        .map(([k, v]) => `${k}="${v}"`).join(' ');

      const isText = type === 'text' && attributes.children;
      const tag = isText
        ? `<${type} ${attrString}>${attributes.children}</${type}>`
        : `<${type} ${attrString} />`;

      return tag;
    }).join('\n');

    return `<g data-layer="${layer}">\n${content}\n</g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${groupContent}\n</svg>`;
}
