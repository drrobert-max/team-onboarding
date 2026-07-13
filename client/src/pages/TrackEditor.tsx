import AppLayout from "@/components/AppLayout";
import TrackPreviewModal from "@/components/TrackPreviewModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Video,
  FileText,
  CheckSquare,
  List,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ModuleType = "sop" | "video" | "task" | "checklist";

const MODULE_TYPE_ICONS: Record<ModuleType, React.ReactNode> = {
  video: <Video className="h-3.5 w-3.5" />,
  sop: <FileText className="h-3.5 w-3.5" />,
  task: <CheckSquare className="h-3.5 w-3.5" />,
  checklist: <List className="h-3.5 w-3.5" />,
};

const MODULE_TYPE_COLORS: Record<ModuleType, string> = {
  video: "bg-blue-100 text-blue-700",
  sop: "bg-purple-100 text-purple-700",
  task: "bg-amber-100 text-amber-700",
  checklist: "bg-green-100 text-green-700",
};

interface EditModuleState {
  moduleId: number;
  title: string;
  description: string;
  type: ModuleType;
  loomUrl: string;
  loomUrl2: string;
  taskInstructions: string;
  isRequired: boolean;
  quizEnabled: boolean;
  milestoneId: number;
}

export default function TrackEditor() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const tracksQuery = trpc.tracks.all.useQuery();
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Track editing
  const [editingTrackName, setEditingTrackName] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");

  // Week dialogs
  const [addWeekOpen, setAddWeekOpen] = useState(false);
  const [newWeekTitle, setNewWeekTitle] = useState("");
  const [newWeekDesc, setNewWeekDesc] = useState("");
  const [editWeekId, setEditWeekId] = useState<number | null>(null);
  const [editWeekTitle, setEditWeekTitle] = useState("");
  const [editWeekDesc, setEditWeekDesc] = useState("");
  const [deleteWeekId, setDeleteWeekId] = useState<number | null>(null);

  // Module dialogs
  const [addModuleWeekId, setAddModuleWeekId] = useState<number | null>(null);
  const [newModTitle, setNewModTitle] = useState("");
  const [newModType, setNewModType] = useState<ModuleType>("video");
  const [newModDesc, setNewModDesc] = useState("");
  const [newModLoom, setNewModLoom] = useState("");
  const [newModInstructions, setNewModInstructions] = useState("");

  // Module edit dialog
  const [editingModule, setEditingModule] = useState<EditModuleState | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<number | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");

  // Drag state for reordering
  const dragWeekRef = useRef<{ id: number; idx: number } | null>(null);
  const dragModRef = useRef<{ id: number; milestoneId: number; idx: number } | null>(null);

  const trackQuery = trpc.tracks.adminTrack.useQuery(
    { trackId: selectedTrackId! },
    { enabled: selectedTrackId !== null }
  );

  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.tracks.adminTrack.invalidate({ trackId: selectedTrackId! });
    utils.tracks.all.invalidate();
  };

  const updateTrack = trpc.tracks.updateTrack.useMutation({ onSuccess: () => { toast.success("Track updated"); invalidate(); setEditingTrackName(false); }, onError: e => toast.error(e.message) });
  const addWeek = trpc.tracks.addWeek.useMutation({ onSuccess: () => { toast.success("Week added"); invalidate(); setAddWeekOpen(false); setNewWeekTitle(""); setNewWeekDesc(""); }, onError: e => toast.error(e.message) });
  const updateWeek = trpc.tracks.updateWeek.useMutation({ onSuccess: () => { toast.success("Week updated"); invalidate(); setEditWeekId(null); }, onError: e => toast.error(e.message) });
  const deleteWeek = trpc.tracks.deleteWeek.useMutation({ onSuccess: () => { toast.success("Week deleted"); invalidate(); setDeleteWeekId(null); }, onError: e => toast.error(e.message) });
  const addModule = trpc.tracks.addModule.useMutation({ onSuccess: () => { toast.success("Module added"); invalidate(); setAddModuleWeekId(null); setNewModTitle(""); setNewModType("video"); setNewModDesc(""); setNewModLoom(""); setNewModInstructions(""); }, onError: e => toast.error(e.message) });
  const updateModule = trpc.tracks.updateModule.useMutation({ onSuccess: () => { toast.success("Module saved"); invalidate(); setEditingModule(null); }, onError: e => toast.error(e.message) });
  const deleteModule = trpc.tracks.deleteModule.useMutation({ onSuccess: () => { toast.success("Module deleted"); invalidate(); setDeleteModuleId(null); }, onError: e => toast.error(e.message) });
  const reorderWeeks = trpc.tracks.reorderWeeks.useMutation({ onSuccess: () => invalidate() });
  const reorderModules = trpc.tracks.reorderModules.useMutation({ onSuccess: () => invalidate() });

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (tracksQuery.data && tracksQuery.data.length > 0 && selectedTrackId === null) {
      setSelectedTrackId(tracksQuery.data[0].id);
    }
  }, [tracksQuery.data, selectedTrackId]);

  useEffect(() => {
    if (trackQuery.data) {
      setTrackName(trackQuery.data.name);
      setTrackDesc(trackQuery.data.description ?? "");
      // Expand all weeks by default
      setExpandedWeeks(new Set(trackQuery.data.milestones.map(m => m.id)));
    }
  }, [trackQuery.data?.id]);

  if (loading) return null;

  const track = trackQuery.data;
  const tracks = tracksQuery.data ?? [];

  const toggleWeek = (id: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Drag-and-drop for weeks
  const handleWeekDragStart = (e: React.DragEvent, id: number, idx: number) => {
    dragWeekRef.current = { id, idx };
    e.dataTransfer.effectAllowed = "move";
  };
  const handleWeekDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (!dragWeekRef.current || !track) return;
    const milestones = [...track.milestones];
    const from = dragWeekRef.current.idx;
    if (from === targetIdx) return;
    const [moved] = milestones.splice(from, 1);
    milestones.splice(targetIdx, 0, moved);
    reorderWeeks.mutate({ orderedIds: milestones.map(m => m.id) });
    dragWeekRef.current = null;
  };

  // Drag-and-drop for modules
  const handleModDragStart = (e: React.DragEvent, id: number, milestoneId: number, idx: number) => {
    dragModRef.current = { id, milestoneId, idx };
    e.dataTransfer.effectAllowed = "move";
  };
  const handleModDrop = (e: React.DragEvent, milestoneId: number, targetIdx: number) => {
    e.preventDefault();
    if (!dragModRef.current || !track) return;
    if (dragModRef.current.milestoneId !== milestoneId) return; // cross-week not supported via drag
    const ms = track.milestones.find(m => m.id === milestoneId);
    if (!ms) return;
    const mods = [...ms.modules];
    const from = dragModRef.current.idx;
    if (from === targetIdx) return;
    const [moved] = mods.splice(from, 1);
    mods.splice(targetIdx, 0, moved);
    reorderModules.mutate({ orderedIds: mods.map(m => m.id) });
    dragModRef.current = null;
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Track Editor</h1>
            <p className="text-muted-foreground text-sm mt-1">Edit training tracks, weeks, and modules</p>
          </div>
          {selectedTrackId !== null && (
            <Button variant="outline" onClick={() => setPreviewOpen(true)} className="shrink-0">
              <Eye className="h-4 w-4 mr-2" /> Preview as Trainee
            </Button>
          )}
        </div>

        {/* Track Selector */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {tracks.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTrackId(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                selectedTrackId === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {trackQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {track && (
          <>
            {/* Track Name/Description */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {editingTrackName ? (
                    <div className="flex-1 flex flex-col gap-2 mr-4">
                      <Input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Track name" className="font-semibold" />
                      <Textarea value={trackDesc} onChange={e => setTrackDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="text-sm" />
                    </div>
                  ) : (
                    <div>
                      <CardTitle className="text-base">{track.name}</CardTitle>
                      {track.description && <p className="text-sm text-muted-foreground mt-1">{track.description}</p>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 shrink-0">
                    {editingTrackName ? (
                      <>
                        <Button size="sm" onClick={() => updateTrack.mutate({ trackId: track.id, name: trackName, description: trackDesc })} disabled={updateTrack.isPending}>
                          <Save className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTrackName(false)}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingTrackName(true)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{track.milestones.length} weeks</span>
                  <span>{track.milestones.reduce((sum, ms) => sum + ms.modules.length, 0)} modules</span>
                </div>
              </CardContent>
            </Card>

            {/* Module Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={moduleSearch}
                onChange={e => {
                  setModuleSearch(e.target.value);
                  if (e.target.value.trim()) {
                    // Auto-expand all weeks when searching
                    setExpandedWeeks(new Set(track.milestones.map(ms => ms.id)));
                  }
                }}
                placeholder="Search modules…"
                className="pl-9 pr-9"
              />
              {moduleSearch && (
                <button
                  onClick={() => setModuleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Weeks */}
            <div className="space-y-3 mb-6">
              {track.milestones.map((ms, msIdx) => {
                const filteredModules = moduleSearch.trim()
                  ? ms.modules.filter(mod => mod.title.toLowerCase().includes(moduleSearch.toLowerCase()))
                  : ms.modules;
                const hasMatch = !moduleSearch.trim() || filteredModules.length > 0;
                if (!hasMatch) return null;
                return (
                <div
                  key={ms.id}
                  draggable
                  onDragStart={e => handleWeekDragStart(e, ms.id, msIdx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleWeekDrop(e, msIdx)}
                  className="border border-border rounded-xl bg-card overflow-hidden"
                >
                  {/* Week Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                    <button onClick={() => toggleWeek(ms.id)} className="flex items-center gap-2 flex-1 text-left">
                      {expandedWeeks.has(ms.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-semibold text-sm text-foreground">{ms.title}</span>
                      <Badge variant="outline" className="text-xs ml-1">Week {ms.weekNumber}</Badge>
                      <span className="text-xs text-muted-foreground ml-1">{ms.modules.length} modules</span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditWeekId(ms.id); setEditWeekTitle(ms.title); setEditWeekDesc(ms.description ?? ""); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setDeleteWeekId(ms.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Modules */}
                  {expandedWeeks.has(ms.id) && (
                    <div className="divide-y divide-border">
                      {filteredModules.map((mod, modIdx) => (
                        <div
                          key={mod.id}
                          draggable
                          onDragStart={e => handleModDragStart(e, mod.id, ms.id, modIdx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => handleModDrop(e, ms.id, modIdx)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 group"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${MODULE_TYPE_COLORS[mod.type as ModuleType]}`}>
                            {MODULE_TYPE_ICONS[mod.type as ModuleType]}
                            {mod.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{mod.title}</p>
                            {mod.loomUrl && <p className="text-xs text-muted-foreground truncate">{mod.loomUrl}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2"
                              onClick={() => setEditingModule({
                                moduleId: mod.id,
                                title: mod.title,
                                description: mod.description ?? "",
                                type: mod.type as ModuleType,
                                loomUrl: mod.loomUrl ?? "",
                                loomUrl2: mod.loomUrl2 ?? "",
                                taskInstructions: mod.taskInstructions ?? "",
                                isRequired: mod.isRequired,
                                quizEnabled: mod.quizEnabled,
                                milestoneId: mod.milestoneId,
                              })}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setDeleteModuleId(mod.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {/* Add Module */}
                      <div className="px-4 py-2">
                        <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 h-8 text-xs" onClick={() => setAddModuleWeekId(ms.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Module
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            {/* Add Week */}
            <Button variant="outline" onClick={() => setAddWeekOpen(true)} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" /> Add Week
            </Button>
          </>
        )}

        {/* ── Dialogs ── */}

        {/* Add Week */}
        <Dialog open={addWeekOpen} onOpenChange={setAddWeekOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Week</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={newWeekTitle} onChange={e => setNewWeekTitle(e.target.value)} placeholder="e.g. Week 10 — Advanced Adjusting" /></div>
              <div><Label>Description (optional)</Label><Textarea value={newWeekDesc} onChange={e => setNewWeekDesc(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddWeekOpen(false)}>Cancel</Button>
              <Button disabled={!newWeekTitle.trim() || addWeek.isPending} onClick={() => addWeek.mutate({ trackId: selectedTrackId!, title: newWeekTitle.trim(), description: newWeekDesc.trim() || undefined })}>
                {addWeek.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Week
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Week */}
        <Dialog open={editWeekId !== null} onOpenChange={open => !open && setEditWeekId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Week</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={editWeekTitle} onChange={e => setEditWeekTitle(e.target.value)} /></div>
              <div><Label>Description (optional)</Label><Textarea value={editWeekDesc} onChange={e => setEditWeekDesc(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditWeekId(null)}>Cancel</Button>
              <Button disabled={!editWeekTitle.trim() || updateWeek.isPending} onClick={() => updateWeek.mutate({ milestoneId: editWeekId!, title: editWeekTitle.trim(), description: editWeekDesc.trim() || undefined })}>
                {updateWeek.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Week Confirm */}
        <Dialog open={deleteWeekId !== null} onOpenChange={open => !open && setDeleteWeekId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Week?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently delete this week and <strong>all its modules</strong>. This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteWeekId(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteWeek.isPending} onClick={() => deleteWeek.mutate({ milestoneId: deleteWeekId! })}>
                {deleteWeek.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete Week
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Module */}
        <Dialog open={addModuleWeekId !== null} onOpenChange={open => !open && setAddModuleWeekId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Module</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={newModTitle} onChange={e => setNewModTitle(e.target.value)} placeholder="Module title" /></div>
              <div>
                <Label>Type</Label>
                <Select value={newModType} onValueChange={v => setNewModType(v as ModuleType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="sop">SOP</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="checklist">Checklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description (optional)</Label><Textarea value={newModDesc} onChange={e => setNewModDesc(e.target.value)} rows={2} /></div>
              {newModType === "video" && <div><Label>Loom URL</Label><Input value={newModLoom} onChange={e => setNewModLoom(e.target.value)} placeholder="https://www.loom.com/share/..." /></div>}
              {newModType === "task" && <div><Label>Task Instructions</Label><Textarea value={newModInstructions} onChange={e => setNewModInstructions(e.target.value)} rows={3} /></div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddModuleWeekId(null)}>Cancel</Button>
              <Button disabled={!newModTitle.trim() || addModule.isPending} onClick={() => addModule.mutate({ milestoneId: addModuleWeekId!, title: newModTitle.trim(), type: newModType, description: newModDesc.trim() || undefined, loomUrl: newModLoom.trim() || undefined, taskInstructions: newModInstructions.trim() || undefined })}>
                {addModule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Module
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Module */}
        <Dialog open={editingModule !== null} onOpenChange={open => !open && setEditingModule(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Module</DialogTitle></DialogHeader>
            {editingModule && (
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={editingModule.title} onChange={e => setEditingModule(m => m ? { ...m, title: e.target.value } : null)} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={editingModule.type} onValueChange={v => setEditingModule(m => m ? { ...m, type: v as ModuleType } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="sop">SOP</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="checklist">Checklist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={editingModule.description} onChange={e => setEditingModule(m => m ? { ...m, description: e.target.value } : null)} rows={2} /></div>
                <div><Label>Loom URL (primary)</Label><Input value={editingModule.loomUrl} onChange={e => setEditingModule(m => m ? { ...m, loomUrl: e.target.value } : null)} placeholder="https://www.loom.com/share/..." /></div>
                <div><Label>Loom URL 2 (secondary, optional)</Label><Input value={editingModule.loomUrl2} onChange={e => setEditingModule(m => m ? { ...m, loomUrl2: e.target.value } : null)} placeholder="https://www.loom.com/share/..." /></div>
                <div><Label>Task Instructions</Label><Textarea value={editingModule.taskInstructions} onChange={e => setEditingModule(m => m ? { ...m, taskInstructions: e.target.value } : null)} rows={3} /></div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editingModule.isRequired} onChange={e => setEditingModule(m => m ? { ...m, isRequired: e.target.checked } : null)} className="rounded" />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editingModule.quizEnabled} onChange={e => setEditingModule(m => m ? { ...m, quizEnabled: e.target.checked } : null)} className="rounded" />
                    Quiz Enabled
                  </label>
                </div>
                {/* Move to different week */}
                {track && (
                  <div>
                    <Label>Move to Week</Label>
                    <Select value={String(editingModule.milestoneId)} onValueChange={v => setEditingModule(m => m ? { ...m, milestoneId: Number(v) } : null)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {track.milestones.map(ms => (
                          <SelectItem key={ms.id} value={String(ms.id)}>{ms.title} (Week {ms.weekNumber})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingModule(null)}>Cancel</Button>
              <Button disabled={!editingModule?.title.trim() || updateModule.isPending} onClick={() => {
                if (!editingModule) return;
                updateModule.mutate({
                  moduleId: editingModule.moduleId,
                  title: editingModule.title.trim(),
                  description: editingModule.description || null,
                  type: editingModule.type,
                  loomUrl: editingModule.loomUrl || null,
                  loomUrl2: editingModule.loomUrl2 || null,
                  taskInstructions: editingModule.taskInstructions || null,
                  isRequired: editingModule.isRequired,
                  quizEnabled: editingModule.quizEnabled,
                  milestoneId: editingModule.milestoneId,
                });
              }}>
                {updateModule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Module Confirm */}
        <Dialog open={deleteModuleId !== null} onOpenChange={open => !open && setDeleteModuleId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Module?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently delete this module. Trainee progress for this module will also be removed.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteModuleId(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteModule.isPending} onClick={() => deleteModule.mutate({ moduleId: deleteModuleId! })}>
                {deleteModule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Trainee Preview Modal */}
      {previewOpen && selectedTrackId !== null && track && (
        <TrackPreviewModal
          trackId={selectedTrackId}
          trackName={track.name}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </AppLayout>
  );
}
