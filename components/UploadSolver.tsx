"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Solution } from "@/lib/schema";
import { readFields, readTags, type ReadField } from "@/lib/readback";

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

type Read = { solution: Solution; template: Record<string, unknown> | null; saved: boolean | undefined; fields: ReadField[]; tags: string[] };

export function UploadSolver() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [checkError, setCheckError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  // leaving the page cancels a solve in flight, so it cannot redirect the student later
  useEffect(() => () => inflight.current?.abort(), []);
  // free the preview's object URL when it is replaced or the page closes
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2500); return () => clearTimeout(id); }, [toast]);
  // Escape closes the check dialog
  useEffect(() => {
    if (!read) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRead(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [read]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please choose an image (JPG, PNG or WEBP).");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setToast("Nice. Your question is ready to solve.");
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = ""; // so choosing the same file again fires onChange
  };

  const open = (sol: Solution, saved: boolean | undefined) => {
    sessionStorage.setItem("eu:custom", JSON.stringify(sol));
    // Pro lessons are saved to history; if that failed the lesson page says so
    if (saved === false) sessionStorage.setItem("eu:custom-unsaved", "1"); else sessionStorage.removeItem("eu:custom-unsaved");
    router.push("/solve/custom");
  };

  const solve = async () => {
    setError(null);
    setCode(null);
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      setBusy("Reading the numbers…");
      const image = file ? await toJpegBase64(file) : undefined;
      if (ctrl.signal.aborted) return;
      setBusy("Choosing the method…");
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
      if (ctrl.signal.aborted) return;
      const template = data.template && typeof data.template === "object" ? (data.template as Record<string, unknown>) : null;
      const fields = template ? readFields(template) : [];
      // nothing to check: go straight to the lesson
      if (!fields.length) return open(sol, data.saved);
      setRead({ solution: sol, template, saved: data.saved, fields, tags: template ? readTags(template) : [] });
      setEdits({});
      setCheckError(null);
      setBusy(null);
    } catch (e) {
      if (ctrl.signal.aborted) return; // the student left the page
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  /** "Looks right": open the lesson, re-solving in the browser first if the student corrected a number. */
  const confirm = async () => {
    if (!read) return;
    const changed = Object.keys(edits).filter((k) => edits[k] !== String(read.fields.find((f) => f.key === k)?.value));
    if (!changed.length || !read.template) return open(read.solution, read.saved);
    const next: Record<string, unknown> = { ...read.template };
    for (const k of changed) {
      const v = Number(edits[k]);
      if (!Number.isFinite(v)) return setCheckError("Please enter numbers only.");
      next[k] = v;
    }
    setCheckError(null);
    const { Template, solveTemplate } = await import("@/lib/geometry/solvers");
    const t = Template.safeParse(next);
    if (!t.success) return setCheckError("One of those numbers is out of range for this kind of problem.");
    const r = solveTemplate(t.data);
    if (!r.ok) return setCheckError(r.reason);
    // a corrected lesson was not the one saved to history
    open(r.solution, read.saved === undefined ? undefined : false);
  };

  return (
    <div className="uploadcard">
      <div className="uploadtitle">SCAN A QUESTION</div>
      <div
        className="uploadzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        role="button" tabIndex={0} aria-label="Choose or drop a photo of your problem"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Your problem" /> : (<><strong>Drop a photo here</strong>or choose one from your phone</>)}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {file && !busy && <button type="button" className="linkbtn" onClick={clear}>Remove photo</button>}
      {typing ? (
        <label className="field">
          <span>Type the question</span>
          <textarea value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
            placeholder="A line AB, 60 mm long, is inclined at 30° to the HP and 45° to the VP. Draw its projections." />
        </label>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setTyping(true)}>…or type it instead</button>
      )}
      <button className="btn btn-primary" disabled={!!busy || (!file && !text.trim())} onClick={solve} aria-live="polite">
        {busy ? <><span className="dots" aria-hidden="true"><i /><i /><i /></span>{busy}</> : "Solve it ↗"}
      </button>
      {error && (
        <p role="alert" className="callout">
          {error}{" "}
          {code === "login_required" && <Link href={"/login?next=" + encodeURIComponent("/#solve")} className="underline">Sign in</Link>}
          {code === "limit_reached" && <Link href="/pricing" className="underline">See Pro plans</Link>}
          {code !== "login_required" && code !== "limit_reached" && <> <Link href="/lessons" className="underline">Browse similar lessons</Link></>}
        </p>
      )}
      <p className="uploadhint">JPG · PNG · screenshot · handwritten works too</p>

      {read && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setRead(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="check-title">
            <div className="kicker" style={{ justifySelf: "start" }}><b />Check · is this right?</div>
            <h3 id="check-title">We read: <em>{read.solution.title}</em></h3>
            {read.tags.length > 0 && <div className="tags">{read.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
            <div className="readgrid">
              {read.fields.map((f) => {
                const v = edits[f.key] ?? String(f.value);
                return (
                  <label key={f.key} className="field">
                    <span>{f.label}{f.unit && ` (${f.unit})`}</span>
                    <input className={`input ${v !== String(f.value) ? "edited" : ""}`} inputMode="decimal" value={v}
                      onChange={(e) => setEdits((s) => ({ ...s, [f.key]: e.target.value }))} />
                  </label>
                );
              })}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Tap a number to fix a misread. Wrong kind of problem? Go back and type the question instead.</p>
            {checkError && <p role="alert" className="callout">{checkError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => { setRead(null); setTyping(true); }}>Back</button>
              <button className="btn btn-primary" onClick={() => void confirm()}>Looks right →</button>
            </div>
          </div>
        </div>
      )}
      <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </div>
  );
}
