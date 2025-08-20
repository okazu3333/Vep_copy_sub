"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface SalesPersonFilterProps {
  salesPersons: Array<{
    name: string
    department: string
    alerts: number
    resolved: number
    pending: number
  }>
  onSearch: (searchTerm: string) => void
  searchTerm: string
}

export function SalesPersonFilter({ salesPersons, onSearch, searchTerm }: SalesPersonFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(searchTerm)

  const handleSearch = () => {
    onSearch(inputValue)
  }

  const handleClear = () => {
    setInputValue("")
    onSearch("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 検索にマッチする営業担当者数
  const matchedCount = searchTerm
    ? salesPersons.filter(
        (person) =>
          person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.department.toLowerCase().includes(searchTerm.toLowerCase()),
      ).length
    : salesPersons.length

  return (
    <Card className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Search className="h-5 w-5 mr-2" />
                営業担当者検索
                {searchTerm && (
                  <Badge variant="secondary" className="ml-2">
                    {matchedCount}名該当
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {searchTerm && (
                  <Badge variant="outline" className="text-xs">
                    「{searchTerm}」で検索中
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="営業担当者名または部署名で検索..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
                {inputValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setInputValue("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button onClick={handleSearch} disabled={inputValue === searchTerm}>
                検索
              </Button>
              {searchTerm && (
                <Button variant="outline" onClick={handleClear}>
                  クリア
                </Button>
              )}
            </div>

            {/* 検索結果の表示 */}
            {searchTerm && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">検索結果:</span> 「{searchTerm}」に該当する営業担当者{" "}
                  <span className="font-bold text-blue-600">{matchedCount}名</span> を表示中
                </div>
                {matchedCount === 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    該当する営業担当者が見つかりませんでした。検索条件を変更してください。
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
