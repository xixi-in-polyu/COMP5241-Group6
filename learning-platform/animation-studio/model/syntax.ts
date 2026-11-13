import { createHighlighterCoreSync, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubDark from '@shikijs/themes/github-dark';
import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import html from '@shikijs/langs/html';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import jsx from '@shikijs/langs/jsx';
import python from '@shikijs/langs/python';
import sql from '@shikijs/langs/sql';
import tsx from '@shikijs/langs/tsx';
import typescript from '@shikijs/langs/typescript';

const highlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [bash, css, html, javascript, json, jsx, python, sql, tsx, typescript].flat(),
  engine: createJavaScriptRegexEngine(),
});

const aliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  shell: 'bash',
  sh: 'bash',
  markup: 'html',
};

export function highlightCode(code: string, requestedLanguage: string): ThemedToken[][] {
  const language = aliases[requestedLanguage.toLowerCase()] ?? requestedLanguage.toLowerCase();
  try {
    return highlighter.codeToTokensBase(code, { lang: language, theme: 'github-dark' });
  } catch {
    return code.split('\n').map((line) => [{ content: line, offset: 0, color: '#e6edf3' }]);
  }
}
