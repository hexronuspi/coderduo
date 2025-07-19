"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Highlight, themes, type Language } from 'prism-react-renderer';
import { Download, BrainCircuit } from 'lucide-react';
import { useMistralChat } from '@/lib/mistral-api';
// Assuming these are correctly set up for client-side usage
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

const initialCode = `// Welcome to your collaborative editor.
// Start writing your masterpiece.
`;

/**
 * A map to get the correct file extension for a given language.
 */
const languageExtensions: Partial<Record<Language, string>> = {
  javascript: 'js',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  java: 'java',
  cpp: 'cpp',
  html: 'html',
  css: 'css',
  go: 'go',
  rust: 'rs',
};

const AI_ANALYSIS_HEADER = '// --- AI Analysis ---';

/**
 * Removes previous AI analysis comments from the code string.
 * @param code The full code string from the editor.
 * @returns The code with the AI analysis block removed.
 */
const stripAiComments = (code: string): string => {
  const analysisStartIndex = code.indexOf(AI_ANALYSIS_HEADER);
  if (analysisStartIndex !== -1) {
    // Trim trailing whitespace from the user's code
    return code.substring(0, analysisStartIndex).trimEnd();
  }
  return code;
};

/**
 * Parses the LLM's string response, attempting to extract a JSON object.
 * @param llmReply The raw string reply from the LLM.
 * @returns A parsed object, or a default error object.
 */
const parseLlmResponse = (llmReply: string | null): { analysis: string; reason: string; error?: string } => {
  if (!llmReply) {
    return { analysis: '', reason: '', error: 'No LLM response received.' };
  }

  try {
    // Try to extract a JSON block from the string
    const jsonMatch = llmReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // The prompt expects a JSON with keys "0" (analysis) and "1" (reason)
      return {
        analysis: parsed['0'] || '',
        reason: parsed['1'] || 'No reason provided.',
      };
    }
  } catch{
    // If parsing fails, treat the entire reply as the analysis for robustness.
    return {
      analysis: `${llmReply}`,
      reason: 'Response parsing failed.',
      error: 'Error parsing JSON from LLM response.',
    };
  }

  // Fallback if no JSON is found
  return {
    analysis: llmReply,
    reason: 'Response was not in the expected JSON format.',
    error: 'No JSON object found in LLM response.',
  };
};


const AcademicCodeEditor = () => {
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('collab_code') || initialCode;
    }
    return initialCode;
  });

  const [isUnsaved, setIsUnsaved] = useState(false);
  const [language, setLanguage] = useState<Language>('javascript');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- Hooks and Client-side dependencies ---
  // Memoize to prevent re-creation on every render
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams();
  const problemTitle = useMemo(() => params?.title ? decodeURIComponent(params.title as string) : '', [params.title]);
  const { sendMessage, messages } = useMistralChat(problemTitle);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  /**
   * Main analysis handler
   */
  const handleAnalyse = useCallback(async () => {
    setIsAnalysing(true);
    setAnalysisError(null);

    const userCodeToAnalyse = stripAiComments(code);

    try {
      // 1. Get question data from Supabase
      const { data: questionRow, error: questionError } = await supabase
        .from('questions_user')
        .select('*')
        .eq('title', problemTitle)
        .single();

      if (questionError || !questionRow) {
        throw new Error(`Question "${problemTitle}" not found or failed to load.`);
      }

      // 2. Load the prompt template
      let promptTemplate = '';
      try {
        const promptRes = await fetch('/data/prompts/mistral.json');
        promptTemplate = (await promptRes.json())['questionChatWithHistory'] || '';
      } catch (e) {
        console.warn('Could not load prompt template, proceeding without it.', e);
      }
      
      const prevCollabChat = Array.isArray(questionRow.collaborator_chat) ? questionRow.collaborator_chat : [];
      const historyString = prevCollabChat.map((c: string, idx: number) => `Attempt ${idx + 1}:\n${c}`).join('\n\n');

      // 3. Construct the full prompt for the LLM
      const prompt = promptTemplate
        .replace(/{title}/g, questionRow.title)
        .replace(/{question}/g, questionRow.question)
        .replace(/{hint}/g, Array.isArray(questionRow.hint) ? questionRow.hint.join('\n') : '')
        .replace(/{solution}/g, questionRow.solution || '')
        .replace(/{history}/g, historyString)
        .replace(/{query}/g, `User's Current Code:\n${userCodeToAnalyse}`);
        
      // 4. Send the message and wait for the response
      // This part now relies on the `messages` state from the `useMistralChat` hook being updated.
      const initialMessageCount = messages.length;
      await sendMessage(prompt, {
        title: '',
        question: '',
        hint: [],
        solution: ''
      }, 'codeAnalysis');

      // Poll for the new assistant message
      let llmReply: string | null = null;
      for (let i = 0; i < 20; i++) { // Poll for 6 seconds (20 * 300ms)
        const currentChatHistory = JSON.parse(localStorage.getItem(`chat_history_${problemTitle}`) || '[]');
        if (currentChatHistory.length > initialMessageCount) {
          const lastMsg = currentChatHistory[currentChatHistory.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            llmReply = lastMsg.content;
            break;
          }
        }
        await new Promise(res => setTimeout(res, 300));
      }

      // 5. Parse the response
      const { analysis, error: parseError } = parseLlmResponse(llmReply);
      if (parseError) console.warn(parseError);

      // 6. Update Supabase with the new attempt and diff
      const newCollabChat = [...prevCollabChat, userCodeToAnalyse];
      const tdiff = questionRow.tdiff || {};
      const tdiffIndex = Object.keys(tdiff).length;
      tdiff[tdiffIndex] = { usercodediff: userCodeToAnalyse, llmreason: llmReply };

      await supabase
        .from('questions_user')
        .update({ collaborator_chat: newCollabChat, tdiff })
        .eq('id', questionRow.id);

      // 7. **UNIFY THE CANVAS**: Update the code state with the AI's feedback
      if (analysis && analysis.trim()) {
        const commentedAnalysis = analysis.split('\n').map(line => `// ${line}`).join('\n');
        const newCode = `${userCodeToAnalyse}\n\n${AI_ANALYSIS_HEADER}\n${commentedAnalysis}\n`;
        setCode(newCode);
        localStorage.setItem('collab_code', newCode); // Persist the full new code
      } else {
        // If AI gives no feedback, at least save the user's stripped code
        localStorage.setItem('collab_code', userCodeToAnalyse);
      }

      setIsUnsaved(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Analysis Error:', errorMessage);
      setAnalysisError(`Error during analysis: ${errorMessage}`);
    } finally {
      setIsAnalysing(false);
    }
  }, [code, supabase, problemTitle, sendMessage, messages]);

  // Syncs the scroll position of the textarea and the highlighted pre.
  const syncScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  const handleCodeChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = event.target.value;
    setCode(newCode);
    setIsUnsaved(true);
    setAnalysisError(null); // Clear error on new input
    localStorage.setItem('collab_code', newCode);
  }, []);

  // Advanced Tab handling for indentation.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { value, selectionStart, selectionEnd } = e.currentTarget;
      const indent = '  ';
      const newCode = value.substring(0, selectionStart) + indent + value.substring(selectionEnd);
      setCode(newCode);

      // Set cursor position after state update
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + indent.length;
        }
      }, 0);
    }
  }, []);

  // Export code to a file.
  const handleExport = useCallback(() => {
    const codeToExport = stripAiComments(code); // Export only user code
    const extension = languageExtensions[language] || 'txt';
    const blob = new Blob([codeToExport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coder_solution.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, language]);

  // Auto-detect language based on code content (debounced).
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedCode = code.trim();
      if (/^#include|int\s+main\s*\(|std::/i.test(trimmedCode)) setLanguage('cpp');
      else if (/^public\s+class|System\.out\.println/i.test(trimmedCode)) setLanguage('java');
      else if (/^def\s|print\(|import\s+/i.test(trimmedCode)) setLanguage('python');
      else if (/<[a-z][\s\S]*>/i.test(trimmedCode)) setLanguage('html');
      else if (/\.[a-zA-Z0-9-]+\s*\{/i.test(trimmedCode)) setLanguage('css');
      else if (/package main|func main/i.test(trimmedCode)) setLanguage('go');
      else if (/fn main|use std::/i.test(trimmedCode)) setLanguage('rust');
      else if (/`jsx`|=>\s*\(</i.test(trimmedCode)) setLanguage('tsx');
      else if (/function\s|console\.log|const\s|let\s/i.test(trimmedCode)) setLanguage('javascript');
    }, 500);
    return () => clearTimeout(timer);
  }, [code]);

  // Inject styles for the textarea selection to keep syntax highlighting visible.
  useEffect(() => {
    const styleId = 'editor-selection-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      .code-editor-textarea::selection {
        background-color: rgba(0, 120, 215, 0.2);
      }
    `;
  }, []);

  const currentSyntaxTheme = themes.oneLight;
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div className="rounded-xl shadow-lg border w-full h-full flex flex-col overflow-hidden bg-white border-gray-200">
      {/* Header Bar */}
      <header className="flex justify-between items-center p-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="font-sans text-lg font-semibold text-gray-800">Editor</h2>
        <div className="flex items-center space-x-4">
          <span
            className={`w-3 h-3 rounded-full border border-gray-400 transition-colors ${isUnsaved ? 'bg-yellow-400' : 'bg-green-500'}`}
            title={isUnsaved ? 'Unsaved changes' : 'Code is saved'}
          />
          <span className="px-2 py-1 rounded text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200">
            {language.toUpperCase()}
          </span>
          <button onClick={handleExport} title="Export User Code" className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors">
            <Download size={20} />
          </button>
          <button
            onClick={handleAnalyse}
            disabled={isAnalysing || !isUnsaved}
            title={!isUnsaved ? "No changes to analyse" : "Analyse with AI"}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <BrainCircuit size={16} />
            {isAnalysing ? 'Analysing...' : 'Analyse'}
          </button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-grow w-full flex font-mono text-base leading-relaxed overflow-hidden relative">
        {/* Line Numbers Gutter */}
        <div className="select-none text-right pr-4 pt-4 shrink-0 text-gray-400 bg-white z-10 sticky left-0">
          {lineNumbers.map(num => (
            <div key={num}>{num}</div>
          ))}
        </div>
        
        {/* Code Area */}
        <div className="relative flex-grow h-full" style={{ fontVariantLigatures: 'none' }}>
          <Highlight theme={currentSyntaxTheme} code={code + '\n'} language={language}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                ref={preRef}
                className={`${className} absolute inset-0 m-0 p-4 overflow-auto scrollbar-hide pointer-events-none whitespace-pre-wrap break-words`}
                style={{ ...style, backgroundColor: 'transparent', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                aria-hidden="true"
              >
                {tokens.map((line, i) => {
                   // Don't render the final extra line from Highlight's perspective
                  if (i === tokens.length - 1 && line.length === 1 && line[0].empty) {
                    return null;
                  }
                  return (
                    <div key={i} {...getLineProps({ line, key: i })}>
                      {line.map((token, key) => <span key={key} {...getTokenProps({ token, key })} />)}
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            className="code-editor-textarea absolute inset-0 w-full h-full p-4 bg-transparent border-none outline-none resize-none 
                       font-mono text-base leading-relaxed text-transparent caret-black overflow-auto whitespace-pre-wrap break-words"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            aria-label="Code Editor"
          />
        </div>
      </div>
       {/* Status/Error Footer */}
       {analysisError && (
          <div className="flex-shrink-0 p-2 text-sm text-red-700 bg-red-50 border-t border-red-200">
            <strong>Error:</strong> {analysisError}
          </div>
        )}
    </div>
  );
};

export default AcademicCodeEditor;