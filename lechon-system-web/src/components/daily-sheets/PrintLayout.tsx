import React from 'react';

export interface PrintLayoutProps {
  children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF6F4] px-3 py-3 font-sans text-stone-900 print:bg-white sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-7xl rounded-xl border border-stone-200/90 bg-white p-3 text-stone-900 shadow-sm print:border-none print:shadow-none sm:p-6 xl:max-w-[1440px]">
        {children}
      </div>
    </div>
  );
}

export default PrintLayout;
