const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create SVG with UConn-themed design
const createSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6d28d9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.15}"/>
  <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="${size * 0.25}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">UC</text>
  <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="${size * 0.18}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">WBB</text>
</svg>
`;

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = Buffer.from(createSVG(size));
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);

    try {
      await sharp(svg)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${outputPath}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
    }
  }

  // Generate favicon
  try {
    const svg = Buffer.from(createSVG(32));
    const faviconPath = path.join(publicDir, 'favicon.ico');
    
    await sharp(svg)
      .resize(32, 32)
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    
    // Rename to .ico
    fs.renameSync(faviconPath.replace('.ico', '.png'), faviconPath);
    console.log(`✓ Generated ${faviconPath}`);
  } catch (error) {
    console.error('✗ Failed to generate favicon:', error.message);
  }

  console.log('\n✅ Icon generation complete!');
}

generateIcons().catch(console.error);
