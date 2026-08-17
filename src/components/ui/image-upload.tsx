"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Sparkles } from "lucide-react";
import { compressImageFile, formatFileSize, CompressionResult } from "@/lib/image-compressor";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface ImageUploadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  upload: (formData: FormData) => Promise<string>;
  onRemove?: () => void;
  label?: string;
  description?: string;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: "square" | "landscape" | "banner";
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  upload,
  onRemove,
  label = "Upload photo",
  description = "Supports JPG, PNG, WebP up to 15MB. Automatically compressed.",
  maxWidth = 600,
  maxHeight = 600,
  aspectRatio = "square",
  className = "",
}: ImageUploadProps) {
  const toast = useToast();
  const [compressing, setCompressing] = useState(false);
  const [stats, setStats] = useState<CompressionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setCompressing(true);

    try {
      const result = await compressImageFile(file, { maxWidth, maxHeight, quality: 0.82 });
      setStats(result);
      const formData = new FormData();
      formData.set("file", result.file);
      onChange(await upload(formData));
    } catch (err) {
      console.error("Image compression error:", err);
      toast.error("Failed to compress image file. Please try another image.");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    setStats(null);
    if (onRemove) {
      onRemove();
    } else {
      onChange("");
    }
  };

  const aspectClasses = {
    square: "aspect-square w-32 h-32 rounded-2xl",
    landscape: "aspect-video w-full max-w-sm rounded-2xl h-44",
    banner: "w-full h-40 rounded-2xl",
  };

  return (
    <div className={`space-y-2 select-none ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className="space-y-2">
          <div className="relative group inline-block">
            <div className={`relative overflow-hidden border border-border-subtle shadow-sm ${aspectClasses[aspectRatio]}`}>
              {/* Local data/blob previews are intentionally not routed through the Next image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Uploaded image preview" className="w-full h-full object-cover" />
              {compressing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-1">
                  <Loader2 className="animate-spin w-5 h-5 text-accent" />
                  <span className="text-xs font-semibold">Compressing...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClear}
              aria-label="Remove photo"
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110 z-10"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-surface-raised hover:bg-surface-muted border border-border-subtle text-content text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-accent" />
              <span>Change photo</span>
            </button>

            {stats && (
              <Badge variant="default" size="sm" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1 text-accent" />
                <span>
                  {formatFileSize(stats.originalSizeKb)} ➔ {formatFileSize(stats.compressedSizeKb)} ({stats.savedPercentage}% smaller)
                </span>
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border-subtle hover:border-accent/60 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-surface-raised group flex flex-col items-center justify-center space-y-2 text-content"
        >
          <div className="w-11 h-11 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
            {compressing ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
          </div>

          <div>
            <span className="text-xs font-bold text-content group-hover:text-accent transition-colors block">
              {compressing ? "Compressing & optimizing photo..." : label}
            </span>
            <span className="text-xs text-content-secondary block mt-0.5">{description}</span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" /> Auto-compresses file size
          </span>
        </div>
      )}
    </div>
  );
}

