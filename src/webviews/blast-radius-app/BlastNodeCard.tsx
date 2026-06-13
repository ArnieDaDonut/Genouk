import React from 'react';
import { motion } from 'framer-motion';
import { FileCode, Activity } from 'lucide-react';

interface Range {
  startLine: number;
  endLine: number;
}

interface UINode {
  id: string;
  symbol: string;
  file: string;
  range: Range;
  depth: number;
}

interface BlastNodeCardProps {
  node: UINode;
  onClick: () => void;
  isRoot?: boolean;
}

export default function BlastNodeCard({ node, onClick, isRoot = false }: BlastNodeCardProps) {
  // Extract just the filename from the path
  const fileName = node.file.split(/[/\\]/).pop() || node.file;

  const depthColor = isRoot 
    ? 'border-orange-500/50 bg-orange-500/10' 
    : node.depth === 1 
      ? 'border-red-500/40 bg-red-500/10'
      : node.depth === 2
        ? 'border-yellow-500/30 bg-yellow-500/10'
        : 'border-blue-500/30 bg-blue-500/10';

  const depthLabelColor = isRoot 
    ? 'text-orange-400' 
    : node.depth === 1 
      ? 'text-red-400'
      : node.depth === 2
        ? 'text-yellow-400'
        : 'text-blue-400';

  // Format line numbers. e.g. "Line 42" or "Lines 42-45"
  const lineText = node.range.startLine === node.range.endLine
    ? `Line ${node.range.startLine}`
    : `Lines ${node.range.startLine}-${node.range.endLine}`;

  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`node-card cursor-pointer rounded-lg border p-4 backdrop-blur-sm transition-colors hover:bg-opacity-20 ${depthColor}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/20 ${depthLabelColor}`}>
            {isRoot ? <FlameIcon /> : <Activity size={20} />}
          </div>
          <div>
            <h3 className="font-mono text-[15px] font-semibold tracking-wide text-[var(--vscode-editor-foreground)]">
              {node.symbol}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--vscode-descriptionForeground)] opacity-80">
              <FileCode size={12} />
              <span>{fileName}</span>
              <span className="opacity-50">•</span>
              <span className="font-mono bg-[var(--vscode-textCodeBlock-background)] px-1 rounded text-[11px] text-[var(--vscode-textPreformat-foreground)]">
                {lineText}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[11px] font-medium uppercase tracking-wider ${depthLabelColor}`}>
            {isRoot ? 'Root' : `Depth ${node.depth}`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function FlameIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}
