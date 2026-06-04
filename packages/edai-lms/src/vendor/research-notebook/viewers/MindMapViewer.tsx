'use client';

import { useState, useCallback } from 'react';
import { Brain, ChevronRight, ChevronDown } from 'lucide-react';
import type { MindMapOutput, MindMapNode } from '../types';

interface MindMapViewerProps {
  data: MindMapOutput;
}

const DEPTH_COLORS = [
  { border: 'border-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { border: 'border-cyan-500', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  { border: 'border-purple-500', text: 'text-purple-400', dot: 'bg-purple-500' },
  { border: 'border-amber-500', text: 'text-amber-400', dot: 'bg-amber-500' },
];

function getDepthColor(depth: number) {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

interface TreeNodeProps {
  node: MindMapNode;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const color = getDepthColor(depth);

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l-2 pl-3' : ''} ${depth > 0 ? color.border : ''}`}>
      <div className="flex items-start gap-2 py-1.5 group">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className={`mt-2 shrink-0 h-1.5 w-1.5 rounded-full ${color.dot}`} />
        )}
        <span
          className={`text-sm ${
            hasChildren ? `font-medium ${color.text} cursor-pointer` : 'text-slate-300'
          }`}
          onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
        >
          {node.label}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children!.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MindMapViewer({ data }: MindMapViewerProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  // We use a key to force re-render when toggling all
  const [treeKey, setTreeKey] = useState(0);

  const toggleAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
    setTreeKey((k) => k + 1);
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <Brain className="w-4 h-4" />
          <span className="text-sm font-medium">Mind Map</span>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Root Node */}
      <div className="p-4">
        <div className="mb-4 text-center">
          <span className="inline-block px-4 py-2 rounded-lg bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 font-semibold text-base">
            {data.root}
          </span>
        </div>

        {/* Branches */}
        <div className="space-y-1" key={treeKey}>
          {data.branches.map((branch, i) => (
            <ExpandableTreeNode key={i} node={branch} depth={0} forceExpanded={allExpanded} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ExpandableTreeNodeProps {
  node: MindMapNode;
  depth: number;
  forceExpanded: boolean;
}

function ExpandableTreeNode({ node, depth, forceExpanded }: ExpandableTreeNodeProps) {
  const [expanded, setExpanded] = useState(forceExpanded || depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const color = getDepthColor(depth);

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l-2 pl-3' : ''} ${depth > 0 ? color.border : ''}`}>
      <div className="flex items-start gap-2 py-1.5">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className={`mt-2 shrink-0 h-1.5 w-1.5 rounded-full ${color.dot}`} />
        )}
        <span
          className={`text-sm ${
            hasChildren ? `font-medium ${color.text} cursor-pointer` : 'text-slate-300'
          }`}
          onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
        >
          {node.label}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children!.map((child, i) => (
            <ExpandableTreeNode key={i} node={child} depth={depth + 1} forceExpanded={forceExpanded} />
          ))}
        </div>
      )}
    </div>
  );
}
