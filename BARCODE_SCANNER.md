# Barcode Scanner Feature

## Overview
The Resale Scanner app now includes a real-time barcode scanner for quick product identification using UPC/EAN barcodes.

## Features

### Real-Time Barcode Detection
- Scans UPC-A, UPC-E, EAN-13, EAN-8, Code 39, Code 128, and QR codes
- Live camera feed with animated scanning guide
- Visual feedback with scanning line animation
- Haptic feedback (vibration) on successful scan

### Product Lookup
The barcode scanner integrates with two free product databases:

1. **Open Food Facts** - Extensive food and beverage database
   - Free, no API key required
   - Covers packaged food, drinks, and consumer goods
   - Provides product name, brand, category, description, and images

2. **UPC Item DB** - General product database
   - Free tier: 100 requests/day
   - Covers wide range of consumer products
   - Provides product details including brand and category

### Usage

1. Open the camera overlay by tapping the camera button
2. Switch to "SCAN" mode using the mode selector
3. Position the barcode within the scanning frame
4. The scanner will automatically detect and lookup the product
5. Product information appears in a toast notification
6. The product name is pre-filled when you return to capture mode

### Technical Implementation

**Components:**
- `BarcodeScanner.tsx` - Main barcode scanning component with html5-qrcode integration
- `barcode-service.ts` - Product lookup service integrating with Open Food Facts and UPC Item DB

**Libraries:**
- `html5-qrcode` - Cross-browser barcode scanning using device camera
- Native Barcode Detection API support (where available)

### Integration with Existing Workflow

The barcode scanner seamlessly integrates with the existing camera workflow:

1. **Quick Product Identification** - Scan barcode to instantly identify products
2. **Auto-Fill Product Name** - Scanned product name is available for the AI analysis pipeline
3. **Location Tracking** - Scanned items can still be tagged with thrift store locations
4. **Queue System** - Barcode-scanned items flow into the same queue for batch processing

### Future Enhancements

Suggested next steps for the barcode scanner:
- Add barcode scan history tracking
- Enable manual barcode entry for damaged labels
- Connect barcode scanner directly to eBay lookup for instant price estimates
- Cache scanned products for offline access
- Add support for ISBN lookup for books

## Benefits

### Speed
- Instant product identification without AI processing time
- Perfect for high-volume scanning sessions at thrift stores

### Accuracy
- Direct database matching eliminates AI misidentification
- Especially useful for packaged goods with clear barcodes

### Free Data
- Both APIs offer generous free tiers
- No additional API keys or costs required to get started
