import { Elysia } from "elysia";

/**
 * Simple request counter and stats middleware
 */
class RequestStats {
  private stats = {
    totalRequests: 0,
    requestsByMethod: new Map<string, number>(),
    requestsByPath: new Map<string, number>(),
    requestsByStatus: new Map<number, number>(),
    averageResponseTime: 0,
    totalResponseTime: 0,
    startTime: Date.now()
  };

  incrementRequest(method: string, path: string) {
    this.stats.totalRequests++;
    this.stats.requestsByMethod.set(method, (this.stats.requestsByMethod.get(method) || 0) + 1);
    this.stats.requestsByPath.set(path, (this.stats.requestsByPath.get(path) || 0) + 1);
  }

  recordResponse(status: number, duration: number) {
    this.stats.requestsByStatus.set(status, (this.stats.requestsByStatus.get(status) || 0) + 1);
    this.stats.totalResponseTime += duration;
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests;
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      requestsByMethod: Object.fromEntries(this.stats.requestsByMethod),
      requestsByPath: Object.fromEntries(this.stats.requestsByPath),
      requestsByStatus: Object.fromEntries(this.stats.requestsByStatus),
      uptime,
      requestsPerMinute: (this.stats.totalRequests / (uptime / 60000)).toFixed(2)
    };
  }

  reset() {
    this.stats = {
      totalRequests: 0,
      requestsByMethod: new Map(),
      requestsByPath: new Map(),
      requestsByStatus: new Map(),
      averageResponseTime: 0,
      totalResponseTime: 0,
      startTime: Date.now()
    };
  }
}

const requestStats = new RequestStats();

export const statsMiddleware = new Elysia({ name: "stats" })
  .onRequest(({ request }) => {
    const url = request.url;
    const path = new URL(url).pathname;
    requestStats.incrementRequest(request.method, path);
  })
  
  .onAfterHandle(({ set }) => {
    const status = typeof set.status === 'number' ? set.status : 200;
    requestStats.recordResponse(status, 0); // Duration tracking simplified
  });

/**
 * Stats endpoint to view request statistics
 */
export const statsRoute = new Elysia()
  .get("/api/debug/stats", () => {
    return {
      ...requestStats.getStats(),
      timestamp: new Date().toISOString()
    };
  })
  
  .delete("/api/debug/stats", () => {
    requestStats.reset();
    return {
      message: "Request stats reset successfully",
      timestamp: new Date().toISOString()
    };
  }); 