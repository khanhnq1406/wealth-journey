"use client";

import { useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { BaseModal } from "@/components/modals/BaseModal";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useNotification } from "@/contexts/NotificationContext";

type CaptureStatus = "idle" | "loading" | "success" | "error";

interface PnlShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardRef: RefObject<HTMLElement | null>;
}

/**
 * PnlShareModal — page-co-located modal for capturing the NetWorthDisplay card
 * as a branded PNG image with app logo overlay.
 *
 * Uses html2canvas (dynamic import) to capture the card DOM element,
 * composites the icon-192x192.png logo onto the top-right corner,
 * and provides Download and native OS Share actions.
 *
 * Design note: The preview uses a plain <img src={dataURL}> element because the
 * image is dynamically generated at runtime (not a static asset) and its
 * dimensions are not known ahead of time. next/image requires known dimensions
 * or layout="fill" with a constrained parent — inappropriate here since we want
 * object-contain scaling within a max-height container. The data URL is never
 * persisted or sent to any server, so there is no XSS or data-exfiltration risk.
 */
export function PnlShareModal({ isOpen, onClose, cardRef }: PnlShareModalProps) {
  const t = useTranslations("dashboard.home.sharePnl");
  const { toast } = useNotification();

  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Check Web Share API file support (browser-only, evaluated once on mount)
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        const testFile = new File([""], "test.png", { type: "image/png" });
        setCanShare(navigator.canShare?.({ files: [testFile] }) ?? false);
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  const captureImage = useCallback(async () => {
    // Find the visible [data-pnl-card] element — works for both mobile and desktop
    // On mobile the sm:hidden wrapper is visible; on desktop the sm:block wrapper is visible.
    const allCards = document.querySelectorAll<HTMLElement>("[data-pnl-card]");
    console.log("[PnlShare] querySelectorAll [data-pnl-card] count:", allCards.length);
    Array.from(allCards).forEach((el, i) => {
      const style = window.getComputedStyle(el);
      console.log(`[PnlShare] card[${i}] display="${style.display}" className="${el.className}" rect=`, el.getBoundingClientRect());
    });

    const targetEl = Array.from(allCards).find((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // Must be visible AND have actual rendered dimensions
      return style.display !== "none" && rect.width > 0 && rect.height > 0;
    });

    console.log("[PnlShare] targetEl:", targetEl);

    if (!targetEl) {
      console.error("[PnlShare] No visible [data-pnl-card] found — showing error");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setDataURL(null);

    try {
      // Dynamically import html2canvas — keeps it out of the initial bundle (SSR-safe)
      const html2canvas = (await import("html2canvas")).default;
      console.log("[PnlShare] html2canvas loaded, starting capture of:", targetEl);

      // Step 1: Capture the visible card DOM element at retina quality
      // useCORS + allowTaint: true so sjc3d.webp (same-origin) loads correctly
      // imageTimeout: 8000ms to wait for next/image to fully render
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 8000,
        onclone: (_doc: Document, clone: HTMLElement) => {
          // Ensure cloned element is fully visible for capture
          clone.style.display = "block";
          clone.style.visibility = "visible";
          clone.style.opacity = "1";
        },
      } as any);
      console.log("[PnlShare] html2canvas done, canvas size:", canvas.width, "x", canvas.height);

      // Step 2: Composite the app logo onto a second canvas
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw the captured card
      ctx.drawImage(canvas, 0, 0);

      // Load and draw the logo onto the top-right corner
      // logoSize: 48px * scale:2 = 96px; margin: 16px * scale:2 = 32px
      try {
        const logoSize = 96;
        const margin = 32;
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logo.onload = () => resolve();
          logo.onerror = () => resolve(); // Skip logo on error — still show card image
          logo.src = "/icons/icon-192x192.png";
        });
        if (logo.complete && logo.naturalWidth > 0) {
          const x = outputCanvas.width - logoSize - margin;
          const y = margin; // top-right corner (was bottom-right)
          // Dark semi-transparent circle behind logo for readability
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + logoSize / 2, y + logoSize / 2, logoSize / 2 + 8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.fill();
          ctx.restore();
          ctx.drawImage(logo, x, y, logoSize, logoSize);
        }
      } catch {
        // Logo load failed — continue without logo overlay
      }

      const finalDataURL = outputCanvas.toDataURL("image/png");
      console.log("[PnlShare] capture success, dataURL length:", finalDataURL.length);
      setDataURL(finalDataURL);
      setStatus("success");
    } catch (err) {
      console.error("[PnlShare] capture error:", err);
      setStatus("error");
    }
  }, []);

  // Trigger capture every time the modal opens; reset state when it closes
  useEffect(() => {
    if (isOpen) {
      captureImage();
    } else {
      setStatus("idle");
      setDataURL(null);
    }
  }, [isOpen, captureImage]);

  const handleDownload = useCallback(() => {
    if (!dataURL) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `pnl-congdongvang-${today}.png`;
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dataURL]);

  const handleShare = useCallback(async () => {
    if (!dataURL || isSharing) return;

    setIsSharing(true);
    try {
      // Convert data URL to Blob/File for the Web Share API
      const res = await fetch(dataURL);
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `pnl-congdongvang-${today}.png`, {
        type: "image/png",
      });

      await navigator.share({
        files: [file],
        title: t("shareTitle"),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled the OS share sheet — silently ignore
        return;
      }
      toast.error(t("errorShare"));
    } finally {
      setIsSharing(false);
    }
  }, [dataURL, isSharing, t, toast]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modalTitle")}
    >
      <div className="space-y-4">
        {/* Image preview area — min-height prevents layout shift during capture */}
        <div className="flex items-center justify-center min-h-[160px]">
          {status === "loading" && (
            <LoadingSpinner text={t("generating")} />
          )}
          {status === "error" && (
            <ErrorState
              message={t("errorCapture")}
              primaryAction={{
                label: "Retry",
                onClick: captureImage,
              }}
            />
          )}
          {status === "success" && dataURL && (
            /* Plain <img> is correct here: data URL is browser-generated at runtime,
               dimensions are unknown ahead of time, and content never leaves the device.
               See design note in JSDoc above. */
            <img
              src={dataURL}
              alt="PNL preview"
              className="w-full max-h-[60vh] object-contain rounded-xl overflow-hidden shadow-modal"
            />
          )}
        </div>

        {/* Action buttons — visible only after a successful capture */}
        {status === "success" && (
          <div className="flex gap-3">
            <Button
              type={ButtonType.SECONDARY}
              onClick={handleDownload}
              disabled={isSharing}
              fullWidth
            >
              {t("download")}
            </Button>
            {canShare && (
              <Button
                type={ButtonType.PRIMARY}
                onClick={handleShare}
                loading={isSharing}
                fullWidth
              >
                {t("share")}
              </Button>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
