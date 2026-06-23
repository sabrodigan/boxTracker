import { useEffect, useRef } from "react";
import QRCode from "qrcode";

type Props = {
  token: string;
};

export function SmallQrCode({ token }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const qrValue = `${window.location.origin}/qr/${token}`;
      QRCode.toCanvas(canvasRef.current, qrValue, { width: 48, margin: 1 });
    }
  }, [token]);

  return (
    <canvas 
      ref={canvasRef} 
      className="rounded-md border border-muted bg-white shrink-0 shadow-sm" 
      style={{ width: 48, height: 48 }} 
    />
  );
}
