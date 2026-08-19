// ─── Track archive workbook ───────────────────────────────────────────────────
// Builds the "hard copy" Excel archive of every training track: a Read Me tab,
// a Summary, one tab per track (every module with its instructions, links, SOP,
// and quiz flag), and a Quizzes tab with full questions. Downloaded on demand
// from the admin dashboard so the archive is always current.
import ExcelJS from "exceljs";
import * as db from "./db";

const GREEN = "FF2D5016";
const LIGHT = "FFEAF1E4";
const WHITE = "FFFFFFFF";

const ROLE_SHEET: Record<string, string> = {
  ca: "CA",
  scan_tech: "Scan Tech",
  associate_doctor: "Associate Doctor",
  preceptor: "Preceptor",
};
const ROLE_ORDER = ["ca", "scan_tech", "associate_doctor", "preceptor"];

function header(ws: ExcelJS.Worksheet, cols: { name: string; width: number }[]) {
  ws.columns = cols.map((c) => ({ width: c.width }));
  const row = ws.addRow(cols.map((c) => c.name));
  row.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.alignment = { vertical: "top" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function buildTrackArchive(): Promise<{ buffer: Buffer; filename: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const wb = new ExcelJS.Workbook();
  const base = { name: "Arial", size: 10 } as const;

  // ── Read Me ──
  const rm = wb.addWorksheet("Read Me");
  rm.columns = [{ width: 4 }, { width: 100 }];
  const put = (text: string, opts: { title?: boolean; head?: boolean } = {}) => {
    const row = rm.addRow(["", text]);
    const cell = row.getCell(2);
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.font = opts.title
      ? { name: "Arial", bold: true, size: 16, color: { argb: GREEN } }
      : opts.head
        ? { name: "Arial", bold: true, size: 11, color: { argb: GREEN } }
        : { name: "Arial", size: 11 };
    if (text.length > 95) row.height = 15 * (Math.floor(text.length / 95) + 1);
  };
  put("Reformation Training Hub — Track Archive", { title: true });
  put(`Snapshot of every training track in the Training Hub, generated ${date}. Saved for safekeeping — the live source of truth is the Hub itself.`);
  put("");
  put("What's in it", { head: true });
  put("• Summary — all tracks at a glance");
  put("• CA, Scan Tech, Associate Doctor, Preceptor — one tab per track: every module, week by week, with its instructions, video links, audio, attached SOP, and quiz flag");
  put("• Quizzes — every quiz question with the answer options and the correct answer");
  put("");
  put("How to get an updated copy (one click)", { head: true });
  put("1.  Log in to the Training Hub as an admin.");
  put("2.  Go to Admin (dashboard) and click \"Download Track Archive\".");
  put("3.  A fresh copy of this workbook downloads with today's date — save it to the Google Drive folder alongside the old one.");
  put("");
  put("When to refresh it", { head: true });
  put("Whenever you've made a meaningful batch of changes to the tracks — added or removed modules, changed instructions, swapped videos, added quizzes. Every month or two is plenty otherwise.");
  put("");
  put("Important to understand", { head: true });
  put("• Editing THIS spreadsheet does NOT change the app. It's a reference copy only. To change actual training content, use the Hub's Track Editor (Admin → Tracks) or ask Claude.");
  put("• The live source of truth is the Training Hub's database. This file is your offline / off-site backup of the content.");

  // ── Gather data ──
  const sops = await db.getAllSops();
  const sopTitle = new Map(sops.map((s: any) => [s.id, s.title]));
  const tracks = (await db.getTracks()).sort((a: any, b: any) => {
    const ai = ROLE_ORDER.indexOf(a.teamRole); const bi = ROLE_ORDER.indexOf(b.teamRole);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  type Mod = any;
  const trackData: { track: any; milestones: { ms: any; mods: Mod[] }[] }[] = [];
  for (const t of tracks) {
    const milestones = await db.getMilestonesByTrack(t.id);
    const out: { ms: any; mods: Mod[] }[] = [];
    for (const ms of milestones) out.push({ ms, mods: await db.getModulesByMilestone(ms.id) });
    trackData.push({ track: t, milestones: out });
  }

  // ── Summary ──
  const sum = wb.addWorksheet("Summary");
  header(sum, [
    { name: "Track", width: 32 }, { name: "Team Role", width: 18 },
    { name: "Weeks / Milestones", width: 20 }, { name: "Modules", width: 12 },
    { name: "Modules with Quizzes", width: 20 },
  ]);
  let total = 0;
  for (const td of trackData) {
    const mods = td.milestones.flatMap((m) => m.mods);
    total += mods.length;
    const row = sum.addRow([td.track.name, td.track.teamRole, td.milestones.length, mods.length, mods.filter((m) => m.quizEnabled).length]);
    row.eachCell((c) => (c.font = { ...base }));
  }
  const totRow = sum.addRow(["Total", "", "", total, ""]);
  totRow.eachCell((c) => (c.font = { name: "Arial", size: 10, bold: true }));

  // ── Per-track sheets ──
  for (const td of trackData) {
    const ws = wb.addWorksheet((ROLE_SHEET[td.track.teamRole] ?? td.track.name).slice(0, 31));
    header(ws, [
      { name: "Week / Milestone", width: 26 }, { name: "Module", width: 42 },
      { name: "Type", width: 9 }, { name: "Required", width: 9 },
      { name: "Instructions / Description", width: 70 }, { name: "Video Link(s)", width: 45 },
      { name: "Audio Files", width: 40 }, { name: "Attached SOP", width: 34 }, { name: "Quiz", width: 6 },
    ]);
    for (const { ms, mods } of td.milestones) {
      const msRow = ws.addRow([`${ms.title}  (Week ${ms.weekNumber})`]);
      msRow.eachCell({ includeEmpty: false }, (c) => {
        c.font = { name: "Arial", size: 10, bold: true, color: { argb: GREEN } };
      });
      for (let i = 1; i <= 9; i++) {
        msRow.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      }
      for (const m of mods) {
        const text = [m.description, m.taskInstructions].filter(Boolean).join("\n\n");
        const vids = [m.loomUrl, m.loomUrl2].filter(Boolean).join("\n");
        const audio = (m.audioFiles ?? []).map((a: any) => `${a.label}: ${a.url}`).join("\n");
        const row = ws.addRow([
          ms.title, m.title, m.type, m.isRequired ? "Yes" : "No",
          text, vids, audio, m.sopId ? (sopTitle.get(m.sopId) ?? "") : "",
          m.quizEnabled ? "Yes" : "",
        ]);
        row.eachCell({ includeEmpty: true }, (c, col) => {
          c.font = { ...base };
          c.alignment = col >= 5 && col <= 7 ? { wrapText: true, vertical: "top" } : { vertical: "top" };
        });
      }
    }
  }

  // ── Quizzes ──
  const qs = wb.addWorksheet("Quizzes");
  header(qs, [
    { name: "Track", width: 16 }, { name: "Module", width: 40 }, { name: "Passing %", width: 10 },
    { name: "#", width: 4 }, { name: "Question", width: 70 },
    { name: "Answer Options", width: 70 }, { name: "Correct Answer", width: 50 },
  ]);
  for (const td of trackData) {
    for (const { mods } of td.milestones) {
      for (const m of mods) {
        if (!m.quizEnabled) continue;
        const quiz = await db.getQuizByModuleId(m.id);
        if (!quiz) continue;
        let questions: any = quiz.questions;
        if (typeof questions === "string") { try { questions = JSON.parse(questions); } catch { continue; } }
        if (!Array.isArray(questions)) continue;
        questions.forEach((q: any, i: number) => {
          const opts: string[] = q.options ?? [];
          const letters = opts.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`);
          const ci = q.correctIndex;
          const correct = Number.isInteger(ci) && ci >= 0 && ci < opts.length ? `${String.fromCharCode(65 + ci)}. ${opts[ci]}` : "";
          const row = qs.addRow([
            ROLE_SHEET[td.track.teamRole] ?? td.track.name, m.title, quiz.passingScore ?? 70,
            i + 1, q.question ?? "", letters.join("\n"), correct,
          ]);
          row.eachCell({ includeEmpty: true }, (c, col) => {
            c.font = { ...base };
            c.alignment = col >= 5 ? { wrapText: true, vertical: "top" } : { vertical: "top" };
          });
        });
      }
    }
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `Reformation-Training-Tracks-${date}.xlsx` };
}
