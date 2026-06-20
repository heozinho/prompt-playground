"use client";

import { useState, useRef, useEffect } from "react";

export type DropdownItem = {
  id: string;
  label: string;
  meta?: string; // e.g. "BEST FOR DEEP WORK" or "FAST"
};

type DropdownProps = {
  title: string; // e.g. "SELECT_MODEL"
  value: string;
  items: DropdownItem[];
  onChange: (id: string) => void;
  inline?: boolean;
};

export default function Dropdown({ title, value, items, onChange, inline }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeItem = items.find((i) => i.id === value) || items[0];

  return (
    <div className="dropdown-container" ref={containerRef}>
      <button 
        className={inline ? "inline-dropdown-trigger" : "dropdown-trigger"} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{inline ? `[ ${activeItem?.label || value} ▾ ]` : (activeItem?.label || value)}</span>
        {!inline && <span>▾</span>}
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">{title}</div>
          {items.map((item) => {
            const isActive = item.id === value;
            return (
              <button
                key={item.id}
                className={`dropdown-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
              >
                <span>
                  {isActive ? "●" : "\u00A0\u00A0"} {item.label}
                </span>
                {item.meta && <span className="dropdown-meta">{item.meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
