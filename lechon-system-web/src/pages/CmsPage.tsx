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
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Catalog Governance & Menu CMS
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage catalogue base rates, weight brackets, safety stock buffers, and POS visibility.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shrink-0 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Item
        </Button>
      </div>

      {/* Main Governance Card */}
      <Card className="bg-white shadow-sm border-stone-200/90 rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-stone-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-stone-900">
                Menu Categories & Price Matrix
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 mt-1">
                Centralized registry with immutable audit logging and instant kitchen schedule sync.
              </CardDescription>
            </div>

            {/* Controls: Segmented Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Segmented Filter Pills */}
              <div className="inline-flex items-center p-1 bg-stone-100 rounded-lg border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "all"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  All Items ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("active")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "active"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Active Only ({counts.active})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("hidden")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filterStatus === "hidden"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Hidden ({counts.hidden})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <Input
                  placeholder="Filter items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-stone-50 border-stone-200 focus-visible:bg-white"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <div className="animate-spin w-6 h-6 border-2 border-[#C81E1E] border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-stone-500">Loading catalog items...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <Layers className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-sm font-medium">No menu items match your criteria.</p>
              <p className="text-xs text-stone-400 mt-1">Try switching filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                    <TableHead className="w-[260px] font-semibold text-stone-600">Item & Weight Bracket</TableHead>
                    <TableHead className="w-[200px] font-semibold text-stone-600">Base Price</TableHead>
                    <TableHead className="w-[140px] font-semibold text-stone-600">Safety Buffer</TableHead>
                    <TableHead className="w-[180px] font-semibold text-stone-600">Kitchen Profile</TableHead>
                    <TableHead className="w-[150px] font-semibold text-stone-600">POS Visibility</TableHead>
                    <TableHead className="text-right w-[150px] font-semibold text-stone-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-stone-200/70">
                  {filteredCategories.map((cat) => {
                    const isRoast = cat.minimumWeightKg > 0;

                    return (
                      <TableRow
                        key={cat.id}
                        className={cat.isActive ? "hover:bg-stone-50/70 transition-colors" : "bg-stone-50/60 opacity-70"}
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
                              <span className="font-semibold text-stone-900">
                                {cat.name}
                              </span>
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-1.5 pl-5">
                              {isRoast ? (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-stone-50 border-stone-200 text-stone-700 font-mono">
                                  {cat.minimumWeightKg} – {cat.maximumWeightKg} kg
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-50/60 text-amber-800 border-amber-200">
                                  Non-Meat Add-On
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. Base Price & History */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 text-sm font-mono">
                              ₱{cat.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 border-stone-300 text-stone-700 hover:text-[#C81E1E] hover:border-rose-300 hover:bg-rose-50/50"
                              onClick={() => openPriceModal(cat)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit Price
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-stone-500 hover:text-stone-900"
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
                            <div className="flex items-center gap-1.5 text-xs text-stone-700">
                              <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                              <span className="font-semibold font-mono">{cat.minimumSafetyStock ?? 0}</span>
                              <span className="text-stone-500">heads</span>
                            </div>
                          ) : (
                            <span className="text-xs text-stone-400 italic">Excluded</span>
                          )}
                        </TableCell>

                        {/* 4. Kitchen Profile */}
                        <TableCell>
                          {isRoast ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs py-0.5 px-2 bg-amber-50/60 border-amber-200 text-amber-900 font-mono">
                                <Clock className="w-3 h-3 mr-1 text-amber-600" />
                                {cat.tahiDurationMinutes ?? 60}m / {cat.salangDurationMinutes ?? 180}m
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-stone-400 hover:text-stone-700"
                                title="Adjust Kitchen Timers"
                                onClick={() => openClockModal(cat)}
                              >
                                ⚙️
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-stone-400 italic">Instant / No Cook</span>
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
                                className="bg-stone-100 text-stone-500 border-stone-300 text-[11px] font-medium py-0"
                              >
                                ⚪ Hidden
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Actions */}
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2.5 border-stone-300 text-stone-700 hover:bg-stone-100"
                            onClick={() => openEditModal(cat)}
                          >
                            <UtensilsCrossed className="w-3 h-3 mr-1 text-stone-500" />
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
        <DialogContent className="overflow-x-hidden sm:max-w-[420px] w-full p-6 rounded-xl border-stone-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">Adjust Kitchen Timers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-stone-500 leading-relaxed">
              Warning: Modifying duration clocks will trigger backward-scheduling
              recalculation for all active advance orders using this size bracket.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Tahi (Prep) Duration — Minutes
              </label>
              <Input
                type="number"
                min="0"
                className="h-10 border-stone-300 font-mono"
                value={clockForm.tahi}
                onChange={(e) =>
                  setClockForm({
                    ...clockForm,
                    tahi: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Salang (Roasting) Duration — Minutes
              </label>
              <Input
                type="number"
                min="0"
                className="h-10 border-stone-300 font-mono"
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
              className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors mt-2"
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
        <DialogContent className="overflow-x-hidden sm:max-w-[440px] w-full p-6 rounded-xl border-stone-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">
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
                className="cursor-pointer border-stone-200 hover:border-[#C81E1E] hover:bg-rose-50/40 transition-colors rounded-xl"
                onClick={() => {
                  setItemType("roast");
                  setWizardStep(2);
                }}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <span className="text-4xl mb-2">🍖</span>
                  <span className="font-semibold text-sm text-stone-900">Roast or Belly</span>
                  <span className="text-xs text-stone-500 mt-1">
                    Requires weights & kitchen timers
                  </span>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-stone-200 hover:border-amber-500 hover:bg-amber-50/50 transition-colors rounded-xl"
                onClick={() => {
                  setItemType("addon");
                  setWizardStep(2);
                }}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <span className="text-4xl mb-2">🍲</span>
                  <span className="font-semibold text-sm text-stone-900">Add-On / Extra</span>
                  <span className="text-xs text-stone-500 mt-1">
                    Simple sides or sauces (0 kg)
                  </span>
                </CardContent>
              </Card>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700">Item Name</label>
                <Input
                  className="h-10 border-stone-300"
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
                    <label className="text-xs font-semibold text-stone-700">
                      Min Weight (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 border-stone-300 font-mono"
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
                    <label className="text-xs font-semibold text-stone-700">
                      Max Weight (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 border-stone-300 font-mono"
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
                  <label className="text-xs font-semibold text-stone-700">
                    Base Price (₱)
                  </label>
                  <Input
                    type="number"
                    step="50"
                    className="h-10 border-stone-300 font-mono"
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
                    <label className="text-xs font-semibold text-stone-700">
                      Safety Stock Buffer
                    </label>
                    <Input
                      type="number"
                      step="1"
                      className="h-10 border-stone-300 font-mono"
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

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row border-t border-stone-200 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-10 border-stone-300 text-stone-700"
                  onClick={() => setWizardStep(1)}
                >
                  Back
                </Button>

                <Button
                  className="flex-1 h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
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
