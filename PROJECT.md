# Project: Daily Operations Improvements — November 13, 2026

## Architecture
- **Backend API**: ASP.NET Core (.NET 10 LTS, C# 14) in `LechonSystem.Api/`
  - Routes in `LogisticsController.cs`:
    - `POST /api/logistics/settlements/orders/{orderId}/verify-digital` (Owner Hop 2 digital verification)
    - `GET /api/logistics/downpayments` (DP & Walk-In Tracker)
    - `POST /api/logistics/downpayments/{orderId}/verify` (Toggle DP remittance to Owner)
  - Data Seeding in `LechonSystem.Api/Data/SeedQaData_20261113.sql`
- **Web Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 in `lechon-system-web/`
  - Manifest & Settlement: `ManifestPage.tsx`, `PickupSettlementTab.tsx`, `DownpaymentTrackerTab.tsx`, `useManifest.ts`
  - Order Intake & Edit: `OrderForm.tsx`, `EditOrderForm.tsx`, `similarityHelper.ts`
- **Mobile Frontend**: React Native + Expo + TypeScript in `lechon-system-mobile/`
  - Drawer & Settlement: `DrawerScreen.tsx`, `useManifest.ts`
  - Order Intake & Edit: `PosScreen.tsx`, `EditOrderModal.tsx`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Working Tree & Backend Audit | Preserve working tree changes, verify LogisticsController, LogisticsService, and DTOs | M1 | Survey |
| 2 | R6: Non-Destructive QA Seeding | Idempotent upsert of #111326-901, #111326-902, #111326-903 preserving all existing orders | M1 | Survey |
| 3 | R2: Web Store Pickup Digital & Owner Hop 2 | Blue badge `🏦 Awaiting Digital Check`, pending amount display, `[ 👑 Verify Digital Deposit ]` direct mutation, KPI card filter | M2 | Survey |
| 4 | R3: Web Past-Date / Wrong-Year Warning | Amber/red banner, `[ 📅 Fix Year to 2026 ]`, `[ 📅 Set to Today ]`, `window.confirm` guard, TS error fixes | M2 | Survey |
| 5 | R4: Web Shared-Phone POS Radar | Amber `ℹ️ SHARED PHONE NUMBER ON THIS DATE` notice for shared phone on different customer names | M2 | Survey |
| 6 | R5: Web DP & Walk-In Remittance Tracker | 4th stream tab `💵 DP & Walk-In Tracker`, filter pills, summary strip, table, mark remitted button | M2 | Survey |
| 7 | R2: Mobile Store Pickup Digital & Owner Hop 2 | Blue badge, pending amount, direct `VerifyDigitalSettlementAsync` button, KPI card filter, drawer handover visibility | M3 | Survey |
| 8 | R3: Mobile Past-Date / Wrong-Year Warning | Past date banner, 1-tap year fix, set to today, `Alert.alert` guard | M3 | Survey |
| 9 | R4: Mobile Shared-Phone POS Radar | Add amber notice to `EditOrderModal.tsx` to match `PosScreen.tsx` | M3 | Survey |
| 10 | R5: Mobile DP & Walk-In Remittance Tracker | Tab 4, filter pills, summary cards, card list, action buttons, fix `&amp;` text bugs | M3 | Survey |
| 11 | R7: Quality Gates & Verification | `dotnet build` (0 warnings, 0 errors), web build (0 errors), mobile tsc/lint (0 errors), tests pass | M4 | Survey |
| 12 | R7: Documentation Alignment | Update `MASTER_ALIGNMENT.md`, `ARCHITECTURE_MAP.md`, `GEMINI.md` | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database QA Seeding & Backend Persistence | Deploy `SeedQaData_20261113.sql` non-destructively, verify #111326-901/902/903 in DB, verify backend API readiness | none | DONE |
| M2 | Web UI Integration & TS Fixes | Fix TS errors in `OrderForm.tsx`/`EditOrderForm.tsx`, wire `useVerifyDigitalSettlementMutation`, complete R2, R3, R4, R5 on Web, verify web build | M1 | DONE |
| M3 | Mobile UI Integration | Wire `useVerifyDigitalSettlementMutation` in Mobile, complete R2, R4 in `EditOrderModal`, fix `&amp;` in `DrawerScreen`, verify mobile tsc/lint | M1 | DONE |
| M4 | Final Quality Gates, Regression Testing & Documentation | Restart backend on 5199, verify web/mobile builds, run unit tests, update `MASTER_ALIGNMENT.md`, `ARCHITECTURE_MAP.md`, `GEMINI.md` | M2, M3 | DONE |

## Interface Contracts
### Web / Mobile ↔ Backend Logistics API
- `POST /api/logistics/settlements/orders/{orderId}/verify-digital`:
  - Request body: `{}` (or empty), authenticated as Owner
  - Response: `{ success: true, orderId: number, settlementStatus: string, balanceDue: number }`
  - Side effects: creates digital `PaymentLog`, marks order settled, clears digital pending flags, invalidates queries
- `GET /api/logistics/downpayments`:
  - Returns `List<DownpaymentTrackerItemDto>` with fields `OrderId`, `OrderReference`, `CustomerName`, `BookingSource`, `TargetDeliveryTime`, `Downpayment`, `DownpaymentMethod`, `IsDpRemittedToOwner`, `DpRemittedAt`, `DpRemittedBy`, `CreatedBy`
- `POST /api/logistics/downpayments/{orderId}/verify`:
  - Request body: `{ isRemitted: boolean }` (Owner only)
  - Returns updated `DownpaymentTrackerItemDto`

## Code Layout
- Backend:
  - `LechonSystem.Api/Controllers/LogisticsController.cs`
  - `LechonSystem.Api/Services/LogisticsService.cs`
  - `LechonSystem.Api/DTOs/`
  - `LechonSystem.Api/Data/SeedQaData_20261113.sql`
- Web Frontend:
  - `lechon-system-web/src/pages/ManifestPage.tsx`
  - `lechon-system-web/src/pages/manifest/PickupSettlementTab.tsx`
  - `lechon-system-web/src/pages/manifest/DownpaymentTrackerTab.tsx`
  - `lechon-system-web/src/hooks/useManifest.ts`
  - `lechon-system-web/src/components/ui/orders/OrderForm.tsx`
  - `lechon-system-web/src/components/ui/orders/EditOrderForm.tsx`
  - `lechon-system-web/src/utils/similarityHelper.ts`
- Mobile Frontend:
  - `lechon-system-mobile/src/screens/DrawerScreen.tsx`
  - `lechon-system-mobile/src/screens/PosScreen.tsx`
  - `lechon-system-mobile/src/components/EditOrderModal.tsx`
  - `lechon-system-mobile/src/hooks/useManifest.ts`
- Docs:
  - `docs/MASTER_ALIGNMENT.md`
  - `docs/ARCHITECTURE_MAP.md`
  - `GEMINI.md`
