import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import forge from 'node-forge';

function keyPair() {
  const generated = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: forge.pki.privateKeyFromPem(generated.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string),
    publicKey: forge.pki.publicKeyFromPem(generated.publicKey.export({ type: 'pkcs1', format: 'pem' }) as string),
  };
}

function attributes(commonName: string) {
  return [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: 'Flowman' },
    { shortName: 'OU', value: 'Local Debugging' },
  ];
}

function netIsIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

export class CertStore {
  directory: string;
  cache: Map<string, { key: string; cert: string }>;
  caCert: forge.pki.Certificate | null = null;
  caKey: forge.pki.PrivateKey | null = null;
  caCertPem = '';
  caKeyPem = '';

  constructor(directory: string) {
    this.directory = directory;
    this.cache = new Map();
  }

  load(): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const certPath = path.join(this.directory, 'ca-cert.pem');
    const keyPath = path.join(this.directory, 'ca-key.pem');
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      this.caCertPem = fs.readFileSync(certPath, 'utf8');
      this.caKeyPem = fs.readFileSync(keyPath, 'utf8');
      this.caCert = forge.pki.certificateFromPem(this.caCertPem);
      this.caKey = forge.pki.privateKeyFromPem(this.caKeyPem);
      return;
    }
    const keys = keyPair();
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = crypto.randomBytes(16).toString('hex');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    const subject = attributes('Flowman Local CA');
    cert.setSubject(subject);
    cert.setIssuer(subject);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true, critical: true },
      { name: 'subjectKeyIdentifier' },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    this.caCert = cert;
    this.caKey = keys.privateKey;
    this.caCertPem = forge.pki.certificateToPem(cert);
    this.caKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    fs.writeFileSync(certPath, this.caCertPem, { mode: 0o644 });
    fs.writeFileSync(keyPath, this.caKeyPem, { mode: 0o600 });
    fs.writeFileSync(path.join(this.directory, 'ca-cert.der'), this.der(), { mode: 0o644 });
  }

  issue(host: string): { key: string; cert: string } {
    const normalized = String(host || 'localhost').toLowerCase();
    if (this.cache.has(normalized)) return this.cache.get(normalized)!;
    if (!this.caCert || !this.caKey) this.load();
    const keys = keyPair();
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = crypto.randomBytes(16).toString('hex');
    cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
    cert.setSubject(attributes(normalized));
    cert.setIssuer(this.caCert!.subject.attributes);
    const altNames = netIsIp(normalized)
      ? [{ type: 7, ip: normalized }]
      : [{ type: 2, value: normalized }];
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
      { name: 'subjectKeyIdentifier' },
    ]);
    cert.sign(this.caKey!, forge.md.sha256.create());
    const issued = {
      key: forge.pki.privateKeyToPem(keys.privateKey),
      cert: forge.pki.certificateToPem(cert),
    };
    this.cache.set(normalized, issued);
    return issued;
  }

  der(): Buffer {
    if (!this.caCert) this.load();
    const asn1 = forge.pki.certificateToAsn1(this.caCert!);
    const der = forge.asn1.toDer(asn1).getBytes();
    return Buffer.from(der, 'binary');
  }

  fingerprint(): string {
    return crypto.createHash('sha256').update(this.der()).digest('hex')
      .toUpperCase()
      .replace(/(.{2})/g, '$1 ')
      .trim();
  }
}
