**

# Codebase Architecture Map

### 1. Directory Tree

#### Backend (.NET 10 Web API):

- LechonSystem.Api/Controllers/AnalyticsController.cs: Exposes read-optimized aggregations for business intelligence (sales velocity, delivery SLAs, material wastage) using .AsNoTracking().
    
- LechonSystem.Api/Controllers/AuthController.cs: Exposes POST /api/auth/login for 12-hour shift issuance and GET /api/auth/me for user profile retrieval.
    
- LechonSystem.Api/Controllers/CmsController.cs: Exposes endpoints for mutating global menu pricing, category cooking profiles, creating/soft-deleting item categories, fetching chronological price history logs, and reading/updating CMS Delivery Pricing rates (`GET /api/cms/delivery-pricing`, `PUT /api/cms/delivery-pricing`).
    
- LechonSystem.Api/Controllers/CustomersController.cs: Exposes endpoints for reactive customer profile lookups by phone or Facebook name (`GET /api/customers/lookup`) and updating/upserting customer preferences and complaint history notes (`PUT /api/customers/{id}/notes`, `PUT /api/customers/by-phone/{phone}/notes`).
    
- LechonSystem.Api/Controllers/DashboardController.cs: Exposes read-only queries for operational widgets (pending confirmations <= 4 days, verifications <= 2 days, defrost roster, and peak-season price renegotiation targets).
    
- LechonSystem.Api/Controllers/InventoryController.cs: Exposes endpoints to retrieve item categories, dual-stock live balances (physical on-hand vs. 14-day forward commitments), direct freezer receiving, and an auditable chronological history of physical stock ledger movements.
    
- LechonSystem.Api/Controllers/LogisticsController.cs: Handles HTTP requests for retrieving unassigned ReadyForDelivery items, committing batch rider dispatches, tri-modal counter settlements, and Lalamove pre-release verification.
    
- LechonSystem.Api/Controllers/OrdersController.cs: Provides endpoints for order ingestion with user attribution (CreatedBy), daily OrderReference generation (`MMDDYY-XXX`), manual lifecycle state transitions, cancellation workflows, Master Ledger directory retrieval, safe order modifications, and retrieving immutable change audit logs.
    
- LechonSystem.Api/Models/SettlementQrSession.cs: Entity tracking one-time cryptographic QR tokens, hop stage (RiderToStaff vs. StaffToOwner), rider digital signature fields, staff validation stamps, owner approval stamps, and token expiration.
    
- LechonSystem.Api/Models/SystemSetting.cs: Key-value configuration entity storing dynamic store settings (`DeliveryFeeBaseFare`, `DeliveryFeeRatePerKm`) with `UpdatedBy` and `UpdatedAt` audit attribution.
    
- LechonSystem.Api/DTOs/DeliveryPricingDto.cs: Data contract carrying `BaseFare` (default `100.00m`) and `RatePerKm` (default `15.00m`) for CMS delivery rate governance.
    
- LechonSystem.Api/DTOs/QrSettlementDtos.cs: Request/response contracts for generating QR sessions, polling session state, submitting rider mobile signatures, validating staff drawer custody, and executing owner final sign-off.
    
- LechonSystem.Api/DTOs/OrderDetailsDto.cs: Heavy dossier projection enriched with `OrderReference`, `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`, `AssignedRiderName`, `AssignedRiderPhone`, `RoutingStatus`, and `CreatedBy`.
    
- LechonSystem.Api/Controllers/PaymentWebhookController.cs: Handles asynchronous callbacks from payment gateways and manual drawer/counter cash payments via /api/internal/payments/manual.
    
- LechonSystem.Api/Controllers/ProcurementController.cs: Exposes real-time low-stock safety threshold flags and automated draft shopping lists for Messenger communication.
    
- LechonSystem.Api/Controllers/RidersController.cs: Thin endpoints for fetching active freelance riders and quick-registering ad-hoc drivers into the registry.
    
- LechonSystem.Api/Controllers/RoastingController.cs: Processes HTTP PATCH requests to transition sequential cooking states (Raw, Cooking, Cooked, ReadyForDelivery) for specific order items.
    
- LechonSystem.Api/Controllers/SchedulesController.cs: Exposes the active timeline-driven kitchen roster and daily dispatch sheets for operational tracking.
    
- LechonSystem.Api/Services/AiIntakeParserService.cs: Service handling image payload ingestion and structured JSON schema querying against Gemini multimodal API.
    
- LechonSystem.Api/Services/AnalyticsService.cs: Computes business metrics, wastage statistics, delivery SLA adherences, and revenue totals.
    
- LechonSystem.Api/Services/AuthService.cs: Handles BCrypt password hashing, verification, user authentication, and 12-hour JWT token generation.
    
- LechonSystem.Api/Services/CmsService.cs: Manages category lifecycles, mutates base prices, updates roasting profile parameters, manages `SystemSettings` delivery pricing (`GetDeliveryPricingAsync`, `UpdateDeliveryPricingAsync`), and writes immutable PriceHistoryLog audit records.
    
- LechonSystem.Api/Services/CustomerService.cs: Normalizes customer phone numbers, performs reactive customer intelligence lookups (`LookupCustomerAsync`) with lazy historical order seeding, and manages preferences/complaint history updates (`UpdateCustomerNotesAsync`, `UpsertCustomerNotesByPhoneAsync`).
    
- LechonSystem.Api/Services/ICustomerService.cs: Service contract for customer profile lookups and note updates.
    
- LechonSystem.Api/Services/DashboardService.cs: Aggregates urgent staff action items across confirmation windows, verification schedules, roasting queues, and pricing renegotiation queues.
    
- LechonSystem.Api/Services/InventoryService.cs: Manages physical stock ledgers, executes rolling 14-day committed reservation hold calculations (Available = Physical - Locked), and processes atomic freezer stock intake.
    
- LechonSystem.Api/Services/LogisticsService.cs: Manages freelance driver dispatches, tri-modal settlement queries (Riders, Store Pickups, Lalamove), courier release validation gates, and COD reconciliations.
    
- LechonSystem.Api/Services/OrderService.cs: Core transaction processor; handles order creation with server-side price snapshotting, daily `OrderReference` sequence generation (`MMDDYY-XXX`), user identity stamping (`CreatedBy`), `RiderDepartureTime` routing safeguards, safe editing, order cancellations, and writing `OrderAuditLog` entries.
    
- LechonSystem.Api/Services/PaymentService.cs: Manages asynchronous payment reconciliations, verification logs, counter settlements, and automated reservation conversions.
    
- LechonSystem.Api/Services/ProcurementService.cs: Evaluates stock availability against minimum safety thresholds and formats supplier shopping lists.
    
- LechonSystem.Api/Services/RoastingService.cs: Controls roasting queue progress and cooking status transitions for scheduled order items.
    
- LechonSystem.Api/Services/SchedulingService.cs: Calculates backward-production schedules anchored on `RiderDepartureTime ?? TargetDeliveryTime`, roasting intervals, and daily driver dispatch manifests.
    
- LechonSystem.Api/Services/SmsNotificationService.cs: Implementation of INotificationSender dispatching transactional SMS alerts for order milestones.
    
- LechonSystem.Api/Data/LechonDbContext.cs: Entity Framework Core database context configuring entity schemas, relationships, soft-delete query filters, seed data (Riders, Users, Categories, SystemSettings), and decimal precisions.
    
- LechonSystem.Api/Models/BaseEntity.cs: Abstract foundation entity providing primary keys and created timestamps.
    
- LechonSystem.Api/Models/CustomerProfile.cs: Customer intelligence entity indexed uniquely on `ContactNumber`, storing `FullName`, `FacebookName`, `DefaultAddress`, `DefaultLandmark`, `Preferences`, `ComplaintHistory`, `IsVip`, and `TotalOrdersCount`.
    
- LechonSystem.Api/Models/FulfillmentType.cs: Dedicated enum specifying Pickup = 0, Delivery = 1, and Lalamove = 2.
    
- LechonSystem.Api/Models/ItemCategory.cs: Sellable category entity with weight boundaries, base pricing, and safety stock limits.
    
- LechonSystem.Api/Models/Order.cs: Master order header capturing `OrderReference` (`MMDDYY-XXX`), customer identity, `FacebookName`, `Source`, `EventType`, `Landmark`, `TargetDeliveryTime`, `RiderDepartureTime`, financial snapshots, `CreatedBy` username, and fulfillment mode.
    
- LechonSystem.Api/Models/OrderItem.cs: Line item entity representing roasted carcass size tiers and dynamic add-ons.
    
- LechonSystem.Api/Models/OrderItemSchedule.cs: Kitchen timing entity tracking Tahi, Salang, Packaging timestamps, manual overrides, and assigned riders.
    
- LechonSystem.Api/Models/InventoryReservation.cs: Forward stock hold entity locking carcasses against 14-day operational windows.
    
- LechonSystem.Api/Models/InventoryTransaction.cs: Immutable stock movement ledger (StockIn, StockOut, Adjustments) with mandatory audit reasons.
    
- LechonSystem.Api/Models/DeliveryTrip.cs: Logistics grouping entity tracking driver dispatches and trip completion.
    
- LechonSystem.Api/Models/Rider.cs: Entity storing freelance rider profiles (Id, FullName, PhoneNumber, IsActive).
    
- LechonSystem.Api/Models/User.cs: Entity representing store users (Id, Username, PasswordHash, FullName, Role, IsActive, CreatedAt).
    
- LechonSystem.Api/Models/OrderAuditLog.cs: Flight recorder entity capturing field-level changes, old/new diffs, timestamps, and ChangedBy user signatures.
    
- LechonSystem.Api/Models/PriceHistoryLog.cs: Immutable audit record of base price adjustments with deltas and author attribution.
    
- LechonSystem.Api/Models/PaymentLog.cs: Financial ledger tracking downpayments, counter cash collections, and GCash transactions.
    
- LechonSystem.Api/DTOs/AuthDtos.cs: Request and response carriers (LoginRequest, AuthResponseDto, UserDto).
    
- LechonSystem.Api/DTOs/CategoryMetadataDto.cs: Payload contract for updating category name, weight boundaries, and minimum safety stock.
    
- LechonSystem.Api/DTOs/CreateCategoryRequest.cs: Request contract for creating a new sellable item category.
    
- LechonSystem.Api/DTOs/CreateOrderRequest.cs: Nested data structure capturing customer details, `FacebookName`, `Source`, `EventType`, `Landmark`, `TargetDeliveryTime`, `RiderDepartureTime`, financial values, trusted flags, and item arrays.
    
- LechonSystem.Api/DTOs/CustomerProfileDto.cs: Data contracts (`CustomerProfileDto`, `UpdateCustomerNotesRequest`) for customer intelligence lookups and preference/complaint radar updates.
    
- LechonSystem.Api/DTOs/InventoryBalanceDto.cs: Read-optimized DTO projecting aggregated physical on-hand stock, 14-day locked commitments, sellable available balances, safety levels, and health status badges per category.
    
- LechonSystem.Api/DTOs/InventoryTransactionDto.cs: Flattened DTO serializing ledger transaction records with enum-to-string mappings and mandatory reason audit strings.
    
- LechonSystem.Api/DTOs/OrderDirectoryDto.cs: Read-optimized flattened projection of order headers (`OrderReference`, `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`), financial figures, and cash custody tracking attributes (`SettlementCustodyStatus`, `RiderName`, `IsRemittedToOwner`) for the Master Order Directory.
    
- LechonSystem.Api/DTOs/OverrideScheduleRequest.cs: Request payload for manual adjustments to Tahi, Salang, Packaging times, remarks, or rider assignments on the daily sheet.
    
- LechonSystem.Api/DTOs/ParsedOrderDraftDto.cs: Data transfer object projecting extracted customer, delivery, financial, and item data from an intake image.
    
- LechonSystem.Api/DTOs/PendingPickupSettlementDto.cs: Projection DTO for walk-in store pickup orders pending drawer cash settlement (BalanceDue, IsPaidInFull, IsTrustedCustomer, Address, Remarks).
    
- LechonSystem.Api/DTOs/PendingLalamoveSettlementDto.cs: Projection DTO for Lalamove courier orders (BalanceDue, IsClearedForRelease, IsReleased, DeliveryAddress, Remarks).
    
- LechonSystem.Api/DTOs/PriceHistoryLogDto.cs: Projection DTO returning chronological price changes, deltas, and admin timestamps.
    
- LechonSystem.Api/DTOs/ReceiveStockRequest.cs: Request payload capturing optional SupplierDrNumber, general intake remarks, and an array of received category items with quantities.
    
- LechonSystem.Api/DTOs/RenegotiationTaskDto.cs: Projection of advance orders booked with prices below current base rates for peak season renegotiation.
    
- LechonSystem.Api/DTOs/RiderDto.cs: Data contracts for RiderDto and CreateRiderRequest.
    
- LechonSystem.Api/DTOs/UpdateCookingProfileRequest.cs: Payload contract for updating category-level roasting duration and weight multiplier formulas.
    
- LechonSystem.Api/DTOs/UpdateOrderDto.cs: Strict contract for non-destructive order edits (`CustomerName`, `FacebookName`, `Source`, `EventType`, `Landmark`, `TargetDeliveryTime`, `RiderDepartureTime`, `DeliveryAddress`, `Remarks`, `Items`).
    
- LechonSystem.Api/DTOs/UpdatePriceRequest.cs: Payload contract for category base price changes and admin signatures.

#### Frontend (React SPA / Vite / TypeScript)

- Core Application, Auth & Utilities:

- lechon-system-web/src/App.tsx: Sets up React Router DOM routing tree, authentication gate wrappers (ProtectedRoute), layout wrappers, and root toast/query providers.  
- lechon-system-web/src/context/AuthContext.tsx: Global authentication state provider managing user profile, active JWT token, 12-hour shift persistence, and login/logout handlers.  
- lechon-system-web/src/services/apiClient.ts: Axios client pre-configured with base URL, JWT bearer request interceptors, and 401 response interceptors.  
- lechon-system-web/src/utils/messengerTemplates.ts: Formatter utilities generating privacy-shielded Taglish Messenger clipboard strings (omitting internal `#OrderReference` IDs and displaying `Landmark`), plus shared `calculateRiderDepartureTime` 6-tier distance ladder and quick-select pill constants.
- lechon-system-web/src/utils/messengerTextParser.ts: Client-side heuristic parser converting pasted Messenger chat logs into `ParsedOrderDraftDto` (extracting customer name, phone, `FacebookName`, `Landmark`, `EventType`, delivery time, and items).
- lechon-system-web/src/components/manifest/QrSettlementModal.tsx: Interactive PC modal with overflow-locked widescreen/mobile-safe container (`overflow-x-hidden max-w-lg w-full p-6 rounded-xl`), rendering dynamic one-time QR codes (qrcode.react), 2-second live signature polling, symmetrical 2-column Hop 1 discrepancy action grid (`h-11` aligned `[✅ Validate & Receive into Drawer]` and `[🔄 Ask Rider to Re-enter]` buttons), Hop 2 Owner counted-amount physical envelope speed bump, and authenticated `[↩️ Revert Custody to Uncollected]` undo trigger.
- lechon-system-web/src/pages/QrSignPage.tsx: Standalone mobile-first public web view (/qr-settle/:token) branded with `/yumi-logo.png` and Deep Roasted Espresso header, allowing riders to digitally sign remittances (with reactive rejection notification alert when cashier requests re-entry) and owners to verify counted envelope cash bills and approve staff cash handovers from their smartphones, culminating in a screenshot-ready Digital Receipt.  

- Pages (Views):

- lechon-system-web/src/pages/LoginPage.tsx: Warm Culinary Enterprise shift login screen featuring prominent `/yumi-logo.png` emblem, warm espresso-to-terracotta gradient backdrop, Yumi's Lechon Crimson (`#C81E1E`) sign-in trigger, and 1-click demo credential hydration.  
- lechon-system-web/src/pages/DashboardPage.tsx: Widescreen operational command center with balanced 3-card KPI grid, `#OrderReference` badges, collapsible zero-inbox alert feeds, and direct POS quick-launch triggers.  
- lechon-system-web/src/pages/OrdersPage.tsx: Master Order Directory and slide-out Customer Dossier displaying `#OrderReference` (`#MMDDYY-XXX`), `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`, live rider contact telemetry, in-dossier cancellation dialog with mandatory reason, and 1-click Messenger sharing. Features secondary granular sub-pill filtering under Balance Due (`balanceSubFilter`: `'all' | 'rider' | 'drawer' | 'future'`), financial table row custody micro-badges (`🟡 In Drawer`, `🛵 Road Cash`, `📅 Advance`, `🏪 Store Pickup`), and in-dossier Manifest settlement deep-links.
- lechon-system-web/src/pages/DailySheetsPage.tsx: Print-friendly operational sheet hosting `/yumi-logo.png` store branding with `#OrderReference`, `Landmark`, and live rider contact hydration.  
- lechon-system-web/src/pages/LogisticsPage.tsx: Outbound trip dispatcher for batching ready orders to drivers with emergency swap modal.  
- lechon-system-web/src/pages/ManifestPage.tsx: 3-tab Daily Settlement Center hosting Freelance Riders, Store Pickups, and Lalamove Couriers.  
- lechon-system-web/src/pages/InventoryPage.tsx: Multi-tab page containing Dual-Balance Forecasting Scoreboard (Physical, Locked 14d, Available, Safety Level, Status), Ledger Audit Trail, and Low-Stock Procurement boards.  
- lechon-system-web/src/pages/CmsPage.tsx: Menu and settings management page featuring the **Delivery Pricing Configuration** card (`Base Fare (₱)` & `Rate Per KM (₱)` with live formula preview), global base price adjustments, cooking profiles, and price history audit trails. Gated strictly to Owner role.  
- lechon-system-web/src/pages/KitchenPage.tsx: Kanban roasting queue interface with milestone stage advancement buttons (Dormant).  
- lechon-system-web/src/pages/AnalyticsPage.tsx: Dashboard displaying sales metrics, wastage reports, and SLA delivery tracking charts (Dormant).  

- Components & Modals:

- lechon-system-web/src/components/auth/ProtectedRoute.tsx: Route wrapper enforcing authentication status and role-based permissions (Owner vs. Cashier).  
- lechon-system-web/src/components/ui/Sidebar.tsx: Persistent Deep Roasted Espresso (`#181312`) navigation sidebar mounting `/yumi-logo.png`, Golden Amber active route indicators, role-aware CMS visibility, and active user shift profile/logout HUD with distinct Golden Crown (`Owner`) vs. warm stone (`Cashier`) badges.  
- lechon-system-web/src/components/ui/orders/OrderForm.tsx: Widescreen POS terminal with AI Screenshot Uploader + `[📋 Paste Chat Text]` clipboard bridge, `FacebookName`, `Source` & `EventType` quick-select pills, `Landmark`, `RiderDepartureTime` auto-calculation (6-tier distance ladder + nudge pills), dynamic CMS delivery fee formula (`(KM * RatePerKm) + BaseFare`), tri-modal fulfillment controls, and post-submit confirmation modal.  
- lechon-system-web/src/components/ui/orders/EditOrderForm.tsx: Slide-out sheet form with full *Flexible Cart, Locked Cash* parity across `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime` (with nudge pills), tri-modal segmented switch, fee bouncers, and CMS delivery pricing formula.  
- lechon-system-web/src/components/ui/orders/OrderScreenshotUploader.tsx: Dropzone and clipboard paste area (Ctrl + V) for Messenger intake screenshots.  
- lechon-system-web/src/components/daily-sheets/InlineScheduleEditorModal.tsx: Schedule editor featuring searchable rider registry selection and auto-filled contact numbers.  
- lechon-system-web/src/components/manifest/PickupSettlementTab.tsx: Counter handover grid displaying walk-in pickups, outstanding balances, and direct cash/GCash settlement triggers.  
- lechon-system-web/src/components/manifest/LalamoveSettlementTab.tsx: Anti-loss courier gate table showing destination, balance due, visual status badges, and release clearance triggers.  
- lechon-system-web/src/components/manifest/SettlePickupModal.tsx: Reusable settlement dialog displaying pickup details, ₱0.00 delivery fee, payment method (Cash vs. Store GCash), and reference inputs.  
- lechon-system-web/src/components/ui/inventory/ReceiveStockModal.tsx: Streamlined single-view carcass intake modal with direct category steppers, paper DR tracking, live on-hand impact table, and atomic ledger commit.  
- lechon-system-web/src/components/ui/inventory/AdjustLedgerModal.tsx: Modal dialog for manual stock movements using dynamic category dropdowns and mandatory reason inputs.  
- lechon-system-web/src/components/cms/ChangePriceModal.tsx: Guarded modal replacing inline price inputs with diff calculations and peak-season warnings.  
- lechon-system-web/src/components/cms/EditCategoryModal.tsx: Modal dialog for updating category names, weight bounds, and safety stock.  
- lechon-system-web/src/components/cms/PriceHistorySheet.tsx: Slide-out drawer displaying chronological price change audit history.  

- Validation Schemas (Zod):

- lechon-system-web/src/schemas/orderSchema.ts: Zod schema validating POS order entries (`facebookName`, `source`, `eventType`, `landmark`, `riderDepartureTime`), tri-modal delivery rules, and trusted customer downpayment rules.  
- lechon-system-web/src/schemas/inventorySchema.ts: Zod schema validating manual inventory adjustments with category selection and mandatory reason inputs (>= 5 chars).  

- Data Hooks (TanStack React Query):

- lechon-system-web/src/hooks/useAnalytics.ts: Hooks fetching sales velocity, delivery performance, and wastage metrics.  
- lechon-system-web/src/hooks/useCms.ts: Hooks and mutations managing category prices, cooking profiles, category lifecycles, and CMS delivery pricing (`useDeliveryPricing`, `useUpdateDeliveryPricing`).  
- lechon-system-web/src/hooks/useCustomers.ts: Debounced `useCustomerLookup` query and `useUpdateCustomerNotesMutation` hook for reactive Customer Intelligence & Complaint Radar.  
- lechon-system-web/src/hooks/useDashboard.ts: Hooks for dashboard operational lists and cancellation mutations.  
- lechon-system-web/src/hooks/useDebounce.ts: Utility hook to debounce high-frequency state updates (300ms) for directory search inputs.  
- lechon-system-web/src/hooks/useEditOrder.ts: Mutation hook for PUT /api/orders/{id} safe edits.  
- lechon-system-web/src/hooks/useInventory.ts: Hooks and mutations for dual stock balances, ledger audit history, and direct stock intake.  
- lechon-system-web/src/hooks/useKitchen.ts: Hooks and mutations for roasting roster queries and item cooking state progression.  
- lechon-system-web/src/hooks/useLogistics.ts: Hooks for unassigned order queues, today's operations, and driver assignment mutations.  
- lechon-system-web/src/hooks/useManifest.ts: Hooks and mutations for pending settlements across Riders, Store Pickups, and Lalamove couriers, including useRejectRiderSignatureMutation, useRevertCustodyMutation, and counted-amount enforced useOwnerApproveQrMutation.  
- lechon-system-web/src/hooks/useOrdersDirectory.ts: Hook managing polling, filtering, and retrieval of the Master Order Directory and audit logs.  
- lechon-system-web/src/hooks/useRiders.ts: Hook and mutation for fetching active riders and registering new freelance drivers.  
- lechon-system-web/src/hooks/useSchedules.ts: Hook fetching print-optimized daily sheets.

#### Mobile Companion App (`lechon-system-mobile` — Expo SDK 58 / React Native 0.88 / TypeScript):

- lechon-system-mobile/App.tsx: Root application entry point wrapping `SafeAreaProvider`, `QueryClientProvider`, `AuthProvider`, and `AuthGate`.
- lechon-system-mobile/src/services/apiClient.ts: Axios client with persistent `expo-secure-store` JWT Bearer interceptor, 401 unauthorized listener, and live toggle between Cloud API (`https://ronnvel-001-site1.ktempurl.com/api`) and Local Android Emulator API (`http://10.0.2.2:5199/api`).
- lechon-system-mobile/src/context/AuthContext.tsx: 12-hour shift session provider managing user identity, `isOwner` flag, and API environment state.
- lechon-system-mobile/src/components/MainShell.tsx: Authenticated 3-tab mobile shell (`📋 Orders`, `➕ New POS`, `👑 Drawer`) with compact top shift HUD.
- lechon-system-mobile/src/components/orders/OrderDossierModal.tsx: Slide-up customer dossier modal displaying `#OrderReference`, `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`, 1-tap `tel:` calling for customer and rider, Taglish Messenger receipt copier, `[✏️ Edit Order]` modal trigger, quick manual payment modal, mandatory-reason cancellation modal, and active physical cash custody warning alerts.
- lechon-system-mobile/src/components/orders/EditOrderModal.tsx: Full mobile order modifier modal supporting the *Flexible Cart, Locked Cash* paradigm (`PUT /api/orders/{id}`), including `FacebookName`, `Source` & `EventType` pills, `Landmark`, `RiderDepartureTime` (with nudge pills), active cart + search/pill item picker, and read-only historical downpayment.
- lechon-system-mobile/src/screens/LoginScreen.tsx: Mobile shift login screen with API environment switcher pill and 1-tap Owner/Cashier demo credential buttons.
- lechon-system-mobile/src/screens/OrdersScreen.tsx: Reactive Master Order Directory with 300ms debounced search (matching `CustomerName`, `FacebookName`, `ContactNumber`, and `OrderReference`), 6 server-side filter tabs, secondary horizontal sub-pill filtering under Balance Due (`balanceSubFilter`: `'all' | 'rider' | 'drawer' | 'future'`), order card custody micro-pills, and pull-to-refresh.
- lechon-system-mobile/src/screens/PosScreen.tsx: Single-column touch POS terminal featuring AI Screenshot (`expo-image-picker` -> `POST /orders/parse-screenshot`) and Clipboard Text (`expo-clipboard`) intake bridge, `FacebookName`, `Source` & `EventType` quick-select pills, `Landmark`, `RiderDepartureTime` 6-tier distance ladder + nudge pills, CMS delivery fee auto-calculation (`Math.round((distanceKm * ratePerKm) + baseFare)`), tri-modal fulfillment bouncer, Active Cart + Search/Pill catalog picker, sticky handover balance footer, and post-submit Messenger receipt confirmation modal.
- lechon-system-mobile/src/screens/DrawerScreen.tsx: 2-Hop Cash Custody & Tri-Modal Settlement Center supporting Hop 2 Owner Envelope Verification ("The Speed Bump"), Hop 1 Rider Settlement (2s QR polling + Safeguard 1 discrepancy rejection + Manual Override + Direct Store GCash), Walk-in Pickup Counter Collection, Safeguard 3 Custody Reversion ("Undo"), and Lalamove Pre-Release Gate.
- lechon-system-mobile/src/hooks/useOrders.ts: Hooks and mutations for mobile order directory, customer dossier, audit logs, manual payment logging, and order cancellation.
- lechon-system-mobile/src/hooks/usePos.ts: Hooks and mutations for catalog categories, inventory balances, CMS delivery pricing (`useDeliveryPricingQuery`), multipart screenshot parsing, POS order creation, and order editing (`useUpdateOrderMutation`).
- lechon-system-mobile/src/hooks/useManifest.ts: Hooks and mutations for Rider, Pickup, and Lalamove settlements and 2-hop QR custody handshakes.
- lechon-system-mobile/src/utils/messengerTemplates.ts: Mobile Taglish Messenger confirmation receipt builder (privacy-shielded from internal IDs) and `calculateRiderDepartureTime` 6-tier distance helper.
- lechon-system-mobile/src/utils/messengerTextParser.ts: Client-side heuristic parser converting pasted Messenger order text into `ParsedOrderDraftDto`.

### 2. API Contract Map

#### Orders & Ledger Domain (OrdersController.cs)

- POST /api/orders | Payload: CreateOrderRequest { CustomerName: string, ContactNumber: string, FacebookName?: string, Source: string, EventType?: string, Landmark?: string, TargetDeliveryTime: string (ISO8601), RiderDepartureTime?: string (ISO8601), Fulfillment: int, DeliveryAddress?: string, Remarks?: string, DeliveryFee?: decimal, Downpayment: decimal, IsTrustedCustomer: boolean, Items: [{ ItemCategoryId: int, Quantity: int }] } | Generates daily `OrderReference` (`MMDDYY-XXX`) and stamps `CreatedBy` from JWT claims.
- POST /api/orders/parse-screenshot | Payload: multipart/form-data (image: File) | Returns: ParsedOrderDraftDto  
- GET /api/orders/directory | Query: { searchTerm?: string, filterTab?: string, startDate?: string, endDate?: string } | Returns: OrderDirectoryDto[] (Searches across `CustomerName`, `FacebookName`, `ContactNumber`, `OrderReference`, and `Id`; executes server-side tab filtering for Upcoming, RecentlyModified, BalanceDue, Past30Days, Cancelled, and AllTime).
- PUT /api/orders/{id} | Payload: UpdateOrderDto { CustomerName?: string, ContactNumber?: string, FacebookName?: string, Source?: string, EventType?: string, Landmark?: string, TargetDeliveryTime: string (ISO8601), RiderDepartureTime?: string (ISO8601), DeliveryAddress: string, Remarks: string, Items: [{ ItemCategoryId: int, Quantity: int }] }  
- PATCH /api/orders/{id}/confirm-payment | Payload: None  
- PATCH /api/orders/{id}/confirm-delivery | Payload: None  
- PATCH /api/orders/{id}/cancel | Payload: { Reason: string } | Returns: 200 OK (Releases inventory, cancels order, logs audit trail with User.Identity.Name)  
- GET /api/orders/{id}/audit-logs | Payload: None | Returns: OrderAuditLog[]
- GET /api/orders/{id} | Returns: OrderDetailsDto (Enriched with `OrderReference`, `FacebookName`, `Source`, `EventType`, `Landmark`, `RiderDepartureTime`, `CustomerProfileId`, `CustomerTotalOrdersCount`, `CustomerPreferences`, `CustomerComplaintHistory`, assigned rider full name, rider phone, and routing status)  

#### Customer Intelligence Domain (CustomersController.cs)

- GET /api/customers/lookup?phone={phone}&fbName={fbName} | [Authorize(Roles = "Owner,Cashier")] | Returns: CustomerProfileDto (or null if not found)
- PUT /api/customers/{id}/notes | [Authorize(Roles = "Owner,Cashier")] | Payload: UpdateCustomerNotesRequest { Preferences?: string, ComplaintHistory?: string, IsVip?: bool } | Returns: CustomerProfileDto
- PUT /api/customers/by-phone/{phone}/notes | [Authorize(Roles = "Owner,Cashier")] | Payload: UpdateCustomerNotesRequest | Upserts customer notes by phone number and returns CustomerProfileDto  

#### CMS & Menu Pricing Domain (CmsController.cs)

- GET /api/cms/delivery-pricing | [Authorize(Roles = "Owner,Cashier")] | Returns: DeliveryPricingDto { BaseFare: decimal, RatePerKm: decimal }
- PUT /api/cms/delivery-pricing | [Authorize(Roles = "Owner")] | Payload: DeliveryPricingDto { BaseFare: decimal, RatePerKm: decimal } | Returns: DeliveryPricingDto
- GET /api/cms/categories | [Authorize(Roles = "Owner")] | Returns: ItemCategory[]  
- GET /api/cms/categories/{id}/price-history | [Authorize(Roles = "Owner")] | Returns: PriceHistoryLogDto[]  
- PUT /api/cms/categories/{id}/price | [Authorize(Roles = "Owner")] | Payload: UpdatePriceRequest { NewPrice: decimal, AdminName: string }  
- PUT /api/cms/categories/{id}/details | [Authorize(Roles = "Owner")] | Payload: CategoryMetadataDto { Name: string, MinimumWeightKg: decimal, MaximumWeightKg: decimal, MinimumSafetyStock: int }  
- PATCH /api/cms/categories/{id}/status | [Authorize(Roles = "Owner")] | Payload: None (Toggles IsActive flag)  
- PUT /api/cms/categories/{categoryId}/cooking-profile | [Authorize(Roles = "Owner")] | Payload: UpdateCookingProfileRequest { BaseDurationMinutes: int, MultiplierPerKg: decimal }  
- POST /api/cms/categories | [Authorize(Roles = "Owner")] | Payload: CreateCategoryRequest { Name: string, BasePrice: decimal, CategoryType: string }  
- DELETE /api/cms/categories/{categoryId} | [Authorize(Roles = "Owner")] | Payload: None  

#### Dashboard Domain (DashboardController.cs)

- GET /api/dashboard/tasks/pending-confirmations | Payload: None | Returns: PendingConfirmationDto[]  
- GET /api/dashboard/tasks/delivery-verifications | Payload: None | Returns: DeliveryVerificationDto[]  
- GET /api/dashboard/tasks/defrost-roster | Payload: None | Returns: DefrostRosterDto[]  
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

- POST /api/auth/login | Payload: LoginRequest { Username: string, Password: string } | Returns: AuthResponseDto { Token: string, Username: string, FullName: string, Role: string, ExpiresAt: DateTime }  
- GET /api/auth/me | Headers: Authorization: Bearer | Returns: UserDto  

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
- GET /orders -> renders (Master Order Directory with search, filters, state tabs, and drawer)  
- GET /logistics -> renders (Dual-tab live operations and batch dispatch planner)  
- GET /manifest -> renders (Tri-tab daily settlement center: Freelance Riders, Store Pickups, Lalamove Gate)  
- GET /inventory -> renders (Dual-stock live ledger, chronological audit log, direct intake trigger)  
- GET /cms -> renders (Delivery Pricing Configuration, Menu item prices, category details, safety stock buffers, cooking profiles, and price history audit log). Gated strictly to [Owner] role.  

#### Dormant / Deep-Link Only:

- GET /kitchen -> renders (Kanban roasting workflow interface; hidden from sidebar)  
- GET /analytics -> renders (Business intelligence charts; hidden from sidebar)  

#### Print-Optimized Flow (Suppresses global sidebar and header):

- GET /daily-sheets -> renders (Hosts KitchenViewTab and RiderViewTab)

**
