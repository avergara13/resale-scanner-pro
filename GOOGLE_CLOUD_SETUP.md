# Google Cloud API Setup Guide

This guide walks you through setting up Google Cloud APIs for real-time product matching in Resale Scanner.

## What You'll Get

With Google Cloud APIs configured, your app will be able to:

- 🔍 **Visual Product Matching**: Identify products from photos using Google Vision API
- 🛍️ **Price Discovery**: Find similar items across the web with Custom Search
- 📍 **Local Intelligence**: Discover nearby thrift stores with Maps & Places APIs
- ✅ **Confidence Scores**: Get reliability ratings on product identifications

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Name it: `resale-scanner` (or your choice)
5. Click **"Create"**

### 2. Enable Required APIs

With your project selected:

1. Go to **APIs & Services** → **Library**
2. Search for and enable each of these:
   - **Cloud Vision API** (required for product identification)
   - **Custom Search API** (optional, for enhanced results)
   - **Maps JavaScript API** (optional, for store finder)
   - **Places API** (optional, for location intelligence)

**Tip**: You can enable them all at once by searching "vision", clicking enable, then using the back button to continue enabling others.

### 3. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"API Key"**
3. Your key will be generated (starts with `AIzaSy...`)
4. **Important**: Click **"Restrict Key"** for security

### 4. Restrict API Key (Recommended)

For security, restrict your key to only the APIs you're using:

1. Under **API restrictions**, select **"Restrict key"**
2. Check the boxes for:
   - Cloud Vision API
   - Custom Search API (if you enabled it)
   - Maps JavaScript API (if you enabled it)
   - Places API (if you enabled it)
3. Click **"Save"**

### 5. Set Up Billing (Required)

Google Cloud APIs require billing to be enabled, but they offer generous free tiers:

1. Go to **Billing** in the left sidebar
2. Link a billing account (credit card required)
3. **Free tier limits**:
   - Vision API: 1,000 requests/month free
   - Custom Search: 100 queries/day free
   - Maps: $200 credit/month

**Note**: You won't be charged unless you exceed free tier limits. Set up billing alerts to stay safe.

### 6. Add Key to Resale Scanner

1. Open Resale Scanner app
2. Go to **Settings** (bottom navigation)
3. Open **"Google Cloud APIs"** section
4. Paste your API key (starts with `AIzaSy...`)
5. Look for green checkmark: "Key configured - Google Lens enabled"

## Optional: Custom Search Engine ID

For enhanced visual search results, you can also set up a Custom Search Engine:

### Setup Steps

1. Go to [programmablesearchengine.google.com](https://programmablesearchengine.google.com)
2. Click **"Get started"** or **"Add"**
3. Configure:
   - Name: `Resale Scanner Product Search`
   - What to search: **"Search the entire web"**
   - Image search: **ON**
4. Click **"Create"**
5. Copy your **Search Engine ID**
6. Paste it into Resale Scanner → Settings → Google Cloud APIs → "Custom Search Engine ID"

## Pricing Guide

### Vision API (Product Identification)
- **Free tier**: First 1,000 requests/month
- **After free tier**: $1.50 per 1,000 images
- **Typical usage**: 100-300 scans/day = ~$5-15/month

### Custom Search API (Visual Matching)
- **Free tier**: 100 queries/day
- **After free tier**: $5 per 1,000 queries
- **Typical usage**: Free tier usually sufficient

### Maps & Places APIs
- **Free tier**: $200 credit/month (covers ~28,000 map loads)
- **Typical usage**: Usually stays within free tier

## Troubleshooting

### "API key not valid" Error

**Solution**: Make sure you've:
1. Enabled the Vision API in your project
2. Added the API key correctly (no extra spaces)
3. Restricted the key to include Vision API

### "Billing must be enabled" Error

**Solution**: 
1. Go to Billing in Google Cloud Console
2. Link a billing account
3. Wait 5-10 minutes for billing to activate

### "Quota exceeded" Error

**Solution**: You've hit the free tier limit. Either:
1. Wait until next day/month for quota reset
2. Upgrade to paid tier in Google Cloud Console

### Vision API Returns No Results

**Solution**:
1. Check that photo is clear and well-lit
2. Ensure product is centered in frame
3. Try taking photo from different angle

## Security Best Practices

✅ **Do**:
- Restrict API key to specific APIs
- Set up billing alerts
- Rotate keys periodically
- Keep keys private (never commit to public repos)

❌ **Don't**:
- Share API keys publicly
- Use same key across multiple projects
- Leave unrestricted keys active

## Support

- **Google Cloud Support**: [cloud.google.com/support](https://cloud.google.com/support)
- **Vision API Docs**: [cloud.google.com/vision/docs](https://cloud.google.com/vision/docs)
- **Custom Search Docs**: [developers.google.com/custom-search](https://developers.google.com/custom-search)

## Next Steps

Once configured, test your setup:

1. Go to AI screen in Resale Scanner
2. Tap camera button
3. Take photo of a product
4. Watch the pipeline - Phase 2 (Google Lens) should show real results
5. Check for price ranges and product matches

**Happy scanning!** 🎯
