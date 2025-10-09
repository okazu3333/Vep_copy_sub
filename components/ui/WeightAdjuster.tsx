"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, RotateCcw, Save, Info } from 'lucide-react';
import { ScoringWeights, DEFAULT_WEIGHTS, adjustWeights, validateWeights } from '@/lib/advanced-scoring';

interface WeightAdjusterProps {
  initialWeights?: ScoringWeights;
  onWeightsChange?: (weights: ScoringWeights) => void;
  onSave?: (weights: ScoringWeights) => void;
  className?: string;
}

export function WeightAdjuster({ 
  initialWeights = DEFAULT_WEIGHTS, 
  onWeightsChange,
  onSave,
  className = "" 
}: WeightAdjusterProps) {
  const [weights, setWeights] = useState<ScoringWeights>(initialWeights);
  const [validation, setValidation] = useState(validateWeights(weights));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const newValidation = validateWeights(weights);
    setValidation(newValidation);
    
    if (onWeightsChange) {
      onWeightsChange(weights);
    }
  }, [weights, onWeightsChange]);

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    const newWeights = { ...weights, [key]: value };
    
    // キーワードと感情の重みの合計を1.0に調整
    if (key === 'keywordWeight') {
      newWeights.sentimentWeight = 1.0 - value;
    } else if (key === 'sentimentWeight') {
      newWeights.keywordWeight = 1.0 - value;
    }
    
    setWeights(newWeights);
    setHasChanges(true);
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    setHasChanges(false);
  };

  const handleSave = () => {
    if (validation.valid && onSave) {
      onSave(weights);
      setHasChanges(false);
    }
  };

  const getWeightDescription = (key: keyof ScoringWeights) => {
    const descriptions = {
      keywordWeight: 'キーワード検出の重要度。高いほどキーワードに依存します。',
      sentimentWeight: '感情分析の重要度。高いほど感情に依存します。',
      synergyMultiplier: 'キーワードと感情の相乗効果の倍率。',
      urgencyBoost: '緊急度によるスコアブーストの上限倍率。'
    };
    return descriptions[key];
  };

  const getWeightColor = (key: keyof ScoringWeights) => {
    const colors = {
      keywordWeight: 'bg-blue-500',
      sentimentWeight: 'bg-green-500',
      synergyMultiplier: 'bg-purple-500',
      urgencyBoost: 'bg-orange-500'
    };
    return colors[key];
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          重み付け調整
          {hasChanges && (
            <Badge variant="outline" className="ml-auto text-orange-600 border-orange-300 text-xs">
              未保存
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* バリデーションエラー */}
        {!validation.valid && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
              <Info className="h-4 w-4" />
              設定エラー
            </div>
            <ul className="text-sm text-red-600 space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 重み付けスライダー */}
        <div className="space-y-4">
          {/* キーワード重み */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">キーワード重み</div>
                <div className="text-xs text-gray-500">{getWeightDescription('keywordWeight')}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getWeightColor('keywordWeight')}`} />
                <span className="text-sm font-mono">{Math.round(weights.keywordWeight * 100)}%</span>
              </div>
            </div>
            <Slider
              value={[weights.keywordWeight]}
              onValueChange={([value]) => handleWeightChange('keywordWeight', value)}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>

          <Separator />

          {/* 感情重み */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">感情分析重み</div>
                <div className="text-xs text-gray-500">{getWeightDescription('sentimentWeight')}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getWeightColor('sentimentWeight')}`} />
                <span className="text-sm font-mono">{Math.round(weights.sentimentWeight * 100)}%</span>
              </div>
            </div>
            <Slider
              value={[weights.sentimentWeight]}
              onValueChange={([value]) => handleWeightChange('sentimentWeight', value)}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>

          <Separator />

          {/* 相乗効果倍率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">相乗効果倍率</div>
                <div className="text-xs text-gray-500">{getWeightDescription('synergyMultiplier')}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getWeightColor('synergyMultiplier')}`} />
                <span className="text-sm font-mono">{weights.synergyMultiplier.toFixed(1)}x</span>
              </div>
            </div>
            <Slider
              value={[weights.synergyMultiplier]}
              onValueChange={([value]) => handleWeightChange('synergyMultiplier', value)}
              min={1.0}
              max={2.0}
              step={0.1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* 緊急度ブースト */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">緊急度ブースト上限</div>
                <div className="text-xs text-gray-500">{getWeightDescription('urgencyBoost')}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getWeightColor('urgencyBoost')}`} />
                <span className="text-sm font-mono">{weights.urgencyBoost.toFixed(1)}x</span>
              </div>
            </div>
            <Slider
              value={[weights.urgencyBoost]}
              onValueChange={([value]) => handleWeightChange('urgencyBoost', value)}
              min={1.0}
              max={1.5}
              step={0.05}
              className="w-full"
            />
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            リセット
          </Button>
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!validation.valid || !hasChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            保存
          </Button>
        </div>

        {/* 現在の設定サマリー */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xs font-medium text-gray-700 mb-2">現在の設定</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>キーワード: {Math.round(weights.keywordWeight * 100)}%</div>
            <div>感情: {Math.round(weights.sentimentWeight * 100)}%</div>
            <div>相乗効果: {weights.synergyMultiplier.toFixed(1)}x</div>
            <div>緊急度: {weights.urgencyBoost.toFixed(1)}x</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
