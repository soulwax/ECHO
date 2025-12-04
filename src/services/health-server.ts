// File: src/services/health-server.ts

import http from 'http';
import { injectable, inject } from 'inversify';
import { Client } from 'discord.js';
import { TYPES } from '../types.js';
import Config from './config.js';

@injectable()
export default class HealthServer {
  private readonly client: Client;
  private readonly config: Config;
  private server: http.Server | null = null;

  constructor(
    @inject(TYPES.Client) client: Client,
    @inject(TYPES.Config) config: Config
  ) {
    this.client = client;
    this.config = config;
  }

  public start(): void {
    const port = process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : 3002;

    this.server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/health' && req.method === 'GET') {
        const isReady = this.client.isReady();
        const guildsCount = this.client.guilds.cache.size;
        const uptime = this.client.uptime || 0;

        const healthData = {
          status: isReady ? 'ok' : 'not_ready',
          ready: isReady,
          guilds: guildsCount,
          uptime: uptime,
          uptimeFormatted: this.formatUptime(uptime),
          timestamp: new Date().toISOString(),
        };

        res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(port, () => {
      console.log(`🏥 Health server running on http://localhost:${port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
