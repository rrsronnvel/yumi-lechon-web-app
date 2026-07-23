/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useOrdersDirectory } from "@/hooks/useOrdersDirectory";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
// Plus the Plus icon if you want a nice button!
import { Plus } from "lucide-react";

// 1. Import the shadcn Sheet & Tabs components!
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // <-- NEW IMPORT
import EditOrderForm from "@/components/ui/orders/EditOrderForm";
import { Button } from "@/components/ui/button";
import OrderForm from "@/components/ui/orders/OrderForm";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useLogPayment } from "@/hooks/useLogPayment";
import { useOrderAuditLogs } from "@/hooks/useOrderAuditLogs";

export default function OrdersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  // 1. Add this new state variable to track the clicked tab
  const [activeTab, setActiveTab] = useState("upcoming");

  // 2. Pass the activeTab directly into your hook!
  const { data: orders, isLoading } = useOrdersDirectory(
    debouncedSearchTerm,
    activeTab,
  );
  // The State Tracker: Who did we just click on?
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const paymentMutation = useLogPayment();

  // 1. We use || null to prevent 'undefined' errors
  // 2. We pull out 'data' and explicitly cast it as 'any' so TS lets us do math!
  const { data, isLoading: isDetailsLoading } = useOrderDetails(
    selectedOrder?.id || null,
  );

  const { data: auditLogs, isLoading: isAuditLoading } = useOrderAuditLogs(
    selectedOrder?.id || null,
  );
  const orderDetails = data as any; // <-- This silences all the red lines below!

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");

  // Helper to open the drawer
  const handleRowClick = (order: any) => {
    setSelectedOrder(order);
    setIsEditing(false); // 2. NEW: Always default to safe Read-Only mode!
    setIsSheetOpen(true);
  };

  // 3. UPGRADED: The Location Truncation & Badging Helper
  const formatLocation = (order: any) => {
    // 1. ALWAYS check for pickup first!
    const rawFulfill = String(order?.fulfillment).toLowerCase();
    const isPickup = rawFulfill === "0" || rawFulfill === "pickup";

    if (isPickup) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-500 border-slate-200 shadow-sm"
        >
          🏪 Store Pickup
        </Badge>
      );
    }

    // 2. Only if it's NOT a pickup, check for the address.
    const address = order?.deliveryAddress || order?.location || "";

    if (address.trim() === "") {
      return (
        <span className="text-sm text-gray-400 italic">
          No Address Provided
        </span>
      );
    }

    if (address.length > 30) {
      return (
        <span title={address} className="text-sm text-gray-600">
          {address.substring(0, 30)}...
        </span>
      );
    }
    return <span className="text-sm text-gray-600">{address}</span>;
  };

  // 2. The Clean Code Trick:
  // We wrap your entire table in a helper function so we don't have to
  // copy-paste this 100 lines of code into every single Tab!
  const renderDataGrid = () => (
    <div className="bg-white border rounded-md shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Delivery Time</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                {" "}
                {/* <-- Updated to 6 */}
                Loading orders...
              </TableCell>
            </TableRow>
          ) : orders?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                {" "}
                {/* <-- Updated to 6 */}
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            orders?.map((order: any) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => handleRowClick(order)}
              >
                <TableCell className="font-medium">#{order.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {order.customerName}
                    {order.isTrustedCustomer && (
                      <Badge
                        variant="outline"
                        className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-sm"
                      >
                        👑 VIP
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* 🚀 THE FIX: Pass the whole 'order' object! */}
                <TableCell>{formatLocation(order)}</TableCell>

                <TableCell>
                  {new Date(order.targetDeliveryTime).toLocaleString()}
                </TableCell>
                <TableCell>₱{order.totalAmount?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{order.status}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header with New Order Button */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Master Order Directory
          </h1>
          <p className="text-gray-500 mt-2">
            Search and safely modify historical and active orders.
          </p>
        </div>

        {/* The New Order Modal */}
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-orange-600 text-primary-foreground shadow hover:bg-orange-700 h-9 px-4 py-2">
            <Plus className="h-4 w-4" /> New Order
          </DialogTrigger>
          {/* We use max-w-4xl and overflow-y-auto because your POS form is big! */}
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto w-full">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                New POS Entry
              </DialogTitle>
            </DialogHeader>

            {/* Your massive form is now safely tucked inside! */}
            <OrderForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Search by Customer Name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="bg-white"
        />
      </div>

      {/* 3. The Tabs Scaffold */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* The Clickable Buttons */}
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past-30">Past 30 Days</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="all-time">All Time</TabsTrigger>
        </TabsList>

        {/* The Content Folders */}
        <TabsContent value="upcoming">{renderDataGrid()}</TabsContent>
        <TabsContent value="past-30">{renderDataGrid()}</TabsContent>
        <TabsContent value="cancelled">{renderDataGrid()}</TabsContent>
        <TabsContent value="all-time">{renderDataGrid()}</TabsContent>
      </Tabs>

      {/* The Slide-Out Safety Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto bg-slate-50">
          <SheetHeader className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-2xl">
                  Order #{selectedOrder?.id}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {isEditing
                    ? "Modifying the Delivery Time or Item Size will recalculate the kitchen schedule."
                    : "Read-only view. Click 'Edit' to unlock modifications."}
                </SheetDescription>
              </div>

              {/* 3. The Safety Switches */}
              {selectedOrder && (
                <div className="flex gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setIsPaymentOpen(true)}
                  >
                    💳 Log Payment
                  </Button>
                  <Button
                    variant={isEditing ? "outline" : "default"}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "Cancel Edit" : "Edit Details"}
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-4">
              {isEditing ? (
                /* --- THE UNLOCKED EDIT FORM --- */
                <EditOrderForm
                  order={
                    orderDetails
                  } /* <--- CHANGE THIS from selectedOrder to orderDetails! */
                  onClose={() => setIsSheetOpen(false)}
                />
              ) : /* --- THE PROTECTED READ-ONLY VIEW --- */
              isDetailsLoading ? (
                <div className="py-16 text-center text-slate-500 animate-pulse">
                  Pulling heavy dossier from the vault...
                </div>
              ) : orderDetails ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Card 1: Logistics & Contact */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Customer & Logistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="text-gray-500">Name</p>
                        <div className="font-medium text-base flex items-center gap-2">
                          {orderDetails.customerName}
                          {/* THE VIP BADGE INJECTION */}
                          {orderDetails.isTrustedCustomer && (
                            <Badge
                              variant="outline"
                              className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-sm"
                            >
                              👑 VIP
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500">Contact Number</p>
                        <p className="font-medium">
                          {orderDetails.contactNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Delivery Target</p>
                        <p className="font-medium text-blue-700">
                          {new Date(
                            orderDetails.targetDeliveryTime,
                          ).toLocaleString()}
                        </p>
                      </div>
                      {/* Explicit Delivery Method Display */}
                      <div>
                        <p className="text-gray-500">Delivery Method</p>
                        <p className="font-medium flex items-center gap-1">
                          {/* 🚀 THE FIX: Check for the word "pickup" or "0" */}
                          {String(orderDetails?.fulfillment).toLowerCase() ===
                            "pickup" ||
                          String(orderDetails?.fulfillment) === "0"
                            ? "🏪 Walk-in Store Pickup"
                            : "🚚 Standard Delivery"}
                        </p>
                      </div>

                      {/* Explicit Address Display */}
                      <div>
                        <p className="text-gray-500">Address / Location</p>
                        <p className="font-medium text-gray-800">
                          {orderDetails?.deliveryAddress ||
                            orderDetails?.location || (
                              <span className="text-gray-400 italic">
                                None Provided
                              </span>
                            )}
                        </p>
                      </div>
                      {/* The Special Remarks Highlight */}
                      {orderDetails.remarks && (
                        <div className="col-span-2 bg-amber-50 p-3 rounded border border-amber-100">
                          <p className="text-xs text-amber-800 font-bold uppercase mb-1">
                            Customer Remarks
                          </p>
                          <p className="text-sm text-gray-800">
                            {orderDetails.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Order Manifest & Add-ons */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Order Manifest
                    </h3>
                    <div className="space-y-3">
                      {/* CHANGED: Now mapping over orderItems to match the C# JSON */}
                      {orderDetails.orderItems?.map(
                        (item: any, index: number) => (
                          <div
                            key={index}
                            className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100"
                          >
                            <div>
                              <p className="font-medium text-sm text-gray-800">
                                {item.quantity}x{" "}
                                {item.itemCategory?.name || "Lechon Size"}
                              </p>
                            </div>

                            {/* 🚀 THE IRONCLAD FIX: Cleanly display the old 4500 price! */}
                            <p className="font-semibold text-sm text-gray-800">
                              {item.totalPrice > 0 ? (
                                `₱${item.totalPrice.toLocaleString()}`
                              ) : orderDetails.orderItems?.length === 1 ? (
                                `₱${(orderDetails.price || 0).toLocaleString()}`
                              ) : (
                                <span className="text-gray-400 italic text-xs">
                                  Included in Subtotal
                                </span>
                              )}
                            </p>
                          </div>
                        ),
                      )}

                      {orderDetails.addOns && (
                        <div className="pt-3 border-t border-dashed mt-2">
                          <p className="text-xs text-gray-500 uppercase mb-1 tracking-wider">
                            Add-Ons Requested
                          </p>
                          <p className="text-sm font-medium text-gray-800">
                            {orderDetails.addOns}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Exact Financial Splits */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Financial Splits
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal (Lechon):</span>
                        <span>
                          ₱{orderDetails.price?.toLocaleString() || 0}
                        </span>
                      </div>

                      {/* 🚀 NEW: The Reverse-Engineered Add-Ons Row */}
                      {(orderDetails.grandTotal || 0) -
                        (orderDetails.price || 0) -
                        (orderDetails.deliveryFee || 0) +
                        (orderDetails.discount || 0) >
                        0 && (
                        <div className="flex justify-between text-indigo-600 font-medium">
                          <span>Add-Ons:</span>
                          <span>
                            ₱
                            {(
                              (orderDetails.grandTotal || 0) -
                              (orderDetails.price || 0) -
                              (orderDetails.deliveryFee || 0) +
                              (orderDetails.discount || 0)
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-gray-600 border-b pb-2">
                        <span>Delivery Fee:</span>
                        <span>
                          ₱{orderDetails.deliveryFee?.toLocaleString() || 0}
                        </span>
                      </div>

                      {orderDetails.discount > 0 && (
                        <div className="flex justify-between text-red-500 pt-1">
                          <span>Discount Applied:</span>
                          <span>
                            - ₱{orderDetails.discount?.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between font-semibold pt-1">
                        <span>Grand Total:</span>
                        <span>
                          ₱{orderDetails.grandTotal?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Downpayment:</span>
                        <span>
                          - ₱{orderDetails.downpayment?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-600 font-bold text-lg border-t pt-2 mt-2">
                        <span>Balance to Collect:</span>
                        <span>
                          ₱
                          {(
                            (orderDetails.grandTotal || 0) -
                            (orderDetails.downpayment || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Security Audit Log */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-4 text-gray-800 flex items-center gap-2">
                      🛡️ Audit Log
                    </h3>
                    <div className="space-y-4">
                      {isAuditLoading ? (
                        <p className="text-sm text-slate-500 animate-pulse">
                          Decrypting logs...
                        </p>
                      ) : auditLogs?.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          No modifications logged. Order is in its original
                          state.
                        </p>
                      ) : (
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                          {auditLogs?.map((log: any) => (
                            <div key={log.id} className="relative ml-6">
                              {/* The Timeline Dot */}
                              <span className="absolute flex items-center justify-center w-3 h-3 bg-slate-400 rounded-full -left-[31px] ring-4 ring-white mt-1"></span>

                              <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">
                                {new Date(log.timestamp).toLocaleString()} •{" "}
                                {log.changedBy}
                              </p>
                              <p className="text-sm text-slate-800 mt-1 font-medium bg-slate-50 p-2 rounded border border-slate-100">
                                {log.changes}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-500 py-10">
                  Data unavailable.
                </div>
              )}{" "}
              {/* <--- THIS EXTRA PARENTHESIS FIXES THE ERROR! */}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Additional Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Amount Received (₱)
              </label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || "")
                }
                placeholder="e.g., 3000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 mt-1 rounded-md border border-input bg-white px-3"
              >
                <option value="GCash">GCash</option>
                <option value="Cash">Physical Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2 h-11"
              disabled={paymentMutation.isPending || !paymentAmount}
              onClick={() => {
                // Ensure field names perfectly match your C# DTO!
                paymentMutation.mutate(
                  {
                    orderId: selectedOrder.id,
                    amount: Number(paymentAmount),
                    paymentProvider: paymentMethod,
                  },
                  {
                    onSuccess: () => {
                      setIsPaymentOpen(false);
                      setPaymentAmount("");
                    },
                  },
                );
              }}
            >
              {paymentMutation.isPending ? "Logging..." : "Confirm Deposit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* -------------------------------------- */}
    </div>
  );
}
