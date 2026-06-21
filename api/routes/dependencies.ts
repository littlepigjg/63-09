import { Router } from 'express';
import { configService } from '../services/ConfigService.js';

const router = Router();

router.get('/:projectId/envs/:envName', async (req, res) => {
  try {
    const dependencies = await configService.getDependencies(req.params.projectId, req.params.envName);
    if (!dependencies) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }
    res.json({ success: true, data: dependencies });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch dependencies' });
  }
});

router.post('/:projectId/envs/:envName', async (req, res) => {
  try {
    const { sourceKey, targetKey, condition, message } = req.body;
    if (!sourceKey || !targetKey) {
      res.status(400).json({ success: false, error: 'sourceKey and targetKey are required' });
      return;
    }
    const rule = await configService.addDependency(
      req.params.projectId,
      req.params.envName,
      sourceKey,
      targetKey,
      condition || '',
      message || `依赖的配置项 "${sourceKey}" 已变更，请检查 "${targetKey}" 是否需要调整`
    );
    if (!rule) {
      res.status(409).json({ success: false, error: 'Failed to create dependency rule' });
      return;
    }
    res.status(201).json({ success: true, data: rule });
  } catch (e) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Failed to add dependency' });
  }
});

router.put('/:projectId/envs/:envName/:ruleId', async (req, res) => {
  try {
    const rule = await configService.updateDependency(req.params.projectId, req.params.envName, req.params.ruleId, req.body);
    if (!rule) {
      res.status(404).json({ success: false, error: 'Dependency rule not found' });
      return;
    }
    res.json({ success: true, data: rule });
  } catch (e) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Failed to update dependency' });
  }
});

router.delete('/:projectId/envs/:envName/:ruleId', async (req, res) => {
  try {
    const deleted = await configService.deleteDependency(req.params.projectId, req.params.envName, req.params.ruleId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Dependency rule not found' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete dependency' });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { condition } = req.body;
    const result = configService.validateConditionExpr(condition || '');
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to validate condition' });
  }
});

router.post('/:projectId/envs/:envName/check', async (req, res) => {
  try {
    const { changedKeys } = req.body;
    if (!changedKeys || !Array.isArray(changedKeys)) {
      res.status(400).json({ success: false, error: 'changedKeys array is required' });
      return;
    }
    const alerts = await configService.checkDependencies(req.params.projectId, req.params.envName, changedKeys);
    res.json({ success: true, data: alerts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to check dependencies' });
  }
});

export default router;
