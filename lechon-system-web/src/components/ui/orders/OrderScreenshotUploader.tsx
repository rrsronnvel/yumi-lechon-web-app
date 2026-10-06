import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { parseOrderScreenshot } from "@/services/apiClient";
import { ParsedOrderDraftDto } from "@/schemas/orderSchema";
import { compressScreenshot } from "@/utils/imageCompressor";
import { Camera, UploadCloud, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderScreenshotUploaderProps {
  onParsed: (data: ParsedOrderDraftDto) => void;
  onError?: (error: string) => void;
}

export default function OrderScreenshotUploader({
  onParsed,
  onError,
}: OrderScreenshotUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return await parseOrderScreenshot(file);
    },
    onSuccess: (data) => {
      onParsed(data);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.details ||
        err.response?.data?.Details ||
        err.response?.data?.message ||
        err.response?.data?.Message ||
        err.message ||
        "Failed to parse booking screenshot.";
      onError?.(msg);
    },
  });

  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError?.("Uploaded file must be a valid image format (PNG, JPG, WebP).");
        return;
      }
      try {
        setIsCompressing(true);
        const optimizedFile = await compressScreenshot(file);
        setIsCompressing(false);
        uploadMutation.mutate(optimizedFile);
      } catch {
        setIsCompressing(false);
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation, onError]
  );

  // Global window paste listener while component is mounted
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [processImageFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
    e.target.value = ""; // Reset input so same file can be re-selected
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative py-2 px-3 border border-dashed rounded-lg text-xs flex items-center justify-between gap-3 transition-colors ${
        isDragging
          ? "border-orange-500 bg-orange-100/70"
          : "border-amber-300 hover:border-amber-400 bg-amber-50/60 hover:bg-amber-50/90"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {isCompressing ? (
        <div className="flex items-center gap-2 text-orange-700 font-medium py-0.5">
          <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
          <span className="flex items-center gap-1.5 text-xs truncate">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse shrink-0" />
            Optimizing screenshot size...
          </span>
        </div>
      ) : uploadMutation.isPending ? (
        <div className="flex items-center gap-2 text-orange-700 font-medium py-0.5">
          <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
          <span className="flex items-center gap-1.5 text-xs truncate">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse shrink-0" />
            Extracting booking details via Gemini Vision...
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Camera className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-gray-800">📸 Drop or Paste Screenshot (Ctrl+V)</span>
            <span className="text-[11px] text-muted-foreground ml-2 hidden sm:inline">
              Auto-fill slip from Messenger
            </span>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isCompressing || uploadMutation.isPending}
        className="text-[11px] h-6 px-2.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 shrink-0 font-medium shadow-none"
      >
        <UploadCloud className="w-3 h-3 mr-1 text-amber-700" />
        Browse
      </Button>
    </div>
  );
}
