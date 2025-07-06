import { cleanupTestDatabase, clearTestData, db, getTestDb, setupTestDatabase, users } from '@babel-feed/pgdb'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { UserService } from '../services/user.service'
import { EmailService } from '../services/email.service'

describe('OTP Authentication Flow - Fixed', () => {
  const testUsers: string[] = []
  let userService: UserService
  let emailService: EmailService

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(() => {
    userService = new UserService(getTestDb())
    emailService = new EmailService()
  })

  afterEach(async () => {
    await clearTestData()
  })

  it('should create a guest user', async () => {
    const guestUser = await userService.createGuestUser('test-device-fingerprint')
    testUsers.push(guestUser.id)
    
    expect(guestUser).toBeDefined()
    expect(guestUser.guestId).toBeDefined()
    expect(guestUser.guestId?.startsWith('guest_')).toBe(true)
    expect(guestUser.emailVerified).toBe(false)
    expect(guestUser.email).toBeNull()
  })

  it('should create account with email and generate 4-digit OTP', async () => {
    const guestUser = await userService.createGuestUser('otp-test-device')
    testUsers.push(guestUser.id)
    const testEmail = `otp-test-${Date.now()}@example.com`
    
    const result = await userService.createAccountFromGuest(guestUser.guestId!, testEmail)
    
    expect(result).toBeDefined()
    expect(result.user.email).toBe(testEmail)
    expect(result.user.emailVerified).toBe(false)
    expect(result.verificationToken).toBeDefined()
    
    // Verify OTP is 4 digits
    expect(result.verificationToken).toMatch(/^\d{4}$/)
    expect(result.verificationToken.length).toBe(4)
  })

  it('should generate different OTP codes for different requests', async () => {
    const guest1 = await userService.createGuestUser('diff-test-1')
    const guest2 = await userService.createGuestUser('diff-test-2')
    testUsers.push(guest1.id, guest2.id)
    
    const email1 = `diff1-${Date.now()}@example.com`
    const email2 = `diff2-${Date.now()}@example.com`
    
    const result1 = await userService.createAccountFromGuest(guest1.guestId!, email1)
    const result2 = await userService.createAccountFromGuest(guest2.guestId!, email2)
    
    // OTP codes should be different
    expect(result1.verificationToken).not.toBe(result2.verificationToken)
    expect(result1.verificationToken).toMatch(/^\d{4}$/)
    expect(result2.verificationToken).toMatch(/^\d{4}$/)
  })

  it('should complete full authentication flow', async () => {
    const guestUser = await userService.createGuestUser('full-flow-device')
    testUsers.push(guestUser.id)
    const testEmail = `fullflow-${Date.now()}@example.com`
    
    // Step 1: Create account with email
    const accountResult = await userService.createAccountFromGuest(guestUser.guestId!, testEmail)
    expect(accountResult.verificationToken).toMatch(/^\d{4}$/)
    
    // Step 2: Verify email with OTP
    const verifyResult = await userService.verifyEmail(accountResult.verificationToken)
    expect(verifyResult.user.email).toBe(testEmail)
    expect(verifyResult.user.emailVerified).toBe(true)
    expect(verifyResult.tokens.accessToken).toBeDefined()
    expect(verifyResult.tokens.refreshToken).toBeDefined()
    
    // Step 3: Validate access token
    const user = await userService.validateAccessToken(verifyResult.tokens.accessToken)
    expect(user).toBeDefined()
    expect(user!.email).toBe(testEmail)
    expect(user!.emailVerified).toBe(true)
    
    // Step 4: Refresh tokens
    const newTokens = await userService.refreshToken(verifyResult.tokens.refreshToken)
    expect(newTokens).toBeDefined()
    expect(newTokens!.accessToken).not.toBe(verifyResult.tokens.accessToken)
    expect(newTokens!.refreshToken).not.toBe(verifyResult.tokens.refreshToken)
    
    // Step 5: Logout
    await userService.logout(newTokens!.accessToken)
    const refreshAfterLogout = await userService.refreshToken(newTokens!.refreshToken)
    expect(refreshAfterLogout).toBeNull()
  })

  it('should reject invalid OTP codes', async () => {
    const guestUser = await userService.createGuestUser('invalid-otp-device')
    testUsers.push(guestUser.id)
    const testEmail = `invalid-${Date.now()}@example.com`
    
    await userService.createAccountFromGuest(guestUser.guestId!, testEmail)
    
    const invalidOtps = ['0000', '9999', '1111', '5678']
    
    for (const invalidOtp of invalidOtps) {
      try {
        await userService.verifyEmail(invalidOtp)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Invalid or expired')
      }
    }
  })

  it('should reject expired OTP codes', async () => {
    const guestUser = await userService.createGuestUser('expired-device')
    testUsers.push(guestUser.id)
    const testEmail = `expired-${Date.now()}@example.com`
    
    const result = await userService.createAccountFromGuest(guestUser.guestId!, testEmail)
    
    // Manually expire the token by setting expiry to past
    await db.update(users)
      .set({ verificationTokenExpiry: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(users.id, guestUser.id))
    
    try {
      await userService.verifyEmail(result.verificationToken)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('expired')
    }
  })

  it('should prevent email reuse', async () => {
    const guest1 = await userService.createGuestUser('reuse-test-1')
    const guest2 = await userService.createGuestUser('reuse-test-2')
    testUsers.push(guest1.id, guest2.id)
    const testEmail = `reuse-${Date.now()}@example.com`
    
    // First account creation should succeed
    await userService.createAccountFromGuest(guest1.guestId!, testEmail)
    
    // Second account creation with same email should fail
    try {
      await userService.createAccountFromGuest(guest2.guestId!, testEmail)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('already registered')
    }
  })

  it('should validate email service configuration', () => {
    expect(emailService.isConfigured()).toBe(true)
    
    const status = emailService.getStatus()
    expect(status.configured).toBe(true)
    expect(status.mode).toBe('console') // In development
  })

  it('should reject OTP reuse after successful verification', async () => {
    const guestUser = await userService.createGuestUser('reuse-otp-device')
    testUsers.push(guestUser.id)
    const testEmail = `otpreuse-${Date.now()}@example.com`
    
    const accountResult = await userService.createAccountFromGuest(guestUser.guestId!, testEmail)
    const otpCode = accountResult.verificationToken
    
    // First verification should succeed
    const verifyResult = await userService.verifyEmail(otpCode)
    expect(verifyResult.user.emailVerified).toBe(true)
    
    // Second verification with same OTP should fail
    try {
      await userService.verifyEmail(otpCode)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('Invalid or expired')
    }
  })
})