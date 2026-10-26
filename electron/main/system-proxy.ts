import { execFile } from 'child_process';
import os from 'os';
import path from 'path';

export interface SystemProxyResult {
  ok: boolean;
  message: string;
  services: string[];
  enabled: boolean;
}

export class SystemProxyManager {
  systemProxyOwned = false;
  systemProxyServices: string[] = [];
  systemProxyError = '';

  listServices(): Promise<{ error?: string; services: string[] }> {
    return new Promise((resolve) => {
      execFile('networksetup', ['-listallnetworkservices'], (error, stdout) => {
        if (error) return resolve({ error: error.message, services: [] });
        const services = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('An asterisk') && !line.startsWith('*'));
        resolve({ services });
      });
    });
  }

  runNetworksetup(args: string[]): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      execFile('networksetup', args, (error, stdout, stderr) => {
        resolve({ ok: !error, message: error ? `${error.message} ${stderr || ''}`.trim() : stdout.trim() });
      });
    });
  }

  async disableRememberedServices(): Promise<SystemProxyResult> {
    const services = this.systemProxyServices.slice();
    const errors: string[] = [];
    for (const service of services) {
      for (const args of [
        ['-setwebproxystate', service, 'off'],
        ['-setsecurewebproxystate', service, 'off'],
      ]) {
        const result = await this.runNetworksetup(args);
        if (!result.ok) errors.push(`${service}: ${result.message}`);
      }
    }
    if (errors.length) {
      this.systemProxyOwned = services.length > 0;
      this.systemProxyError = errors.join('；');
    } else {
      this.systemProxyServices = [];
      this.systemProxyOwned = false;
      this.systemProxyError = '';
    }
    return { ok: errors.length === 0, message: this.systemProxyError, services: this.systemProxyServices, enabled: false };
  }

  async setSystemProxy(enabled: boolean, port: number, proxyRunning: boolean, lastError = ''): Promise<SystemProxyResult> {
    if (!enabled) return this.disableRememberedServices();
    if (!proxyRunning) {
      this.systemProxyError = lastError || '代理还没启动';
      return { ok: false, message: this.systemProxyError, services: [], enabled: false };
    }
    const listed = await this.listServices();
    if (listed.error) {
      this.systemProxyError = listed.error;
      return { ok: false, message: this.systemProxyError, services: this.systemProxyServices, enabled: this.systemProxyOwned };
    }
    if (!listed.services.length) {
      this.systemProxyError = '没有找到已启用的网络服务';
      return { ok: false, message: this.systemProxyError, services: [], enabled: false };
    }
    const applied = new Set(this.systemProxyServices);
    const errors: string[] = [];
    for (const service of listed.services) {
      const web = await this.runNetworksetup(['-setwebproxy', service, '127.0.0.1', String(port)]);
      if (!web.ok) {
        errors.push(`${service}: ${web.message}`);
        continue;
      }
      const secure = await this.runNetworksetup(['-setsecurewebproxy', service, '127.0.0.1', String(port)]);
      if (!secure.ok) {
        errors.push(`${service}: ${secure.message}`);
        await this.runNetworksetup(['-setwebproxystate', service, 'off']);
        applied.delete(service);
        continue;
      }
      await this.runNetworksetup(['-setproxybypassdomains', service, '*.local', '169.254/16']);
      applied.add(service);
    }
    this.systemProxyServices = [...applied];
    this.systemProxyOwned = this.systemProxyServices.length > 0;
    this.systemProxyError = errors.length
      ? (this.systemProxyOwned ? `部分网络未接管：${errors.join('；')}` : errors.join('；'))
      : '';
    return {
      ok: this.systemProxyOwned && errors.length === 0,
      message: this.systemProxyError,
      services: this.systemProxyServices,
      enabled: this.systemProxyOwned,
    };
  }

  installCaToKeychain(caPath: string): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      execFile('security', [
        'add-trusted-cert',
        '-r', 'trustRoot',
        '-p', 'ssl',
        '-k', path.join(os.homedir(), 'Library/Keychains/login.keychain-db'),
        caPath,
      ], (error) => {
        if (error) resolve({ ok: false, message: `安装失败: ${error.message}` });
        else resolve({ ok: true, message: 'Flowman CA 证书已成功安装并信任到系统钥匙串！' });
      });
    });
  }
}
