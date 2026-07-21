import React, { useState } from "react";
import { useMenuCategories, useUpdatePrice } from "@/hooks/useCms";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CmsPage() {
  const { data: categories, isLoading } = useMenuCategories();
  const updatePriceMutation = useUpdatePrice();

  // Local state to hold the numbers while the user types, before they hit save
  const [editPrices, setEditPrices] = useState<{ [key: number]: number }>({});

  const handlePriceChange = (id: number, val: string) => {
    setEditPrices((prev) => ({ ...prev, [id]: parseFloat(val) || 0 }));
  };

  const handleSave = (categoryId: number) => {
    const newPrice = editPrices[categoryId];
    if (!newPrice) return;

    updatePriceMutation.mutate({ categoryId, newPrice });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu Settings (CMS)</h1>
        <p className="text-muted-foreground mt-2">
          Update your Base Prices here. Changes will automatically trigger a dashboard audit for advance bookings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Menu Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500 animate-pulse">Loading menu...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>New Price (₱)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-semibold">{cat.name}</TableCell>
                    <TableCell className="text-slate-600">₱{cat.basePrice.toLocaleString()}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-32 h-8"
                        placeholder={cat.basePrice.toString()}
                        value={editPrices[cat.id] || ""}
                        onChange={(e) => handlePriceChange(cat.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={!editPrices[cat.id] || editPrices[cat.id] === cat.basePrice || updatePriceMutation.isPending}
                        onClick={() => handleSave(cat.id)}
                      >
                        {updatePriceMutation.isPending ? "Saving..." : "Update Price"}
                      </Button>
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