"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleModelFavoriteAction } from "@/driplnk-web-backend/actions/library";

export function ModelFavoriteButton({ modelId }: { modelId: string }) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const next = !favorited;
    setFavorited(next);
    try {
      const res = await toggleModelFavoriteAction(modelId);
      if (res.success && typeof res.favorited === "boolean") {
        setFavorited(res.favorited);
      }
    } catch {
      setFavorited(!next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-raised transition-colors cursor-pointer"
    >
      <Heart
        className={`size-3.5 transition-colors ${
          favorited ? "fill-red-500 text-red-500" : "text-muted"
        }`}
      />
      <span>{favorited ? "Favorited" : "Favorite"}</span>
    </button>
  );
}
