# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

## [0.1.0.0] - 2026-06-23

### Added
- Dynamic theme forcing support ([theme-forcer.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/theme-forcer.tsx)) and styles ([globals.css](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/app/globals.css)) to lock dark theme in kitchen screens and light theme in cashier viewports.
- Tactile haptic vibration feedback for cart adjustments and payment submissions ([cashier-payment-panel.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/cashier-payment-panel.tsx), [admin-order-entry.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/admin-order-entry.tsx)).
- Mobile-friendly swipe-to-delete item gesture controls in cart lists using Framer Motion ([admin-order-entry.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/admin-order-entry.tsx)).
- Client hydration checks to secure Zustand persistent stores against SSR mismatch issues ([optimistic-money.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/optimistic-money.tsx), [optimistic-order-status-badge.tsx](file:///c:/Users/coban/OneDrive/Masaüstü/POS%20SİSTEM/src/components/optimistic-order-status-badge.tsx)).

### Removed
- Dead code files and experimental layouts (`mobile-order-flow-entry.tsx`).
