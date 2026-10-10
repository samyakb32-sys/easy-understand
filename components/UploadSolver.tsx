"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Solution } from "@/lib/schema";

/** The server rejects longer text (app/api/solve/route.ts), so the box stops at the same length. */
const MAX_TEXT = 4000;

/** Shrinks a photo so a phone picture doesn't become a 10 MB upload. Returns base64 JPEG without the prefix. */
async function toJpegBase64(file: File, max = 1600): Promise<string> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("This browser can't read that image. Please use a JPG, PNG or WEBP photo.");
  }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!;
  // JPEG has no alpha: without a white ground, transparent PNG/WEBP pixels turn black and dark linework vanishes
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
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
  const inflight = useRef<AbortController | null>(null);

  // leaving the page cancels a solve in flight, so it cannot redirect the student later
  useEffect(() => () => inflight.current?.abort(), []);
  // free the preview's object URL when it is replaced or the page closes
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please choose an image (JPG, PNG or WEBP).");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = ""; // so choosing the same file again fires onChange
  };

  const solve = async () => {
    setError(null);
    setCode(null);
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      setBusy("Reading your drawing…");
      const image = file ? await toJpegBase64(file) : undefined;
      if (ctrl.signal.aborted) return;
      setBusy("Planning the steps…");
      const res = await fetch("/api/solve", {
        signal: ctrl.signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mediaType: image ? "image/jpeg" : undefined, text: text || undefined }),
      });
      // a platform timeout or an oversized upload answers with plain text or HTML, not our JSON
      const data = await res.json().catch(() => null);
      if (!data) throw new Error(res.status === 413 ? "That photo is too large. Try a smaller photo, or type the problem." : "The server took too long or had a problem. Please try again in a moment.");
      if (!data.ok) { setCode(data.code ?? null); throw new Error(data.reason ?? "Could not solve this problem."); }
      const sol = Solution.parse(data.solution);
      sessionStorage.setItem("eu:custom", JSON.stringify(sol));
      // Pro lessons are saved to history; if that failed the lesson page says so
      if (data.saved === false) sessionStorage.setItem("eu:custom-unsaved", "1"); else sessionStorage.removeItem("eu:custom-unsaved");
      if (ctrl.signal.aborted) return;
      router.push("/solve/custom");
    } catch (e) {
      if (ctrl.signal.aborted) return; // the student left the page
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
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {file && !busy && <button type="button" className="btn w-full" onClick={clear}>Remove photo</button>}
      <label className="field">
        <span>…or type it</span>
        <textarea value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} rows={3}
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
      <p className="muted text-xs">Supports projection of lines, pentagon construction, ellipse, parabola and hyperbola by the eccentricity method, views and isometric views of prisms, cylinders, cones, spheres, hemispheres and stacks of them (composite solids), solids side by side, with a drilled hole or with a corner notch, projection of planes and of solids (inclined to the HP or VP first, or to both), sections of prisms, pyramids, cylinders and cones (including parabola and hyperbola sections of a cone), interpenetration of a cylinder, cone or square prism by a horizontal cylinder (including an off-centre one), and development of cylinders, cones, prisms and pyramids. More problem types are on the way.</p>
    </div>
  );
}
