import React from 'react';
import { useRoastingRoster } from "@/hooks/useSchedules";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// 1. Bulletproof Time Formatter (Copied perfectly from your Kitchen Tab)
const formatTime = (timeString?: string) => {
  if (!timeString) return "-";
  
  try {
    if (timeString.length <= 8 && timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      const hourNum = parseInt(hours, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const formattedHour = hourNum % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    }

    const dateObj = new Date(timeString);
    if (isNaN(dateObj.getTime())) return "Invalid";

    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "Error";
  }
};

// Formatting helper for Philippine Peso
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
};

export function RiderViewTab() {
  const { data: scheduleItems, isLoading, isError } = useRoastingRoster();

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading logistics schedule...</div>;
  if (isError) return <div className="p-6 text-center text-red-500">Failed to load schedule.</div>;
  if (!scheduleItems || scheduleItems.length === 0) return <div className="p-6 text-center text-muted-foreground">No deliveries scheduled for today.</div>;

  // 2. Sort chronologically by Delivery Time for the Riders
  const sortedByDelivery = [...scheduleItems].sort((a, b) => {
    return new Date(a.targetDeliveryTime).getTime() - new Date(b.targetDeliveryTime).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Exact UI Container from Kitchen Tab */}
      <div className="rounded-md border-2 border-black overflow-x-auto">
        <Table className="min-w-[1000px]"> {/* Slightly wider to fit financial columns comfortably */}
          <TableHeader className="bg-black">
            <TableRow>
              {/* High Contrast Headers matching the Kitchen */}
              <TableHead className="text-white font-bold whitespace-nowrap text-center">No.</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Size</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-center">Weight (KG)</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Delivery Time</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Customer Name</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Location</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Rider Name</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Remarks</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-right">Price</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-right">Add-ons</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-right">Delivery Fee</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-right">Lechon Fee</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap text-right bg-slate-900">Amount to Collect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedByDelivery.map((item, /*index*/) => {
              // 3. Bulletproof Math: Force everything to be a Number, fallback to 0 if null/undefined
              const price = Number(item.price) || 0;
              const addOns = Number(item.addOns) || 0;
              const deliveryFee = Number(item.deliveryFee) || 0;
              
              // If the DB hasn't calculated lechonFee yet, fallback to price + addOns
              const lechonFee = item.lechonFee !== undefined && item.lechonFee !== null 
                ? Number(item.lechonFee) 
                : (price + addOns); 
              
              // Safe final calculation
              const amountToCollect = lechonFee + deliveryFee;

              return (
                <TableRow key={item.id} className="even:bg-gray-50 border-b border-gray-200 text-xs">
                  <TableCell className="font-bold text-center">{item.orderId || item.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{item.size || "-"}</TableCell>
                  <TableCell className="text-center">{item.weight || "-"}</TableCell>
                  <TableCell className="font-bold text-red-600 whitespace-nowrap">
                    {formatTime(item.targetDeliveryTime)}
                  </TableCell>
                  <TableCell className="font-bold whitespace-nowrap">{item.customerName || "-"}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={item.location}>{item.location || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold text-blue-700">{item.riderName || "Unassigned"}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={item.remarks}>{item.remarks || "-"}</TableCell>
                  
                  {/* Financial Columns */}
                  <TableCell className="text-right text-muted-foreground">{formatPHP(price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatPHP(addOns)}</TableCell>
                  <TableCell className="text-right font-semibold text-orange-600">{formatPHP(deliveryFee)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPHP(lechonFee)}</TableCell>
                  
                  {/* The Final Amount */}
                  <TableCell className="text-right font-bold text-sm text-green-700 bg-green-50/50">
                    {formatPHP(amountToCollect)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default RiderViewTab;