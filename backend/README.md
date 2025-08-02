# Clara - Message Processing Engine

Sistema de processamento de mensagens para agendamento de consultas psicológicas via WhatsApp.

## 🚀 Recursos Implementados

### ✅ Processamento de Mensagens Completo

- **Command Parser**: Processamento de linguagem natural em português
- **Session Manager**: Gerenciamento de estado da conversa com Redis
- **Validation Layer**: Validação de conflitos e disponibilidade
- **Response Generator**: Geração de respostas contextuais em português

### 📱 Comandos Suportados

#### Agendamento
```
"Agendar Ana quinta 14h"
"Marcar João segunda 10:30"
"Agendar Maria amanhã 15h"
"Agendar Carlos 25/01 16h"
```

#### Cancelamento
```
"Cancelar Ana quinta"
"Desmarcar João segunda"
"Cancelar Maria amanhã"
```

#### Visualização
```
"Mostrar semana"
"Ver agenda hoje"
"Minha agenda"
"Agenda da semana"
```

#### Ajuda
```
"Ajuda"
"Comandos"
"Como usar"
```

### 🧪 Interface de Simulação

Uma interface web completa para testar o sistema sem integração com WhatsApp.

## 🛠️ Configuração

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- Redis

### Instalação

```bash
# Instalar dependências
npm install

# Configurar banco de dados
npm run db:migrate
npm run db:generate

# Iniciar servidor
npm run dev
```

### Variáveis de Ambiente

```env
DATABASE_URL="postgresql://username:password@localhost:5432/clara"
REDIS_URL="redis://localhost:6379"
PORT=3000
```

## 🎮 Como Usar

### 1. Interface de Simulação

Acesse: `http://localhost:3000/simulator-ui`

A interface permite:
- Configurar psicólogo de teste
- Enviar mensagens simuladas
- Ver respostas da Clara
- Testar todos os comandos
- Visualizar casos edge

### 2. API Endpoints

#### Simulação
```typescript
POST /simulator/sessions
// Criar sessão de simulação

POST /simulator/sessions/:id/messages  
// Enviar mensagem

GET /simulator/sessions/:id/messages
// Ver histórico de mensagens
```

#### Processamento Direto
```typescript
// Use a classe MessageProcessor diretamente
import { MessageProcessor } from './services/message-processor';

const processor = new MessageProcessor();
const result = await processor.processMessage('+5511999999999', 'Agendar Ana quinta 14h');
```

### 3. Teste Automatizado

```bash
# Executar teste do Message Processor
npm run test:processor

# Ou executar diretamente
npx ts-node src/test/test-message-processor.ts
```

## 🏗️ Arquitetura

### Componentes Principais

1. **CommandParser**: Analisa linguagem natural em português
2. **SessionManager**: Gerencia estado da conversa no Redis  
3. **ValidationLayer**: Valida regras de negócio e conflitos
4. **ResponseGenerator**: Gera respostas contextuais
5. **MessageProcessor**: Orquestra todo o fluxo

### Fluxo de Processamento

```
Mensagem WhatsApp → Command Parser → Session Manager → Validation Layer → Response Generator → Resposta
```

### Estados da Conversa

- `COMMAND_PARSING`: Interpretando comando
- `AWAITING_CONFIRMATION`: Aguardando confirmação
- `AWAITING_PATIENT_REGISTRATION`: Aguardando criação de paciente
- `EXECUTION`: Executando comando
- `COMPLETED`: Comando concluído

## 📊 Casos de Teste

### Agendamento Básico
```
User: "Agendar Ana quinta 14h"
Clara: "📅 Agendando Ana: Data: quinta-feira, 23/01..."
User: "Sim"  
Clara: "✅ Sessão agendada com sucesso!"
```

### Conflito de Horário
```
User: "Agendar Pedro quinta 14h"
Clara: "⚠️ Conflito detectado! Você já tem Ana agendado das 14:00 às 14:50..."
```

### Paciente Novo
```
User: "Agendar Carlos segunda 10h"
Clara: "👤 Não encontrei Carlos nos seus pacientes. Deseja adicionar como novo paciente?"
User: "Sim"
Clara: "✅ Paciente Carlos criado! 📅 Agendando Carlos..."
```

## 🔍 Validações Implementadas

- ✅ Horário dentro do expediente
- ✅ Não agendar no passado
- ✅ Detecção de conflitos
- ✅ Busca fuzzy de pacientes
- ✅ Sugestão de horários livres
- ✅ Validação de comandos malformados

## 🚦 Status do Projeto

- [x] Command Parser (Português)
- [x] Session Manager (Redis)
- [x] Validation Layer
- [x] Response Generator
- [x] Message Processor
- [x] Interface de Simulação
- [x] Testes Automatizados
- [ ] Integração WhatsApp Real
- [ ] Google Calendar Integration
- [ ] Deploy Production

## 🤝 Próximos Passos

1. Integração com WhatsApp Business API
2. Sincronização com Google Calendar
3. Sistema de notificações
4. Dashboard administrativo
5. Métricas e analytics

## 🔧 Desenvolvimento

### Adicionar Novo Comando

1. Adicione padrão regex em `CommandParser`
2. Implemente validação em `ValidationLayer`
3. Adicione resposta em `ResponseGenerator`
4. Processe no `MessageProcessor`

### Estrutura de Arquivos

```
src/
├── services/
│   ├── command-parser.ts     # Parser de linguagem natural
│   ├── session-manager.ts    # Gerenciamento de sessão
│   ├── validation-layer.ts   # Validações de negócio
│   ├── response-generator.ts # Geração de respostas
│   └── message-processor.ts  # Orquestrador principal
├── routes/
│   └── simulator.ts          # API de simulação
├── types/
│   └── index.ts             # Tipos TypeScript
├── views/
│   └── simulator.html       # Interface web
└── test/
    └── test-message-processor.ts # Testes
```

---

Feito com ❤️ para facilitar a vida dos psicólogos