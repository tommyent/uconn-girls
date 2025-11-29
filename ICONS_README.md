# PWA Icons Setup

The app requires icon files for the Progressive Web App functionality.

## Required Icons

You need to create the following icon files in the `public/` directory:

- `icon-192x192.png` - 192x192 pixels
- `icon-512x512.png` - 512x512 pixels

## Creating Icons

### Option 1: Use the UConn Logo
1. Download the official UConn Huskies logo
2. Use an image editor or online tool to resize to 192x192 and 512x512
3. Save as PNG files in the `public/` directory

### Option 2: Use a PWA Icon Generator
1. Visit [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) or [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload the UConn logo or a custom design
3. Generate the icon pack
4. Download and extract to `public/` directory

### Option 3: Create Simple Placeholder Icons
For testing purposes, you can create simple colored squares:

```bash
# Install ImageMagick (if not already installed)
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# Generate placeholder icons
convert -size 192x192 xc:#8b5cf6 public/icon-192x192.png
convert -size 512x512 xc:#8b5cf6 public/icon-512x512.png
```

## Icon Guidelines

- **Format**: PNG with transparent background
- **Content**: Should be recognizable at small sizes
- **Colors**: Use UConn or app brand colors (violet theme)
- **Design**: Simple, centered, with adequate padding

## Verifying Icons

After adding the icons:
1. Run `npm run build`
2. Open the app in a browser
3. Check browser DevTools > Application > Manifest
4. Verify icons are loaded correctly

## Optional: Favicon

Add a `favicon.ico` to the `public/` directory for browser tab icons.
