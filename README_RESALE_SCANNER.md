# Resale Scanner - Mobile PWA

A professional mobile-first Progressive Web App for resellers to scan and analyze items in real-time at thrift stores. Optimized for iPhone and iPad with Google Gemini AI intelligence, Google Lens integration, and eBay API capabilities.

## Features

### Core Workflow ✅
- **Camera Scanner**: Fullscreen camera overlay with live viewfinder and corner bracket frame
- **5-Phase AI Pipeline**: Vision Analysis → Google Lens → Market Research → Profit Calculation → GO/PASS Decision
- **Agent/Manual Modes**: AI-guided workflow or manual data entry
- **Session Tracking**: Monitor scanning performance with live statistics
- **Queue Management**: Save promising items for batch processing and listing creation
- **Settings**: Configure API keys, business rules, and app preferences

### AI & Integrations ✅
- **Google Gemini**: Product identification, vision analysis, listing generation, and chatbot
- **Voice Input**: Browser-based speech recognition for hands-free operation (all text fields)
- **Photo Editing**: Brightness, contrast, saturation controls, and eBay optimization
- **eBay API**: Sold listing research, active listing analysis, profit calculations
- **AI Research Center**: Market research, trend analysis, competitor scanning, and insights

### Ready for Connection 🔌
- Google Lens API for visual product search
- Google Maps API for local market intelligence  
- Google Search API to reduce AI hallucinations
- Anthropic Claude as fallback AI provider
- Supabase with Docker deployment support
- n8n workflow automation integration points
- Railway deployment optimized
- Google Cloud infrastructure compatible
- Notion workspace sync capabilities

### Data Architecture
- Supabase-ready with Docker deployment support
- n8n workflow automation integration points
- Railway deployment optimized
- Google Cloud infrastructure compatible
- Notion workspace sync capabilities

## Design System

### Colors (Professional Tool Aesthetic)
- Light mode only (field-optimized)
- IBM Plex Sans typography
- Flat, clean, high-contrast UI
- Professional blue primary (`--b1`)
- Semantic GO/PASS colors (green/red)

### Layout
- Max width: 480px (mobile-first)
- Bottom navigation: 4 tabs + floating camera button
- Safe area insets for iPhone home indicator
- Smooth momentum scrolling

## File Structure

```
src/
├── components/
│   ├── BottomNav.tsx           # 4-tab navigation + floating camera FAB
│   ├── CameraOverlay.tsx       # Fullscreen camera with capture logic
│   └── screens/
│       ├── AIScreen.tsx        # Main analysis screen with pipeline
│       ├── SessionScreen.tsx   # Performance tracking dashboard  
│       ├── QueueScreen.tsx     # Saved items for listing creation
│       ├── SettingsScreen.tsx  # API keys and business configuration
│       ├── PipelinePanel.tsx   # 5-phase animated progress cards
│       └── DecisionSignal.tsx  # Bold GO/PASS visual indicator
├── types/
│   └── index.ts                # TypeScript interfaces for all data
├── index.css                   # Custom CSS variables and theme
└── App.tsx                     # Main app with state management (useKV)
```

## Key IDs (For Backend Integration)

All critical DOM elements have stable IDs for automation:

- `#camera-fab` - Camera button
- `#camera-overlay` - Camera interface
- `#camera-price` - Price input in camera
- `#shutter-btn` - Capture button
- `#scr-ai` - AI analysis screen
- `#ai-panel` - Pipeline container
- `#ai-input-bar` - Bottom input bar
- `#phase-vision`, `#phase-lens`, `#phase-market`, `#phase-profit`, `#phase-decision` - Pipeline phases
- `#decision-signal` - GO/PASS indicator
- `#ai-describe` - Description textarea
- `#scr-session`, `#scr-queue`, `#scr-settings` - Other main screens

## State Management

Uses Spark's `useKV` hook for persistent data:
- `queue`: Array of scanned items ready for listing
- `currentSession`: Active session with statistics
- `settings`: API keys and business rules

## Next Steps

### To Start Using the App
1. **Configure Gemini API** in Settings for AI product analysis
2. **Add eBay credentials** for real market data (minimum: App ID)
3. **Optional**: Add Google API key for Lens/Maps/Search features
4. **Start a Session** and begin scanning items!

### Future Enhancements
- Background removal for product photos
- Automated eBay listing publishing
- Batch photo editing for multiple items
- Google Maps local competitor analysis
- Google Search live price checking
- Supabase multi-device sync
- n8n automated listing workflows
- Notion inventory management sync

## Development

This is a Spark template app using:
- React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Vite build system
- Phosphor Icons
- Framer Motion (subtle animations)
- Sonner (toast notifications)

The app is fully functional with mock data - all APIs are ready to be connected.
