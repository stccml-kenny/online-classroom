import React from 'react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <div className="bg-[#FF6B57] text-white pt-4 pb-3 px-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div className="text-sm font-semibold">10:03</div>
      <h1 className="text-lg font-bold">{title}</h1>
      <div className="w-6"></div>
    </div>
  );
};
