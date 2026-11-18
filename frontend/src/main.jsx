/// <reference path="./globals.d.ts" />
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import {StoreProvider} from './ServerStoreContext.jsx';
import './styles.css';

createRoot(/** @type {HTMLElement} */ (document.getElementById('root'))).render(
    <React.StrictMode>
        <StoreProvider>
            <App/>
        </StoreProvider>
    </React.StrictMode>,
);
