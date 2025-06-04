import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import Settings from "./Settings";
import { EAgentState, Message } from "./types/types";
import ChatInterface from "./Chat";
import { exampleMessages } from "./exampleMessages";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-provider";
import { toast, Toaster } from "sonner";
import LeftSidebar from "./LeftSidebar";
import { nanoid } from "nanoid";
import CanvasExcali from "./CanvasExcali";
import { Button } from "./components/ui/button";
import {
  HistoryIcon,
  MessageCircleIcon,
  SidebarIcon,
  SidebarOpenIcon,
} from "lucide-react";

function Home() {
  const [agentState, setAgentState] = useState(EAgentState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(nanoid());
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const { setTheme, theme } = useTheme();
  const [curFile, setCurFile] = useState("");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/config/exists")
      .then((res) => res.json())
      .then((data) => {
        if (!data.exists) {
          navigate("/settings");
        }
      });
  }, []);

  return (
    <div className="flex">
      <div
        style={{
          position: "fixed",
          right: "24%",
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        <CanvasExcali />
      </div>

      <div className="flex-1 flex-grow px-4 bg-accent w-[24%] absolute right-0">
        <ChatInterface
          sessionId={sessionId}
          editorTitle={editorTitle}
          editorContent={editorContent}
          onClickNewChat={() => {
            setSessionId(nanoid());
          }}
        />

        {/* <div className="absolute top-5 right-8 flex gap-1">
          <Button
            size={"sm"}
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          >
            {isRightSidebarOpen ? (
              <SidebarOpenIcon />
            ) : (
              <div className="flex">
                <ChevronLeftIcon />
                <ComputerIcon />
              </div>
            )}
          </Button>
        </div> */}
      </div>
      {isLeftSidebarOpen && (
        <div className="fixed left-0 top-0 w-[20%] bg-sidebar h-screen">
          <LeftSidebar
            sessionId={sessionId}
            setSessionId={setSessionId}
            curFile={curFile}
            setCurFile={setCurFile}
            onClose={() => setIsLeftSidebarOpen(false)}
          />
        </div>
      )}
      {!isLeftSidebarOpen && (
        <div className="fixed left-[60px] top-[16px]">
          <Button
            onClick={() => setIsLeftSidebarOpen(true)}
            variant={"secondary"}
          >
            <MessageCircleIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

function App() {
  const { theme } = useTheme();
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
