import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./routes/landing";
import { Auth } from "./routes/auth";
import { Dashboard } from "./routes/dashboard";
import { Chat } from "./routes/chat";
import { ChatSession } from "./routes/chatSession";
import { Present } from "./routes/present";
import { Settings } from "./routes/settings";
import { Themes } from "./routes/themes";

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
        <Route path="/themes" element={<Themes />} />
        <Route path="/themes/new" element={<Themes />} />
        <Route path="/themes/:themeId/edit" element={<Themes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
