import { useState } from "react";
import { useUnassignedOrders, useAssignRider } from "../hooks/useLogistics";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react"; // Grab an icon!

// 1. Expanded the data blueprint to require an address field
interface UnassignedOrder {
  id: number;
  customerName: string;
  deliveryAddress: string; // Added field
  targetDeliveryTime: string;
}

export default function LogisticsPage() {
  const { data: unassignedOrders, isLoading, isError } = useUnassignedOrders();
  const assignRiderMutation = useAssignRider();

  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [riderName, setRiderName] = useState("");
  const [vehicleType, setVehicleType] = useState("Motorcycle"); // Core state variable
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const handleDispatch = () => {
    assignRiderMutation.mutate(
      {
        orderIds: selectedOrderIds,
        riderName: riderName,
        vehicleType: vehicleType,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setSelectedOrderIds([]);
          setRiderName("");
          setVehicleType("Motorcycle"); // Reset back to default
        },
      },
    );
  };

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading unassigned lechons...
      </div>
    );
  if (isError)
    return (
      <div className="p-8 text-center text-red-500">
        Error connecting to dispatch engine.
      </div>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Logistics & Dispatch
          </h1>
          <p className="text-gray-500">
            Select packaged lechons, group by route, and assign riders.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            disabled={selectedOrderIds.length === 0}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 cursor-pointer shadow-sm"
          >
            Dispatch Selected ({selectedOrderIds.length})
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Delivery Rider</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div>
                <Label>Rider Name</Label>
                <Input
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  placeholder="e.g., Kuya Jun"
                />
              </div>
              <div>
                <Label>Vehicle Type</Label>
                {/* 2. Typo fixed: Now correctly calling setVehicleType */}
                <Input
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="e.g., Motorcycle w/ Carrier"
                />
              </div>
              <Button
                onClick={handleDispatch}
                disabled={assignRiderMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {assignRiderMutation.isPending
                  ? "Processing Dispatch..."
                  : "Confirm & Send Text Alert"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Button
        onClick={() => window.open("/daily-sheets", "_blank")}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Printer className="mr-2 h-4 w-4" />
        Generate Daily Sheets
      </Button>

      {unassignedOrders?.length === 0 ? (
        <div className="p-12 border-2 border-dashed rounded-lg text-center text-gray-500">
          🎉 All clear! No orders waiting for dispatch right now.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4 w-12"></th>
                <th className="p-4 font-semibold">Order ID</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Delivery Address</th>{" "}
                {/* New header */}
                <th className="p-4 font-semibold">Target Delivery Time</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-600">
              {unassignedOrders?.map((order: UnassignedOrder) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onCheckedChange={() => handleSelectOrder(order.id)}
                    />
                  </td>
                  <td className="p-4 font-mono font-medium text-gray-900">
                    #{order.id}
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    {order.customerName}
                  </td>
                  <td className="p-4">{order.deliveryAddress}</td>{" "}
                  {/* New cell */}
                  <td className="p-4 font-medium text-blue-600">
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
    </div>
  );
}
