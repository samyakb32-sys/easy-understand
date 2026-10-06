"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Solution } from "@/lib/schema";

/** Shrinks a photo so a phone picture doesn't become a 10 MB upload. Returns base64 JPEG without the prefix. */
async function toJpegBase64(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function UploadSolver() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please choose an image (JPG, PNG or WEBP).");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const solve = async () => {
    setError(null);
    setCode(null);
    try {
      setBusy("Reading your drawing…");
      const image = file ? await toJpegBase64(file) : undefined;
      setBusy("Planning the steps…");
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mediaType: image ? "image/jpeg" : undefined, text: text || undefined }),
      });
      const data = await res.json();
      if (!data.ok) { setCode(data.code ?? null); throw new Error(data.reason ?? "Could not solve this problem."); }
      const sol = Solution.parse(data.solution);
      sessionStorage.setItem("eu:custom", JSON.stringify(sol));
      router.push("/solve/custom");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  return (
    <div className="upload-card">
      <div
        className={`dropzone ${preview ? "has" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        role="button" tabIndex={0} aria-label="Choose or drop a photo of your problem"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Your problem" className="max-h-64 rounded" /> : (
          <>
            <div className="dz-icon" aria-hidden="true">⬆</div>
            <strong>Drop a photo of your problem</strong>
            <span className="muted">or tap to choose · camera works on phones</span>
          </>
        )}
        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <label className="field">
        <span>…or type it</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="A line AB, 60 mm long, is inclined at 30° to the HP and 45° to the VP. Draw its projections." />
      </label>
      <button className="btn btn-primary w-full" disabled={!!busy || (!file && !text.trim())} onClick={solve}>
        {busy ?? "Solve and teach me"}
      </button>
      {error && (
        <p role="alert" className="callout">
          {error}{" "}
          {code === "login_required" && <Link href={"/login?next=" + encodeURIComponent("/#upload")} className="underline">Sign in</Link>}
          {code === "limit_reached" && <Link href="/#pricing" className="underline">See Pro plans</Link>}
        </p>
      )}
      <p className="muted text-xs">Supports projection of lines, pentagon construction, cylinder development, prism views, isometric views of prisms and cylinders, and sections of prisms, pyramids, cylinders and cones. More problem types are on the way.</p>
    </div>
  );
}
