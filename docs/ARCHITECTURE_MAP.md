**

## 6. 2026-10-30 Operational Parity Additions

### Backend

- `LechonSystem.Api/Services/OrderService.cs`: Philippine-date Upcoming/Past slicing, strict date-less Drafts separation, operational Balance Due queue providing all active unpaid records for 4-pill client filtering, zero-DP inclusion with 3-Tier Alert Badges Matrix, custody-aware operational balance, rider-fee-at-door detail projection, and null-safe audit text comparison.
- `LechonSystem.Api/Services/LogisticsService.cs`: Hop 1/2 and direct-settlement completion semantics; fully remitted Delivery orders and trips transition to `Delivered`. Rider assignments, changes, and unassignments record immutable `OrderAuditLog` records (`ActionType = "Rider Updated"`).
- `LechonSystem.Api/Services/SchedulingService.cs`: Active non-draft orders remain on daily sheets even before Owner confirmation, with `IsTrustedCustomer` projected for no-DP warning logic, and `DailySheetItemDto.IsTimeTbd` stamped to guard against clock crashes. Schedule rider overrides record immutable `OrderAuditLog` records.
- `LechonSystem.Api/DTOs/OrderDetailsDto.cs`: exposes `SettlementCustodyStatus` and `RiderFeeSettledAtDoor`; `BalanceDue` remains a derived read-model value.
- `LechonSystem.Api/Program.cs`: QA scenario seeding is disabled by default and requires the explicit `EnableQaDataSeeder` configuration flag.

### Web

- `src/utils/chatParser.ts` and `messengerTextParser.ts`: official Messenger form compatibility, payment-method extraction, dual phone parsing, multiline events, freebie customization, and footer suppression.
- `src/pages/OrdersPage.tsx`: Philippine-date directory boundary, 3-Tier Alert Badges (`⏳ TIME TBD`, `⚠️ NO DP • PENDING DEPOSIT`, `🚨 URGENT: NO DP`), 4-pill operational Balance Due filtering (`Due Today / Overdue`, `In Staff Drawer`, `Future Receivables`, `All Unpaid`), dossier rider assignment, and deep-linked dossier opening from Manifest.
- `src/components/manifest/LalamoveSettlementTab.tsx`: direct `View / Cancel Order` dossier action. `QrSettlementModal.tsx` exposes Bank Transfer.
- `src/components/ui/orders/EditOrderForm.tsx`: registered/custom rider assignment during edit.
- `src/components/daily-sheets/{KitchenViewTab,RiderViewTab}.tsx`: Time-TBD backward clock crash guards displaying `[ ⏳ TIME TBD ]`, bottom table grouping under visual divider, and explicit no-DP confirmation warnings.

### Mobile

- `src/screens/PosScreen.tsx` uses the synchronized `chatParser.ts` contract and hydrates DP method plus freebie overrides.
- `src/screens/OrdersScreen.tsx`: Philippine-date Today/Tomorrow/Upcoming slicing, 3-Tier Alert Badges, and 4-pill operational Balance Due sub-filter matching Web.
- `src/screens/DrawerScreen.tsx`: Bank Transfer, native handover QR, schedule/Past Shift badges, and Lalamove dossier access.
- `src/components/orders/{OrderDossierModal,EditOrderModal}.tsx` plus `src/hooks/useRiders.ts`: registered/custom rider assignment and post-mutation cache refresh.
- Native QR dependencies are `react-native-qrcode-svg` and Expo-compatible `react-native-svg`.

# Codebase Architecture Map

### 1. Directory Tree

#### Backend (.NET 10 Web API):

- LechonSystem.Api/Controllers/AnalyticsController.cs: Exposes read-optimized aggregations for business intelligence (sales velocity, delivery SLAs, material wastage) using .AsNoTracking().
    
- LechonSystem.Api/Controllers/AuthController.cs: Exposes POST /api/auth/login for 12-hour shift issuance and GET /api/auth/me for user profile retrieval.
    
- LechonSystem.Api/Controllers/CmsController.cs: Exposes endpoints for mutating global menu pricing, category cooking profiles, creating/soft-deleting item categories, fetching chronological price history logs, and reading/updating CMS Delivery Pricing rates and the No-Freebies Opt-Out discount (`GET /api/cms/delivery-pricing`, `PUT /api/cms/delivery-pricing`).
    
- LechonSystem.Api/Controllers/CustomersController.cs: Exposes endpoints for reactive customer profile lookups by primary phone or Facebook name (`GET /api/customers/lookup`) and updating/upserting customer preferences and complaint history notes (`PUT /api/customers/{id}/notes`, `PUT /api/customers/by-phone/{phone}/notes`), supporting dual-contact comma-separated phone matching.
    
- LechonSystem.Api/Controllers/DashboardController.cs: Exposes read-only queries for operational widgets (pending confirmations <= 4 days, verifications <= 2 days, carcass-only defrost roster via the Defrost Carcass Bouncer, and peak-season price renegotiation targets).
    
- LechonSystem.Api/Controllers/InventoryController.cs: Exposes endpoints to retrieve item categories, dual-stock live balances (physical on-hand vs. 14-day forward commitments), direct freezer receiving, and an auditable chronological history of physical stock ledger movements.
    
- LechonSystem.Api/Controllers/LogisticsController.cs: Handles HTTP requests for retrieving unassigned ReadyForDelivery items, committing batch rider dispatches, tri-modal counter settlements, and Lalamove pre-release verification.
    
- LechonSystem.Api/Controllers/OrdersController.cs: Provides endpoints for order ingestion with user attribution (CreatedBy), daily OrderReference generation (`MMDDYY-XXX`), dual-contact numbers (`ContactNumber` max length 45 for primary CP #1 and secondary CP #2), manual lifecycle state transitions, cancellation workflows, Master Ledger directory retrieval, safe order modifications, Owner-only payment voiding, and immutable change audit logs.
    
- LechonSystem.Api/Common/UserIdentityHelper.cs: Centralized user resolution utility extracting FullName and Username from ClaimsPrincipal or database lookup into `{FullName} (@{Username})` for audit logs, order creation, and drawer validation.
    
- LechonSystem.Api/Models/SettlementQrSession.cs: Entity tracking one-time cryptographic QR tokens, hop stage (RiderToStaff vs. StaffToOwner), rider digital signature fields, staff validation stamps, owner approval stamps, and token expiration.
    
- LechonSystem.Api/Models/SystemSetting.cs: Key-value configuration entity storing dynamic store settings (`DeliveryFeeBaseFare`, `DeliveryFeeRatePerKm`, `NoFreebiesDiscountPerPig`) with `UpdatedBy` and `UpdatedAt` audit attribution.
    
- LechonSystem.Api/DTOs/DeliveryPricingDto.cs: Data contract carrying `BaseFare` (default `100.00m`), `RatePerKm` (default `15.00m`), and `NoFreebiesDiscountPerPig` (default `2000.00m`) for CMS delivery rate and whole lechon freebie discount governance.
    
- LechonSystem.Api/DTOs/QrSettlementDtos.cs: Request/response contracts for generating QR sessions, polling session state, submitting rider mobile signatures, validating staff drawer custody, and executing owner final sign-off.
    
- LechonSystem.Api/DTOs/OrderDetailsDto.cs: Heavy dossier projection enriched with order/rider/customer telemetry plus complete `PaymentLogDto` history (`ReferenceNumber`, `IsVoided`, `VoidedAt`, `VoidedBy`, `VoidReason`); paid totals and channel summaries include only active logs.

- LechonSystem.Api/DTOs/VoidPaymentRequest.cs: Owner reversal request contract carrying mandatory `Reason` and owner attribution `VoidedBy`.
    
- LechonSystem.Api/Controllers/PaymentWebhookController.cs: Handles asynchronous callbacks from payment gateways and manual drawer/counter cash payments via /api/internal/payments/manual.
    
- LechonSystem.Api/Controllers/ProcurementController.cs: Exposes real-time low-stock safety threshold flags and automated draft shopping lists for Messenger communication.
    
- LechonSystem.Api/Controllers/RidersController.cs: Thin endpoints for fetching active freelance riders and quick-registering ad-hoc drivers into the registry.
    
- LechonSystem.Api/Controllers/UsersController.cs: Owner-gated endpoints for staff account management (`GET /api/users`, `POST /api/users`, `PUT /api/users/{id}/password`, `PATCH /api/users/{id}/status`).
    
- LechonSystem.Api/Controllers/RoastingController.cs: Processes HTTP PATCH requests to transition sequential cooking states (Raw, Cooking, Cooked, ReadyForDelivery) for specific order items.
    
- LechonSystem.Api/Controllers/SchedulesController.cs: Exposes the active timeline-driven kitchen roster and daily dispatch sheets for operational tracking.
    
- LechonSystem.Api/Services/AiIntakeParserService.cs: Service handling image payload ingestion and structured JSON schema querying against Gemini multimodal API, with robust 4-phase Messenger booking intake support, extracting dual contacts (`contactNumber`, `contactNumber2`), `freebiesOptOut`, `rawInnards`, distance, downpayment methods, and boilerplate remarks sanitization.
    
- LechonSystem.Api/Services/AnalyticsService.cs: Computes business metrics, wastage statistics, delivery SLA adherences, and revenue totals.
    
- LechonSystem.Api/Services/AuthService.cs: Handles BCrypt password hashing, verification, user authentication, and 12-hour JWT token generation.
    
- LechonSystem.Api/Services/CmsService.cs: Manages category lifecycles, mutates base prices, updates roasting profile parameters, manages `SystemSettings` pricing config including delivery rates and `NoFreebiesDiscountPerPig` (`GetDeliveryPricingAsync`, `UpdateDeliveryPricingAsync`), and writes immutable PriceHistoryLog audit records.
    
- LechonSystem.Api/Services/CustomerService.cs: Normalizes customer phone numbers, extracts primary phone from comma-delimited strings (`ExtractPrimaryContactNumber`), performs reactive customer intelligence lookups (`LookupCustomerAsync`) with lazy historical order seeding and dual-phone `.Contains()` matching, and manages preferences/complaint history updates (`UpdateCustomerNotesAsync`, `UpsertCustomerNotesByPhoneAsync`).
    
- LechonSystem.Api/Services/ICustomerService.cs: Service contract for customer profile lookups and note updates.
    
- LechonSystem.Api/Services/DashboardService.cs: Aggregates urgent staff action items across confirmation windows, verification schedules, roasting queues, and pricing renegotiation queues, strictly enforcing the Defrost Roster Carcass Bouncer (`MinimumWeightKg > 0`) to ban add-ons from defrosting lists.
    
- LechonSystem.Api/Services/InventoryService.cs: Manages physical stock ledgers, executes rolling 14-day committed reservation hold calculations (Available = Physical - Locked), and processes atomic freezer stock intake.
    
- LechonSystem.Api/Services/LogisticsService.cs: Manages freelance driver dispatches, tri-modal settlement queries (Riders, Store Pickups, Lalamove), courier release validation gates, and COD reconciliations.
    
- LechonSystem.Api/Services/OrderService.cs: Core transaction processor; handles order creation with server-side price snapshotting, daily `OrderReference` sequence generation (`MMDDYY-XXX`), user identity stamping (`CreatedBy`), dual-contact comma separation (`ContactNumber` max length 45), the two-tier `IsDraft` lifecycle, `IsTimeTbd` noon-date normalization, date-filtered directory projections, non-lechon schedule/reservation isolation, Owner past-time edit override, Cashier-only new-past-time rejection, proportional `RiderDepartureTime` shifting/clamping, safe editing/finalization, cancellations, and `OrderAuditLog` entries.
    
- LechonSystem.Api/Services/PaymentService.cs: Manages asynchronous payment reconciliations, verification logs, counter settlements, and automated reservation conversions.
    
- LechonSystem.Api/Services/ProcurementService.cs: Evaluates stock availability against minimum safety thresholds and formats supplier shopping lists.
    
- LechonSystem.Api/Services/RoastingService.cs: Controls roasting queue progress and cooking status transitions for scheduled order items.
    
- LechonSystem.Api/Services/SchedulingService.cs: Calculates backward-production schedules anchored on `RiderDepartureTime ?? TargetDeliveryTime`, roasting intervals, and daily driver dispatch manifests. `DailySheetItemDto` projects `Source`, net `LechonPrice`, numeric `AddOnsTotal`, `DeliveryFee`, `Downpayment`, and corrected `TotalToCollect`/balance due while retaining extras-only orders.
    
- LechonSystem.Api/Services/SmsNotificationService.cs: Implementation of INotificationSender dispatching transactional SMS alerts for order milestones.
    
- LechonSystem.Api/Services/IUserService.cs: Interface defining staff and terminal account management operations.
    
- LechonSystem.Api/Services/UserService.cs: Core business logic for provisioning counter cashier/owner accounts with BCrypt password hashing, updating shift passwords, and toggling active status with the Owner self-preservation guard.
    
- LechonSystem.Api/Data/LechonDbContext.cs: Entity Framework Core database context configuring entity schemas, relationships, soft-delete query filters, seed data (Riders, Users, Categories, SystemSettings), and decimal precisions.
    
- LechonSystem.Api/Models/BaseEntity.cs: Abstract foundation entity providing primary keys and created timestamps.
    
- LechonSystem.Api/Models/CustomerProfile.cs: Customer intelligence entity indexed uniquely on `ContactNumber`, storing `FullName`, `FacebookName`, `DefaultAddress`, `DefaultLandmark`, `Preferences`, `ComplaintHistory`, `IsVip`, and `TotalOrdersCount`.
    
- LechonSystem.Api/Models/FulfillmentType.cs: Dedicated enum specifying Pickup = 0, Delivery = 1, and Lalamove = 2.
    
- LechonSystem.Api/Models/ItemCategory.cs: Sellable category entity with weight boundaries, base pricing, and safety stock limits.
    
- LechonSystem.Api/Models/Order.cs: Master order header capturing `OrderReference` (`MMDDYY-XXX`), customer identity, `FacebookName`, dual contacts, `Source`, `EventType`, `Landmark`, `IsDraft`, `IsTimeTbd`, nullable schedule/address fields, financial snapshots, `CreatedBy`, and fulfillment mode. `IsTimeTbd` stores the selected date at local noon and prevents rider/kitchen clock generation until resolved.
    
- LechonSystem.Api/Models/OrderItem.cs: Line item entity representing roasted carcass size tiers and dynamic add-ons.
    
- LechonSystem.Api/Models/OrderItemSchedule.cs: Kitchen timing entity tracking Tahi, Salang, Packaging timestamps, manual overrides, and assigned riders.
    
- LechonSystem.Api/Models/InventoryReservation.cs: Forward stock hold entity locking carcasses against 14-day operational windows.
    
- LechonSystem.Api/Models/InventoryTransaction.cs: Immutable stock movement ledger (StockIn, StockOut, Adjustments) with mandatory audit reasons.
    
- LechonSystem.Api/Models/DeliveryTrip.cs: Logistics grouping entity tracking driver dispatches and trip completion.
    
- LechonSystem.Api/Models/Rider.cs: Entity storing freelance rider profiles (Id, FullName, PhoneNumber, IsActive).
    
- LechonSystem.Api/Models/User.cs: Entity representing store users (Id, Username, PasswordHash, FullName, Role, IsActive, CreatedAt).
    
- LechonSystem.Api/Models/OrderAuditLog.cs: Flight recorder entity capturing field-level changes, old/new diffs, timestamps, and ChangedBy user signatures.
    
- LechonSystem.Api/Models/PriceHistoryLog.cs: Immutable audit record of base price adjustments with deltas and author attribution.
    
- LechonSystem.Api/Models/PaymentLog.cs: Financial ledger tracking downpayments and later collections. Owner reversals are non-destructive and stamp `IsVoided`, `VoidedAt`, `VoidedBy`, and `VoidReason`.
    
- LechonSystem.Api/DTOs/AuthDtos.cs: Request and response carriers (LoginRequest, AuthResponseDto, UserDto).
    
- LechonSystem.Api/DTOs/CategoryMetadataDto.cs: Payload contract for updating category name, weight boundaries, and minimum safety stock.
    
- LechonSystem.Api/DTOs/CreateCategoryRequest.cs: Request contract for creating a new sellable item category.
    
- LechonSystem.Api/DTOs/CreateOrderRequest.cs: Nested order intake contract carrying `IsDraft`, `IsTimeTbd`, customer/routing fields, nullable schedule/address values, financial snapshots, trusted flags, and item arrays (empty items permitted for drafts).
    
- LechonSystem.Api/DTOs/CustomerProfileDto.cs: Data contracts (`CustomerProfileDto`, `UpdateCustomerNotesRequest`, `ActiveCustomerOrderSummaryDto` carrying `CustomerName`, `FacebookName`, `ContactNumber`, and `DeliveryAddress` for multi-factor duplicate radar evaluation) for customer intelligence lookups and preference/complaint radar updates.
    
- LechonSystem.Api/DTOs/DailySheetDtos.cs: Read-optimized DTO (`DailySheetItemDto`) projecting scheduled carcass items with rider/target times, weight metadata, customer/contact details, kitchen timestamps, and cash splits for the 13-column Kitchen and Rider daily sheets.
    
- LechonSystem.Api/DTOs/InventoryBalanceDto.cs: Read-optimized DTO projecting aggregated physical on-hand stock, 14-day locked commitments, sellable available balances, safety levels, and health status badges per category.
    
- LechonSystem.Api/DTOs/InventoryTransactionDto.cs: Flattened DTO serializing ledger transaction records with enum-to-string mappings and mandatory reason audit strings.
    
- LechonSystem.Api/DTOs/OrderDirectoryDto.cs: Read-optimized Master Directory projection including `IsDraft`, `IsTimeTbd`, `ItemsCount`, and `HasRoastItems` for Tier-2 missing-detail tags, plus schedule, financial, routing, and cash-custody fields.
    
- LechonSystem.Api/DTOs/OverrideScheduleRequest.cs: Request payload for manual adjustments to Tahi, Salang, Packaging, and RiderDepartureTime timestamps, remarks, or rider assignments on the daily sheet.
    
- LechonSystem.Api/DTOs/ParsedOrderDraftDto.cs: Data transfer object projecting extracted customer identity, dual contacts (`ContactNumber`, `ContactNumber2`), delivery, financial (`DistanceKm`, `DeliveryFee`, `Discount`, `Downpayment`, `DownpaymentMethod`), freebie options (`FreebiesOptOut`, `RawInnards`), and item data from an intake image or pasted Messenger text.
    
- LechonSystem.Api/DTOs/PendingPickupSettlementDto.cs: Projection DTO for walk-in store pickup orders pending drawer cash settlement (BalanceDue, IsPaidInFull, IsTrustedCustomer, Address, Remarks).
    
- LechonSystem.Api/DTOs/PendingLalamoveSettlementDto.cs: Projection DTO for Lalamove courier orders (BalanceDue, IsClearedForRelease, IsReleased, DeliveryAddress, Remarks).
    
- LechonSystem.Api/DTOs/PriceHistoryLogDto.cs: Projection DTO returning chronological price changes, deltas, and admin timestamps.
    
- LechonSystem.Api/DTOs/ReceiveStockRequest.cs: Request payload capturing optional SupplierDrNumber, general intake remarks, and an array of received category items with quantities.
    
- LechonSystem.Api/DTOs/RenegotiationTaskDto.cs: Projection of advance orders booked with prices below current base rates for peak season renegotiation.
    
- LechonSystem.Api/DTOs/RiderDto.cs: Data contracts for RiderDto and CreateRiderRequest.
    
- LechonSystem.Api/DTOs/UpdateCookingProfileRequest.cs: Payload contract for updating category-level roasting duration and weight multiplier formulas.
    
- LechonSystem.Api/DTOs/UpdateOrderDto.cs: Strict contract for non-destructive order edits (`CustomerName`, `FacebookName`, `Source`, `EventType`, `Landmark`, `TargetDeliveryTime`, `RiderDepartureTime`, `DeliveryAddress`, `Remarks`, `Items`).
    
- LechonSystem.Api/DTOs/UpdatePriceRequest.cs: Payload contract for category base price changes and admin signatures.
    
- LechonSystem.Api/DTOs/UserDtos.cs: Data contracts (`UserListItemDto`, `CreateUserRequest`, `UpdateUserPasswordRequest`, `UpdateUserStatusRequest`) for staff account provisioning and status governance.

#### Frontend (React SPA / Vite / TypeScript)

- Core Application, Auth & Utilities:

- lechon-system-web/src/App.tsx: Sets up React Router DOM routing tree, authentication gate wrappers (ProtectedRoute), layout wrappers, and root toast/query providers.  
- lechon-system-web/src/context/AuthContext.tsx: Global authentication state provider managing user profile, active JWT token, 12-hour shift persistence, and login/logout handlers.  
- lechon-system-web/src/services/apiClient.ts: Axios client pre-configured with base URL, JWT bearer request interceptors, and 401 response interceptors.  
- lechon-system-web/src/utils/messengerTemplates.ts: Formatter utilities generating privacy-shielded Taglish Messenger clipboard strings (omitting internal `#OrderReference` IDs and displaying `Landmark`), `generateDefrostRosterMessage` 1-click nightly freezer pull-list generator (hardened with the Defrost Roster Carcass Bouncer to strictly ban non-carcass add-ons and negative/zero weight items), plus shared `calculateRiderDepartureTime` 6-tier distance ladder and quick-select pill constants.
- lechon-system-web/src/utils/messengerTextParser.ts: Client-side 4-phase Messenger parser with specificity-ordered whole-lechon aliases (`S. Jumbo` → `Jumbo` → `XXL` → `XL` → `XXS` → `XS` → `L` → `M` → `S`), preventing `X-Large` from falling through to `Large`; supports compact phone labels, Deliver/Delivery address labels, combined date/time ranges, `(paid)` DP text, and 7-freebies signals.
- lechon-system-web/src/utils/dateNormalizer.ts: Shared `YYYY-M-D` → `YYYY-MM-DD` normalization and edit-time rider date synchronization helpers.
- lechon-system-web/src/utils/walkIn.ts and src/components/WalkInBadge.tsx: Reusable Source/`(WI)` detection and screen/print Walk-In badge rendering.
- lechon-system-web/src/utils/similarityHelper.ts: Multi-factor composite duplicate matching engine (`isPlaceholderPhone` bouncer for `09000000000`/`00000000000`/length < 10/$\le 2$ unique digits, `cleanPhoneDigits`, `computeLevenshteinRatio`, `checkNameSimilarity`, `checkDateProximity`, `checkAddressOverlap`, and `evaluateDuplicateOrders` requiring Score $\ge 2$ to trigger Red Alert).
- lechon-system-web/src/components/manifest/QrSettlementModal.tsx: Interactive PC modal with overflow-locked widescreen/mobile-safe container (`overflow-x-hidden max-w-lg w-full p-6 rounded-xl`), rendering dynamic one-time QR codes (qrcode.react), 2-second live signature polling, symmetrical 2-column Hop 1 discrepancy action grid (`h-11` aligned `[✅ Validate & Receive into Drawer]` and `[🔄 Ask Rider to Re-enter]` buttons), Hop 2 Owner counted-amount physical envelope speed bump, and authenticated `[↩️ Revert Custody to Uncollected]` undo trigger.
- lechon-system-web/src/pages/QrSignPage.tsx: Standalone mobile-first public web view (/qr-settle/:token) branded with `/yumi-logo.png` and Deep Roasted Espresso header, allowing riders to digitally sign remittances (with reactive rejection notification alert when cashier requests re-entry) and owners to verify counted envelope cash bills and approve staff cash handovers from their smartphones, culminating in a screenshot-ready Digital Receipt.  

- Pages (Views):

- lechon-system-web/src/pages/LoginPage.tsx: Warm Culinary Enterprise shift login screen featuring prominent `/yumi-logo.png` emblem, warm espresso-to-terracotta gradient backdrop, Yumi's Lechon Crimson (`#C81E1E`) sign-in trigger, and 1-click demo credential hydration.  
- lechon-system-web/src/pages/DashboardPage.tsx: Widescreen operational command center with balanced 3-card KPI grid, `#OrderReference` badges, collapsible zero-inbox alert feeds, `[ 📋 Copy Defrost List ]` 1-click Messenger clipboard generator on the Operations Roster header, Defrost Roster Carcass Bouncer (`carcassOnlyDefrost` using `minimumWeightKg > 0` and non-carcass regex filters), and direct POS quick-launch triggers.  
- lechon-system-web/src/pages/OrdersPage.tsx: Master Order Directory with search-adjacent previous/next/native date controls, Today/Tomorrow/Clear shortcuts, date-scoped BIR payment-channel totals, Tier-1 dateless drafts in `[ 📝 Drafts ]`, and amber Tier-2 dated incomplete rows in `[ 📅 Upcoming ]` with Time/Venue/Size TBD micro-tags. The slide-out dossier retains cancellation, payment, rider telemetry, and Messenger-sharing workflows.
- lechon-system-web/src/pages/DailySheetsPage.tsx: Print-friendly operational sheet with a 1280px off-screen Clean View renderer. `html-to-image` exports the active Kitchen/Rider sheet at pixel ratio 2 to a white PNG, then uses Web Share Level 2 or direct download for mobile-safe full-table sharing.
- lechon-system-web/src/pages/LogisticsPage.tsx: Dedicated single-view Live Operations (Today) command center for monitoring active dispatches, executing emergency rider swaps, and confirming deliveries, with direct primary launcher for the 13-column Daily Dispatch Planner (`/daily-sheets`).
- lechon-system-web/src/pages/ManifestPage.tsx: 3-tab Daily Settlement Center hosting Freelance Riders, Store Pickups, and Lalamove Couriers; every table carries the Walk-In badge and a two-line `DATE / SCHEDULE` column after Customer.
- lechon-system-web/src/pages/InventoryPage.tsx: Multi-tab page containing Dual-Balance Forecasting Scoreboard (Physical, Locked 14d, Available, Safety Level, Status), Ledger Audit Trail, and Low-Stock Procurement boards.  
- lechon-system-web/src/pages/CmsPage.tsx: Menu and settings management page featuring separate foldable **Discount Configuration** (No-Freebies opt-out discount & scaling preview) and **Delivery Configuration** (Base Fare, Rate Per KM & live formula preview) policy cards with header rate summary badges, global base price adjustments, cooking profiles, and price history audit trails. Gated strictly to Owner role.  
- lechon-system-web/src/pages/KitchenPage.tsx: Kanban roasting queue interface with milestone stage advancement buttons (Dormant).  
- lechon-system-web/src/pages/AnalyticsPage.tsx: Dashboard displaying sales metrics, wastage reports, and SLA delivery tracking charts (Dormant).  

- Components & Modals:

- lechon-system-web/src/components/auth/ProtectedRoute.tsx: Route wrapper enforcing authentication status and role-based permissions (Owner vs. Cashier).  
- lechon-system-web/src/components/ui/Sidebar.tsx: Persistent Deep Roasted Espresso (`#181312`) navigation sidebar mounting `/yumi-logo.png`, Golden Amber active route indicators, role-aware CMS visibility, and active user shift profile/logout HUD with distinct Golden Crown (`Owner`) vs. warm stone (`Cashier`) badges.  
- lechon-system-web/src/components/ui/orders/OrderForm.tsx: Widescreen POS terminal with Draft and `[ 🐷 Whole / Belly Lechon | 🍲 Non-Lechon / Extras Only ]` modes, a date-preserving `[ 🕒 Time TBD ]` control, zero-weight-only cart filtering in non-lechon mode, conditional event/rider/freebie sections, dual contacts, Messenger intake, tri-modal fulfillment, CMS delivery/discount calculations, and payment presets.
- lechon-system-web/src/components/ui/orders/EditOrderForm.tsx: Edit-sheet parity for Draft/Time-TBD lifecycle and Lechon vs. Non-Lechon mode, including automatic carcass removal, conditional event/rider/freebie fields, noon normalization for dated Time-TBD drafts, 3-row Financial Adjustments layout (Row 1: Transit Pricing with Est. Distance & Delivery Fee, Row 2: Courtesy Discount, Row 3: Read-only locked downpayment banner with payment channel pill), and automatic dynamic roasting schedule recalculation.
- lechon-system-web/src/components/ui/orders/OrderScreenshotUploader.tsx: Dropzone and clipboard paste area (Ctrl + V) for Messenger intake screenshots.  
- lechon-system-web/src/components/daily-sheets/KitchenViewTab.tsx: 13-column print/screenshot Kitchen Production Sheet (`NO.` | `TAHI` | `SALANG` | `PRIORITY` | `SIZE` | `WEIGHT` | `DEPARTURE / PICKUP` | `CUSTOMER` | `REMARKS` | `LOCATION` | `ADD-ONS` | `DELIVERY` | `RIDER`). The retired `PACKAGING` column gives more width to remarks/location; `MinimumWeightKg > 0` remains a defensive row gate.
- lechon-system-web/src/components/daily-sheets/RiderViewTab.tsx: Rider Dispatch & Cash Manifest with `PRICE | ADD-ONS | DEL FEE | DOWN PAYMENT | TO COLLECT`; it consumes server-projected numeric totals, deducts discount/downpayment, totals corrected `TotalToCollect`, and displays screen/clean Walk-In markers with edit-mode row highlighting.
- lechon-system-web/src/components/daily-sheets/InlineScheduleEditorModal.tsx: Schedule editor for Tahi, Salang, and Departure / Pickup overrides plus searchable rider assignment and remarks; Packaging is no longer exposed in this planner UI.
- lechon-system-web/src/components/manifest/PickupSettlementTab.tsx: Counter handover grid displaying walk-in pickups, outstanding balances, and direct cash/GCash settlement triggers.  
- lechon-system-web/src/components/manifest/LalamoveSettlementTab.tsx: Anti-loss courier gate table showing destination, balance due, visual status badges, and release clearance triggers.  
- lechon-system-web/src/components/manifest/SettlePickupModal.tsx: Reusable settlement dialog displaying pickup details, ₱0.00 delivery fee, payment method (Cash vs. Store GCash), and reference inputs.  
- lechon-system-web/src/components/ui/inventory/ReceiveStockModal.tsx: Streamlined single-view carcass intake modal with direct category steppers, paper DR tracking, live on-hand impact table, and atomic ledger commit.  
- lechon-system-web/src/components/ui/inventory/AdjustLedgerModal.tsx: Modal dialog for manual stock movements using dynamic category dropdowns and mandatory reason inputs.  
- lechon-system-web/src/components/cms/ChangePriceModal.tsx: Guarded modal replacing inline price inputs with diff calculations and peak-season warnings.  
- lechon-system-web/src/components/cms/EditCategoryModal.tsx: Modal dialog for updating category names, weight bounds, and safety stock.  
- lechon-system-web/src/components/cms/PriceHistorySheet.tsx: Slide-out drawer displaying chronological price change audit history.  
- lechon-system-web/src/components/cms/CreateUserModal.tsx: Modal dialog for provisioning counter cashier and owner logins with full name, username, initial password, and role selection.  
- lechon-system-web/src/components/cms/ResetPasswordModal.tsx: Modal dialog allowing business owners to override shift passwords for staff accounts.  

- Validation Schemas (Zod):

- lechon-system-web/src/schemas/orderSchema.ts: Zod schema validating POS order entries (`facebookName`, `source`, `eventType`, `landmark`, `riderDepartureTime`), dual mobile numbers (`customerPhone` and optional `customerPhone2` with min 10 digits validation), tri-modal delivery rules, and trusted customer downpayment rules, featuring `.superRefine` conditional intake rules enforcing relaxed identifiers for tentative drafts (`isDraft === true`) while strictly re-arming date, venue, phone, and cart requirements for production orders (`isDraft === false`).  
- lechon-system-web/src/schemas/inventorySchema.ts: Zod schema validating manual inventory adjustments with category selection and mandatory reason inputs (>= 5 chars).  

- Data Hooks (TanStack React Query):

- lechon-system-web/src/hooks/useAnalytics.ts: Hooks fetching sales velocity, delivery performance, and wastage metrics.  
- lechon-system-web/src/hooks/useCms.ts: Hooks and mutations managing category prices, cooking profiles, category lifecycles, and CMS pricing configuration (`useDeliveryPricing`, `useUpdateDeliveryPricing` carrying `baseFare`, `ratePerKm`, and `noFreebiesDiscountPerPig`).  
- lechon-system-web/src/hooks/useCustomers.ts: Debounced `useCustomerLookup` query and `useUpdateCustomerNotesMutation` hook for reactive Customer Intelligence & Complaint Radar.  
- lechon-system-web/src/hooks/useDashboard.ts: Hooks for dashboard operational lists and cancellation mutations.  
- lechon-system-web/src/hooks/useDebounce.ts: Utility hook to debounce high-frequency state updates (300ms) for directory search inputs.  
- lechon-system-web/src/hooks/useEditOrder.ts: Mutation hook for PUT /api/orders/{id} safe edits.  
- lechon-system-web/src/hooks/useInventory.ts: Hooks and mutations for dual stock balances, ledger audit history, and direct stock intake.  
- lechon-system-web/src/hooks/useKitchen.ts: Hooks and mutations for roasting roster queries and item cooking state progression.  
- lechon-system-web/src/hooks/useLogistics.ts: Hooks for unassigned order queues, today's operations, and driver assignment mutations.  
- lechon-system-web/src/hooks/useManifest.ts: Hooks and mutations for pending settlements across Riders, Store Pickups, and Lalamove couriers, including useRejectRiderSignatureMutation, useRevertCustodyMutation, and counted-amount enforced useOwnerApproveQrMutation.  
- lechon-system-web/src/hooks/useOrdersDirectory.ts: Hook managing polling, filtering, and retrieval of the Master Order Directory and audit logs.  
- lechon-system-web/src/hooks/useVoidPayment.ts: Owner-only dossier mutation for the payment void endpoint; invalidates order directory/detail, dashboard, manifest, and audit caches.
- lechon-system-web/src/hooks/useRiders.ts: Hook and mutation for fetching active riders and registering new freelance drivers.  
- lechon-system-web/src/hooks/useUsers.ts: TanStack Query hooks and mutations (`useUsersQuery`, `useCreateUserMutation`, `useUpdateUserPasswordMutation`, `useToggleUserStatusMutation`) for staff account governance.  
- lechon-system-web/src/hooks/useSchedules.ts: Hook fetching print-optimized daily sheets.

#### Mobile Companion App (`lechon-system-mobile` — Expo SDK 58 / React Native 0.88 / TypeScript):

- lechon-system-mobile/App.tsx: Root application entry point wrapping `SafeAreaProvider`, `QueryClientProvider`, `AuthProvider`, and `AuthGate`.
- lechon-system-mobile/src/services/apiClient.ts: Axios client with persistent `expo-secure-store` JWT Bearer interceptor, 401 unauthorized listener, and live toggle between Cloud API (`https://ronnvel-001-site1.ktempurl.com/api`) and Local Android Emulator API (`http://10.0.2.2:5199/api`).
- lechon-system-mobile/src/context/AuthContext.tsx: 12-hour shift session provider managing user identity, `isOwner` flag, and API environment state.
- lechon-system-mobile/src/components/MainShell.tsx: Authenticated 3-tab mobile shell (`📋 Orders`, `➕ New POS`, `👑 Drawer`) with compact top shift HUD.
- lechon-system-mobile/src/components/orders/OrderDossierModal.tsx: Slide-up customer dossier with customer/rider telemetry, Messenger receipt copier, editing/manual-payment/cancellation controls, full active-and-voided payment history, and an Owner-only mandatory-reason payment void confirmation overlay.
- lechon-system-mobile/src/components/orders/EditOrderModal.tsx: Mobile editor with two-tier Draft/Time-TBD semantics, Lechon vs. zero-weight extras-only mode, 12-hour `hh:mm` + AM/PM target/rider controls with 9:00 AM, 10:30 AM, 11:30 AM, 12:00 PM, and 3:00 PM presets, and restructured 3-row Financials card (Row 1: Transit Pricing, Row 2: Courtesy Discount, Row 3: Read-only locked downpayment banner with payment channel pill).
- lechon-system-mobile/src/components/orders/FloorActionView.tsx: Mobile Floor Action Hub displaying Section A (Action Required: Downpayment Radar with countdown badges, 1-tap Messenger reminder copier, multi-contact dialing selection alert for CP #1 / CP #2, and direct deposit logger) and Section B (Tonight's Defrost & Kitchen Prep Roster with Defrost Roster Carcass Bouncer strictly filtering out non-carcass add-ons and negative/zero weights, `[ 📋 Copy Defrost List ]` 1-tap clipboard generator, rush badges, carcass quantities, and bold monospace Tahi prep deadlines).
- lechon-system-mobile/src/screens/LoginScreen.tsx: Mobile shift login screen with API environment switcher pill and 1-tap Owner/Cashier demo credential buttons.
- lechon-system-mobile/src/screens/OrdersScreen.tsx: Master Order Hub with debounced search, compact previous/next/Today/Tomorrow/Clear date bar, server-side date queries, Tier-1 dateless draft isolation, and amber Tier-2 dated incomplete cards with Time/Venue/Size TBD tags, alongside existing balance-custody filters and Floor Action workflows.
- lechon-system-mobile/src/screens/PosScreen.tsx: Single-column touch POS with Draft and Time-TBD controls, Lechon vs. Non-Lechon extras-only intake modes, and 12-hour `hh:mm` + AM/PM selectors for target and rider departure times. Five one-tap presets update both time and meridiem; non-lechon mode restricts the catalog to `MinimumWeightKg === 0` and hides event/rider/freebie controls while retaining routing and payment fields.
- lechon-system-mobile/src/screens/DrawerScreen.tsx: 2-Hop Cash Custody & Tri-Modal Settlement Center supporting Hop 2 Owner Envelope Verification ("The Speed Bump"), Hop 1 Rider Settlement (2s QR polling + Safeguard 1 discrepancy rejection + Manual Override + Direct Store GCash), Walk-in Pickup Counter Collection, Safeguard 3 Custody Reversion ("Undo"), and Lalamove Pre-Release Gate.
- lechon-system-mobile/src/hooks/useOrders.ts: Hooks and mutations for mobile order directory, customer dossier, audit logs, manual payment logging, Owner-only payment voiding, and order cancellation.
- lechon-system-mobile/src/hooks/useFloorAction.ts: TanStack Query hooks fetching tomorrow's defrost roster (`useDefrostRosterQuery`, `GET /dashboard/roster`) and 4-day pending downpayment confirmations (`usePendingConfirmationsQuery`, `GET /dashboard/pending-confirmations`).
- lechon-system-mobile/src/hooks/usePos.ts: Hooks and mutations for catalog categories, inventory balances, CMS pricing (`useDeliveryPricingQuery` carrying `baseFare`, `ratePerKm`, and `noFreebiesDiscountPerPig`), multipart screenshot parsing, POS order creation, and order editing (`useUpdateOrderMutation`).
- lechon-system-mobile/src/hooks/useManifest.ts: Hooks and mutations for Rider, Pickup, and Lalamove settlements and 2-hop QR custody handshakes.
- lechon-system-mobile/src/utils/messengerTemplates.ts: Mobile Taglish Messenger confirmation receipt builder, downpayment reminder template `generateDownpaymentReminder` (privacy-shielded from internal IDs), `generateDefrostRosterMessage` 1-tap nightly freezer pull-list generator (hardened with the Defrost Roster Carcass Bouncer filtering non-carcass items), plus `calculateRiderDepartureTime` 6-tier distance helper.
- lechon-system-mobile/src/utils/messengerTextParser.ts: Mobile parser parity for specificity-ordered X-Large/XXL/XS aliases and real Messenger address, compact phone, date-range, paid-DP, and 7-freebies formats.
- lechon-system-mobile/src/utils/dateNormalizer.ts and src/components/orders/WalkInBadge.tsx: Flexible single-digit date normalization plus the reusable mobile `🚶 WALK-IN (WI)` marker used by order cards, dossiers, Floor Action owner review, and Drawer remittance streams.
- lechon-system-mobile/src/utils/similarityHelper.ts: Behaviorally identical mobile implementation of the multi-factor composite duplicate matching engine (`isPlaceholderPhone`, `cleanPhoneDigits`, `checkNameSimilarity`, `checkDateProximity`, `checkAddressOverlap`, `evaluateDuplicateOrders`) powering POS/Edit red duplicate warning cards and confirmation speedbump alerts.

### 2. API Contract Map

#### Orders & Ledger Domain (OrdersController.cs)

- POST /api/orders | Payload: CreateOrderRequest { CustomerName: string, ContactNumber: string, FacebookName?: string, Source: string, EventType?: string, Landmark?: string, TargetDeliveryTime: string (ISO8601), RiderDepartureTime?: string (ISO8601), Fulfillment: int, DeliveryAddress?: string, Remarks?: string, DeliveryFee?: decimal, Downpayment: decimal, IsTrustedCustomer: boolean, Items: [{ ItemCategoryId: int, Quantity: int }] } | Generates daily `OrderReference` (`MMDDYY-XXX`) and stamps `CreatedBy` from JWT claims.
- POST /api/orders/parse-screenshot | Payload: multipart/form-data (image: File) | Returns: ParsedOrderDraftDto  
- GET /api/orders/directory | Query: { searchTerm?: string, filterTab?: string, startDate?: string, endDate?: string } | Returns: OrderDirectoryDto[] (Searches across `CustomerName`, `FacebookName`, `ContactNumber`, `OrderReference`, and `Id`; executes server-side tab filtering for Upcoming, RecentlyModified, BalanceDue, Past30Days, Cancelled, and AllTime).
- PUT /api/orders/{id} | Payload: UpdateOrderDto { CustomerName?: string, ContactNumber?: string, FacebookName?: string, Source?: string, EventType?: string, Landmark?: string, TargetDeliveryTime: string (ISO8601), RiderDepartureTime?: string (ISO8601), DeliveryAddress: string, Remarks: string, Items: [{ ItemCategoryId: int, Quantity: int }] }. Owners may override past schedules; Cashiers may correct non-time fields but cannot set a changed target to the past.
- PATCH /api/orders/{id}/confirm-payment | Payload: None  
- PATCH /api/orders/{id}/confirm-delivery | Payload: None  
- PATCH /api/orders/{id}/cancel | Payload: { Reason: string } | Returns: 200 OK (Releases inventory, cancels order, logs audit trail with User.Identity.Name)  
- GET /api/orders/{id}/audit-logs | Payload: None | Returns: OrderAuditLog[]
- GET /api/orders/{id} | Returns: OrderDetailsDto (Enriched with `OrderReference`, `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`, `CustomerProfileId`, `CustomerTotalOrdersCount`, `CustomerPreferences`, `CustomerComplaintHistory`, assigned rider full name, rider phone, and routing status)  
- POST /api/orders/{orderId}/payments/{paymentLogId}/void | Headers: Authorization Bearer (`Owner` required; Cashier receives 403) | Payload: `VoidPaymentRequest { Reason: string, VoidedBy?: string }` | Returns: updated `OrderDetailsDto`; stamps void metadata, recomputes `Downpayment`/`BalanceDue` from non-voided successful logs, and appends `Payment Voided` to `OrderAuditLogs`.

#### Customer Intelligence Domain (CustomersController.cs)

- GET /api/customers/lookup?phone={phone}&fbName={fbName} | [Authorize(Roles = "Owner,Cashier")] | Returns: CustomerProfileDto (or null if not found)
- PUT /api/customers/{id}/notes | [Authorize(Roles = "Owner,Cashier")] | Payload: UpdateCustomerNotesRequest { Preferences?: string, ComplaintHistory?: string, IsVip?: bool } | Returns: CustomerProfileDto
- PUT /api/customers/by-phone/{phone}/notes | [Authorize(Roles = "Owner,Cashier")] | Payload: UpdateCustomerNotesRequest | Upserts customer notes by phone number and returns CustomerProfileDto  

#### CMS & Menu Pricing Domain (CmsController.cs)

- GET /api/cms/delivery-pricing | [Authorize(Roles = "Owner,Cashier")] | Returns: DeliveryPricingDto { BaseFare: decimal, RatePerKm: decimal, NoFreebiesDiscountPerPig: decimal }
- PUT /api/cms/delivery-pricing | [Authorize(Roles = "Owner")] | Payload: DeliveryPricingDto { BaseFare: decimal, RatePerKm: decimal, NoFreebiesDiscountPerPig: decimal } | Returns: DeliveryPricingDto
- GET /api/cms/categories | [Authorize(Roles = "Owner")] | Returns: ItemCategory[]  
- GET /api/cms/categories/{id}/price-history | [Authorize(Roles = "Owner")] | Returns: PriceHistoryLogDto[]  
- PUT /api/cms/categories/{id}/price | [Authorize(Roles = "Owner")] | Payload: UpdatePriceRequest { NewPrice: decimal, AdminName: string }  
- PUT /api/cms/categories/{id}/details | [Authorize(Roles = "Owner")] | Payload: CategoryMetadataDto { Name: string, MinimumWeightKg: decimal, MaximumWeightKg: decimal, MinimumSafetyStock: int }  
- PATCH /api/cms/categories/{id}/status | [Authorize(Roles = "Owner")] | Payload: None (Toggles IsActive flag)  
- PUT /api/cms/categories/{categoryId}/cooking-profile | [Authorize(Roles = "Owner")] | Payload: UpdateCookingProfileRequest { BaseDurationMinutes: int, MultiplierPerKg: decimal }  
- POST /api/cms/categories | [Authorize(Roles = "Owner")] | Payload: CreateCategoryRequest { Name: string, BasePrice: decimal, CategoryType: string }  
- DELETE /api/cms/categories/{categoryId} | [Authorize(Roles = "Owner")] | Payload: None  

#### Dashboard Domain (DashboardController.cs)

- GET /api/dashboard/pending-confirmations (alias: /api/dashboard/tasks/pending-confirmations) | Headers: Authorization: Bearer (Roles = "Owner,Cashier") | Returns: PendingConfirmationDto[] (Active non-cancelled orders with Downpayment == 0 and TargetDeliveryTime <= Today + 4 days, including ItemsSummary and contact info)
- GET /api/dashboard/tasks/delivery-verifications | Payload: None | Returns: DeliveryVerificationDto[]  
- GET /api/dashboard/roster (alias: /api/dashboard/tasks/defrost-roster) | Headers: Authorization: Bearer (Roles = "Owner,Cashier") | Returns: DefrostRosterDto[] (Tomorrow's roasting carcasses by Tahi priority with ItemCategoryId, IsRushDefrost, and prep metadata)
- GET /api/dashboard/tasks/renegotiations | Payload: None | Returns: RenegotiationTaskDto[]  
- POST /api/dashboard/renegotiations/{id}/agree | Payload: None | [Authorize(Roles = "Owner")]  
- POST /api/dashboard/renegotiations/{id}/waive | Payload: None | [Authorize(Roles = "Owner")]  

#### Logistics, Riders & Settlement Domain (LogisticsController.cs & PaymentWebhookController.cs)

- GET /api/logistics/unassigned | Payload: None | Returns: Order[]  
- POST /api/logistics/assign-rider | Payload: { RiderName: string, VehicleType: string, OrderIds: int[] }  
- GET /api/logistics/active-trips | Payload: None | Returns: DeliveryTrip[]  
- POST /api/logistics/trips/{tripId}/settle | Payload: { RemittedAmount: decimal }  
- GET /api/riders | Payload: None | Returns: RiderDto[] (List of active freelance riders with phone numbers)  
- POST /api/riders | Payload: { FullName: string, PhoneNumber: string } | Returns: RiderDto  
- GET /api/logistics/settlements/pickups | Payload: None | Returns: PendingPickupSettlementDto[]  
- GET /api/logistics/settlements/lalamove | Payload: None | Returns: PendingLalamoveSettlementDto[]  
- POST /api/logistics/settlements/lalamove/{orderId}/release | Payload: None | Returns: 200 OK (rejects unpaid orders with 400 BadRequest)  
- POST /api/internal/payments/manual | Payload: ManualPaymentDto { OrderId: int, Amount: decimal, PaymentMethod: string ("Physical Cash" | "Store GCash"), ReferenceNumber?: string, Notes?: string } | Returns: PaymentLog
- POST /api/logistics/settlements/qr-session | Headers: Authorization: Bearer | Payload: CreateQrSessionRequest { OrderId: int, HopStage: string, PaymentMethod: string, ExpectedAmount: decimal, ReferenceNumber?: string } | Returns: QrSessionDto { Token: string, ExpiresAt: DateTime, ... }
- GET /api/logistics/settlements/qr-session/{token} | Public (Token-Guarded) | Returns: QrSessionStatusDto (Polled every 2s by PC modal and used to hydrate mobile QR page)
- POST /api/logistics/settlements/qr-session/{token}/rider-sign | Public (Token-Guarded) | Payload: RiderSignRequest { RiderName: string, RemittedAmount: decimal } | Returns: QrSessionStatusDto
- POST /api/logistics/settlements/qr-session/{token}/reject | Headers: Authorization: Bearer (Roles = "Owner,Cashier") | Resets session status from SignedByRider to PendingScan, clears rider remittance fields, and notifies mobile client of discrepancy rejection.
- POST /api/logistics/settlements/qr-session/{token}/staff-validate | Headers: Authorization: Bearer | Payload: { ManualOverrideRiderName?: string, ManualOverrideAmount?: decimal } | Returns: 200 OK (Transitions order custody to InStaffDrawer and stamps StaffValidatedBy from JWT)
- POST /api/logistics/settlements/orders/{orderId}/revert-custody | Headers: Authorization: Bearer (Roles = "Owner,Cashier") | Reverts order custody from InStaffDrawer back to Uncollected, expires active Hop 2 QR sessions, and records immutable OrderAuditLog (authorized only to holding cashier or owner).
- POST /api/logistics/settlements/qr-session/{token}/owner-approve | Public (Owner PIN/Credentials) or Headers: Authorization: Bearer | Payload: OwnerApproveRequest { CountedAmount: decimal, OwnerUsername?: string, OwnerPinOrPassword?: string } | Enforces physical envelope counted cash verification matching expected amount (returns 400 BadRequest on mismatch), transitions order to Settled, writes PaymentLog, and burns token.  

#### Roasting & Scheduling Domain (RoastingController.cs & SchedulesController.cs)

- GET /api/schedules/roster | Payload: None | Returns: OrderItemSchedule[] (Anchored on `RiderDepartureTime ?? TargetDeliveryTime`)
- GET /api/schedules/daily-sheets | Payload: None | Returns: { KitchenSheet: [...], RiderSheet: [...] }  
- PATCH /api/roasting/items/{id}/status | Payload: { Status: string }  
- PUT /api/schedules/items/{orderItemId}/override | Payload: OverrideScheduleRequest { TahiStartTime?: DateTime, SalangStartTime?: DateTime, PackagingStartTime?: DateTime, RiderName?: string, Remarks?: string } | Returns: OrderItemSchedule  

#### Inventory & Procurement Domain (InventoryController.cs & ProcurementController.cs)

- GET /api/inventory/categories | Payload: None | Returns: ItemCategory[]  
- GET /api/inventory/balances | Payload: None | Returns: InventoryBalanceDto[] (PhysicalStock, LockedStock, AvailableStock, MinimumSafetyStock, HealthStatus)  
- GET /api/inventory/transactions | Payload: None | Returns: InventoryTransactionDto[]  
- POST /api/inventory/transactions | Payload: { ItemCategoryId: int, Quantity: int, TransactionType: string, Reason: string, ReferenceId?: string }  
- GET /api/procurement/alerts | Payload: None | Returns: LowStockAlert[]  
- POST /api/procurement/generate-po | Payload: { ItemCategoryIds: int[] } | Returns: PurchaseOrder  
- POST /api/inventory/receive | Payload: ReceiveStockRequest { SupplierDrNumber?: string, Notes?: string, Items: [{ ItemCategoryId: int, Quantity: int }] } | Returns: { Success: boolean, Message: string, TotalCarcassesReceived: int }  

#### Authentication & Identity Domain (AuthController.cs)

- POST /api/auth/login | Payload: LoginRequest { Username: string, Password: string } | Returns: AuthResponseDto { Token: string, Username: string, FullName: string, Role: string, ExpiresAt: DateTime } (Blocks deactivated accounts with 401 Unauthorized)
- GET /api/auth/me | Headers: Authorization: Bearer | Returns: UserDto  

#### Staff Account Governance Domain (UsersController.cs)

- GET /api/users | [Authorize(Roles = "Owner")] | Returns: UserListItemDto[] (Ordered by Owner first, then by CreatedAt asc)
- POST /api/users | [Authorize(Roles = "Owner")] | Payload: CreateUserRequest { Username: string, Password: string, FullName: string, Role: string } | Returns: 201 Created (UserListItemDto)
- PUT /api/users/{id}/password | [Authorize(Roles = "Owner")] | Payload: UpdateUserPasswordRequest { NewPassword: string } | Returns: { message: string }
- PATCH /api/users/{id}/status | [Authorize(Roles = "Owner")] | Payload: UpdateUserStatusRequest { IsActive: bool } | Returns: UserListItemDto (Enforces Owner self-preservation guard)  

#### Finance & Analytics Domain (PaymentWebhookController.cs & AnalyticsController.cs)

- POST /api/webhooks/payments/{provider} | Payload: { GatewayReferenceId: string, Amount: decimal, Status: string, OrderId: int }  
- GET /api/analytics/sales | Payload: None | Returns: { TotalRevenue: decimal, OrderCount: int, ... }  
- GET /api/analytics/delivery-performance | Payload: None | Returns: { OnTimeRate: decimal, DelayedCount: int, ... }  
- GET /api/analytics/wastage | Payload: None | Returns: { TotalWastageCost: decimal, WasteEvents: int, ... }  

### 3. State & Caching Map (TanStack React Query)

#### Global Services & Interceptors:

- Axios Request Interceptor: Injects Authorization: Bearer ${token} on all outgoing requests when authenticated.  
- Axios Response Interceptor: Catches 401 Unauthorized, purges stored credentials, and routes to /login.  

#### Dashboard Scope (useDashboard.ts):

- usePendingConfirmations -> Query Key: ['dashboard', 'pending-confirmations']  
- useDeliveryVerifications -> Query Key: ['dashboard', 'delivery-verifications']  
- useDefrostRoster -> Query Key: ['dashboard', 'defrost-roster']  
- useRenegotiationTasks -> Query Key: ['dashboard', 'renegotiations']  
- useCancelOrderMutation -> Success Invalidates: ['dashboard', 'pending-confirmations'], ['inventory', 'balances'], ['orders', 'directory']

#### Master Directory & Order Edit Scope (useOrdersDirectory.ts & useEditOrder.ts):

- useOrdersDirectory(searchTerm, filterTab) -> Query Key: ['orders', 'directory', { searchTerm, filterTab }]  
- useOrderAuditLogs -> Query Key: ['orders', 'audit-logs', orderId]  
- useEditOrder -> Success Invalidates: ['orders'], ['order'], ['roster'], ['dashboard'], ['schedules'], ['inventory', 'balances']  
- useVoidPaymentMutation -> Success Invalidates: `['orders']`, `['order', orderId]`, `['dashboard']`, `['manifest']`, and the selected order audit-log key. Web owns the dedicated `useVoidPayment.ts`; Mobile exposes the parity mutation from `useOrders.ts`.

#### Kitchen Scope (useKitchen.ts):

- useRosterQuery -> Query Key: ['roster']  
- useUpdateStatusMutation -> Success Invalidates: ['roster'], ['orders', 'directory'], ['logistics', 'unassigned-orders']  

#### Logistics & Riders Scope (useLogistics.ts & useRiders.ts):

- useUnassignedOrders -> Query Key: ['logistics', 'unassigned-orders'] (staleTime: 30s)  
- useTodayOperations -> Query Key: ['schedules', 'daily-sheets'] (staleTime: 30s)  
- useAssignRider -> Success Invalidates: ['logistics', 'unassigned-orders'], ['schedules', 'daily-sheets'], ['orders', 'directory'], ['manifest', 'pending-settlement']  
- useRidersQuery -> Query Key: ['riders']  
- useSaveRiderMutation -> Success Invalidates: ['riders']  

#### Manifest & Settlement Scope (useManifest.ts):

- usePendingSettlementsQuery -> Query Key: ['manifest', 'pending-settlement']  
- usePendingPickupsQuery -> Query Key: ['manifest', 'pickups']  
- usePendingLalamoveQuery -> Query Key: ['manifest', 'lalamove']  
- useSettleTripMutation -> Success Invalidates: ['manifest', 'pending-settlement'], ['orders', 'directory'], ['dashboard']  
- useSettlePickupPaymentMutation -> Success Invalidates: ['manifest', 'pickups'], ['manifest', 'lalamove'], ['manifest', 'pending-settlement'], ['dashboard'], ['orders']  
- useReleaseLalamoveMutation -> Success Invalidates: ['manifest', 'lalamove'], ['dashboard'], ['orders']  
- useCreateQrSessionMutation -> Generates 1-time cryptographic settlement token for Hop 1 (Rider) or Hop 2 (Owner).  
- useQrSessionStatusQuery(token) -> Query Key: ['manifest', 'qr-session', token] (Configured with refetchInterval: 2000 while modal or mobile slip is open).  
- useRiderSignQrMutation -> Submits rider name and remitted peso amount from mobile browser.  
- useStaffValidateQrMutation -> Success Invalidates: ['manifest', 'qr-session', token], ['manifest', 'pending-settlement'], ['manifest', 'pickups'], ['dashboard'], ['orders']  
- useOwnerApproveQrMutation -> Success Invalidates: ['manifest', 'qr-session', token], ['manifest', 'pending-settlement'], ['manifest', 'pickups'], ['dashboard'], ['orders']

#### Inventory & Procurement Scope (useInventory.ts):

- useInventoryBalances -> Query Key: ['inventory', 'balances']  
- useInventoryTransactions -> Query Key: ['inventory', 'transactions']  
- useInventoryCategories -> Query Key: ['inventory', 'categories']  
- useProcurementAlerts -> Query Key: ['procurement', 'alerts']  
- useLogTransactionMutation -> Success Invalidates: ['inventory', 'balances'], ['inventory', 'transactions'], ['procurement', 'alerts'], ['dashboard']  
- useReceiveStockMutation (POST /api/inventory/receive) -> Success Invalidates: ['inventory', 'balances'], ['inventory', 'transactions'], ['procurement', 'alerts'], ['dashboard']  

#### CMS & Menu Configuration Scope (useCms.ts):

- useDeliveryPricing -> Query Key: ['cms', 'delivery-pricing']
- useUpdateDeliveryPricing -> Success Invalidates: ['cms', 'delivery-pricing']
- usePriceHistoryQuery -> Query Key: ['cms', 'price-history', categoryId]  
- useUpdatePriceMutation -> Success Invalidates: ['inventory', 'categories'], ['cms', 'price-history'], ['dashboard', 'renegotiations']  
- useUpdateCategoryDetailsMutation -> Success Invalidates: ['inventory', 'categories'], ['inventory', 'balances'], ['procurement', 'alerts']  
- useToggleCategoryStatusMutation -> Success Invalidates: ['inventory', 'categories'], ['inventory', 'balances']  
- useUpdateCookingProfileMutation -> Success Invalidates: ['inventory', 'categories'], ['roster']  
- useCreateCategoryMutation -> Success Invalidates: ['inventory', 'categories'], ['inventory', 'balances']  

#### Staff & Terminal Accounts Scope (useUsers.ts):

- useUsersQuery -> Query Key: ['users']
- useCreateUserMutation -> Success Invalidates: ['users']
- useUpdateUserPasswordMutation -> Success Invalidates: ['users']
- useToggleUserStatusMutation -> Success Invalidates: ['users']  

#### Analytics Scope (useAnalytics.ts):

- useSalesQuery -> Query Key: ['analytics', 'sales']  
- useDeliveryPerformanceQuery -> Query Key: ['analytics', 'delivery']  
- useWastageQuery -> Query Key: ['analytics', 'wastage']  

#### Print Views Scope (useSchedules.ts):

- useDailySheetsQuery -> Query Key: ['schedules', 'daily-sheets']  
- useOverrideScheduleMutation -> Success Invalidates: ['schedules', 'daily-sheets'], ['roster'], ['logistics', 'unassigned-orders']  

#### Global POS Mutation:

- useCreateOrderMutation (POST /api/orders) -> Success Invalidates: ['dashboard', 'pending-confirmations'], ['roster'], ['schedules', 'daily-sheets'], ['orders', 'directory'], ['inventory', 'balances']  
- useParseScreenshotMutation (POST /api/orders/parse-screenshot) -> Returns structured draft; does not invalidate database cache keys since it only hydrates client form state.  

### 4. Component Routing (React Router)

#### Public / Auth Flow:

- GET /login -> renders (Public 12-hour shift authentication card)
- GET /qr-settle/:token -> Renders <QrSignPage /> (Standalone mobile-optimized digital signature slip and handover receipt; bypasses global sidebar and login wall via cryptographic token guard)

#### Administrative Flow (Wrapped with and maintains global navigation sidebar):

- GET / -> renders (Command center: KPI cards, collapsible alert feeds, defrost & dispatch roster)  
- GET /orders -> renders (Master Order Directory with search, filters, state tabs, and dossier drawer; Financial Splits lists active/voided transactions and exposes mandatory-reason `[🗑️ Void]` only to Owners)
- GET /logistics -> renders <LogisticsPage /> (Dedicated single-view Live Operations command center with primary launcher for the 13-column Daily Dispatch Planner)  
- GET /manifest -> renders (Tri-tab daily settlement center: Freelance Riders, Store Pickups, Lalamove Gate)  
- GET /inventory -> renders (Dual-stock live ledger, chronological audit log, direct intake trigger)  
- GET /cms -> renders (Delivery Pricing Configuration, Menu item prices, category details, safety stock buffers, cooking profiles, and price history audit log). Gated strictly to [Owner] role.  

#### Dormant / Deep-Link Only:

- GET /kitchen -> renders (Kanban roasting workflow interface; hidden from sidebar)  
- GET /analytics -> renders (Business intelligence charts; hidden from sidebar)  

#### Print-Optimized Flow (Suppresses global sidebar and header):

- GET /daily-sheets -> renders (Hosts KitchenViewTab and RiderViewTab)

### 5. Whole Lechon Freebies & Confirmation Extension

#### Backend Contracts and Endpoints

- `LechonSystem.Api/Models/Order.cs` persists `FreebiesSummary`, `FreebiesConfigJson`, `DownpaymentMethod`, `IsOwnerConfirmed`, `OwnerConfirmedAt`, and `OwnerConfirmedBy`.
- `LechonSystem.Api/Models/PaymentLog.cs` persists canonical BIR `PaymentMethod` values: `Cash`, `GCash`, `Maya`, or `Bank Transfer`.
- `POST /api/orders/{id}/confirm-owner` is Owner-only and stamps confirmation metadata plus an immutable audit entry.
- `GET /api/dashboard/pending-owner-confirmations` is available to Owner/Cashier clients and returns active cashier orders awaiting review.
- `GET /api/customers/lookup` includes `ActiveUpcomingOrders` and returns a wrapper even when no `CustomerProfile` row exists but a matching active order does.
- Order directory/details expose channel aggregates and payment-log methods; daily sheets project `FreebiesSummary` for staff badges.

#### Web Files

- `lechon-system-web/src/utils/freebiesHelper.ts`: Canonical seven-item defaults, Raw Innards quota, opt-out state, JSON hydration, and compact summary formatting.
- `lechon-system-web/src/components/ui/orders/FreebiesSelector.tsx`: Collapsed smart-pill selector shared by POS and edit forms.
- `lechon-system-web/src/components/ui/orders/PaymentChannelPills.tsx`: Cash, GCash, Maya, and Bank Transfer selector.
- `DashboardPage.tsx`, `OrdersPage.tsx`, and Manifest settlement modals expose Owner review and BIR channel visibility/actions.

#### Mobile Files

- `lechon-system-mobile/src/utils/freebiesHelper.ts`: Behaviorally synchronized copy of the web freebies engine.
- `lechon-system-mobile/src/hooks/useNotifications.ts`: Authenticated permission/channel setup, 9:00 AM deposit reminder, 4:00 PM defrost reminder, Owner-queue increase alerts, Rush Defrost alerts, and test alerts.
- `PosScreen.tsx` and `EditOrderModal.tsx` implement duplicate speed bumps, freebies, and four-channel selection; `FloorActionView.tsx` and `OrderDossierModal.tsx` implement Owner actions and operational visibility.

**
