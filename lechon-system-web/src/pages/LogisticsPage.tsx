import { useState } from "react";
import {
  useUnassignedOrders,
  useTodayOperations,
  useAssignRider,
  useConfirmDelivery,
  TodayDispatchOrder,
} from "../hooks/useLogistics";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, CalendarDays, Radio, CheckCircle2, UserCog, Truck } from "lucide-react";
import { toast } from "sonner";

interface UnassignedOrder {
  id: number;
  customerName: string;
  deliveryAddress: string;
  targetDeliveryTime: string;
}

export default function LogisticsPage() {
  // Tab A Data & Mutations
  const { data: todayOrders = [], isLoading: isLoadingToday } = useTodayOperations();
  const confirmDeliveryMutation = useConfirmDelivery();

  // Tab B Data & Mutations
  const { data: unassignedOrders = [], isLoading: isLoadingUnassigned, isError } = useUnassignedOrders();
  const assignRiderMutation = useAssignRider();

  // Tab B State (Batch Assign)
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [riderName, setRiderName] = useState("");
  const [vehicleType, setVehicleType] = useState("Motorcycle");
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // Tab A State (Emergency Reassign)
  const [reassignOrder, setReassignOrder] = useState<TodayDispatchOrder | null>(null);
  const [newRiderName, setNewRiderName] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("Motorcycle");
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleBatchDispatch = () => {
    assignRiderMutation.mutate(
      {
        orderIds: selectedOrderIds,
        riderName,
        vehicleType,
      },
      {
        onSuccess: () => {
          toast.success("Rider assigned successfully!");
          setIsBatchDialogOpen(false);
          setSelectedOrderIds([]);
          setRiderName("");
          setVehicleType("Motorcycle");
        },
        onError: () => {
          toast.error("Failed to assign rider. Please try again.");
        },
      }
    );
  };

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
      {/* Permanent Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Logistics Command Center
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Track today's active dispatches and bundle tomorrow's routes.
        </p>
      </div>

      {/* Segmented Dual-Tab Layout */}
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-auto p-1.5 gap-1.5 bg-stone-200/60 rounded-xl mb-6">
          <TabsTrigger
            value="today"
            className="flex items-center justify-center gap-2 py-1.5 px-4 text-sm font-medium rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
          >
            <Radio className="h-4 w-4 text-emerald-600" />
            Live Operations (Today)
          </TabsTrigger>
          <TabsTrigger
            value="tomorrow"
            className="flex items-center justify-center gap-2 py-1.5 px-4 text-sm font-medium rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
          >
            <CalendarDays className="h-4 w-4 text-[#C81E1E]" />
            Dispatch Planner (Tomorrow)
          </TabsTrigger>
        </TabsList>

        {/* ========================================= */}
        {/* TAB A: LIVE OPERATIONS (TODAY)            */}
        {/* ========================================= */}
        <TabsContent value="today" className="space-y-4">
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
                        <tr key={order.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="p-4 font-mono font-bold text-stone-900">#{order.id}</td>
                          <td className="p-4 font-medium text-stone-900">{order.customerName}</td>
                          <td className="p-4 max-w-xs truncate text-stone-600">{order.deliveryAddress || "Store Pickup"}</td>
                          <td className="p-4 font-semibold text-amber-800">
                            {new Date(order.targetDeliveryTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-4">
                            {order.riderName ? (
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
        </TabsContent>

        {/* ========================================= */}
        {/* TAB B: DISPATCH PLANNER (TOMORROW)        */}
        {/* ========================================= */}
        <TabsContent value="tomorrow" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button
              onClick={() => window.open("/daily-sheets", "_blank")}
              variant="outline"
              className="border-stone-300 text-stone-800 hover:bg-stone-100 h-10 font-medium shadow-xs"
            >
              <Printer className="mr-2 h-4 w-4 text-stone-600" />
              Generate Daily Sheets
            </Button>

            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
              <DialogTrigger
                disabled={selectedOrderIds.length === 0}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C81E1E] disabled:opacity-50 disabled:pointer-events-none bg-[#C81E1E] text-white hover:bg-[#A81818] h-10 px-4 py-2 cursor-pointer shadow-sm"
              >
                Dispatch Selected ({selectedOrderIds.length})
              </DialogTrigger>
              <DialogContent className="overflow-x-hidden max-w-md w-full p-6 rounded-xl border-stone-200">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-stone-900">Assign Delivery Rider</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-stone-700 font-semibold">Rider Name</Label>
                    <Input
                      className="h-10 border-stone-300"
                      value={riderName}
                      onChange={(e) => setRiderName(e.target.value)}
                      placeholder="e.g., Kuya Jun"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-stone-700 font-semibold">Vehicle Type</Label>
                    <Input
                      className="h-10 border-stone-300"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      placeholder="e.g., Motorcycle w/ Carrier"
                    />
                  </div>
                  <Button
                    onClick={handleBatchDispatch}
                    disabled={assignRiderMutation.isPending}
                    className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
                  >
                    {assignRiderMutation.isPending
                      ? "Processing Dispatch..."
                      : "Confirm & Assign Rider"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingUnassigned ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : unassignedOrders.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-stone-200 rounded-xl text-center text-stone-500 bg-white">
              🎉 All clear! No orders waiting for tomorrow's dispatch.
            </div>
          ) : (
            <div className="bg-white border border-stone-200/90 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-4 w-12"></th>
                    <th className="p-4 font-semibold">Order ID</th>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Delivery Address</th>
                    <th className="p-4 font-semibold">Target Delivery Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 text-stone-900">
                  {unassignedOrders.map((order: UnassignedOrder) => (
                    <tr key={order.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={() => handleSelectOrder(order.id)}
                        />
                      </td>
                      <td className="p-4 font-mono font-bold text-stone-900">#{order.id}</td>
                      <td className="p-4 font-medium text-stone-900">{order.customerName}</td>
                      <td className="p-4 text-stone-600">{order.deliveryAddress}</td>
                      <td className="p-4 font-semibold text-amber-800">
                        {new Date(order.targetDeliveryTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
            <div className="space-y-1.5">
              <Label className="text-stone-700 font-semibold">New Rider Name</Label>
              <Input
                className="h-10 border-stone-300"
                value={newRiderName}
                onChange={(e) => setNewRiderName(e.target.value)}
                placeholder="e.g., Kuya Berto"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-stone-700 font-semibold">Vehicle Type</Label>
              <Input
                className="h-10 border-stone-300"
                value={newVehicleType}
                onChange={(e) => setNewVehicleType(e.target.value)}
                placeholder="e.g., Backup Motorcycle"
              />
            </div>
            <Button
              onClick={handleEmergencyReassign}
              disabled={assignRiderMutation.isPending}
              className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
            >
              {assignRiderMutation.isPending ? "Reassigning..." : "Confirm Emergency Swap"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}