"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; provider?: string };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const navigation = [["⌂","Inicio"],["◇","Conversaciones"],["⌘","Desarrollo"],["▦","Mis proyectos"],["▧","Documentos"],["◎","Investigación"],["✦","Agentes IA"],["↻","Automatizaciones"],["◉","Memoria"],["€","Consumo"]];

export default function Home() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("auto");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const [dashboard, setDashboard] = useState({ conversations: 0, input_tokens: 0, output_tokens: 0, estimated_cost: 0 });

  useEffect(() => setToken(localStorage.getItem("trapero_token") || ""), []);
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/dashboard`, { headers: { Authorization: "Bearer " + token } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setDashboard(data))
      .catch(() => undefined);
  }, [token]);

  async function authenticate(mode: "login" | "register") {
    setError("");
    const response = await fetch(`${API}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.detail || "No se pudo iniciar sesión"); return; }
    localStorage.setItem("trapero_token", data.token);
    setToken(data.token);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !token) return;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    const submitted = message;
    setMessage("");
    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ message: submitted, provider, conversation_id: conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error del proveedor");
      setConversationId(data.conversation_id);
      setMessages((current) => [...current, { role: "assistant", content: data.text, provider: data.provider }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!token) return;
    setError("");
    const form = new FormData();
    form.append("upload", file);
    const response = await fetch(`${API}/api/files`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.detail || "No se pudo adjuntar el archivo");
    } else {
      setMessages((current) => [...current, { role: "assistant", content: `Archivo adjuntado: ${file.name}` }]);
    }
  }

  if (!token) return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand-mark">T</div>
        <p className="eyebrow">CENTRO DE OPERACIONES IA</p>
        <h1>TRAPERO AI</h1>
        <p className="auth-copy">Acceso privado para administrar, investigar y desarrollar.</p>
        <label>Correo electrónico<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
        <label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={() => authenticate("login")}>Entrar</button>
        <button className="secondary" onClick={() => authenticate("register")}>Crear cuenta privada</button>
      </section>
    </main>
  );

  return (
    <main className={dark ? "workspace" : "workspace light"}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">T</div><div><strong>TRAPERO</strong><span>AI</span></div></div>
        <nav>{navigation.map(([icon, label], index) => (
          <button className={index === 0 ? "nav active" : "nav"} key={label}><span>{icon}</span>{label}</button>
        ))}</nav>
        <button className="theme" onClick={() => setDark((value) => !value)}>◐ &nbsp; {dark ? "Modo claro" : "Modo oscuro"}</button>
      </aside>
      <section className="conversation">
        <header className="topbar">
          <div><p className="eyebrow">ASISTENTE IA</p><h1>Centro de operaciones</h1></div>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="Modelo">
            <option value="auto">Automático</option><option value="openai">GPT / OpenAI</option>
            <option value="anthropic">Claude / Anthropic</option><option value="gemini">Gemini / Google</option>
          </select>
        </header>
        <div className="chat">
          {messages.length === 0 ? (
            <div className="welcome"><div className="orb">T</div><h2>¿Qué vamos a ejecutar?</h2>
              <p>Analizo, diseño y desarrollo tareas reales con los modelos disponibles.</p>
              <div className="suggestions">{["Crear un plan de proyecto","Analizar documentos","Desarrollar una aplicación"].map((item) =>
                <button key={item} onClick={() => setMessage(item)}>{item}</button>)}</div>
            </div>
          ) : messages.map((item, index) => (
            <article className={`message ${item.role}`} key={index}>
              {item.role === "assistant" && <span className="provider">{item.provider || "TRAPERO"}</span>}<p>{item.content}</p>
            </article>
          ))}
        </div>
        {error && <p className="error chat-error">{error}</p>}
        <form className="composer" onSubmit={sendMessage}>
          <label className="attach" title="Adjuntar archivo">+<input type="file" onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])} /></label>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe el resultado que necesitas..." aria-label="Mensaje" />
          <button disabled={busy || !message.trim()} aria-label="Enviar">↑</button>
        </form>
      </section>
      <aside className="control">
        <p className="eyebrow">PANEL DE CONTROL</p><div className="status"><span className="live" /> Sistemas operativos</div>
        <div className="metric-grid">
          <div><strong>{dashboard.conversations}</strong><span>Conversaciones</span></div>
          <div><strong>{dashboard.input_tokens + dashboard.output_tokens}</strong><span>Tokens</span></div>
          <div><strong>€{dashboard.estimated_cost.toFixed(4)}</strong><span>Coste estimado</span></div><div><strong>3</strong><span>Proveedores</span></div>
        </div>
        <div className="provider-card"><span>OpenAI</span><b>Disponible</b></div>
        <div className="provider-card"><span>Anthropic</span><b>Disponible</b></div>
        <div className="provider-card"><span>Google Gemini</span><b>Disponible</b></div>
      </aside>
    </main>
  );
}
