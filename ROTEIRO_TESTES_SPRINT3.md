# Roteiro de Testes Manuais — Sprint 3 (Guardião Pessoal)

Este roteiro cobre todas as funcionalidades entregues na **Sprint 3 (US18 a US29)** no emulador Android.

---

## Pré-requisitos no Emulador
1. O app **Guardião Pessoal** está aberto no emulador.
2. Caso seja o primeiro acesso, configure:
   - **PIN Mestre**: ex. `2580`
   - **PIN de Emergência / Pânico**: ex. `9630`
3. Cadastre pelo menos **3 senhas** para testar o painel e relatórios:
   - 1 senha **fraca** (ex: `123456` no serviço `Banco Teste`)
   - 2 senhas **iguais/reutilizadas** (ex: `Senha@2026!` nos serviços `Email Pessoal` e `Rede Social`)
4. Cadastre pelo menos **1 nota confidencial** (ex: `Chave Reserva`).

---

## Casos de Teste

### 1. US18 — Zonas Seguras (GPS)
1. Toque em **Ajustes** no cabeçalho.
2. Na seção **Zonas Seguras (GPS)** (aba padrão **Local Atual (GPS)**):
   - Digite um nome (ex: `Casa`).
   - Selecione o raio (ex: `300m`).
   - Toque em **Adicionar Local Atual (GPS)** e conceda a permissão de localização ao app.
   - **Esperado**: A zona `"Casa"` aparece listada com latitude/longitude e o interruptor de Zonas Seguras fica ativado.
   - *(Opcional — Busca por Endereço)*: Na aba **Digitar Endereço**, com **Modo 100% Offline** ativo, o campo fica bloqueado com aviso; desativando temporariamente o Modo 100% Offline em *Privacidade, Rede e Acessibilidade*, é possível cadastrar uma zona digitando o endereço.
3. Volte e toque em **Trancar** no cabeçalho.
4. Na tela de bloqueio, tente desbloquear com o PIN Mestre (`2580`).
   - **Esperado**: Como o emulador ainda está na mesma coordenada GPS, o desbloqueio **funciona**.
5. **Teste fora da zona segura**:
   - Nos controles estendidos do emulador (`...` → *Location*), altere o GPS para outra cidade/país (ou via terminal: `adb emu geo fix -46.6333 -23.5505` / outra coordenada distante) e envie.
   - Toque em **Trancar** e tente desbloquear com o PIN Mestre (`2580`).
   - **Esperado**: O desbloqueio é **bloqueado** com o alerta *"Acesso Bloqueado (GPS)"* informando a distância até a zona segura.
6. **Teste do PIN de Emergência fora da zona** *(opcional — apaga o cofre)*:
   - Se quiser validar, o PIN de emergência (`9630`) continua funcionando mesmo fora da zona segura.
7. Restaure a localização original no emulador para voltar a acessar o cofre normalmente (ou remova a zona segura em **Ajustes**).

---

### 2. US19 — Bloqueio Automático por Inatividade
1. Abra **Ajustes** → **Bloqueio por Inatividade**.
2. Selecione **1 min** e volte para a tela inicial.
3. Deixe o aparelho sem interação por 1 minuto.
   - **Esperado**: O cofre é trancado automaticamente e volta para a tela de PIN (`LockScreen`).
4. **Teste de segundo plano**: Desbloqueie e envie o app para segundo plano (botão Home do emulador) e reabra.
   - **Esperado**: O app volta trancado na `LockScreen`.

---

### 3. US20 — Painel de Diagnóstico de Segurança
1. No cabeçalho, toque em **Saúde**.
2. Verifique:
   - **Índice de Saúde do Cofre (%)** exibido no topo.
   - Contadores de **Fortes**, **Médias**, **Fracas** e **Repetidas**.
   - Seção **Alertas de Segurança** listando:
     - **Senhas Fracas**: `Banco Teste`
     - **Senhas Reutilizadas**: `Email Pessoal, Rede Social`
   - **Esperado**: Os contadores e os alertas correspondem exatamente às senhas cadastradas.

---

### 4. US26 & US28 — Verificação de Vazamentos e Modo 100% Offline
1. Em **Saúde** → **Verificador de Vazamentos**, observe o selo **100% Offline** no canto direito.
2. Digite `123456` no campo e toque em **Verificar Senha**.
   - **Esperado**: Exibe *"ALERTA CRÍTICO: Esta senha consta em listas públicas de senhas vazadas!"* sem realizar nenhuma chamada de rede.
3. Toque em **Auditar Todas as Credenciais**.
   - **Esperado**: Lista `Banco Teste` como credencial com alerta.
4. *(Opcional)* Para testar a consulta online k-Anonymity (HIBP):
   - Vá em **Ajustes** → **Privacidade, Rede e Acessibilidade** e desative **Modo 100% Offline**.
   - Volte em **Saúde**: o selo muda para **Online k-Anon**.
   - Reative **Modo 100% Offline** ao finalizar para garantir privacidade total.

---

### 5. US21 — Redefinir Senha de Emergência / Pânico
1. Vá em **Ajustes** → **Senha de Emergência / Pânico**.
2. Informe o **PIN Mestre Atual** (`2580`) e um **Novo PIN de Emergência** (ex: `7410`).
3. Toque em **Atualizar PIN de Emergência**.
   - **Esperado**: Mensagem de sucesso.
4. *(Teste destrutivo — deixe por último ou após testar backup)*:
   - Tranque o cofre e digite `7410` na tela de PIN.
   - **Esperado**: Todos os dados do cofre são apagados e o app retorna à tela de configuração inicial (`SetupScreen`).

---

### 6. US22 — Modo Tela Preta (Privacy Shield)
1. Na tela principal (lista de senhas/notas), toque no título **Guardião Pessoal** no cabeçalho.
   - **Esperado**: A tela fica **100% preta**, ocultando todas as credenciais de olhares curiosos.
2. Toque em qualquer ponto da tela preta.
   - **Esperado**: A tela do cofre reaparece normalmente.

---

### 7. US23 — Histórico de Acessos e Expiração em 7 Dias
1. Vá em **Saúde** → **Ver Histórico de Acessos e Auditoria**.
2. Verifique o banner informativo sobre criptografia local e expiração automática em 7 dias.
3. Teste os filtros **Todos**, **Sucesso** e **Falhas** (tente errar o PIN uma vez na tela de bloqueio para gerar um registro de **Falha** e verificar o filtro).
   - **Esperado**: Tentativas bem-sucedidas, falhas e bloqueios por GPS aparecem com data/hora e método utilizados.

---

### 8. US24 — Exportar e Importar Backup Criptografado
1. Vá em **Ajustes** → **Backup Criptografado e Relatórios**.
2. Digite uma senha de backup (ex: `BackupForte123`) e toque em **Exportar Backup Criptografado**.
   - **Esperado**: Abre a folha de compartilhamento do Android com o arquivo `guardiao_backup_....gpbackup` (salve em *Downloads* ou *Drive* no emulador).
3. Para testar a importação:
   - Apague ou altere uma senha de teste.
   - Em **Ajustes**, digite a mesma senha (`BackupForte123`) no campo de importação e toque em **Importar Backup Criptografado**.
   - Selecione o arquivo `.gpbackup` salvo e confirme a restauração.
   - **Esperado**: As senhas e notas originais são restauradas corretamente.
   - *(Teste negativo)*: Tente importar informando uma senha errada — **Esperado**: erro *"Senha de backup incorreta ou arquivo corrompido"*.

---

### 9. US25 — Exportar Relatório de Força em Texto Simples
1. Em **Ajustes** → **Backup Criptografado e Relatórios**, toque em **Exportar Relatório de Força (.txt)**.
2. **Esperado**: Aparece um diálogo de confirmação explícito alertando que o arquivo será gerado em texto simples sem criptografia.
3. Confirme em **Exportar Relatório**.
   - **Esperado**: Gera e compartilha o arquivo `guardiao_relatorio_forca_....txt` contendo o índice de saúde, classificação de cada senha e resumo das notas.

---

### 10. US27 — Modo Alto Contraste
1. Vá em **Ajustes** → **Privacidade, Rede e Acessibilidade**.
2. Ative **Modo Alto Contraste**.
   - **Esperado**: Todas as telas (Ajustes, Lista de Senhas/Notas, Formulário de Nova Senha, Modal de Nova Nota, Painel de Saúde, Histórico de Acessos, Tela de Bloqueio e Setup) passam a usar fundo preto puro (`#000000`), texto branco e destaques em amarelo ouro (`#FFD700`) com bordas reforçadas.

---

### 11. US29 — Alterar PIN Mestre
1. Vá em **Ajustes** → **Alterar PIN Mestre**.
2. Informe o PIN atual (`2580`) e um novo PIN forte (ex: `3691`).
3. Toque em **Salvar Novo PIN**.
   - **Esperado**: Confirmação de sucesso; ao trancar o cofre, apenas o novo PIN (`3691`) desbloqueia o cofre.
