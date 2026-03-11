"use client";

import { useState } from "react";
import { LOCAL_STORAGE_TOKEN_NAME } from "@/app/constants";

type Purpose = "post" | "avatar" | "cover";

interface UseImageUploadReturn {
  uploading: boolean;
  progress: number;
  error: string | null;
  imageUrl: string | null;
  uploadImage: (file: File, purpose: Purpose) => Promise<string>;
  reset: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const uploadImage = async (file: File, purpose: Purpose): Promise<string> => {
    // Client-side validation (UX only — server validates magic bytes)
    if (!ALLOWED_TYPES.includes(file.type)) {
      const msg = "Only JPEG, PNG, WebP, and GIF files are allowed";
      setError(msg);
      throw new Error(msg);
    }
    if (file.size > MAX_FILE_SIZE) {
      const msg = "File size must be 5MB or less";
      setError(msg);
      throw new Error(msg);
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    return new Promise<string>((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", purpose);

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const url = data.imageUrl || data.data?.imageUrl;
            if (url) {
              setImageUrl(url);
              resolve(url);
            } else {
              const msg = "Upload failed: no URL returned";
              setError(msg);
              reject(new Error(msg));
            }
          } catch {
            const msg = "Upload failed: invalid response";
            setError(msg);
            reject(new Error(msg));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            const msg = data.message || "Upload failed";
            setError(msg);
            reject(new Error(msg));
          } catch {
            const msg = `Upload failed: ${xhr.statusText}`;
            setError(msg);
            reject(new Error(msg));
          }
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        const msg = "Upload failed: network error";
        setError(msg);
        reject(new Error(msg));
      };

      const baseURL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      xhr.open("POST", `${baseURL}/api/v1/community/upload`);

      // Include auth token — uses the same localStorage key as api-client.ts
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME)
          : null;
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setImageUrl(null);
  };

  return { uploading, progress, error, imageUrl, uploadImage, reset };
}
