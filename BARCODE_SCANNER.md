# Barcode Scanner Feature

## Overview
The Resale Scanner app includes a real-time barcode scanner for quick product identification using UPC/EAN barcodes, fully integrated into the camera workflow.

## Features

### Real-Time Barcode Detection
- Scans UPC-A, UPC-E, EAN-13, EAN-8, Code 39, Code 128, and QR codes
- Live camera feed with animated scanning guide and corner brackets
- Visual feedback with animated scanning line
- Haptic feedback (vibration) on successful scan
- Product information overlay with image, title, and brand

### Product Lookup
The barcode scanner integrates with two free product databases:

1. **Open Food Facts** - Extensive food and beverage database
   - Free, no API key required
   - Covers packaged food, drinks, and consumer goods
   - Provides product name, brand, category, description, and images
   - Priority lookup for food items

2. **UPC Item DB** - General product database
   - Free tier: 100 requests/day
   - Covers wide range of consumer products
   - Provides product details including brand and category
   - Fallback for non-food items

### Usage

1. Open the camera overlay by tapping the camera button
2. Switch to "SCAN" mode using the mode selector (AI LENS | SCAN | LISTING)
3. Position the barcode within the scanning frame
4. The scanner will automatically detect and lookup the product
5. Product information appears in an overlay with:
   - Product image (if available)
   - Product title
   - Brand name
   - Barcode number and format
   - "Use This Product" button to accept
6. Tap "Use This Product" or scanner will auto-switch to lens mode
7. In lens mode, the scanned product information is displayed as a green card
8. Enter price and capture photo normally - the barcode data enriches the AI analysis

### Technical Implementation

**Components:**
- `BarcodeScanner.tsx` - Main barcode scanning component with html5-qrcode integration
  - Full-screen overlay with camera feed
  - Real-time barcode detection
  - Product lookup integration
  - Success/error states with animations
- `barcode-service.ts` - Product lookup service integrating with Open Food Facts and UPC Item DB
  - Caching system to reduce API calls
  - Cascading lookup (tries Open Food Facts first, then UPC Item DB)
  - Error handling and graceful degradation

**Libraries:**
- `html5-qrcode` - Cross-browser barcode scanning using device camera
- Native Barcode Detection API support (where available)
- Framer Motion for smooth animations

### Integration with Existing Workflow

The barcode scanner seamlessly integrates with the existing camera workflow:

1. **Quick Product Identification** - Scan barcode to instantly identify products before photo capture
2. **Product Information Enrichment** - Scanned product details (title, brand, category) are available during AI analysis
3. **Visual Confirmation** - Green info card shows scanned product while capturing photo
4. **Location Tracking** - Barcode-scanned items can still be tagged with thrift store locations
5. **Queue System** - Barcode-enriched items flow into the same queue for batch processing
6. **AI Pipeline Enhancement** - Barcode data provides a head start for Gemini vision analysis

### User Experience Flow

**Barcode Scan Flow:**
1. User opens camera
2. Switches to SCAN mode
3. Positions barcode in frame
4. Scanner detects barcode → vibration feedback
5. "Looking up product..." animation
6. Product card appears with image and details
7. User taps "Use This Product" or waits for auto-switch
8. Returns to lens mode with product info visible
9. User enters price and captures photo
10. Product proceeds through normal AI pipeline with enriched data

### Benefits

#### Speed
- Instant product identification without AI processing time
- Perfect for high-volume scanning sessions at thrift stores
- No waiting for Gemini vision analysis for packaged goods

#### Accuracy
- Direct database matching eliminates AI misidentification
- Especially useful for packaged goods with clear barcodes
- Provides accurate brand and product names

#### Free Data
- Both APIs offer generous free tiers
- No additional API keys or costs required to get started
- Open Food Facts is completely free with no limits
- UPC Item DB provides 100 requests/day free

#### Integration
- Works alongside AI analysis, not replacing it
- Enriches data for better market research
- Provides fallback when barcodes are unreadable

### Future Enhancements

Suggested next steps for the barcode scanner:
- **Barcode Scan History** - Track all scanned barcodes for later review
- **Manual Barcode Entry** - Allow typing UPC codes for damaged labels
- **ISBN Lookup for Books** - Specialized book identification via ISBN
- **eBay Direct Integration** - Scan barcode → instant eBay sold listings lookup
- **Offline Caching** - Cache common product barcodes for offline scanning
- **Price Database** - Store historical prices for scanned items
- **Brand Recognition** - Auto-tag items by brand from barcode data
- **Category Suggestions** - Use barcode category for better eBay category matching

## Configuration

No configuration required - the barcode scanner works out of the box with free APIs:
- **Open Food Facts**: No API key needed
- **UPC Item DB**: Works with free tier (100 requests/day)

For higher volume needs, consider:
- Upgrading UPC Item DB plan for more API calls
- Implementing additional barcode databases as fallbacks
- Local barcode database for frequently scanned items
