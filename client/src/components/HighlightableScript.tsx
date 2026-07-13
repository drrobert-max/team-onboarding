import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Highlighter, X } from "lucide-react";
import { toast } from "sonner";

const HIGHLIGHT_COLORS: { name: string; value: string; bg: string; border: string }[] = [
  { name: "Yellow", value: "yellow", bg: "bg-yellow-200 dark:bg-yellow-400/40", border: "border-yellow-400" },
  { name: "Green", value: "green", bg: "bg-green-200 dark:bg-green-400/40", border: "border-green-400" },
  { name: "Blue", value: "blue", bg: "bg-blue-200 dark:bg-blue-400/40", border: "border-blue-400" },
  { name: "Pink", value: "pink", bg: "bg-pink-200 dark:bg-pink-400/40", border: "border-pink-400" },
  { name: "Orange", value: "orange", bg: "bg-orange-200 dark:bg-orange-400/40", border: "border-orange-400" },
];

function colorToBg(color: string): string {
  const c = HIGHLIGHT_COLORS.find((c) => c.value === color);
  return c ? c.bg : "bg-yellow-200 dark:bg-yellow-400/40";
}

interface Highlight {
  id: number;
  startOffset: number;
  endOffset: number;
  color: string;
  selectedText: string;
}

interface HighlightableScriptProps {
  moduleId: number;
  userId: number;
  content: string;
}

export function HighlightableScript({ moduleId, userId, content }: HighlightableScriptProps) {
  const utils = trpc.useUtils();
  const [activeColor, setActiveColor] = useState("yellow");
  const [showToolbar, setShowToolbar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: highlights = [] } = trpc.highlights.getAll.useQuery(
    { moduleId },
    { enabled: userId > 0 && moduleId > 0 }
  );

  const saveHighlight = trpc.highlights.save.useMutation({
    onSuccess: () => utils.highlights.getAll.invalidate({ moduleId }),
    onError: () => toast.error("Failed to save highlight."),
  });

  const deleteHighlight = trpc.highlights.delete.useMutation({
    onSuccess: () => utils.highlights.getAll.invalidate({ moduleId }),
    onError: () => toast.error("Failed to remove highlight."),
  });

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    if (!containerRef.current) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;

    // Verify selection is within our container
    if (!container.contains(range.commonAncestorContainer)) return;

    // Calculate offsets relative to the container's text content
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + range.toString().length;
    const selectedText = range.toString().trim();

    if (!selectedText || endOffset <= startOffset) return;

    saveHighlight.mutate({ moduleId, startOffset, endOffset, color: activeColor, selectedText });
    selection.removeAllRanges();
  }, [activeColor, moduleId, saveHighlight]);

  // Build rendered content with highlights applied
  const renderWithHighlights = useCallback(() => {
    if (!highlights.length) return content;

    // Sort highlights by start, merge overlapping
    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

    let result = "";
    let cursor = 0;

    for (const h of sorted) {
      if (h.startOffset < cursor) continue; // skip overlapping
      // Text before highlight
      result += escapeHtml(content.slice(cursor, h.startOffset));
      // Highlighted text
      const bgClass = colorToBg(h.color);
      result += `<mark data-hid="${h.id}" class="highlight-mark ${bgClass} rounded px-0.5 cursor-pointer" title="Click to remove">${escapeHtml(content.slice(h.startOffset, h.endOffset))}</mark>`;
      cursor = h.endOffset;
    }
    result += escapeHtml(content.slice(cursor));
    return result;
  }, [content, highlights]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest("[data-hid]");
    if (mark) {
      const hid = parseInt(mark.getAttribute("data-hid") ?? "0");
      if (hid) deleteHighlight.mutate({ id: hid });
    }
  }, [deleteHighlight]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowToolbar((v) => !v)}
          className="flex items-center gap-1.5 text-xs"
        >
          <Highlighter className="h-3.5 w-3.5" />
          Highlight
        </Button>
        {showToolbar && (
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg border bg-card shadow-sm">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setActiveColor(c.value)}
                title={c.name}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${c.bg} ${
                  activeColor === c.value ? `${c.border} scale-125` : "border-transparent"
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1 mr-1">Select text to highlight · Click highlight to remove</span>
            <button onClick={() => setShowToolbar(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {highlights.length > 0 && (
          <span className="text-xs text-muted-foreground">{highlights.length} highlight{highlights.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Script content */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick}
        className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-mono select-text"
        dangerouslySetInnerHTML={{ __html: renderWithHighlights() }}
      />
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
