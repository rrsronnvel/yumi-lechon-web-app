import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { parseOrderScreenshot } from "@/services/apiClient";
import { ParsedOrderDraftDto } from "@/schemas/orderSchema";
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
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError?.("Uploaded file must be a valid image format (PNG, JPG, WebP).");
        return;
      }
      uploadMutation.mutate(file);
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
      className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-all duration-200 ${
        isDragging
          ? "border-orange-500 bg-orange-100/70 scale-[1.01]"
          : "border-orange-300 hover:border-orange-400 bg-orange-50/50 hover:bg-orange-50/80"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Loading Overlay */}
      {uploadMutation.isPending && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 rounded-lg animate-in fade-in duration-200">
          <Loader2 className="w-7 h-7 text-orange-600 animate-spin mb-2" />
          <p className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-500 animate-bounce" />
            Extracting booking details via Gemini...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Analyzing customer name, contact, menu sizes, timestamps & downpayment
          </p>
          <div className="w-44 h-1.5 bg-orange-100 rounded-full mt-3 overflow-hidden">
            <div className="w-full h-full bg-orange-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shadow-xs">
          <Camera className="w-5 h-5" />
        </div>

        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center justify-center gap-1.5">
            📸 Drag & Drop or Paste Messenger Screenshot (Ctrl + V)
          </h4>
          <p className="text-xs text-muted-foreground">
            Instantly auto-populates the booking slip using multimodal vision AI
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="text-xs h-7 px-3 border-orange-200 bg-white text-orange-800 hover:bg-orange-100 hover:text-orange-900 mt-1"
        >
          <UploadCloud className="w-3.5 h-3.5 mr-1 text-orange-600" />
          Browse Screenshot
        </Button>
      </div>
    </div>
  );
}
