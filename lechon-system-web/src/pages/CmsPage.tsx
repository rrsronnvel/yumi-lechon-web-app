import React, { useState } from "react";
import {
  useMenuCategories,
  useUpdatePrice,
  useCreateCategory,
  useToggleActive,
  useUpdateClocks,
  ItemCategory,
} from "@/hooks/useCms";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CmsPage() {
  const { data: categories, isLoading } = useMenuCategories();
  // Split the data using the Minimum Weight rule!
  const mainItems = categories?.filter((cat) => cat.minimumWeightKg > 0) || [];
  const addOns = categories?.filter((cat) => cat.minimumWeightKg === 0) || [];

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

  const createCategoryMutation = useCreateCategory();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- WIZARD STATE ---
  // Step 1: Choose type, Step 2: Fill details
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [itemType, setItemType] = useState<"roast" | "addon" | null>(null);

  // State for the new item form
  const [newItem, setNewItem] = useState({
    name: "",
    minimumWeightKg: 0,
    maximumWeightKg: 0,
    basePrice: 0,
    minimumSafetyStock: 0,
  });

  // Helper to reset everything when the modal closes
  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setTimeout(() => {
        setWizardStep(1);
        setItemType(null);
        setNewItem({
          name: "",
          minimumWeightKg: 0,
          maximumWeightKg: 0,
          basePrice: 0,
          minimumSafetyStock: 0,
        });
      }, 200); // Small delay so it resets after the animation finishes
    }
  };

  const handleCreateSubmit = () => {
    // If it's an Add-On, we forcefully overwrite the weights to ensure the "Magic Zeroes" rule is applied.
    const finalPayload =
      itemType === "addon"
        ? {
            ...newItem,
            minimumWeightKg: 0,
            maximumWeightKg: 0,
            minimumSafetyStock: 0,
          }
        : newItem;

    createCategoryMutation.mutate(finalPayload, {
      onSuccess: () => {
        handleDialogClose(false);
      },
    });
  };

  const toggleMutation = useToggleActive();

  // Setup for the Kitchen Clocks Modal
  const updateClocksMutation = useUpdateClocks();
  const [isClockDialogOpen, setIsClockDialogOpen] = useState(false);
  const [selectedClockCategory, setSelectedClockCategory] = useState<
    number | null
  >(null);
  const [clockForm, setClockForm] = useState({ tahi: 60, salang: 180 }); // Default fallback times

  // 1. Change the parameter to accept the WHOLE category object, not just the ID number
  const openClockModal = (cat: ItemCategory) => {
    setSelectedClockCategory(cat.id);

    // 2. Inject the real database times into the form!
    setClockForm({
      tahi: cat.tahiDurationMinutes || 60,
      salang: cat.salangDurationMinutes || 180,
    });

    setIsClockDialogOpen(true);
  };

  const handleClockSubmit = () => {
    if (selectedClockCategory) {
      updateClocksMutation.mutate(
        {
          categoryId: selectedClockCategory,
          tahi: clockForm.tahi,
          salang: clockForm.salang,
        },
        { onSuccess: () => setIsClockDialogOpen(false) }, // Close modal when done
      );
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Menu Settings (CMS)
          </h1>
          <p className="text-muted-foreground mt-2">
            Update your Base Prices here. Changes will automatically trigger a
            dashboard audit for advance bookings.
          </p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)}>+ Add New Item</Button>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {wizardStep === 1
                  ? "Select Item Type"
                  : itemType === "roast"
                    ? "Create New Roast/Belly"
                    : "Create New Add-On"}
              </DialogTitle>
            </DialogHeader>

            {/* --- STEP 1: THE FORK IN THE ROAD --- */}
            {wizardStep === 1 && (
              <div className="grid grid-cols-2 gap-4 py-4">
                <Card
                  className="cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors"
                  onClick={() => {
                    setItemType("roast");
                    setWizardStep(2);
                  }}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                    <span className="text-4xl mb-2">🍖</span>
                    <span className="font-semibold">Roast or Belly</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Requires weights & scheduling
                    </span>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  onClick={() => {
                    setItemType("addon");
                    setWizardStep(2);
                  }}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                    <span className="text-4xl mb-2">🍲</span>
                    <span className="font-semibold">Add-On / Extra</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Simple sides or sauces
                    </span>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* --- STEP 2: CONDITIONAL INPUTS --- */}
            {wizardStep === 2 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    placeholder={
                      itemType === "roast"
                        ? "e.g., Jumbo Whole"
                        : "e.g., Spicy Sarsa"
                    }
                  />
                </div>

                {/* Only show weights if it's a Roast! */}
                {itemType === "roast" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Min Weight (kg)
                      </label>
                      <Input
                        type="number"
                        value={newItem.minimumWeightKg || ""}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            minimumWeightKg: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Max Weight (kg)
                      </label>
                      <Input
                        type="number"
                        value={newItem.maximumWeightKg || ""}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            maximumWeightKg: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Base Price (₱)
                    </label>
                    <Input
                      type="number"
                      value={newItem.basePrice || ""}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          basePrice: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* Only show safety stock if it's a Roast! */}
                  {itemType === "roast" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Safety Stock Alert
                      </label>
                      <Input
                        type="number"
                        value={newItem.minimumSafetyStock || ""}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            minimumSafetyStock: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setWizardStep(1)}
                  >
                    Back
                  </Button>

                  <Button
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleCreateSubmit}
                    disabled={
                      createCategoryMutation.isPending ||
                      !newItem.name ||
                      !newItem.basePrice
                    }
                  >
                    {createCategoryMutation.isPending
                      ? "Saving..."
                      : "Save Item"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {/* CARD 1: MAIN MENU */}
      <Card>
        <CardHeader>
          <CardTitle>Main Menu (Roasts & Bellies)</CardTitle>
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
                  <TableHead className="text-right">Visibility</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mainItems.map((cat) => (
                  <TableRow
                    key={cat.id}
                    className={cat.isActive ? "" : "opacity-50 bg-slate-50"}
                  >
                    <TableCell className="font-semibold">
                      {cat.name} {cat.isActive ? "" : "(Hidden)"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      ₱{cat.basePrice.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-32 h-8"
                        placeholder={cat.basePrice.toString()}
                        value={editPrices[cat.id] || ""}
                        onChange={(e) =>
                          handlePriceChange(cat.id, e.target.value)
                        }
                        disabled={!cat.isActive}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={cat.isActive ? "destructive" : "secondary"}
                        size="sm"
                        onClick={() => toggleMutation.mutate(cat.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {cat.isActive ? "Hide from POS" : "Restore Item"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        disabled={
                          !editPrices[cat.id] ||
                          editPrices[cat.id] === cat.basePrice ||
                          updatePriceMutation.isPending ||
                          !cat.isActive
                        }
                        onClick={() => handleSave(cat.id)}
                      >
                        Update Price
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openClockModal(cat)}
                        disabled={!cat.isActive}
                      >
                        ⚙️ Clocks
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CARD 2: ADD-ONS */}
      <Card>
        <CardHeader>
          <CardTitle>Add-Ons & Extras</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>New Price (₱)</TableHead>
                <TableHead className="text-right">Visibility</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addOns.map((cat) => (
                <TableRow
                  key={cat.id}
                  className={cat.isActive ? "" : "opacity-50 bg-slate-50"}
                >
                  <TableCell className="font-semibold">{cat.name}</TableCell>
                  <TableCell className="text-slate-600">
                    ₱{cat.basePrice.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-32 h-8"
                      placeholder={cat.basePrice.toString()}
                      value={editPrices[cat.id] || ""}
                      onChange={(e) =>
                        handlePriceChange(cat.id, e.target.value)
                      }
                      disabled={!cat.isActive}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={cat.isActive ? "destructive" : "secondary"}
                      size="sm"
                      onClick={() => toggleMutation.mutate(cat.id)}
                      disabled={toggleMutation.isPending}
                    >
                      {cat.isActive ? "Hide" : "Restore"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={
                        !editPrices[cat.id] ||
                        editPrices[cat.id] === cat.basePrice ||
                        updatePriceMutation.isPending ||
                        !cat.isActive
                      }
                      onClick={() => handleSave(cat.id)}
                    >
                      Update Price
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KITCHEN CLOCK MODAL */}
      <Dialog open={isClockDialogOpen} onOpenChange={setIsClockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Kitchen Timers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Warning: Changing these times will instantly recalculate the prep
              schedule for all active advance orders using this size.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Tahi (Prep) Duration - Minutes
              </label>
              <Input
                type="number"
                value={clockForm.tahi}
                onChange={(e) =>
                  setClockForm({
                    ...clockForm,
                    tahi: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Salang (Roasting) Duration - Minutes
              </label>
              <Input
                type="number"
                value={clockForm.salang}
                onChange={(e) =>
                  setClockForm({
                    ...clockForm,
                    salang: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <Button
              className="w-full"
              onClick={handleClockSubmit}
              disabled={updateClocksMutation.isPending}
            >
              {updateClocksMutation.isPending
                ? "Recalculating Schedules..."
                : "Save & Force Recalculation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
