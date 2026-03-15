#!/bin/bash

# Generate Maskable Icons for Android Adaptive Icons
# Maskable icons have a safe zone (80% of canvas) with the icon
# and 20% padding around it for adaptive icon backgrounds
#
# Usage: ./scripts/generate-maskable-icons.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

OUTPUT_DIR="public/icons"

echo -e "${BLUE}🎭 Maskable Icon Generator${NC}\n"

# Check if regular icons exist first
if [ ! -f "$OUTPUT_DIR/icon-192x192.png" ] || [ ! -f "$OUTPUT_DIR/icon-512x512.png" ]; then
    echo -e "${RED}❌ Regular icons not found${NC}"
    echo -e "${YELLOW}Please run ./scripts/generate-icons-rsvg.sh first${NC}"
    exit 1
fi

# Check for ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ ImageMagick not installed${NC}"
    echo -e "${BLUE}Install: brew install imagemagick${NC}"
    exit 1
fi

# Use 'magick' if available, otherwise 'convert'
MAGICK_CMD="magick"
if ! command -v magick &> /dev/null; then
    MAGICK_CMD="convert"
fi

echo -e "${BLUE}Generating maskable icons from existing PNGs...${NC}\n"
echo -e "${YELLOW}Strategy: Resize existing icons to 80% and center on green background${NC}\n"

# Generate 192x192 maskable icon
echo -e "${BLUE}Creating 192x192 maskable icon...${NC}"
SIZE=192
INNER_SIZE=$((SIZE * 80 / 100))  # 80% = 154px

$MAGICK_CMD -size "${SIZE}x${SIZE}" xc:"#008148" \
    \( "$OUTPUT_DIR/icon-192x192.png" -resize "${INNER_SIZE}x${INNER_SIZE}" \) \
    -gravity center \
    -composite \
    -quality 100 \
    "$OUTPUT_DIR/icon-192x192-maskable.png"

echo -e "${GREEN}✅ icon-192x192-maskable.png${NC}"

# Generate 512x512 maskable icon
echo -e "${BLUE}Creating 512x512 maskable icon...${NC}"
SIZE=512
INNER_SIZE=$((SIZE * 80 / 100))  # 80% = 410px

$MAGICK_CMD -size "${SIZE}x${SIZE}" xc:"#008148" \
    \( "$OUTPUT_DIR/icon-512x512.png" -resize "${INNER_SIZE}x${INNER_SIZE}" \) \
    -gravity center \
    -composite \
    -quality 100 \
    "$OUTPUT_DIR/icon-512x512-maskable.png"

echo -e "${GREEN}✅ icon-512x512-maskable.png${NC}"

echo -e "\n${GREEN}🎉 Maskable icons generated!${NC}"
echo -e "${BLUE}📁 Saved to: $OUTPUT_DIR${NC}\n"

echo -e "${YELLOW}💡 What are maskable icons?${NC}"
echo -e "   - Used by Android for adaptive icons"
echo -e "   - Have a safe zone (80% of canvas) with padding"
echo -e "   - Background: #008148 (congdongvang.com green)"
echo -e "   - Icon size: 80% of canvas (safe zone)"
echo -e "\n${YELLOW}📱 Test at: https://maskable.app/editor${NC}"
