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

  // 1. NEW: Track if the safety switch is flipped!
  const [isEditing, setIsEditing] = useState(false);

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  // Helper to open the drawer
  const handleRowClick = (order: any) => {
    setSelectedOrder(order);
    setIsEditing(false); // 2. NEW: Always default to safe Read-Only mode!
    setIsSheetOpen(true);
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
            <TableHead>Delivery Time</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                Loading orders...
              </TableCell>
            </TableRow>
          ) : orders?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
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
                <TableCell>{order.customerName}</TableCell>
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

              {/* 3. The Safety Switch */}
              {selectedOrder && (
                <Button
                  variant={isEditing ? "outline" : "default"}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "Cancel Edit" : "Edit Details"}
                </Button>
              )}
            </div>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-4">
              {isEditing ? (
                /* --- THE UNLOCKED EDIT FORM --- */
                <EditOrderForm
                  order={selectedOrder}
                  onClose={() => setIsSheetOpen(false)}
                />
              ) : (
                /* --- THE PROTECTED READ-ONLY VIEW --- */
                <div className="space-y-6">
                  {/* Card 1: Customer Details */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Customer Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Name</p>
                        <p className="font-medium text-base">
                          {selectedOrder.customerName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Target Delivery</p>
                        <p className="font-medium text-blue-700">
                          {new Date(
                            selectedOrder.targetDeliveryTime,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Financial Splits */}
                  <div className="bg-white p-5 rounded-md border shadow-sm">
                    <h3 className="font-semibold text-lg border-b pb-2 mb-3 text-gray-800">
                      Financial Splits
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Grand Total:</span>
                        <span className="font-semibold">
                          ₱{selectedOrder.totalAmount?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Downpayment:</span>
                        <span>
                          - ₱{selectedOrder.downpayment?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-600 font-bold text-lg border-t pt-2 mt-2">
                        <span>Balance to Collect:</span>
                        <span>
                          ₱
                          {(
                            selectedOrder.totalAmount -
                            (selectedOrder.downpayment || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
