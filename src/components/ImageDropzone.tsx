import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 4 * 1024 * 1024; // keep in sync with products.attachImage

/**
 * Drag-and-drop product photo upload. Uploads straight to Convex file storage
 * and attaches the stored image to the product; replacing or removing deletes
 * the previous file server-side.
 */
export function ImageDropzone({
  productId,
  imageUrl,
  onAttached,
}: {
  productId: Id<"products">;
  imageUrl: string | null | undefined;
  onAttached?: () => void;
}) {
  const generateUploadUrl = useMutation(api.products.generateImageUploadUrl);
  const attachImage = useMutation(api.products.attachImage);
  const removeImage = useMutation(api.products.removeImage);

  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, WebP…).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Keep images under 4 MB.");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status}).`);
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await attachImage({ productId, storageId, clear: false });
      onAttached?.();
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not upload the image.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeImage({ productId });
      onAttached?.();
      toast("Photo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Product photo upload"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragOver
            ? "border-foreground bg-muted"
            : "border-border hover:border-foreground/40",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Product photo"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            <UploadCloud className="size-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm font-medium">Drop an image here</p>
            <p className="text-xs text-muted-foreground">
              or click to browse · PNG, JPG, WebP · up to 4 MB
            </p>
          </>
        )}
        {imageUrl && (
          <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
            Drop to replace or use the buttons below
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin text-foreground" />
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {productId && (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {imageUrl ? (
              <RefreshCcw className="mr-1.5 size-3.5" />
            ) : (
              <ImagePlus className="mr-1.5 size-3.5" />
            )}
            {imageUrl ? "Replace" : "Upload"}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
