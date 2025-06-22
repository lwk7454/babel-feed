import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users, userSessions, userPreferences, type User, type NewUser, type NewUserSession, type NewUserPreferences } from '../db/schema.js';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

/**
 * User service for managing user accounts, authentication, and sessions
 */
export class UserService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '30d'; // 30 days for news app
  private readonly refreshTokenExpiry = '365d'; // 1 year
  
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    if (this.jwtSecret === 'development-secret-key' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
  }

  /**
   * Create a guest user profile
   */
  async createGuestUser(deviceFingerprint?: string): Promise<User> {
    const guestId = this.generateGuestId();
    
    const newUser: NewUser = {
      guestId,
      deviceFingerprint,
      emailVerified: false
    };

    const [user] = await db.insert(users).values(newUser).returning();
    
    // Create default preferences for guest user
    await this.createDefaultPreferences(user.id);
    
    return user;
  }

  /**
   * Create account from guest user by adding email
   */
  async createAccountFromGuest(guestId: string, email: string): Promise<{ user: User; verificationToken: string }> {
    // Check if email already exists
    const existingEmailUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingEmailUser.length > 0) {
      throw new Error('Email already registered');
    }

    // Find guest user
    const [guestUser] = await db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
    if (!guestUser) {
      throw new Error('Guest user not found');
    }

    // Generate verification token
    const verificationToken = this.generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update guest user with email and verification token
    const [updatedUser] = await db
      .update(users)
      .set({
        email,
        verificationToken,
        verificationTokenExpiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, guestUser.id))
      .returning();

    return { user: updatedUser, verificationToken };
  }

  /**
   * Verify email and complete account creation
   */
  async verifyEmail(verificationToken: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    // Find user by verification token
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.verificationToken, verificationToken),
        eq(users.emailVerified, false)
      ))
      .limit(1);

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new Error('Verification token has expired');
    }

    // Mark email as verified and clear verification token
    const [verifiedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .returning();

    // Create session and generate tokens
    const tokens = await this.createSession(verifiedUser);

    return { user: verifiedUser, tokens };
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
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

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

    await db.insert(userSessions).values(newSession);

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const refreshTokenHash = this.hashToken(refreshToken);
    
    // Find valid session
    const [session] = await db
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
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) {
      return null;
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();
    
    // Update session with new tokens
    const newAccessTokenHash = this.hashToken(newAccessToken);
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    await db
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
      
      // Get user from database
      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      
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
    await db.delete(userSessions).where(eq(userSessions.accessTokenHash, accessTokenHash));
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user || null;
  }

  /**
   * Get user by guest ID
   */
  async getUserByGuestId(guestId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
    return user || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NewUserPreferences>): Promise<void> {
    await db
      .update(userPreferences)
      .set({
        ...preferences,
        updatedAt: new Date()
      })
      .where(eq(userPreferences.userId, userId));
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string) {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return prefs;
  }

  // Private helper methods

  private generateGuestId(): string {
    return `guest_${randomBytes(16).toString('hex')}`;
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        emailVerified: user.emailVerified 
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

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

    await db.insert(userPreferences).values(defaultPrefs);
  }
}

// Export singleton instance
export const userService = new UserService();