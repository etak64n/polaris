import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no element with the ID root.");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary area="screen">
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);
