// チームメンバーのダミーデータ（管理者が自チームメンバーのアラート状況を確認するためのもの）

export interface DummyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  role?: string;
}

export const DUMMY_MEMBERS: DummyMember[] = [
  {
    id: 'tanaka',
    name: '田中太郎',
    email: 'tanaka@cross-m.co.jp',
    department: '営業部',
    role: '営業担当',
  },
  {
    id: 'sato',
    name: '佐藤花子',
    email: 'sato@cross-m.co.jp',
    department: '営業部',
    role: 'アカウントマネージャー',
  },
  {
    id: 'suzuki',
    name: '鈴木一郎',
    email: 'suzuki@cross-m.co.jp',
    department: 'エンタープライズ営業',
    role: 'エンタープライズ営業',
  },
];

