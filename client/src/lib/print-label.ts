import QRCode from "qrcode";
import type { Box } from "@shared/schema";

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export async function printBoxLabel(box: Box) {
  const qrValue = `${window.location.origin}/qr/${box.qrToken}`;
  const dataUrl = await QRCode.toDataURL(qrValue, { width: 512, margin: 2 });

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html>
    <html><head><title>Box #${box.id} — ${escape(box.name)}</title>
    <style>
      @page { size: 4in 6in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #f9f9f9; width: 4in; height: 6in; overflow: hidden; }
      body { 
        font-family: system-ui, -apple-system, sans-serif;
        display: flex; align-items: center; justify-content: center;
      }
      .label {
        width: 100%; height: 100%; padding: 0.4in;
        background: white;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; gap: 1rem;
      }
      .qr { width: 2.5in; height: 2.5in; margin-bottom: 0.5rem; }
      .meta { display: flex; flex-direction: column; gap: 0.5rem; }
      .num { font-size: 12pt; color: #666; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; font-weight: 700; }
      .name { font-size: 28pt; font-weight: 800; margin: 0; line-height: 1.1; word-wrap: break-word; }
      .loc { font-size: 16pt; color: #333; margin: 0; word-wrap: break-word; }
      .foot { font-size: 10pt; color: #888; margin: 0; margin-top: auto; }
      @media screen { 
        html, body { width: 100%; height: 100%; min-height: 100vh; overflow: auto; }
        .label { width: 4in; height: 6in; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px; margin: 2rem auto; } 
      }
      @media print { 
        html, body { width: 4in; height: 6in; overflow: hidden; background: white; }
        .label { padding: 0.25in; border-radius: 0; box-shadow: none; margin: 0; }
      }
    </style></head>
    <body>
      <div class="label">
        <img class="qr" src="${dataUrl}" alt="QR code" />
        <div class="meta">
          <p class="num">STORAGE BOX ${box.boxNumber ? `#${escape(box.boxNumber.slice(-4))}` : ""}</p>
          <h1 class="name">${escape(box.name)}</h1>
          <p class="loc">${escape(box.location)}</p>
        </div>
        <p class="foot">Scan with your phone camera to open this box in BoxTracker.</p>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
    </body></html>`);
  w.document.close();
}
