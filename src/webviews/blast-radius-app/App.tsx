import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BlastNodeCard from './BlastNodeCard';
import { Flame } from 'lucide-react';

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

interface AnalysisResultData {
  root: UINode;
  allNodes: UINode[];
  maxDepth: number;
}

// @ts-ignore - provided by VS Code
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

export default function App() {
  const [data, setData] = useState<AnalysisResultData | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'update') {
        setData(message.data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleNodeClick = (node: UINode) => {
    if (vscode) {
      vscode.postMessage({
        type: 'jumpTo',
        file: node.file,
        line: node.range.startLine,
      });
    }
  };

  if (!data) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center opacity-70">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-4 inline-block"
          >
            <Flame size={48} className="text-orange-500" />
          </motion.div>
          <p>Analyzing blast radius...</p>
        </div>
      </div>
    );
  }

  // Filter out the root node for the list, keep it separate
  const callers = data.allNodes.filter((n) => n.depth > 0).sort((a, b) => a.depth - b.depth);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center gap-3">
          <Flame size={24} className="text-orange-500" />
          <h1>Blast Radius</h1>
        </div>
        <div className="subtitle">
          Affects <strong>{callers.length}</strong> caller(s) up to depth <strong>{data.maxDepth}</strong>
        </div>
      </header>

      <main className="content">
        <div className="section-title">Root Symbol</div>
        <BlastNodeCard node={data.root} onClick={() => handleNodeClick(data.root)} isRoot />

        {callers.length > 0 && (
          <>
            <div className="section-title mt-6">Affected Callers</div>
            <div className="nodes-list">
              <AnimatePresence>
                {callers.map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <BlastNodeCard node={node} onClick={() => handleNodeClick(node)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {callers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-state"
          >
            <p>No callers found. Safe to modify!</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
