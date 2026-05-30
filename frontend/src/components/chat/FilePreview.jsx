// src/components/chat/FilePreview.jsx
import { FileText, Film, Music, Archive, Download, ExternalLink } from 'lucide-react';

const EXT_ICONS = {
  pdf:  { icon: FileText, color: 'text-red-500',    bg: 'bg-red-50'    },
  doc:  { icon: FileText, color: 'text-blue-600',     bg: 'bg-blue-50'     },
  docx: { icon: FileText, color: 'text-blue-600',     bg: 'bg-blue-50'     },
  xls:  { icon: FileText, color: 'text-primary-600',  bg: 'bg-primary-50'  },
  xlsx: { icon: FileText, color: 'text-primary-600',  bg: 'bg-primary-50'  },
  ppt:  { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' },
  pptx: { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' },
  zip:  { icon: Archive,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
  rar:  { icon: Archive,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
  mp4:  { icon: Film,     color: 'text-purple-600', bg: 'bg-purple-50' },
  mp3:  { icon: Music,    color: 'text-pink-600',   bg: 'bg-pink-50'   },
};

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function FilePreview({ fileUrl, fileName, fileSize, fileMime, isOwn }) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const config = EXT_ICONS[ext] || { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50' };
  const Icon = config.icon;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all no-underline
        ${isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : config.bg}`}>
        <Icon className={`w-5 h-5 ${isOwn ? 'text-white' : config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-slate-800'}`}>{fileName || 'Fichier'}</p>
        <p className={`text-xs ${isOwn ? 'text-primary-200' : 'text-slate-400'}`}>
          {ext.toUpperCase()}{fileSize ? ` · ${formatSize(fileSize)}` : ''}
        </p>
      </div>
      <Download className={`w-4 h-4 flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-slate-400'}`} />
    </a>
  );
}
