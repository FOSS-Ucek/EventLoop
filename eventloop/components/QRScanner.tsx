"use client";

import { useEffect, useState, useRef } from "react";
import { Camera, QrCode, X, RefreshCw, Sparkles, AlertCircle } from "lucide-react";

interface QRScannerProps {
  onScanSuccess: (code: string) => void;
  onCancel?: () => void;
}

export default function QRScanner({ onScanSuccess, onCancel }: QRScannerProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const html5QrCodeRef = useRef<any>(null);

  const parseScannedText = (text: string): string => {
    try {
      // Check if text is a URL containing eventCode param
      if (text.includes("http://") || text.includes("https://")) {
        const url = new URL(text);
        const codeParam = url.searchParams.get("eventCode") || url.searchParams.get("code");
        if (codeParam) return codeParam;

        // Check path like /events/XYZ/qr or /event/XYZ
        const pathSegments = url.pathname.split("/").filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          if (lastSegment !== "qr") return lastSegment;
          if (pathSegments.length > 1) return pathSegments[pathSegments.length - 2];
        }
      }

      // Check if text is JSON
      if (text.startsWith("{") && text.endsWith("}")) {
        const parsed = JSON.parse(text);
        if (parsed.code) return parsed.code;
        if (parsed.eventCode) return parsed.eventCode;
        if (parsed.id) return parsed.id;
      }
    } catch (e) {
      console.warn("Failed to parse URL/JSON from QR string:", e);
    }
    return text.trim();
  };

  const handleScanResult = (decodedText: string) => {
    const code = parseScannedText(decodedText);
    if (code) {
      stopCameraScanner();
      onScanSuccess(code);
    }
  };

  const startCameraScanner = async () => {
    setError(null);
    setScannerActive(true);
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qrReaderElement = document.getElementById("qr-reader");

      if (!qrReaderElement) {
        throw new Error("Scanner element not found in DOM");
      }

      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // ignore error if not running
        }
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          handleScanResult(decodedText);
        },
        (errorMessage: string) => {
          // ignore continuous scanning frame errors
        }
      );
    } catch (err: any) {
      console.error("Camera scanner error:", err);
      setError(err?.message || "Could not start camera scanner. Please check camera permissions.");
      setScannerActive(false);
      setScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping QR scanner:", e);
      }
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = parseScannedText(manualCode);
    onScanSuccess(code);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5 border rounded-2xl p-6 bg-white dark:bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Scan Event QR</h3>
            <p className="text-xs text-gray-500">Scan or enter event code to join</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={() => {
              stopCameraScanner();
              onCancel();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera scanner viewport */}
      <div className="relative overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-800 min-h-[260px] flex items-center justify-center">
        <div id="qr-reader" className="w-full h-full"></div>

        {!scannerActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-zinc-900 space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <p className="font-medium text-sm">Ready to scan QR Code</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                Click below to turn on your camera and scan the event QR code
              </p>
            </div>
            <button
              onClick={startCameraScanner}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-md flex items-center gap-2 transition-all hover:scale-105"
            >
              <Camera className="w-4 h-4" />
              Open Camera Scanner
            </button>
          </div>
        )}

        {scannerActive && (
          <button
            onClick={stopCameraScanner}
            className="absolute top-2 right-2 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 text-xs flex items-center gap-1 backdrop-blur-sm"
          >
            <X className="w-4 h-4" />
            Stop Camera
          </button>
        )}
      </div>

      <div className="relative flex items-center justify-center">
        <div className="border-t w-full border-gray-200 dark:border-zinc-800"></div>
        <span className="bg-white dark:bg-zinc-900 px-3 text-xs text-gray-400 font-medium absolute">OR</span>
      </div>

      {/* Manual code input form */}
      <form onSubmit={handleManualSubmit} className="space-y-3">
        <label htmlFor="manual-code-input" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          Enter Event Code Manually
        </label>
        <div className="flex gap-2">
          <input
            id="manual-code-input"
            type="text"
            placeholder="e.g. tech-conf-2026 or Event ID"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-colors flex items-center gap-1"
          >
            Enter
          </button>
        </div>
      </form>
    </div>
  );
}
