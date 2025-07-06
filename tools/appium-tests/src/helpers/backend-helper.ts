/**
 * Backend API Helper
 * Utilities for interacting with the backend API during tests
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BackendHelper {
  private baseUrl = 'http://localhost:3000'

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }

  async waitForBackend(timeout = 60000): Promise<void> {
    console.log('🔍 Waiting for backend to be ready...')
    
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      if (await this.checkHealth()) {
        console.log('✅ Backend is ready')
        return
      }
      await this.delay(1000)
    }
    
    throw new Error(`Backend not ready within ${timeout}ms`)
  }

  async createTestUser(email: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async sendOTP(email: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async verifyOTP(email: string, otpCode: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode })
      })
      
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async getArticles(limit = 10): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/articles?limit=${limit}`)
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/translation/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage })
      })
      
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async deleteTestUser(email: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/delete-user`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}