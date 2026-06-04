'use client';

import { useRef, useState } from 'react';
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, Code, Quote, Eye, Pencil,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  minimal?: boolean; // smaller toolbar for short fields like descriptions
}

/**
 * Markdown textarea with a formatting toolbar.
 * - Toolbar buttons insert markdown syntax around the current selection.
 * - Preview tab renders the markdown with react-markdown + GFM.
 */
export default function MarkdownEditor({
  value,
  onChange,
  rows = 8,
  placeholder = 'Write in markdown…',
  minimal = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const wrap = (before: string, after: string = before, placeholderText = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    // Restore cursor to just after the inserted opening marker + selected text
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const prefixLines = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    // Expand to full lines
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, blockEnd);
    const prefixed = block
      .split('\n')
      .map((l) => (l.trim() ? `${prefix}${l}` : l))
      .join('\n');
    const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    wrap('[', `](${url})`, 'link text');
  };

  const btn = 'p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white transition';

  return (
    <div className="border border-white/10 rounded-lg bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-white/10 px-2 py-1 flex-wrap">
        <button type="button" onClick={() => wrap('**')} className={btn} title="Bold (Ctrl+B)">
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => wrap('*')} className={btn} title="Italic (Ctrl+I)">
          <Italic size={14} />
        </button>
        {!minimal && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button type="button" onClick={() => prefixLines('# ')} className={btn} title="Heading 1">
              <Heading1 size={14} />
            </button>
            <button type="button" onClick={() => prefixLines('## ')} className={btn} title="Heading 2">
              <Heading2 size={14} />
            </button>
            <button type="button" onClick={() => prefixLines('### ')} className={btn} title="Heading 3">
              <Heading3 size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button type="button" onClick={() => prefixLines('- ')} className={btn} title="Bulleted list">
              <List size={14} />
            </button>
            <button type="button" onClick={() => prefixLines('1. ')} className={btn} title="Numbered list">
              <ListOrdered size={14} />
            </button>
            <button type="button" onClick={() => prefixLines('> ')} className={btn} title="Quote">
              <Quote size={14} />
            </button>
            <button type="button" onClick={() => wrap('`')} className={btn} title="Inline code">
              <Code size={14} />
            </button>
          </>
        )}
        <button type="button" onClick={insertLink} className={btn} title="Link">
          <LinkIcon size={14} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          className={`${btn} flex items-center gap-1 text-xs`}
          title={mode === 'edit' ? 'Preview' : 'Edit'}
        >
          {mode === 'edit' ? <Eye size={14} /> : <Pencil size={14} />}
          {mode === 'edit' ? 'Preview' : 'Edit'}
        </button>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          onKeyDown={(e) => {
            // Keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
              if (e.key === 'b') { e.preventDefault(); wrap('**'); }
              else if (e.key === 'i') { e.preventDefault(); wrap('*'); }
              else if (e.key === 'k') { e.preventDefault(); insertLink(); }
            }
          }}
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 px-3 py-2 resize-y focus:outline-none font-mono"
        />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none px-3 py-2 min-h-[6rem]">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-slate-500 italic">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
