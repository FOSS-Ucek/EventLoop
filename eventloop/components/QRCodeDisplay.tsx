"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState, useRef } from "react";
import { Copy, Check, Download, Share2, ExternalLink } from "lucide-react";

interface QRCodeDisplayProps {
  eventId: string;
  eventCode: string;
  eventTitle: string;
  eventLocation?: string | null;
}

export default function QRCodeDisplay({
  eventId,
  eventCode,
  eventTitle,
  eventLocation,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const eventUrl = `${baseUrl}/?eventCode=${encodeURIComponent(eventCode)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDownloadQR = () => {
    const svgElement = qrRef.current?.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `${eventCode}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div
        ref={qrRef}
        className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center dark:border-zinc-800"
      >
        <QRCodeSVG
          value={eventUrl}
          size={250}
          level="H"
          includeMargin={true}
        />
        <p className="mt-4 text-xs font-mono text-gray-500 uppercase tracking-wider">
          CODE: {eventCode}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border text-sm font-mono break-all">
          <span className="truncate mr-2 text-xs text-gray-600 dark:text-gray-400">{eventUrl}</span>
          <button
            onClick={handleCopyLink}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors text-xs flex items-center gap-1 font-sans"
            title="Copy URL"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDownloadQR}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download QR
          </button>
          <button
            onClick={handleCopyLink}
            className="py-2.5 px-4 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
