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

// 1. Import the shadcn Sheet components!
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import EditOrderForm from "@/components/ui/orders/EditOrderForm";
import OrderForm from "@/components/ui/orders/OrderForm";

export default function OrdersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 300);
  const { data: orders, isLoading } = useOrdersDirectory(debouncedSearchTerm);

  // 2. The State Tracker: Who did we just click on?
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Helper to open the drawer
  const handleRowClick = (order: any) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Search Bar remain the same */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Master Order Directory
        </h1>
        <p className="text-gray-500 mt-2">
          Search and safely modify historical and active orders.
        </p>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Search by Customer Name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="bg-white"
        />
      </div>

      {/* The Data Grid */}
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
                // 3. The Trigger: Click a row to open the drawer!
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

      {/* 4. The Slide-Out Safety Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto bg-slate-50">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl">
              Edit Order #{selectedOrder?.id}
            </SheetTitle>
            <SheetDescription>
              Modifying the Delivery Time or Item Size will automatically
              recalculate the kitchen roasting schedule.
            </SheetDescription>
          </SheetHeader>

          {/* We will drop our new EditOrderForm component here in the next step! */}
          {selectedOrder && (
            <EditOrderForm
              order={selectedOrder}
              onClose={() => setIsSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

       <OrderForm/>
    </div>

  );
}
