"use client";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 1. Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  // 2. Load all chats on initial render
  useEffect(() => {
    fetchChats();
  }, []);

  // 3. Fetch messages whenever you click a different chat
  useEffect(() => {
    if (activeChat) fetchMessages(activeChat);
    else setMessages([]);
  }, [activeChat]);

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setChats(data);
  };

  const fetchMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data);
  };

  const createNewChat = async () => {
    const { data, error } = await supabase
      .from("chats")
      .insert([{ title: "New Session" }])
      .select()
      .single();
    if (!error && data) {
      setChats([data, ...chats]);
      setActiveChat(data.id);
    }
  };

  const deleteChat = async (id: string) => {
    await supabase.from("chats").delete().eq("id", id);
    if (activeChat === id) setActiveChat(null);
    fetchChats();
  };

  const togglePin = async (id: string, currentPin: boolean) => {
    await supabase.from("chats").update({ is_pinned: !currentPin }).eq("id", id);
    fetchChats();
  };

  const renameChat = async (id: string) => {
    if (!newTitle.trim()) return;
    await supabase.from("chats").update({ title: newTitle }).eq("id", id);
    setEditingChatId(null);
    fetchChats();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let currentChatId = activeChat;
    
    // Auto-create a chat if typing for the first time
    if (!currentChatId) {
      const { data, error } = await supabase
        .from("chats")
        .insert([{ title: input.substring(0, 20) + "..." }])
        .select()
        .single();
      if (error || !data) return;
      currentChatId = data.id;
      setActiveChat(currentChatId);
      setChats([data, ...chats]);
    }

    const userMsg = input;
    setInput("");
    setIsLoading(true);

    // Optimistic UI Update for instant feeling
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", content: userMsg }]);

    // Save user message to database
    await supabase.from("messages").insert([{ chat_id: currentChatId, role: "user", content: userMsg }]);

    // Send to your Groq backend route
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg }),
      });
      const data = await res.json();
      const aiResponse = data.response || "Error generating response.";

      // Update UI with AI answer
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "ai", content: aiResponse }]);

      // Save AI answer to database
      await supabase.from("messages").insert([{ chat_id: currentChatId, role: "ai", content: aiResponse }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden selection:bg-purple-500/30 font-sans relative">
      
      {/* Animated Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-full blur-[150px] opacity-20 animate-pulse pointer-events-none z-0"></div>

      {/* SIDEBAR (20%) */}
      <aside className="w-1/4 min-w-[280px] max-w-sm border-r border-white/10 bg-white/5 backdrop-blur-xl z-10 flex flex-col p-4">
        <button 
          onClick={createNewChat}
          className="w-full py-3 mb-6 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-sm font-semibold uppercase tracking-widest shadow-lg"
        >
          + New Session
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {chats.map((chat) => (
            <div 
              key={chat.id} 
              className={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all border ${activeChat === chat.id ? 'bg-white/10 border-white/30 shadow-md' : 'bg-transparent border-transparent hover:bg-white/5'}`}
              onClick={() => setActiveChat(chat.id)}
            >
              <div className="flex items-center justify-between">
                
                {/* Chat Title / Rename Input */}
                {editingChatId === chat.id ? (
                  <input 
                    autoFocus
                    className="bg-black/50 text-white text-sm outline-none px-2 py-1 rounded w-full mr-2 border border-white/20"
                    defaultValue={chat.title}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && renameChat(chat.id)}
                    onBlur={() => renameChat(chat.id)}
                  />
                ) : (
                  <span className="text-sm font-medium truncate flex-1">
                    {chat.is_pinned && "📌 "}
                    {chat.title}
                  </span>
                )}

                {/* Hover Actions (Pin, Rename, Delete) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-2 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); togglePin(chat.id, chat.is_pinned); }} className="text-xs hover:scale-125 transition-transform" title="Pin">📌</button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setNewTitle(chat.title); }} className="text-xs hover:scale-125 transition-transform" title="Rename">✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} className="text-xs hover:scale-125 transition-transform text-red-400" title="Delete">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN WORKSPACE (80%) */}
      <main className="flex-1 flex flex-col relative z-10 p-6 md:p-12">
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pb-32 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-70">
              <div className="w-16 h-16 rounded-full border border-white/30 flex items-center justify-center mb-6 bg-white/5 shadow-2xl">
                <span className="text-2xl font-serif italic text-white/80">a</span>
              </div>
              <h2 className="text-xl font-light tracking-widest uppercase text-center bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                System Ready
              </h2>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl p-5 rounded-3xl backdrop-blur-md border shadow-2xl ${
                  msg.role === 'user' 
                    ? 'bg-purple-600/20 border-purple-500/30 rounded-br-sm' 
                    : 'bg-white/5 border-white/10 rounded-bl-sm'
                }`}>
                  
                  {/* Updated Markdown Renderer */}
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <div className="my-3 rounded-lg overflow-hidden border border-neutral-800">
                              <div className="bg-neutral-900 px-3 py-1 text-xs text-neutral-400 font-mono border-b border-neutral-800">
                                {match[1]}
                              </div>
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '1rem', background: '#111' }}
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200 text-xs font-mono" {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-2xl p-5 rounded-3xl backdrop-blur-md border bg-white/5 border-white/10 rounded-bl-sm animate-pulse">
                <p className="text-sm text-white/50 tracking-widest uppercase">Processing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6">
          <form onSubmit={sendMessage} className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-orange-500 rounded-full blur opacity-25 group-hover:opacity-40 transition-opacity duration-500"></div>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask the AI..." 
              className="relative w-full bg-black/60 border border-white/20 rounded-full px-8 py-4 text-white placeholder-white/30 focus:outline-none focus:border-white/50 backdrop-blur-xl transition-colors disabled:opacity-50 shadow-2xl"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white text-black p-2.5 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </form>
        </div>
      </main>

    </div>
  );
}