# Runbook v1 - Segment Website

## Overview
This runbook provides operational procedures for maintaining and troubleshooting the Segment Demo Website.

## Daily Operations

### Monitoring
1. Check Segment Debugger for event flow
2. Monitor GA4 Realtime dashboard
3. Review error logs in browser console
4. Validate consent banner display

### Health Checks
- [ ] Website loads in <2 seconds
- [ ] All navigation links work
- [ ] Segment snippet loads without errors
- [ ] Events appear in Debugger within 3 seconds

## Adding New Events

### Process
1. Update Tracking Plan v1 with new event specification
2. Add event firing function in script.js
3. Update QA Validation Matrix
4. Test in debug tools
5. Validate in Segment Debugger and GA4

### Code Example
```javascript
function fireNewEvent(param) {
  analytics.track('new_event', {
    property: param,
    ...getConsentProps()
  });
  console.log('[Segment] new_event');
}
```

## Troubleshooting

### Events Not Appearing in Debugger
**Symptoms:** Events fire in console but not visible in Segment
**Solutions:**
1. Check WRITE_KEY is correct
2. Verify Segment snippet loaded (no console errors)
3. Check ad-blocker not blocking segment.com
4. Confirm event properties are valid JSON

### GA4 Not Receiving Events
**Symptoms:** Events in Debugger but not in GA4 Realtime
**Solutions:**
1. Verify GA4 destination enabled in Segment
2. Check Measurement ID is correct
3. Wait up to 3 minutes for GA4 processing
4. Confirm mappings are set up correctly

### Consent Issues
**Symptoms:** consent_marketing not attached to events
**Solutions:**
1. Check localStorage.consent_marketing value
2. Verify getConsentProps() called in event functions
3. Test consent toggle functionality

### Identity Problems
**Symptoms:** User not stitching anonymous to known
**Solutions:**
1. Confirm identify() called with userId
2. Check userId format (consistent across sessions)
3. Verify localStorage persistence

## Configuration

### Environment Variables
- SEGMENT_WRITE_KEY: wcQ0XOz2GgLkbOdcr5Lq0RfbbzTa1kyJ
- GA4_MEASUREMENT_ID: Configured in Segment destination

### Dependencies
- Segment Analytics.js v5.2.0
- No external CSS/JS frameworks
- Vanilla HTML/JavaScript

## Deployment

### Local Development
```bash
# Open index.html in browser
start index.html
```

### Production Deployment
1. Upload all .html, .css, .js files to hosting
2. Test all pages load correctly
3. Verify Segment events fire
4. Check GA4 integration

### Hosting Options
- Netlify (recommended)
- Vercel
- GitHub Pages
- Any static hosting

## Governance Rules

### Event Naming
- Use verb_object format (e.g., product_viewed)
- Keep names stable across versions
- Document all changes in Tracking Plan

### Property Standards
- snake_case for property names
- Strict typing (string, number, boolean)
- No PII except in identify traits
- consent_marketing on all track/page calls

### Code Quality
- Console.log all events for debugging
- Validate properties before firing
- Handle errors gracefully
- Comment complex logic

## Emergency Procedures

### Complete Outage
1. Check hosting provider status
2. Verify domain DNS
3. Test local files directly
4. Contact hosting support if needed

### Data Issues
1. Pause Segment destination if corrupted data
2. Clear localStorage to reset state
3. Re-identify users if needed
4. Update Tracking Plan for fixes

## Version History

### v1.0 (Current)
- Initial implementation
- All core events implemented
- GA4 integration complete
- Debug tools available

## Support Contacts

- Analytics Team: analytics@demostore.com
- Development Team: dev@demostore.com
- Segment Support: https://segment.com/support
- GA4 Support: https://support.google.com/analytics
