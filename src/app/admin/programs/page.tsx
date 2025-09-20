"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Heart, Wheat, Users, Target, CheckCircle2, XCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { useRoleContext } from "@/components/roles/RoleProvider";
import MetricCard from "@/components/admin/MetricCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// UI types for API-driven data
type ProjectUI = {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'completed' | 'planning';
  budget?: string;
};

type CategoryUI = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  icon: JSX.Element;
  accent: 'blue' | 'rose' | 'amber' | 'green' | 'default';
  projects: ProjectUI[];
};

// Calculate metrics from provided categories list
function buildMetrics(fromCategories: CategoryUI[]) {
  return [
  {
    title: "Active Categories",
    value: fromCategories.filter(c => c.isActive).length.toString(),
    icon: <Target className="h-5 w-5" />,
    accent: "blue" as const,
    subtext: `${fromCategories.length} total`
  },
  {
    title: "Active Projects",
    value: fromCategories.reduce((acc, cat) => acc + cat.projects.filter(p => p.status === 'active').length, 0).toString(),
    icon: <CheckCircle2 className="h-5 w-5" />,
    accent: "green" as const,
    subtext: "Currently running"
  },
  {
    title: "Completed Projects",
    value: fromCategories.reduce((acc, cat) => acc + cat.projects.filter(p => p.status === 'completed').length, 0).toString(),
    icon: <Users className="h-5 w-5" />,
    accent: "amber" as const,
    subtext: "All time"
  },
  {
    title: "Inactive Categories",
    value: fromCategories.filter(c => !c.isActive).length.toString(),
    icon: <XCircle className="h-5 w-5" />,
    accent: "rose" as const,
    subtext: "Awaiting activation"
  }
  ];
}

export default function ProgramsPage() {
  const router = useRouter();
  const { activeRole } = useRoleContext();
  const isAdmin = activeRole === 'admin';
  const [activeTab, setActiveTab] = useState<'categories' | 'projects'>('categories');
  const [loading, setLoading] = useState(false);

  // Separate state for active categories from database (for project creation)
  const [activeCategories, setActiveCategories] = useState<CategoryUI[] | null>(null);
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);

  // Remote-loaded categories/projects state
  const [remoteCategories, setRemoteCategories] = useState<CategoryUI[] | null>(null);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projStart, setProjStart] = useState("");
  const [projEnd, setProjEnd] = useState("");
  const [projTarget, setProjTarget] = useState("");
  const [projCategoryId, setProjCategoryId] = useState("");
  const [submittingProject, setSubmittingProject] = useState(false);

  // Edit Category modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  // Edit Project modal state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [editProjStart, setEditProjStart] = useState("");
  const [editProjEnd, setEditProjEnd] = useState("");
  const [editProjTarget, setEditProjTarget] = useState("");
  const [editProjCategoryId, setEditProjCategoryId] = useState("");
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);

  // Helper to pick an accent/icon from category name for visuals
  const pickVisuals = (name: string) => {
    const key = name.toLowerCase();
    if (key.includes('educ')) return { accent: 'blue' as const, icon: <BookOpen className="h-5 w-5" /> };
    if (key.includes('health')) return { accent: 'rose' as const, icon: <Heart className="h-5 w-5" /> };
    if (key.includes('food')) return { accent: 'amber' as const, icon: <Wheat className="h-5 w-5" /> };
    return { accent: 'blue' as const, icon: <Target className="h-5 w-5" /> };
  };

  // Load categories and projects from APIs and merge into UI model
  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, projs] = await Promise.all([
        apiClient<{ items: any[] }>("/api/admin/programs/categories"),
        apiClient<{ items: any[] }>("/api/admin/programs/projects"),
      ]);

      const projectsByCategory: Record<string, any[]> = {};
      (projs.items || []).forEach((p) => {
        const cid = p.donation_category_id;
        projectsByCategory[cid] = projectsByCategory[cid] || [];
        projectsByCategory[cid].push({
          id: p.project_id,
          name: p.project_name,
          description: p.project_description,
          status: (p.project_status === 'Completed' ? 'completed' : p.is_active ? 'active' : 'inactive') as 'active'|'inactive'|'completed'|'planning',
          budget: p.target_amount ? `PKR ${Number(p.target_amount).toLocaleString()}` : '—',
        });
      });

      const mapped = (cats.items || []).map((c) => {
        const v = pickVisuals(c.donation_category_name || 'Category');
        return {
          id: c.donation_category_id,
          name: c.donation_category_name,
          description: c.description || '',
          isActive: !!c.is_active,
          icon: v.icon,
          accent: v.accent,
          projects: (projectsByCategory[c.donation_category_id] || []),
        };
      });

      setRemoteCategories(mapped);

      // Filter active categories for project creation dropdown
      const activeOnes = mapped.filter(c => c.isActive);
      setActiveCategories(activeOnes);

      const firstActive = activeOnes[0]?.id || '';
      setProjCategoryId(firstActive);
    } catch (e) {
      // If API fails, don't show any categories in dropdown (user must create categories first)
      setRemoteCategories(null);
      setActiveCategories([]);
      setProjCategoryId('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const displayCategories: CategoryUI[] = remoteCategories ?? [];
  const metrics = useMemo(() => buildMetrics(displayCategories), [displayCategories]);

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      toast.error("Category Name is required");
      return;
    }
    try {
      setSubmittingCategory(true);
      await apiClient('/api/admin/programs/category/create', {
        method: 'POST',
        body: JSON.stringify({ name: catName.trim(), description: catDesc })
      });
      toast.success('Category created (placeholder)');
      setShowCategoryModal(false);
      setCatName(""); setCatDesc("");
      await loadData();
    } catch (e) {
      toast.error('Failed to create category');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projName.trim()) {
      toast.error("Project Name is required");
      return;
    }
    if (!projCategoryId) {
      toast.error("Please select a category");
      return;
    }
    try {
      setSubmittingProject(true);
      const payload = {
        category_id: projCategoryId,
        name: projName.trim(),
        description: projDesc,
        start_date: projStart || null,
        end_date: projEnd || null,
        target_amount: projTarget ? Number(projTarget) : null,
      };
      await apiClient('/api/admin/programs/project/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast.success('Project created (placeholder)');
      setShowProjectModal(false);
      setProjName(""); setProjDesc(""); setProjStart(""); setProjEnd(""); setProjTarget("");
      await loadData();
    } catch (e) {
      toast.error('Failed to create project');
    } finally {
      setSubmittingProject(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'completed': return 'default';
      case 'planning': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'completed': return 'Completed';
      case 'planning': return 'Planning';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Programs Management</h1>
        <p className="mt-1 text-sm text-gray-600">Manage donation categories and associated projects</p>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-32 bg-gray-200 rounded" />
            </div>
          ))
        ) : (
          metrics.map((metric) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              accent={metric.accent}
            />
          ))
        )}
      </section>

      {/* Tabs for Categories / Projects */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'categories' | 'projects')} className="space-y-4" variant="outline">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger
            value="categories"
            isActive={activeTab === 'categories'}
            onClick={() => setActiveTab('categories')}
            className="whitespace-nowrap"
            data-state={activeTab === 'categories' ? 'active' : 'inactive'}
          >
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            isActive={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
            className="whitespace-nowrap"
            data-state={activeTab === 'projects' ? 'active' : 'inactive'}
          >
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" isActive={activeTab === 'categories'} className="space-y-4">
          {/* Header actions */}
          {isAdmin && (
            <div className="flex items-center justify-end">
              <Button onClick={() => setShowCategoryModal(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add New Category
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {loading && (
              Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-64 bg-gray-200 rounded" />
                </div>
              ))
            )}
            {!loading && displayCategories.length === 0 && (
              <div className="text-center text-sm text-gray-600">
                No categories found.
                {isAdmin && (
                  <div className="mt-3">
                    <Button onClick={() => setShowCategoryModal(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add New Category
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!loading && displayCategories.map((category: CategoryUI) => (
              <div key={category.id} className="rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      category.accent === 'blue' ? 'bg-blue-50 text-blue-600' :
                      category.accent === 'rose' ? 'bg-rose-50 text-rose-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={category.isActive ? 'default' : 'secondary'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditCategoryId(category.id); setEditName(category.name); setEditDesc(category.description || ''); setShowEditModal(true); }}
                        >
                          Edit
                        </Button>
                        {category.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await apiClient('/api/admin/programs/category/deactivate', { method: 'POST', body: JSON.stringify({ category_id: category.id }) });
                                toast.success('Category deactivated');
                                await loadData();
                              } catch {
                                toast.error('Failed to deactivate category');
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" isActive={activeTab === 'projects'} className="space-y-4">
          {isAdmin && (
            <div className="flex items-center justify-end">
              <Button variant="outline" onClick={() => setShowProjectModal(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add New Project
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading && (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-md border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                  <div className="h-3 w-full bg-gray-200 rounded" />
                </div>
              ))
            )}
            {!loading && displayCategories.flatMap((c: CategoryUI) => c.projects.map((p: ProjectUI) => ({ ...p, _cat: c.name, _catId: c.id }))).map((project: ProjectUI & { _cat: string; _catId: string }) => (
              <div key={`${project.id}`} className="rounded-md border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{project.name}</h5>
                    <p className="text-xs text-gray-500 mb-1">{project._cat}</p>
                    <p className="text-sm text-gray-600">{project.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={getStatusBadgeVariant(project.status)}>
                        {getStatusText(project.status)}
                      </Badge>
                      {project.budget && (
                        <span className="text-xs text-gray-500">{project.budget}</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditProjectId(project.id);
                          setEditProjName(project.name);
                          setEditProjDesc(project.description || '');
                          setEditProjStart('');
                          setEditProjEnd('');
                          const amt = project.budget ? project.budget.replace('PKR ', '').replace(',', '') : '';
                          setEditProjTarget(amt);
                          setEditProjCategoryId(project._catId);
                          setShowEditProjectModal(true);
                        }}
                      >
                        Edit
                      </Button>
                      {project.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await apiClient('/api/admin/programs/project/deactivate', { method: 'POST', body: JSON.stringify({ project_id: project.id }) });
                              toast.success('Project deactivated');
                              await loadData();
                            } catch {
                              toast.error('Failed to deactivate project');
                            }
                          }}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      {/* Modals */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Add New Category</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Category Name</label>
                <input className="w-full rounded-md border px-3 py-2" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g., Education" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Short description" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCategoryModal(false)} disabled={submittingCategory}>Cancel</Button>
                <Button onClick={handleCreateCategory} disabled={submittingCategory}>{submittingCategory ? 'Submitting...' : 'Create Category'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Add New Project</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Project Name</label>
                <input className="w-full rounded-md border px-3 py-2" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g., Scholarship Program" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} placeholder="Short description" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={projStart} onChange={(e) => setProjStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={projEnd} onChange={(e) => setProjEnd(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Target Amount (PKR)</label>
                <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2" value={projTarget} onChange={(e) => setProjTarget(e.target.value)} placeholder="e.g., 500000" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Category</label>
                <select className="w-full rounded-md border px-3 py-2" value={projCategoryId} onChange={(e) => setProjCategoryId(e.target.value)}>
                  <option value="" disabled>Select a category</option>
                  {(activeCategories ?? []).map((c: CategoryUI) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowProjectModal(false)} disabled={submittingProject}>Cancel</Button>
              <Button onClick={handleCreateProject} disabled={submittingProject}>{submittingProject ? 'Submitting...' : 'Create Project'}</Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit Category</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Category Name</label>
                <input className="w-full rounded-md border px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={savingCategoryEdit}>Cancel</Button>
                <Button
                  onClick={async () => {
                    if (!editCategoryId) return;
                    try {
                      setSavingCategoryEdit(true);
                      await apiClient('/api/admin/programs/category/update', {
                        method: 'POST',
                        body: JSON.stringify({ category_id: editCategoryId, name: editName.trim(), description: editDesc })
                      });
                      toast.success('Category updated');
                      setShowEditModal(false);
                      await loadData();
                    } catch {
                      toast.error('Failed to update category');
                    } finally {
                      setSavingCategoryEdit(false);
                    }
                  }}
                  disabled={savingCategoryEdit}
                >{savingCategoryEdit ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEditProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit Project</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Project Name</label>
                <input className="w-full rounded-md border px-3 py-2" value={editProjName} onChange={(e) => setEditProjName(e.target.value)} placeholder="e.g., Scholarship Program" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={editProjDesc} onChange={(e) => setEditProjDesc(e.target.value)} placeholder="Short description" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={editProjStart} onChange={(e) => setEditProjStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={editProjEnd} onChange={(e) => setEditProjEnd(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Target Amount (PKR)</label>
                <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2" value={editProjTarget} onChange={(e) => setEditProjTarget(e.target.value)} placeholder="e.g., 500000" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Category</label>
                <select className="w-full rounded-md border px-3 py-2" value={editProjCategoryId} onChange={(e) => setEditProjCategoryId(e.target.value)}>
                  <option value="" disabled>Select a category</option>
                  {(activeCategories ?? []).map((c: CategoryUI) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditProjectModal(false)} disabled={savingProjectEdit}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!editProjectId) return;
                  try {
                    setSavingProjectEdit(true);
                    await apiClient('/api/admin/programs/project/update', {
                      method: 'POST',
                      body: JSON.stringify({
                        project_id: editProjectId,
                        name: editProjName.trim(),
                        description: editProjDesc,
                        start_date: editProjStart || null,
                        end_date: editProjEnd || null,
                        target_amount: editProjTarget ? Number(editProjTarget) : null
                      })
                    });
                    toast.success('Project updated');
                    setShowEditProjectModal(false);
                    await loadData();
                  } catch {
                    toast.error('Failed to update project');
                  } finally {
                    setSavingProjectEdit(false);
                  }
                }}
                disabled={savingProjectEdit}
              >{savingProjectEdit ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
