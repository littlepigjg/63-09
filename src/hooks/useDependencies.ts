import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/utils/api';
import { useSSE } from './useSSE';
import { useDocumentVisibility } from './useDocumentVisibility';
import type { DependencyRule, DependencyAlert } from '../../shared/types';

interface UseDependenciesOptions {
  projectId: string | null;
  envName: string | null;
  autoRefresh?: boolean;
  refreshOnVisible?: boolean;
}

export function useDependencies(options: UseDependenciesOptions) {
  const { projectId, envName, autoRefresh = true, refreshOnVisible = true } = options;
  const [dependencies, setDependencies] = useState<DependencyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isVisible } = useDocumentVisibility();
  const lastFetchRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000;

  const fetchDependencies = useCallback(async () => {
    if (!projectId || !envName) {
      setDependencies([]);
      return;
    }

    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DependencyRule[]>(`/dependencies/${projectId}/envs/${envName}`);
      if (res.success && res.data) {
        setDependencies(res.data);
      } else {
        setDependencies([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dependencies');
      setDependencies([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, envName]);

  const addDependency = useCallback(async (sourceKey: string, targetKey: string, condition: string, message: string) => {
    if (!projectId || !envName) return null;
    const res = await api.post<DependencyRule>(`/dependencies/${projectId}/envs/${envName}`, {
      sourceKey,
      targetKey,
      condition,
      message,
    });
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchDependencies();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchDependencies]);

  const updateDependency = useCallback(async (ruleId: string, updates: Partial<DependencyRule>) => {
    if (!projectId || !envName) return null;
    const res = await api.put<DependencyRule>(`/dependencies/${projectId}/envs/${envName}/${ruleId}`, updates);
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchDependencies();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchDependencies]);

  const deleteDependency = useCallback(async (ruleId: string) => {
    if (!projectId || !envName) return false;
    const res = await api.delete(`/dependencies/${projectId}/envs/${envName}/${ruleId}`);
    if (res.success) {
      lastFetchRef.current = 0;
      await fetchDependencies();
      return true;
    }
    return false;
  }, [projectId, envName, fetchDependencies]);

  const validateCondition = useCallback(async (condition: string): Promise<{ valid: boolean; error?: string }> => {
    const res = await api.post<{ valid: boolean; error?: string }>('/dependencies/validate', { condition });
    if (res.success && res.data) {
      return res.data;
    }
    return { valid: false, error: 'Validation failed' };
  }, []);

  const checkDependencies = useCallback(async (changedKeys: string[]): Promise<DependencyAlert[]> => {
    if (!projectId || !envName) return [];
    const res = await api.post<DependencyAlert[]>(`/dependencies/${projectId}/envs/${envName}/check`, { changedKeys });
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }, [projectId, envName]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  useEffect(() => {
    if (!refreshOnVisible || !isVisible) return;

    const timer = setTimeout(() => {
      fetchDependencies();
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, refreshOnVisible, fetchDependencies]);

  useSSE({
    enabled: autoRefresh,
    filter: { project: projectId, environment: envName, eventTypes: ['config_changed', 'connected'] },
    onConfigChanged: () => {
      lastFetchRef.current = 0;
      fetchDependencies();
    },
    onRefresh: () => {
      lastFetchRef.current = 0;
      fetchDependencies();
    },
  });

  return {
    dependencies,
    loading,
    error,
    fetchDependencies,
    addDependency,
    updateDependency,
    deleteDependency,
    validateCondition,
    checkDependencies,
  };
}
