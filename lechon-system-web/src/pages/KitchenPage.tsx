import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitchen } from "@/hooks/useKitchen";
import { toast } from "sonner";

export type ProductionStatus = 'Defrosting' | 'Prepping' | 'Roasting' | 'Packaged' | 'ReadyForDelivery';

export interface RosterItem {
  id: number;
  customerName: string;
  size: string;
  targetDeliveryTime: string;
  status: ProductionStatus;
}

const KITCHEN_COLUMNS: { label: string; status: ProductionStatus; color: string; next: ProductionStatus | null }[] = [
  { label: "1. Defrosting ❄️", status: "Defrosting", color: "bg-blue-50/50 border-blue-200 text-blue-700", next: "Prepping" },
  { label: "2. Prepping 🔪", status: "Prepping", color: "bg-amber-50/50 border-amber-200 text-amber-700", next: "Roasting" },
  { label: "3. Roasting 🔥", status: "Roasting", color: "bg-orange-50/50 border-orange- orange-200 text-orange-700", next: "Packaged" },
  { label: "4. Packaged 📦", status: "Packaged", color: "bg-green-50/50 border-green-200 text-green-700", next: "ReadyForDelivery" },
];

export default function KitchenPage() {
  const { useRosterQuery, useUpdateStatusMutation } = useKitchen();
  
  // Fire off the background fetch request
  const { data: rosterItems = [], isLoading, isError } = useRosterQuery();
  const updateStatusMutation = useUpdateStatusMutation();

  const handleAdvanceStatus = (id: number, currentStatus: ProductionStatus, nextStatus: ProductionStatus | null) => {
    if (!nextStatus) return;
    
    updateStatusMutation.mutate(
      { id, nextStatus },
      {
        onSuccess: () => {
          toast.success("Ticket advanced successfully!");
        },
        // 1. Change 'any' to 'unknown' to satisfy strict safety guidelines
        onError: (error: unknown) => {
          // 2. Safely tell the code to treat this as an object that might have network data inside
          const networkError = error as { response?: { data?: { message?: string } } };
          
          const errorMessage = networkError?.response?.data?.message || "Failed to update cooking station.";
          toast.error(errorMessage);
        }
      }
    );
  };

  // Gracefully handle network loading blocks
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-4 gap-4 h-[500px]">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-full h-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Gracefully handle backend downtime emergencies
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-2 p-6">
        <p className="text-sm font-medium text-red-500">Could not connect to the roasting service tracker.</p>
        <p className="text-xs text-muted-foreground">Make sure your local .NET Core web API service is running.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kitchen Kanban Board</h1>
        <p className="text-muted-foreground">Real-time status tracking for today's active roasting items.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 items-start">
        {KITCHEN_COLUMNS.map((column) => {
          const itemsInColumn = rosterItems.filter(item => item.status === column.status);

          return (
            <div key={column.status} className={`flex flex-col rounded-xl border p-4 min-h-[500px] ${column.color}`}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-inherit">
                <span className="font-bold text-sm tracking-wide uppercase">{column.label}</span>
                <Badge variant="secondary" className="font-mono">{itemsInColumn.length}</Badge>
              </div>

              <div className="flex flex-col space-y-3 overflow-y-auto">
                {itemsInColumn.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground italic py-8">No pigs at this station</p>
                ) : (
                  itemsInColumn.map((item) => (
                    <Card key={item.id} className="shadow-sm border-neutral-200/60 bg-white">
                      <CardHeader className="p-3 pb-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-neutral-400">#SCH-{item.id}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.targetDeliveryTime}
                          </Badge>
                        </div>
                        <CardTitle className="text-sm font-bold text-neutral-800 truncate mt-1">
                          {item.customerName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 flex flex-col space-y-3">
                        <p className="text-xs font-medium text-neutral-500">{item.size}</p>
                        
                        {/* Defensive Guard Condition Applied Directly into Button Rendering */}
                        <Button 
                          size="sm" 
                          disabled={updateStatusMutation.isPending || !column.next}
                          onClick={() => handleAdvanceStatus(item.id, item.status, column.next)}
                          className="w-full text-xs h-8 bg-neutral-900 hover:bg-neutral-800 text-white disabled:opacity-50"
                        >
                          {updateStatusMutation.isPending ? "Updating..." : column.next ? `Move to ${column.next} →` : "Complete ✅"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}