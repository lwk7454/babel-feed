#!/usr/bin/env bun

/**
 * Test script for OTP authentication flow
 */

const API_BASE = 'http://localhost:3000/api';

async function testOTPFlow() {
  console.log('🧪 Testing OTP Authentication Flow\n');

  try {
    // Step 1: Create guest user
    console.log('📝 Step 1: Creating guest user...');
    const guestResponse = await fetch(`${API_BASE}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFingerprint: 'test-device-123' })
    });
    
    if (!guestResponse.ok) {
      throw new Error(`Guest creation failed: ${guestResponse.status}`);
    }
    
    const guestData = await guestResponse.json();
    console.log('✅ Guest user created:', guestData.data);
    const guestId = guestData.data.guestId;

    // Step 2: Create account with email (triggers OTP)
    console.log('\n📧 Step 2: Creating account with email (will send OTP)...');
    const accountResponse = await fetch(`${API_BASE}/auth/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        guestId: guestId,
        email: 'test@example.com' 
      })
    });
    
    if (!accountResponse.ok) {
      throw new Error(`Account creation failed: ${accountResponse.status}`);
    }
    
    const accountData = await accountResponse.json();
    console.log('✅ Account created, verification email sent:', accountData.data);

    // Step 3: Prompt for OTP (in development it's logged to console)
    console.log('\n🔢 Step 3: Check the API server console for the 4-digit OTP code');
    console.log('📧 In development mode, the OTP will be logged to the API server console');
    console.log('📧 Look for a message like: "📧 OTP Code for testing: 1234"');
    console.log('\n⚠️  Note: In production, this would be sent via Mailgun email');
    console.log('\n🎯 To complete the test, use the OTP code with:');
    console.log(`curl -X POST ${API_BASE}/auth/verify \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"verificationToken": "YOUR_4_DIGIT_OTP"}'`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOTPFlow();