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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios"; // or your apiClient if you use one
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // The engine that fires our new C# cancellation endpoint
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Pointing directly to the new OrdersController endpoint we just built
      const response = await axios.patch(
        `http://localhost:5199/api/orders/${orderId}/cancel`,
      );
      return response.data;
    },
    onSuccess: () => {
      // 1. Wipe the old dashboard data so the cancelled order disappears
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "pending-confirmations"],
      });
      // 2. Wipe the inventory cache so the freed-up pig instantly appears available
      queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] });
    },
  });

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
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((item) => (
                  <TableRow key={item.id}>
                    {/* 2. Change the displayed text */}
                    <TableCell className="font-medium">#{item.id}</TableCell>

                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                      {new Date(item.targetDeliveryTime).toLocaleString()}
                    </TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ₱{(item?.totalAmount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700">
                          Cancel
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently void Order #{item.id} and
                              instantly release their locked lechon back to the
                              available inventory pool. This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() =>
                                cancelOrderMutation.mutate(item.id)
                              }
                            >
                              Yes, cancel this order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                  // 1. Change the key here
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {/* 2. Change the displayed text here */}#{item.id}
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
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      Item #{item.id}
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
