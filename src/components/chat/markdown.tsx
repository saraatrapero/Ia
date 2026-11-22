"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IconCopy, IconDownload } from "../icons";

const EXT_BY_LANG: Record<string, string> = {
  python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx",
  json: "json", html: "html", css: "css", sql: "sql", bash: "sh", sh: "sh", shell: "sh", yaml: "yml", yml: "yml",
  csv: "csv", markdown: "md", md: "md", xml: "xml", java: "java", go: "go", rust: "rs", php: "php", ruby: "rb",
  c: "c", cpp: "cpp", csharp: "cs", cs: "cs", r: "r", txt: "txt", text: "txt", vba: "bas", powershell: "ps1",
};

function CodeBlock({ lang, code, onDownload }: { lang: string; code: string; onDownload?: (code: string, filename: string) => void }) {
  const [copied, setCopied] = useState(false);
  const ext = EXT_BY_LANG[lang.toLowerCase()] ?? "txt";
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#0a0e15]">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-muted">
        <span className="font-mono">{lang || "texto"}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-ink"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <IconCopy width={13} height={13} /> {copied ? "Copiado" : "Copiar"}
          </button>
          {onDownload && (
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-ink"
              onClick={() => onDownload(code, `archivo.${ext}`)}
            >
              <IconDownload width={13} height={13} /> .{ext}
            </button>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
  onDownloadCode,
}: {
  content: string;
  onDownloadCode?: (code: string, filename: string) => void;
}) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-(\S+)/.exec(className ?? "");
            const text = String(children ?? "");
            if (!match && !text.includes("\n")) return <code>{children}</code>;
            return <CodeBlock lang={match?.[1] ?? ""} code={text.replace(/\n$/, "")} onDownload={onDownloadCode} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
