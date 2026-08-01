"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2, Sparkles, Check } from "lucide-react";
import { compressImageFile, formatFileSize, CompressionResult } from "@/lib/image-compressor";
import { Badge } from "@/components/ui/badge";

export interface ImageUploadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
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
  onRemove,
  label = "Upload Photo",
  description = "Supports JPG, PNG, WebP up to 15MB. Automatically compressed to <50KB.",
  maxWidth = 600,
  maxHeight = 600,
  aspectRatio = "square",
  className = "",
}: ImageUploadProps) {
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
      onChange(result.dataUrl);
    } catch (err) {
      console.error("Image compression error:", err);
      alert("Failed to compress image file. Please try another image.");
    } finally {
      setCompressing(false);
      // Reset input value so re-selecting same file triggers change
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
    square: "aspect-square w-32 h-32 rounded-3xl",
    landscape: "aspect-video w-full max-w-sm rounded-3xl h-44",
    banner: "w-full h-40 rounded-3xl",
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
            <div className={`relative overflow-hidden border-2 border-slate-200 shadow-md ${aspectClasses[aspectRatio]}`}>
              <img src={value} alt="Preview" className="w-full h-full object-cover" />
              {compressing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-1">
                  <Loader2 className="animate-spin w-5 h-5 text-blue-400" />
                  <span className="text-[10px] font-bold">Compressing...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-transform hover:scale-110 z-10"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Change Photo</span>
            </button>

            {stats && (
              <Badge variant="purple" size="sm" className="text-[10px]">
                <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
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
          className="border-2 border-dashed border-slate-300 hover:border-blue-500/60 rounded-3xl p-6 text-center cursor-pointer transition-all hover:bg-blue-50/40 group flex flex-col items-center justify-center space-y-2"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            {compressing ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
              {compressing ? "Compressing & Optimizing Photo..." : label}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{description}</span>
          </div>

          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-100/60 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> Auto-compresses file size client-side
          </span>
        </div>
      )}
    </div>
  );
}
