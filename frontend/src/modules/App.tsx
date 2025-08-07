import { useEffect, useMemo, useState } from 'react';
import { COMMAND_SYNONYMS } from '@shared/types';

const LANGS = ['es','en','zh'] as const;
type Lang = typeof LANGS[number];

const DICT: Record<Lang, Record<string,string>> = {
  es: {
    title: 'Panel Admin',
    login: 'Iniciar sesión',
    logout: 'Salir',
    commandPlaceholder: 'Escribe /chef[restaurante]: mensaje',
    send: 'Enviar',
    logs: 'Logs',
    export: 'Exportar CSV'
  },
  en: {
    title: 'Admin Panel',
    login: 'Sign in',
    logout: 'Sign out',
    commandPlaceholder: 'Type /chef[restaurant]: message',
    send: 'Send',
    logs: 'Logs',
    export: 'Export CSV'
  },
  zh: {
    title: '管理面板',
    login: '登录',
    logout: '退出',
    commandPlaceholder: '输入 /chef[餐厅]: 信息',
    send: '发送',
    logs: '日志',
    export: '导出 CSV'
  }
};

export function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'es');
  const t = useMemo(() => DICT[lang], [lang]);

  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jwt'));
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  async function exchange() {
    // In real app, get Firebase ID token. Here we simulate failure handling.
    const idToken = 'DEMO_INVALID';
    try {
      const res = await fetch((import.meta as any).env.VITE_BACKEND_URL + '/api/auth/exchange', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok) { setToken(data.token); localStorage.setItem('jwt', data.token); }
    } catch {}
  }

  async function sendCommand() {
    if (!token || !input) return;
    const res = await fetch((import.meta as any).env.VITE_BACKEND_URL + '/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ input })
    });
    console.log(await res.json());
    await fetchLogs();
  }

  async function fetchLogs() {
    if (!token) return;
    const res = await fetch((import.meta as any).env.VITE_BACKEND_URL + '/api/logs', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setLogs(await res.json());
  }

  function exportCSV() {
    if (!token) return;
    const url = (import.meta as any).env.VITE_BACKEND_URL + '/api/logs/export';
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl; a.download = 'logs.csv'; a.click();
        URL.revokeObjectURL(objUrl);
      });
  }

  return (
    <div className="min-h-screen font-serif">
      <header className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h1 className="text-xl tracking-wide" style={{ color: 'var(--color-gold)' }}>{t.title}</h1>
        <div className="flex items-center gap-2">
          <select data-lang value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="bg-black border border-zinc-700 px-2 py-1 rounded">
            {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          {token ? (
            <button className="button-gold" onClick={() => { setToken(null); localStorage.removeItem('jwt'); }}>{t.logout}</button>
          ) : (
            <button className="button-gold" onClick={exchange}>{t.login}</button>
          )}
        </div>
      </header>

      <main className="p-4 grid gap-6">
        <section className="grid gap-2">
          <input data-lang placeholder={t.commandPlaceholder} value={input} onChange={(e) => setInput(e.target.value)} className="bg-black border border-zinc-700 px-3 py-2 rounded" />
          <div className="flex items-center gap-2">
            <button className="button-gold" onClick={sendCommand}>{t.send}</button>
            <button className="button-gold" onClick={exportCSV}>{t.export}</button>
            <button className="button-gold" onClick={fetchLogs}>{t.logs}</button>
          </div>
        </section>

        <section>
          <h2 className="mb-2" style={{ color: 'var(--color-gold)' }}>{t.logs}</h2>
          <div className="border border-zinc-800 rounded p-3 text-sm max-h-80 overflow-auto">
            {logs.map((l, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-zinc-800 py-1">
                <span className="opacity-70">{l.created_at}</span>
                <span>{l.restaurant_id}</span>
                <span>{l.role}</span>
                <span>{l.target}</span>
                <span className="truncate">{l.message}</span>
              </div>
            ))}
          </div>
        </section>

        <a href="#contact" className="fixed bottom-4 right-4 button-gold">Contacto</a>
      </main>
    </div>
  );
}