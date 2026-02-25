import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./routes/landing";
import { Auth } from "./routes/auth";
import { Dashboard } from "./routes/dashboard";
import { Chat } from "./routes/chat";
import { ChatSession } from "./routes/chatSession";
import { Present } from "./routes/present";
import { Settings } from "./routes/settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<ChatSession />} />
        <Route path="/p/:slug" element={<Present />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
