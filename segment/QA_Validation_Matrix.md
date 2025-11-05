# QA Validation Matrix - Segment Website

## Test Scenarios

### 1. Page View Tracking
**Test:** Navigate through all pages
**Expected:**
- Page event fires on each page load
- page_category matches current page
- consent_marketing attached
**Validation:**
- [ ] Segment Debugger shows page events (<3s)
- [ ] GA4 Realtime shows page_view events (<3min)

### 2. Product Interaction
**Test:** View product details, add to cart
**Expected:**
- product_viewed fires on PDP load
- add_to_cart fires on add to cart action
- All product properties present and correct
**Validation:**
- [ ] Segment Debugger shows events with correct properties
- [ ] GA4 Realtime shows ecommerce events

### 3. Cart Management
**Test:** Add/remove items, change quantities
**Expected:**
- add_to_cart/remove_from_cart fire appropriately
- Quantities and totals calculated correctly
**Validation:**
- [ ] Cart state persists across page refreshes
- [ ] Events show correct line totals

### 4. User Identity
**Test:** Signup/Login, then logout
**Expected:**
- signup_started fires on form submission
- identify call with email/plan traits
- User ID persists, anonymous ID changes
**Validation:**
- [ ] Identity stitching works (anon → known)
- [ ] localStorage maintains login state

### 5. Checkout Flow
**Test:** Complete full purchase flow
**Expected:**
- checkout_started fires on checkout load
- order_completed fires on purchase completion
- All order properties and products array correct
**Validation:**
- [ ] Order ID and checkout ID generated
- [ ] Revenue matches cart total

### 6. Consent Management
**Test:** Toggle consent on/off
**Expected:**
- consent_marketing updates in all events
- Banner shows/hides appropriately
- Preference persists in localStorage
**Validation:**
- [ ] All events include consent flag
- [ ] GA4 receives events based on consent

### 7. Traffic Simulation
**Test:** Run debug traffic simulation
**Expected:**
- Multiple users simulated
- Random carts and purchases generated
- Events fire with proper delays
**Validation:**
- [ ] Segment Debugger shows burst of events
- [ ] GA4 shows increased activity

## Performance Metrics

### Timing
- Segment Debugger: <3 seconds from event fire
- GA4 Realtime: <3 minutes from event fire
- Page load: <2 seconds (no external blockers)

### Data Quality
- Schema violations: 0%
- Missing properties: 0%
- Type mismatches: 0%

### Success Criteria
- [ ] All events fire as expected
- [ ] GA4 receives 95%+ of events
- [ ] Identity stitching works correctly
- [ ] Consent flag present in all payloads
- [ ] No JavaScript errors in console

## Browser Compatibility
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

## Mobile Responsiveness
- [ ] Layout adapts to mobile screens
- [ ] Touch interactions work
- [ ] Consent banner displays correctly

## Edge Cases Tested
- [ ] Refresh page maintains state
- [ ] Navigate back/forward
- [ ] Multiple tabs open
- [ ] Ad-blocker enabled
- [ ] JavaScript disabled (graceful degradation)
