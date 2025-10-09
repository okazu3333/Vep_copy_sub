"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Users, FileText, TrendingUp, Info } from 'lucide-react';

interface DetectionReasonsProps {
  reasons: string[];
  score: number;
  className?: string;
}

export function DetectionReasons({ reasons, score, className = "" }: DetectionReasonsProps) {
  if (!reasons || reasons.length === 0) {
    return null;
  }

  const getReasonIcon = (reason: string) => {
    if (reason.includes('緊急対応')) return AlertTriangle;
    if (reason.includes('解約リスク')) return TrendingDown;
    if (reason.includes('競合脅威')) return Users;
    if (reason.includes('契約関連')) return FileText;
    if (reason.includes('売上機会')) return TrendingUp;
    if (reason.includes('ネガティブ')) return AlertTriangle;
    return Info;
  };

  const getReasonColor = (reason: string) => {
    if (reason.includes('緊急対応')) return 'bg-red-100 text-red-800 border-red-200';
    if (reason.includes('解約リスク')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (reason.includes('競合脅威')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (reason.includes('契約関連')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (reason.includes('売上機会')) return 'bg-green-100 text-green-800 border-green-200';
    if (reason.includes('ネガティブ')) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">検知理由 (スコア: {score})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {reasons.map((reason, index) => {
          const Icon = getReasonIcon(reason);
          const colorClass = getReasonColor(reason);
          
          return (
            <Badge 
              key={index} 
              variant="outline" 
              className={`text-xs ${colorClass} flex items-center gap-1`}
            >
              <Icon className="h-3 w-3" />
              {reason}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}



