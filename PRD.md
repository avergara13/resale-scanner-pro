# Resale Scanner - Product Requirements Document

A professional mobile PWA that transforms iPhone/iPad into an intelligent field tool for resellers, combining real-time AI analysis, Google Lens integration, and live market research to make instant buy/pass decisions at thrift stores.

**Experience Qualities**:
1. **Professional** - Tool-first design with clean, flat aesthetics optimized for rapid decision-making in field conditions
2. **Intelligent** - Agentic AI workflow with Gemini models guiding users through complete resale analysis pipeline
3. **Responsive** - Instant feedback with real-time market data, voice control, and sub-second camera-to-decision pipeline

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a multi-modal AI platform integrating camera vision, voice interfaces, real-time APIs (eBay, Google Maps, Google Search), persistent queues, and intelligent agents orchestrating the complete resale workflow from scanning to listing creation.

## Implementation Status

### ✅ Completed Features
- **Camera Intelligence System**: Fullscreen camera with viewfinder, price input, and dual modes (AI Lens / Listing)
- **AI Analysis Pipeline**: 5-phase system with Google Gemini vision API integration
- **Agent/Manual Dual Interface**: Tab switching between AI-guided and manual entry modes
- **Voice Control Integration**: Browser-based speech recognition for hands-free text input across the app
- **Session Management**: Full session tracking with statistics and performance metrics
- **Queue System**: Persistent item storage with add/remove functionality
- **eBay Market Data**: Real-time sold listings research with profit calculations
- **Google Gemini Integration**: Product identification, listing generation, and chat capabilities
- **AI Research Center**: Chatbot, market research tools, trend analysis, and insights dashboard
- **Photo Editing**: Brightness, contrast, saturation adjustments, and eBay optimization
- **Settings Configuration**: Comprehensive API key management for all services

### 🚧 Ready for API Connection
The following features are built and ready - just add API keys in Settings:
- **Google Lens Search**: ✅ Service layer complete with detailed setup instructions in Settings
- **Google Cloud Vision API**: ✅ Product identification from photos configured and ready
- **Google Custom Search**: ✅ Enhanced visual search results integration complete
- **Google Maps & Places**: Infrastructure ready for location-based market intelligence
- **Anthropic Claude**: Configured as fallback AI provider
- **Supabase**: Database persistence architecture ready
- **n8n Workflows**: Webhook endpoints prepared for automation
- **Notion Sync**: API integration points established

### 📋 Integration Checklist
To make this app fully operational:

#### Required APIs (Core Functionality)
1. **Google Gemini API Key** → Settings → AI Configuration
   - For real-time product vision analysis
   - Get at: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

2. **Google Cloud API Key** → Settings → Google Cloud APIs
   - For Google Lens visual product matching
   - **Setup Instructions (now in Settings):**
     1. Go to [console.cloud.google.com](https://console.cloud.google.com)
     2. Create new project or select existing
     3. Enable: Vision API, Custom Search API, Maps API, Places API
     4. Go to Credentials → Create API Key
     5. Restrict key to enabled APIs only
     6. Copy key to Settings

3. **eBay Developer Credentials** → Settings → eBay Integration
   - For real market data and pricing
   - Get at: [developer.ebay.com](https://developer.ebay.com)
   - Need: App ID, Dev ID, Cert ID, OAuth Token

#### Optional APIs (Enhanced Features)
4. **Google Custom Search Engine ID** → Settings → Google Cloud APIs (Optional field)
   - For enhanced visual search results
   - Get at: [programmablesearchengine.google.com](https://programmablesearchengine.google.com)

5. **Supabase Credentials** → Settings → Database & Automation
   - For cloud data persistence
   - Get at: [supabase.com](https://supabase.com)

6. **n8n Webhook URL** → Settings → Database & Automation
   - For automated workflows
   - Configure in your n8n instance

7. **Notion Integration** → Settings → Database & Automation
   - For inventory tracking workspace
   - Get at: [notion.so/my-integrations](https://www.notion.so/my-integrations)

## Next Development Phase

### Camera Intelligence System
- **Functionality**: Fullscreen camera overlay with live viewfinder, corner bracket frame, price input field, and shutter button for capture
- **Purpose**: Primary data input - captures product images for Google Lens search and Gemini vision analysis
- **Trigger**: Floating camera eye button (center of bottom nav)
- **Progression**: Tap camera button → Dark overlay opens → Frame product → Enter price → Tap shutter → Image processes through AI pipeline → Returns to AI screen with results
- **Success criteria**: Clean 480px-max width capture, instant photo processing, seamless transition back to AI analysis screen

### AI Analysis Pipeline (5-Phase System)
- **Functionality**: Animated step cards showing real-time progress through: 1) Vision Analysis (Google Gemini), 2) Google Lens Search, 3) Market Research (eBay/Google), 4) Profit Calculation, 5) Decision Signal (GO/PASS)
- **Purpose**: Transparent AI workflow that builds trust and shows reasoning behind recommendations using real Google Gemini vision API for product identification
- **Trigger**: Photo capture or manual item entry
- **Progression**: Image captured → Phase 1 animates in → Gemini analyzes image with product name, brand, category, condition, confidence score → Phase 2 starts → Google Lens finds product → Phase 3 fetches market data → Phase 4 calculates margins → Phase 5 shows bold GO (green) or PASS (red) decision
- **Success criteria**: Each phase completes in <2s, visual feedback throughout, unmissable final decision signal, real Gemini API product identification with confidence scores

### Agent/Manual Dual Interface
- **Functionality**: Tab toggle between AI-guided workflow (Agent mode) and manual form entry (Manual mode)
- **Purpose**: Flexibility for experienced users who want direct control vs. guided AI assistance
- **Trigger**: Tab buttons in AI screen topbar
- **Progression**: Agent mode (default) → AI suggests fields and validates → OR → Manual mode → User fills form directly → Both feed into same analysis pipeline
- **Success criteria**: Seamless tab switching, state preservation, AI suggestions visible in Agent mode

### Voice Control Integration
- **Functionality**: Voice input for price, description, notes, and search queries across all screens
- **Purpose**: Hands-free operation critical for field use when holding items
- **Trigger**: Microphone icon buttons on input fields
- **Progression**: Tap mic icon → Browser speech recognition starts → User speaks → Text auto-fills field → User confirms or edits
- **Success criteria**: <500ms activation, accurate transcription, works in noisy thrift store environments

### Session Management
- **Functionality**: Track scanning session with statistics (items scanned, GO/PASS ratio, potential profit, time elapsed)
- **Purpose**: Performance metrics for professional resellers to optimize their sourcing sessions
- **Trigger**: Bottom nav Session button
- **Progression**: Start session → Stats auto-track → View dashboard → End session → Summary saved to history
- **Success criteria**: Persistent session across app navigation, accurate calculations, exportable reports

### Queue System
- **Functionality**: Saved items awaiting purchase decision or listing creation, sortable by profit margin
- **Purpose**: Hold promising items for batch processing and comparison
- **Trigger**: Add to queue from AI screen, view via bottom nav Queue button
- **Progression**: Item analyzed → Add to queue → Review queue screen → Sort/filter → Batch process selected items → Create eBay listings
- **Success criteria**: Fast queue additions, persistent storage (useKV), bulk actions, listing export

### eBay Listing Generator
- **Functionality**: AI-powered listing creation with photo editing, title optimization, description generation, category selection
- **Purpose**: Complete workflow from scan to published listing
- **Trigger**: Queue item → Create listing button
- **Progression**: Select queued item → AI generates title/description → Edit photos (crop, enhance, background removal) → Set price/shipping → Preview → Publish to eBay API
- **Success criteria**: Gemini-generated SEO-optimized titles, professional photos, one-tap publishing

### Google Lens Deep Search
- **Functionality**: Quick search (automatic after photo) and manual deep search with Google Lens API
- **Purpose**: Product identification and competitive pricing research
- **Trigger**: Automatic on camera capture, or manual search button
- **Progression**: Image sent to Google Lens → Product identified → Similar items found → Prices aggregated → Results displayed in scrollable panel
- **Success criteria**: <3s search time, accurate product matching, price range data

### Live Market Research
- **Functionality**: Real-time eBay sold listings, Google Shopping results, local market data via Google Maps
- **Purpose**: Reduce AI hallucinations with live data, provide confidence in buy decisions based on actual sold prices
- **Trigger**: Automatic in AI pipeline phase 3
- **Progression**: Product identified → Query eBay Finding API (completed items, last 90 days) → Query eBay Shopping API (active listings) → Calculate avg/median prices, sell-through rate, price range → Display market data panel with recent sales and active listings → Factor into profit calculation
- **Success criteria**: Fresh data (<5min cache), sold vs. active listing ratio with sell-through rate, recommended pricing based on median sold prices, profit margin accounting for eBay fees, display of 10 recent sales with dates and conditions

### Gemini Chatbot Assistant
- **Functionality**: Context-aware AI assistant for questions about items, market trends, pricing strategy
- **Purpose**: Conversational help during decision-making process
- **Trigger**: Chat icon in Settings or AI screen
- **Progression**: User asks question about current item → Gemini responds with context (item data, market research) → Multi-turn conversation → Suggested actions
- **Success criteria**: Maintains context of current scan, provides actionable advice, <2s response time

## Edge Case Handling

- **No Camera Access** - Fallback to file upload picker with clear error message and permission request
- **Offline Mode** - Queue items locally, sync when connection restored, show offline indicator
- **API Failures** - Graceful degradation (skip failed phase, show what data is available, allow manual override)
- **Low Light Photos** - Flash toggle on camera, brightness enhancement in post-processing
- **Ambiguous Items** - Agent asks clarifying questions, suggests category options
- **Duplicate Scans** - Detect similar items in queue, warn before adding duplicates
- **Session Battery** - Warn at 20% battery, auto-save session progress
- **Price Input Errors** - Validate currency format, suggest corrections for common typos

## Design Direction

The interface should feel like a professional diagnostic tool used by medical professionals or field technicians — purposeful, data-dense where appropriate, with a clear visual hierarchy that prioritizes the GO/PASS decision. Every screen supports the core mission: help resellers make fast, profitable buying decisions. The design should inspire confidence through clarity, not delight through ornamentation.

## Color Selection

Professional tool palette with semantic action colors and readable contrast ratios optimized for outdoor/indoor thrift store lighting.

- **--bg (Base White)**: `oklch(0.99 0 0)` - Clean background for readability
- **--fg (Charcoal)**: `oklch(0.25 0 0)` - Primary text, high contrast 15.8:1 ratio ✓
- **--s1 (Light Gray)**: `oklch(0.96 0 0)` - Section backgrounds
- **--s2 (Medium Gray)**: `oklch(0.88 0 0)` - Borders and dividers
- **--s3 (Cool Gray)**: `oklch(0.65 0 0)` - Secondary text
- **--s4 (Steel)**: `oklch(0.45 0 0)` - Tertiary elements
- **--b1 (Primary Blue)**: `oklch(0.55 0.15 250)` - Primary actions, selected states
- **--b2 (Deep Blue)**: `oklch(0.42 0.12 250)` - Hover states, emphasis
- **--t1 (Navy)**: `oklch(0.35 0.08 250)` - Camera overlay background (70% opacity)
- **--t2 (Soft Blue)**: `oklch(0.85 0.05 250)` - Active tab background
- **--t3 (Pale Blue)**: `oklch(0.92 0.03 250)` - Hover states
- **--t4 (Ice Blue)**: `oklch(0.97 0.01 250)` - Selected backgrounds
- **--green (Success)**: `oklch(0.60 0.17 145)` - GO decision signal
- **--amber (Warning)**: `oklch(0.75 0.15 75)` - Marginal profit warnings
- **--red (Reject)**: `oklch(0.58 0.20 25)` - PASS decision signal

**Foreground/Background Pairings**:
- --fg on --bg: Charcoal on White - Ratio 15.8:1 ✓
- --fg on --s1: Charcoal on Light Gray - Ratio 14.9:1 ✓
- --b1 on --bg: Primary Blue on White - Ratio 4.6:1 ✓
- --bg on --b1: White on Primary Blue - Ratio 4.6:1 ✓
- --bg on --green: White on Success Green - Ratio 5.1:1 ✓
- --bg on --red: White on Reject Red - Ratio 4.8:1 ✓
- --s3 on --bg: Cool Gray on White - Ratio 4.5:1 ✓

## Font Selection

A technical, highly legible sans-serif optimized for data-dense mobile screens and outdoor viewing conditions: **IBM Plex Sans** for all UI text, with **IBM Plex Mono** for numerical data (prices, percentages, IDs).

- **Typographic Hierarchy**:
  - App Title/Logo: IBM Plex Sans Semibold / 18px / -0.02em
  - Screen Headers: IBM Plex Sans Semibold / 16px / -0.01em
  - Decision Signal (GO/PASS): IBM Plex Sans Bold / 32px / -0.03em / uppercase
  - Body Text: IBM Plex Sans Regular / 14px / normal
  - Labels: IBM Plex Sans Medium / 13px / 0.01em / uppercase
  - Secondary Info: IBM Plex Sans Regular / 12px / normal
  - Prices/Numbers: IBM Plex Mono Medium / 15px / normal
  - Input Fields: IBM Plex Sans Regular / 15px / normal
  - Button Text: IBM Plex Sans Medium / 14px / 0.005em

## Animations

Animations serve functional purposes only: indicating processing state, drawing attention to critical decisions, and confirming user actions.

- **Pipeline Phase Cards**: Slide in from bottom with 200ms ease-out as each phase activates, subtle pulse during processing
- **GO/PASS Decision**: Scale in from 0.8 to 1.0 over 300ms with spring physics, accompanied by success/failure haptic feedback
- **Camera Overlay**: Fade in from 0 to 1 over 150ms, corner brackets draw in from corners over 200ms
- **Tab Switching**: 150ms crossfade between Agent/Manual forms
- **Bottom Nav Icons**: Scale 1.0 to 1.15 on tap, color transition 100ms
- **Queue Item Add**: Check mark animation + toast notification
- **Loading States**: Subtle shimmer effect on skeleton screens, rotating spinner for network requests

## Component Selection

**Components**:
- **Tabs**: Shadcn Tabs for Agent/Manual toggle in AI screen topbar
- **Card**: Shadcn Card for pipeline phase cards, queue items, session stats
- **Input**: Shadcn Input for price, description, search fields with custom styling
- **Button**: Shadcn Button (variant="default" for primary actions, variant="ghost" for nav icons)
- **ScrollArea**: Shadcn ScrollArea for AI pipeline panel and queue list
- **Dialog**: Shadcn Dialog for camera overlay (fullscreen variant)
- **Badge**: Shadcn Badge for session status, profit indicators, item counts
- **Progress**: Shadcn Progress for pipeline phase completion
- **Toast**: Sonner for action confirmations and error messages
- **Separator**: Shadcn Separator for visual section breaks

**Customizations**:
- Custom camera viewfinder component with live video stream, corner bracket SVG overlays, and capture logic
- Custom bottom nav bar with 4-button layout + centered floating action button
- Custom pipeline phase card with animated state indicators and collapsible details
- Custom decision signal component with large GO/PASS typography and color-coded backgrounds

**States**:
- Buttons: default (--b1 bg) → hover (--b2 bg, scale 1.02) → active (--b2 bg, scale 0.98) → disabled (--s2 bg, --s3 fg)
- Inputs: default (--s2 border) → focus (--b1 border, --b1 ring) → error (--red border) → filled (--t4 bg)
- Nav Icons: inactive (--s3 fg) → active (--b1 fg, --t4 bg circle) → hover (--s4 fg)
- Camera Button: default (--b1 bg, white fg, shadow-lg) → hover (scale 1.08) → active (scale 0.95, --b2 bg)

**Icon Selection**:
- Session: ChartBar (analytics focus)
- AI Center: Sparkles (AI intelligence)
- Queue: Stack (item collection)
- Settings: Gear (configuration)
- Camera: Camera (obvious affordance)
- Voice: Microphone (speech input)
- Search: MagnifyingGlass (Google Lens)
- Agent: Robot (AI assistant)
- Manual: PencilSimple (user input)
- GO Decision: CheckCircle (success)
- PASS Decision: XCircle (rejection)
- Add to Queue: Plus (addition)
- Edit Photo: PencilLine (modification)
- Maps: MapPin (location)

**Spacing**:
- Screen Padding: px-4 (16px horizontal)
- Section Gap: gap-4 (16px vertical between major sections)
- Card Padding: p-4 (16px internal)
- Input Padding: px-3 py-2 (12px h, 8px v)
- Button Padding: px-4 py-2 for default, px-6 py-3 for large
- Bottom Nav Height: h-16 (64px)
- Topbar Height: h-14 (56px)
- Camera Button: w-14 h-14 (56px circle)
- Icon Sizes: 20px for nav, 18px for buttons, 16px for inputs

**Mobile**:
- Max Width: 480px enforced at root container level (mx-auto)
- Touch Targets: Minimum 44px tap area for all interactive elements
- Safe Areas: pb-safe for bottom nav to respect iPhone home indicator
- Orientation Lock: Portrait preferred, landscape functional for camera
- Scroll Behavior: Smooth momentum scrolling, scroll-padding-top to account for sticky header
- Pull-to-Refresh: Native browser behavior allowed on Session and Queue screens
