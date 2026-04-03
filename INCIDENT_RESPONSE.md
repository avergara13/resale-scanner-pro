# Incident Response & Automatic Remediation System

## Overview

The Resale Scanner app now includes a comprehensive incident response system with automatic remediation playbooks. When API failures or service issues occur, the system automatically detects the problem, classifies the incident, and executes predefined playbooks to resolve or mitigate the issue without manual intervention.

## Architecture

### Core Components

1. **Incident Playbook Service** (`/src/lib/incident-playbook-service.ts`)
   - Classifies incidents based on error types and status codes
   - Manages active and historical incidents
   - Executes automated remediation workflows
   - Tracks incident status and resolution

2. **Incident Response Panel** (`/src/components/IncidentResponsePanel.tsx`)
   - User interface for viewing active incidents
   - Historical incident logs
   - Manual playbook testing
   - Real-time status updates

3. **Incident Playbook Viewer** (`/src/components/IncidentPlaybookViewer.tsx`)
   - Visual display of incident details
   - Step-by-step remediation progress
   - Severity indicators and status badges

4. **Incidents Screen** (`/src/components/screens/IncidentsScreen.tsx`)
   - Full-screen interface accessible via navigation
   - Integrates all incident management features

## Supported Incident Types

### 1. API Timeout (`api_timeout`)
**Severity:** Medium | **Auto-Remediate:** Yes

**Scenario:** API requests exceed timeout threshold

**Remediation Steps:**
1. Retry request with exponential backoff (3 attempts)
2. Switch to fallback endpoint if configured
3. Load cached data if available
4. Notify user of timeout and fallback mode

### 2. Rate Limit Exceeded (`api_rate_limit`)
**Severity:** High | **Auto-Remediate:** Yes

**Scenario:** API provider returns 429 status code

**Remediation Steps:**
1. Parse rate limit headers to determine reset time
2. Queue request for delayed retry
3. Switch to backup API provider if configured
4. Display estimated wait time to user

### 3. Authentication Failed (`api_unauthorized`)
**Severity:** Critical | **Auto-Remediate:** Partial

**Scenario:** API returns 401/403 unauthorized

**Remediation Steps:**
1. Validate API key configuration
2. Attempt token refresh if supported
3. Prompt user to reconfigure credentials (manual)
4. Temporarily disable failing service

### 4. Server Error (`api_server_error`)
**Severity:** High | **Auto-Remediate:** Yes

**Scenario:** API returns 500-series errors

**Remediation Steps:**
1. Log error details for debugging
2. Wait 5 seconds before retry
3. Fall back to alternative service or cached data
4. Display service degradation notice

### 5. Network Offline (`network_offline`)
**Severity:** Critical | **Auto-Remediate:** Yes

**Scenario:** Complete network connectivity loss

**Remediation Steps:**
1. Enable offline mode (local-only features)
2. Save all pending work to local storage
3. Start connectivity polling (every 5 seconds)
4. Display persistent offline banner

### 6. Gemini Quota Exceeded (`gemini_quota_exceeded`)
**Severity:** High | **Auto-Remediate:** Yes

**Scenario:** Google Gemini API quota exhausted

**Remediation Steps:**
1. Check if Anthropic Claude API is configured
2. Automatically switch to Claude as primary AI
3. Update user preferences
4. Notify user of AI provider switch

### 7. eBay Auth Failed (`ebay_auth_failed`)
**Severity:** High | **Auto-Remediate:** Partial

**Scenario:** eBay API authentication issues

**Remediation Steps:**
1. Verify all eBay credentials (App ID, Dev ID, Cert ID)
2. Test token validity
3. Direct user to eBay Developer Portal (manual)
4. Enable estimate mode (4.5x multiplier without eBay data)

### 8. Google Lens Unavailable (`google_lens_unavailable`)
**Severity:** Medium | **Auto-Remediate:** Yes

**Scenario:** Google Lens/Custom Search API failure

**Remediation Steps:**
1. Verify Google API key configuration
2. Skip visual search, rely on Gemini vision only
3. Offer manual product name search
4. Log incident for troubleshooting

### 9. Connection Degraded (`connection_degraded`)
**Severity:** Low | **Auto-Remediate:** Yes

**Scenario:** Slow network or degraded API performance

**Remediation Steps:**
1. Reduce image quality (75% compression)
2. Disable live search features temporarily
3. Extend API timeout thresholds to 45 seconds
4. Display performance tips banner

### 10. Service Offline (`service_offline`)
**Severity:** Critical | **Auto-Remediate:** Yes

**Scenario:** Complete service outage detected

**Remediation Steps:**
1. Mark service as unavailable
2. Serve all responses from cache
3. Schedule retry in 5 minutes
4. Display outage notice to user

## Usage

### Accessing Incident Management

Navigate to the **Incidents** screen from the Settings panel or via the navigation menu (when implemented).

### Viewing Active Incidents

Active incidents appear in the "Active" tab with:
- Incident title and description
- Severity badge (Low/Medium/High/Critical)
- Real-time remediation progress
- Step-by-step execution details
- Automatic or manual indicators

### Viewing Incident History

The "History" tab shows:
- All past incidents (active and resolved)
- Resolution status and duration
- Detailed step execution logs
- Option to clear history

### Testing Playbooks

The "Playbooks" tab allows manual testing:
- View all available playbooks
- Test remediation steps manually
- Verify automatic remediation logic
- Useful for debugging and validation

## Integration

### Connecting to Existing Error Handling

The incident system integrates with existing try/catch blocks:

```typescript
import { createIncidentPlaybookService } from '@/lib/incident-playbook-service'

const playbookService = createIncidentPlaybookService(settings)

try {
  await geminiService.analyzeImage(imageData)
} catch (error) {
  const incidentType = playbookService.classifyIncident('gemini', error)
  
  if (incidentType) {
    const incident = playbookService.createIncident('gemini', incidentType, {
      imageSize: imageData.length,
      timestamp: Date.now()
    })
    
    await playbookService.executePlaybook(incident.id, (updatedIncident) => {
      // Update UI with progress
      console.log(updatedIncident.currentStepIndex)
    })
  }
}
```

### Automatic Classification

The `classifyIncident` method automatically detects:
- HTTP status codes (401, 403, 429, 500-599)
- Error messages (timeout, quota, offline, etc.)
- Network connectivity status
- Service-specific failure patterns

### Manual Incident Creation

For testing or manual intervention:

```typescript
const incident = playbookService.createIncident(
  'gemini',
  'api_timeout',
  { triggeredManually: true }
)

await playbookService.executePlaybook(incident.id)
```

## Data Persistence

### Active Incidents
Stored in: `useKV('active-incidents', [])`

Active incidents are persisted to survive page refreshes and continue remediation workflows across sessions.

### Incident History
Stored in: `useKV('incident-history', [])`

Historical incidents provide insights into:
- API reliability patterns
- Most common failure types
- Average resolution times
- Service health trends

## Future Enhancements

### Planned Features
1. **Incident Analytics Dashboard**
   - Uptime percentage by service
   - Mean time to recovery (MTTR)
   - Incident frequency charts
   - Cost impact analysis

2. **Custom Playbooks**
   - User-defined remediation steps
   - Conditional branching logic
   - Webhook integrations
   - Email/SMS notifications

3. **Machine Learning Integration**
   - Predict incidents before they occur
   - Optimize remediation strategies
   - Auto-tune API timeouts
   - Intelligent fallback selection

4. **Multi-Tenant Support**
   - Team-wide incident visibility
   - Shared playbook libraries
   - Role-based access control
   - Collaborative incident resolution

## Best Practices

1. **Configure Backup Services**
   - Set up Anthropic API for Gemini fallback
   - Configure multiple eBay credentials if possible
   - Enable caching for all API responses

2. **Monitor Incident Frequency**
   - Review incident history weekly
   - Identify recurring patterns
   - Address root causes proactively

3. **Test Playbooks Regularly**
   - Use the Playbooks tab to test scenarios
   - Verify automatic remediation works as expected
   - Update steps based on real-world results

4. **Keep API Keys Current**
   - Rotate keys before expiration
   - Monitor quota usage
   - Set up alerts for low credit balances

## Troubleshooting

### Incidents Not Auto-Resolving
- Check if `autoRemediate` is enabled for the playbook
- Verify backup services are properly configured
- Review step execution logs for failures

### Playbook Execution Hangs
- Individual steps timeout after 30 seconds
- Check network connectivity
- Review browser console for JavaScript errors

### History Growing Too Large
- Use the "Clear History" button regularly
- Or configure auto-cleanup (feature coming soon)

## Support

For issues or feature requests related to incident response:
1. Check the incident logs for detailed error messages
2. Review the remediation step results
3. Test playbooks manually to isolate problems
4. Contact support with incident IDs for assistance
