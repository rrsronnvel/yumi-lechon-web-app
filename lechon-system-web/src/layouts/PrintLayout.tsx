import React from 'react';

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    // bg-white and text-black ensure high contrast.
    // max-w-lg and mx-auto constrain it to a tablet/mobile portrait width.
    <div className="min-h-screen bg-white text-black font-sans">
      <div className="max-w-lg mx-auto p-4">
        {children}
      </div>
    </div>
  );
}