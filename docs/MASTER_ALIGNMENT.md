
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
    

### 6. Financial Math & Cash Split Rules

- Price Snapshotting: Orders permanently lock in the base price of the item at the exact moment of checkout, ensuring historical records are tamper-proof even if menu prices rise.
    
- The Grand Total Formula: (Sum of Lechon) + (Sum of Add-Ons) + Delivery Fee - Discount = Grand Total.
    
- The Smart Balance Formula: Remaining Balance = (Grand Total) - (Sum of All Logged Payments).
    
- Cash Drops (The Split): If the customer pays in physical cash, the rider immediately pockets their Delivery Fee. When the rider returns to the store, they hand the admin only the exact Lechon Fee amount.
    
- Overpayments & Refunds: If a customer downgrades their order size after paying in full, the Smart Balance mathematically turns negative. The UI highlights this in red as "Overpaid / Refund Due" so the dispatcher knows to hand the rider cash to return to the customer.
    
- Fully Paid in Advance Exception: If a customer pays 100% upfront (Meat + Delivery), the Manifest explicitly shows Amount to Collect: ₱0. However, the Delivery Fee column still displays the amount (e.g., ₱150) so the admin knows they owe the rider that cash directly out of the store's register at the end of the day.
    

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
    

### 8. Inventory Audit Ledger & Procurement Workflow

The inventory system is designed as a strict financial-style audit ledger (a "Bank Statement for Pigs"), managed exclusively by the Office Admin. Add-Ons are explicitly excluded from this strict ledger.

- Tab 1: Live Balances: The scoreboard. A quick-glance table showing current stock vs. minimum safety thresholds, utilizing red badges for low inventory.
    
- Tab 2: Audit Ledger: A chronological, searchable history of every physical movement in the freezer (Stock-Ins from suppliers, Stock-Outs from completed orders, and Manual Adjustments).
    
- Mandatory Adjustment Reasons: If an admin manually deducts a pig from the system, the system enforces a strict validation rule requiring them to type a "Reason" to prevent untraceable stock loss.
    
- The Procurement (Supplier) Workflow: When stock is low, the admin clicks a button to generate a clean, formatted text list of needed pigs optimized for copy-pasting directly into Facebook Messenger.
    

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
    

### 10. Content Management System (CMS) & Price History

The CMS acts as the global control board for menu rules and pricing.

- Soft Deletes (Discontinuation): Items cannot be permanently deleted. Instead, admins toggle an IsActive flag to safely hide discontinued items from the POS without breaking historical records.
    
- Dynamic Cooking Clocks: Admins can adjust the ProductCookingProfile (Tahi/Salang durations) for any item. Updating a clock automatically triggers a background recalculation of all upcoming, active order schedules.
    
- Menu Expansion: Admins can independently create brand new Item Categories without developer intervention.
    
- Price History Timeline: Updating a price generates an auditable timeline record (Item, Old Price, New Price, Date Changed) to track historical revenue trends.
    
- The Peak Season Price Hike Utility: Changing a base lechon price triggers a system scan for upcoming advance orders booked at the old rate (strictly ignoring Add-Ons). This powers the "Peak Season Renegotiation" dashboard list, allowing admins to manually [Waive Hike], apply [Customer Agreed], or execute a [Customer Cancelled] void.
    

### 11. Frontend UI Architecture

- Framework: React + Vite + TypeScript.
    
- Styling & Components: Tailwind CSS paired with shadcn/ui for professional, accessible UI components.
    
- State Management: TanStack Query (React Query) acts as a smart caching layer, utilizing aggressive background invalidation to synchronize live operational boards (Logistics, Kanban, Dashboard, Cash Reconciliation) without full page reloads.
    

