"use client";

import React from 'react';

interface HighlightTextProps {
  text: string;
  keywords: string[];
  className?: string;
}

export function HighlightText({ text, keywords, className = "" }: HighlightTextProps) {
  if (!keywords || keywords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // キーワードでテキストを分割してハイライト
  let highlightedText = text;
  
  keywords.forEach(keyword => {
    if (keyword && keyword.trim()) {
      const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '|HIGHLIGHT_START|$1|HIGHLIGHT_END|');
    }
  });

  // ハイライトマーカーを実際のJSXに変換
  const parts = highlightedText.split(/\|HIGHLIGHT_START\|(.*?)\|HIGHLIGHT_END\|/);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        // 奇数インデックスはハイライト対象
        if (index % 2 === 1) {
          return (
            <mark 
              key={index} 
              className="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded font-medium"
            >
              {part}
            </mark>
          );
        }
        return part;
      })}
    </span>
  );
}

