import { useMemo, useState } from 'react';
import { ArrowRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { DependencyRule, ConfigItem } from '../../shared/types';

interface DependencyGraphProps {
  dependencies: DependencyRule[];
  configs: ConfigItem[];
  onSelectConfig?: (key: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
  key: string;
  level: number;
}

export default function DependencyGraph({ dependencies, configs, onSelectConfig }: DependencyGraphProps) {
  const [zoom, setZoom] = useState(1);

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Set<string>>();
    const allKeys = new Set<string>();

    dependencies.forEach((dep) => {
      allKeys.add(dep.sourceKey);
      allKeys.add(dep.targetKey);
      if (!nodeMap.has(dep.sourceKey)) {
        nodeMap.set(dep.sourceKey, new Set());
      }
      nodeMap.get(dep.sourceKey)!.add(dep.targetKey);
    });

    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();

    allKeys.forEach((key) => inDegree.set(key, 0));
    dependencies.forEach((dep) => {
      inDegree.set(dep.targetKey, (inDegree.get(dep.targetKey) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, key) => {
      if (degree === 0) {
        queue.push(key);
        levels.set(key, 0);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current) || 0;
      const targets = nodeMap.get(current) || new Set();
      targets.forEach((target) => {
        const newDegree = (inDegree.get(target) || 0) - 1;
        inDegree.set(target, newDegree);
        if (newDegree === 0) {
          queue.push(target);
          levels.set(target, currentLevel + 1);
        }
      });
    }

    allKeys.forEach((key) => {
      if (!levels.has(key)) {
        levels.set(key, 0);
      }
    });

    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, key) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(key);
    });

    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 50;
    const H_GAP = 40;
    const V_GAP = 30;

    const nodePositions: NodePosition[] = [];
    const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

    sortedLevels.forEach((level) => {
      const keys = levelGroups.get(level) || [];
      keys.sort();
      keys.forEach((key, idx) => {
        nodePositions.push({
          key,
          level,
          x: level * (NODE_WIDTH + H_GAP) + 40,
          y: idx * (NODE_HEIGHT + V_GAP) + 40,
        });
      });
    });

    const graphEdges = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.sourceKey,
      target: dep.targetKey,
      condition: dep.condition,
    }));

    return { nodes: nodePositions, edges: graphEdges };
  }, [dependencies]);

  const svgWidth = useMemo(() => {
    if (nodes.length === 0) return 600;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 180;
    return Math.max(600, maxX);
  }, [nodes]);

  const svgHeight = useMemo(() => {
    if (nodes.length === 0) return 300;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 100;
    return Math.max(300, maxY);
  }, [nodes]);

  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 50;

  if (dependencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
        <ArrowRight className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">暂无依赖规则</p>
        <p className="text-xs mt-1">添加依赖规则后，这里将展示配置间的关联关系</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[#1E293B]/80 backdrop-blur rounded-lg p-1 border border-[#334155]">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#334155] rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-[#94A3B8] px-2 min-w-[48px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#334155] rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#334155] rounded transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-auto rounded-xl border border-[#334155] bg-[#0F172A]" style={{ maxHeight: '500px' }}>
        <svg
          width={svgWidth * zoom}
          height={svgHeight * zoom}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748B" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const source = nodeMap(edge.source, nodes);
            const target = nodeMap(edge.target, nodes);
            if (!source || !target) return null;

            const startX = source.x + NODE_WIDTH;
            const startY = source.y + NODE_HEIGHT / 2;
            const endX = target.x;
            const endY = target.y + NODE_HEIGHT / 2;
            const midX = (startX + endX) / 2;

            const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {edge.condition && (
                  <text
                    x={midX}
                    y={(startY + endY) / 2 - 6}
                    textAnchor="middle"
                    className="fill-[#64748B] text-[10px] font-mono"
                  >
                    {edge.condition.length > 20 ? edge.condition.slice(0, 20) + '...' : edge.condition}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.map((node) => {
            const config = configs.find((c) => c.key === node.key);
            return (
              <g
                key={node.key}
                onClick={() => onSelectConfig?.(node.key)}
                className="cursor-pointer"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="8"
                  fill="#1E293B"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  className="hover:stroke-[#34D399] transition-colors"
                />
                <text
                  x={node.x + NODE_WIDTH / 2}
                  y={node.y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className="fill-emerald-400 text-xs font-mono"
                >
                  {node.key.length > 14 ? node.key.slice(0, 14) + '...' : node.key}
                </text>
                {config?.encrypted && (
                  <circle
                    cx={node.x + NODE_WIDTH - 10}
                    cy={node.y + 10}
                    r="5"
                    fill="#F59E0B"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function nodeMap(key: string, nodes: NodePosition[]): NodePosition | undefined {
  return nodes.find((n) => n.key === key);
}
