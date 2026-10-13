"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { FormState } from "@/app/actions";
import { LIMITS, SUGGESTED_TAGS, SURFACES, VANILLA_MAPS } from "@/lib/constants";
import { compressImage } from "@/lib/compress-image";
import { formatDistance } from "@/lib/format";
import { analyzeRace, type RouteAnalysis } from "@/lib/sharecode/analyze";
import { decodeShareCode } from "@/lib/sharecode/codec";
import { RouteMap } from "./route-map";

export type RouteFormInitial = {
  shareCode: string;
  title: string;
  description: string;
  surface: string;
  tags: string[];
  videoUrl: string;
  cornersOverride: number | null;
  mapKind: "vanilla" | "custom";
  vanillaMap: string;
  customMapName: string;
  customMapUrl: string;
  images: { id: string; url: string }[];
};

const EMPTY: RouteFormInitial = {
  shareCode: "",
  title: "",
  description: "",
  surface: "asphalt",
  tags: [],
  videoUrl: "",
  cornersOverride: null,
  mapKind: "vanilla",
  vanillaMap: "",
  customMapName: "",
  customMapUrl: "",
  images: [],
};

type Decoded = { ok: true; analysis: RouteAnalysis; name?: string } | { ok: false; error: string };

/** Decodes the pasted code in the browser (debounced) for the live preview. */
function useDecodedCode(code: string): Decoded | null {
  const trimmed = code.trim();
  const [result, setResult] = useState<{ code: string; decoded: Decoded } | null>(null);
  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let decoded: Decoded;
      try {
        const d = await decodeShareCode(trimmed);
        decoded = { ok: true, analysis: analyzeRace(d.payload), name: d.payload.name };
      } catch (e) {
        decoded = { ok: false, error: e instanceof Error ? e.message : "Invalid code." };
      }
      if (!cancelled) setResult({ code: trimmed, decoded });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed]);
  // A stale result for a previous code is never shown.
  return result && result.code === trimmed ? result.decoded : null;
}

function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {msg}
    </p>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-display text-2xl leading-none font-bold text-accent tabular-nums">{step}</span>
        <div>
          <h2 className="font-display text-xl leading-tight font-semibold uppercase">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function RouteForm({
  action,
  initial = EMPTY,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: RouteFormInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const errors = state.errors ?? {};

  const [code, setCode] = useState(initial.shareCode);
  const decoded = useDecodedCode(code);
  const [title, setTitle] = useState(initial.title);
  const titleTouched = useRef(!!initial.title);
  const [mapKind, setMapKind] = useState(initial.mapKind);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Prefill the title from the race's in-game name until the author types their own.
  useEffect(() => {
    if (decoded?.ok && decoded.name && !titleTouched.current) setTitle(decoded.name.slice(0, LIMITS.title));
  }, [decoded]);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const keptImages = initial.images.filter((i) => !removed.includes(i.id));
  const room = LIMITS.images - keptImages.length - files.length;
  const stats = decoded?.ok ? decoded.analysis.stats : null;
  const busy = pending || preparing;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    setFiles((cur) => [...cur, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const tagList = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const toggleTag = (t: string) => {
    const next = tagList.includes(t) ? tagList.filter((x) => x !== t) : [...tagList, t].slice(0, LIMITS.tags);
    setTags(next.join(", "));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("images");
    setPreparing(true);
    try {
      for (const f of files) fd.append("images", await compressImage(f.file));
    } finally {
      setPreparing(false);
    }
    startTransition(() => formAction(fd));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {state.message && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {state.message}
        </div>
      )}

      <Section step={1} title="Share code" hint="From the race editor’s “Copy Share Code” button.">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="shareCode" className="label">
              Race share code
            </label>
            <textarea
              id="shareCode"
              name="shareCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={9}
              spellCheck={false}
              placeholder="BJRACE1:H4sIAAAAAAAA…"
              aria-invalid={!!errors.shareCode || decoded?.ok === false}
              aria-describedby="shareCode-msg"
              className="field resize-y font-mono text-xs leading-relaxed break-all"
            />
            <FieldError id="shareCode-msg" msg={errors.shareCode ?? (decoded?.ok === false ? decoded.error : undefined)} />
          </div>
          <div className="flex min-h-56 flex-col rounded-lg border border-border bg-surface-2 p-3">
            {decoded?.ok ? (
              <>
                <RouteMap geometry={decoded.analysis.geometry} className="mx-auto w-full max-w-72" />
                <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                  {[
                    [stats!.loopable ? "Lap" : "Length", formatDistance(stats!.distanceM)],
                    ["Gates", stats!.checkpoints],
                    ["Corners", stats!.corners],
                    ["Grid", stats!.gridSlots],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <dt className="text-[10px] tracking-wide text-muted uppercase">{l}</dt>
                      <dd className="font-display text-lg font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1 text-center text-xs text-muted">
                  {stats!.loopable ? "Circuit" : "Sprint"}
                  {stats!.branching ? " · branching" : ""} · {stats!.elevationGainM} m climb
                </p>
              </>
            ) : (
              <p className="m-auto max-w-56 text-center text-sm text-muted">
                {code.trim() ? "Checking…" : "Preview appears here."}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section step={2} title="Map">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1 sm:w-96">
          {(["vanilla", "custom"] as const).map((k) => (
            <label key={k}>
              <input
                type="radio"
                name="mapKind"
                value={k}
                checked={mapKind === k}
                onChange={() => setMapKind(k)}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-md py-1.5 text-center text-sm text-text-2 peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {k === "vanilla" ? "Base-game map" : "Mod map"}
              </span>
            </label>
          ))}
        </div>
        {mapKind === "vanilla" ? (
          <div className="sm:w-96">
            <label htmlFor="vanillaMap" className="label">
              Map
            </label>
            <select
              id="vanillaMap"
              name="vanillaMap"
              defaultValue={initial.vanillaMap}
              aria-invalid={!!errors.vanillaMap}
              className="field"
            >
              <option value="" disabled>
                Choose a map…
              </option>
              {VANILLA_MAPS.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
            <FieldError msg={errors.vanillaMap} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customMapName" className="label">
                Map name
              </label>
              <input
                id="customMapName"
                name="customMapName"
                defaultValue={initial.customMapName}
                maxLength={LIMITS.mapName}
                placeholder="e.g. Nürburgring Nordschleife"
                aria-invalid={!!errors.customMapName}
                className="field"
              />
              <FieldError msg={errors.customMapName} />
            </div>
            <div>
              <label htmlFor="customMapUrl" className="label">
                Download link
              </label>
              <input
                id="customMapUrl"
                name="customMapUrl"
                type="url"
                defaultValue={initial.customMapUrl}
                placeholder="https://www.beamng.com/resources/…"
                aria-invalid={!!errors.customMapUrl}
                className="field"
              />
              <FieldError msg={errors.customMapUrl} />
            </div>
            <p className="text-sm text-muted sm:col-span-2">Same name as other routes on this map groups them together.</p>
          </div>
        )}
      </Section>

      <Section step={3} title="Details">
        <div className="grid gap-5">
          <div>
            <label htmlFor="title" className="label">
              Route name
            </label>
            <input
              id="title"
              name="title"
              value={title}
              onChange={(e) => {
                titleTouched.current = true;
                setTitle(e.target.value);
              }}
              maxLength={LIMITS.title}
              aria-invalid={!!errors.title}
              className="field"
            />
            <FieldError msg={errors.title} />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description <span className="font-normal tracking-normal text-muted normal-case">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={initial.description}
              rows={5}
              maxLength={LIMITS.description}
              placeholder="Cars, laps, tricky sections…"
              className="field"
            />
            <FieldError msg={errors.description} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="surface" className="label">
                Surface
              </label>
              <select id="surface" name="surface" defaultValue={initial.surface} className="field">
                {SURFACES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cornersOverride" className="label">
                Corners
              </label>
              <input
                id="cornersOverride"
                name="cornersOverride"
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
                defaultValue={initial.cornersOverride ?? ""}
                placeholder={stats ? `${stats.corners} (estimated)` : "Estimated"}
                aria-describedby="corners-hint"
                className="field"
              />
              <p id="corners-hint" className="mt-1.5 text-xs text-muted">
                Blank uses the estimate.
              </p>
              <FieldError msg={errors.cornersOverride} />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className="label">
              Tags <span className="font-normal tracking-normal text-muted normal-case">(up to {LIMITS.tags})</span>
            </label>
            <input
              id="tags"
              name="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rally, night, technical"
              className="field"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-pressed={tagList.includes(t)}
                  className="chip py-1 hover:border-border-strong aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-text"
                >
                  {tagList.includes(t) ? "✓ " : "+ "}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="videoUrl" className="label">
              Video link <span className="font-normal tracking-normal text-muted normal-case">(optional)</span>
            </label>
            <input
              id="videoUrl"
              name="videoUrl"
              type="url"
              defaultValue={initial.videoUrl}
              placeholder="https://youtu.be/…"
              aria-invalid={!!errors.videoUrl}
              className="field"
            />
            <FieldError msg={errors.videoUrl} />
          </div>
        </div>
      </Section>

      <Section
        step={4}
        title="Screenshots"
        hint={`Up to ${LIMITS.images}. The first is the cover.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {initial.images.map((img) => {
            const isRemoved = removed.includes(img.id);
            return (
              <div key={img.id} className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className={`aspect-video w-full object-cover ${isRemoved ? "opacity-30" : ""}`} />
                {isRemoved && <input type="hidden" name="removeImage" value={img.id} />}
                <button
                  type="button"
                  onClick={() =>
                    setRemoved((r) => (isRemoved ? r.filter((x) => x !== img.id) : [...r, img.id]))
                  }
                  className="absolute top-1.5 right-1.5 rounded-md bg-bg/85 px-2 py-0.5 text-xs font-medium backdrop-blur hover:bg-bg"
                >
                  {isRemoved ? "Undo" : "Remove"}
                </button>
              </div>
            );
          })}
          {files.map((f, i) => (
            <div key={f.url} className="relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}
                className="absolute top-1.5 right-1.5 rounded-md bg-bg/85 px-2 py-0.5 text-xs font-medium backdrop-blur hover:bg-bg"
              >
                Remove
              </button>
            </div>
          ))}
          {room > 0 && (
            <label
              className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong text-sm text-muted hover:border-accent hover:text-text"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              <span className="text-2xl leading-none" aria-hidden>
                +
              </span>
              <span>Add images</span>
              <input
                ref={fileInput}
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                onChange={(e) => addFiles(e.target.files)}
                className="sr-only"
              />
            </label>
          )}
        </div>
        <FieldError msg={errors.images} />
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {Object.keys(errors).length > 0 && (
          <p className="mr-auto text-sm text-danger" role="alert">
            Check the highlighted fields.
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5">
          {preparing ? "Preparing images…" : pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
