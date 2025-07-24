import { v4 as uuidv4 } from 'uuid';

export function getElementAttributes(element) {
  // console.log("element:", element);
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    // console.log("attr:", attr); 
    attrs[attr.name] = attr.value;
  }
  // console.log("attrs:", attrs);
  return attrs;
}

function parseElement(element, inheritedTransform = '') {
  const tag = element.tagName.toLowerCase();
  const attrs = getElementAttributes(element);
  const combinedTransform = [inheritedTransform, attrs.transform].filter(Boolean).join(' ').trim();
  // console.log("combined transform:", combinedTransform);

  const node = {
    id: uuidv4(),
    type: tag,
    attributes: attrs,
    transform: combinedTransform || null,
    layer: attrs['data-layer'] || null,
    children: []
  };
  // console.log("node:", node);
  
  // if (tag === 'text' || tag === 'mtext') {
  //   node.textContent = element.textContent || '';
  // }

  if (element.children && element.children.length > 0) {
    for (const child of element.children) {
      node.children.push(parseElement(child, combinedTransform));
    }
  }

  return node;
}

export function parseSvgContent(svgString) { 
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  let viewBox = '0 0 1200 1600';
  const elements = [];

  if (svg) {
    const vb = svg.getAttribute('viewBox');
    if (vb) viewBox = vb;

    for (const child of svg.children) {
      elements.push(parseElement(child));
    }
  }

  return { elements, viewBox };
}

function generateElementString(el, indent = 2) {
  const { type, attributes, children, transform } = el;
  const spacing = ' '.repeat(indent);
  const attrString = Object.entries(attributes)
    .filter(([k]) => k !== 'children')
    .map(([k, v]) => `${k}="${v}"`).join(' ');

  const transformAttr = transform ? ` transform="${transform}"` : '';

  // if (children && children.length > 0) {
  //   const inner = children.map(c => generateElementString(c, indent + 2)).join('\n');
  //   return `${spacing}<${type}${transformAttr} ${attrString}>\n${inner}\n${spacing}</${type}>`;
  // } else if (type === 'text' || type === 'mtext') {
  //   return `${spacing}<${type}${transformAttr} ${attrString}>${textContent || ''}</${type}>`;
  // } else {
  //   return `${spacing}<${type}${transformAttr} ${attrString} />`;
  // }

  if (type === 'text' || type === 'mtext') {
    return `${spacing}<${type}${transformAttr} ${attrString}>${textContent || ''}</${type}>`;
  } else {
    return `${spacing}<${type}${transformAttr} ${attrString} />`;
  }
}

export function generateSvgString(elements, viewBox = '0 0 1200 1600') {
  const body = elements.map(el => generateElementString(el)).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" >\n${body}\n</svg>`;
}
