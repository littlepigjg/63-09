import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import type { DependencyAlert as DependencyAlertType } from '../../shared/types';

interface DependencyAlertProps {
  alerts: DependencyAlertType[];
  onDismiss: () => void;
  onNavigateToConfig?: (key: string) => void;
}

export default function DependencyAlert({ alerts, onDismiss, onNavigateToConfig }: DependencyAlertProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-amber-400 mb-2">
            检测到 {alerts.length} 条相关配置可能需要调整
          </h4>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.ruleId}
                className="flex items-center gap-2 bg-[#0F172A]/50 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-mono text-emerald-400">{alert.sourceKey}</span>
                <ArrowRight className="w-4 h-4 text-[#64748B]" />
                <span className="font-mono text-cyan-400">{alert.targetKey}</span>
                <span className="text-[#94A3B8] flex-1 truncate">: {alert.message}</span>
                {onNavigateToConfig && (
                  <button
                    onClick={() => onNavigateToConfig(alert.targetKey)}
                    className="flex-shrink-0 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
                  >
                    检查
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-[#64748B] hover:text-[#F1F5F9] rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
