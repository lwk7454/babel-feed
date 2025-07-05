import './setup.js';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { users, userSessions } from '@babel-feed/pgdb';
import { UserService } from '../services/user.service.js';
import { testDb } from './test-database.js';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(testDb);
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.delete(userSessions);
    await testDb.delete(users);
  });

  describe('createGuestUser', () => {
    it('should create a guest user with unique guest ID', async () => {
      const deviceFingerprint = 'test-device-123';
      const user = await userService.createGuestUser(deviceFingerprint);

      expect(user.id).toBeTruthy();
      expect(user.guestId).toContain('guest_');
      expect(user.deviceFingerprint).toBe(deviceFingerprint);
      expect(user.email).toBeNull();
      expect(user.emailVerified).toBe(false);
    });

    it('should create guest user without device fingerprint', async () => {
      const user = await userService.createGuestUser();

      expect(user.id).toBeTruthy();
      expect(user.guestId).toContain('guest_');
      expect(user.deviceFingerprint).toBeNull();
      expect(user.emailVerified).toBe(false);
    });
  });

  describe('createAccountFromGuest', () => {
    it('should upgrade guest user to account with email', async () => {
      // Create guest user first
      const guestUser = await userService.createGuestUser();
      const email = 'test@example.com';

      const result = await userService.createAccountFromGuest(guestUser.guestId!, email);

      expect(result.user.email).toBe(email);
      expect(result.user.emailVerified).toBe(false);
      expect(result.verificationToken).toBeTruthy();
      expect(result.user.id).toBe(guestUser.id);
    });

    it('should throw error for duplicate email', async () => {
      const email = 'duplicate@example.com';
      
      // Create first user with email
      const guestUser1 = await userService.createGuestUser();
      await userService.createAccountFromGuest(guestUser1.guestId!, email);

      // Try to create second user with same email
      const guestUser2 = await userService.createGuestUser();
      
      await expect(
        userService.createAccountFromGuest(guestUser2.guestId!, email)
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for non-existent guest ID', async () => {
      const nonExistentGuestId = 'guest_nonexistent';
      const email = 'test@example.com';

      await expect(
        userService.createAccountFromGuest(nonExistentGuestId, email)
      ).rejects.toThrow('Guest user not found');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and return user with tokens', async () => {
      // Create guest user and account
      const guestUser = await userService.createGuestUser();
      const email = 'verify@example.com';
      const { verificationToken } = await userService.createAccountFromGuest(guestUser.guestId!, email);

      const result = await userService.verifyEmail(verificationToken);

      expect(result.user.emailVerified).toBe(true);
      expect(result.user.verificationToken).toBeNull();
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('should throw error for invalid verification token', async () => {
      const invalidToken = 'invalid-token';

      await expect(
        userService.verifyEmail(invalidToken)
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should throw error for expired verification token', async () => {
      // Create user with expired token
      const guestUser = await userService.createGuestUser();
      const email = 'expired@example.com';
      const { user } = await userService.createAccountFromGuest(guestUser.guestId!, email);

      // Manually expire the token
      await testDb
        .update(users)
        .set({
          verificationTokenExpiry: new Date(Date.now() - 1000) // 1 second ago
        })
        .where(eq(users.id, user.id));

      const [updatedUser] = await testDb.select().from(users).where(eq(users.id, user.id));

      await expect(
        userService.verifyEmail(updatedUser.verificationToken!)
      ).rejects.toThrow('Verification token has expired');
    });
  });

  describe('createSession', () => {
    it('should create session with tokens for verified user', async () => {
      // Create and verify user
      const guestUser = await userService.createGuestUser();
      const email = 'session@example.com';
      const { verificationToken } = await userService.createAccountFromGuest(guestUser.guestId!, email);
      const { user } = await userService.verifyEmail(verificationToken);

      // Clear existing sessions created during verification
      await testDb.delete(userSessions).where(eq(userSessions.userId, user.id));

      const deviceInfo = { platform: 'test', version: '1.0' };
      const ipAddress = '127.0.0.1';
      const userAgent = 'test-agent';

      const tokens = await userService.createSession(user, deviceInfo, ipAddress, userAgent);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();

      // Verify session was stored
      const sessions = await testDb.select().from(userSessions).where(eq(userSessions.userId, user.id));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].ipAddress).toBe(ipAddress);
      expect(sessions[0].userAgent).toBe(userAgent);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Create verified user and session
      const guestUser = await userService.createGuestUser();
      const email = 'refresh@example.com';
      const { verificationToken } = await userService.createAccountFromGuest(guestUser.guestId!, email);
      const { tokens: initialTokens } = await userService.verifyEmail(verificationToken);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const newTokens = await userService.refreshToken(initialTokens.refreshToken);

      expect(newTokens).toBeTruthy();
      expect(newTokens!.accessToken).toBeTruthy();
      expect(newTokens!.refreshToken).toBeTruthy();
      expect(newTokens!.accessToken).not.toBe(initialTokens.accessToken);
      expect(newTokens!.refreshToken).not.toBe(initialTokens.refreshToken);
    });

    it('should return null for invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      const result = await userService.refreshToken(invalidRefreshToken);

      expect(result).toBeNull();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate and return user for valid access token', async () => {
      // Create verified user and session
      const guestUser = await userService.createGuestUser();
      const email = 'validate@example.com';
      const { verificationToken } = await userService.createAccountFromGuest(guestUser.guestId!, email);
      const { user, tokens } = await userService.verifyEmail(verificationToken);

      const validatedUser = await userService.validateAccessToken(tokens.accessToken);

      expect(validatedUser).toBeTruthy();
      expect(validatedUser!.id).toBe(user.id);
      expect(validatedUser!.email).toBe(email);
    });

    it('should return null for invalid access token', async () => {
      const invalidToken = 'invalid-access-token';

      const result = await userService.validateAccessToken(invalidToken);

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const guestUser = await userService.createGuestUser();

      const foundUser = await userService.getUserById(guestUser.id);

      expect(foundUser).toBeTruthy();
      expect(foundUser!.id).toBe(guestUser.id);
    });

    it('should return null for non-existent user ID', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000'; // Valid UUID format

      const result = await userService.getUserById(nonExistentId);

      expect(result).toBeNull();
    });
  });

  describe('getUserByGuestId', () => {
    it('should return user by guest ID', async () => {
      const guestUser = await userService.createGuestUser();

      const foundUser = await userService.getUserByGuestId(guestUser.guestId!);

      expect(foundUser).toBeTruthy();
      expect(foundUser!.guestId).toBe(guestUser.guestId);
    });

    it('should return null for non-existent guest ID', async () => {
      const nonExistentGuestId = 'guest_nonexistent';

      const result = await userService.getUserByGuestId(nonExistentGuestId);

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should delete session for valid access token', async () => {
      // Create verified user and session
      const guestUser = await userService.createGuestUser();
      const email = 'logout@example.com';
      const { verificationToken } = await userService.createAccountFromGuest(guestUser.guestId!, email);
      const { user, tokens } = await userService.verifyEmail(verificationToken);

      // Verify session exists
      let sessions = await testDb.select().from(userSessions).where(eq(userSessions.userId, user.id));
      expect(sessions).toHaveLength(1);

      await userService.logout(tokens.accessToken);

      // Verify session was deleted
      sessions = await testDb.select().from(userSessions).where(eq(userSessions.userId, user.id));
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getUserStatus', () => {
    it('should return user status for existing user', async () => {
      const guestUser = await userService.createGuestUser();
      const status = await userService.getUserStatus(guestUser.id);
      expect(status).toBe('guest');
    });

    it('should return null for non-existent user', async () => {
      const status = await userService.getUserStatus('00000000-0000-4000-8000-000000000000');
      expect(status).toBeNull();
    });

    it('should return verified status after email verification', async () => {
      const guestUser = await userService.createGuestUser();
      const { user } = await userService.createAccountFromGuest(guestUser.guestId!, 'status@example.com');
      await userService.verifyEmail(user.verificationToken!);
      
      const status = await userService.getUserStatus(user.id);
      expect(status).toBe('verified');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const guestUser = await userService.createGuestUser();
      
      await userService.updateUserStatus(guestUser.id, 'vip');
      
      const status = await userService.getUserStatus(guestUser.id);
      expect(status).toBe('vip');
    });

    it('should update verified user to vip status', async () => {
      const guestUser = await userService.createGuestUser();
      const { user } = await userService.createAccountFromGuest(guestUser.guestId!, 'vip@example.com');
      await userService.verifyEmail(user.verificationToken!);
      
      await userService.updateUserStatus(user.id, 'vip');
      
      const status = await userService.getUserStatus(user.id);
      expect(status).toBe('vip');
    });
  });

  describe('user status integration', () => {
    it('should create guest user with correct status', async () => {
      const user = await userService.createGuestUser();
      expect(user.userStatus).toBe('guest');
    });

    it('should update status to verified after email verification', async () => {
      const guestUser = await userService.createGuestUser();
      const { user } = await userService.createAccountFromGuest(guestUser.guestId!, 'integration@example.com');
      const verifyResult = await userService.verifyEmail(user.verificationToken!);
      
      expect(verifyResult.user.userStatus).toBe('verified');
      expect(verifyResult.user.emailVerified).toBe(true);
    });
  });
});