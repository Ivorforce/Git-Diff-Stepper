import React, { useRef } from 'react';
import ReactDOM from "react-dom/client";
import './App.css';

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import { StepperView, FileInfo } from './StepperView';
import { emit, listen } from '@tauri-apps/api/event'
import { useEffect } from 'react';

loader.config({ monaco });

function App() {
  const stepperViewRef = React.createRef<StepperView>();

  useEffect(() => {
    const unlisten = listen('openFile', async (event) => {
      stepperViewRef.current?.setFile(event.payload as FileInfo);
    });
    // Destructor destroys the listener: https://github.com/tauri-apps/tauri/discussions/5194
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return <StepperView ref={stepperViewRef}/>;
}

export default App;
