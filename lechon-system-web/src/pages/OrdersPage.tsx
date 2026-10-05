/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useOrdersDirectory,
  OrderDirectoryDto,
} from "@/hooks/useOrdersDirectory";
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
import { Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import EditOrderForm from "@/components/ui/orders/EditOrderForm";
import { Button } from "@/components/ui/button";
import OrderForm from "@/components/ui/orders/OrderForm";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useLogPayment } from "@/hooks/useLogPayment";
import { useOrderAuditLogs } from "@/hooks/useOrderAuditLogs";

export default function OrdersPage() {
  const [filterTab, setFilterTab] = useState("upcoming");
  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebounce(rawSearch, 300);

  const { data: orders, isLoading } = useOrdersDirectory(
    debouncedSearch,
    filterTab
  );

  const [selectedOrder, setSelectedOrder] = useState<OrderDirectoryDto | null>(
    null
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const paymentMutation = useLogPayment();

  const { data, isLoading: isDetailsLoading } = useOrderDetails(
    selectedOrder?.id || null
  );

  const { data: auditLogs, isLoading: isAuditLoading } = useOrderAuditLogs(
    selectedOrder?.id || null
  );
  const orderDetails = data as any;

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");

  const handleRowClick = (order: OrderDirectoryDto) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setIsSheetOpen(true);
  };

  const renderLocation = (order: OrderDirectoryDto) => {
    const fulfillment = Number(order.fulfillment);
    const address = (order.deliveryAddress || "").trim();

    if (fulfillment === 0) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-600 border-slate-200 shadow-xs font-normal"
        >
          🏪 Store Pickup
        </Badge>
      );
    }

    const truncated =
      address.length > 32 ? `${address.substring(0, 32)}...` : address;

    if (fulfillment === 2) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium"
          >
            📦 Lalamove
          </Badge>
          <span
            className="text-sm text-slate-600 truncate max-w-[200px]"
            title={address}
          >
            {truncated || (
              <span className="italic text-slate-400">No Address</span>
            )}
          </span>
        </div>
      );
    }

    // fulfillment === 1 (Delivery) or default
    return (
      <span className="text-sm text-slate-700" title={address}>
        {truncated || (
          <span className="italic text-slate-400">No Address Provided</span>
        )}
      </span>
    );
  };

  const renderTargetSchedule = (deliveryTime: string | Date) => {
    const targetDate = new Date(deliveryTime);
    if (isNaN(targetDate.getTime())) {
      return <span className="text-sm text-slate-400">Invalid Date</span>;
    }

    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      targetDate.getFullYear() === tomorrow.getFullYear() &&
      targetDate.getMonth() === tomorrow.getMonth() &&
      targetDate.getDate() === tomorrow.getDate();

    const formattedDate = targetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const formattedTime = targetDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
          <span>{formattedDate}</span>
          {isToday && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Today
            </span>
          )}
          {isTomorrow && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Tomorrow
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-slate-700">
          {formattedTime}
        </div>
      </div>
    );
  };

  const renderFinancialGrid = (order: OrderDirectoryDto) => {
    const isPaid = Number(order.balanceDue || 0) <= 0;
    return (
      <div className="tabular-nums font-mono text-right space-y-0.5">
        <div className="font-bold text-slate-900 text-sm">
          ₱{Number(order.grandTotal || 0).toLocaleString()}
        </div>
        <div className="text-xs font-medium">
          {isPaid ? (
            <span className="text-emerald-700">🟢 Paid in Full</span>
          ) : (
            <span className="text-red-600">
              🔴 ₱{Number(order.balanceDue || 0).toLocaleString()} Due
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderStatus = (order: OrderDirectoryDto) => {
    if (order.isCancelled) {
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 font-medium"
        >
          🛑 Cancelled
        </Badge>
      );
    }

    const status = (order.routingStatus || "").trim();
    if (status === "Assigned") {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 font-medium"
        >
          🛵 Assigned
        </Badge>
      );
    }
    if (status === "Delivered") {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
        >
          🟢 Delivered
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-700 border-slate-200 font-medium"
      >
        ⚪ Unassigned
      </Badge>
    );
  };

  const renderDataGrid = () => (
    <Card className="bg-white border rounded-xl shadow-xs overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-slate-50/60 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-800">
          Order Directory Records
        </CardTitle>
        <div className="text-xs font-mono font-medium text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
          Showing{" "}
          <strong className="text-slate-900">{orders?.length ?? 0}</strong>{" "}
          orders
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="w-[150px]">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Target Schedule</TableHead>
              <TableHead className="text-right">Total / Balance</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                    <span className="text-sm">Loading orders...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <p className="font-medium text-slate-700">No orders found.</p>
                    <p className="text-xs text-slate-400">
                      Try adjusting your search terms or active tab filter.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders?.map((order: OrderDirectoryDto) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-amber-50/40 transition-colors"
                  onClick={() => handleRowClick(order)}
                >
                  {/* Order Column */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">
                          #{order.id}
                        </span>
                        {order.hasRecentEdits && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-[10px] h-4.5 px-1.5"
                          >
                            ✏️ Edited
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-normal">
                        by {order.createdBy || "System"}
                      </div>
                    </div>
                  </TableCell>

                  {/* Customer Column */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">
                          {order.customerName}
                        </span>
                        {order.isTrustedCustomer && (
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-xs"
                          >
                            👑 VIP
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {order.contactNumber || "N/A"}
                      </div>
                    </div>
                  </TableCell>

                  {/* Location Column */}
                  <TableCell>{renderLocation(order)}</TableCell>

                  {/* Target Schedule Column */}
                  <TableCell>
                    {renderTargetSchedule(order.targetDeliveryTime)}
                  </TableCell>

                  {/* Total / Balance Column */}
                  <TableCell>{renderFinancialGrid(order)}</TableCell>

                  {/* Status Column */}
                  <TableCell>{renderStatus(order)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with New Order Button */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Master Order Directory
          </h1>
          <p className="text-gray-500 mt-1">
            Search, filter, and inspect financial balances across all active and historical bookings.
          </p>
        </div>

        {/* The New Order Modal */}
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-orange-600 text-primary-foreground shadow-xs hover:bg-orange-700 h-9 px-4 py-2">
            <Plus className="h-4 w-4" /> New Order
          </DialogTrigger>
          {/* Widescreen POS Terminal Modal Shell */}
          <DialogContent className="max-w-5xl xl:max-w-6xl w-full max-h-[92vh] p-0 overflow-hidden gap-0">
            <DialogHeader className="sr-only">
              <DialogTitle>New POS Order Entry</DialogTitle>
            </DialogHeader>

            {/* Two-Column Ergonomic POS Form */}
            <OrderForm onClose={() => setIsNewOrderOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by customer name, phone, or #order ID..."
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="bg-white pl-9"
        />
      </div>

      {/* 6-Tab Switch Slicing */}
      <Tabs value={filterTab} onValueChange={setFilterTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-slate-100/90 rounded-lg">
          <TabsTrigger
            value="upcoming"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            📅 Upcoming
          </TabsTrigger>
          <TabsTrigger
            value="recent"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            ✏️ Recently Modified
          </TabsTrigger>
          <TabsTrigger
            value="balance-due"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            💵 Balance Due
          </TabsTrigger>
          <TabsTrigger
            value="past-30"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            ⏳ Past 30 Days
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            🚫 Cancelled
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            📚 All Time
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filterTab} className="mt-4">
          {renderDataGrid()}
        </TabsContent>
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
                <EditOrderForm
                  order={orderDetails}
                  onClose={() => setIsSheetOpen(false)}
                />
              ) : isDetailsLoading ? (
                <div className="py-16 text-center text-slate-500 animate-pulse">
                  Pulling heavy dossier from the vault...
                </div>
              ) : orderDetails ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Card 1: Logistics & Contact */}
                  <div className="bg-white p-5 rounded-md border shadow-xs">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Customer & Logistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="text-gray-500">Name</p>
                        <div className="font-medium text-base flex items-center gap-2">
                          {orderDetails.customerName}
                          {orderDetails.isTrustedCustomer && (
                            <Badge
                              variant="outline"
                              className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-xs"
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
                            orderDetails.targetDeliveryTime
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Delivery Method</p>
                        <p className="font-medium flex items-center gap-1">
                          {String(orderDetails?.fulfillment).toLowerCase() ===
                            "pickup" ||
                          String(orderDetails?.fulfillment) === "0"
                            ? "🏪 Walk-in Store Pickup"
                            : "🚚 Standard Delivery"}
                        </p>
                      </div>

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
                  <div className="bg-white p-5 rounded-md border shadow-xs">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Order Manifest
                    </h3>
                    <div className="space-y-3">
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
                        )
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
                  <div className="bg-white p-5 rounded-md border shadow-xs">
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
                  <div className="bg-white p-5 rounded-md border shadow-xs">
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
              )}
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
                if (!selectedOrder) return;
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
                  }
                );
              }}
            >
              {paymentMutation.isPending ? "Logging..." : "Confirm Deposit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
