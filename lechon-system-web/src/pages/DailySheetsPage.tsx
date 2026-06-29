import React from 'react';
import PrintLayout from '../layouts/PrintLayout'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KitchenViewTab } from "@/layouts/KitchenViewTab";

export default function DailySheetsPage() {
  return (
    <PrintLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Daily Dispatch Planner</h1>
        <p className="text-sm text-gray-500">Internal Screenshot View</p>
      </div>

      <Tabs defaultValue="kitchen" className="w-full">
        {/* The Tab Buttons */}
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="kitchen">Kitchen View</TabsTrigger>
          <TabsTrigger value="rider">Rider View</TabsTrigger>
        </TabsList>

        {/* Tab 1: Kitchen (Time/Priority focused, NO MONEY) */}
        <TabsContent value="kitchen">
          <div className="p-4 border-2 border-dashed border-gray-200 text-center text-gray-500">
            <KitchenViewTab />
          </div>
        </TabsContent>

        {/* Tab 2: Rider (Logistics focused, SHOWS EXACT CASH SPLITS) */}
        <TabsContent value="rider">
          <div className="p-4 border-2 border-dashed border-gray-200 text-center text-gray-500">
            Rider Data Table Scaffold goes here...
          </div>
        </TabsContent>
      </Tabs>
    </PrintLayout>
  );
}