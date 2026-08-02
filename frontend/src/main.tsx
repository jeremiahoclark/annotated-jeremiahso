import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

function App() {
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center px-6">
      <h1 className="font-headline text-5xl md:text-6xl tracking-tight text-primary">
        Annotated
      </h1>
      <p className="mt-4 font-body text-lg md:text-xl text-on-surface-variant text-center max-w-md">
        Clip it. Comment on it. Back it up.
      </p>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
