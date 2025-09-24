"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Reply, ArrowRight, ExternalLink } from "lucide-react"
import { UserProfile } from "@/lib/google-directory"

interface ChatMessage {
  id: string
  content: string
  timestamp: string
  sender: UserProfile
  recipient: UserProfile
  isReply: boolean
  subject: string
  messageId: string
  inReplyTo?: string
  level: 'high' | 'medium' | 'low'
  detectedKeyword?: string
}

interface ChatConversationProps {
  messages: ChatMessage[]
  onMessageClick?: (_id: string) => void
}

export function ChatConversation({ messages, onMessageClick }: ChatConversationProps) {
  // メッセージを時系列でソート
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {sortedMessages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          onClick={() => onMessageClick?.(message.messageId)}
        />
      ))}
    </div>
  )
}

interface ChatMessageBubbleProps {
  message: ChatMessage
  onClick?: () => void
}

function ChatMessageBubble({ message, onClick }: ChatMessageBubbleProps) {
  const isInternal = message.sender.isInternal
  const isReply = message.isReply

  return (
    <div className={`flex gap-3 ${isInternal ? 'justify-end' : 'justify-start'}`}>
      {/* 外部からのメール（左側） */}
      {!isInternal && (
        <>
          <Avatar className="w-10 h-10">
            <AvatarImage src={message.sender.photo} alt={message.sender.name} />
            <AvatarFallback className="bg-red-100 text-red-700">
              {message.sender.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 max-w-[70%]">
            <Card 
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                isReply ? 'border-blue-200 bg-blue-50/30' : 'border-red-200 bg-red-50/30'
              } ${
                message.level === 'high' ? 'border-l-4 border-l-red-500' :
                message.level === 'medium' ? 'border-l-4 border-l-yellow-500' :
                'border-l-4 border-l-blue-500'
              }`}
              onClick={onClick}
            >
              <CardContent className="p-4">
                {/* メッセージヘッダー */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-red-800">
                      {message.sender.name}
                    </div>
                    <Badge variant="outline" className="text-xs bg-red-100 text-red-700">
                      {message.sender.title}
                    </Badge>
                    {isReply && (
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                        <Reply className="w-3 h-3 mr-1" />
                        返信
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={message.level === 'high' ? 'destructive' : message.level === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {message.level === 'high' ? '高' : message.level === 'medium' ? '中' : '低'}
                    </Badge>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </div>
                </div>

                {/* 受信者情報 */}
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <div className="text-xs text-gray-600">
                    宛先: {message.recipient.name} ({message.recipient.department})
                  </div>
                </div>

                {/* 件名 */}
                <div className="text-sm font-medium mb-2 line-clamp-1">
                  {message.subject}
                </div>

                {/* メッセージ内容 */}
                <div className="text-sm text-gray-700 line-clamp-3 mb-3">
                  {message.content}
                </div>

                {/* タイムスタンプとキーワード */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {new Date(message.timestamp).toLocaleString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {message.detectedKeyword && (
                    <Badge variant="secondary" className="text-xs">
                      {message.detectedKeyword}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 内部からのメール（右側） */}
      {isInternal && (
        <>
          <div className="flex-1 max-w-[70%]">
            <Card 
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                isReply ? 'border-green-200 bg-green-50/30' : 'border-blue-200 bg-blue-50/30'
              } ${
                message.level === 'high' ? 'border-r-4 border-r-red-500' :
                message.level === 'medium' ? 'border-r-4 border-r-yellow-500' :
                'border-r-4 border-r-blue-500'
              }`}
              onClick={onClick}
            >
              <CardContent className="p-4">
                {/* メッセージヘッダー */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-green-800">
                      {message.sender.name}
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                      {message.sender.department}
                    </Badge>
                    {isReply && (
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                        <Reply className="w-3 h-3 mr-1" />
                        返信
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={message.level === 'high' ? 'destructive' : message.level === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {message.level === 'high' ? '高' : message.level === 'medium' ? '中' : '低'}
                    </Badge>
                  </div>
                </div>

                {/* 送信先情報 */}
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <div className="text-xs text-gray-600">
                    送信先: {message.recipient.name} ({message.recipient.title})
                  </div>
                </div>

                {/* 件名 */}
                <div className="text-sm font-medium mb-2 line-clamp-1">
                  {message.subject}
                </div>

                {/* メッセージ内容 */}
                <div className="text-sm text-gray-700 line-clamp-3 mb-3">
                  {message.content}
                </div>

                {/* タイムスタンプとキーワード */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {new Date(message.timestamp).toLocaleString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {message.detectedKeyword && (
                    <Badge variant="secondary" className="text-xs">
                      {message.detectedKeyword}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Avatar className="w-10 h-10">
            <AvatarImage src={message.sender.photo} alt={message.sender.name} />
            <AvatarFallback className="bg-green-100 text-green-700">
              {message.sender.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </>
      )}
    </div>
  )
}

export type { ChatMessage } 
