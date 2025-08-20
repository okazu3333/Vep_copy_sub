export interface Alert {
  message_id: string;
  subject: string;
  from_address: string;
  to_address?: string;
  sent_timestamp: string;
  body: string;
  status: string;
  assignee?: string;
  status_updated_at?: string;
  quality_score: number;
  priority: string;
  sentiment: string;
  department: string;
  phraseDetections?: Array<{
    category: string;
    phrase: string;
    priority: string;
    delay: number;
    description: string;
    matchedText: string;
  }>;
}

export interface AlertResponse {
  data: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    search?: string;
    status?: string;
    priority?: string;
  };
}

export interface StatusUpdateRequest {
  status: string;
  assignee?: string;
  notes?: string;
  priority?: string;
}

export interface StatusUpdateResponse {
  success: boolean;
  message: string;
  data: {
    message_id: string;
    status: string;
    assignee?: string;
    notes?: string;
    priority?: string;
    updated_at: string;
  };
} 