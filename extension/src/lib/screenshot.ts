/**
 * Downscale captureVisibleTab JPEG via OffscreenCanvas (MV3 service-worker safe).
 * Max width 640px, quality 0.7.
 */

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

export async function downscaleDataUrl(
  dataUrl: string,
  maxWidth = 640,
  quality = 0.7
): Promise<{ dataUrl: string; base64: string; contentType: "image/jpeg" }> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  let w = bitmap.width;
  let h = bitmap.height;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("OffscreenCanvas 2d unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const buf = await out.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  const outUrl = `data:image/jpeg;base64,${base64}`;
  return { dataUrl: outUrl, base64, contentType: "image/jpeg" };
}

export async function captureAndDownscale(
  windowId: number
): Promise<{ dataUrl: string; base64: string; contentType: "image/jpeg" } | null> {
  try {
    const raw = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 80,
    });
    if (!raw) return null;
    return await downscaleDataUrl(raw, 640, 0.7);
  } catch (err) {
    console.warn("captureVisibleTab failed", err);
    return null;
  }
}

export { dataUrlToBase64 };
