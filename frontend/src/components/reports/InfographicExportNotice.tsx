import React from 'react';
import { Download, AlertTriangle, Camera } from 'lucide-react';

/**
 * InfographicExportNotice
 *
 * Replaces the misleading "Export Image" button that previously called
 * toast.error() internally. Direct image export is not currently
 * supported by the backend or frontend. This component communicates
 * that limitation honestly and directs users to use their OS screenshot
 * tool instead.
 */
export function InfographicExportNotice() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-800 dark:text-amber-300">
          Direct image export is not available yet.
        </p>
        <p className="text-amber-700 dark:text-amber-400 mt-0.5">
          Use your browser or system screenshot tool to capture the infographic below.
        </p>
      </div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 opacity-60 cursor-not-allowed select-none shrink-0"
        title="Image export is not currently available"
        aria-disabled="true"
      >
        <Download className="w-3.5 h-3.5" />
        Export Image
        <span className="ml-1 text-[10px] uppercase tracking-wider font-bold bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded">
          Unavailable
        </span>
      </div>
    </div>
  );
}
