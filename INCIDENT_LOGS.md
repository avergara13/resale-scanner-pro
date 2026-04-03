# API Incident Logs & Monitoring

## Overview

The Resale Scanner app includes comprehensive API monitoring and incident tracking capabilities to help diagnose connection issues with external services (Gemini AI, Google Lens, eBay API).

## Features

### 1. Real-Time Connection Health Monitoring
- **Location**: Settings > Connection Health
- **Functionality**: 
  - Monitors all API connections every 30 seconds
  - Displays current status: Healthy, Degraded, Offline, or Checking
  - Shows latency metrics for each service
  - Visual indicators with color-coded status badges

### 2. Connection History & Downtime Tracking
- **Location**: Settings > Connection History & Downtime Tracking
- **Functionality**:
  - Tracks all connection events over the last 30 days
  - Displays uptime percentage per service (24-hour rolling window)
  - Shows active and resolved incidents
  - Provides detailed incident timeline
  - Calculates average uptime across all services

### 3. Incident Log Viewer
- **Location**: Settings > Incident Logs & API Issues
- **Functionality**:
  - Comprehensive incident review interface
  - Filter incidents by:
    - Service (All, Gemini AI, Google Lens, eBay API)
    - Status (All, Active, Resolved)
  - Toggle between Incidents view and Events log
  - Export logs to JSON for external analysis
  - Severity classification:
    - **Critical**: Downtime > 1 hour
    - **High**: Downtime > 30 minutes
    - **Medium**: Downtime > 10 minutes
    - **Low**: Downtime < 10 minutes

## Understanding the Data

### Connection Events
Every time a service changes status (healthy ↔ degraded ↔ offline), an event is recorded with:
- Timestamp
- Service name
- Previous status
- New status
- Latency (if available)
- Error message (if applicable)

### Downtime Incidents
When a service goes offline, an incident is created that tracks:
- Start time
- End time (when resolved)
- Total duration
- Service affected
- Error details
- Resolution status

### Statistics
The system calculates:
- **Average Uptime**: Percentage of time services are operational (24h window)
- **Incident Count**: Total number of incidents in the last 24 hours
- **Per-Service Uptime**: Individual uptime metrics for each API
- **Most Unreliable Service**: Service with the highest incident count

## Common Issues & Troubleshooting

### Issue: "API key not configured"
**Solution**: Navigate to Settings > AI Configuration (or respective section) and enter valid API credentials.

### Issue: "HTTP 401" or "Invalid credentials"
**Solution**: Verify your API keys are correct and have not expired. Some services require specific permissions or billing to be enabled.

### Issue: High latency (degraded status)
**Cause**: Network congestion, API rate limiting, or service load
**Action**: Wait for service to stabilize. Consider reducing request frequency in high-traffic periods.

### Issue: Repeated offline status
**Cause**: Network connectivity, expired credentials, or service outage
**Action**: 
1. Check your internet connection
2. Verify API keys are still valid
3. Check service status pages (e.g., Google Cloud Status, eBay Developer Status)
4. Review error messages in incident logs for specific error codes

## Data Retention

- **Events**: Last 1,000 events or 30 days (whichever is reached first)
- **Incidents**: All incidents from the last 30 days
- **Auto-cleanup**: Runs automatically to prevent excessive storage use

## Exporting Logs

Click the "Export" button in the Incident Log Viewer to download a JSON file containing:
- Export timestamp
- Current statistics
- Filtered incidents
- Recent events

This file can be shared with support teams or analyzed with external tools.

## Integration with Workflow

The connection health monitoring system:
1. Automatically checks API health every 30 seconds
2. Sends toast notifications when:
   - Connection is lost (offline)
   - Connection is restored (back to healthy)
   - Connection degrades (high latency detected)
3. Records all status changes for historical analysis
4. Helps identify patterns in API reliability

## Best Practices

1. **Regular Monitoring**: Check the Connection Health panel daily when actively using the app
2. **Incident Review**: Review incident logs weekly to identify patterns
3. **Export Critical Incidents**: Export logs when experiencing persistent issues for support documentation
4. **Configure All APIs**: Ensure all API keys are configured to enable full monitoring
5. **Act on Trends**: If a service shows low uptime, consider investigating API quota limits or upgrading service tiers

## Technical Details

### Health Check Implementation
- **Gemini AI**: Checks `/v1beta/models` endpoint
- **Google Lens**: Tests Custom Search API with minimal query
- **eBay**: Validates Finding API with single keyword search

### Latency Thresholds
- **Healthy**: < 1000ms (Gemini), < 2000ms (Google Lens, eBay)
- **Degraded**: Above healthy threshold but still responsive
- **Offline**: No response or error status

### Data Storage
All monitoring data is stored locally using the Spark KV storage API:
- `connection-events`: Array of connection events
- `downtime-incidents`: Array of incident records

Data persists across sessions and is synchronized automatically.
