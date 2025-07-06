import Mailgun from 'mailgun.js'
import type { MailgunMessageData } from 'mailgun.js'

/**
 * Email service for sending emails via Mailgun
 * Configurable for both development and production environments
 */
export class EmailService {
  private mailgun: any
  private domain: string
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production'
    this.domain = process.env.MAILGUN_DOMAIN || 'sandbox-your-domain.mailgun.org'
    
    // In development, we can either use real Mailgun or mock it
    const apiKey = process.env.MAILGUN_API_KEY
    
    if (apiKey && !this.isDevelopment) {
      // Production: Use real Mailgun
      const mailgun = new Mailgun(fetch)
      this.mailgun = mailgun.client({
        username: 'api',
        key: apiKey,
        url: 'https://api.mailgun.net' // or 'https://api.eu.mailgun.net' for EU
      })
    } else if (apiKey && this.isDevelopment) {
      // Development with real Mailgun (for testing)
      const mailgun = new Mailgun(fetch)
      this.mailgun = mailgun.client({
        username: 'api',
        key: apiKey,
        url: 'https://api.mailgun.net'
      })
      console.log('📧 Using real Mailgun for development testing')
    } else {
      // Development without Mailgun (mock mode)
      console.log('📧 Mailgun not configured - using console logging for development')
      this.mailgun = null
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOTPEmail(email: string, otp: string, userName?: string): Promise<void> {
    const subject = 'Your Babel Feed Verification Code'
    const htmlContent = this.generateOTPEmailHTML(otp, userName)
    const textContent = this.generateOTPEmailText(otp, userName)

    if (!this.mailgun) {
      // Development mode - log to console
      console.log('📧 ===== OTP EMAIL (Development Mode) =====')
      console.log(`To: ${email}`)
      console.log(`Subject: ${subject}`)
      console.log(`OTP Code: ${otp}`)
      console.log('📧 ========================================')
      return
    }

    try {
      const messageData: MailgunMessageData = {
        from: `Babel Feed <noreply@${this.domain}>`,
        to: email,
        subject: subject,
        text: textContent,
        html: htmlContent
      }

      const result = await this.mailgun.messages.create(this.domain, messageData)
      
      console.log(`📧 OTP email sent successfully to ${email}`)
      console.log(`📧 Message ID: ${result.id}`)
      
      // In development, also log the OTP for easy testing
      if (this.isDevelopment) {
        console.log(`📧 OTP Code for testing: ${otp}`)
      }
    } catch (error) {
      console.error('📧 Failed to send OTP email:', error)
      throw new Error('Failed to send verification email')
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    const subject = 'Welcome to Babel Feed!'
    const htmlContent = this.generateWelcomeEmailHTML(userName)
    const textContent = this.generateWelcomeEmailText(userName)

    if (!this.mailgun) {
      // Development mode - log to console
      console.log('📧 ===== WELCOME EMAIL (Development Mode) =====')
      console.log(`To: ${email}`)
      console.log(`Subject: ${subject}`)
      console.log('📧 ==========================================')
      return
    }

    try {
      const messageData: MailgunMessageData = {
        from: `Babel Feed <noreply@${this.domain}>`,
        to: email,
        subject: subject,
        text: textContent,
        html: htmlContent
      }

      await this.mailgun.messages.create(this.domain, messageData)
      console.log(`📧 Welcome email sent successfully to ${email}`)
    } catch (error) {
      console.error('📧 Failed to send welcome email:', error)
      // Don't throw here - welcome email failure shouldn't block user registration
    }
  }

  /**
   * Generate HTML content for OTP email
   */
  private generateOTPEmailHTML(otp: string, userName?: string): string {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Babel Feed Verification Code</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .otp-code { 
      font-size: 32px; 
      font-weight: bold; 
      color: #2563eb; 
      text-align: center; 
      background: #f3f4f6; 
      padding: 20px; 
      border-radius: 8px; 
      letter-spacing: 8px;
      margin: 30px 0;
    }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 Babel Feed</h1>
      <h2>Email Verification</h2>
    </div>
    
    <p>${greeting},</p>
    
    <p>Thank you for joining Babel Feed! Please use the following 4-digit code to verify your email address:</p>
    
    <div class="otp-code">${otp}</div>
    
    <p>This code will expire in 10 minutes for security reasons.</p>
    
    <p>If you didn't request this verification, please ignore this email.</p>
    
    <div class="footer">
      <p>Best regards,<br>The Babel Feed Team</p>
      <p><em>Breaking language barriers, one story at a time.</em></p>
    </div>
  </div>
</body>
</html>`
  }

  /**
   * Generate text content for OTP email
   */
  private generateOTPEmailText(otp: string, userName?: string): string {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    
    return `
${greeting},

Thank you for joining Babel Feed! Please use the following 4-digit code to verify your email address:

${otp}

This code will expire in 10 minutes for security reasons.

If you didn't request this verification, please ignore this email.

Best regards,
The Babel Feed Team

Breaking language barriers, one story at a time.
`
  }

  /**
   * Generate HTML content for welcome email
   */
  private generateWelcomeEmailHTML(userName?: string): string {
    const greeting = userName ? `Welcome ${userName}` : 'Welcome'
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Babel Feed!</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .features { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .feature { margin-bottom: 15px; }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 ${greeting} to Babel Feed!</h1>
    </div>
    
    <p>Your email has been successfully verified, and your account is now active!</p>
    
    <div class="features">
      <h3>What you can do with Babel Feed:</h3>
      <div class="feature">📰 <strong>Read global news</strong> - Access articles from around the world</div>
      <div class="feature">🔄 <strong>Real-time translation</strong> - Translate content to your preferred language</div>
      <div class="feature">🎯 <strong>Personalized feed</strong> - Customize your news preferences</div>
      <div class="feature">📱 <strong>Mobile-first experience</strong> - Seamless reading on any device</div>
    </div>
    
    <p>Start exploring global news in your language today!</p>
    
    <div class="footer">
      <p>Happy reading!<br>The Babel Feed Team</p>
    </div>
  </div>
</body>
</html>`
  }

  /**
   * Generate text content for welcome email
   */
  private generateWelcomeEmailText(userName?: string): string {
    const greeting = userName ? `Welcome ${userName}` : 'Welcome'
    
    return `
${greeting} to Babel Feed!

Your email has been successfully verified, and your account is now active!

What you can do with Babel Feed:
• Read global news - Access articles from around the world
• Real-time translation - Translate content to your preferred language  
• Personalized feed - Customize your news preferences
• Mobile-first experience - Seamless reading on any device

Start exploring global news in your language today!

Happy reading!
The Babel Feed Team
`
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!this.mailgun || this.isDevelopment
  }

  /**
   * Get service status for health checks
   */
  getStatus(): { configured: boolean; mode: string; domain: string } {
    return {
      configured: this.isConfigured(),
      mode: this.mailgun ? 'mailgun' : 'console',
      domain: this.domain
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()