import React from "react";
import {
  usePendingConfirmations,
  useDeliveryVerifications,
  useDefrostRoster,
} from "@/hooks/useDashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  // 1. Dispatch our three data messengers simultaneously
  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
  } = usePendingConfirmations();
  const {
    data: deliveries,
    isLoading: deliveriesLoading,
    isError: deliveriesError,
  } = useDeliveryVerifications();
  const {
    data: defrost,
    isLoading: defrostLoading,
    isError: defrostError,
  } = useDefrostRoster();

  // Helper component to show a pulsing loading state
  const DashboardSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Operations</h1>
        <p className="text-muted-foreground mt-2">
          Your zero-inbox command center for today.
        </p>
      </div>

      {/* PRIORITY 1: The Money (Pending Confirmations) */}
      <Card className="border-t-4 border-t-red-500">
        <CardHeader>
          <CardTitle className="text-red-700 flex justify-between items-center">
            Action Required: Pending Downpayments
            {pending && pending.length > 0 && (
              <Badge variant="destructive">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingLoading && <DashboardSkeleton />}
          {pendingError && (
            <p className="text-red-500">
              Failed to load pending confirmations.
            </p>
          )}

          {/* Empty State / Zero-Inbox */}
          {pending?.length === 0 && (
            <div className="text-center py-6 text-green-600 font-medium">
              🎉 All caught up! No pending confirmations.
            </div>
          )}

          {/* Data Table */}
          {pending && pending.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Target Delivery</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((item) => (
                  <TableRow key={item.orderId}>
                    <TableCell className="font-medium">
                      #{item.orderId}
                    </TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                      {new Date(item.targetDeliveryTime).toLocaleString()}
                    </TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {/* 🛡️ The safety harness ensures it never crashes the screen again */}
                      ₱
                      {(
                        item?.totalAmount ??
                        0
                      ).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PRIORITY 2: The Logistics (Delivery Verifications) */}
      <Card className="border-t-4 border-t-amber-500">
        <CardHeader>
          <CardTitle className="text-amber-700 flex justify-between items-center">
            Double-Check: Tomorrow's Deliveries
            {deliveries && deliveries.length > 0 && (
              <Badge className="bg-amber-500">{deliveries.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deliveriesLoading && <DashboardSkeleton />}
          {deliveriesError && (
            <p className="text-red-500">
              Failed to load delivery verifications.
            </p>
          )}

          {deliveries?.length === 0 && (
            <div className="text-center py-6 text-green-600 font-medium">
              🚚 All deliveries double-checked and verified!
            </div>
          )}

          {deliveries && deliveries.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery Address</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((item) => (
                  <TableRow key={item.orderId}>
                    <TableCell className="font-medium">
                      #{item.orderId}
                    </TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>{item.deliveryAddress}</TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PRIORITY 3: The Prep (Defrosting Roster) */}
      <Card className="border-t-4 border-t-blue-500">
        <CardHeader>
          <CardTitle className="text-blue-700 flex justify-between items-center">
            Night Shift: Tonight's Defrost Roster
            {defrost && defrost.length > 0 && (
              <Badge className="bg-blue-500">{defrost.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {defrostLoading && <DashboardSkeleton />}
          {defrostError && (
            <p className="text-red-500">Failed to load defrost roster.</p>
          )}

          {defrost?.length === 0 && (
            <div className="text-center py-6 text-green-600 font-medium">
              ❄️ Freezers can stay closed. No items need defrosting tonight.
            </div>
          )}

          {defrost && defrost.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Weight Class</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Start Tahi (Prep) By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defrost.map((item) => (
                  <TableRow key={item.orderItemId}>
                    <TableCell className="font-medium">
                      Item #{item.orderItemId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.weightCategory}</Badge>
                    </TableCell>
                    <TableCell>{item.quantity}x</TableCell>
                    <TableCell className="font-semibold text-blue-600">
                      {new Date(item.tahiStartTime).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
