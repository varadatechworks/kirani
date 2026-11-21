# Kirani UI foundation

## Included preview surfaces

- Responsive admin workspace with navigation, cycle overview, KPI cards, order movement chart, operational readiness and attention queue.
- Customer mobile-first experience with monthly basket, category discovery, sample products and mobile navigation.
- Farmer workspace with profile entry points, procurement, payment summary and seasonal availability review.
- Responsive layouts and installable-web-app manifest.

## Running locally

Run `npm install` then `npm start`, and open `http://localhost:3000`. The server serves the UI at `/` and the manifest at `/manifest.webmanifest`.

## Important implementation boundary

The current UI is a front-end preview using illustrative sample data. Buttons demonstrate navigation and feedback only. It does not create real cycles, orders, farmer listings, payments, approvals or inventory records. Do not use the preview as a production operations console.

The current API foundation still needs database-backed repositories, authentication/session middleware, authorization enforcement, validated domain endpoints, audit persistence, integration tests and end-to-end tests before live workflows can be enabled. The manifest makes the responsive web experience PWA-installable in supporting browsers; it is not a native Android/iOS binary.

## Design direction

Warm ivory canvas, deep botanical green, soft leaf accents, restrained gold highlights, clear status chips, compact data tables, responsive cards and a shared visual language across operator, farmer and customer journeys.
