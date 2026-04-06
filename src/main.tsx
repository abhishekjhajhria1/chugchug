import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"
import { ChugProvider } from "./context/ChugContext"
import { ThemeProvider } from "./context/ThemeContext"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ChugProvider>
          <App />
        </ChugProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
