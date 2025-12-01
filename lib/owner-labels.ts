export const UNASSIGNED_OWNER_LABEL = '未割り当て';

const OWNER_NAME_MAP: Record<string, string> = {
  'sales@company.jp': '佐藤（営業一課）',
  'enterprise_team@company.jp': '高橋（エンタープライズ）',
  'account_lead@company.jp': '田中（アカウント）',
  'solutions_manager@company.jp': '石井（ソリューション）',
  'account_director@company.jp': '中村（アカウント統括）',
  'pricing_manager@company.jp': '大山（プライシング）',
  'growth_manager@company.jp': '鈴木（グロース）',
  'sales_planner@company.jp': '山田（営業企画）',
  'project_lead@company.jp': '小林（導入PM）',
  'legal_representative@company.jp': '松本（法務サポート）',
  'account_planner@company.jp': '吉田（アカウントプランナー）',
  'enterprise_finance@company.jp': '井上（ファイナンス）',
  'field_enablement@company.jp': '加藤（フィールド対応）',
  'presales_lead@company.jp': '和田（プリセールス）',
  'success_lead@company.jp': '藤田（CSリード）',
  'success_planner@company.jp': '工藤（CSプランナー）',
  'channel_lead@company.jp': '原田（チャネル）',
  [UNASSIGNED_OWNER_LABEL]: '未割り当て',
};

export const formatOwnerLabel = (owner: string): string => {
  if (!owner) return UNASSIGNED_OWNER_LABEL;
  return OWNER_NAME_MAP[owner] ?? owner.replace(/@.+$/, '').replace(/[_.-]/g, ' ').trim();
};
