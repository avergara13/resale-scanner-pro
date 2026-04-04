# Network Retry System

## Overview

This application now includes a robust retry system for all network requests to external APIs (Gemini, Google Lens, Google Vision, eBay, Notion). The retry logic automatically handles transient failures, network issues, and rate limiting with exponential backoff.

## Features

### Automatic Retry on Failure
- **Failed network requests are automatically retried** up to 3 times by default
- **Exponential backoff** with jitter prevents overwhelming servers
- **Configurable retry behavior** per service

### Smart Error Detection
Automatically retries on:
- Network failures (connection errors, timeouts)
- Temporary server errors (500, 502, 503, 504)
- Rate limiting (429 Too Many Requests)
- Request timeouts (408)
- Aborted requests

### Progressive Delay
- Initial delay: 1 second
- Exponential multiplier: 2x per retry
- Random jitter added to prevent thundering herd
- Maximum delay: 10 seconds

## Implementation

### Core Services Updated

All major API services now use retry logic:

1. **Gemini Service** (`gemini-service.ts`)
   - Product image analysis: 3 retries, 45s timeout
   - Background removal: 2 retries, 30s timeout
   - Chat responses: 3 retries, 30s timeout
   - Listing generation: 3 retries, 40s timeout

2. **Google Lens Service** (`google-lens-service.ts`)
   - Vision API: 3 retries, 30s timeout
   - Custom Search: 3 retries, 30s timeout

3. **Notion Service** (`notion-service.ts`)
   - Push listings: 2 retries, 25s timeout

4. **eBay Service** (`ebay-service.ts`)
   - Already has graceful fallbacks for CORS errors
   - Returns empty results instead of failing

### Retry Configuration

Each service is configured with optimal settings:

```typescript
{
  maxRetries: 3,           // Number of retry attempts
  initialDelay: 1000,      // Starting delay (1 second)
  maxDelay: 10000,         // Maximum delay (10 seconds)
  backoffMultiplier: 2,    // Exponential growth factor
  timeout: 30000,          // Request timeout (30 seconds)
  onRetry: (error, attempt, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms`)
  }
}
```

### Retry Presets

Three pre-configured retry strategies are available:

1. **defaultRetry** - Standard retry (3 attempts, 1s initial delay)
2. **aggressiveRetry** - More persistent (5 attempts, 500ms initial delay)
3. **conservativeRetry** - Gentler approach (2 attempts, 2s initial delay)

## User Benefits

### Improved Reliability
- **Fewer failures** due to temporary network issues
- **Automatic recovery** from transient errors
- **Better success rates** when scanning items

### Better User Experience
- **Seamless retry** happens in the background
- **No manual refresh** needed for temporary failures
- **Clearer error messages** when all retries are exhausted

### Field Resilience
- **Works in spotty connectivity** (thrift stores, warehouses)
- **Handles intermittent Wi-Fi** drops automatically
- **Tolerates API rate limits** with smart backoff

## Monitoring

Retry attempts are logged to the console for debugging:

```
Gemini API retry attempt 1 after 1000ms: Network request failed
Gemini API retry attempt 2 after 2100ms: Network request failed
Google Vision API retry attempt 1 after 1050ms: Timeout exceeded
```

## Error Handling

When all retries are exhausted:
- Original error is thrown with full context
- Error includes status code if available
- User sees helpful error message in UI
- Session data is preserved

## Technical Details

### Exponential Backoff Formula

```
delay = min(initialDelay * (backoffMultiplier ^ attempt) + jitter, maxDelay)
```

Example delays with default settings:
- Attempt 1: ~1000ms
- Attempt 2: ~2100ms
- Attempt 3: ~4200ms

### Jitter Calculation

Random jitter (0-10% of delay) prevents multiple clients from retrying simultaneously.

### Timeout Handling

Each retry gets the full timeout duration. AbortController is used to enforce timeouts and allow cleanup.

## Future Enhancements

Potential improvements for consideration:
- [ ] Retry metrics dashboard in Settings
- [ ] User-configurable retry settings
- [ ] Circuit breaker pattern for repeated failures
- [ ] Offline queue for requests when network unavailable
- [ ] Exponential backoff visualization in UI
- [ ] Success/failure rate tracking per API

## Testing

To test retry behavior:
1. Disable network in browser DevTools
2. Initiate an API call (e.g., scan an item)
3. Re-enable network after 2 seconds
4. Watch request automatically succeed on retry

## Notes

- The retry system is transparent to users
- No changes needed to existing component code
- All retry logic is centralized in `retry-service.ts`
- Services were updated to use `retryFetch` instead of raw `fetch`
- Error messages remain clear and actionable
