"use client";

import { useRef, useState, useTransition } from "react";
import { uploadFlavorPhotoAction } from "../actions";

/** Shrinks phone photos (often 4–8 MB) to a ~900px WebP in the browser before upload. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85)); // Safari fallback
}

export function PhotoUpload({ flavorId, hasPhoto }: { flavorId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    start(async () => {
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set("id", flavorId);
        fd.set("photo", new File([blob], `photo.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
        const res = await uploadFlavorPhotoAction(null, fd);
        if (res?.to) window.location.assign(res.to);
      } catch {
        setErr("Couldn't read that photo. Try a JPG or PNG.");
      }
    });
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={onPick} aria-label="Choose cookie photo" />
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={pending}>
        {pending ? "Uploading…" : hasPhoto ? "Replace photo" : "Add photo"}
      </button>
      {err && <p className="mt-1 text-xs font-semibold text-berry">{err}</p>}
    </div>
  );
}
