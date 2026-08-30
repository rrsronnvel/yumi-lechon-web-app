# 📖 GEMINI.md — Lead System Architect Operational Manual
**Project:** Yumi Lechon Management System (Cavite, Philippines)  
**Role:** Lead System Architect & Senior Full-Stack Engineering Agent  
**Operational Scope:** `LechonSystem.Api` (.NET 10 LTS) + `lechon-system-web` (React 19 + TypeScript + Vite)  
**Primary Domain Specification:** [`docs/MASTER_ALIGNMENT.md`](file:///c:/Users/Cholo/Desktop/yumi-lechon-web-app/docs/MASTER_ALIGNMENT.md)

---

## 1. 🏗️ Tech Stack, Protocols & Environment Ports

### Backend (`LechonSystem.Api`)
* **Framework:** .NET 10.0 LTS (ASP.NET Core Web API, C# 14 / nullable enabled)
* **ORM:** Entity Framework Core 10.0.8 (`Microsoft.EntityFrameworkCore.SqlServer`)
* **Database Engine:** Microsoft SQL Server Express / LocalDB
* **API Documentation:** OpenAPI / Swagger (`Swashbuckle.AspNetCore`, `Microsoft.AspNetCore.OpenApi`)
* **Dev Server Port:** `http://localhost:5199` (HTTPS profile: `https://localhost:7252`)
* **CORS Policy:** Allows `http://localhost:5173` with all headers and methods

### Frontend (`lechon-system-web`)
* **Framework:** React 19.1.0 + TypeScript 5.8+ + Vite 6.3+
* **Routing:** React Router v7 (`react-router-dom` 7.17+)
* **Styling & Design System:** Tailwind CSS v4 (`@tailwindcss/vite`, `@tailwindcss/postcss`), Geist font, `tw-animate-css`
* **UI Components:** shadcn/ui + Radix / Base-UI primitives + Lucide React (`lucide-react`)
* **Form & Validation:** React Hook Form (`react-hook-form` 7.79+), Zod (`zod` 4.4+), `@hookform/resolvers`
* **State & Server Cache:** TanStack Query v5 (`@tanstack/react-query` 5.101+)
* **HTTP Client:** Axios 1.18+ (`apiClient.ts` targeting `http://localhost:5199/api`)
* **Notifications:** Sonner (`sonner` 2.0+)
* **Charts & Visualizations:** Recharts 3.9+
* **Dev Server Port:** `http://localhost:5173`

---

## 2. 📁 Workspace Blueprint & Directory Mapping

```
yumi-lechon-web-app/
├── docs/
│   └── MASTER_ALIGNMENT.md          # 🌟 Absolute Source of Truth for business & operational logic
├── GEMINI.md                        # 📖 This Architect Operational Manual
│
├── LechonSystem.Api/                # 🚀 .NET 10 Web API Backend
│   ├── Controllers/                 # Thin HTTP layer & route handlers
│   │   ├── AnalyticsController.cs   # Revenue trends, top-selling sizes, peak sales metrics
│   │   ├── CmsController.cs         # Menu categories, price matrix, cooking clocks
│   │   ├── DashboardController.cs   # Zero-Inbox KPI metrics, rosters & remittance alerts
│   │   ├── InventoryController.cs   # Stock balance scoreboard, ledger logs, manual adjustments
│   │   ├── LogisticsController.cs   # Dispatch planner, live delivery status, rider assignments
│   │   ├── OrdersController.cs      # POS order intake, directory, updates, cancellations, audit logs
│   │   ├── PaymentWebhookController.cs # Payment gateway hooks and external notifications
│   │   ├── ProcurementController.cs # Supplier orders & pig restocking generation
│   │   ├── RoastingController.cs    # Roasting pits, spit tracking & temperature stages
│   │   └── SchedulesController.cs   # Slot capacity & daily roasting schedule endpoints
│   │
│   ├── Services/                    # Core business logic, workflows & calculations
│   │   ├── AnalyticsService.cs      # Sales aggregation & time-series analysis
│   │   ├── CmsService.cs            # Dynamic price history & cooking profile management
│   │   ├── DashboardService.cs      # Aggregates 4-day/1-day reminders & tomorrow's rosters
│   │   ├── InventoryService.cs      # Bank-statement ledger, safety stock & reservations
│   │   ├── LogisticsService.cs      # Driver assignment, delivery dispatch & manifests
│   │   ├── OrderService.cs          # Order lifecycle, price snapshotting, audit diffing
│   │   ├── PaymentService.cs        # Idempotent GCash & cash reconciliation tracking
│   │   ├── ProcurementService.cs    # Restock calculation & supplier SMS generator
│   │   ├── RoastingService.cs       # Pit/spit state management
│   │   ├── SchedulingService.cs     # Dynamic backward-scheduling engine (Tahi -> Salang)
│   │   ├── SmsNotificationService.cs# Dispatches SMS alerts for customer status changes
│   │   ├── ILogisticsService.cs     # Interface for Logistics operations
│   │   └── IProcurementService.cs   # Interface for Procurement operations
│   │
│   ├── Data/
│   │   └── LechonDbContext.cs       # EF Core DB context, relationship mappings & seed data
│   │
│   ├── Models/                      # Domain entities & database models
│   │   ├── BaseEntity.cs            # Id and CreatedAt baseline
│   │   ├── Order.cs                 # Master order entity (customer, totals, statuses)
│   │   ├── OrderItem.cs             # Line items with locked Price snapshots
│   │   ├── OrderItemSchedule.cs     # Calculated Tahi, Salang, Packaging, and Delivery timestamps
│   │   ├── OrderAuditLog.cs         # Immutable "Black Box" diff history of modifications
│   │   ├── PaymentLog.cs            # Financial record of logged cash/GCash drops
│   │   ├── InventoryReservation.cs  # Stock allocation (PendingPayment vs. Committed)
│   │   ├── InventoryTransaction.cs  # Immutable ledger transactions (In/Out/Adjustment)
│   │   ├── DeliveryTrip.cs          # Rider dispatch trip records & cash splits
│   │   ├── ItemCategory.cs          # Lechon weight bracket / menu category definition
│   │   ├── ProductCookingProfile.cs # Durations for Tahi, Salang, Packaging per size
│   │   ├── PriceHistoryLog.cs       # Audit trail for base price adjustments
│   │   ├── PurchaseOrder.cs         # Supplier restock orders
│   │   ├── PurchaseOrderItem.cs     # Line items for supplier restocking
│   │   ├── LowStockAlert.cs         # Stock deficit records below threshold
│   │   ├── NotificationLog.cs       # SMS/push delivery records
│   │   └── LogisticsEnums.cs / ProductionStatus.cs / ReservationStatus.cs / TransactionType.cs
│   │
│   └── DTOs/                        # High-speed data contracts & flat projections
│       ├── CreateOrderRequest.cs    # POS intake payload
│       ├── UpdateOrderDto.cs        # Order modification payload
│       ├── OrderDirectoryDto.cs     # Fast flat projection for directory searches
│       ├── InventoryBalanceDto.cs   # Stock scoreboard view
│       ├── InventoryTransactionDto.cs # Ledger transaction record
│       ├── RenegotiationTaskDto.cs  # Advance bookings affected by price hikes
│       ├── CreateCategoryRequest.cs # New menu category definition
│       ├── UpdatePriceRequest.cs    # Menu price modification request
│       └── UpdateCookingProfileRequest.cs # Cooking duration update request
│
└── lechon-system-web/               # ⚛️ React 19 Frontend Client
    ├── src/
    │   ├── pages/                   # Application route views
    │   │   ├── DashboardPage.tsx    # Zero-Inbox Command Center & Remittance Alerts
    │   │   ├── OrdersPage.tsx       # Master Order Directory, POS Modal, Dossier Drawer
    │   │   ├── KitchenPage.tsx      # Real-Time KDS Kanban & Roasting Spit Queue
    │   │   ├── InventoryPage.tsx    # Live Balance Scoreboard & Audit Ledger Tabs
    │   │   ├── LogisticsPage.tsx    # Live Operations & Tomorrow's Dispatch Planner
    │   │   ├── ManifestPage.tsx     # Customer-by-Customer Cash Reconciliation Matrix
    │   │   ├── DailySheetsPage.tsx  # Clean printable / screenshot views for Messenger
    │   │   ├── AnalyticsPage.tsx    # Visual KPI analytics & financial trend charts
    │   │   └── CmsPage.tsx          # Price matrix, categories, and cooking profile settings
    │   │
    │   ├── components/
    │   │   └── ui/                  # Reusable UI library (shadcn/ui + custom components)
    │   │       ├── RootLayout.tsx   # Global app container with sidebar navigation
    │   │       ├── Sidebar.tsx      # Navigation sidebar with responsive indicators
    │   │       ├── orders/
    │   │       │   ├── OrderForm.tsx       # Unified Order Intake Form (POS)
    │   │       │   └── EditOrderForm.tsx   # "Flexible Cart, Locked Cash" modifier modal
    │   │       ├── button.tsx, card.tsx, dialog.tsx, sheet.tsx, table.tsx, badge.tsx, etc.
    │   │
    │   ├── layouts/                 # Specialized printable views
    │   │   ├── PrintLayout.tsx      # Print wrapper for browser print/PDF
    │   │   ├── KitchenViewTab.tsx   # Kitchen manifest sorted by Tahi time (hides prices)
    │   │   └── RiderViewTab.tsx     # Rider manifest sorted chronologically (shows cash splits)
    │   │
    │   ├── hooks/                   # Custom TanStack Query hooks & mutators
    │   │   ├── useDashboard.ts      # Fetches Zero-Inbox KPIs & rosters
    │   │   ├── useOrdersDirectory.ts# Debounced order directory search & filter tabs
    │   │   ├── useOrderDetails.ts   # Deep-fetches individual customer dossier
    │   │   ├── useEditOrder.ts      # Mutates order & invalidates downstream caches
    │   │   ├── useOrderAuditLogs.ts # Retrieves immutable Black Box timeline
    │   │   ├── useKitchen.ts        # KDS roasting queue & spit state actions
    │   │   ├── useSchedules.ts      # Capacity queries & slot allocations
    │   │   ├── useInventory.ts      # Live stock balances & ledger adjustments
    │   │   ├── useLogistics.ts      # Driver assignments & delivery dispatches
    │   │   ├── useManifest.ts       # End-of-day reconciliation data
    │   │   ├── useLogPayment.ts     # Records three-way cash settlement
    │   │   ├── useAnalytics.ts      # Business metrics & performance data
    │   │   ├── useCms.ts            # Price hikes, category toggles & cooking profiles
    │   │   └── useDebounce.ts       # Debounce utility for search inputs
    │   │
    │   ├── schemas/                 # Client-side Zod validation contracts
    │   │   ├── orderSchema.ts       # Form validation for order intake and editing
    │   │   └── inventorySchema.ts   # Form validation for manual stock adjustments
    │   │
    │   ├── services/
    │   │   └── apiClient.ts         # Configured Axios instance (`http://localhost:5199/api`)
    │   │
    │   └── lib/
    │       └── utils.ts             # Tailwind class merging (`cn`) & format helpers
```

---

## 3. 🛡️ Architectural & Coding Guardrails

Every AI agent and software engineer working on this repository must strictly adhere to the following rules:

### A. Thin Controllers, Rich Services
* **Controllers** must contain zero database access code and zero business math. They strictly validate input parameters, route the call to the corresponding `IService`, and return clean HTTP status codes (`200 OK`, `201 Created`, `400 BadRequest`, `404 NotFound`).
* **Services** own all database transactions, scheduling math, validation guards, and audit trail insertions. Always inject service interfaces (`IOrderService`, `ISchedulingService`, etc.) into controllers.

### B. High-Performance Reads: `.AsNoTracking()` & Flat DTOs
* Never return raw EF entity graphs directly from read endpoints to avoid recursive loops, bloated JSON, and entity tracking memory overhead.
* All read queries must use `.AsNoTracking()` and project directly into flat DTOs using LINQ `.Select(o => new SomeDto { ... })`.
* Use debounced queries on the frontend (`useDebounce`) to prevent hammering SQL Server during live search.

### C. The "Flexible Cart, Locked Cash" Paradigm
* **The Flexible Cart:** Dispatchers can edit items, pig sizes, quantities, delivery addresses, customer contact numbers, remarks, discounts, and delivery fees. Updating cart items automatically recalibrates:
  1. The line item price snapshots.
  2. The Grand Total and calculated Smart Balance.
  3. The backward-scheduled kitchen clock (Tahi / Salang times).
* **The Locked Cash:** Existing `Downpayment` and `PaymentLog` entries are **strictly read-only and immutable**. Never update an existing payment row to reflect new money. All additional funds must be recorded via new `PaymentLog` records.
* **Price Snapshotting:** Every `OrderItem` must lock in the active `ItemCategory.BasePrice` at checkout (`TotalPrice = BasePrice * Quantity`). Menu price updates in the CMS must never alter existing, confirmed historical orders.

### D. The "Black Box" Immutable Audit Log
* Every manual edit or cancellation must log an entry in `OrderAuditLogs` with:
  - `OrderId`
  - `ActionType` (e.g., `"Order Edited"`, `"Order Cancelled"`)
  - `Changes` (Human-readable diff: e.g., `"Address changed from 'Imus' to 'Bacoor' | Upgraded size to Medium"`)
  - `ChangedBy` (Admin/Dispatcher identifier)
  - `Timestamp` (`DateTime.UtcNow`)
* **Spam Protection:** If an admin clicks save without modifying any fields (ghost edit), the backend must skip audit log creation.

### E. Frontend State Synchronization & Cache Invalidation
* All mutations in TanStack Query (`useMutation`) must aggressively invalidate relevant caches in their `onSuccess` callback using broad key patterns:
  ```typescript
  await queryClient.invalidateQueries({ queryKey: ["orders"] });
  await queryClient.invalidateQueries({ queryKey: ["order"] });
  await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  await queryClient.invalidateQueries({ queryKey: ["schedules"] });
  await queryClient.invalidateQueries({ queryKey: ["inventory"] });
  ```
* Never mutate local cache state manually when a fresh server roundtrip guarantees multi-user consistency across Kanban, Logistics, and Dashboard screens.

### F. Mandatory Compilation & Quality Gate
* **Backend Verification:** Always execute and verify `dotnet build` within `LechonSystem.Api/` after generating or modifying C# code. Ensure **0 Warnings and 0 Errors**.
* **Frontend Verification:** Always verify TypeScript types and build integrity (`npm run build` or `vite build`) within `lechon-system-web/` to guarantee zero compile errors or broken imports.

---

## 4. 📖 Core Domain Rules & Operational Blueprint

> [!IMPORTANT]
> The absolute source of truth for all business logic, kitchen timers, rider cash splits, and exception workflows is located at:
> 👉 [`docs/MASTER_ALIGNMENT.md`](file:///c:/Users/Cholo/Desktop/yumi-lechon-web-app/docs/MASTER_ALIGNMENT.md)

### Key Real-World Operational Mechanisms:

#### 1. The Dynamic Kitchen Clock (Backward Scheduling)
* Roasting duration is dictated exclusively by pig size and configured in `ProductCookingProfile`.
* Kitchen timeline is calculated **backward** from `TargetDeliveryTime`:
  $$\text{Salang Time} = \text{Target Delivery Time} - (\text{Packaging Duration} + \text{Salang/Roasting Duration})$$
  $$\text{Tahi Time} = \text{Salang Time} - \text{Tahi/Preparation Duration}$$
* Kitchen Kanban sorts orders strictly by **Earliest `TahiStartTime` (Priority 1, 2, 3...)**.
* **Add-Ons Exemption:** Sauces, dinuguan, and drinks are lightweight line items and are **strictly excluded** from the freezer ledger and kitchen scheduling calculations.
* **VIP Allocation (👑):** VIP pigs receive prominent visual badges so master roasters assign the top cut / largest pig in the bracket.

#### 2. The Freezer Bouncer & Audit Ledger
* **Reservation Status Flow:**
  - `PendingPayment`: Unpaid normal reservation (holds temporary slot until 4-day reminder window).
  - `Committed`: Downpayment > ₱0 OR `IsTrustedCustomer == true` (VIP) locks physical inventory.
  - `Released`: Order cancellation immediately returns reserved stock to available inventory.
* **Mandatory Adjustment Reason:** All manual inventory stock-ins or deductions must require a mandatory text reason to prevent unaccounted stock loss.

#### 3. Granular Cash Reconciliation & Rider Splits
* **The Grand Total Formula:**
  $$\text{Grand Total} = (\sum \text{Lechon Items}) + (\sum \text{Add-Ons}) + \text{Delivery Fee} - \text{Discount}$$
* **Smart Remaining Balance:**
  $$\text{Remaining Balance} = \text{Grand Total} - (\sum \text{Logged Payments})$$
* **Rider Cash Drops:**
  - If paid in cash on delivery, the freelance rider keeps their delivery fee and remits only the **Net Meat Subtotal** to the store.
  - If paid 100% upfront, the manifest displays **Amount to Collect: ₱0**, while recording that the store owes the rider their delivery fee out of the cash register.
  - If an order size is downgraded after full payment, the remaining balance turns negative (**"Overpaid / Refund Due"**), alerting dispatch to send refund cash with the rider.
* **Three-Way Settlement Categorization:**
  1. `Physical Cash`: Rider hands physical notes to the cashier.
  2. `Direct GCash`: Customer sent money directly to store's main QR/phone.
  3. `Rider GCash Remittance`: Rider collected cash and transferred electronically to store GCash.

#### 4. The Zero-Inbox Dashboard Trigger Windows
* **4-Day Reminder Window:** Surfaces unpaid orders for staff to follow up via Facebook Messenger.
* **1-Day Follow-Up Window:** Critical warning to collect payment or trigger cancellation.
* **Rush Order Bypass:** Same-day or next-day reservations bypass the 4-day/2-day queues directly into active rosters.
* **Tomorrow's Operations Roster:** Unified table merging delivery verifications with tonight's freezer defrosting schedule (late additions flagged with `[RUSH / LATE DEFROST]`).
* **Unremitted Cash Card:** Highlights riders holding unremitted funds, glowing **RED** if held past the dispatch date until settled on the manifest.
* **Peak Season Renegotiation Roster:** Automatically populated when base menu prices are updated in CMS, allowing dispatchers to log `[Customer Agreed]`, `[Waive Hike]`, or `[Customer Cancelled]`.

---

## 5. 🛠️ Development & Maintenance Cheat Sheet

### Common Terminal Commands
```powershell
# Backend (Run from /LechonSystem.Api)
dotnet build                         # Compile and check for errors
dotnet run                           # Launch API on http://localhost:5199
dotnet ef migrations add <Name>      # Add EF Core migration
dotnet ef database update            # Apply migrations to SQL Server

# Frontend (Run from /lechon-system-web)
npm run dev                          # Launch Vite dev server on http://localhost:5173
npm run build                        # Run TypeScript verification + Vite bundle
npm run lint                         # Run ESLint validation
```

### Response Conventions for AI Agents
* Format responses with concise, GitHub-flavored Markdown.
* Always cite file links using clickable Markdown file URIs (e.g. `[OrderService.cs](file:///c:/Users/Cholo/Desktop/yumi-lechon-web-app/LechonSystem.Api/Services/OrderService.cs)`).
* Never make assumptions about real-world domain math without consulting [`docs/MASTER_ALIGNMENT.md`](file:///c:/Users/Cholo/Desktop/yumi-lechon-web-app/docs/MASTER_ALIGNMENT.md).
