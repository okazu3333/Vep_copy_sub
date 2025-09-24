/**
 * Google Directory API を使用してユーザー情報を取得
 */

interface GoogleUser {
  id: string;
  primaryEmail: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  orgUnitPath: string;
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  suspended: boolean;
  thumbnailPhotoUrl?: string;
  phones?: Array<{
    value: string;
    type: string;
  }>;
  organizations?: Array<{
    name: string;
    title: string;
    department: string;
  }>;
}

interface UserProfile {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  department: string;
  title: string;
  photo: string;
  isInternal: boolean;
  phone?: string;
}

export class GoogleDirectoryService {
  private static readonly INTERNAL_DOMAINS = [
    'cross-m.co.jp',
    'eric.co.jp',
    'tokyogets.com'
  ];

  /**
   * メールアドレスからユーザープロフィールを取得
   */
  static async getUserProfile(email: string): Promise<UserProfile> {
    try {
      const isInternal = this.isInternalEmail(email);
      
      if (!isInternal) {
        return this.createExternalUserProfile(email);
      }

      // 内部ユーザーの場合、Google Directory APIを使用
      const googleUser = await this.fetchGoogleDirectoryUser(email);
      return this.mapGoogleUserToProfile(googleUser, email);
      
    } catch {
      console.error('ユーザープロフィール取得エラー:', error);
      return this.createFallbackProfile(email);
    }
  }

  /**
   * 複数のメールアドレスのプロフィールを一括取得
   */
  static async getUserProfiles(emails: string[]): Promise<{ [email: string]: UserProfile }> {
    const profiles: { [email: string]: UserProfile } = {};
    
    // 内部・外部ユーザーに分離
    const internalEmails = emails.filter(email => this.isInternalEmail(email));
    const externalEmails = emails.filter(email => !this.isInternalEmail(email));

    // 外部ユーザーのプロフィール生成
    for (const email of externalEmails) {
      profiles[email] = this.createExternalUserProfile(email);
    }

    // 内部ユーザーのプロフィールを一括取得
    if (internalEmails.length > 0) {
      try {
        const internalProfiles = await this.batchFetchInternalUsers(internalEmails);
        Object.assign(profiles, internalProfiles);
      } catch {
        console.error('内部ユーザー一括取得エラー:', error);
        // フォールバック
        for (const email of internalEmails) {
          profiles[email] = this.createFallbackProfile(email);
        }
      }
    }

    return profiles;
  }

  /**
   * 内部メールかどうかを判定
   */
  private static isInternalEmail(email: string): boolean {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return this.INTERNAL_DOMAINS.includes(domain);
  }

  /**
   * Google Directory APIからユーザー情報を取得
   */
  private static async fetchGoogleDirectoryUser(email: string): Promise<GoogleUser> {
    // 本来はGoogle Directory APIを呼び出す
    // 現在はモックデータを返す（実際の実装では環境変数でAPIキーを設定）
    const mockUser: GoogleUser = {
      id: `user_${email.split('@')[0]}`,
      primaryEmail: email,
      name: {
        fullName: this.extractNameFromEmail(email),
        givenName: this.extractNameFromEmail(email).split(' ')[0] || '',
        familyName: this.extractNameFromEmail(email).split(' ')[1] || '',
      },
      orgUnitPath: '/営業部',
      isAdmin: false,
      isDelegatedAdmin: false,
      suspended: false,
      organizations: [{
        name: 'クロス・マーケティング',
        title: this.getTitleFromEmail(email),
        department: this.getDepartmentFromEmail(email)
      }]
    };

    return mockUser;
  }

  /**
   * 内部ユーザーの一括取得
   */
  private static async batchFetchInternalUsers(emails: string[]): Promise<{ [email: string]: UserProfile }> {
    const profiles: { [email: string]: UserProfile } = {};
    
    // 実際の実装では Google Directory API の batch request を使用
    for (const email of emails) {
      try {
        const googleUser = await this.fetchGoogleDirectoryUser(email);
        profiles[email] = this.mapGoogleUserToProfile(googleUser, email);
      } catch {
        profiles[email] = this.createFallbackProfile(email);
      }
    }

    return profiles;
  }

  /**
   * GoogleユーザーをUserProfileにマッピング
   */
  private static mapGoogleUserToProfile(googleUser: GoogleUser, email: string): UserProfile {
    const org = googleUser.organizations?.[0];
    
    return {
      email: googleUser.primaryEmail,
      name: googleUser.name.fullName,
      firstName: googleUser.name.givenName,
      lastName: googleUser.name.familyName,
      department: org?.department || this.getDepartmentFromEmail(email),
      title: org?.title || this.getTitleFromEmail(email),
      photo: googleUser.thumbnailPhotoUrl || this.getDefaultAvatar(googleUser.name.fullName),
      isInternal: true,
      phone: googleUser.phones?.[0]?.value
    };
  }

  /**
   * 外部ユーザーのプロフィール作成
   */
  private static createExternalUserProfile(email: string): UserProfile {
    const name = this.extractNameFromEmail(email);
    const domain = email.split('@')[1];
    
    return {
      email,
      name,
      firstName: name.split(' ')[0] || '',
      lastName: name.split(' ')[1] || '',
      department: '外部',
      title: this.getCompanyFromDomain(domain),
      photo: this.getDefaultAvatar(name),
      isInternal: false
    };
  }

  /**
   * フォールバックプロフィール作成
   */
  private static createFallbackProfile(email: string): UserProfile {
    const name = this.extractNameFromEmail(email);
    const isInternal = this.isInternalEmail(email);
    
    return {
      email,
      name,
      firstName: name.split(' ')[0] || '',
      lastName: name.split(' ')[1] || '',
      department: isInternal ? '不明' : '外部',
      title: isInternal ? '担当者' : this.getCompanyFromDomain(email.split('@')[1]),
      photo: this.getDefaultAvatar(name),
      isInternal
    };
  }

  /**
   * メールアドレスから名前を抽出
   */
  private static extractNameFromEmail(email: string): string {
    if (!email) return '不明';
    
    const localPart = email.split('@')[0];
    
    // 日本語名のパターンマッチング
    const japaneseNameMatch = email.match(/[ぁ-んァ-ヶ一-龯]+/);
    if (japaneseNameMatch) {
      return japaneseNameMatch[0];
    }

    // アンダースコアやドットで区切られた名前
    const parts = localPart.replace(/[._-]/g, ' ').split(' ');
    return parts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * メールアドレスから役職を推定
   */
  private static getTitleFromEmail(email: string): string {
    const localPart = email.toLowerCase();
    
    if (localPart.includes('manager') || localPart.includes('mgr')) return 'マネージャー';
    if (localPart.includes('director') || localPart.includes('dir')) return 'ディレクター';
    if (localPart.includes('lead') || localPart.includes('leader')) return 'リーダー';
    if (localPart.includes('senior') || localPart.includes('sr')) return 'シニア';
    if (localPart.includes('admin')) return '管理者';
    
    return '担当者';
  }

  /**
   * メールアドレスから部署を推定
   */
  private static getDepartmentFromEmail(email: string): string {
    const localPart = email.toLowerCase();
    
    if (localPart.includes('sales') || localPart.includes('営業')) return '営業部';
    if (localPart.includes('marketing') || localPart.includes('マーケ')) return 'マーケティング部';
    if (localPart.includes('research') || localPart.includes('リサーチ')) return 'リサーチ部';
    if (localPart.includes('cs') || localPart.includes('customer')) return 'カスタマーサービス部';
    if (localPart.includes('admin') || localPart.includes('管理')) return '管理部';
    
    return 'カスタマーソリューション部';
  }

  /**
   * ドメインから会社名を推定
   */
  private static getCompanyFromDomain(domain: string): string {
    const companyMap: { [key: string]: string } = {
      'kadence.com': 'Kadence International',
      'eric.co.jp': 'エリックソン',
      'jig.co.jp': 'JIG-SAW',
      'jujukeisan.co.jp': '株式会社十十計算',
      'mdilab.co.jp': 'MDI Lab',
      'gkmarketing.co.jp': 'GKマーケティング',
      'tokyogets.com': 'Tokyo Gets',
      'gmail.com': 'Gmail',
      'yahoo.co.jp': 'Yahoo',
      'outlook.com': 'Outlook'
    };

    return companyMap[domain.toLowerCase()] || domain;
  }

  /**
   * デフォルトアバター画像URLを生成
   */
  private static getDefaultAvatar(name: string): string {
    const initials = name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
    // Gravatarのデフォルト画像または初期文字ベースの画像
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=40`;
  }
}

export type { UserProfile }; 
