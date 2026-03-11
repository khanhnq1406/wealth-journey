"use client";

import { useRef, useState, useCallback } from "react";
import { useImageUpload } from "../hooks/useImageUpload";

type Purpose = "post" | "avatar" | "cover";

interface ImageUploadProps {
  purpose: Purpose;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  currentImageUrl?: string;
  label?: string;
  className?: string;
}

export function ImageUpload({
  purpose,
  onUpload,
  onRemove,
  currentImageUrl,
  label = "Upload image",
  className = "",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const { uploading, progress, error, uploadImage, reset } = useImageUpload();

  const handleFile = useCallback(
    async (file: File) => {
      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      try {
        const url = await uploadImage(file, purpose);
        onUpload(url);
      } catch {
        setPreview(currentImageUrl || null);
      }
    },
    [uploadImage, purpose, onUpload, currentImageUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRemove = () => {
    setPreview(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
    onRemove?.();
  };

  return (
    <div className={`relative ${className}`}>
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full rounded-lg object-cover max-h-64"
          />
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80"
            >
              ×
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center rounded-lg">
              <div className="text-white text-sm mb-2">{progress}%</div>
              <div className="w-32 bg-white/30 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-bg bg-green-50"
              : "border-gray-300 hover:border-bg hover:bg-gray-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-gray-400 text-sm">
            <div className="text-2xl mb-1">📷</div>
            <div>{label}</div>
            <div className="text-xs mt-1 text-gray-300">
              JPEG, PNG, WebP, GIF · max 5MB
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
