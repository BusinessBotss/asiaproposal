import React from 'react';

export default function Header() {
  return (
    <header className="p-4 border-b border-gray-700 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Broadcast CRM</h1>
      <div>
        <select className="bg-transparent border border-gray-600 rounded px-2 py-1">
          <option>ES</option>
          <option>EN</option>
        </select>
      </div>
    </header>
  );
}