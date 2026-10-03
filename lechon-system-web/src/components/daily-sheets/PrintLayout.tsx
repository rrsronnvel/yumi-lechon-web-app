import React from 'react';

export interface PrintLayoutProps {
  children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100/70 print:bg-white text-slate-900 font-sans py-2 sm:py-4 px-2 sm:px-4">
      <div className="w-full max-w-[1600px] mx-auto p-3 sm:p-5 bg-white text-slate-900 shadow-sm print:shadow-none border border-slate-300 print:border-none rounded-lg">
        {children}
      </div>
    </div>
  );
}

export default PrintLayout;
