import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Flame } from "lucide-react";

/**
 * Phase 1 gamification card for the trainee dashboard: rank + level, an XP bar
 * toward the next level, the daily streak, and badges (the next one to earn is
 * highlighted with a progress bar; already-earned badges show as a row).
 * Renders nothing for users without a training track (e.g. admins).
 */
export default function GamificationCard() {
  const utils = trpc.useUtils();
  const mine = trpc.gamification.mine.useQuery();
  const touch = trpc.gamification.touch.useMutation({
    onSuccess: () => utils.gamification.mine.invalidate(),
  });

  // Record activity once on load so the streak stays current.
  useEffect(() => {
    touch.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = mine.data;
  if (!g) return null;

  const levelPct = Math.round((g.xpIntoLevel / g.xpForLevel) * 100);
  const nextBadge = g.badges.find((b) => !b.earned);
  const earned = g.badges.filter((b) => b.earned);

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-border p-5 shadow-sm">
      {/* Rank + level + streak */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white grid place-items-center shrink-0">
          <div className="text-center leading-none">
            <div className="text-[9px] font-bold opacity-80 tracking-wider">LVL</div>
            <div className="text-lg font-extrabold">{g.level}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-foreground leading-tight">{g.rank}</div>
          <div className="text-xs text-muted-foreground">Next rank: {g.nextRank}</div>
        </div>
        <div className="text-center shrink-0 px-1">
          <Flame className={`h-5 w-5 mx-auto ${g.streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          <div className={`font-extrabold leading-none tabular-nums ${g.streak > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{g.streak}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">day{g.streak === 1 ? "" : "s"}</div>
        </div>
      </div>

      {/* XP bar toward next level */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span><b className="text-foreground tabular-nums">{g.totalXp.toLocaleString()}</b> XP</span>
          <span><b className="text-foreground tabular-nums">{g.xpToNext}</b> XP to Level {g.level + 1}</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
            style={{ width: `${levelPct}%` }}
          />
        </div>
      </div>

      {/* Next badge to earn */}
      {nextBadge && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{nextBadge.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Next badge · {nextBadge.name}</div>
              <div className="text-[11px] text-muted-foreground">{nextBadge.desc}</div>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
              {nextBadge.progress}/{nextBadge.target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-amber-200/60 dark:bg-amber-800/50 overflow-hidden mt-2">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.round((nextBadge.progress / nextBadge.target) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Earned badges */}
      {earned.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Earned</span>
          {earned.map((b) => (
            <span key={b.id} title={`${b.name} — ${b.desc}`} className="text-xl leading-none cursor-default">
              {b.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
