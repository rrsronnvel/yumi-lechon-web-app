import { useRoastingRoster } from "@/hooks/useSchedules";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Bulletproof Time Formatter
const formatTime = (timeString?: string) => {
  if (!timeString) return "-";
  
  try {
    // If it's already just a time string from C# (e.g., "14:30:00")
    if (timeString.length <= 8 && timeString.includes(':')) {
      // We can just format the raw string
      const [hours, minutes] = timeString.split(':');
      const hourNum = parseInt(hours, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const formattedHour = hourNum % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    }

    // Otherwise, treat it as a standard ISO Date
    const dateObj = new Date(timeString);
    if (isNaN(dateObj.getTime())) return "Invalid"; // Prevent "Invalid Date" text

    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "Error";
  }
};

export function KitchenViewTab() {
  const { data: scheduleItems, isLoading, isError } = useRoastingRoster();

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading roasting schedule...</div>;
  if (isError) return <div className="p-6 text-center text-red-500">Failed to load schedule.</div>;
  if (!scheduleItems || scheduleItems.length === 0) return <div className="p-6 text-center text-muted-foreground">No orders scheduled for today.</div>;

  return (
    <div className="space-y-4">
      {/* The overflow-x-auto container is the secret to mobile screenshots. 
        It allows the table to scroll horizontally on small screens instead of crushing the columns together.
      */}
      <div className="rounded-md border-2 border-black overflow-x-auto">
        <Table className="min-w-[800px]"> {/* Forces a minimum width so it stays readable */}
          <TableHeader className="bg-black">
            <TableRow>
              {/* High Contrast Headers for the Kitchen */}
              <TableHead className="text-white font-bold whitespace-nowrap">No.</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Tahi</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Salang</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Priority</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Size</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Weight (KG)</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Delivery Time</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Customer Name</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Packaging Time</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Remarks</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Location</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Add-ons</TableHead>
              <TableHead className="text-white font-bold whitespace-nowrap">Rider Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduleItems.map((item, index) => (
              <TableRow key={item.id} className="even:bg-gray-50 border-b border-gray-200 text-xs">
                <TableCell className="font-medium">{item.id}</TableCell>
                <TableCell className="font-bold text-red-600 whitespace-nowrap">{formatTime(item.tahiStartTime)}</TableCell>
                <TableCell className="font-bold whitespace-nowrap">{formatTime(item.salangStartTime)}</TableCell>
                {/* Priority is automatically calculated by the chronological sort! */}
                <TableCell className="font-bold text-center">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">{item.size || "-"}</TableCell>
                <TableCell>{item.weight || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatTime(item.targetDeliveryTime)}</TableCell>
                <TableCell className="font-bold whitespace-nowrap">{item.customerName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatTime(item.packagingStartTime)}</TableCell>
                <TableCell className="max-w-[150px] truncate">{item.remarks || "-"}</TableCell>
                <TableCell className="max-w-[150px] truncate">{item.location || "-"}</TableCell>
                <TableCell>{item.addOns || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{item.riderName || "Unassigned"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}