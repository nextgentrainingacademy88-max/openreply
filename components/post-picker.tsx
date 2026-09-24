"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Post Picker
 *
 * Grid of Instagram post thumbnails, selectable.
 * Fetches from /api/instagram/posts.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ImageOff, Search } from "lucide-react";
import { readCache, writeCache } from "@/lib/client-cache";
import { Badge, Button, EmptyState, Input } from "@/components/ui";

const PAGE_SIZE = 60;

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

interface PostPickerProps {
  selectedPostId: string | null;
  instagramAccountId?: string | null;
  /** postId -> name of the campaign already using it. Flagged in the grid. */
  usedPostIds?: Record<string, string>;
  onSelect: (
    postId: string,
    postUrl?: string,
    thumbUrl?: string,
    caption?: string
  ) => void;
}

export default function PostPicker({
  selectedPostId,
  instagramAccountId,
  usedPostIds,
  onSelect,
}: PostPickerProps) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The post currently hovered — its video (if it's a reel) plays a preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The grid loads the whole library (all=true). On accounts with hundreds of
  // posts, rendering every tile at once is enough to make mobile Safari drop
  // the page, so they are revealed in batches.
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (instagramAccountId) {
      params.set("instagramAccountId", instagramAccountId);
    }
    // Load the full library so older posts/reels are selectable, not just the
    // most recent page.
    params.set("all", "true");

    // Show the cached library instantly (stale-while-revalidate), then refresh.
    const cacheKey = `ig-posts:${instagramAccountId ?? "default"}`;
    const cached = readCache<InstagramPost[]>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setPosts(cached.data);
      setLoading(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/instagram/posts${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setPosts(data.data);
          writeCache(cacheKey, data.data);
        } else if (!cached.data) {
          setError(data.error ?? "Failed to load posts");
        }
      })
      .catch(() => {
        if (!cancelled && !cached.data) setError("Failed to load posts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instagramAccountId]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load your posts"
        description={
          <>
            {error}
            <br />
            Connect your Instagram account first.
          </>
        }
      />
    );
  }

  if (posts.length === 0) {
    return <EmptyState icon={ImageOff} title="No posts found" />;
  }

  const matching = query.trim()
    ? posts.filter((p) =>
        (p.caption ?? "").toLowerCase().includes(query.trim().toLowerCase())
      )
    : posts;

  const visible = matching.slice(0, shown);
  const remaining = matching.length - visible.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Back to one batch on every new search. Without this, a grid
              // expanded under an earlier query stays expanded once it is
              // cleared, which is the case this whole change exists to avoid.
              setShown(PAGE_SIZE);
            }}
            placeholder="Search your posts by caption…"
            aria-label="Search your posts by caption"
            className="pl-10"
          />
        </div>
        <Badge tone="neutral" className="shrink-0">
          {posts.length}
        </Badge>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No posts match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <>
          {usedPostIds && Object.keys(usedPostIds).length > 0 && (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-warning/50" />
              Already used
            </p>
          )}
          {/* auto-rows-min + content-start keep each row at its natural height.
              Without them the rows share out max-h-64 instead of scrolling, and
              the square thumbnails flatten into strips. */}
          <div className="grid max-h-64 auto-rows-min grid-cols-3 content-start gap-2 overflow-y-auto p-1 sm:grid-cols-4">
            {visible.map((post) => {
              const isSelected = selectedPostId === post.id;
              const usedByName = usedPostIds?.[post.id];
              const isUsed = Boolean(usedByName) && !isSelected;
              const thumb = post.thumbnail_url ?? post.media_url;
              const isVideo = post.media_type === "VIDEO";
              const showVideo =
                isVideo && hoveredId === post.id && Boolean(post.media_url);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onSelect(post.id, post.permalink, thumb, post.caption)}
                  onMouseEnter={() => setHoveredId(post.id)}
                  onMouseLeave={() =>
                    setHoveredId((cur) => (cur === post.id ? null : cur))
                  }
                  aria-pressed={isSelected}
                  aria-label={post.caption?.slice(0, 60) ?? "Select Instagram post"}
                  title={isUsed ? `Already used by "${usedByName}"` : undefined}
                  className={`
                    relative aspect-square overflow-hidden rounded-xl border-2 transition-colors
                    ${
                      isSelected
                        ? "border-accent"
                        : isUsed
                          ? "border-warning/40 hover:border-warning/60"
                          : "border-border hover:border-border-hover"
                    }
                  `}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={post.caption?.slice(0, 50) ?? "Instagram post"}
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover ${isUsed ? "opacity-75" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-2">
                      <span className="text-xs text-muted">No image</span>
                    </div>
                  )}
                  {showVideo && (
                    <video
                      src={post.media_url}
                      poster={thumb}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="none"
                      className={`absolute inset-0 h-full w-full object-cover ${
                        isUsed ? "opacity-60" : ""
                      }`}
                    />
                  )}
                  {isSelected && (
                    <span className="absolute inset-x-0 bottom-0 bg-accent py-1 text-xs font-semibold text-accent-foreground">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {remaining > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="w-full"
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
