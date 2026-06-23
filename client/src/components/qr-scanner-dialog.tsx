import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScanLineIcon, PrinterIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { printBoxLabel } from "@/lib/print-label";

type Props = {
  mode?: "open" | "print";
  triggerLabel?: string;
  triggerVariant?: "default" | "secondary" | "outline";
  triggerIcon?: "scan" | "print";
};

export function QrScannerDialog({
  mode = "open",
  triggerLabel = "Scan QR",
  triggerVariant = "secondary",
  triggerIcon = "scan",
}: Props = {}) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = `qr-scanner-region-${mode}`;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const start = () => {
      if (cancelled) return;
      const el = document.getElementById(containerId);
      if (!el) {
        requestAnimationFrame(start);
        return;
      }
      scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          handleResult,
          () => {},
        )
        .catch((err) => {
          toast({
            title: "Camera unavailable",
            description: String(err?.message || err),
            variant: "destructive",
          });
          setOpen(false);
        });
    };

    const handleResult = async (decoded: string) => {
      if (cancelled) return;
      cancelled = true;
      try {
        await scanner?.stop();
      } catch {}

      // Accept either a full URL containing /qr/<token> or a raw token string.
      let token = decoded.trim();
      const match = token.match(/\/qr\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];

      let box;
      try {
        const res = await apiRequest("GET", `/api/boxes/by-qr/${encodeURIComponent(token)}`);
        box = await res.json();
      } catch {
        toast({
          title: "Box not found",
          description: "That QR code doesn't match any of your boxes.",
          variant: "destructive",
        });
        setOpen(false);
        return;
      }

      setOpen(false);
      if (mode === "print") {
        try {
          await printBoxLabel(box);
          toast({ title: "Label sent to print", description: box.name });
        } catch (err: any) {
          toast({
            title: "Failed to print label",
            description: String(err?.message || err),
            variant: "destructive",
          });
        }
      } else {
        setLocation(`/box/${box.id}`);
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {}
          });
      }
    };
  }, [open, setLocation, toast, mode]);

  const Icon = triggerIcon === "print" ? PrinterIcon : ScanLineIcon;
  const title = mode === "print" ? "Scan to reprint label" : "Scan a box QR code";
  const hint =
    mode === "print"
      ? "Point your camera at an existing label to print a fresh copy."
      : "Point your camera at the QR code on a box.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Icon className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div id={containerId} className="w-full rounded overflow-hidden bg-black" />
        <p className="text-sm text-muted-foreground text-center">{hint}</p>
      </DialogContent>
    </Dialog>
  );
}
