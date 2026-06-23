import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCodeIcon, PrinterIcon, DownloadIcon } from "lucide-react";
import { printBoxLabel } from "@/lib/print-label";
import type { Box } from "@shared/schema";

type Props = {
  boxId: string;
  token: string;
  boxName: string;
  boxLocation: string;
};

export function BoxQrCode({ boxId, token, boxName, boxLocation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [open, setOpen] = useState(false);

  const qrValue = `${window.location.origin}/qr/${token}`;

  useEffect(() => {
    if (!open) return;
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrValue, { width: 256, margin: 2 });
    }
    QRCode.toDataURL(qrValue, { width: 512, margin: 2 }).then(setDataUrl);
  }, [qrValue, open]);

  const handlePrint = () => {
    const box: Box = { id: boxId, qrToken: token, name: boxName, location: boxLocation, userId: 0 };
    void printBoxLabel(box);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCodeIcon className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR Code for {boxName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="border rounded-lg p-4 w-full flex items-center gap-4">
            <canvas ref={canvasRef} className="rounded shrink-0" style={{ width: 144, height: 144 }} />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Box #{boxId}
              </p>
              <p className="text-lg font-bold leading-tight truncate">{boxName}</p>
              <p className="text-sm text-muted-foreground truncate">{boxLocation}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Print the label, stick it on the box, then point your phone camera at it
            to jump straight here.
          </p>
          <div className="flex gap-2 w-full">
            <Button onClick={handlePrint} className="flex-1" disabled={!dataUrl}>
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print label
            </Button>
            <Button asChild variant="outline" className="flex-1" disabled={!dataUrl}>
              <a href={dataUrl} download={`box-${boxId}-${boxName}.png`}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                QR PNG
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
