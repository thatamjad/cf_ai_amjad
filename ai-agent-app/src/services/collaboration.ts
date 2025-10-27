/**
 * Collaboration and Sharing System
 * Enables conversation sharing and collaborative features
 */

/**
 * Share link configuration
 */
export interface ShareConfig {
  id: string;
  conversationId: string;
  agentId: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  isPublic: boolean;
  viewOnly: boolean;
  password?: string;
  accessCount: number;
  maxAccess?: number;
  allowedUsers?: string[];
}

/**
 * Share link access log
 */
export interface ShareAccessLog {
  shareId: string;
  accessedAt: number;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Collaboration Service
 */
export class CollaborationService {
  private shares: Map<string, ShareConfig> = new Map();
  private accessLogs: ShareAccessLog[] = [];

  /**
   * Create a shareable link for a conversation
   */
  createShareLink(config: Omit<ShareConfig, 'id' | 'createdAt' | 'accessCount'>): ShareConfig {
    const shareConfig: ShareConfig = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      accessCount: 0,
      ...config,
    };

    this.shares.set(shareConfig.id, shareConfig);

    console.log('🔗 Created share link:', shareConfig.id);

    return shareConfig;
  }

  /**
   * Get share configuration
   */
  getShareConfig(shareId: string): ShareConfig | null {
    const config = this.shares.get(shareId);

    if (!config) {
      return null;
    }

    // Check if expired
    if (config.expiresAt && Date.now() > config.expiresAt) {
      console.log('⏰ Share link expired:', shareId);
      return null;
    }

    // Check max access limit
    if (config.maxAccess && config.accessCount >= config.maxAccess) {
      console.log('🚫 Share link access limit reached:', shareId);
      return null;
    }

    return config;
  }

  /**
   * Validate share access
   */
  validateAccess(
    shareId: string,
    userId?: string,
    password?: string
  ): { valid: boolean; reason?: string } {
    const config = this.getShareConfig(shareId);

    if (!config) {
      return { valid: false, reason: 'Share link not found or expired' };
    }

    // Check password
    if (config.password && config.password !== password) {
      return { valid: false, reason: 'Invalid password' };
    }

    // Check allowed users
    if (config.allowedUsers && config.allowedUsers.length > 0) {
      if (!userId || !config.allowedUsers.includes(userId)) {
        return { valid: false, reason: 'User not authorized' };
      }
    }

    return { valid: true };
  }

  /**
   * Log share access
   */
  logAccess(shareId: string, userId?: string, ipAddress?: string, userAgent?: string): void {
    const config = this.shares.get(shareId);

    if (config) {
      config.accessCount++;

      this.accessLogs.push({
        shareId,
        accessedAt: Date.now(),
        userId,
        ipAddress,
        userAgent,
      });

      // Keep only last 10000 logs
      if (this.accessLogs.length > 10000) {
        this.accessLogs.shift();
      }
    }
  }

  /**
   * Get share access logs
   */
  getAccessLogs(shareId: string, limit = 100): ShareAccessLog[] {
    return this.accessLogs
      .filter((log) => log.shareId === shareId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Update share configuration
   */
  updateShareConfig(shareId: string, updates: Partial<ShareConfig>): ShareConfig | null {
    const config = this.shares.get(shareId);

    if (!config) {
      return null;
    }

    Object.assign(config, updates);
    return config;
  }

  /**
   * Delete share link
   */
  deleteShareLink(shareId: string): boolean {
    const deleted = this.shares.delete(shareId);

    if (deleted) {
      console.log('🗑️ Deleted share link:', shareId);
    }

    return deleted;
  }

  /**
   * Get all shares for a conversation
   */
  getSharesByConversation(conversationId: string): ShareConfig[] {
    return Array.from(this.shares.values()).filter(
      (share) => share.conversationId === conversationId
    );
  }

  /**
   * Get all shares created by a user
   */
  getSharesByUser(userId: string): ShareConfig[] {
    return Array.from(this.shares.values()).filter((share) => share.createdBy === userId);
  }

  /**
   * Clean up expired shares
   */
  cleanupExpiredShares(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [shareId, config] of this.shares.entries()) {
      if (config.expiresAt && now > config.expiresAt) {
        this.shares.delete(shareId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired shares`);
    }

    return cleaned;
  }

  /**
   * Generate share URL
   */
  generateShareUrl(shareId: string, baseUrl: string): string {
    return `${baseUrl}/shared/${shareId}`;
  }

  /**
   * Get share statistics
   */
  getStatistics(): {
    totalShares: number;
    activeShares: number;
    expiredShares: number;
    totalAccesses: number;
    publicShares: number;
    privateShares: number;
  } {
    const now = Date.now();
    let activeShares = 0;
    let expiredShares = 0;
    let publicShares = 0;
    let privateShares = 0;
    let totalAccesses = 0;

    for (const config of this.shares.values()) {
      if (config.expiresAt && now > config.expiresAt) {
        expiredShares++;
      } else {
        activeShares++;
      }

      if (config.isPublic) {
        publicShares++;
      } else {
        privateShares++;
      }

      totalAccesses += config.accessCount;
    }

    return {
      totalShares: this.shares.size,
      activeShares,
      expiredShares,
      totalAccesses,
      publicShares,
      privateShares,
    };
  }
}

// Global collaboration service instance
export const collaborationService = new CollaborationService();

/**
 * Helper function to create a quick share link
 */
export function quickShare(
  conversationId: string,
  agentId: string,
  userId: string,
  options?: {
    expiresInHours?: number;
    viewOnly?: boolean;
    isPublic?: boolean;
    password?: string;
  }
): ShareConfig {
  const expiresAt = options?.expiresInHours
    ? Date.now() + options.expiresInHours * 60 * 60 * 1000
    : undefined;

  return collaborationService.createShareLink({
    conversationId,
    agentId,
    createdBy: userId,
    expiresAt,
    isPublic: options?.isPublic ?? true,
    viewOnly: options?.viewOnly ?? true,
    password: options?.password,
  });
}
