import * as monaco from 'monaco-editor';
import { Logger } from './Logger';

export class ShaderEditor {
    private container: HTMLElement;
    private editorContainer: HTMLElement;
    private contentContainer: HTMLElement;
    private statusElement: HTMLElement;
    private keyHint: HTMLElement;
    private editor: monaco.editor.IStandaloneCodeEditor | null = null;
    private currentCode: string = '';
    private onUpdate: (code: string) => void;
    private isInitialized = false;

    constructor(container: HTMLElement, onUpdate: (code: string) => void) {
        this.container = container;
        this.onUpdate = onUpdate;
        this.editorContainer = document.createElement('div');
        this.contentContainer = document.createElement('div');
        this.statusElement = document.createElement('div');
        this.keyHint = document.createElement('div');
        // Remove debounceTimeout as we're not using it anymore
        this.setupUI();
        this.setupKeyboardControls();
    }

    private setupUI(): void {
        const style = document.createElement('style');
        style.textContent = `
            .shaderforge-editor {
                position: absolute;
                left: 20%;
                right: 20%;
                top: 20%;
                bottom: 20%;
                background: rgba(0, 0, 0, 0.85);
                border: 1px solid rgba(0, 255, 136, 0.2);
                border-radius: 8px;
                backdrop-filter: blur(12px);
                display: none;
                overflow: hidden;
                font-family: 'Oxanium', monospace;
                color: #00ffaf;
                z-index: 1000;
                box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
                transition: border-color 0.3s ease;
            }
            .shaderforge-editor:hover {
                border-color: rgba(0, 255, 136, 0.4);
            }
            .shaderforge-editor-header {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 32px;
                background: rgba(0, 0, 0, 0.5);
                border-bottom: 1px solid rgba(0, 255, 136, 0.2);
                display: flex;
                align-items: center;
                padding: 0 16px;
                font-size: 14px;
                user-select: none;
            }
            .shaderforge-editor-content {
                position: absolute;
                top: 32px;
                left: 0;
                right: 0;
                bottom: 0;
                overflow: hidden;
            }
            .shaderforge-editor-status {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 24px;
                background: rgba(0, 0, 0, 0.5);
                border-top: 1px solid rgba(0, 255, 136, 0.2);
                display: flex;
                align-items: center;
                padding: 0 16px;
                font-size: 12px;
                color: rgba(0, 255, 136, 0.6);
            }
            .shaderforge-editor-key-hint {
                position: absolute;
                right: 16px;
                top: 8px;
                font-size: 12px;
                color: rgba(0, 255, 136, 0.4);
            }
        `;
        document.head.appendChild(style);

        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'shaderforge-editor';
        
        const header = document.createElement('div');
        header.className = 'shaderforge-editor-header';
        header.textContent = 'Fragment Shader Editor';
        
        this.keyHint = document.createElement('div');
        this.keyHint.className = 'shaderforge-editor-key-hint';
        this.keyHint.innerHTML = `
            <span>Ctrl+E: Toggle Editor</span>
            <span style="margin-left: 12px">Ctrl+R: Compile & Run</span>
        `;
        header.appendChild(this.keyHint);
        
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'shaderforge-editor-content';
        // Add specific sizing for Monaco
        this.contentContainer.style.width = '100%';
        this.contentContainer.style.height = 'calc(100% - 56px)'; // Account for header and status
        
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'shaderforge-editor-status';
        this.statusElement.textContent = 'Ready';

        this.editorContainer.appendChild(header);
        this.editorContainer.appendChild(this.contentContainer);
        this.editorContainer.appendChild(this.statusElement);
        this.container.appendChild(this.editorContainer);

        // Load Monaco after DOM elements are set up
        this.setupMonacoEditor(this.contentContainer);
    }

    private setupMonacoEditor(container: HTMLElement): void {
        // Register WGSL language
        monaco.languages.register({ id: 'wgsl' });
        monaco.languages.setMonarchTokensProvider('wgsl', {
            tokenizer: {
                root: [
                    [/@[a-zA-Z_]\w*/, 'annotation'],
                    [/\b(fn|var|let|const|struct|return|if|else|loop|break|continue|switch|case|default)\b/, 'keyword'],
                    [/\b(vec[234]([if])?|mat[234]|array|sampler|texture)\b/, 'type'],
                    [/\b(f32|i32|u32|bool)\b/, 'type'],
                    [/\/\/.*$/, 'comment'],
                    [/".*?"/, 'string'],
                    [/[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/, 'number'],
                    [/\b(true|false)\b/, 'keyword'],
                ]
            }
        });

        // Define theme
        monaco.editor.defineTheme('shaderforge', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: '00ff88', fontStyle: 'bold' },
                { token: 'type', foreground: '00ddff' },
                { token: 'number', foreground: 'ff88ff' },
                { token: 'comment', foreground: '666666', fontStyle: 'italic' },
                { token: 'string', foreground: 'ffaa00' },
                { token: 'annotation', foreground: 'ff0088' }
            ],
            colors: {
                'editor.background': '#00000000',
                'editor.foreground': '#00ff88',
                'editor.lineHighlightBackground': '#00ff8815',
                'editor.selectionBackground': '#00ff8830',
                'editor.inactiveSelectionBackground': '#00ff8820'
            }
        });

        this.editor = monaco.editor.create(container, {
            value: this.currentCode,
            language: 'wgsl',
            theme: 'shaderforge',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: true,
            automaticLayout: true,
            tabSize: 2,
            glyphMargin: false,
            guides: {
                indentation: true,
                bracketPairs: true,
                highlightActiveIndentation: true,
            },
            contextmenu: true,
            rulers: [80],
            cursorStyle: 'line',
            cursorWidth: 2,
            smoothScrolling: true,
            mouseWheelZoom: true,
            wordWrap: 'on',
            readOnly: false // Make sure editor is editable
        });

        this.editor.onDidChangeModelContent(() => {
            if (this.editor) {
                const newCode = this.editor.getValue();
                this.updateCode(newCode);
            }
        });

        this.isInitialized = true;
    }

    private setupKeyboardControls(): void {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                if (e.key === 'e') {
                    this.toggle();
                    e.preventDefault();
                } else if (e.key === 'r') {
                    this.compileShader();
                    e.preventDefault();
                }
            }
        });
    }

    public setCode(code: string): void {
        this.currentCode = code;
        if (this.editor) {
            // Create a new model with the code
            const model = monaco.editor.createModel(code, 'wgsl');
            this.editor.setModel(model);
            // Force a layout update
            this.editor.layout();
            this.statusElement.textContent = 'Ready to compile (Ctrl+R)';
        }
    }

    private updateCode(newCode: string): void {
        this.currentCode = newCode;
        this.statusElement.textContent = 'Ready to compile (Ctrl+R)';
    }

    private compileShader(): void {
        if (!this.editor) return;
        
        const code = this.editor.getValue();
        this.statusElement.textContent = 'Compiling...';
        
        try {
            this.onUpdate(code);
            this.statusElement.textContent = 'Compilation successful';
            setTimeout(() => {
                this.statusElement.textContent = 'Ready to compile (Ctrl+R)';
            }, 2000);
        } catch (error) {
            this.statusElement.textContent = 'Compilation failed';
            Logger.error('Shader compilation failed:', error);
        }
    }

    toggle(): void {
        const isVisible = this.editorContainer.style.display !== 'none';
        this.editorContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && this.editor) {
            this.editor.layout();
        }
    }

    show(): void {
        this.editorContainer.style.display = 'block';
        if (this.editor) {
            this.editor.layout();
        }
    }

    hide(): void {
        this.editorContainer.style.display = 'none';
    }
}