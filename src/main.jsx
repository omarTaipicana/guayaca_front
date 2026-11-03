import {restoreNativeSession} from './services/native/session.js';
import {registerWebUpdate} from './services/offline/update.js';
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import App from "./App.jsx";
restoreNativeSession().catch(()=>{}).finally(()=>{createRoot(document.getElementById('root')).render(<App/>);registerWebUpdate().catch(()=>{});});
