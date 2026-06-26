/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  useSalesAnalytics,
  useDeliveryPerformance,
  useWastageAnalytics,
} from "../hooks/useAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// 1. Helper function to format our Y-Axis into Philippine Peso (₱)
const formatPHP = (value: number) => `₱${value.toLocaleString()}`;

// 2. Custom color array for the Wastage Pie Chart
const WASTAGE_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#a3e635"];

export default function AnalyticsPage() {
  // 3. Execute all three data hooks simultaneously
  const { data: sales, isLoading: loadingSales } = useSalesAnalytics();
  const { data: delivery, isLoading: loadingDelivery } =
    useDeliveryPerformance();
  const { data: wastage, isLoading: loadingWastage } = useWastageAnalytics();

  const isLoading = loadingSales || loadingDelivery || loadingWastage;

  // 4. Handle the Loading State (Empty Skeleton Grid)
  if (isLoading) {
    return (
      <div className="p-6 space-y-6 w-full">
        <h1 className="text-3xl font-bold tracking-tight">
          Business Analytics
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] w-full rounded-xl md:col-span-2" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // 5. Render the fully loaded Dashboard
  return (
    <div className="p-6 space-y-6 w-full">
      <h1 className="text-3xl font-bold tracking-tight">Business Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ROW 1: Sales Revenue Line Chart (Spans both columns on desktop) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Sales Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={Array.isArray(sales) ? sales : []}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatPHP} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => formatPHP(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  name="Revenue (PHP)"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROW 2 - LEFT: Delivery Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Average Delivery Transit Times</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Array.isArray(delivery) ? delivery : []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  formatter={(val) => `${val} mins`}
                />
                <Legend />
                <Bar
                  dataKey="averageTransitTimeMinutes"
                  fill="#16a34a"
                  radius={[4, 4, 0, 0]}
                  name="Transit Time (Mins)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROW 2 - RIGHT: Inventory Wastage Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Wastage by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Array.isArray(wastage) ? wastage : []}
                  dataKey="weightLostKg"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  label={(entry: any) => `${entry.category}`}
                >
                  {(Array.isArray(wastage) ? wastage : []).map(
                    (entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={WASTAGE_COLORS[index % WASTAGE_COLORS.length]}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip formatter={(val) => `${val} kg`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
