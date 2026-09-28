# Guardião Pessoal - Cofre Digital Móvel Seguro

O **Guardião Pessoal** é um cofre digital móvel desenvolvido em **React Native** com **Expo** e **TypeScript**, projetado para armazenar credenciais e dados confidenciais com máxima segurança, privacidade e operação **100% offline**.

---

## 🎯 Escopo da Sprint 1

A primeira sprint do projeto foca na fundação da arquitetura de segurança, autenticação primária por PIN mestre, persistência criptografada e gestão essencial de credenciais (CRUD).

### 📋 Histórias de Usuário Implementadas (US01 a US08)

| ID | Prioridade | História de Usuário | Detalhes da Implementação |
| :--- | :---: | :--- | :--- |
| **US01** | Alta | **Setup Inicial do PIN Mestre**<br>Como novo usuário, quero cadastrar um PIN mestre numérico de 4 dígitos na primeira abertura do app. | • Validação estrita de 4 dígitos numéricos.<br>• Confirmação obrigatória do PIN digitado.<br>• Geração de Salt aleatório único e derivação de hash PBKDF2.<br>• Armazenamento seguro de chaves no `SecureStore`. |
| **US02** | Alta | **Teclado Numérico Customizado e Bloqueio**<br>Como usuário, quero autenticar no aplicativo através de um teclado numérico (0-9). | • Teclado minimalista customizado integrado à tela de bloqueio.<br>• Feedback tátil por vibração ao errar.<br>• **Proteção anti-força bruta**: bloqueio de 5s após 3 erros, 30s após 5 erros e auto-wipe (limpeza de segurança) após 10 tentativas incorretas. |
| **US03** | Alta | **Criptografia Forte em Repouso**<br>Como sistema, devo criptografar todas as credenciais locais com AES-256 e PBKDF2. | • Criptografia simétrica AES-256 em todas as credenciais antes da persistência local.<br>• Derivação de chave via PBKDF2 com 10.000 iterações.<br>• Checksum SHA-256 para validação de integridade contra corrupção. |
| **US04** | Alta | **Cadastro de Novas Credenciais (CRUD)**<br>Como usuário, quero cadastrar uma nova credencial com serviço, login, senha, URL e prioridade. | • Formulário validado com campos de serviço, usuário/e-mail, senha e URL.<br>• Categorização e badge de importância (Alta, Média, Baixa).<br>• Dica opcional e alerta visual de atenção. |
| **US05** | Alta | **Visualização com Senha Mascarada**<br>Como usuário, quero visualizar as senhas cadastradas protegidas por máscara padrão. | • Senhas ocultadas por bullets padrão (`••••••••`).<br>• Botão individual "Mostrar" para revelar temporariamente a senha.<br>• Ordenação rápida por Nome, Data de Criação e Prioridade. |
| **US06** | Alta | **Edição e Exclusão com Confirmação**<br>Como usuário, quero editar ou excluir credenciais salvas sem risco de perda acidental. | • Modal de confirmação antes de remover qualquer item do cofre.<br>• Edição completa de credenciais existentes com atualização imediata no cofre. |
| **US07** | Alta | **Cópia Rápida com Auto-Limpeza do Clipboard**<br>Como usuário, quero copiar usuário ou senha em 1 toque com limpeza automática. | • Botões dedicados "Copiar usuário" e "Copiar senha".<br>• Temporizador regressivo em background que limpa a área de transferência do aparelho em **30 segundos**, prevenindo vazamento de memória. |
| **US08** | Alta | **Bloqueio Nativo de Captura de Tela (Anti-Print)**<br>Como usuário, quero que o app impeça prints e gravações de tela para proteção visual. | • Integração nativa via `expo-screen-capture` com a flag `FLAG_SECURE` do Android.<br>• Bloqueia atalhos de print screen e gravação de vídeo.<br>• Oculta o conteúdo do app na tela de multitarefa / aplicativos recentes. |

---

## 🔒 Princípios de Segurança da Sprint 1

1. **Operação 100% Offline:** Nenhuma requisição externa ou telemetria é realizada. Todos os dados permanecem estritamente no armazenamento local do dispositivo.
2. **Segurança em Memória:** Chaves descriptografadas são imediatamente descartadas da memória no momento em que o cofre é trancado.
3. **Proteção Contra Espiões de Tela:** Modo de tela preta rápido acessível por toque longo no cabeçalho do cofre.

---

## 🛠️ Tecnologias Utilizadas

- **Framework:** [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/) (SDK 57)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Criptografia:** `crypto-js` (AES-256, PBKDF2, SHA-256)
- **Armazenamento:** `@react-native-async-storage/async-storage` e `expo-secure-store`
- **Área de Transferência:** `expo-clipboard`
- **Proteção de Tela:** `expo-screen-capture` (`FLAG_SECURE`)
- **Estilização:** StyleSheet nativo com design minimalista

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js instalado (v18+)
- Celular Android com o aplicativo **Expo Go** instalado (ou conectado via cabo USB com Depuração USB ativada)

### 1. Instalar as dependências
```bash
npm install
```

### 2. Iniciar o ambiente de desenvolvimento
```bash
npx expo start
```
- Escaneie o QR Code exibido no terminal utilizando o aplicativo **Expo Go** no celular.
- Ou pressione `a` no terminal para abrir no Emulador Android do computador.

### 3. Instalar o APK diretamente via cabo USB
Com o celular plugado via USB e a depuração ativada:
```bash
adb -d install -r caminho_do_arquivo.apk
```
