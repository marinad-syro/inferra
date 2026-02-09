import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the error from crashing the app
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
