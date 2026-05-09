import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"
import { ChugProvider } from "./context/ChugContext"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./components/Toast"
import ErrorBoundary from "./components/ErrorBoundary"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ChugProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ChugProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
