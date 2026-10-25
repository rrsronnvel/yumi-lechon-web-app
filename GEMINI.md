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
│   │   ├── CustomersController.cs   # Customer intelligence lookup & preferences/complaint notes
│   │   ├── DashboardController.cs   # Zero-Inbox KPI metrics, rosters & remittance alerts
│   │   ├── InventoryController.cs   # Stock balance scoreboard, ledger logs, manual adjustments
│   │   ├── LogisticsController.cs   # Dispatch planner, live delivery status, rider assignments
│   │   ├── OrdersController.cs      # POS order intake, directory, updates, cancellations, audit logs
│   │   ├── PaymentWebhookController.cs # Payment gateway hooks and external notifications
│   │   ├── ProcurementController.cs # Supplier orders & pig restocking generation
│   │   ├── RoastingController.cs    # Roasting pits, spit tracking & temperature stages
│   │   ├── SchedulesController.cs   # Slot capacity & daily roasting schedule endpoints
│   │   └── UsersController.cs       # Owner-gated staff account management & status toggling
│   │
│   ├── Services/                    # Core business logic, workflows & calculations
│   │   ├── AiIntakeParserService.cs # High-precision Gemini Vision booking parser
│   │   ├── AnalyticsService.cs      # Sales aggregation & time-series analysis
│   │   ├── CmsService.cs            # Dynamic price history & cooking profile management
│   │   ├── CustomerService.cs       # Customer profile lookup, lazy seeding & notes upsert
│   │   ├── DashboardService.cs      # Aggregates 4-day/1-day reminders & tomorrow's rosters
│   │   ├── InventoryService.cs      # Bank-statement ledger, safety stock & reservations
│   │   ├── LogisticsService.cs      # Driver assignment, delivery dispatch & manifests
│   │   ├── OrderService.cs          # Order lifecycle, price snapshotting, audit diffing
│   │   ├── PaymentService.cs        # Idempotent GCash & cash reconciliation tracking
│   │   ├── ProcurementService.cs    # Restock calculation & supplier SMS generator
│   │   ├── RoastingService.cs       # Pit/spit state management
│   │   ├── SchedulingService.cs     # Dynamic backward-scheduling engine (Tahi -> Salang)
│   │   ├── SmsNotificationService.cs# Dispatches SMS alerts for customer status changes
│   │   ├── UserService.cs           # Provisioning, BCrypt hashing, status toggling & self-preservation guard
│   │   ├── ICustomerService.cs      # Interface for Customer Intelligence operations
│   │   ├── ILogisticsService.cs     # Interface for Logistics operations
│   │   ├── IProcurementService.cs   # Interface for Procurement operations
│   │   └── IUserService.cs          # Interface for Staff Account operations
│   │
│   ├── Data/
│   │   └── LechonDbContext.cs       # EF Core DB context, relationship mappings & seed data
│   │
│   ├── Models/                      # Domain entities & database models
│   │   ├── BaseEntity.cs            # Id and CreatedAt baseline
│   │   ├── CustomerProfile.cs       # Customer intelligence (preferences, complaint radar, VIP, order count)
│   │   ├── Order.cs                 # Master order entity (customer, dual contacts, totals, statuses)
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
│   │   ├── SystemSetting.cs         # Configurable system settings (e.g., delivery pricing)
│   │   ├── User.cs                  # User credentials, roles (Owner/Cashier), active status & timestamps
│   │   └── LogisticsEnums.cs / ProductionStatus.cs / ReservationStatus.cs / TransactionType.cs
│   │
│   └── DTOs/                        # High-speed data contracts & flat projections
│       ├── CreateOrderRequest.cs    # POS intake payload
│       ├── CustomerProfileDto.cs    # Customer intelligence & notes update contracts
│       ├── DailySheetDtos.cs        # DailySheetItemDto for 14-column Kitchen & Rider manifests
│       ├── ParsedOrderDraftDto.cs   # Vision/text parser structured draft contract
│       ├── UpdateOrderDto.cs        # Order modification payload
│       ├── OrderDirectoryDto.cs     # Fast flat projection for directory searches
│       ├── DeliveryPricingDto.cs    # CMS delivery base fare, rate per km & no-freebies discount
│       ├── InventoryBalanceDto.cs   # Stock scoreboard view
│       ├── InventoryTransactionDto.cs # Ledger transaction record
│       ├── RenegotiationTaskDto.cs  # Advance bookings affected by price hikes
│       ├── CreateCategoryRequest.cs # New menu category definition
│       ├── UpdatePriceRequest.cs    # Menu price modification request
│       ├── UpdateCookingProfileRequest.cs # Cooking duration update request
│       └── UserDtos.cs              # Staff listing, provisioning, password reset & status contracts
│
└── lechon-system-web/               # ⚛️ React 19 Frontend Client
    ├── src/
    │   ├── pages/                   # Application route views
    │   │   ├── DashboardPage.tsx    # Zero-Inbox Command Center, Carcass Bouncer Defrost List & Remittance Alerts
    │   │   ├── OrdersPage.tsx       # Master Order Directory, Balance Due Sub-Pills, POS Modal, Dossier Drawer
    │   │   ├── KitchenPage.tsx      # Real-Time KDS Kanban & Roasting Spit Queue
    │   │   ├── InventoryPage.tsx    # Live Balance Scoreboard & Audit Ledger Tabs
    │   │   ├── LogisticsPage.tsx    # Dedicated Live Operations (Today) command center & Daily Sheets launcher
    │   │   ├── ManifestPage.tsx     # Customer-by-Customer Cash Reconciliation Matrix
    │   │   ├── DailySheetsPage.tsx  # Clean printable / screenshot views for Messenger
    │   │   ├── AnalyticsPage.tsx    # Visual KPI analytics & financial trend charts
    │   │   └── CmsPage.tsx          # Price matrix, categories, foldable delivery & discount policy cards
    │   │
    │   ├── components/
    │   │   ├── cms/                 # CMS modals & dialogs (CreateUserModal, ResetPasswordModal, ChangePriceModal)
    │   │   ├── daily-sheets/        # Daily Dispatch Planner print/screenshot tabs & inline editor
    │   │   │   ├── KitchenViewTab.tsx           # 14-column Kitchen manifest sorted by Tahi time (hides prices)
    │   │   │   ├── RiderViewTab.tsx             # 10-column Rider manifest with Anti-Complacency Guard
    │   │   │   └── InlineScheduleEditorModal.tsx# Interactive schedule, departure & rider override modal
    │   │   └── ui/                  # Reusable UI library (shadcn/ui + custom components)
    │   │       ├── RootLayout.tsx   # Global app container with sidebar navigation
    │   │       ├── Sidebar.tsx      # Navigation sidebar with responsive indicators
    │   │       ├── orders/
    │   │       │   ├── OrderForm.tsx       # Unified Order Intake Form (POS) with CP #2 & Downpayment presets
    │   │       │   └── EditOrderForm.tsx   # "Flexible Cart, Locked Cash" modifier modal with CP #2 support
    │   │       ├── button.tsx, card.tsx, dialog.tsx, sheet.tsx, table.tsx, badge.tsx, etc.
    │   │
    │   ├── utils/
    │   │   ├── messengerTemplates.ts # Taglish Messenger receipts, defrost list generator & departure math
    │   │   └── messengerTextParser.ts# 4-Phase heuristic parser for pasted Messenger text & receipts
    │   │
    │   ├── hooks/                   # Custom TanStack Query hooks & mutators
    │   │   ├── useCustomers.ts      # Debounced customer intelligence lookup & notes mutator
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
    │   │   ├── useUsers.ts          # Staff account listing, provisioning, password resets & status toggling
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
* Kitchen timeline is calculated **backward** from `AnchorTime = RiderDepartureTime ?? TargetDeliveryTime` (where `RiderDepartureTime` is derived from the 6-tier distance ladder or manual nudge pills, and locked to `TargetDeliveryTime` for Store Pickup):
  $$\text{Packaging Time} = \text{Anchor Time} - \text{Packaging Duration}$$
  $$\text{Salang Time} = \text{Packaging Time} - \text{Salang/Roasting Duration}$$
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
* **Granular Cash Custody Sub-Pills (Directory Parity):** Slices active unpaid balances into `Road Cash` (in rider pouches on the street), `In Staff Drawer` (unremitted floor custody), and `Advance` (future AR commitments), providing instant cross-platform audit clarity and deep-link reconciliation.

#### 4. The Zero-Inbox Dashboard Trigger Windows
* **4-Day Reminder Window:** Surfaces unpaid orders for staff to follow up via Facebook Messenger.
* **1-Day Follow-Up Window:** Critical warning to collect payment or trigger cancellation.
* **Rush Order Bypass:** Same-day or next-day reservations bypass the 4-day/2-day queues directly into active rosters.
* **Tomorrow's Operations Roster, Defrost Carcass Bouncer & 1-Click Defrost List Copier:** Unified table merging delivery verifications with tonight's freezer defrosting schedule (late additions flagged with `[RUSH / LATE DEFROST]`), paired with a 1-click `[ 📋 Copy Defrost List ]` button (`generateDefrostRosterMessage`) on both Web Dashboard and Mobile Floor Action views. Strictly enforces the Defrost Roster Carcass Bouncer (`MinimumWeightKg > 0` and non-carcass regex filters) to prevent add-ons (sauces, dinuguan, pancit, drinks, etc.) from ever polluting freezer pull-lists.
* **Dispatch Planner Rider Anti-Complacency Guard & Carcass Bouncer:** `KitchenViewTab.tsx` enforces a 14-column layout with `DEPARTURE / PICKUP` (`riderDepartureTime ?? targetDeliveryTime`) between `WEIGHT` and `CUSTOMER` and `DELIVERY` (`targetDeliveryTime`) between `ADD-ONS` and `RIDER`. `RiderViewTab.tsx` displays **ONLY** `DEPARTURE / PICKUP` and strictly hides `targetDeliveryTime` so riders cannot self-calculate buffer slack. Both sheets strictly enforce the Carcass Bouncer (`MinimumWeightKg > 0`): only Whole Lechon and Lechon Belly appear as schedule rows; add-ons are captured in the `ADD-ONS` column and never duplicate rows or skew delivery totals.
* **Unremitted Cash Card:** Highlights riders holding unremitted funds, glowing **RED** if held past the dispatch date until settled on the manifest.
* **Peak Season Renegotiation Roster:** Automatically populated when base menu prices are updated in CMS, allowing dispatchers to log `[Customer Agreed]`, `[Waive Hike]`, or `[Customer Cancelled]`.

#### 5. In-POS Tentative Reservation Drafts & Total Cockpit Quarantine
* **The In-POS Draft Toggle (`IsDraft = true`):** Mounted at the top of Web (`OrderForm.tsx`, `EditOrderForm.tsx`) and Mobile POS (`PosScreen.tsx`, `EditOrderModal.tsx`), allowing cashiers to capture unconfirmed inquiries without dummy dates or fake items.
* **Conditional Validation Engine:** When `IsDraft = true`, intake requires only one identifier (`CustomerName` or `FacebookName`); delivery date, venue address, and cart item count can be left blank/zero. When `IsDraft = false`, strict validation is re-armed.
* **Production Cockpit Quarantine:** Drafts create `0` `InventoryReservation` records and `0` `OrderItemSchedule` records. Queries in `DashboardService`, `SchedulingService`, and `LogisticsService` strictly enforce `.Where(o => !o.IsDraft)`.
* **Isolated 7th Tab Directory Slicing:** Web and Mobile directories isolate drafts in `[ 📝 Drafts ]` (`o.IsDraft && !o.IsCancelled`), showing `📅 Date Pending`, `📍 Venue TBD / Unset`, `Est. ₱...` + DP badge, and purple `[ 📝 Incomplete Draft ]` badge. Customer dossiers display a purple tentative inquiry alert banner.
* **Finalization Transition:** Turning the draft toggle OFF on an existing draft validates required production fields, generates freezer reservations and backward kitchen roasting timers, logs an audit entry (`"Draft inquiry finalized and locked into production by {CurrentUser}"`), and renders `[ 🔒 Finalize & Lock Order ]`.

#### 6. Owner-Controlled Staff Account Management & Production Environment-Gated Authentication Security
* **Owner-Gated Staff Account Management:** Provisioning of new cashier or owner logins, shift password resets, and account deactivations are strictly restricted to the `[Owner]` role (`/api/users`).
* **The Deactivated Login Bouncer:** When a staff member is marked `IsActive = false`, their credentials are rejected immediately at `/api/auth/login` with `401 Unauthorized` and the message `"This account has been deactivated. Please contact the business owner."`.
* **Owner Self-Preservation Guard:** An owner cannot deactivate their own currently active account via either API or UI (`(You)` row in Web CMS has disabled action with tooltip `"Cannot deactivate your own active Owner account"`).
* **Production Environment-Gated Authentication Security:**
  - Persisted in localStorage as `lechon_api_env` (with fallback to `lechon_api_environment`), defaulting to `'local'` on localhost and `'cloud'` in production.
  - **Live Cloud (`apiEnv === 'cloud'`):** The `1-TAP QUICK-FILL TEST PRESETS` container (`[ 👑 Fill Owner ]` and `[ 🧑‍🍳 Fill Cashier ]`) is **completely hidden and unmounted** from both Web (`LoginPage.tsx`) and Mobile (`LoginScreen.tsx`), and input credentials are automatically reset to `""` to prevent demo password leakage into live cloud databases.
  - **Local Development (`apiEnv === 'local'`):** Quick-fill presets are rendered for fast local shift testing.

#### 7. Carcass Bouncer, Dynamic No-Freebies Discount, Dual-Contact & 4-Phase Intake
* **Universal Carcass Bouncer (Defrost Roster, Kitchen View & Rider Manifest):** Strictly enforces `MinimumWeightKg > 0` across `DashboardService.cs` (Defrost Roster), `SchedulingService.cs` (`GetDailySheetsAsync`, `GetDailyRosterAsync`), and `OrderService.cs` (skipping `OrderItemSchedules` and `InventoryReservations` for lightweight add-ons during creation and updates). Backed by defensive client-side regex filters (`useSchedules.ts`, `KitchenViewTab.tsx`, `RiderViewTab.tsx`, `DashboardPage.tsx`, `FloorActionView.tsx`). Ensures lightweight add-ons (sauces, dinuguan, pancit, drinks, etc.) never generate roasting spit schedules, duplicate delivery manifest entries, or pollute kitchen/rider dispatch sheets.
* **CMS Dynamic No-Freebies Discount:** Moved from hardcoded ₱2,000 to CMS-configured `NoFreebiesDiscountPerPig` (persisted in `SystemSettings`, default ₱2,000.00). Accessible to Owners via CMS Delivery & Pricing settings and automatically applied as `noFreebiesDiscountPerPig * wholePigCount` across Web and Mobile POS terminals.
* **Dual-Contact Telemetry (`CP #1` & `CP #2`):** `Order.ContactNumber` column extended to `[MaxLength(45)]` (`nvarchar(45)`) storing comma-delimited `"{CP1},{CP2}"`. Both Web and Mobile POS feature `[+ Add CP #2]` toggle buttons and validation (min 10 digits). Customer intelligence isolates CP #1 for profiles while matching historical orders with `.Contains()`. Mobile Floor Action and Order Dossier provide interactive dialer Action Sheets (`📞 CP #1` vs. `📞 CP #2`).
* **4-Phase Flexible Messenger Intake Parser:** Operates across Gemini Vision (`AiIntakeParserService.cs`) and client-side regex engines (`messengerTextParser.ts` on Web and Mobile) to parse customer booking forms and staff receipts:
  1. *Identity & Contacts:* Extracts recipient name, Facebook profile name, primary phone (CP #1), secondary phone (CP #2), dedicated landmark, and event type.
  2. *Schedule & Fulfillment:* Flexibly resolves multi-line dates, relative markers (`bukas`, `tomorrow`), 12h/24h times, and fulfillment modes (Store Pickup, Delivery, Lalamove).
  3. *Menu & Freebie Intelligence:* Maps Whole Lechon brackets (Super Jumbo down to XXS) and Lechon Belly kg sizes, extracts add-ons, detects freebie opt-outs (`less 2k`, `cash discount`) with dynamic CMS discount calculation, and sniffs Raw Innards (`hilaw na laman loob`).
  4. *Financials & Sanitization:* Parses downpayments, sniffs payment channels (GCash, Maya, Bank Transfer, Cash), extracts delivery fees, and purges marketing boilerplate from kitchen remarks.

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

---

## 📱 Mobile Architecture (`lechon-system-mobile`)

* **Framework:** Expo SDK 58 (React Native 0.88), TypeScript.
* **Scope:** Companion app for Store Owner and Cashier (Order Directory, Customer Dossier, Quick Payment Logging, Mobile POS with Screenshot Intake, and Owner Drawer Remittance).
* **State & Networking:** TanStack Query v5 + Axios with `expo-secure-store` JWT persistence (`src/services/apiClient.ts`).
* **Verification Gate:** `npx tsc --noEmit` inside `lechon-system-mobile/` must pass with 0 errors.

### Cross-Stack Operational Rule Synchronization

These rules must remain aligned across `LechonSystem.Api`, `lechon-system-web`, and `lechon-system-mobile`:

* **Whole Lechon Freebies:** `minimumWeightKg >= 13` is the only weight trigger. One head receives seven canonical freebies; opt-out applies the CMS-configured `NoFreebiesDiscountPerPig` (default `₱2,000`) per head; Raw Innards fixes Dinuguan at zero with no replacement slot. Keep both `src/utils/freebiesHelper.ts` implementations behaviorally identical and persist `FreebiesSummary` plus `FreebiesConfigJson`.
* **Owner Confirmation:** Cashier-created active orders reserve and schedule immediately but require Owner review. Only `POST /api/orders/{id}/confirm-owner` completes the gate; pending work comes from `GET /api/dashboard/pending-owner-confirmations`.
* **Duplicate Radar:** Customer lookup returns `ActiveUpcomingOrders` even without a profile. POS and edit surfaces warn proactively and require a second confirmation for exact same-day matches.
* **BIR Channels:** Initial and subsequent payment logs use exactly `Cash`, `GCash`, `Maya`, or `Bank Transfer`. Positive unclassified downpayments default to GCash; zero downpayments use `None` on the order header.
* **Mobile Alerts:** `src/hooks/useNotifications.ts` owns permission/channel setup, daily 9:00 AM deposit reminders, daily 4:00 PM defrost reminders, Owner queue increase alerts, Rush Defrost alerts, and the Floor Action test trigger.
* **Daily Sheets:** `SchedulingService` projects `FreebiesSummary`; Kitchen and Rider views render the semantic badge above ordinary remarks.

### Verification Commands

```powershell
dotnet build LechonSystem.Api
Push-Location lechon-system-web; npm run build; Pop-Location
Push-Location lechon-system-mobile; npx tsc --noEmit; Pop-Location
```

* **Directory Mapping:**
  ```
  lechon-system-mobile/
  ├── App.tsx                          # Root QueryClientProvider + AuthProvider + AuthGate
  └── src/
      ├── context/
      │   └── AuthContext.tsx          # 12-hour shift JWT hydration, role flags, API switcher
      ├── services/
      │   └── apiClient.ts             # Cloud/Local AVD base URL switcher & token interceptors
      ├── components/
      │   ├── MainShell.tsx            # 3-tab mobile shell (Orders, New POS, Drawer) + top HUD
      │   └── orders/
      │       ├── OrderDossierModal.tsx# 3-second customer dossier, tel: dialer, payment & cancel modals
      │       ├── EditOrderModal.tsx   # Mobile "Flexible Cart, Locked Cash" order editor modal
      │       └── FloorActionView.tsx  # Mobile Floor Action Hub (Downpayment Radar & Tonight's Defrost Roster)
      ├── screens/
      │   ├── LoginScreen.tsx          # Shift login with API switcher pill & 1-tap demo presets
      │   ├── OrdersScreen.tsx         # Debounced Master Order Directory + Segmented Floor Action Toggle Switcher
      │   ├── PosScreen.tsx            # AI Screenshot & Text POS Terminal with tri-modal bouncer
      │   └── DrawerScreen.tsx         # 2-Hop Cash Custody & Tri-Modal Settlement Hub
      ├── hooks/
      │   ├── useOrders.ts             # Directory search, dossier fetch, manual pay & cancel mutations
      │   ├── useFloorAction.ts        # Tomorrow's defrost roster & 4-day pending confirmation queries
      │   ├── usePos.ts                # Catalog, inventory balances, screenshot parser & order creation
      │   └── useManifest.ts           # Rider/Pickup/Lalamove settlements & 2-Hop QR custody mutations
      └── utils/
          ├── messengerTemplates.ts    # Taglish Messenger receipts, defrost list generator & downpayment reminders
          └── messengerTextParser.ts   # Client-side heuristic parser for pasted Messenger text
  ```


