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

#### 2.6 Tri-Modal Fulfillment & Address Retention Governance

The POS and Logistics engines enforce strict boundary rules across three distinct fulfillment modes while preserving customer location data across all channels:

1. Delivery Routing (Fulfillment = 1):
   - Standard road freight managed by the store's outsourced freelance motorcycle fleet.
   - Address is mandatory; distance calculation and editable delivery fee inputs are active.
   - Generates cash remittance and delivery fee payout rows on the Daily Manifest.

2. Walk-in Store Pickup (Fulfillment = 0):
   - Customer collects the roast directly from the store counter.
   - Address Retention Rule: The Delivery Address field remains fully enabled and editable. Staff capture customer addresses during intake to populate customer dossiers and support last-minute conversions from pickup to delivery.
   - Fee Safeguards: Distance (KM) and Delivery Fee are strictly forced to 0 and locked to ₱0 to prevent accidental freight overcharges on store pickup tickets.
   - Excluded from road dispatch planning and driver manifest reconciliations.

3. Third-Party Courier / Lalamove (Fulfillment = 2):
   - Delivery arranged via on-demand third-party delivery apps where freight costs are shouldered directly by the customer.
   - Delivery address remains open and mandatory for dispatch coordination.
   - Distance and Delivery Fee inputs are strictly forced to 0 and locked to ₱0 (preventing erroneous delivery fees from appearing on the store receipt).
   - Excluded from freelance driver batch dispatch and manifest cash remittance workflows.

### 3. Dashboard Triggers & Exception Handling

The "Zero-Inbox" Dashboard acts as a dynamic Command Center, programmed with a Time-Sensitive Trigger Engine to prevent screen clutter.

- Quick-Glance KPI Widgets: The top of the dashboard provides instant metrics:

- Tomorrow's Lechon Count: Strictly tallies only Committed/Locked pigs.
- Pending Remittance Tracker: Shows Rider Name, Amount to Remit, and Dispatch Date. If a rider holds unremitted cash from a previous day, their card glows RED. This widget dynamically syncs with the Cash Reconciliation module, decrementing live balances as orders are settled and vanishing once a rider's balance hits ₱0.

- Pending Downpayments (4-Day Window): If an order is unpaid, it remains invisible until exactly 4 days before delivery. The table includes Action Center Integration, allowing the admin to click an order, open the "Customer Dossier" modal, and log a GCash receipt instantly without leaving the dashboard.
- Final Follow-Up & Cancellation (1-Day Window): If the order remains unpaid 1 day before delivery, it becomes a critical follow-up.
- Unified Tomorrow's Operations Roster: A single, merged table combining Delivery Verifications and the Defrosting Roster. It groups customer delivery details alongside the exact pigs needed from the freezer tonight. Late additions to this list trigger a red [RUSH / LATE DEFROST] badge.
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

The business relies on a trusted pool of experienced, outsourced freelance motorcycle riders managed via a Facebook Messenger Group Chat. The Logistics page is split into two operational views:

- Tab A: Live Operations (Today)

- Real-time monitoring board for orders scheduled for delivery today.
- Displays assigned rider names, destination addresses, and delivery status.
- Action Controls: Provides a [Mark Delivered] trigger to close trips upon receiving photo proof in Messenger, a [Report Issue/Failed] action, and an [Edit Rider] button to reassign orders on the fly in case of vehicle breakdowns or rider emergencies.

- Tab B: Dispatch Planner (Tomorrow)

- The planning workspace opened every afternoon/night to view tomorrow's unassigned orders.
- Admin manually assigns the freelance Rider Name and inputs the Delivery Fee (calculated manually via distance mapping).
- Screenshot Generator (UI Magic): A dedicated "Generate Daily Sheets" button hides all admin controls and opens a clean, full-screen print view optimized for mobile screenshots:

- Tab 1: Kitchen View: Sorted by Tahi Time / Priority. Hides money data.
- Tab 2: Rider View: Sorted chronologically by Delivery Time. Hides cooking data. Shows exact cash splits.

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
  - Every intake writes batch immutable `StockIn` records to `InventoryTransactions`.
  - Stamped Reason format: `[Direct Freezer Intake] DR: {drNumber} | Notes: {notes}`.
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

2. Tab 2: Walk-in Store Pickup Handovers (Counter Settlement)
   - Scope: Customers picking up orders directly from the store counter (Fulfillment = 0).
   - Financial Math: 100% of the remaining balance goes directly into the store register or store GCash (Rider Delivery Fee = ₱0).
   - Time-Blind Ledger Retention ("The Notebook Rule"): Unsettled store pickups remain permanently locked on this tab until the owner digitally reconciles them. If staff collect physical cash during the day and record it on a physical paper ledger/notebook, the order remains visible as "Pending Drawer Remittance" until the owner counts the envelope, compares it against the paper notes, and clicks [Settle Payment].
   - Visual Badges: Clearly distinguishes between [🟢 PAID IN FULL — Handover Complete] and [⚠️ UNPAID BALANCE: ₱X,XXX — Collect at Counter].

3. Tab 3: Lalamove Pre-Release Gate (Anti-Loss Courier Verification)
   - Scope: Orders fulfilled via customer-booked third-party courier apps (Fulfillment = 2).
   - Pre-Release Protection: Third-party drivers transport goods but do not collect lechon payments. This tab acts as a physical security gate preventing kitchen staff from releasing an ₱8,000+ roast to an app courier without verified full payment.
   - Status Guard: Highlights [🛑 HOLD: PENDING PAYMENT] versus [🟢 CLEAR TO RELEASE TO COURIER].
   - Courier Handoff Action: Allows staff to log final online payment proof and click [Confirm Dispatch], officially closing the ticket without creating driver remittance obligations.

#### 9.2 Financial Audit & Zero-Leakage Governance
- Time-Blind State Retention: Orders with an unsettled balance (\(\text{GrandTotal} - \text{Downpayment} > 0\)) never expire, auto-archive, or vanish from settlement queues based on the clock. They persist indefinitely across days until a digital payment log is recorded.
- Overnight Overdue Radar: Any unremitted orders from past calendar dates automatically escalate on the Command Center Dashboard's Floating Remittance Radar in high-contrast amber/red, prompting the owner to reconcile physical drawer envelopes and staff notebooks immediately upon morning login.

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

### 11. Frontend UI Architecture

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
  - Fluid Layout Hierarchy: The administrative shell adopts a widescreen-first container (max-w-7xl) centered on a subtle neutral canvas (bg-slate-50/50), preventing artificial horizontal truncation on desktop terminals.
  - Dynamic Zero-Inbox Visibility: Action-required banners (Pending Downpayments, Peak Season Renegotiations) render strictly when actionable records exist. When queues are clear, banners collapse entirely to preserve screen space for live rosters.
  - Global Action Triggers: The dashboard header houses direct entry triggers for [+ New Order] and [Generate Daily Sheets], eliminating unnecessary page hopping during order intake.

12. AI-Assisted POS Intake Bridge (Screenshot Extraction)

To accelerate telephone and social media order intake, the POS Form supports automated field hydration via multimodal computer vision parsing of Facebook Messenger chat screenshots.

#### 12.1 Operational Parsing Rules

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

\*\*
