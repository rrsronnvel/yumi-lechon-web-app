import { useState, useMemo, useEffect } from "react";
import {
  useMenuCategories,
  useCreateCategory,
  useToggleCategoryStatus,
  useUpdateClocks,
  useDeliveryPricing,
  useUpdateDeliveryPricing,
  ItemCategory,
} from "@/hooks/useCms";
import { useAuth } from "@/context/AuthContext";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PriceHistorySheet } from "@/components/cms/PriceHistorySheet";
import { ChangePriceModal } from "@/components/cms/ChangePriceModal";
import { EditCategoryModal } from "@/components/cms/EditCategoryModal";
import { CreateUserModal } from "@/components/cms/CreateUserModal";
import { ResetPasswordModal } from "@/components/cms/ResetPasswordModal";
import {
  useUsersQuery,
  useToggleUserStatusMutation,
  UserListItemDto,
} from "@/hooks/useUsers";
import {
  Plus,
  History,
  Edit,
  Clock,
  Search,
  Layers,
  UtensilsCrossed,
  ShieldCheck,
  Truck,
  Lock,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  Calculator,
  Save,
} from "lucide-react";

type FilterStatus = "all" | "active" | "hidden";

export default function CmsPage() {
  const { isOwner, user: currentUser } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<"catalog" | "staff">("catalog");
  const { data: users = [], isLoading: isLoadingUsers } = useUsersQuery();
  const toggleUserStatusMutation = useToggleUserStatusMutation();
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [selectedResetUser, setSelectedResetUser] = useState<UserListItemDto | null>(null);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [statusConfirmUser, setStatusConfirmUser] = useState<{
    user: UserListItemDto;
    targetActive: boolean;
  } | null>(null);

  const { data: categories = [], isLoading } = useMenuCategories();
  const { data: deliveryPricing } = useDeliveryPricing();
  const updateDeliveryPricingMutation = useUpdateDeliveryPricing();
  const toggleStatusMutation = useToggleCategoryStatus();
  const createCategoryMutation = useCreateCategory();
  const updateClocksMutation = useUpdateClocks();

  // Delivery Pricing Form State
  const [baseFareInput, setBaseFareInput] = useState<string>("100");
  const [ratePerKmInput, setRatePerKmInput] = useState<string>("15");
  const [noFreebiesDiscountInput, setNoFreebiesDiscountInput] =
    useState<string>("2000");
  const [previewDistanceKm, setPreviewDistanceKm] = useState<string>("10");
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);

  useEffect(() => {
    if (deliveryPricing) {
      setBaseFareInput(String(deliveryPricing.baseFare ?? 100));
      setRatePerKmInput(String(deliveryPricing.ratePerKm ?? 15));
      setNoFreebiesDiscountInput(
        String(deliveryPricing.noFreebiesDiscountPerPig ?? 2000),
      );
    }
  }, [deliveryPricing]);

  const parsedBaseFare = Math.max(0, parseFloat(baseFareInput) || 0);
  const parsedRatePerKm = Math.max(0, parseFloat(ratePerKmInput) || 0);
  const parsedNoFreebiesDiscount = Math.max(
    0,
    parseFloat(noFreebiesDiscountInput) || 0,
  );
  const parsedPreviewKm = Math.max(0, parseFloat(previewDistanceKm) || 0);
  const sampleComputedFee = Math.round(parsedPreviewKm * parsedRatePerKm + parsedBaseFare);

  const handleSaveDeliveryPricing = () => {
    if (!isOwner) return;
    updateDeliveryPricingMutation.mutate({
      baseFare: parsedBaseFare,
      ratePerKm: parsedRatePerKm,
      noFreebiesDiscountPerPig: parsedNoFreebiesDiscount,
    });
  };

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
            System Settings &amp; Governance
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage catalogue base rates, dynamic delivery pricing formulas, and counter staff terminal accounts.
          </p>
        </div>

        {activeMainTab === "catalog" && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shrink-0 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Item
          </Button>
        )}
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeMainTab === "catalog"
              ? "bg-[#181312] text-amber-400 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Menu Catalog &amp; Delivery Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("staff")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeMainTab === "staff"
              ? "bg-[#181312] text-amber-400 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>👥 Staff &amp; Terminal Accounts</span>
          {users.length > 0 && (
            <span className="ml-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono">
              {users.length}
            </span>
          )}
        </button>
      </div>

      {activeMainTab === "catalog" && (
        <>
          {/* Foldable Policy Configurations (Discount & Delivery) */}
          <div className="space-y-3">
            {/* 1. Foldable Discount Configuration Card */}
            <Card className="bg-white shadow-sm border-stone-200/90 rounded-xl overflow-hidden transition-all duration-200">
              <button
                type="button"
                aria-expanded={isDiscountOpen}
                aria-controls="discount-config-panel"
                onClick={() => setIsDiscountOpen(!isDiscountOpen)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-900">
                        Discount Configuration
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] font-mono font-medium px-2 py-0.5"
                      >
                        No-Freebies: -₱{parsedNoFreebiesDiscount.toLocaleString()} / head
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      Dynamic discount applied when customers opt out of the Whole Lechon 7-freebies package.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isOwner && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium hidden sm:flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" /> View Only
                    </Badge>
                  )}
                  <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-stone-500 transition-transform duration-200">
                    {isDiscountOpen ? (
                      <ChevronUp className="w-4 h-4 text-stone-700" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-700" />
                    )}
                  </div>
                </div>
              </button>

              {isDiscountOpen && (
                <CardContent id="discount-config-panel" className="pt-3 pb-5 px-5 border-t border-stone-100 bg-stone-50/40">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
                    <div className="lg:col-span-5 space-y-2">
                      <label className="text-xs font-semibold text-stone-800 block">
                        No-Freebies Opt-Out Discount per Whole Lechon (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm font-semibold">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="100"
                          min="0"
                          disabled={!isOwner || updateDeliveryPricingMutation.isPending}
                          value={noFreebiesDiscountInput}
                          onChange={(e) => setNoFreebiesDiscountInput(e.target.value)}
                          className="h-10 pl-8 font-mono text-sm bg-white border-stone-300 focus-visible:ring-emerald-500"
                          placeholder="2000"
                        />
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        Automatically deducted from Grand Total for every eligible Whole Lechon (≥13kg) when customer selects <strong>🚫 No Freebies</strong>. Standard preset: ₱2,000.
                      </p>
                    </div>

                    <div className="lg:col-span-4 bg-white border border-stone-200 rounded-lg p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                          Live Multiplier Scaling Preview
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          -₱{parsedNoFreebiesDiscount.toLocaleString()} × heads
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                        <div className="bg-stone-50 rounded-md p-2 border border-stone-150">
                          <div className="text-[10px] text-stone-500 uppercase">1 Head</div>
                          <div className="text-xs font-bold text-rose-600 mt-0.5">
                            -₱{(parsedNoFreebiesDiscount * 1).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-stone-50 rounded-md p-2 border border-stone-150">
                          <div className="text-[10px] text-stone-500 uppercase">2 Heads</div>
                          <div className="text-xs font-bold text-rose-600 mt-0.5">
                            -₱{(parsedNoFreebiesDiscount * 2).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-stone-50 rounded-md p-2 border border-stone-150">
                          <div className="text-[10px] text-stone-500 uppercase">3 Heads</div>
                          <div className="text-xs font-bold text-rose-600 mt-0.5">
                            -₱{(parsedNoFreebiesDiscount * 3).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-3 flex flex-col justify-end self-end pt-1">
                      <Button
                        type="button"
                        disabled={!isOwner || updateDeliveryPricingMutation.isPending}
                        onClick={handleSaveDeliveryPricing}
                        className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {updateDeliveryPricingMutation.isPending ? "Saving..." : "Save Discount Settings"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 2. Foldable Delivery Configuration Card */}
            <Card className="bg-white shadow-sm border-stone-200/90 rounded-xl overflow-hidden transition-all duration-200">
              <button
                type="button"
                aria-expanded={isDeliveryOpen}
                aria-controls="delivery-config-panel"
                onClick={() => setIsDeliveryOpen(!isDeliveryOpen)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-900">
                        Delivery Configuration
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-mono font-medium px-2 py-0.5"
                      >
                        Base: ₱{parsedBaseFare.toLocaleString()} • Rate: ₱{parsedRatePerKm.toLocaleString()}/km
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      Dynamic distance formula used by Web & Mobile POS terminals to auto-calculate Freelance Delivery fees.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isOwner && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium hidden sm:flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" /> View Only
                    </Badge>
                  )}
                  <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-stone-500 transition-transform duration-200">
                    {isDeliveryOpen ? (
                      <ChevronUp className="w-4 h-4 text-stone-700" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-700" />
                    )}
                  </div>
                </div>
              </button>

              {isDeliveryOpen && (
                <CardContent id="delivery-config-panel" className="pt-3 pb-5 px-5 border-t border-stone-100 bg-stone-50/40">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
                    <div className="lg:col-span-3 space-y-1.5">
                      <label className="text-xs font-semibold text-stone-800 block">
                        Base Fare (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm font-semibold">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="5"
                          min="0"
                          disabled={!isOwner || updateDeliveryPricingMutation.isPending}
                          value={baseFareInput}
                          onChange={(e) => setBaseFareInput(e.target.value)}
                          className="h-10 pl-8 font-mono text-sm bg-white border-stone-300 focus-visible:ring-amber-500"
                          placeholder="100"
                        />
                      </div>
                      <p className="text-[11px] text-stone-500">
                        Minimum dispatch fee floor per delivery.
                      </p>
                    </div>

                    <div className="lg:col-span-3 space-y-1.5">
                      <label className="text-xs font-semibold text-stone-800 block">
                        Rate Per KM (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm font-semibold">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          disabled={!isOwner || updateDeliveryPricingMutation.isPending}
                          value={ratePerKmInput}
                          onChange={(e) => setRatePerKmInput(e.target.value)}
                          className="h-10 pl-8 font-mono text-sm bg-white border-stone-300 focus-visible:ring-amber-500"
                          placeholder="15"
                        />
                      </div>
                      <p className="text-[11px] text-stone-500">
                        Charged per road kilometer from kitchen.
                      </p>
                    </div>

                    <div className="lg:col-span-4 bg-white border border-stone-200 rounded-lg p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <Calculator className="w-3.5 h-3.5 text-amber-600" />
                          Live Distance Formula Preview
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          Fee = (KM × ₱{parsedRatePerKm}) + ₱{parsedBaseFare}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-500">Sample:</span>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            value={previewDistanceKm}
                            onChange={(e) => setPreviewDistanceKm(e.target.value)}
                            className="w-18 h-8 text-xs font-mono text-center bg-stone-50 border-stone-300"
                            title="Sample Distance in KM"
                          />
                          <span className="text-xs font-mono text-stone-600">km</span>
                        </div>
                        <Badge className="bg-emerald-700 text-white font-mono text-xs px-3 py-1 font-bold shadow-2xs">
                          Total: ₱{sampleComputedFee.toLocaleString()}
                        </Badge>
                      </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col justify-end self-end pt-1">
                      <Button
                        type="button"
                        disabled={!isOwner || updateDeliveryPricingMutation.isPending}
                        onClick={handleSaveDeliveryPricing}
                        className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {updateDeliveryPricingMutation.isPending ? "Saving..." : "Save Rates"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
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
        </>
      )}

      {/* Staff & Terminal Accounts Tab */}
      {activeMainTab === "staff" && (
        <Card className="bg-white shadow-sm border-stone-200/90 rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-stone-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-stone-900">
                    Staff &amp; Terminal Accounts
                  </CardTitle>
                  <CardDescription className="text-xs text-stone-500 mt-0.5">
                    Provision counter cashier logins, reset shift passwords, and revoke terminal access.
                  </CardDescription>
                </div>
              </div>

              <Button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shrink-0 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Staff Account
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingUsers ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                Loading staff accounts...
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                No staff accounts found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-stone-50/80">
                    <TableRow className="border-b border-stone-200">
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5">
                        Name
                      </TableHead>
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5">
                        Username
                      </TableHead>
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5">
                        Role
                      </TableHead>
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5">
                        Status
                      </TableHead>
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5">
                        Created Date
                      </TableHead>
                      <TableHead className="font-bold text-stone-700 text-xs uppercase tracking-wider py-3.5 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isSelf = u.username.toLowerCase() === currentUser?.username.toLowerCase();
                      const formattedDate = new Date(u.createdAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <TableRow
                          key={u.id}
                          className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors"
                        >
                          <TableCell className="font-medium text-stone-900 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isSelf && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 border border-amber-300 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 font-mono text-xs text-stone-600">
                            @{u.username}
                          </TableCell>
                          <TableCell className="py-3.5">
                            {u.role === "Owner" ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 font-semibold text-xs">
                                👑 Owner
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 font-semibold text-xs">
                                🧑‍💼 Cashier
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5">
                            {u.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-semibold text-xs">
                                🟢 Active
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 font-semibold text-xs">
                                🔴 Deactivated
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-stone-500">
                            {formattedDate}
                          </TableCell>
                          <TableCell className="py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedResetUser(u);
                                  setIsResetPasswordModalOpen(true);
                                }}
                                className="h-8 text-xs font-medium border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                              >
                                🔑 Reset Password
                              </Button>

                              {u.isActive ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isSelf || toggleUserStatusMutation.isPending}
                                  title={
                                    isSelf
                                      ? "Cannot deactivate your own active Owner account"
                                      : "Revoke terminal sign-in access"
                                  }
                                  onClick={() => {
                                    setStatusConfirmUser({ user: u, targetActive: false });
                                  }}
                                  className={`h-8 text-xs font-medium cursor-pointer ${
                                    isSelf
                                      ? "opacity-50 cursor-not-allowed bg-stone-100 text-stone-400 border-stone-200"
                                      : "border-rose-200 text-rose-700 hover:bg-rose-50"
                                  }`}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={toggleUserStatusMutation.isPending}
                                  onClick={() => {
                                    setStatusConfirmUser({ user: u, targetActive: true });
                                  }}
                                  className="h-8 text-xs font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
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
      )}

      {/* Staff Account Status Confirmation Dialog */}
      {statusConfirmUser && (
        <Dialog
          open={Boolean(statusConfirmUser)}
          onOpenChange={(open) => {
            if (!open) setStatusConfirmUser(null);
          }}
        >
          <DialogContent className="sm:max-w-md bg-white border-stone-200 shadow-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    statusConfirmUser.targetActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-stone-900">
                    {statusConfirmUser.targetActive
                      ? "Reactivate Staff Account"
                      : "Deactivate Staff Account"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-stone-500">
                    Confirm staff account status modification.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-2 text-sm text-stone-700">
              {statusConfirmUser.targetActive ? (
                <p>
                  Are you sure you want to reactivate{" "}
                  <strong>{statusConfirmUser.user.fullName}</strong> (
                  <span className="font-mono text-xs">@{statusConfirmUser.user.username}</span>)?
                  This user will immediately be permitted to sign into counter terminals.
                </p>
              ) : (
                <p>
                  Are you sure you want to deactivate{" "}
                  <strong>{statusConfirmUser.user.fullName}</strong> (
                  <span className="font-mono text-xs">@{statusConfirmUser.user.username}</span>)?
                  This staff member will immediately be blocked from logging into the POS, logistics, and store management systems.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusConfirmUser(null)}
                className="border-stone-300 text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  toggleUserStatusMutation.mutate(
                    {
                      id: statusConfirmUser.user.id,
                      isActive: statusConfirmUser.targetActive,
                    },
                    {
                      onSuccess: () => {
                        setStatusConfirmUser(null);
                      },
                    }
                  );
                }}
                disabled={toggleUserStatusMutation.isPending}
                className={
                  statusConfirmUser.targetActive
                    ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                    : "bg-rose-700 hover:bg-rose-800 text-white"
                }
              >
                {statusConfirmUser.targetActive ? "Confirm Reactivation" : "Confirm Deactivation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Staff Account Management Modals */}
      <CreateUserModal
        open={isCreateUserModalOpen}
        onOpenChange={setIsCreateUserModalOpen}
      />

      <ResetPasswordModal
        user={selectedResetUser}
        open={isResetPasswordModalOpen}
        onOpenChange={setIsResetPasswordModalOpen}
      />

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
