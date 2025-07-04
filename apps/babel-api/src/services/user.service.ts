import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, userSessions, userPreferences, type User, type NewUser, type NewUserSession, type NewUserPreferences } from '../db/schema.js';
import * as jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { emailService } from './email.service.js';

/**
 * User service for managing user accounts, authentication, and sessions
 */
export class UserService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '30d'; // 30 days for news app - longer sessions preferred
  private readonly db: PostgresJsDatabase<any>;
  
  constructor(database?: PostgresJsDatabase<any>) {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    if (this.jwtSecret === 'development-secret-key' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    this.db = database || db;
  }

  /**
   * Create a guest user profile
   */
  async createGuestUser(deviceFingerprint?: string): Promise<User> {
    const guestId = this.generateGuestId();
    
    const newUser: NewUser = {
      guestId,
      deviceFingerprint,
      emailVerified: false,
      userStatus: 'guest'
    };

    const [user] = await this.db.insert(users).values(newUser).returning();
    
    // Create default preferences for guest user
    await this.createDefaultPreferences(user.id);
    
    return user;
  }

  /**
   * Create account from guest user by adding email
   */
  async createAccountFromGuest(guestId: string, email: string): Promise<{ user: User; verificationToken: string }> {
    // Check if email already exists
    const existingEmailUser = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingEmailUser.length > 0) {
      throw new Error('Email already registered');
    }

    // Find guest user
    const [guestUser] = await this.db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
    if (!guestUser) {
      throw new Error('Guest user not found');
    }

    // Generate verification token
    const verificationToken = this.generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update guest user with email and verification token
    const [updatedUser] = await this.db
      .update(users)
      .set({
        email,
        verificationToken,
        verificationTokenExpiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, guestUser.id))
      .returning();

    // Send OTP email
    try {
      await emailService.sendOTPEmail(email, verificationToken);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      // Don't throw here - user creation succeeded, email failure shouldn't block it
    }

    return { user: updatedUser, verificationToken };
  }

  /**
   * Start verification - unified method for both new and existing users
   */
  async startVerification(guestId: string, email: string): Promise<{ user: User; isExistingUser: boolean }> {
    // Check if email already exists with a verified user
    const existingEmailUser = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingEmailUser.length > 0) {
      // Send verification code for existing user (verified or unverified)
      await this.resendVerificationCode(email);
      
      // Return updated user data
      const [updatedUser] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      return { user: updatedUser, isExistingUser: true };
    }

    // Email doesn't exist - create new account from guest
    const result = await this.createAccountFromGuest(guestId, email);
    return { user: result.user, isExistingUser: false };
  }

  /**
   * Verify email and complete account creation
   */
  async verifyEmail(verificationToken: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string }; preferences?: any }> {
    // Find user by verification token (allow already verified users for existing user flow)
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.verificationToken, verificationToken))
      .limit(1);

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new Error('Verification token has expired');
    }

    const wasAlreadyVerified = user.emailVerified;

    // Mark email as verified, update status to verified, and clear verification token
    const [verifiedUser] = await this.db
      .update(users)
      .set({
        emailVerified: true,
        userStatus: 'verified',
        verificationToken: null,
        verificationTokenExpiry: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .returning();

    // Create session and generate tokens
    const tokens = await this.createSession(verifiedUser);

    // Get user preferences (for existing users to sync back to client)
    let preferences = null;
    if (wasAlreadyVerified) {
      preferences = await this.getUserPreferences(verifiedUser.id);
    }

    // Send welcome email only for new users
    if (!wasAlreadyVerified) {
      try {
        await emailService.sendWelcomeEmail(verifiedUser.email!);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
        // Don't throw here - verification succeeded, welcome email failure shouldn't block it
      }
    }

    return { user: verifiedUser, tokens, preferences };
  }

  /**
   * Resend verification code for pending email verification
   */
  async resendVerificationCode(email: string): Promise<void> {
    // Find user by email
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error('User not found with this email address');
    }

    // Generate new verification token
    const verificationToken = this.generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new verification token
    await this.db
      .update(users)
      .set({
        verificationToken,
        verificationTokenExpiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    // Send new OTP email
    await emailService.sendOTPEmail(email, verificationToken);
  }

  /**
   * Create a new session for authenticated user
   */
  async createSession(user: User, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    
    // Hash tokens for storage
    const accessTokenHash = this.hashToken(accessToken);
    const refreshTokenHash = this.hashToken(refreshToken);
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years

    // Store session in database
    const newSession: NewUserSession = {
      userId: user.id,
      accessTokenHash,
      refreshTokenHash,
      expiresAt,
      deviceInfo,
      ipAddress,
      userAgent
    };

    await this.db.insert(userSessions).values(newSession);

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const refreshTokenHash = this.hashToken(refreshToken);
    
    // Find valid session
    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.refreshTokenHash, refreshTokenHash),
        // Check if session is not expired
      ))
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Get user
    const [user] = await this.db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) {
      return null;
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();
    
    // Update session with new tokens
    const newAccessTokenHash = this.hashToken(newAccessToken);
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    await this.db
      .update(userSessions)
      .set({
        accessTokenHash: newAccessTokenHash,
        refreshTokenHash: newRefreshTokenHash,
        lastAccessedAt: new Date()
      })
      .where(eq(userSessions.id, session.id));

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Validate access token and return user
   */
  async validateAccessToken(accessToken: string): Promise<User | null> {
    try {
      const payload = jwt.verify(accessToken, this.jwtSecret) as any;
      
      // Check if session exists (for logout invalidation)
      const accessTokenHash = this.hashToken(accessToken);
      const [session] = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.accessTokenHash, accessTokenHash))
        .limit(1);
      
      if (!session) {
        return null; // Session was deleted (logged out)
      }
      
      // Get user from database
      const [user] = await this.db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      
      return user || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout user by invalidating session
   */
  async logout(accessToken: string): Promise<void> {
    const accessTokenHash = this.hashToken(accessToken);
    
    // Delete session
    await this.db.delete(userSessions).where(eq(userSessions.accessTokenHash, accessTokenHash));
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user || null;
  }

  /**
   * Get user by guest ID
   */
  async getUserByGuestId(guestId: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
    return user || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NewUserPreferences>): Promise<void> {
    // Get existing preferences
    const [existingPrefs] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (!existingPrefs) {
      // If no preferences exist, create them
      await this.createDefaultPreferences(userId);
      // Retry with the newly created preferences
      return this.updateUserPreferences(userId, preferences);
    }

    // Merge nested objects properly - exclude nested objects from initial spread
    const { translationSettings, notificationSettings, privacySettings, ...otherPrefs } = preferences;
    
    const updatedPrefs: any = {
      ...otherPrefs,
      updatedAt: new Date()
    };

    // Handle nested object merging for specific fields
    if (translationSettings) {
      const existing = (existingPrefs.translationSettings as any) || {};
      updatedPrefs.translationSettings = Object.assign({}, existing, translationSettings);
    }

    if (notificationSettings) {
      const existing = (existingPrefs.notificationSettings as any) || {};
      updatedPrefs.notificationSettings = Object.assign({}, existing, notificationSettings);
    }

    if (privacySettings) {
      const existing = (existingPrefs.privacySettings as any) || {};
      updatedPrefs.privacySettings = Object.assign({}, existing, privacySettings);
    }

    await this.db
      .update(userPreferences)
      .set(updatedPrefs)
      .where(eq(userPreferences.userId, userId));
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string) {
    const [prefs] = await this.db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return prefs;
  }

  /**
   * Get user status by user ID
   */
  async getUserStatus(userId: string): Promise<string | null> {
    const [user] = await this.db.select({ userStatus: users.userStatus }).from(users).where(eq(users.id, userId)).limit(1);
    return user?.userStatus || null;
  }

  /**
   * Update user status (for admin operations or upgrades)
   */
  async updateUserStatus(userId: string, status: 'guest' | 'verified' | 'vip'): Promise<void> {
    await this.db
      .update(users)
      .set({
        userStatus: status,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Private helper methods

  private generateGuestId(): string {
    return `guest_${randomBytes(16).toString('hex')}`;
  }

  private generateVerificationToken(): string {
    // Generate 4-digit OTP
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        emailVerified: user.emailVerified,
        jti: randomBytes(8).toString('hex') // Unique token ID to ensure uniqueness
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createDefaultPreferences(userId: string): Promise<void> {
    const defaultPrefs: NewUserPreferences = {
      userId,
      preferredLanguages: ['en'],
      feedCategories: [],
      translationSettings: {
        autoTranslate: false,
        defaultTargetLanguage: 'en'
      },
      themePreference: 'system',
      notificationSettings: {
        emailNotifications: false,
        pushNotifications: false
      },
      privacySettings: {
        analytics: false,
        personalization: true
      }
    };

    await this.db.insert(userPreferences).values(defaultPrefs);
  }
}

// Export singleton instance with lazy initialization
let _userServiceInstance: UserService | null = null;

export const userService = new Proxy({} as UserService, {
  get(_, prop) {
    // Initialize the singleton on first access
    if (!_userServiceInstance) {
      _userServiceInstance = new UserService();
    }
    return (_userServiceInstance as any)[prop];
  }
});