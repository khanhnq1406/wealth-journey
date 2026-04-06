"use client";

import { useState, useEffect, useCallback } from "react";
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
  totalNetWorth: number;
  currency: string;
  monthPnl: number;
  monthPnlPercent: number;
  userName?: string;
}

// Card dimensions (logical px — output is 2x for retina)
const W = 700;
const H = 300;
const SCALE = 2;

// Module-level helpers — stable references, never cause re-renders
function formatAmount(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value));
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Gold gradient stop colors
const GOLD_STOPS: [number, string][] = [
  [0, "#B8862D"],
  [0.2, "#D4A843"],
  [0.4, "#F5D38E"],
  [0.55, "#E8C36A"],
  [0.7, "#D4A843"],
  [0.85, "#B8862D"],
  [1, "#9A7023"],
];

/**
 * PnlShareModal — draws the share card directly on a Canvas 2D context.
 * No html2canvas, no DOM capture — pure canvas drawing gives pixel-perfect
 * results regardless of browser CSS rendering quirks.
 *
 * Design note: The preview uses a plain <img src={dataURL}> element because the
 * image is dynamically generated at runtime (not a static asset) and its
 * dimensions are not known ahead of time. The data URL is never persisted or
 * sent to any server, so there is no XSS or data-exfiltration risk.
 */
export function PnlShareModal({
  isOpen,
  onClose,
  totalNetWorth,
  currency,
  monthPnl,
  monthPnlPercent,
  userName,
}: PnlShareModalProps) {
  const t = useTranslations("dashboard.home.sharePnl");
  const tHome = useTranslations("dashboard.home");
  const { toast } = useNotification();

  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        const testFile = new File([""], "test.png", { type: "image/png" });
        setCanShare(navigator.canShare?.({ files: [testFile] }) ?? false);
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  const drawCard = useCallback(async (): Promise<string> => {
    const cw = W * SCALE;
    const ch = H * SCALE;
    const s = SCALE;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");

    ctx.scale(s, s);

    // ── 1. Gold gradient background with rounded corners ──
    const radius = 16;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(W - radius, 0);
    ctx.quadraticCurveTo(W, 0, W, radius);
    ctx.lineTo(W, H - radius);
    ctx.quadraticCurveTo(W, H, W - radius, H);
    ctx.lineTo(radius, H);
    ctx.quadraticCurveTo(0, H, 0, H - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, W, H);
    for (const [stop, color] of GOLD_STOPS) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── 2. SJC gold bar watermark — right side, semi-transparent ──
    try {
      const sjc = new Image();
      sjc.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        sjc.onload = () => resolve();
        sjc.onerror = () => resolve();
        sjc.src = "/sjc3d.webp";
      });
      if (sjc.complete && sjc.naturalWidth > 0) {
        // Natural aspect ratio ~2.7:1 (width:height); render at fixed height
        const sjcH = H;
        const sjcW = sjcH * (sjc.naturalWidth / sjc.naturalHeight);
        const sjcX = W - sjcW - 20; // shifted left, no bleed
        const sjcY = (H - sjcH) / 2;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(sjc, sjcX, sjcY, sjcW, sjcH);
        ctx.globalAlpha = 1;
      }
    } catch {
      // skip sjc watermark
    }

    // ── 3. Dark overlay for text readability ──
    const overlay = ctx.createLinearGradient(0, 0, W, H);
    overlay.addColorStop(0, "rgba(0,0,0,0.38)");
    overlay.addColorStop(0.5, "rgba(0,0,0,0.18)");
    overlay.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // ── 4. PNL bar strip ──
    const barH = 72;
    const barY = H - barH;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, barY, W, barH);

    // ── 4. Top section text ──
    const px = 32; // left padding
    const isPositive = monthPnlPercent >= 0;

    // Greeting
    ctx.font = "500 20px Roboto, sans-serif";
    ctx.fillStyle = "#fcf2e0";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    const hour = new Date().getHours();
    const greetingStr =
      hour < 12
        ? tHome("greeting.morning")
        : hour < 18
          ? tHome("greeting.afternoon")
          : tHome("greeting.evening");
    const greetingText = userName ? `${greetingStr}, ${userName}` : greetingStr;
    ctx.fillText(greetingText, px, 48);

    // Label — small caps tracking
    ctx.font = "600 15px Roboto, sans-serif";
    ctx.fillStyle = "rgba(252,242,224,0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(tHome("totalNetWorthLabel"), px, 80);

    // Amount — large bold
    ctx.shadowBlur = 10;
    ctx.font = "800 68px Roboto, sans-serif";
    ctx.fillStyle = "#fcf2e0";
    const amountText = formatAmount(totalNetWorth);
    ctx.fillText(amountText, px, 178);

    // Currency suffix — smaller, aligned to baseline of amount
    const amountWidth = ctx.measureText(amountText).width;
    ctx.font = "700 22px Roboto, sans-serif";
    ctx.fillStyle = "rgba(252,242,224,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(currency, px + amountWidth + 12, 175);

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // ── 5. PNL bar content ──
    const barCenterY = barY + barH / 2;

    // Arrow icon (TrendingUp / TrendingDown) drawn as simple lines
    const iconX = px;
    const iconSize = 24;
    const iconY = barCenterY - iconSize / 2;
    ctx.strokeStyle = "rgba(252,242,224,0.7)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (isPositive) {
      // TrendingUp: line goes up-right, arrow tip top-right
      ctx.moveTo(iconX, iconY + iconSize * 0.75);
      ctx.lineTo(iconX + iconSize * 0.42, iconY + iconSize * 0.25);
      ctx.lineTo(iconX + iconSize * 0.67, iconY + iconSize * 0.55);
      ctx.lineTo(iconX + iconSize, iconY);
      ctx.moveTo(iconX + iconSize * 0.65, iconY);
      ctx.lineTo(iconX + iconSize, iconY);
      ctx.lineTo(iconX + iconSize, iconY + iconSize * 0.35);
    } else {
      // TrendingDown: line goes down-right, arrow tip bottom-right
      ctx.moveTo(iconX, iconY + iconSize * 0.25);
      ctx.lineTo(iconX + iconSize * 0.42, iconY + iconSize * 0.75);
      ctx.lineTo(iconX + iconSize * 0.67, iconY + iconSize * 0.45);
      ctx.lineTo(iconX + iconSize, iconY + iconSize);
      ctx.moveTo(iconX + iconSize * 0.65, iconY + iconSize);
      ctx.lineTo(iconX + iconSize, iconY + iconSize);
      ctx.lineTo(iconX + iconSize, iconY + iconSize * 0.65);
    }
    ctx.stroke();

    // PNL amount text
    ctx.font = "700 22px Roboto, sans-serif";
    ctx.fillStyle = "#fcf2e0";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.fillText(
      `${formatAmount(monthPnl)} ${currency}`,
      iconX + iconSize + 12,
      barCenterY + 8,
    );

    // Percent pill
    const percentText = formatPercent(monthPnlPercent);
    ctx.font = "700 18px Roboto, sans-serif";
    const pillTextW = ctx.measureText(percentText).width;
    const pillPadX = 16;
    const pillPadY = 7;
    const pillW = pillTextW + pillPadX * 2;
    const pillH = 36;
    const pillX = W - pillW - px;
    const pillY = barCenterY - pillH / 2;
    const pillR = pillH / 2;

    // Pill background
    ctx.shadowBlur = 0;
    ctx.fillStyle = isPositive
      ? "rgba(74,222,128,0.20)"
      : "rgba(248,113,113,0.20)";
    ctx.beginPath();
    ctx.moveTo(pillX + pillR, pillY);
    ctx.lineTo(pillX + pillW - pillR, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
    ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
    ctx.quadraticCurveTo(
      pillX + pillW,
      pillY + pillH,
      pillX + pillW - pillR,
      pillY + pillH,
    );
    ctx.lineTo(pillX + pillR, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
    ctx.lineTo(pillX, pillY + pillR);
    ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
    ctx.closePath();
    ctx.fill();

    // Pill text — vertically centered
    ctx.fillStyle = isPositive ? "#4ade80" : "#f87171";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 3;
    ctx.fillText(percentText, pillX + pillPadX, pillY + pillH / 2 + pillPadY);

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // ── 6. Logo + "congdongvang.com" top-right — both centered on same axis ──
    const logoSize = 64;
    const logoMargin = 44;
    // Center axis for logo+text block, measured from right edge
    const blockCenterX = W - logoMargin - logoSize / 2;
    const logoX = blockCenterX - logoSize / 2;
    const logoY = logoMargin;

    // Load logo
    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = "/icons/icon-192x192.png";
      });
      if (logo.complete && logo.naturalWidth > 0) {
        // Dark circle behind logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(
          blockCenterX,
          logoY + logoSize / 2,
          logoSize / 2 + 6,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fill();
        ctx.restore();
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      }
    } catch {
      // skip logo
    }

    // "congdongvang.com" — centered on same axis as logo
    ctx.font = "500 14px Roboto, sans-serif";
    ctx.fillStyle = "rgba(252,242,224,0.70)";
    ctx.textAlign = "center";
    ctx.fillText("congdongvang.com", blockCenterX, logoY + logoSize + 20);
    ctx.textAlign = "left";

    ctx.restore(); // end clip

    return canvas.toDataURL("image/png");
  }, [totalNetWorth, currency, monthPnl, monthPnlPercent, userName, tHome]);

  const captureImage = useCallback(async () => {
    setStatus("loading");
    setDataURL(null);
    try {
      const url = await drawCard();
      setDataURL(url);
      setStatus("success");
    } catch (err) {
      console.error("[PnlShare] draw error:", err);
      setStatus("error");
    }
  }, [drawCard]);

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
    const today = new Date().toISOString().slice(0, 10);
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
      const res = await fetch(dataURL);
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `pnl-congdongvang-${today}.png`, {
        type: "image/png",
      });
      await navigator.share({ files: [file], title: t("shareTitle") });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t("errorShare"));
    } finally {
      setIsSharing(false);
    }
  }, [dataURL, isSharing, t, toast]);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t("modalTitle")}>
      <div className="space-y-4">
        <div className="flex items-center justify-center min-h-[160px]">
          {status === "loading" && <LoadingSpinner text={t("generating")} />}
          {status === "error" && (
            <ErrorState
              message={t("errorCapture")}
              primaryAction={{ label: "Retry", onClick: captureImage }}
            />
          )}
          {status === "success" && dataURL && (
            /* Plain <img> is correct here: canvas-generated data URL, runtime dimensions
               unknown, never sent to any server. See JSDoc above. */
            <img
              src={dataURL}
              alt="PNL preview"
              className="w-full max-h-[60vh] object-contain rounded-xl overflow-hidden shadow-modal"
            />
          )}
        </div>

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
