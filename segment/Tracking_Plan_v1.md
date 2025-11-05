# Tracking Plan v1 - Segment Website

## Overview
This tracking plan outlines the analytics implementation for the Store website, built to demonstrate Segment's capabilities with GA4 integration.

## Events

### 1. page
**Description:** Tracks page views across the site
**Type:** Automatic (via Segment page call)
**Properties:**
- page_category (string): home, list, pdp, cart, checkout, success, login, privacy, debug
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** Analytics Team

### 2. product_viewed
**Description:** Fired when a user views a product detail page
**Type:** Track
**Properties:**
- product_id (string)
- product_name (string)
- product_brand (string): "Brand"
- product_category (string): "Clothing", "Accessories"
- product_price (number)
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** Product Team

### 3. add_to_cart
**Description:** Fired when a user adds an item to their cart
**Type:** Track
**Properties:**
- product_id (string)
- product_name (string)
- product_brand (string): "Brand"
- product_category (string): "Clothing", "Accessories"
- product_price (number)
- qty (number)
- line_total (number)
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** E-commerce Team

### 4. remove_from_cart
**Description:** Fired when a user removes an item from their cart
**Type:** Track
**Properties:**
- product_id (string)
- qty (number)
- line_total (number)
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** E-commerce Team

### 5. signup_started
**Description:** Fired when a user begins the signup/login process
**Type:** Track
**Properties:**
- source (string): "web"
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** Marketing Team

### 6. identify
**Description:** Identifies a user with traits
**Type:** Identify
**Properties (Traits):**
- email (string)
- plan (string): "trial", "pro"
**Consent required:** No (required for user identification)
**Owner:** User Management Team

### 7. checkout_started
**Description:** Fired when a user begins the checkout process
**Type:** Track
**Properties:**
- cart_value (number)
- num_items (number)
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** E-commerce Team

### 8. order_completed
**Description:** Fired when a user completes a purchase
**Type:** Track
**Properties:**
- order_id (string)
- checkout_id (string)
- num_items (number)
- total (number)
- revenue (number)
- shipping (number): 0
- tax (number): 0
- affiliation (string): "Store"
- products (array of objects):
  - product_id (string)
  - name (string)
  - brand (string)
  - category (string)
  - price (number)
  - quantity (number)
- consent_marketing (boolean)
**Consent required:** Yes
**Owner:** E-commerce Team

## Data Governance

### Naming Convention
- Events: verb_object (e.g., product_viewed, add_to_cart)
- Properties: snake_case (e.g., product_id, consent_marketing)
- Types: Strict typing (string, number, boolean, array)

### Consent Management
- consent_marketing attached to all Track and Page calls
- Stored in localStorage
- Banner shown on first visit
- Can be toggled via UI

### Identity Stitching
- Anonymous users tracked via anonymousId
- Known users identified with userId (email prefix)
- Persisted across sessions via localStorage

## Destinations

### Google Analytics 4
- Track events: All track calls
- Page views: All page calls
- User properties: email, plan from identify calls

### Additional Destinations (Optional)
- Webhook.site for payload inspection
- Amplitude for advanced analytics

## Validation

### QA Matrix
- Source emits (Debugger): <3s delay
- Destination receives (GA4 Realtime): <3min delay
- Schema validation: All required properties present
- Identity: Anonymous → Known stitching
- Consent: Flag present in all payloads

## Implementation Notes

- All numbers are JavaScript numbers (not strings)
- No PII in event properties except identify traits
- Events fire on user interactions and page loads
- Debug tools available at /debug for testing
