import { useState } from "react";
import {
  useTodayOperations,
  useAssignRider,
  useUnassignRider,
  useConfirmDelivery,
  TodayDispatchOrder,
} from "../hooks/useLogistics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, CheckCircle2, UserCog, Truck } from "lucide-react";
import { toast } from "sonner";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";

export default function LogisticsPage() {
  // Today's Operations Data & Mutations
  const { data: todayOrders = [], isLoading: isLoadingToday, isError } = useTodayOperations();
  const confirmDeliveryMutation = useConfirmDelivery();
  const assignRiderMutation = useAssignRider();
  const unassignRiderMutation = useUnassignRider();

  // Emergency Reassign State
  const [reassignOrder, setReassignOrder] = useState<TodayDispatchOrder | null>(null);
  const [newRiderName, setNewRiderName] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("Motorcycle");
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);

  const handleOpenEmergencyReassign = (order: TodayDispatchOrder) => {
    setReassignOrder(order);
    setNewRiderName(order.riderName || "");
    setNewVehicleType(order.vehicleType || "Motorcycle");
    setIsReassignDialogOpen(true);
  };

  const handleEmergencyReassign = () => {
    if (!reassignOrder) return;

    assignRiderMutation.mutate(
      {
        orderIds: [reassignOrder.id],
        riderName: newRiderName,
        vehicleType: newVehicleType,
      },
      {
        onSuccess: () => {
          toast.success(`Order #${reassignOrder.id} reassigned to ${newRiderName}`);
          setIsReassignDialogOpen(false);
          setReassignOrder(null);
        },
        onError: () => {
          toast.error("Failed to reassign rider.");
        },
      }
    );
  };

  const handleUnassignRider = () => {
    if (!reassignOrder) return;

    unassignRiderMutation.mutate(reassignOrder.id, {
      onSuccess: () => {
        toast.success(`Order #${reassignOrder.id} unassigned from rider.`);
        setIsReassignDialogOpen(false);
        setReassignOrder(null);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to unassign rider.");
      },
    });
  };

  const handleMarkDelivered = (orderId: number) => {
    confirmDeliveryMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success(`Order #${orderId} marked as delivered!`);
      },
      onError: () => {
        toast.error("Could not confirm delivery.");
      },
    });
  };

  if (isError) {
    return (
      <div className="p-8 text-center text-rose-600 font-medium">
        Error connecting to dispatch engine.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
      {/* Permanent Header with Direct Daily Sheets Launcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Logistics Command Center
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Live operations: monitor today's active dispatches, execute emergency rider swaps, and confirm deliveries.
          </p>
        </div>
        <Button
          onClick={() => window.open("/daily-sheets", "_blank")}
          className="bg-stone-900 hover:bg-stone-800 text-white font-medium shadow-xs"
        >
          <Printer className="mr-2 h-4 w-4" />
          Open Daily Dispatch Planner ➔
        </Button>
      </div>

      {/* Dedicated Single-View: Live Operations (Today) */}
      <Card className="bg-white border-stone-200/90 shadow-sm rounded-xl">
        <CardHeader className="pb-3 border-b border-stone-100">
          <CardTitle className="text-stone-900">Active Dispatches</CardTitle>
          <CardDescription className="text-stone-500">
            Live monitoring for today's orders. Update delivery status or reassign riders during breakdowns.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingToday ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : todayOrders.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-stone-200 rounded-xl text-center text-stone-500 bg-stone-50/40">
              🛵 No active delivery dispatches found for today.
            </div>
          ) : (
            <div className="bg-white border border-stone-200/90 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-4 font-semibold">Order ID</th>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Destination Address</th>
                    <th className="p-4 font-semibold">Target Time</th>
                    <th className="p-4 font-semibold">Assigned Rider</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 text-stone-900">
                  {todayOrders.map((order) => (
                    <tr key={order.id} className={`${isWalkInOrder(order) ? "bg-indigo-50/40" : ""} hover:bg-stone-50/80 transition-colors`}>
                      <td className="p-4 font-mono font-bold text-stone-900">#{order.id}</td>
                      <td className="p-4 font-medium text-stone-900">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{order.customerName}</span>
                          <WalkInBadge {...order} />
                        </div>
                      </td>
                      <td className="p-4 max-w-xs truncate text-stone-600">{order.deliveryAddress || "Store Pickup"}</td>
                      <td className="p-4 font-semibold text-amber-800">
                        {new Date(order.targetDeliveryTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4">
                        {order.fulfillment === 0 ? (
                          <Badge variant="outline" className="text-stone-600 bg-stone-100 border-stone-300 font-medium text-xs">
                            🏪 Store Pickup
                          </Badge>
                        ) : order.fulfillment === 2 ? (
                          <Badge variant="outline" className="text-stone-600 bg-stone-100 border-stone-300 font-medium text-xs">
                            📦 Lalamove Courier
                          </Badge>
                        ) : order.riderName ? (
                          <div className="flex items-center gap-1.5 font-medium text-stone-800">
                            <Truck className="h-4 w-4 text-emerald-600" />
                            {order.riderName}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300">
                            Unassigned
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {order.isDeliveryDetailsConfirmed ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Delivered</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-stone-100 text-stone-700 border-stone-200">In Transit</Badge>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-stone-300 text-stone-700 hover:bg-stone-100"
                          onClick={() => handleOpenEmergencyReassign(order)}
                        >
                          <UserCog className="h-4 w-4 mr-1" />
                          Edit Rider
                        </Button>
                        <Button
                          size="sm"
                          disabled={order.isDeliveryDetailsConfirmed || confirmDeliveryMutation.isPending}
                          onClick={() => handleMarkDelivered(order.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Delivered
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Reassign Modal */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="overflow-x-hidden max-w-md w-full p-6 rounded-xl border-stone-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">
              Emergency Rider Swap (Order #{reassignOrder?.id})
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-stone-500">
              Reassign this transit order immediately due to vehicle breakdown or delay.
            </p>

            {reassignOrder?.fulfillment === 0 && (
              <div className="p-2.5 rounded-md bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
                🏪 Store Pickup Order — Freelance rider assignment is not applicable. Click [Unassign Rider] below to clear any trip attachment.
              </div>
            )}
            {reassignOrder?.fulfillment === 2 && (
              <div className="p-2.5 rounded-md bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
                📦 Lalamove Courier Order — Customer arranged transport. Click [Unassign Rider] below to clear any trip attachment.
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-stone-700 font-semibold">New Rider Name</Label>
              <Input
                className="h-10 border-stone-300"
                value={newRiderName}
                onChange={(e) => setNewRiderName(e.target.value)}
                placeholder="e.g., Kuya Berto"
                disabled={reassignOrder?.fulfillment !== undefined && reassignOrder.fulfillment !== 1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-stone-700 font-semibold">Vehicle Type</Label>
              <Input
                className="h-10 border-stone-300"
                value={newVehicleType}
                onChange={(e) => setNewVehicleType(e.target.value)}
                placeholder="e.g., Backup Motorcycle"
                disabled={reassignOrder?.fulfillment !== undefined && reassignOrder.fulfillment !== 1}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleUnassignRider}
                disabled={unassignRiderMutation.isPending || !reassignOrder?.riderName}
                className="w-1/2 h-10 border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold"
              >
                {unassignRiderMutation.isPending ? "Unassigning..." : "Unassign Rider"}
              </Button>
              <Button
                onClick={handleEmergencyReassign}
                disabled={
                  assignRiderMutation.isPending ||
                  !newRiderName.trim() ||
                  (reassignOrder?.fulfillment !== undefined && reassignOrder.fulfillment !== 1)
                }
                className="w-1/2 h-10 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
              >
                {assignRiderMutation.isPending ? "Reassigning..." : "Confirm Swap"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
