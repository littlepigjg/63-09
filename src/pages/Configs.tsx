import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Lock, Download, Upload, FolderPlus, ChevronDown, GitBranch, Network, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useProjects, useConfigs, useDependencies } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import DependencyAlert from '@/components/DependencyAlert';
import DependencyGraph from '@/components/DependencyGraph';
import { maskValue, envLabel } from '@/utils/format';
import type { ConfigItem, DependencyRule, DependencyAlert as DependencyAlertType } from '../../shared/types';

const DEFAULT_ENVS = ['development', 'testing', 'production'];

export default function Configs() {
  const { selectedProjectId, setSelectedProjectId, selectedEnv, setSelectedEnv } = useAppStore();
  const { projects, createProject } = useProjects();
  const { configs, addConfig, updateConfig, deleteConfig, loading } = useConfigs({
    projectId: selectedProjectId,
    envName: selectedEnv,
  });
  const { dependencies, addDependency, updateDependency, deleteDependency, validateCondition } = useDependencies({
    projectId: selectedProjectId,
    envName: selectedEnv,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [showDependencyListModal, setShowDependencyListModal] = useState(false);
  const [showDependencyGraphModal, setShowDependencyGraphModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [editingDependency, setEditingDependency] = useState<DependencyRule | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEncrypted, setFormEncrypted] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [envName, setEnvName] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [currentAlerts, setCurrentAlerts] = useState<DependencyAlertType[]>([]);
  const [formDepSource, setFormDepSource] = useState('');
  const [formDepTarget, setFormDepTarget] = useState('');
  const [formDepCondition, setFormDepCondition] = useState('');
  const [formDepMessage, setFormDepMessage] = useState('');
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const availableConfigKeys = configs.filter((c) => c.key !== '_init').map((c) => c.key);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (highlightKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightKey(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightKey]);

  const resetForm = () => {
    setFormKey('');
    setFormValue('');
    setFormDesc('');
    setFormEncrypted(false);
  };

  const resetDependencyForm = () => {
    setFormDepSource('');
    setFormDepTarget('');
    setFormDepCondition('');
    setFormDepMessage('');
    setConditionError(null);
    setEditingDependency(null);
  };

  const handleAddConfig = async () => {
    if (!selectedProjectId || !formKey) return;
    const result = await addConfig(formKey, formValue, formDesc, formEncrypted);
    if (result) {
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleEditConfig = async () => {
    if (!selectedProjectId || !editingConfig) return;
    const body: Partial<ConfigItem> = {};
    if (formValue !== undefined && formValue !== '') body.value = formValue;
    if (formDesc !== undefined) body.description = formDesc;
    body.encrypted = formEncrypted;
    const result = await updateConfig(editingConfig.key, body);
    if (result.item) {
      setShowEditModal(false);
      setEditingConfig(null);
      resetForm();
      if (result.alerts && result.alerts.length > 0) {
        setCurrentAlerts(result.alerts);
      }
    }
  };

  const handleDeleteConfig = async (key: string) => {
    if (!confirm(`确定删除配置项 "${key}" 吗？`)) return;
    await deleteConfig(key);
  };

  const handleCreateProject = async () => {
    if (!projectName) return;
    const project = await createProject(projectName, projectDesc);
    if (project) {
      setShowProjectModal(false);
      setProjectName('');
      setProjectDesc('');
      setSelectedProjectId(project.id);
    }
  };

  const handleAddEnv = async () => {
    if (!selectedProjectId || !envName) return;
    const result = await addConfig('_init', '', 'Environment initializer', false);
    if (result) {
      setShowEnvModal(false);
      setEnvName('');
      setSelectedEnv(envName);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(configs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'config'}_${selectedEnv}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !selectedProjectId) return;
      const text = await file.text();
      try {
        const items = JSON.parse(text);
        if (Array.isArray(items)) {
          for (const item of items) {
            await addConfig(item.key, item.value || '', item.description || '', false);
          }
        }
      } catch {
        alert('导入失败：无效的JSON文件');
      }
    };
    input.click();
  };

  const openEditModal = (config: ConfigItem) => {
    setEditingConfig(config);
    setFormValue(config.encrypted ? '' : config.value);
    setFormDesc(config.description);
    setFormEncrypted(config.encrypted);
    setShowEditModal(true);
  };

  const openAddDependencyModal = () => {
    resetDependencyForm();
    setShowDependencyModal(true);
  };

  const openEditDependencyModal = (rule: DependencyRule) => {
    setEditingDependency(rule);
    setFormDepSource(rule.sourceKey);
    setFormDepTarget(rule.targetKey);
    setFormDepCondition(rule.condition);
    setFormDepMessage(rule.message);
    setConditionError(null);
    setShowDependencyModal(true);
  };

  const validateConditionExpr = async (condition: string) => {
    if (!condition.trim()) {
      setConditionError(null);
      return true;
    }
    const result = await validateCondition(condition);
    if (!result.valid) {
      setConditionError(result.error || '条件表达式无效');
      return false;
    }
    setConditionError(null);
    return true;
  };

  const handleSaveDependency = async () => {
    if (!selectedProjectId || !formDepSource || !formDepTarget) return;
    if (formDepSource === formDepTarget) {
      setConditionError('源配置项和目标配置项不能相同');
      return;
    }
    const conditionValid = await validateConditionExpr(formDepCondition);
    if (!conditionValid) return;

    const message = formDepMessage || `依赖的配置项 "${formDepSource}" 已变更，请检查 "${formDepTarget}" 是否需要调整`;

    let result;
    if (editingDependency) {
      result = await updateDependency(editingDependency.id, {
        sourceKey: formDepSource,
        targetKey: formDepTarget,
        condition: formDepCondition,
        message,
      });
    } else {
      result = await addDependency(formDepSource, formDepTarget, formDepCondition, message);
    }

    if (result) {
      setShowDependencyModal(false);
      resetDependencyForm();
    }
  };

  const handleDeleteDependency = async (ruleId: string) => {
    if (!confirm('确定删除此依赖规则吗？')) return;
    await deleteDependency(ruleId);
  };

  const projectEnvs = currentProject?.environments.map((e) => e.name) || [];
  const allEnvs = [...new Set([...DEFAULT_ENVS, ...projectEnvs])];

  return (
    <div className="animate-slide-in">
      <PageHeader title="配置管理" subtitle="按项目和环境管理配置项及依赖关系" actions={
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Download className="w-4 h-4" /> 导出
          </button>
          <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Upload className="w-4 h-4" /> 导入
          </button>
          <button onClick={() => setShowDependencyListModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <GitBranch className="w-4 h-4" /> 依赖规则
            {dependencies.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                {dependencies.length}
              </span>
            )}
          </button>
          <button onClick={() => setShowDependencyGraphModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Network className="w-4 h-4" /> 依赖图
          </button>
          <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <FolderPlus className="w-4 h-4" /> 新建项目
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
            <Plus className="w-4 h-4" /> 添加配置
          </button>
        </div>
      } />

      <DependencyAlert
        alerts={currentAlerts}
        onDismiss={() => setCurrentAlerts([])}
        onNavigateToConfig={(key) => {
          const config = configs.find((c) => c.key === key);
          if (config) {
            openEditModal(config);
            setCurrentAlerts([]);
          } else {
            setHighlightKey(key);
          }
        }}
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <button onClick={() => setShowProjectDropdown(!showProjectDropdown)} className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] hover:border-emerald-500/30 transition-colors min-w-[200px] justify-between">
            <span>{currentProject?.name || '选择项目'}</span>
            <ChevronDown className="w-4 h-4 text-[#64748B]" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden">
              {projects.map((p) => (
                <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setShowProjectDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#334155] transition-colors ${p.id === selectedProjectId ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
          {allEnvs.map((env) => (
            <button key={env} onClick={() => setSelectedEnv(env)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedEnv === env
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}>
              {envLabel(env)}
            </button>
          ))}
          <button onClick={() => setShowEnvModal(true)} className="px-2 py-1.5 text-xs text-[#64748B] hover:text-emerald-400 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-16 text-[#64748B]">
          <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先创建或选择一个项目</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">键名</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">值</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">描述</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">依赖</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">状态</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">加载中...</td>
                </tr>
              ) : configs.length === 0 || (configs.length === 1 && configs[0].key === '_init') ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">此环境下暂无配置项</td>
                </tr>
              ) : (
                configs
                  .filter((c) => c.key !== '_init')
                  .map((config) => {
                    const relatedDeps = dependencies.filter((d) => d.sourceKey === config.key || d.targetKey === config.key);
                    return (
                      <tr
                        key={config.key}
                        ref={highlightKey === config.key ? highlightRef : null}
                        className={`border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors ${
                          highlightKey === config.key ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-emerald-400">{config.key}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[#94A3B8]">
                              {config.encrypted ? maskValue(config.value) : (config.value.length > 40 ? config.value.slice(0, 40) + '...' : config.value)}
                            </span>
                            {config.encrypted && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{config.description || '-'}</td>
                        <td className="px-4 py-3">
                          {relatedDeps.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {relatedDeps.map((dep) => (
                                <button
                                  key={dep.id}
                                  onClick={() => openEditDependencyModal(dep)}
                                  className="group inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                                  title={dep.message}
                                >
                                  {dep.sourceKey === config.key ? (
                                    <><Eye className="w-3 h-3" /> 影响 {dependencies.filter(d => d.sourceKey === config.key).length}</>
                                  ) : (
                                    <><EyeOff className="w-3 h-3" /> 被依赖 {dependencies.filter(d => d.targetKey === config.key).length}</>
                                  )}
                                </button>
                              ))}
                              <button
                                onClick={() => {
                                  setFormDepSource(config.key);
                                  setFormDepTarget('');
                                  setEditingDependency(null);
                                  setShowDependencyModal(true);
                                }}
                                className="px-2 py-0.5 text-xs text-[#64748B] hover:text-emerald-400 transition-colors"
                              >
                                <Plus className="w-3 h-3 inline" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setFormDepSource(config.key);
                                setFormDepTarget('');
                                setEditingDependency(null);
                                setShowDependencyModal(true);
                              }}
                              className="text-xs text-[#64748B] hover:text-emerald-400 transition-colors"
                            >
                              <Plus className="w-3 h-3 inline mr-1" /> 添加依赖
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {config.encrypted ? (
                            <Badge variant="warning">已加密</Badge>
                          ) : (
                            <Badge variant="success">明文</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditModal(config)} className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteConfig(config.key)} className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="添加配置项">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">键名</label>
            <input value={formKey} onChange={(e) => setFormKey(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="例如: DB_HOST" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">添加</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} title={`编辑: ${editingConfig?.key}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值 {editingConfig?.encrypted && '(留空保持原值)'}</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleEditConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">保存</button>
          </div>
        </div>
      </Modal>

      <Modal open={showProjectModal} onClose={() => setShowProjectModal(false)} title="新建项目">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">项目名称</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: 用户服务" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="项目描述" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleCreateProject} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">创建</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEnvModal} onClose={() => setShowEnvModal(false)} title="添加环境">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">环境名称</label>
            <input value={envName} onChange={(e) => setEnvName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: staging" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowEnvModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddEnv} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">添加</button>
          </div>
        </div>
      </Modal>

      <Modal open={showDependencyModal} onClose={() => { setShowDependencyModal(false); resetDependencyForm(); }} title={editingDependency ? '编辑依赖规则' : '添加依赖规则'}>
        <div className="space-y-4">
          <div className="p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
            <p className="text-xs text-[#64748B] leading-relaxed">
              当<span className="text-emerald-400">源配置项</span>的值发生变化时，系统会根据<span className="text-cyan-400">条件表达式</span>判断是否需要提示用户检查<span className="text-amber-400">目标配置项</span>。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">源配置项（被依赖）</label>
              <select
                value={formDepSource}
                onChange={(e) => setFormDepSource(e.target.value)}
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">请选择配置项</option>
                {availableConfigKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">目标配置项（需检查）</label>
              <select
                value={formDepTarget}
                onChange={(e) => setFormDepTarget(e.target.value)}
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">请选择配置项</option>
                {availableConfigKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">
              条件表达式（可选，留空则总是提示）
            </label>
            <input
              value={formDepCondition}
              onChange={(e) => {
                setFormDepCondition(e.target.value);
                if (conditionError) setConditionError(null);
              }}
              onBlur={() => formDepCondition && validateConditionExpr(formDepCondition)}
              className={`w-full px-3 py-2 bg-[#0F172A] border rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50 ${
                conditionError ? 'border-rose-500/50' : 'border-[#334155]'
              }`}
              placeholder="例如: DB_HOST != 'localhost' || empty(DB_PASSWORD)"
            />
            {conditionError && (
              <p className="mt-1 text-xs text-rose-400">{conditionError}</p>
            )}
            <div className="mt-2 text-xs text-[#64748B] space-y-1">
              <p>支持的运算符: <code className="text-emerald-400">==, !=, {'>'}, {'<'}, {'>='}, {'<='}, &&, ||, !</code></p>
              <p>支持的函数: <code className="text-emerald-400">empty(x), notEmpty(x), contains(a,b), startsWith(a,b), endsWith(a,b), matches(x, regex)</code></p>
              <p>配置项名作为变量引用，字符串用单引号或双引号</p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">提示消息（可选）</label>
            <input
              value={formDepMessage}
              onChange={(e) => setFormDepMessage(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="自定义提示消息，留空使用默认消息"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowDependencyModal(false); resetDependencyForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleSaveDependency} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
              {editingDependency ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showDependencyListModal} onClose={() => setShowDependencyListModal(false)} title="依赖规则管理">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#94A3B8]">
              共 {dependencies.length} 条依赖规则
            </p>
            <button onClick={openAddDependencyModal} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
              <Plus className="w-4 h-4" /> 添加规则
            </button>
          </div>
          {dependencies.length === 0 ? (
            <div className="text-center py-12 text-[#64748B]">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无依赖规则</p>
              <p className="text-xs mt-1">添加规则来定义配置项之间的依赖关系</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {dependencies.map((rule) => (
                <div key={rule.id} className="bg-[#0F172A] rounded-lg border border-[#334155] p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-emerald-400">{rule.sourceKey}</span>
                        <ArrowRight className="w-4 h-4 text-[#64748B]" />
                        <span className="font-mono text-sm text-cyan-400">{rule.targetKey}</span>
                      </div>
                      {rule.condition && (
                        <p className="text-xs text-[#64748B] font-mono mb-1">
                          条件: {rule.condition}
                        </p>
                      )}
                      <p className="text-xs text-[#94A3B8]">{rule.message}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEditDependencyModal(rule)} className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteDependency(rule.id)} className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showDependencyGraphModal} onClose={() => setShowDependencyGraphModal(false)} title="依赖关系图">
        <div className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            可视化展示配置项之间的依赖关系，点击节点可跳转到对应配置项
          </p>
          <DependencyGraph
            dependencies={dependencies}
            configs={configs.filter((c) => c.key !== '_init')}
            onSelectConfig={(key) => {
              const config = configs.find((c) => c.key === key);
              if (config) {
                setShowDependencyGraphModal(false);
                setHighlightKey(key);
              }
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
