import { Alert } from '@/types';

const GENERIC_BODY = `お世話になっております。

先日の障害対応につきまして、暫定対処は完了し安定稼働を確認済みです。
恒久対策のレビュー会議を設定し、進捗を定期的にご共有いたします。`;

export const buildFollowUpBody = (alert?: Alert): string => {
  if (!alert) return GENERIC_BODY;
  const customer = alert.customer || 'ご担当者様';
  const subject = alert.subject || '直近のご相談内容';
  const summary = alert.ai_summary || alert.body_preview || alert.emails?.[0]?.ai_summary;

  return `お世話になっております。${customer} 各位

直近の「${subject}」に関してご心配をおかけしております。
現時点までの対応状況は以下の通りです：
- ${summary ?? '暫定対処を実施し安定稼働を確認済みです。'}

本日中に暫定レポートを共有し、恒久対策のレビュー会議（日程候補: 明朝）をご提案いたします。
追加で気になる点がございましたら遠慮なくご指摘ください。`;
};
