# Guardião Pessoal - Cofre Digital Móvel Seguro

Cofre digital móvel seguro desenvolvido em React Native para armazenamento local e confidencial de senhas e credenciais, operando de forma 100% offline.

---

## Backlog do Produto (3 Sprints)

### Sprint 1 - Fundação de Segurança e Gestão de Credenciais

| ID | Prioridade | User Story |
| :--- | :---: | :--- |
| **US01** | Alta | Como Usuário, quero cadastrar um PIN mestre numérico de 4 dígitos no primeiro acesso para proteger o cofre. |
| **US02** | Alta | Como Usuário, quero autenticar no aplicativo através do PIN mestre com bloqueio e atraso de segurança após tentativas falhas. |
| **US03** | Alta | Como Sistema, quero criptografar todos os dados locais em repouso com AES-256 e PBKDF2. |
| **US04** | Alta | Como Usuário, quero cadastrar uma nova senha informando serviço, usuário, senha, URL e categoria. |
| **US05** | Alta | Como Usuário, quero visualizar a lista de senhas salvas com a senha oculta e botão para revelar ou copiar com 1 toque. |
| **US06** | Alta | Como Usuário, quero editar e excluir senhas existentes com confirmação de segurança. |
| **US07** | Alta | Como Usuário, quero copiar usuário ou senha com limpeza automática da área de transferência em 30 segundos. |
| **US08** | Alta | Como Usuário, quero que o aplicativo impeça capturas de tela (print) e gravações para evitar vazamento visual dos dados. |

---

### Sprint 2 - Biometria, Geradores e Notas Confidenciais

| ID | Prioridade | User Story |
| :--- | :---: | :--- |
| **US09** | Alta | Como Usuário, quero autenticar com sensor de impressão digital para desbloquear o cofre em menos de 500ms. |
| **US10** | Média | Como Usuário, quero autenticar com reconhecimento facial via câmera frontal como método biométrico alternativo. |
| **US11** | Alta | Como Usuário, quero gerar senhas fortes aleatórias de 8 a 32 caracteres com letras, números e símbolos especiais. |
| **US12** | Média | Como Usuário, quero gerar senhas baseadas em palavras memoráveis (Diceware) fáceis de lembrar. |
| **US13** | Alta | Como Usuário, quero cadastrar, editar e excluir notas pessoais confidenciais com criptografia individual. |
| **US14** | Média | Como Usuário, quero vincular uma nota confidencial a uma senha específica e adicionar observações de segurança. |
| **US15** | Alta | Como Usuário, quero pesquisar credenciais e notas por texto completo e tags instantaneamente. |
| **US16** | Média | Como Usuário, quero filtrar senhas por categorias personalizadas (Pessoal, Trabalho, Finanças) com pílulas horizontais. |
| **US17** | Baixa | Como Usuário, quero configurar auto-destruição para notas confidenciais e marcar anotações favoritas. |

---

### Sprint 3 - Defesa Avançada, Auditoria e Portabilidade

| ID | Prioridade | User Story |
| :--- | :---: | :--- |
| **US18** | Alta | Como Usuário, quero cadastrar locais/zonas seguras (GPS) e bloquear o acesso ao cofre quando estiver fora dessas áreas. |
| **US19** | Alta | Como Sistema, quero bloquear o acesso ao cofre automaticamente após período de inatividade configurável (1, 5 ou 15 min). |
| **US20** | Alta | Como Usuário, quero visualizar um painel de diagnóstico de segurança com saúde do cofre e alertas de senhas fracas ou reutilizadas. |
| **US21** | Alta | Como Usuário, quero definir uma senha de emergência/pânico que apaga todos os dados confidenciais sob coação. |
| **US22** | Média | Como Usuário, quero ativar o modo de tela preta com toque no cabeçalho para esconder senhas de olhares curiosos. |
| **US23** | Média | Como Usuário, quero consultar o registro de acessos e tentativas falhas com expiração automática em 7 dias. |
| **US24** | Alta | Como Usuário, quero exportar e importar todas as senhas e notas em arquivo criptografado com senha de backup. |
| **US25** | Baixa | Como Usuário, quero exportar um relatório de força das senhas e notas em texto simples quando explicitamente solicitado. |
| **US26** | Média | Como Usuário, quero verificar se uma credencial foi exposta em vazamentos de dados conhecidos. |
| **US27** | Baixa | Como Usuário, quero ativar o modo de compatibilidade visual com alto contraste para facilitar a leitura. |
| **US28** | Alta | Como Usuário, quero utilizar o aplicativo em modo 100% offline garantindo que nenhum dado saia do aparelho. |
| **US29** | Média | Como Usuário, quero alterar o PIN mestre a qualquer momento e gerenciar as preferências de segurança. |
