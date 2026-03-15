# PWA Icons

This directory contains icons for the Progressive Web App (PWA) functionality.

## How to Generate Icons

### Option 1: Using macOS built-in tools (Recommended)
1. Open `public/logo.svg` in Preview or any image editor
2. Export it as PNG at 1024x1024 resolution
3. Save as `public/icons/logo-1024.png`
4. Run: `./scripts/generate-icons-macos.sh`

### Option 2: Using ImageMagick
```bash
# Install ImageMagick first
brew install imagemagick

# Then run the script
./scripts/generate-icons.sh
```

### Option 3: Using Node.js script
```bash
# Install dependencies
npm install sharp svg2img

# Run the generator
node scripts/generate-icons.js
```

### Option 4: Manual generation
Use any image editor (Photoshop, GIMP, Figma, etc.) to create PNG files with these sizes:
- 16x16 (favicon-16x16.png)
- 32x32 (favicon-32x32.png)
- 72x72 (icon-72x72.png)
- 96x96 (icon-96x96.png)
- 128x128 (icon-128x128.png)
- 144x144 (icon-144x144.png)
- 152x152 (icon-152x152.png)
- 180x180 (apple-touch-icon.png)
- 192x192 (icon-192x192.png)
- 384x384 (icon-384x384.png)
- 512x512 (icon-512x512.png)

## Required Icons

- **icon-{size}x{size}.png**: Standard PWA icons
- **apple-touch-icon.png**: iOS home screen icon (180x180)
- **favicon-{size}x{size}.png**: Browser favicon

All icons should:
- Have transparent backgrounds (PNG format)
- Use the congdongvang.com logo/brand colors
- Be optimized for file size
