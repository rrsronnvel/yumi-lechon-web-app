import React from 'react';

export interface PrintLayoutProps {
  children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAF6F4] print:bg-white text-stone-900 font-sans py-3 sm:py-6 px-3 sm:px-6">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 bg-white text-stone-900 shadow-sm print:shadow-none border border-stone-200/90 print:border-none rounded-xl">
        {children}
      </div>
    </div>
  );
}

export default PrintLayout;
