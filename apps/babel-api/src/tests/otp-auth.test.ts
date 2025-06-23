import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { userService } from '../services/user.service.js';
import { emailService } from '../services/email.service.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('OTP Authentication Flow', () => {
  let testGuestId: string;
  let testUserId: string;
  let testEmail: string;
  let otpCode: string;

  beforeAll(() => {
    testEmail = `test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should create a guest user', async () => {
    const guestUser = await userService.createGuestUser('test-device-fingerprint');
    
    expect(guestUser).toBeDefined();
    expect(guestUser.guestId).toBeDefined();
    expect(guestUser.guestId?.startsWith('guest_')).toBe(true);
    expect(guestUser.emailVerified).toBe(false);
    expect(guestUser.email).toBeNull();
    
    testGuestId = guestUser.guestId!;
    testUserId = guestUser.id;
  });

  it('should create account with email and generate 4-digit OTP', async () => {
    const result = await userService.createAccountFromGuest(testGuestId, testEmail);
    
    expect(result).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.user.emailVerified).toBe(false);
    expect(result.verificationToken).toBeDefined();
    
    // Verify OTP is 4 digits
    expect(result.verificationToken).toMatch(/^\d{4}$/);
    expect(result.verificationToken.length).toBe(4);
    
    otpCode = result.verificationToken;
  });

  it('should generate different OTP codes for different requests', async () => {
    // Create another guest user and account
    const anotherGuest = await userService.createGuestUser('another-device');
    const anotherEmail = `another-${Date.now()}@example.com`;
    const anotherResult = await userService.createAccountFromGuest(anotherGuest.guestId!, anotherEmail);
    
    // OTP codes should be different
    expect(anotherResult.verificationToken).not.toBe(otpCode);
    expect(anotherResult.verificationToken).toMatch(/^\d{4}$/);
    
    // Cleanup
    await db.delete(users).where(eq(users.id, anotherGuest.id));
  });

  it('should verify email with correct OTP and generate tokens', async () => {
    const result = await userService.verifyEmail(otpCode);
    
    expect(result).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.user.emailVerified).toBe(true);
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    
    // Verify tokens are different types
    expect(result.tokens.accessToken).not.toBe(result.tokens.refreshToken);
    expect(result.tokens.accessToken.length).toBeGreaterThan(50); // JWT token
    expect(result.tokens.refreshToken.length).toBe(64); // 32 bytes hex = 64 chars
  });

  it('should reject invalid OTP codes', async () => {
    const invalidOtps = ['1234', '0000', '9999', '5678'];
    
    for (const invalidOtp of invalidOtps) {
      if (invalidOtp !== otpCode) { // Skip if it happens to match our real OTP
        try {
          await userService.verifyEmail(invalidOtp);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Invalid or expired');
        }
      }
    }
  });

  it('should reject expired OTP codes', async () => {
    // Create a new account to test expiration
    const expiredGuest = await userService.createGuestUser('expired-device');
    const expiredEmail = `expired-${Date.now()}@example.com`;
    const expiredResult = await userService.createAccountFromGuest(expiredGuest.guestId!, expiredEmail);
    
    // Manually expire the token by setting expiry to past
    await db.update(users)
      .set({ verificationTokenExpiry: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(users.id, expiredGuest.id));
    
    try {
      await userService.verifyEmail(expiredResult.verificationToken);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('expired');
    }
    
    // Cleanup
    await db.delete(users).where(eq(users.id, expiredGuest.id));
  });

  it('should prevent email reuse', async () => {
    const duplicateGuest = await userService.createGuestUser('duplicate-device');
    
    try {
      await userService.createAccountFromGuest(duplicateGuest.guestId!, testEmail);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('already registered');
    }
    
    // Cleanup
    await db.delete(users).where(eq(users.id, duplicateGuest.id));
  });

  it('should validate access tokens', async () => {
    // First verify email to get tokens
    const result = await userService.verifyEmail(otpCode);
    const user = await userService.validateAccessToken(result.tokens.accessToken);
    
    expect(user).toBeDefined();
    expect(user!.email).toBe(testEmail);
    expect(user!.emailVerified).toBe(true);
  });

  it('should refresh tokens', async () => {
    // First verify email to get tokens
    const result = await userService.verifyEmail(otpCode);
    const newTokens = await userService.refreshToken(result.tokens.refreshToken);
    
    expect(newTokens).toBeDefined();
    expect(newTokens!.accessToken).toBeDefined();
    expect(newTokens!.refreshToken).toBeDefined();
    expect(newTokens!.accessToken).not.toBe(result.tokens.accessToken);
    expect(newTokens!.refreshToken).not.toBe(result.tokens.refreshToken);
  });

  it('should logout and invalidate tokens', async () => {
    // First verify email to get tokens
    const result = await userService.verifyEmail(otpCode);
    
    // Logout
    await userService.logout(result.tokens.accessToken);
    
    // Token should no longer be valid for refresh
    const refreshResult = await userService.refreshToken(result.tokens.refreshToken);
    expect(refreshResult).toBeNull();
  });

  it('should validate email service configuration', () => {
    expect(emailService.isConfigured()).toBe(true);
    
    const status = emailService.getStatus();
    expect(status.configured).toBe(true);
    expect(status.mode).toBe('console'); // In development
  });
});