import { useState, useMemo } from "react";
import {
  useMenuCategories,
  useCreateCategory,
  useToggleCategoryStatus,
  useUpdateClocks,
  ItemCategory,
} from "@/hooks/useCms";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PriceHistorySheet } from "@/components/cms/PriceHistorySheet";
import { ChangePriceModal } from "@/components/cms/ChangePriceModal";
import { EditCategoryModal } from "@/components/cms/EditCategoryModal";
import {
  Plus,
  History,
  Edit,
  Clock,
  Search,
  Layers,
  UtensilsCrossed,
  ShieldCheck,
} from "lucide-react";

type FilterStatus = "all" | "active" | "hidden";

export default function CmsPage() {
  const { data: categories = [], isLoading } = useMenuCategories();
  const toggleStatusMutation = useToggleCategoryStatus();
  const createCategoryMutation = useCreateCategory();
  const updateClocksMutation = useUpdateClocks();

  // Search & Segmented Filter State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Drawer Selection State
  const [priceModalCategory, setPriceModalCategory] = useState<ItemCategory | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  const [historySheetCategory, setHistorySheetCategory] = useState<ItemCategory | null>(null);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);

  const [editCategory, setEditCategory] = useState<ItemCategory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Kitchen Clocks Modal State
  const [isClockDialogOpen, setIsClockDialogOpen] = useState(false);
  const [selectedClockCategory, setSelectedClockCategory] = useState<number | null>(null);
  const [clockForm, setClockForm] = useState({ tahi: 60, salang: 180 });

  // Add Item Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [itemType, setItemType] = useState<"roast" | "addon" | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    minimumWeightKg: 0,
    maximumWeightKg: 0,
    basePrice: 0,
    minimumSafetyStock: 0,
  });

  // Filter & Search Logic
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // 1. Status Filter
      if (filterStatus === "active" && !cat.isActive) return false;
      if (filterStatus === "hidden" && cat.isActive) return false;

      // 2. Search Query Filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = cat.name.toLowerCase().includes(query);
        const matchesWeight = `${cat.minimumWeightKg} ${cat.maximumWeightKg}`.includes(query);
        return matchesName || matchesWeight;
      }

      return true;
    });
  }, [categories, filterStatus, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: categories.length,
      active: categories.filter((c) => c.isActive).length,
      hidden: categories.filter((c) => !c.isActive).length,
    };
  }, [categories]);

  // Handlers for Opening Modals
  const openPriceModal = (cat: ItemCategory) => {
    setPriceModalCategory(cat);
    setIsPriceModalOpen(true);
  };

  const openHistorySheet = (cat: ItemCategory) => {
    setHistorySheetCategory(cat);
    setIsHistorySheetOpen(true);
  };

  const openEditModal = (cat: ItemCategory) => {
    setEditCategory(cat);
    setIsEditModalOpen(true);
  };

  const openClockModal = (cat: ItemCategory) => {
    setSelectedClockCategory(cat.id);
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
        { onSuccess: () => setIsClockDialogOpen(false) }
      );
    }
  };

  const handleCreateDialogClose = (open: boolean) => {
    setIsCreateDialogOpen(open);
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
      }, 200);
    }
  };

  const handleCreateSubmit = () => {
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
        handleCreateDialogClose(false);
      },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Catalog Governance & Menu CMS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage catalogue base rates, weight brackets, safety stock buffers, and POS visibility.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Item
        </Button>
      </div>

      {/* Main Governance Card */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Menu Categories & Price Matrix</CardTitle>
              <CardDescription className="text-xs mt-1">
                Centralized registry with immutable audit logging and instant kitchen schedule sync.
              </CardDescription>
            </div>

            {/* Controls: Segmented Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Segmented Filter Pills */}
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "all"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Items ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("active")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "active"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Active Only ({counts.active})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("hidden")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "hidden"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hidden ({counts.hidden})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Filter items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 focus-visible:bg-white"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <div className="animate-spin w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-500">Loading catalog items...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium">No menu items match your criteria.</p>
              <p className="text-xs text-slate-400 mt-1">Try switching filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-[260px]">Item & Weight Bracket</TableHead>
                    <TableHead className="w-[200px]">Base Price</TableHead>
                    <TableHead className="w-[140px]">Safety Buffer</TableHead>
                    <TableHead className="w-[180px]">Kitchen Profile</TableHead>
                    <TableHead className="w-[150px]">POS Visibility</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((cat) => {
                    const isRoast = cat.minimumWeightKg > 0;

                    return (
                      <TableRow
                        key={cat.id}
                        className={cat.isActive ? "hover:bg-slate-50/50" : "bg-slate-50/60 opacity-70"}
                      >
                        {/* 1. Item & Weight Bracket */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {isRoast ? (
                                <span className="text-base">🍖</span>
                              ) : (
                                <span className="text-base">🍲</span>
                              )}
                              <span className="font-semibold text-slate-900">
                                {cat.name}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pl-5">
                              {isRoast ? (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-50">
                                  {cat.minimumWeightKg} – {cat.maximumWeightKg} kg
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                                  Non-Meat Add-On
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. Base Price & History */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              ₱{cat.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 text-slate-700 hover:text-orange-700 hover:border-orange-300"
                              onClick={() => openPriceModal(cat)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit Price
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-slate-500 hover:text-slate-900"
                              title="View Price Audit History"
                              onClick={() => openHistorySheet(cat)}
                            >
                              <History className="w-3.5 h-3.5 mr-1" />
                              History
                            </Button>
                          </div>
                        </TableCell>

                        {/* 3. Safety Buffer */}
                        <TableCell>
                          {isRoast ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{cat.minimumSafetyStock ?? 0}</span>
                              <span className="text-slate-500">heads</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Excluded</span>
                          )}
                        </TableCell>

                        {/* 4. Kitchen Profile */}
                        <TableCell>
                          {isRoast ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs py-0.5 px-2 bg-amber-50/50 border-amber-200 text-amber-900">
                                <Clock className="w-3 h-3 mr-1 text-amber-600" />
                                {cat.tahiDurationMinutes ?? 60}m / {cat.salangDurationMinutes ?? 180}m
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                                title="Adjust Kitchen Timers"
                                onClick={() => openClockModal(cat)}
                              >
                                ⚙️
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Instant / No Cook</span>
                          )}
                        </TableCell>

                        {/* 5. POS Visibility */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={cat.isActive}
                              onCheckedChange={() => toggleStatusMutation.mutate(cat.id)}
                              disabled={toggleStatusMutation.isPending}
                            />
                            {cat.isActive ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-medium py-0"
                              >
                                🟢 Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-500 border-slate-300 text-[11px] font-medium py-0"
                              >
                                ⚪ Hidden
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Actions */}
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2.5 text-slate-700 hover:bg-slate-100"
                            onClick={() => openEditModal(cat)}
                          >
                            <UtensilsCrossed className="w-3 h-3 mr-1 text-slate-500" />
                            Edit Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: Price History Drawer / Sheet */}
      <PriceHistorySheet
        category={historySheetCategory}
        open={isHistorySheetOpen}
        onOpenChange={setIsHistorySheetOpen}
      />

      {/* MODAL 2: Change Price Modal */}
      <ChangePriceModal
        category={priceModalCategory}
        open={isPriceModalOpen}
        onOpenChange={setIsPriceModalOpen}
      />

      {/* MODAL 3: Edit Category Metadata Modal */}
      <EditCategoryModal
        category={editCategory}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      />

      {/* MODAL 4: Kitchen Clock Recalibration Modal */}
      <Dialog open={isClockDialogOpen} onOpenChange={setIsClockDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Adjust Kitchen Timers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Warning: Modifying duration clocks will trigger backward-scheduling
              recalculation for all active advance orders using this size bracket.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Tahi (Prep) Duration — Minutes
              </label>
              <Input
                type="number"
                min="0"
                value={clockForm.tahi}
                onChange={(e) =>
                  setClockForm({
                    ...clockForm,
                    tahi: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Salang (Roasting) Duration — Minutes
              </label>
              <Input
                type="number"
                min="0"
                value={clockForm.salang}
                onChange={(e) =>
                  setClockForm({
                    ...clockForm,
                    salang: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white mt-2"
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

      {/* MODAL 5: Create Category Wizard Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogClose}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === 1
                ? "Select Item Type"
                : itemType === "roast"
                  ? "Create New Roast / Belly"
                  : "Create New Add-On"}
            </DialogTitle>
          </DialogHeader>

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
                  <span className="font-semibold text-sm">Roast or Belly</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Requires weights & kitchen timers
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
                  <span className="font-semibold text-sm">Add-On / Extra</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Simple sides or sauces (0 kg)
                  </span>
                </CardContent>
              </Card>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Item Name</label>
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

              {itemType === "roast" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Min Weight (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newItem.minimumWeightKg || ""}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          minimumWeightKg: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Max Weight (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newItem.maximumWeightKg || ""}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          maximumWeightKg: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Base Price (₱)
                  </label>
                  <Input
                    type="number"
                    step="50"
                    value={newItem.basePrice || ""}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        basePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                {itemType === "roast" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Safety Stock Buffer
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={newItem.minimumSafetyStock || ""}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          minimumSafetyStock: parseInt(e.target.value, 10) || 0,
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
                    !newItem.name.trim() ||
                    newItem.basePrice <= 0
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
  );
}
