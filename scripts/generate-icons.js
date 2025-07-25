const fs = require('fs');
const path = require('path');

// Crear un SVG base para el icono
const createSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.125}" fill="#3b82f6"/>
  <g transform="translate(${size * 0.25}, ${size * 0.25})">
    <rect width="${size * 0.5}" height="${size * 0.5}" rx="${size * 0.0625}" fill="white"/>
    <path d="M${size * 0.1} ${size * 0.4}V${size * 0.1}h${size * 0.3}v${size * 0.05}H${size * 0.15}v${size * 0.05}h${size * 0.2}v${size * 0.05}H${size * 0.15}v${size * 0.05}h${size * 0.25}v${size * 0.05}H${size * 0.1}z" fill="#3b82f6"/>
    <circle cx="${size * 0.35}" cy="${size * 0.25}" r="${size * 0.02}" fill="#3b82f6"/>
  </g>
</svg>
`;

// Crear directorio public si no existe
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generar iconos SVG para diferentes tamaños
const sizes = [192, 256, 384, 512];

sizes.forEach(size => {
  const svg = createSVG(size);
  fs.writeFileSync(path.join(publicDir, `icon-${size}x${size}.svg`), svg.trim());
  console.log(`Generated icon-${size}x${size}.svg`);
});

console.log('Icons generated successfully!');