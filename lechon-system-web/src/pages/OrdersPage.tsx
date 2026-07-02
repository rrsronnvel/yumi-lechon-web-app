/* eslint-disable @typescript-eslint/no-explicit-any */import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useOrdersDirectory } from "@/hooks/useOrdersDirectory";
// Import your shadcn/ui components
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function OrdersPage() {
  // 1. State & Debouncing Engine
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 300);
  const { data: orders, isLoading } = useOrdersDirectory(debouncedSearchTerm);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Master Order Directory</h1>
        <p className="text-gray-500 mt-2">Search and manage all historical and active orders.</p>
      </div>

      {/* The Search Bar */}
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
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No orders found matching "{debouncedSearchTerm}"
                </TableCell>
              </TableRow>
            ) : (
              // Map through the flattened DTO array
              orders?.map((order: any) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{new Date(order.targetDeliveryTime).toLocaleString()}</TableCell>
                  <TableCell>₱{order.totalAmount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.reservationStatus}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}