import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BookOpen, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function SopLibrary() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  const categoriesQuery = trpc.sops.categories.useQuery();
  const allSopsQuery = trpc.sops.all.useQuery();
  const reviewFlagsQuery = trpc.sops.myReviewFlags.useQuery();

  const categories = categoriesQuery.data ?? [];
  const allSops = allSopsQuery.data ?? [];
  const reviewFlags = reviewFlagsQuery.data ?? [];
  const flaggedIds = new Set(reviewFlags.filter((f: any) => !f.reviewedAt).map((f: any) => f.sopId));

  const filtered = allSops.filter(sop => {
    const matchesCat = selectedCat === null || sop.categoryId === selectedCat;
    const matchesSearch = search === "" ||
      sop.title.toLowerCase().includes(search.toLowerCase()) ||
      sop.content.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const grouped = categories.map(cat => ({
    ...cat,
    sops: filtered.filter(s => s.categoryId === cat.id),
  })).filter(cat => cat.sops.length > 0);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">SOP Library</h1>
          </div>
          <p className="text-muted-foreground text-sm">All standard operating procedures for Reformation Chiropractic</p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SOPs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedCat === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedCat === cat.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* SOP Groups */}
        {allSopsQuery.isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No SOPs found matching your search.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(cat => (
              <div key={cat.id}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{cat.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cat.sops.map(sop => {
                    const needsReview = flaggedIds.has(sop.id);
                    return (
                      <button
                        key={sop.id}
                        onClick={() => setLocation(`/sops/${sop.id}`)}
                        className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${needsReview ? "bg-secondary" : "bg-secondary"}`}>
                            {needsReview ? (
                              <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{sop.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              v{sop.version} · Updated {new Date(sop.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            {needsReview && (
                              <Badge className="mt-2 text-[10px] bg-secondary text-foreground border-border">Needs Re-Review</Badge>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
