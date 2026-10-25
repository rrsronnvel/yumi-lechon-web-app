\*\*

# Master Business Operations & System Alignment Document

Project: Lechon Order & Inventory Management System

Location: Cavite, Philippines

Architecture Phase: Phase 5 (Advanced Logistics & Cash Reconciliation)

### 1. Core Philosophy & System Purpose

This system is not a Silicon Valley "Uber-style" startup app. It is a highly practical, custom-fit business tool designed to eliminate human error, automate tedious math, and protect the family’s operational sanity without forcing the staff to learn completely new, complicated workflows.

How the System Actually Helps the Real World:

- The Freezer Bouncer: Automatically checks digital ledger balances and locks in sizes, preventing the business from accidentally double-booking specific weight brackets.
- The Kitchen Clock: Automatically calculates exact prep times (Tahi, Salang) backward from the customer's target delivery time, removing manual math from the roasting floor.
- The Manifest Generator: Automates the generation of daily schedule sheets, allowing the admin to easily plan routes, assign riders, and take clean screenshots for Messenger Group Chats.
- The Assistant Manager (Dashboard): Acts as a time-sensitive trigger engine, surfacing orders to the staff only when it is exactly the right day to follow up with a customer.
- The Master Ledger & Audit Trails: Replaces the old Google Sheets with searchable, structured directories for both Orders and Inventory, acting as the absolute source of truth for the business owner.
- The Black Box Tracker (Audit Logs): Automatically logs an intelligent, chronological timeline of every manual edit made to an order, permanently ending the "who changed what?" guessing game.
- The "Flexible Cart, Locked Cash" Guard: Allows unlimited edits to items, locations, and prices to fix human errors, but mathematically locks cash receipts to prevent accounting leaks.
- The End-of-Day Cash Settle: Tracks granular, customer-by-customer remittances across physical cash, direct GCash, and rider GCash transfers to prevent revenue leakage.

### 2. Order Intake & Unified Reservation Rules

Orders arrive via Facebook Messenger or walk-ins. A size/weight is requested along with a strict target delivery time. The POS Form captures full operational data including Delivery Method, Delivery Address, Remarks, Add-Ons, Discount, and the Total Amount.

- UI Safeguard (Store Pickup): If the dispatcher selects "Store Pickup" as the Delivery Method, the frontend automatically forces the Delivery Fee to ₱0 and locks the input field to prevent clerical errors.
- Add-Ons Exemption: Add-ons (sauces, drinks) are captured as lightweight line items. They are explicitly excluded from the inventory ledger and kitchen backward-scheduling engines.

The system uses a Unified Order Ingestion Form powered by an intelligent state machine that handles three distinct customer scenarios:

- Scenario A: The Normal Reservation (Waiting for GCash)

- Action: Admin enters a ₱0 Downpayment and leaves the "Trusted Customer" toggle OFF.
- Result: The backend saves the inventory as PendingPayment. It waits silently until 4 days before delivery, when it triggers a Dashboard alert for the staff to follow up and collect the cash.

- Scenario B: The Instant Payer (Walk-in or Fast GCash)

- Action: Admin enters a Downpayment > ₱0 (e.g., ₱3,000) and leaves the toggle OFF.
- Result: The backend automatically bypasses the pending phase and instantly locks the physical inventory as Committed.

- Scenario C: The VIP "Trusted Customer" Exception

- Action: Admin enters a ₱0 Downpayment but flips the "Trusted Customer" toggle ON.
- Result: The backend ignores the zero-dollar balance and instantly locks the inventory as Committed based on trust. VIPs receive heavy visual emphasis (👑 Badges) across the Master Directory, Kitchen Kanban, Daily Manifest, and Reconciliation screens.

- The "Rush Order" Exception: Orders placed for next-day or same-day delivery completely bypass the dashboard's 4-day and 2-day reminder queues, as staff will collect payment and verify details simultaneously during the live Messenger intake chat.

#### 2.5 POS Terminal Ergonomics & Layout Architecture

To prevent cashier fatigue and eliminate layout shift during rapid phone or Messenger order entry, the POS terminal implements a widescreen, two-column zero-scroll layout.

- Spatial Grouping & Cognitive Sequence:

- Column 1 (Who & Where): Groups Customer Identity, Contact Numbers, Delivery Method toggles, Timing, Address, and Operational Notes.
- Column 2 (What & Money): Groups the Unified Order Cart (roasts and dynamic add-ons) and the Real-Time Settlement Ledger.

- Unified Cart Architecture:

- Roasts (Whole Pigs / Bellies) and Add-Ons (Sauces / Extras) are consolidated into a single unified cart sequence.
- Subtotal reflects the aggregate price of roasts and add-ons before transit fees or discounts are applied.
- Bouncer isolation remains intact: Carcass items commit freezer inventory and generate roasting schedules, while add-ons are strictly financial line items ignored by kitchen queues.

- Real-Time Balance Due Calculation:

- The register prominently displays the live calculated "Balance Due at Handover":

- Balance Due = Grand Total - Downpayment Received

- A dynamic status badge indicates payment health:

- [PAID IN FULL] when Downpayment equals or exceeds Grand Total.
- [VIP: UNPAID COMMITTED] when Downpayment is ₱0 and the Trusted Customer toggle is active.
- [PENDING PAYMENT] when Downpayment is ₱0 for non-trusted customers.

- Interactive Store Pickup Safeguards:

- Switching to "Walk-in Store Pickup" immediately locks the Delivery Fee and Distance inputs to ₱0 and dynamically sets the address placeholder to store handover.
- Switching to "Delivery Routing" restores distance-based fee calculations and mandatory address inputs.

- Downpayment Quick-Select Presets & Top Routing Distance Ergonomics:

- **Downpayment Quick-Select Pills (`[ ₱0 ]` | `[ ₱1,000 ]` | `[ Full Paid ]`):** Both the Web POS (`OrderForm.tsx`) and Mobile POS (`PosScreen.tsx`) provide 3 compact quick-select pills beside the `Downpayment Received (₱)` input:
  - `[ ₱0 ]`: Sets `downpayment = 0`.
  - `[ ₱1,000 ]`: Sets `downpayment = grandTotal > 0 && grandTotal < 1000 ? grandTotal : 1000` (standard Yumi's Lechon booking deposit, capped at `grandTotal` for small add-on orders).
  - `[ Full Paid ]`: Sets `downpayment = grandTotal`.
- **Top Routing Distance Placement:** In both Web and Mobile POS terminals, `Est. Distance (KM)` is placed directly inside the top **Customer & Fulfillment Routing** section next to `Delivery Address` and above `Target Delivery Time` / `Rider Departure Time`. Entering distance immediately computes both the `RiderDepartureTime` (via the 6-tier distance ladder) and the suggested `DeliveryFee` (`Math.round((distanceKm * ratePerKm) + baseFare)`) before the cashier scrolls down to the cart or financial ledger.

The POS and Logistics engines enforce strict boundary rules across three distinct fulfillment modes while preserving customer location data across all channels:

1. Delivery Routing (Fulfillment = 1):

- Standard road freight managed by the store's outsourced freelance motorcycle fleet.
- Address is mandatory; distance calculation and editable delivery fee inputs are active.
- Generates cash remittance and delivery fee payout rows on the Daily Manifest.

3. Walk-in Store Pickup (Fulfillment = 0):

- Customer collects the roast directly from the store counter.
- Address Retention Rule: The Delivery Address field remains fully enabled and editable. Staff capture customer addresses during intake to populate customer dossiers and support last-minute conversions from pickup to delivery.
- Fee Safeguards: Distance (KM) and Delivery Fee are strictly forced to 0 and locked to ₱0 to prevent accidental freight overcharges on store pickup tickets.
- Excluded from road dispatch planning and driver manifest reconciliations.

5. Third-Party Courier / Lalamove (Fulfillment = 2):

- Delivery arranged via on-demand third-party delivery apps where freight costs are shouldered directly by the customer.
- Delivery address remains open and mandatory for dispatch coordination.
- Distance and Delivery Fee inputs are strictly forced to 0 and locked to ₱0 (preventing erroneous delivery fees from appearing on the store receipt).
- Excluded from freelance driver batch dispatch and manifest cash remittance workflows.

#### 2.7 In-POS Tentative Reservation Drafts & Production Quarantine Governance

- Real-World Operational Context:
  Customers frequently inquire via Facebook Messenger or telephone requesting quotes, tentative date holds, or preliminary pricing before confirming their venue, final guest count, or pig size, and before sending a GCash downpayment deposit. Forcing cashiers to input dummy delivery addresses, arbitrary delivery timestamps, or artificial pig sizes to satisfy validation corrupted kitchen rosters, locked up scarce physical pig carcasses in the freezer ledger, and flooded delivery dispatches.

- The In-POS Draft Toggle (`IsDraft = true`):
  Both Web POS (`OrderForm.tsx`, `EditOrderForm.tsx`) and Mobile POS (`PosScreen.tsx`, `EditOrderModal.tsx`) mount a prominent purple switch banner: `[ 📝 Tentative Draft Inquiry (No Fixed Date/DP) ]`.
  - When active, a purple informational callout informs staff: *"Draft Mode Active: Kitchen schedules and freezer stock locks are paused. Date, venue, and pig size can be left blank until confirmed."*
  - The primary intake submit action transforms into `[ 💾 Save Draft Inquiry ]` (`bg-purple-600`).

- Conditional Intake Validation Engine:
  - **Draft Mode Active (`isDraft === true`):**
    - Relaxed identity requirement: Requires at least one customer identifier (`CustomerName` or `FacebookName`).
    - Permits empty `TargetDeliveryTime` (`null`), empty `DeliveryAddress` (`null`), and `0` cart items (`items.length === 0`).
  - **Production Mode Active (`isDraft === false`):**
    - Re-arms strict production guardrails: Requires customer name (>= 2 characters), valid contact number (>= 10 digits), target delivery date & time, mandatory delivery address (if Fulfillment is Delivery or Lalamove), and at least 1 cart line item.

- Zero-Impact Production Bouncer & Operational Cockpit Quarantine:
  - **Zero Freezer Inventory Locks:** `OrderService.CreateOrderAsync` completely skips `_inventoryService.ReserveInventoryForOrderAsync` when `IsDraft == true` (generating `0` `InventoryReservation` records).
  - **Zero Kitchen Roasting Clocks:** `OrderService.CreateOrderAsync` completely skips `_schedulingService.CalculateAndSaveScheduleAsync` when `IsDraft == true` (generating `0` `OrderItemSchedule` records).
  - **Total Cockpit Quarantine (`!o.IsDraft`):**
    1. *Zero-Inbox Command Center (`DashboardService.cs`):* Excluded from `Tomorrow's Lechon Demand`, `GetDefrostingRosterAsync`, `GetDeliveryVerificationsAsync`, `GetPendingConfirmationsAsync`, and `GetRenegotiationTasksAsync`.
    2. *Kitchen Roasting Manifests (`SchedulingService.cs`):* Excluded from `GetDailySheetsAsync` (14-column Kitchen Sheet and 10-column Rider Sheet).
    3. *Logistics Operations & Settlement Drops (`LogisticsService.cs`):* Excluded from `GetUnassignedDeliveryOrdersAsync`, `GetTodayDispatchesAsync`, `GetPendingSettlementDropsAsync`, `GetPendingPickupSettlementsAsync`, and `GetPendingLalamoveSettlementsAsync`.

- Master Directory Slicing & Visual Fallbacks:
  - **Dedicated 7th Tab (`drafts`):** Both Web Directory (`OrdersPage.tsx`) and Mobile Directory (`OrdersScreen.tsx`) isolate drafts into `[ 📝 Drafts ]` filtering `o.IsDraft && !o.IsCancelled` ordered by `UpdatedAt ?? CreatedAt` descending.
  - **Production Tab Quarantine:** All active operational tabs (`Upcoming`, `Today Only`, `Tomorrow`, `Balance Due`, `Recent Edits`, `Past 30d`, `Cancelled`, `All Time`) strictly quarantine drafts via `!o.IsDraft`.
  - **Graceful Visual Fallbacks:**
    - *Schedule:* Displays `📅 Date Pending` (with customer `remarks` rendered in subtle monospace subtext if present).
    - *Location:* Displays `📍 Venue TBD / Unset` (or `🏪 Store Pickup` if pickup).
    - *Totals & Deposit:* Displays `Est. ₱{grandTotal}` with a muted `₱{downpayment} DP` badge.
    - *Routing Status Badge:* Displays distinct purple badge `[ 📝 Incomplete Draft ]`.
  - **Customer Dossier Modal/Sheet:** Renders an informational purple alert banner: *"📝 Tentative Inquiry: This order is an unconfirmed draft. No kitchen schedule has been generated and no freezer inventory is locked."*

- The Draft Finalization Transition:
  When an existing draft is updated and the draft toggle is flipped to `OFF` (`wasDraft && !request.IsDraft`):
  1. The system enforces strict validation (ensuring `TargetDeliveryTime`, valid line items, and delivery address are present).
  2. Sets `order.IsDraft = false`.
  3. Triggers `_inventoryService` to create physical inventory reservations (`Committed` if `DownpaymentReceived > 0 || IsTrustedCustomer`, else `PendingPayment`).
  4. Triggers `_schedulingService` to compute backward kitchen roasting schedules (`TahiStartTime`, `SalangStartTime`, `PackagingStartTime`, `RiderDepartureTime`).
  5. Inserts an immutable audit log entry: `"Draft inquiry finalized and locked into production by {CurrentUser}"`.
  6. The submit button displays `[ 🔒 Finalize & Lock Order ]`.

#### 2.8 Dual-Contact Architecture (CP #1 & CP #2)
* **Real-World Operational Context:** In Philippine catering and lechon dispatch, the booking party on Facebook Messenger (e.g., mother/organizer) is frequently distinct from the on-site recipient (e.g., event coordinator, relative, or caretaker). Recording an alternate contact line (`CP #2`) prevents failed deliveries when the primary line is busy, out of coverage, or unattended during transit.
* **Database & Domain Entity:** `Order.ContactNumber` is configured with `[MaxLength(45)]` (`nvarchar(45)`) via migration `SetOrderContactNumberMaxLength45`. Contact numbers are persisted in a standard comma-delimited format: `"{PrimaryPhone},{SecondaryPhone}"` (e.g., `09171234567,09481234567`).
* **Intake Ergonomics:** Both Web POS (`OrderForm.tsx`, `EditOrderForm.tsx`) and Mobile POS (`PosScreen.tsx`, `EditOrderModal.tsx`) mount a `[+ Add CP #2]` toggle button beside the primary `Mobile Number (CP #1)` field. Clicking displays an optional `Secondary Mobile Number (CP #2)` input with a 1-click `✕` remove button.
* **Validation Guardrails:** Form schemas validate that the primary contact has at least 10 digits (`min 10 digits`), and if CP #2 is provided, validates that it also contains at least 10 digits.
* **Customer Intelligence & History Lookup:** `CustomerService.ExtractPrimaryContactNumber` isolates CP #1 for phone normalization and profile indexing, while historical order lookups utilize `.Contains()` so returning customers are recognized regardless of whether they call from their primary or secondary mobile line.
* **Floor Action & Dossier Telemetry:**
  - `OrdersScreen.tsx` renders `contactNumbersStack` displaying both contact numbers on order cards.
  - `OrderDossierModal.tsx` and `FloorActionView.tsx` display both phone numbers in the customer header.
  - Tapping `📞 Call Customer` when multiple numbers exist triggers an interactive Action Sheet / Alert modal offering `[ 📞 CP #1 ({phone1}) ]` and `[ 📞 CP #2 ({phone2}) ]`, eliminating manual copy-pasting.

#### 2.9 The 4-Phase Flexible Messenger Intake Parser
* **Dual-Engine Architecture:** Operates simultaneously via backend Gemini Vision (`AiIntakeParserService.cs`) and high-performance client-side heuristic regex parser (`messengerTextParser.ts` on Web and Mobile) to parse both raw customer booking forms and staff Messenger receipts.
* **Phase 1: Identity & Dual-Contact Isolation:**
  - Extracts customer recipient name (`customerName`) from form body, avoiding confusion with Messenger navigation bar profile names (`facebookName`).
  - Separates primary phone (`contactNumber` / CP #1) and secondary phone (`contactNumber2` / CP #2).
  - Isolates dedicated `landmark` and `eventType` fields, keeping operational notes out of remarks.
* **Phase 2: Schedule & Fulfillment Routing:**
  - Flexible date & time normalization: parses split lines (`Date & Time:` followed by multi-line time or next-line values), relative day markers (`bukas`, `tomorrow`, `today`, `ngayon`), ISO formats, Month Day formats, and numeric formats.
  - Meridiem and time phrase conversion: handles `am`, `pm`, `nn` (12:00 PM), `mn` (12:00 AM), `in the morning`, `in the afternoon`, `in the evening`, and 24-hour formats.
  - Fulfillment detection: sniffs `Store Pickup` / `Pick-up` (sets fulfillment = 0, delivery fee = ₱0), `Lalamove` (fulfillment = 2, delivery fee = ₱0), and `Delivery` (fulfillment = 1).
* **Phase 3: Menu Disambiguation & Freebie Intelligence:**
  - Whole Lechon size matching: converts bracket aliases (`Super Jumbo`, `XXL`, `XL`, `Jumbo`, `L`, `M`, `S`, `XS`, `XXS`) to active Whole Lechon menu categories (`MinimumWeightKg >= 13`).
  - Lechon Belly matching: maps `2kg` to `5kg` mentions directly to active Lechon Belly menu categories.
  - Add-ons matching: identifies mentioned extras (`Sarsa`, `Dinuguan`, `Pancit`, `Palabok`, `Spaghetti`, `Puto`, `Coke`) and matches to active add-on categories (`MinimumWeightKg <= 0`).
  - Freebies Opt-Out Sniffing: detects `less 2k`, `cash discount`, `walang freebie`, or `no freebies`, sets `FreebiesOptOut = true`, and computes the dynamic CMS discount (`noFreebiesDiscountPerPig * wholePigCount`).
  - Raw Innards Sniffing: detects `hilaw na laman loob`, `raw innards`, or `walang dinuguan`, sets `RawInnards = true`, and locks Dinuguan to 0.
* **Phase 4: Financial & Remarks Sanitization:**
  - Downpayment & Payment Method: parses downpayment deposit values and sniffs payment method (`GCash`, `Maya`, `Bank Transfer`, `Cash`).
  - Distance & Delivery Fee: extracts explicit distance and delivery charges.
  - Boilerplate Remarks Sanitizer: automatically purges marketing and booking template chatter (`to confirm your order`, `with 7 freebies`, `spaghetti, palabok... consumed`, `total balance:`, etc.), leaving remarks clean and reserved solely for genuine kitchen prep instructions.

### 3. Dashboard Triggers & Exception Handling

The "Zero-Inbox" Dashboard acts as a dynamic Command Center, programmed with a Time-Sensitive Trigger Engine to prevent screen clutter.

- Quick-Glance KPI Widgets: The top of the dashboard provides instant metrics:

- Tomorrow's Lechon Count: Strictly tallies only Committed/Locked pigs.
- Pending Remittance Tracker: Shows Rider Name, Amount to Remit, and Dispatch Date. If a rider holds unremitted cash from a previous day, their card glows RED. This widget dynamically syncs with the Cash Reconciliation module, decrementing live balances as orders are settled and vanishing once a rider's balance hits ₱0.

- Pending Downpayments (4-Day Window): If an order is unpaid, it remains invisible until exactly 4 days before delivery. The table includes Action Center Integration, allowing the admin to click an order, open the "Customer Dossier" modal, and log a GCash receipt instantly without leaving the dashboard.
- Final Follow-Up & Cancellation (1-Day Window): If the order remains unpaid 1 day before delivery, it becomes a critical follow-up.
- Unified Tomorrow's Operations Roster: A single, merged table combining Delivery Verifications and the Defrosting Roster. It groups customer delivery details alongside the exact pigs needed from the freezer tonight. Late additions to this list trigger a red [RUSH / LATE DEFROST] badge.
- 1-Click Nightly Defrost List Generator & The Defrost Roster Carcass Bouncer (`[ 📋 Copy Defrost List ]`): Both the Web Dashboard (`DashboardPage.tsx`) and Mobile Floor Action Hub (`FloorActionView.tsx`) mount a 1-click `[ 📋 Copy Defrost List ]` button in the Operations Roster header (`generateDefrostRosterMessage` in `messengerTemplates.ts`). The Defrost Roster Carcass Bouncer strictly enforces `MinimumWeightKg > 0` at the database level (`DashboardService.cs`) and filters out non-carcass add-on items (`NON_CARCASS_ADDON_PATTERN` matching sauces, dinuguan, pancit, palabok, spaghetti, puto, coke) on both Web and Mobile client displays and clipboard strings. Only genuine roasted carcasses (Whole Lechon and Lechon Belly) appear on the defrost roster. Clicking copies a clean Taglish freezer pull-list formatted for the kitchen Messenger group chat (`Ito po mga ilalabas para bukas, {MonthShort} {Day}`), automatically partitioning items into `Whole Lechon` (`{WeightRange} - {CustomerName}`, e.g. `28-30 - Vivian`) and `Belly` (`{SizeLabel} - {CustomerName}`, e.g. `3kg - Angelo`), expanding multi-quantity rows (`quantity > 1`) into individual carcass lines, and omitting empty group headers.
- Peak Season Renegotiation List (Dynamic): Only appears when base prices are hiked in the CMS. Displays affected advance bookings, allowing admins to manually mark them as [Customer Agreed], [Waive Hike], or [Customer Cancelled] after communicating with the client.

### 4. Kitchen Operations (The Backbone)

- Dynamic Backward Scheduling: Cooking duration depends purely on the size of the pig. The system mathematically subtracts Packaging, Salang, and Tahi durations backward from the Target Delivery Time based on dynamic rules configured in the CMS.
- Priority Calculation: The kitchen prioritizes pigs based on which one needs to hit the preparation table first. The system automatically generates a Priority Number (1, 2, 3...) sorted exclusively by the earliest calculated TahiStartTime.
- Kanban Board Visibility: Add-Ons are explicitly ignored by the kitchen clock. VIP orders are heavily badged so butchers know to allocate the largest pig in the weight bracket to that customer.

#### 4.1 Production Leveling & Manual Timeline Overrides

While the system provides automated backward-scheduling based on product profiles, physical pit capacities and labor constraints require human-in-the-loop production leveling.

- Operational Authority:

- The Daily Dispatch Planner provides an interactive planning mode allowing owners to manually fine-tune Tahi (prep), Salang (roasting), and Packaging times for individual order items.

- Dynamic Priority Re-Ranking:

- Priority numbers are never manually typed. They are dynamically derived by sorting all scheduled items for the day chronologically by TahiStartTime. Any manual shift to a Tahi timestamp immediately re-indexes the entire roster (Priority 1, 2, 3...).

- Override Protection (IsManualOverride):

- When an admin manually alters kitchen timestamps on the planner, OrderItemSchedule.IsManualOverride is set to true. Background automated recalculators must respect this flag and refrain from overwriting leveled schedules unless explicitly requested during a delivery date change.

- Field Mutability Boundaries:

- Mutable on Planner: TahiStartTime, SalangStartTime, PackagingStartTime, AssignedRider, OperationalRemarks.
- Immutable on Planner: TargetDeliveryTime, ItemCategory/Size, CustomerName, WeightBracket. These fields remain bound to the Master Order Ledger.

- Presentation Modes:

- Planner Mode: Exposes quick-edit controls and inline time pickers for operational leveling.
- Snapshot Mode: Strips away interactive buttons, borders, and tabs, rendering a wide, high-contrast white document optimized for messenger group-chat screenshots.

### 5. Logistics & Delivery Operations

The business relies on a trusted pool of experienced, outsourced freelance motorcycle riders managed via a Facebook Messenger Group Chat. 

#### 5.1 Web Logistics Command Streamlining
To eliminate interface fragmentation and workflow duplication, the Web Logistics experience is streamlined into two specialized surfaces:
- **Live Operations (Today) Command Center (`/logistics`):** Dedicated single-view monitor focused exclusively on today's active dispatches, emergency driver swaps (`[Edit Rider]`), and delivery completions (`[Mark Delivered]`). Eliminates duplicate tomorrow unassigned tables and batch dispatch modals from this view.
- **13-Column Daily Dispatch Planner (`/daily-sheets`):** Opened via the primary header launcher (`Open Daily Dispatch Planner ➔`), this print-optimized layout combines customer orders, distance-based delivery fees, rider assignments, and cash collection totals for Kitchen and Rider views.

#### 5.2 Operational Views
- **Live Operations (Today):** Real-time monitoring board for orders scheduled for delivery today. Displays assigned rider names, destination addresses, and delivery status. Action Controls: Provides a `[Mark Delivered]` trigger to close trips upon receiving photo proof in Messenger, and an `[Edit Rider]` button to reassign orders on the fly in case of vehicle breakdowns or rider emergencies.
- **Daily Dispatch Planner (`/daily-sheets`):**
  - **Tab 1: Kitchen View (14-Column Production Sheet — `KitchenViewTab.tsx`):** Sorted by Tahi Time / Priority. Hides money data. Enforces the strict 14-column layout:
    `NO.` | `TAHI` | `SALANG` | `PRIORITY` | `SIZE` | `WEIGHT` | `DEPARTURE / PICKUP` | `CUSTOMER` | `PACKAGING` | `REMARKS` | `LOCATION` | `ADD-ONS` | `DELIVERY` | `RIDER`.
    - `DEPARTURE / PICKUP` sits between `WEIGHT` and `CUSTOMER`, displaying `riderDepartureTime ?? targetDeliveryTime` so master roasters and choppers see the exact store handover deadline right next to the pig weight and customer name.
    - `DELIVERY` sits between `ADD-ONS` and `RIDER`, displaying `targetDeliveryTime` (customer venue arrival time) for dispatch context.
    - In `Edit & Plan Mode`, clicking `TAHI`, `SALANG`, `DEPARTURE / PICKUP`, `PACKAGING`, `REMARKS`, or `RIDER` opens `InlineScheduleEditorModal.tsx`.
  - **Tab 2: Rider View & Rider Anti-Complacency Column Rule (`RiderViewTab.tsx`):** Sorted chronologically by departure time. Hides cooking data and shows exact cash splits.
    - **Rider Anti-Complacency Guard:** The time column is labeled `DEPARTURE / PICKUP` and renders **ONLY** `riderDepartureTime ?? targetDeliveryTime` in bold primary monospace text. The customer's venue arrival time (`targetDeliveryTime`) and any secondary arrival subtext are **strictly hidden/removed** from the Rider View so freelance riders cannot self-calculate buffer slack or delay their departure from the store.
  - **The Dispatch Planner Carcass Bouncer:** Both `KitchenViewTab.tsx` and `RiderViewTab.tsx` strictly enforce the Carcass Bouncer (`MinimumWeightKg > 0`). Only Whole Lechon and Lechon Belly appear as schedule rows; lightweight add-ons (sauces, dinuguan, pancit, drinks, etc.) are strictly excluded from generating schedule/departure rows and are captured exclusively inside the `ADD-ONS` column (Column 12 on Kitchen View, Column 10 on Rider View). This prevents add-ons from inflating the `Total Deliveries` count or duplicating the order's `Amount to Collect` on the rider manifest.

#### 5.3 Freelance Rider Directory & Customer Communication Bridge

- Lightweight Rider Registry:

- To eliminate phone number typos and repetitive typing during dispatch planning, the system maintains a lightweight directory of approved freelance riders (Name, Phone Number, Active Status).
- The Dispatch Planner provides a searchable combobox allowing instant selection of regular riders (auto-hydrating their mobile number) while preserving an ad-hoc text entry fallback for emergency first-time riders.

- 1-Click Messenger Communication Bridge:

- Cashiers are provided 1-click clipboard triggers generating polite, standardized Taglish messages formatted for immediate pasting into Facebook Messenger chats:

- Booking Confirmation: Dispatched upon order creation, summarizing items, fulfillment method, downpayment received, and net balance due (omitting bank/GCash details).
- Delivery Verification: Dispatched 1-2 days prior to cooking, requesting customer confirmation ("para masalang po namin ng tama").
- Dispatch Notification: Dispatched upon departure, dynamically tailored to freelance rider details (including driver phone number), Lalamove handover, or store pickup availability.

### 6. Financial Math & Cash Split Rules

- Price Snapshotting: Orders permanently lock in the base price of the item at the exact moment of checkout, ensuring historical records are tamper-proof even if menu prices rise.
- The Grand Total Formula: (Sum of Lechon) + (Sum of Add-Ons) + Delivery Fee - Discount = Grand Total.
- The Smart Balance Formula: Remaining Balance = (Grand Total) - (Sum of All Logged Payments).
- Cash Drops (The Split): If the customer pays in physical cash, the rider immediately pockets their Delivery Fee. When the rider returns to the store, they hand the admin only the exact Lechon Fee amount.
- Overpayments & Refunds: If a customer downgrades their order size after paying in full, the Smart Balance mathematically turns negative. The UI highlights this in red as "Overpaid / Refund Due" so the dispatcher knows to hand the rider cash to return to the customer.
- Fully Paid in Advance Exception: If a customer pays 100% upfront (Meat + Delivery), the Manifest explicitly shows Amount to Collect: ₱0. However, the Delivery Fee column still displays the amount (e.g., ₱150) so the admin knows they owe the rider that cash directly out of the store's register at the end of the day.

#### 6.1 Server-Side Price Snapshotting on Ingestion

To eliminate "Zero-Price Ghosting" and erroneous renegotiation alarms, order item unit prices must be authoritatively resolved on the server.

- Ingestion Authority: Client POS payloads submit structural identifiers (ItemCategoryId, Quantity) and master totals, omitting individual item pricing.
- Atomic Snapshotting: During CreateOrderAsync execution, the backend synchronously resolves each ItemCategoryId against ItemCategories, stamping the active BasePrice directly onto OrderItem.Price and calculating OrderItem.TotalPrice = BasePrice \* Quantity.
- Radar Immunity: Newly ingested orders hold OrderItem.Price == ItemCategory.BasePrice at inception. The Peak Season Renegotiation scanner strictly ignores orders where OrderItem.Price >= ItemCategory.BasePrice, surfacing records only when an administrative price hike creates a positive gap (BasePrice > OrderItem.Price).

### 7. The Master Order Directory (Search & Edit)

To completely replace the legacy Google Sheet, the system features a global Master Order Directory.

- The Smart Grid & Quick Filters: Displays standard fields alongside a visually truncated Location column (displaying a [Store Pickup] badge if applicable). Utilizes segmented tabs (Upcoming, Past 30 Days, Cancelled, All Time) and a debounced search bar to prevent database crashes.
- Action Center: Includes a top-level "Cancel Order" button to quickly void faulty or rejected reservations and restore physical inventory instantly.
- The Deep-Fetch Customer Dossier: Clicking a row triggers a secondary API call to pull the heavy order record, opening a comprehensive, Read-Only "Dossier" slide-out.
- The Black Box Audit Log: Inside the Dossier, an "Activity History" tab acts as an immutable flight recorder.

- Smart Diffing: The backend strictly compares old vs. new data and translates database IDs into human-readable text (e.g., "Upgraded size to Medium").
- Spam Protection: Ghost edits (clicking save without changing anything) are ignored.
- Accountability: Captures an "Admin Name" placeholder to log exactly who made the modification.

- Safe Editing ("Flexible Cart, Locked Cash"):

- The Flexible Cart: Admins can dynamically edit Contact Numbers, Delivery Addresses, Pig Sizes, Add-Ons, Discounts, or Delivery Fees to fix typos. The system mathematically recalculates the Total on the fly.
- The Locked Cash: The Downpayment and payment logs are strictly Read-Only to prevent accounting leaks. If the customer pays more, the admin clicks a separate "Add Payment" button.

#### 7.1 Reactive Multi-Tab Slicing Architecture

To prevent cognitive overload and maintain sub-second directory responsiveness, the Master Order Directory implements a six-tier tab filtering suite powered by server-side LINQ projections:

1. Upcoming (Default View):

- Query Filter: TargetDeliveryTime >= DateTime.Today && Status != OrderStatus.Cancelled
- Operational Purpose: Houses active forward fulfillment queues, hiding past deliveries and voided noise.

3. Recently Modified (Audit Radar):

- Query Filter: Orders with an OrderAuditLog recorded within the last 48 hours OR UpdatedAt >= DateTime.UtcNow.AddHours(-48).
- Operational Purpose: Alerts owners and morning shift staff to last-minute customer edits, schedule adjustments, or discount changes made by cashiers.

5. Balance Due (Accounts Receivable):

- Query Filter: (GrandTotal - Downpayment) > 0 && Status != OrderStatus.Cancelled
- Operational Purpose: Surfaces all customer accounts with outstanding debt across all dates (past, present, future), preventing unpaid VIP credit or corporate invoice balances from being forgotten after road remittance settlement.

7. Past 30 Days (Recent History):

- Query Filter: TargetDeliveryTime < DateTime.Today && TargetDeliveryTime >= DateTime.Today.AddDays(-30) && Status != OrderStatus.Cancelled
- Operational Purpose: Fast customer service lookup for recent complaints, re-orders, or feedback.

9. Cancelled (Void Ledger):

- Query Filter: Status == OrderStatus.Cancelled
- Operational Purpose: Houses all voided reservations alongside their mandatory cancellation reason for auditing.

11. All Time:

- Query Filter: Unfiltered complete historical archive.

#### 7.2 Financial Ledger Typography & Dual Balance Cell

- Two-Tier Financial Metric:

- The "Total Amount" column is upgraded to "Total / Balance" with right-aligned monospace tabular numerals (tabular-nums font-mono text-right).
- Top Metric: Displays the immutable contract Grand Total (₱X,XXX).
- Bottom Status Subtext:

- Paid in Full: Rendered as a subtle emerald indicator (🟢 Paid in Full) when Balance Due <= ₱0.
- Outstanding Debt: Highlighted in high-contrast red/amber bold text (🔴 ₱X,XXX Due) when Balance Due > ₱0.

- Semantic Status Badging:

- Eliminates plain text status strings in favor of color-coded pills:

- Unassigned: Slate outline pill (bg-slate-50 border-slate-300 text-slate-700).
- Assigned: Blue pill with motorcycle icon (bg-blue-50 border-blue-200 text-blue-700).
- Delivered: Emerald green pill (bg-emerald-50 border-emerald-200 text-emerald-700).
- Cancelled: Rose red pill (bg-rose-50 border-rose-200 text-rose-700).

#### 7.3 Deep-Fetch Customer Dossier Telemetry & In-Dossier Lifecycle Cancellation

The read-only Customer Dossier acts as the single operational source of truth when interacting with customers over the phone or Facebook Messenger:

1. Logistics & Courier Attribution Telemetry:

- To eliminate navigating across multiple screens during inbound customer inquiries, the dossier's "Customer & Logistics" panel dynamically displays courier status based on fulfillment mode:

- Freelance Delivery (1): Renders assigned rider name, contact phone number, and dispatch status (e.g., 🛵 Kuya Jun (09171005281) • Out for Delivery vs. ⚪ Pending Dispatch).
- Lalamove Courier (2): Displays third-party courier dispatch status alongside pre-release payment clearance (🟢 Cleared for Release vs. 🛑 Hold: Unpaid Balance).
- Walk-in Store Pickup (0): Displays store counter collection status (🏪 Ready for Counter Pickup).

3. 1-Click Messenger Receipt Trigger:

- The dossier header includes an instant [📋 Share Details] clipboard action that generates the standardized Taglish booking receipt (items, address, downpayment acknowledged, balance due) for immediate pasting into active customer chats.

5. In-Dossier Lifecycle Cancellation Gate:

- Location & Visibility: Positioned inside the dossier header/footer as a protected destructive action. Hidden or disabled if the order is already marked Delivered or Cancelled.
- Mandatory Audit Reason: Triggers a confirmation AlertDialog requiring an operational cancellation reason (presets: Customer Change of Mind, Event Postponed, Weather / Flooded Access, or custom remarks).
- Atomic Reversal: Invoking cancellation immediately updates order status to Cancelled, restores reserved carcass inventory back to sellable available stock, and appends an immutable entry to OrderAuditLogs stamped with the active cashier's username.

#### 7.4 Safe Edit Form Tri-Modal Parity & Financial Hierarchy

To ensure consistency with the POS terminal and eliminate layout squishing in the edit drawer:

1. Tri-Modal Segmented Control:

- Replaces the clipped select dropdown with the full 3-way segmented switch: [ 🚗 Delivery Routing ] | [ 🏪 Walk-in Store Pickup ] | [ 📦 Lalamove ].
- Switching modes dynamically updates address placeholders and enforces fee bouncers: selecting Pickup or Lalamove immediately locks the Delivery Fee to ₱0.00 while keeping the Delivery Address field open and editable for customer profile records.

3. Financial Adjustments Visual Hierarchy:

- Delineates computed cart values from editable adjustments:

- Computed Summaries (Read-Only): Lechon Subtotal and Add-Ons Total are clearly styled as calculated badges derived from the active cart items.
- Operational Modifiers (Editable): Delivery Fee (enabled only for Delivery Routing) and Courtesy Discount remain distinct input fields.
- Live Handover Preview: Recalculates Remaining Balance dynamically against the immutable historical downpayment vault.

5. User Action Safeguards:

- Includes an explicit secondary [Discard / Cancel] button beside [Save Modifications] allowing staff to safely exit without committing accidental form changes.

#### 7.5 Granular Cash Custody Sub-Pill Filtering & Audit Badges for Balance Due Directory

In high-volume catering operations, an aggregate "Balance Due" figure creates operational ambiguity because it conflates two fundamentally different financial realities:
1. **Accounts Receivable (Advance Bookings):** Unpaid balances for scheduled future bookings (e.g. next weekend) where money has not yet exchanged hands and collection occurs upon fulfillment.
2. **Physical Floor Cash Custody (Immediate Settlement Liability):** Real physical banknotes collected from customers on today's routes or at the front counter that currently reside either inside freelance riders' pouches on the road (`Road Cash`) or inside staff cash drawers (`In Staff Drawer`), requiring reconciliation and remittance to the business owner via Manifest/Drawer settlement.

To eliminate this ambiguity, the Master Order Directory features granular secondary sub-pill filtering and contextual micro-badges across Web and Mobile:

1. **Sub-Filter State & Predicate Taxonomy:**
   When the `💵 Balance Due` tab is active, a secondary horizontal sub-pill row dynamically slices all orders with `BalanceDue > 0`:
   - `📋 All Unpaid ('all')`: The complete set of active bookings with outstanding balances.
   - `🛵 Road Cash ('rider')`: Delivery orders assigned to active trips or out for delivery (`Fulfillment === 1 && (RoutingStatus === "Assigned" || RoutingStatus === "OutForDelivery") && SettlementCustodyStatus !== "InStaffDrawer" && !IsRemittedToOwner`). Cash is physically in the rider's custody on the street.
   - `🟡 In Drawer ('drawer')`: Orders whose collected cash has been handed over by riders or counter pickup customers and logged into the store staff drawer (`SettlementCustodyStatus === "InStaffDrawer" && !IsRemittedToOwner`).
   - `📅 Advance ('future')`: Orders with a target delivery schedule strictly after today midnight (`TargetDeliveryTime > Today (00:00:00)`) with `SettlementCustodyStatus === "Uncollected"`. These represent future AR commitments rather than cash currently floating on the floor.

2. **Visual Micro-Badges on Balance Column:**
   Directly below or beside the red `🔴 ₱XX,XXX Due` figure on each row or card:
   - `🟡 In Drawer`: Highlighted in golden amber for cash received at the store drawer.
   - `🛵 Road Cash`: Highlighted in blue for cash held by freelance riders on the road.
   - `📅 Advance`: Neutral slate badge indicating scheduled forward bookings.
   - `🏪 Store Pickup`: Emerald badge indicating counter collection orders ready for payment upon customer arrival.

3. **In-Dossier Manifest Deep-Link & Active Custody Warnings:**
   When inspecting an individual order in the Customer Dossier (`<Sheet>` on Web or modal on Mobile):
   - If physical cash custody is active (`SettlementCustodyStatus === "InStaffDrawer"` or `RoutingStatus === "Assigned"`), a prominent amber notice warns dispatchers and cashiers that physical cash custody is active.
   - On Web, an actionable `[View in Manifest ➔]` shortcut navigates directly to `/manifest` for immediate settlement and reconciliation.
   - On Mobile, cashiers are explicitly directed to settle via the dedicated `👑 Drawer` tab.

### 8. Inventory Ledger, Dual-Balance Forecasting & Procurement Engine

The inventory subsystem serves as the immutable "bank statement for pigs," separating physical chest freezer contents from operational forward commitments. All calculations operate on continuous weight brackets (categories) rather than individual ear tags.

#### 8.1 Dual-Balance Stock Formulas & Forecasting Horizon

Stock availability calculations are decoupled into physical presence and sellable buffers using a rolling 14-day operational horizon:

1. Physical Stock (On-Hand):  
   Physical Carcasses = Sum(StockIn + Positive Adjustments) - Sum(StockOut + Negative Adjustments)  
   Represents actual, thawed or frozen units physically sitting inside the chest freezers.
2. Locked Stock (14-Day Forward Commitment):  
   Locked Carcasses = Sum(Committed Reservations)  
   Calculated strictly for orders where:

- ReservationStatus == Committed (downpayment logged OR trusted VIP override).
- TargetDeliveryTime falls between Today (00:00) and Today + 14 Days (23:59).

4. Available Stock (Sellable Buffer):  
   Available Stock = Physical Stock (On-Hand) - Locked Stock (14-Day Horizon)  
   Represents the exact number of carcasses safe to promise to new inquiries without risking operational shortages during the active fulfillment cycle.

#### 8.2 Health Thresholds & Visual Status Badges

- Optimal (Green): Available Stock > MinimumSafetyStock.
- Low Stock (Yellow/Orange): 0 <= Available Stock <= MinimumSafetyStock.
- Deficit (Red / Destructive): Available Stock < 0 (Overbooked beyond physical inventory)

#### 8.3 Direct Freezer-Gate Stock Intake Governance

To eliminate unnecessary administrative overhead and match real-world voice/SMS supplier communication, freezer inventory replenishment operates strictly through direct intake at the "Freezer Gate."

- Single Unified Intake Pathway:

- Multi-stage PO status tracking (Draft -> Submitted -> Fulfilled) is retired from the physical receiving loop. The system does not require pre-existing digital PO records to accept stock into the freezers.
- The Procurement tab functions strictly as a low-stock calculator and Messenger order text generator, decoupled from physical stock ingestion.

- The Freezer-Gate Ingestion Terminal:

- Operators record stock arrivals directly via a streamlined single-view modal on the Inventory page upon physical delivery to the chest freezers.
- The interface allows immediate selection of active meat weight categories, increment/decrement steppers, Supplier DR/Invoice number tracking, and operational notes (e.g., butcher name, carcass grading).

- Audit Ledger & Real-Time Recalculation:

- Every intake writes batch immutable StockIn records to InventoryTransactions.
- Stamped Reason format: [Direct Freezer Intake] DR: {drNumber} | Notes: {notes}.
- Submitting immediately increments Physical Stock on-hand, recalculates Available Stock (Physical - 14d Locked), and clears low-stock procurement warning badges across the dashboard and inventory scoreboards.

### 9. Daily Manifest & Granular Cash Reconciliation

The Daily Manifest functions as the end-of-day financial reconciliation engine to ensure all floating road money is accounted for without cash leakage.

- Granular "Customer-by-Customer" Table Structure: To handle multi-drop routes cleanly, every individual delivery is rendered as a distinct row:

- Rider Name
- Customer Name & 👑 VIP Badge
- Delivery Address
- Total Collected (Gross door collection)
- Rider Delivery Fee (Rider payout)
- Net Remittance (Store revenue owed)
- Action: [Settle Payment]

- Three-Way Payment Categorization Modal: Clicking [Settle Payment] requires the cashier to explicitly record how the money was remitted:

- Physical Cash: Rider hands physical bills directly to the cashier.
- Direct Store GCash: Customer transferred funds directly to the store's primary GCash account.
- Rider GCash Remittance: Rider collected payment and transferred the remittance to the store's GCash account electronically.

- Real-Time Settlement Ripple: Settling a row creates a permanent PaymentLog, clears that delivery row from the Manifest table, and dynamically decrements the pending amount on the Dashboard's Pending Remittance Tracker.

#### 9.1 Tri-Tab Manifest & Daily Settlement Architecture

The Manifest is elevated from a driver-only cash sheet into the centralized "Daily Handover & Cash Reconciliation Center," organizing end-of-day store income across three distinct fulfillment streams:

1. Tab 1: Freelance Rider Remittance (Active Existing View)

- Scope: Outsourced freelance motorcycle delivery trips (Fulfillment = 1).
- Financial Math: Gross Door Collection minus Rider Delivery Fee = Net Store Remittance.
- Settlement Channels: Categorized into Physical Cash, Direct Store GCash, or Rider GCash Transfer.

3. Tab 2: Walk-in Store Pickup Handovers (Counter Settlement)

- Scope: Customers picking up orders directly from the store counter (Fulfillment = 0).
- Financial Math: 100% of the remaining balance goes directly into the store register or store GCash (Rider Delivery Fee = ₱0).
- Time-Blind Ledger Retention ("The Notebook Rule"): Unsettled store pickups remain permanently locked on this tab until the owner digitally reconciles them. If staff collect physical cash during the day and record it on a physical paper ledger/notebook, the order remains visible as "Pending Drawer Remittance" until the owner counts the envelope, compares it against the paper notes, and clicks [Settle Payment].
- Visual Badges: Clearly distinguishes between [🟢 PAID IN FULL — Handover Complete] and [⚠️ UNPAID BALANCE: ₱X,XXX — Collect at Counter].

5. Tab 3: Lalamove Pre-Release Gate (Anti-Loss Courier Verification)

- Scope: Orders fulfilled via customer-booked third-party courier apps (Fulfillment = 2).
- Pre-Release Protection: Third-party drivers transport goods but do not collect lechon payments. This tab acts as a physical security gate preventing kitchen staff from releasing an ₱8,000+ roast to an app courier without verified full payment.
- Status Guard: Highlights [🛑 HOLD: PENDING PAYMENT] versus [🟢 CLEAR TO RELEASE TO COURIER].
- Courier Handoff Action: Allows staff to log final online payment proof and click [Confirm Dispatch], officially closing the ticket without creating driver remittance obligations.

#### 9.2 Financial Audit & Zero-Leakage Governance

- Time-Blind State Retention: Orders with an unsettled balance ((\text{GrandTotal} - \text{Downpayment} > 0)) never expire, auto-archive, or vanish from settlement queues based on the clock. They persist indefinitely across days until a digital payment log is recorded.
- Overnight Overdue Radar: Any unremitted orders from past calendar dates automatically escalate on the Command Center Dashboard's Floating Remittance Radar in high-contrast amber/red, prompting the owner to reconcile physical drawer envelopes and staff notebooks immediately upon morning login.

#### 9.3 Two-Hop Cash Custody Chain & One-Time QR Digital Signature Governance
To eliminate physical signature logbooks and prevent custody disputes between freelance riders, counter staff, and the business owner, the Daily Manifest enforces a two-stage digital custody chain powered by one-time cryptographic QR handshakes:

1. Three-Stage Settlement Custody State Machine:
   - `Uncollected` (Stage 1): Order is out with the freelance rider or awaiting walk-in counter payment.
   - `InStaffDrawer` (Stage 2): Physical cash or rider transfer has been handed over to the counter cashier. The rider is officially cleared of liability, and financial accountability transfers strictly to the authenticated staff member (`StaffValidatedBy` via JWT claims).
   - `Settled` (Stage 3): The staff member remits the specific order's cash envelope to the Business Owner (order-by-order). Upon Owner verification, the system writes the final `PaymentLog`, stamps `OwnerApprovedBy`, and clears the record from the Manifest and Dashboard.

2. Hop 1: Rider-to-Staff Handshake (Tab 1: Freelance Riders):
   - Full 2-Hop QR Chain (`Cash` & `ManualGCash`):
     - When settling Physical Cash or Rider GCash Remittance, the PC generates a 10-minute cryptographic `OneTimeToken` and renders a dynamic QR code pointing to `${window.location.origin}/qr-settle/${token}`.
     - The rider scans the QR code using their personal smartphone (via mobile data or Wi-Fi), inputs their Name (`RiderSignedBy`) and Remitted Amount (`RiderRemittedAmount`), and submits their digital signature.
     - The PC modal polls the session every 2 seconds, displaying the rider's signed declaration in real time. The cashier counts the physical bills and clicks `[Validate & Receive into Drawer]`.
     - The rider's phone immediately transitions to an official green Digital Handover Receipt for screenshot proof, while the order moves to `InStaffDrawer`.
     - Includes a `[Manual Counter Override]` fallback on the PC modal if a rider's phone battery is dead or lacks a working camera.
   - 1-Hop Direct Bypass (`GCash` - Direct to Store):
     - If the customer paid directly to the Store's GCash QR, the rider holds ₱0 of store funds. The transaction bypasses the Rider-to-Staff QR signature and logs the GCash reference number directly for settlement.

3. Counter Collection & Hop 2: Staff-to-Owner Remittance (Order-by-Order):
   - Walk-in Store Pickups (Tab 2): Because no rider is involved, counter collection immediately stamps the logged-in cashier's JWT identity and places the cash into `InStaffDrawer`.
   - Order-by-Order Owner Verification: For any order sitting in `InStaffDrawer` (across Tab 1 or Tab 2), clicking `[👑 Remit to Owner]` generates a One-Time Owner Verification QR Code on the PC monitor.
   - The Owner scans the QR code on their phone to review the custody trail (Rider Name, Staff Holder, Exact Peso Amount) and taps `[👑 Owner Approve & Settle]`. If the Owner is actively logged into the PC terminal with an `Owner` role account, they may also execute a 1-click `[Owner Quick-Approve]` directly on screen.
   - Token Self-Destruction: Once approved, the `OneTimeToken` is permanently invalidated (`IsUsed = true`) to prevent replay attacks.

#### 9.4 Settlement Hardening, Active Session Resume & Custody Verification Guards

To safeguard against multi-device discrepancies, accidental handovers, envelope shortages, and rogue approvals, the settlement engine enforces four cryptographic and RBAC verification guards:

1. **Safeguard 1 — Discrepancy Rejection Protocol (`RejectRiderSignatureAsync`):**
   - When a freelance rider submits a digital remittance signature where `RiderRemittedAmount != ExpectedAmount`, the PC modal displays a prominent high-contrast amber/rose discrepancy alert (`⚠️ SHORT BY ₱X,XXX` or `⚠️ OVER BY ₱X,XXX`).
   - Counter cashiers are provided an immediate `[🔄 Ask Rider to Re-enter]` action calling `POST /api/logistics/settlements/qr-session/{token}/reject`.
   - The session resets from `SignedByRider` back to `PendingScan`, clearing `RiderSignedBy`, `RiderRemittedAmount`, and `RiderSignedAt`.
   - The rider's smartphone polls the transition and immediately surfaces a high-priority alert banner (`⚠️ The cashier requested you re-check and re-submit your remittance amount.`), requiring recount and resubmission.

2. **Safeguard 2 — Active Session Resume (`CreateQrSessionAsync`):**
   - To eliminate token bloat and prevent broken QR codes when a modal is reopened or re-rendered, `CreateQrSessionAsync` queries for an existing active session matching `OrderId`, `HopStage`, `!IsUsed`, `Status != "Expired"`, and `ExpiresAt > DateTime.UtcNow`.
   - If an active session exists, the backend updates its `PaymentMethod` (if changed), saves, and returns the existing token rather than minting a new GUID. The rider scanning the screen never suffers invalidation due to dispatcher UI actions.

3. **Safeguard 3 — Staff Custody Undo & Reversion Protocol (`RevertCustodyAsync`):**
   - If cash was mistakenly validated into staff drawer custody (or if an envelope recount reveals errors prior to owner turnover), the system supports an authorized custody rollback via `POST /api/logistics/settlements/orders/{orderId}/revert-custody`.
   - **RBAC Guard:** Strictly limited to the holding staff member (`User.Identity.Name == order.StaffValidatedBy`) or an authenticated `Owner`.
   - Reverts `SettlementCustodyStatus` to `Uncollected`, zeroes `StaffValidatedBy`, `StaffValidatedAt`, and `HeldByStaffMethod`, expires any active Hop 2 QR sessions, and commits a permanent diff record to `OrderAuditLogs`.

4. **Safeguard 4 — Owner Counted-Amount Verification Gate (`OwnerApproveQrSessionAsync`):**
   - Eliminates blind 1-click approvals across both mobile QR views and desktop PC shortcuts.
   - Requires explicit numerical entry of `CountedAmount` (`Physical Bills Counted in Envelope (₱)`).
   - Approval is strictly disabled and rejected with `400 BadRequest` if `CountedAmount != ExpectedAmount` (`Counted bills (₱X,XXX.XX) do not match expected remittance (₱X,XXX.XX). Recount envelope before closing.`).
   - Guarantees that physical envelope contents are audited against the system ledger before any `PaymentLog` is committed or order closed.

### 10. Content Management System (CMS), Pricing & Catalog Governance

The CMS serves as the centralized operational control board for catalog metadata, base pricing, inventory safety buffers, and kitchen cooking profiles.

#### 10.1 Category Metadata & Weight Boundary Governance

- Immutable Foreign Keys: Order items and inventory ledger rows bind strictly to ItemCategoryId. Kilogram weight ranges (MinimumWeightKg, MaximumWeightKg) serve as forward-facing operational guidelines for live farm intake and kitchen scheduling.
- Validation Safeguards: Weight boundary modifications enforce MinimumWeightKg < MaximumWeightKg. Non-meat add-ons are strictly constrained to 0.0 kg to preserve their shielding from kitchen roasting schedules and freezer ledgers.
- Category Lifecycle (Soft Deletes): Hard deletes are strictly prohibited across all categories. Categories retired from active sale are toggled via IsActive = false. Inactive items are hidden from POS intake while preserving historical sales reports, order dossiers, and inventory audit logs.

#### 10.2 Configurable Safety Stock & Procurement Thresholds

- Dynamic Reorder Triggers: Each meat category maintains an independently adjustable MinimumSafetyStock integer.
- Real-Time Inventory Ripple: Adjusting MinimumSafetyStock immediately shifts the health threshold evaluation in the Live Balances scoreboard (AvailableStock <= MinimumSafetyStock) and recalculates the reorder deficit (Deficit = SafetyStock - AvailableStock) displayed in the Procurement Tab and Messenger order generator.

#### 10.3 Price History & Audit Trails

- Price Historization: Every change to an ItemCategory.BasePrice is captured in an immutable, append-only PriceHistoryLogs table recording ItemCategoryId, OldPrice, NewPrice, ChangedBy, and DateChanged within an atomic SQL transaction.
- Historical Isolation (Price Snapshotting): Modifying a category base price never mutates historical orders or orders already marked as fulfilled. New prices only apply to new checkouts and unconfirmed advance reservations governed by the Peak Season Renegotiation engine.
- Visual Audit Drawer: The CMS UI provides a dedicated chronological audit drawer per category displaying timestamps, price deltas, and the user responsible for the update.

#### 10.4 Guarded Price Adjustment Workflow

- Two-Step Mutation: Direct inline table editing of base prices is prohibited to prevent accidental mutations. Price updates must be initiated via an explicit action modal displaying:

1. Current Base Price (read-only)
2. Proposed New Base Price
3. Calculated Delta (+₱X hike or -₱X reduction)
4. Peak-Season Renegotiation Warning: Explains that increasing roast prices will automatically surface affected advance bookings onto the Command Center Dashboard renegotiation queue.

### 11. Frontend UI Architecture & Global Navigation

#### 11.1 Framework & Client-State Management

- Framework: React + Vite + TypeScript.
- Styling & Components: Tailwind CSS paired with shadcn/ui for professional, accessible UI components.
- State Management: TanStack Query (React Query) acts as a smart caching layer, utilizing aggressive background invalidation to synchronize live operational boards (Logistics, Kanban, Dashboard, Cash Reconciliation) without full page reloads.

#### 11.2 Application Shell & Navigation Layout Governance

To ensure cognitive focus and operational ergonomics for store cashiers and owners, the global navigation shell implements role-oriented decluttering and responsive widescreen spacing.

- Navigation Visibility Rules:

- Active Core Links: Dashboard (/), Orders (/orders), Logistics (/logistics), Manifest (/manifest), Inventory (/inventory), and Settings/CMS (/cms).
- Dormant/Deferred Views: Kitchen Kanban (/kitchen) and Analytics (/analytics) are decoupled from primary navigation to reduce visual noise during Phase 1 operational rollout. Their underlying routes remain registered in React Router for future enablement.
- Direct CMS Access: Menu Settings (/cms) is elevated to a primary navigation item to provide frictionless access to catalog governance, base prices, weight brackets, and safety stock thresholds.

- Command Center Viewport Standards:

- Fluid Layout Hierarchy: The administrative shell adopts a widescreen-first container (max-w-7xl) centered on a warm alabaster/stone-cream canvas (`bg-[#FAF6F4]` / `bg-stone-50`), preventing artificial horizontal truncation on desktop terminals while eliminating cold blue-light eye strain during 12-hour store shifts.
- Dynamic Zero-Inbox Visibility: Action-required banners (Pending Downpayments, Peak Season Renegotiations) render strictly when actionable records exist. When queues are clear, banners collapse entirely to preserve screen space for live rosters.
- Global Action Triggers: The dashboard header houses direct entry triggers for [+ New Order] and [Generate Daily Sheets], eliminating unnecessary page hopping during order intake.

#### 11.3 Brand Identity & "Warm Culinary Enterprise" Visual Governance

To align the software platform with the official Yumi's Lechon brand identity (`/yumi-logo.png`, featuring Warm Dusty Terracotta Rose `#DDA196`, Yumi's Lechon Crimson Red `#C81E1E`, and Golden Yellow `#FACC15`) while preserving 12-hour shift ergonomics and unmistakable financial status clarity:

- **Official Brand Asset Placement (`/yumi-logo.png`):**
  - Mounted as the browser favicon (`index.html`), in the global navigation sidebar header (`Sidebar.tsx`) with a golden-amber ring, prominently above the shift authentication card (`LoginPage.tsx`), and on operational print/mobile headers (`DailySheetsPage.tsx` and `QrSignPage.tsx`).
- **Surface & Navigation Palette:**
  - **Main Application Canvas:** Warm Alabaster / Stone-Cream (`#FAF6F4` / `bg-stone-50`) across `RootLayout` and all administrative views, paired with crisp `bg-white` cards, `border-stone-200/90` borders, and `bg-stone-100/70` uppercase stone table headers.
  - **Global Sidebar Navigation (`Sidebar.tsx`):** Deep Roasted Espresso (`#181312` / `bg-stone-950`) with Golden Amber active route highlights (`bg-amber-500/15 text-amber-400 border-l-4 border-amber-400`) and a warm stone shift profile HUD distinguishing `👑 Owner` vs. `🧑‍💼 Cashier`.
  - **Primary Brand Action Triggers:** Yumi's Lechon Crimson (`bg-[#C81E1E] hover:bg-[#A81818] text-white`) is reserved for primary creation and submission actions (`[+ New Order]`, `[Sign In to Shift]`, `[Submit Order Ticket]`, `[+ Add New Item]`, and CMS save actions).
- **Strict Semantic Status Guardrails (Non-Negotiable):**
  - **Emerald Green (`bg-emerald-600` / `text-emerald-700`):** Strictly reserved for financial validation (`[✅ Validate & Receive into Drawer]`), `[PAID IN FULL]` badges, positive stock balances, `[Settle Payment]`, and the Official Rider Handover Receipt.
  - **Golden Amber (`bg-amber-500` / `text-amber-800`):** Strictly reserved for `👑 VIP` badges, `🟡 In Staff Drawer` custody indicators, and low-stock warnings.
  - **Rose / Destructive Red (`bg-rose-50` / `bg-rose-600`):** Strictly reserved for cash shortage warnings (`⚠️ SHORT BY ₱...`), overdue remittance alerts, and cancellation/reversion confirmation triggers.

12. AI-Assisted POS Intake Bridge (Screenshot Extraction)

To accelerate telephone and social media order intake, the POS Form supports automated field hydration via multimodal computer vision parsing of Facebook Messenger chat screenshots.

#### 12.1 Operational Parsing Rules (High-Precision Vision Parser)

- **Human-in-the-Loop Isolation:** Automated screenshot parsing is strictly an assistive form-filling tool. The parser NEVER directly mutates database records or commits inventory holds. All extracted data is loaded into the active POS form draft for manual verification and confirmation by the cashier prior to submission.
- **Header vs. Body Identity Separation:**
  - `FacebookName` (Header Extraction): Extracts the Messenger profile name shown in the top navigation bar/header (e.g., `"Macel Obina Mendoza"`).
  - `CustomerName` (Body Extraction): Extracts the recipient name labeled inside the booking slip body (e.g., `"Name : Macel Mendoza"` -> `"Macel Mendoza"`).
- **Dedicated Metadata Isolation & Strict Kitchen Sanitation:**
  - Primary phone (`CP # 1`) maps to `ContactNumber`.
  - `Landmark` (Dedicated Landmark): Any text labeled `"Landmark :"` or drop-off guide (e.g., `"Paseo de carmona"`) is extracted directly into `Landmark` and NEVER placed inside `Remarks`.
  - `EventType` (Dedicated Event Type): Any text labeled `"Type of Event :"` or `"Event :"` (e.g., `"Anniversary"`, `"Birthday"`, `"Fiesta"`, `"Wedding"`, `"Corporate"`) is extracted directly into `EventType` and NEVER placed inside `Remarks`.
  - `Remarks` (Strict Kitchen Sanitation): Strictly reserved for kitchen preparation, roasting, or packaging instructions (e.g., `"walang dinuguan"`, `"print shoutout banner"`, `"extra crispy skin"`, `"liver sauce only"`) plus any secondary phone number (`CP # 2`). If no kitchen-specific prep request or secondary phone number exists, `Remarks` MUST be an empty string `""`.
- **Fulfillment, Delivery Fee & Downpayment Extraction:**
  - If fulfillment is Store Pickup (`0`) or Lalamove (`2`), `DeliveryFee` is forced to `₱0` and locked.
  - If fulfillment is Delivery (`1`), explicitly stated delivery charges (e.g., `"Deliver Charge : 0"` -> `0`, `"Delivery Charge : 565"` -> `565`) populate `DeliveryFee`.
  - Downpayments marked as `"paid"` or `"fully paid"` populate `Downpayment`.

#### 12.2 Customer Profile Intelligence Engine (Preferences & Complaint Radar)

To prevent repeat service issues and surface recurring customer preferences during order intake, the platform maintains a reactive `CustomerProfile` intelligence registry:

1. **Automated Order Upsert & Lazy Historical Seeding:**
   - Indexed uniquely on normalized `ContactNumber` (`CustomerProfiles` table).
   - Every order created via `OrderService.CreateOrderAsync` automatically creates or updates the matching `CustomerProfile`, incrementing `TotalOrdersCount`, updating `FullName`, `FacebookName`, `DefaultAddress`, and `DefaultLandmark`, and preserving `IsVip`.
   - When looking up a phone number or Facebook name that predates `CustomerProfiles`, `CustomerService.LookupCustomerAsync` lazily aggregates historical non-cancelled orders from `Orders` so repeat customers are recognized immediately.
2. **Reactive POS Intake Radar (`GET /api/customers/lookup`):**
   - As the cashier types or scans a `ContactNumber` ($\ge 7$ digits) or `FacebookName` ($\ge 3$ chars) in either the Web or Mobile POS terminal (debounced 300ms), the UI queries `GET /api/customers/lookup`.
   - When a matching profile is found, the POS surfaces:
     - **Repeat Customer Pill:** `⭐ Repeat Customer • X past orders` (and `👑 Known VIP` if applicable).
     - **Complaint Alert Banner:** `⚠️ Previous Issue Logged: {ComplaintHistory}` in high-contrast rose/amber when `ComplaintHistory` is non-empty.
     - **Customer Preference Banner:** `💡 Customer Preference: {Preferences}` in blue when `Preferences` is non-empty.
3. **In-Dossier Feedback & Notes Management (`PUT /api/customers/{id}/notes` & `PUT /api/customers/by-phone/{phone}/notes`):**
   - Both the Web Customer Dossier Sheet (`OrdersPage.tsx`) and Mobile Customer Dossier Modal (`OrderDossierModal.tsx`) render a dedicated **Customer Intelligence & Feedback** card displaying Lifetime Orders Count, Known Preferences, and Logged Complaints, with an `[✏️ Update Customer Notes]` editor for Cashiers and Owners.

- Human-in-the-Loop Isolation: Automated screenshot parsing is strictly an assistive form-filling tool. The parser NEVER directly mutates database records or commits inventory holds. All extracted data is loaded into the active React Hook Form draft for manual verification and confirmation by the cashier prior to submission.
- Sizing Tier Resolution:

- Word-based sizes (e.g., "Small", "Medium", "Large", "XXL", "Jumbo") map strictly to Whole Lechon categories.
- Kilogram designations (e.g., "Belly 2kg", "Belly 3kg", "Belly 4kg", "Belly 5kg") map strictly to discrete Lechon Belly categories.

- Communication & Note Bundling:

- The first valid Philippine phone number (CP # 1) maps to ContactNumber.
- Secondary numbers (CP # 2), landmark instructions, event descriptions (e.g., "Baptismal"), and culinary preferences (e.g., "Liver Sauce Only") are automatically concatenated into the Remarks field.

- Fulfillment & Fee Enforcement:

- If fulfillment is extracted as Store Pickup, the Delivery Fee is forced to ₱0 and locked.
- If fulfillment is extracted as Delivery, the delivery fee input unlocks, and any explicitly noted delivery fee from the chat is populated.

- Financial Extraction:

- Downpayments marked as "paid" or "fully paid" populate the Downpayment input. The system's standard financial state machine evaluates whether the order immediately transitions to Committed or requires follow-up.

### 13. Authentication, Shift Login & Role-Based Access Control (RBAC)

#### 13.1 Authentication & Role-Based Access Control (RBAC) Architecture

To safeguard menu pricing, financial drawer balances, and configuration settings while empowering front-line staff to manage daily customer communications and order edits, the system implements token-based JWT (JSON Web Token) authentication with two operational roles:

1. Operational Role Matrix:

- 🧑‍‍💼 Cashier / Counter Staff (Cashier):

- POS Order Entry: Create and submit new orders across all fulfillment types (Delivery, Pickup, Lalamove).
- Master Order Directory: Full operational editing authority (customer names, contact numbers, delivery addresses, delivery times, line items, dynamic add-ons, and remarks).
- Courtesy Discounts & Cancellations: Authorized to apply discounts and execute order cancellations (requiring a mandatory operational reason), with all actions stamped into immutable audit logs.
- Cash & Handover Reconciliations: Allowed to record customer payments (Cash / GCash) via Customer Dossiers and the Daily Manifest.
- Production & Restock Visibility: Access to the Daily Dispatch Planner, kitchen rosters, and Direct Freezer-Gate Stock Intake.
- Explicit Restrictions: Strictly prohibited from modifying CMS menu base prices, adding/deactivating item categories, deciding peak-season price waivers, or managing staff accounts.

- 👑 Business Owner / Administrator (Owner):

- Complete, unrestricted administrative authority across the entire platform.
- Exclusive access to CMS Catalog & Base Pricing governance, safety stock thresholds, and cooking profile clocks.
- Exclusive authority to resolve Peak Season Price Hike renegotiations (Customer Agreed vs. Waive Hike).
- Exclusive authority to create, edit, and deactivate user accounts.

3. Shift-Based Session Governance:

- Single-Shift Validity: To maintain counter speed during rush periods, tokens are issued with a 12-hour expiration window (TimeSpan.FromHours(12)). Staff log in once at morning opening without repeated re-authentication interruptions.
- Automated Session Attachment: Client-side HTTP interceptors attach the Bearer token to all outbound API calls. Unauthenticated requests (401 Unauthorized) or role-forbidden requests (403 Forbidden) trigger automated redirects to /login with explanatory toasts.

#### 13.2 Automated User Attribution & "Black Box" Audit Stamping

- Identity-Linked Order Creation:

- The master Orders entity includes an explicit CreatedBy (string) column.
- Upon order creation via the POS terminal, the backend extracts the authenticated username directly from the JWT claims (User.Identity.Name) and stamps it onto the database record, replacing legacy unauthenticated or generic placeholders.

- Real-Name Audit Footprints:

- All modifications recorded in OrderAuditLogs, PriceHistoryLogs, and PaymentLogs dynamically resolve ChangedBy or ReceivedBy from the calling user's JWT identity.
- Staff actions (such as applying a ₱300 courtesy discount, modifying a delivery time, or voiding a booking) are permanently linked to the specific staff account on shift.

#### 13.3 Pre-Seeded Shift Accounts

For immediate out-of-the-box system bootstrapping, the database seeds two production-ready accounts (hashed with BCrypt):

- 👑 Owner Account: Username owner | Password OwnerPassword123! | Role Owner | Full Name Business Owner
- 🧑‍💼 Cashier Account: Username cashier | Password CashierPassword123! | Role Cashier | Full Name Store Cashier

#### 13.4 Owner-Controlled Staff Account Management & Self-Preservation Guard

To eliminate static credentials and protect shift integrity, the business owner retains exclusive authority over staff and terminal accounts:

1. **Account Provisioning:**
   - Owners can provision new counter staff logins directly via the Web CMS under the **`👥 Staff & Terminal Accounts`** tab.
   - Required fields: `FullName` (e.g., "Maria Santos"), `Username` (unique, lowercase alphanumeric, minimum 3 characters), `Initial Password` (minimum 6 characters), and `Role` (`Cashier` default, or `Owner`).
   - Passwords are encrypted server-side using BCrypt hashing before database persistence.

2. **Shift Password Resets:**
   - Owners can override forgotten or compromised shift passwords through the `ResetPasswordModal` without requiring access to prior passwords.
   - Updated credentials take effect immediately on subsequent sign-ins.

3. **Instant Terminal Access Revocation (`IsActive` Bouncer):**
   - Owners can deactivate any staff account with 1-click status toggling (`IsActive = false`).
   - The login pipeline (`AuthService.LoginAsync`) enforces a deactivated account bouncer: if credentials are valid but `!user.IsActive`, authentication is rejected immediately with `401 Unauthorized` and an explicit error: `"This account has been deactivated. Please contact the business owner."`.

4. **The Owner Self-Preservation Guard:**
   - To prevent catastrophic lockout, the backend (`UserService.ToggleUserStatusAsync`) and frontend UI strictly forbid an Owner from deactivating their own currently logged-in account (`string.Equals(user.Username, currentUsername, StringComparison.OrdinalIgnoreCase)`).
   - In the frontend roster, the Owner's row displays an active `(You)` badge and the deactivation trigger is permanently disabled with the tooltip `"Cannot deactivate your own active Owner account"`.

#### 13.5 Production Environment-Gated Authentication Security

To protect live customer data while preserving developer speed during local testing:

1. **Dual Environment Architecture (`'cloud'` vs `'local'`):**
   - The Web SPA and Mobile App maintain synchronized persistence of the active backend environment (`'cloud'` targeting live production endpoints vs `'local'` targeting `localhost:5199` or Android emulator `10.0.2.2:5199`).
   - Synced in local storage under `lechon_api_env` (with legacy fallback to `lechon_api_environment`), defaulting to `'local'` on localhost development hosts and `'cloud'` in production builds or when accessing remote domains.

2. **Environment-Aware Quick-Fill Bouncer:**
   - **On Live Cloud (`apiEnv === 'cloud'`):** The `1-TAP QUICK-FILL TEST PRESETS` container (`[ 👑 Fill Owner ]` and `[ 🧑‍🍳 Fill Cashier ]`) is **strictly hidden and completely unmounted** from the DOM/React Native tree. Switching to `'cloud'` immediately clears username, password, and error banners to prevent accidental exposure or submission of default test credentials against live production databases.
   - **On Local Dev (`apiEnv === 'local'`):** The quick-fill buttons are rendered to enable rapid 1-tap test credential population for shift testing.

\*\*


---

## 14. 🧭 Order Intake Ergonomics, Dynamic Departure Routing & Cross-Platform POS Parity

### 14.1. Daily Sequential Order Reference (`MMDDYY-XXX`) & Receipt Privacy
* **Internal Format:** Every created order is stamped with an automatic daily reference `MMDDYY-XXX` (e.g., `102126-001` for the first order created on October 21, 2026) based on the daily sequence count.
* **Internal Searchability:** Dispatchers can search by `OrderReference` or `FacebookName` alongside `CustomerName`, `ContactNumber`, and `Id` in both Web and Mobile directories.
* **Customer Receipt Privacy Shield:** Customer-facing Messenger templates (`generateBookingConfirmation`, `generateVerificationReminder`, `generateDispatchNotification`) **strictly omit** `OrderReference` and internal database `Id` values so competitors cannot infer daily sales volume.

### 14.2. Enriched Order Metadata (`FacebookName`, `Source`, `EventType`, `Landmark`)
* **`FacebookName`:** Captures the customer's exact Facebook/Messenger profile name for instant chat lookup when it differs from the recipient's legal/delivery name.
* **`Source`:** Standardized quick-select pills (`Walk-in`, `Business FB Page`, `Personal FB Account`, `Other`).
* **`EventType`:** Standardized quick-select pills (`Birthday`, `Fiesta`, `Wedding`, `Corporate`, `Other`).
* **`Landmark`:** Dedicated physical navigation cue (e.g., `"Tapat ng Shell, Dilaw na gate"`) rendered prominently on Rider Manifests, Order Dossiers, and Messenger templates, keeping `Remarks` strictly focused on **Kitchen & Prep Instructions**.

### 14.3. CMS Delivery Pricing Engine (`SystemSetting`)
* **Configurable Formula:** Stored in `SystemSettings` (`DeliveryFeeBaseFare` default `₱100.00`, `DeliveryFeeRatePerKm` default `₱15.00`) and managed via the CMS **Delivery Pricing Configuration** card (`GET /api/cms/delivery-pricing`, `PUT /api/cms/delivery-pricing`).
* **Auto-Calculation with Override:** When `Fulfillment == InHouseDelivery` (`1`) and `DistanceKm > 0`, both Web and Mobile POS forms auto-compute:
  $$\text{Suggested Delivery Fee} = \text{Round}((\text{DistanceKm} \times \text{RatePerKm}) + \text{BaseFare})$$
  Dispatchers may still manually override the `DeliveryFee` input. For `Pickup` (`0`) and `CustomerArrangedLalamove` (`2`), `DistanceKm` and `DeliveryFee` lock to `0`.

### 14.4. Distance Departure Ladder & Kitchen Anchor (`RiderDepartureTime`)
* **6-Tier Distance Departure Ladder:** When `Fulfillment != Pickup`, `RiderDepartureTime` is automatically calculated backward from `TargetDeliveryTime` based on `DistanceKm`:
  - `0.0 – 2.9 km`: `-15 minutes`
  - `3.0 – 9.9 km`: `-30 minutes`
  - `10.0 – 15.0 km`: `-60 minutes` (`1 hr`)
  - `16.0 – 20.0 km`: `-75 minutes` (`1 hr 15m`)
  - `20.1 – 35.0 km`: `-90 minutes` (`1.5 hrs`)
  - `> 35.0 km`: `-120 minutes` (`2 hrs`)
  - For `Pickup` (`0`), `RiderDepartureTime` is locked equal to `TargetDeliveryTime` (`0 min` offset).
* **Interactive Nudge Pills:** Dispatchers can adjust `RiderDepartureTime` on the fly using quick-offset pills (`-30m`, `-45m`, `-1h`, `-1h 30m`, `-2h`) or manual datetime input for holiday traffic or custom routing.
* **Kitchen Backward-Scheduling Anchor:** `SchedulingService` uses `anchorTime = order.RiderDepartureTime ?? order.TargetDeliveryTime` as the zero-hour baseline so every pig finishes packaging right as the rider departs the commissary.


---

## 15. 📱 Mobile Floor Action Hub & Cross-Platform Downpayment Radar

### 15.1. The Mobile Floor Action Hub (`OrdersScreen.tsx` + `FloorActionView.tsx`)
Preserving the ergonomic 3-tab mobile shell (`[📋 Orders] | [➕ New POS] | [👑 Drawer]`), the `Orders` screen features a dedicated two-segment toggle switcher:
* **`[📋 Orders Directory]`:** Master order directory with debounced search, 6 filter pills (`Upcoming`, `Today Only`, `Tomorrow`, `Balance Due`, `Recent Edits`, `Past 30d`, `Cancelled`, `All Time`), and 4-way balance custody sub-pills (`All Unpaid`, `Road Cash`, `In Drawer`, `Advance`).
* **`[⚡ Floor Action ({floorActionCount})]`:** Floor action command center aggregating urgent cashier and kitchen tasks into two high-priority operational sections with pull-to-refresh.

### 15.2. Section A: Action Required — Downpayment Radar
Surfaces all active, non-cancelled orders scheduled within a 4-day trigger window where `Downpayment == 0` and `IsTrustedCustomer == false`:
* **Countdown Urgency Tags:**
  - `[🚨 Due Tomorrow / Today]` (High-contrast red) when `daysUntil <= 1`.
  - `[⚠️ Due in {daysUntil} days]` (Warm amber) when `daysUntil > 1`.
* **Telemetry Display:** Displays customer name, Facebook/Messenger profile (`💬 {facebookName}`), target delivery datetime, pig and add-on items summary, and total balance due.
* **1-Tap Floor Action Buttons:**
  1. `[ 💬 Copy Reminder ]`: Copies the privacy-shielded Taglish downpayment reminder template (`generateDownpaymentReminder`) directly to clipboard.
  2. `[ 📞 Call ]`: Launches native phone dialer for customer outreach.
  3. `[ 💵 Record Deposit ]`: Direct trigger opening `OrderDossierModal` / payment logger so cashiers can immediately record downpayment funds and commit physical freezer inventory (`ReservationStatus = Committed`).

### 15.3. Section B: Tonight's Defrost & Kitchen Prep Roster
Renders all pig carcasses scheduled for tomorrow's roasting batches sorted strictly by **Earliest `TahiStartTime` (Preparation Priority)**:
* **Header Summary & The Carcass Bouncer:** Dynamic count of total carcasses scheduled (e.g., `Tonight's Defrost & Prep Roster (8 Heads)`). Enforces the Defrost Roster Carcass Bouncer: add-ons (sauces, dinuguan, pancit, drinks, etc. with `MinimumWeightKg <= 0` or non-carcass category keywords) are strictly eliminated so roasters only defrost authentic pig carcasses.
* **Weight & Quantity Badges:** Displays bracket (e.g., `1x Medium Whole (22.0–24.0 kg)`).
* **Rush Defrost Detector (`IsRushDefrost`):** High-contrast red badge (`[🚨 RUSH / LATE DEFROST]`) flagged when orders are booked late (after 12:00 PM cutoff on the day prior to roasting), alerting roasters to initiate immediate rapid thawing protocols.
* **Customer & VIP Telemetry:** Highlights `👑 VIP` status for trusted accounts and indicates fulfillment destination (`🏪 Store Pickup` vs. `📍 Delivery Address`).
* **Prep / Tahi Monospace Deadline:** Formatted in bold tabular monospace (e.g., `🔪 Prep / Tahi Deadline: 07:30 AM`) so staff inspecting chest freezers can align pig thawing with the kitchen clock.
* **Direct Dossier Access:** Tapping any roster card opens `OrderDossierModal` for the underlying order.

---

## 16. Whole Lechon Freebies, Owner Verification, Duplicate Safety & Operational Alerts

### 16.1 Whole Lechon 7-Freebies Engine
* **Eligibility:** Only quantities whose category has `MinimumWeightKg >= 13` count as Whole Lechon heads. Lechon Belly (`0 < MinimumWeightKg < 13`) and add-ons never create freebie quota.
* **Standard Quota:** Each eligible head starts with one each of `Sarsa`, `1.5L Coke`, `Pancit`, `Palabok`, `Spaghetti`, `Dinuguan`, and `Puto` (`7 × wholePigCount`). Web and Mobile persist `FreebiesConfigJson` and the staff-facing `FreebiesSummary`.
* **Dynamic CMS No-Freebies Option:** Opting out zeros every count and applies `NoFreebiesDiscountPerPig × wholePigCount` to `Discount` (default ₱2,000 per whole lechon head). This discount rate is dynamically governed by the business owner in the CMS (`CmsPage.tsx` under Delivery & Pricing Configuration), persisted in `SystemSettings` (`NoFreebiesDiscountPerPig`), and surfaced via `DeliveryPricingDto`. Returning to Standard removes only the engine-applied discount without disrupting manual order discounts.
* **Raw Innards:** Enabling Raw Innards locks `Dinuguan = 0`; the cooked-dish allowance becomes `6 × wholePigCount`, and the omitted Dinuguan cannot be replaced.
* **Operations Visibility:** Kitchen and Rider Remarks cells show rose (`🚫 No Freebies`), emerald (unchanged standard), or amber (custom swap / Raw Innards) badges above ordinary staff remarks. Dossiers and Owner queues show the same summary.

### 16.2 Owner Order Confirmation Gate
* Every non-draft order immediately reserves freezer inventory and receives its backward production schedule regardless of encoder role.
* Owner-created orders and drafts are confirmed at creation. Active Cashier-created orders remain `IsOwnerConfirmed = false` until an Owner invokes `POST /api/orders/{id}/confirm-owner`.
* Confirmation stamps `OwnerConfirmedAt`, `OwnerConfirmedBy`, and `Order verified and confirmed by Owner ({username})`. Web Dashboard, Web/Mobile directories, Floor Action, and dossiers expose the pending state and Owner-only action.

### 16.3 Proactive Duplicate Order Radar
* Customer lookup matches normalized phone, Facebook name, or customer name and returns non-cancelled drafts plus bookings from yesterday through 60 days ahead, even without a `CustomerProfile` row.
* Web and Mobile POS/Edit show a high-visibility warning with reference, schedule, item summary, and encoder. A second same-calendar-day speed bump requires explicit confirmation before create/update.

### 16.4 BIR Four-Channel Payment Mapping
* Every successful initial downpayment and later settlement writes a canonical `PaymentLog.PaymentMethod`: `Cash`, `GCash`, `Maya`, or `Bank Transfer`.
* A positive downpayment without a selected channel defaults to `GCash`; a zero downpayment persists `None`. Forms, dossiers, and settlement modals expose all four choices.
* Directory/detail projections include per-channel summaries. Web Orders aggregates the active slice into a BIR breakdown strip while dossiers retain individual payment rows and channel badges.

### 16.5 Scheduled Mobile Operational Notifications
* `expo-notifications` configures Android channel `default` at high importance after authenticated permission is granted.
* Daily local reminders run at **9:00 AM** for the 4-day deposit radar and **4:00 PM** for the nightly defrost pull-list.
* Owner devices receive an immediate alert when the pending Owner queue increases; authenticated devices receive one when a new Rush Defrost item appears. Floor Action displays alert status and a `[ 🔔 Test Alert ]` action.
