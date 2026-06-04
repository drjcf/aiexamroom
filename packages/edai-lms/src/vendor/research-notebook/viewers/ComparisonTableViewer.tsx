'use client';

import { Table } from 'lucide-react';
import type { ComparisonTableOutput } from '../types';

interface ComparisonTableViewerProps {
  data: ComparisonTableOutput;
}

export default function ComparisonTableViewer({ data }: ComparisonTableViewerProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800">
        <Table className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-400">{data.title}</span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-wider border-r border-slate-700 min-w-[160px]">
                Criteria
              </th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider min-w-[140px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b border-slate-700/50 ${
                  rowIdx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'
                }`}
              >
                <td className="sticky left-0 z-10 px-4 py-3 font-medium text-slate-50 border-r border-slate-700 bg-inherit">
                  {row.criterion}
                </td>
                {row.values.map((val, colIdx) => (
                  <td key={colIdx} className="px-4 py-3 text-slate-300">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
