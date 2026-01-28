# BIA (Barbear-IA) — MVP Vision

## Objetivo

Criar um sistema premium de atendimento e gestão para barbearias:

- **Cliente** resolve tudo via WhatsApp
- **Barbearia** controla tudo via Web
- **Membro** sente status, prioridade e exclusividade
- Sistema simples, confiável e elegante

---

## Ambientes do Sistema

| Ambiente | Usuário | Tecnologia |
|----------|---------|------------|
| WhatsApp | Cliente / Membro | Integração API |
| Painel Web | Barbearia (Dono, Gerente, Balcão) | Next.js |
| NFC | Membro (físico) | Leitor NFC |
| Backend | Sistema | Supabase |
| Pagamentos | Todos | Pix / Cartão |

---

## 1. WhatsApp (Cliente)

> Coração do produto

### Tipos de Usuários

| Tipo | Descrição |
|------|-----------|
| Cliente comum | Primeiro contato |
| Cliente recorrente | Já agendou antes |
| Membro | Plano ativo (ex-VIP) |
| Presencial | Assistido pelo balcão |

### Fluxo — Cliente Comum

1. **Entrada**: Cliente manda "Oi", "Agendar", "Corte", etc.
2. **Menu principal**:
   - Agendar horário
   - Ver serviços e valores
   - Falar com o balcão
3. **Agendamento**:
   - Escolher serviço
   - Escolher profissional (ou "qualquer disponível")
   - Escolher data (dias disponíveis)
   - Escolher horário (NÃO mostra horários Membro)
   - Produtos extras (opcional)
   - Pagamento (Pix / Cartão)
   - Confirmação

### Fluxo — Membro

**Reconhecimento automático** por:
- Número de WhatsApp
- Cartão NFC (presencial)

**Diferenças**:
- Linguagem mais exclusiva
- Acesso a horários Membro (premium)
- Prioridade na fila

**Menu Membro**:
- Agendar horário Membro
- Usar serviço do plano
- Comprar produto

---

## 2. Painel Web (Barbearia)

### Autenticação

- Email + senha
- Perfis: **Dono**, **Gerente**, **Balcão**

### Módulos

#### 2.1 Dashboard
- Faturamento (dia / mês)
- Atendimentos
- Membros ativos
- Serviços mais vendidos
- Barbeiros em atendimento

#### 2.2 Agenda
- Visão: dia / semana / por barbeiro
- Drag & drop
- Criar / editar / cancelar horários
- Marcar como: Normal ou Membro
- Bloquear horários

#### 2.3 Clientes
- Cadastro automático (via WhatsApp) e manual
- Campos: Nome, WhatsApp, Histórico, Membro (sim/não), Cartão NFC
- Ações: Tornar Membro, Remover, Ver histórico de gastos

#### 2.4 Barbeiros
- Campos: Nome, Comissão, Horários de trabalho, Serviços que executa
- Relatórios: Faturamento, Atendimentos, Ticket médio

#### 2.5 Serviços & Produtos
- Criar serviços, combos, planos
- Campos: Preço, Duração, Comissão, Elegível para Membro (sim/não)

#### 2.6 Planos Membro
- Exemplos: Membro Silver, Membro Gold
- Campos: Preço mensal, Serviços incluídos, Horários liberados, Limite de uso

#### 2.7 Pagamentos
- Pix, Cartão
- Histórico, Relatórios

#### 2.8 NFC / Cartões
- Vincular cartão a cliente
- Ver saldo de serviços
- Registrar uso por aproximação

---

## 3. Cartão NFC (Membro)

> Elemento de luxo

### Funcionamento

1. Cartão NFC numerado, associado a um cliente
2. Cliente chega e entrega cartão
3. Balcão aproxima no leitor
4. Sistema identifica: quem é + o que tem direito
5. Atendimento iniciado
6. Produtos extras adicionados
7. Pagamento finalizado

---

## 4. Backend (Lógica Central)

### Regras de Negócio

- Membro vê mais opções
- Não-Membro **nunca** vê horários Membro
- Agenda **nunca** conflita
- Tudo gera histórico
- Nada quebra produção

### Entidades Principais

| Entidade | Descrição |
|----------|-----------|
| Cliente | Dados + histórico + status Membro |
| Barbeiro | Profissional + comissão + agenda |
| Serviço | Corte, barba, tratamento, combo |
| Horário | Slot de agenda (normal ou Membro) |
| Plano | Assinatura Membro (Silver, Gold) |
| Pagamento | Transação financeira |
| Cartão NFC | Vínculo físico com Membro |

---

## 5. Pagamentos

### MVP
- Pix
- Cartão via link

### Futuro
- Débito presencial
- Assinaturas recorrentes

---

## 6. Experiência (O que faz parecer luxo)

- Linguagem limpa
- Poucas opções por tela
- Atendimento rápido
- Status Membro claro
- Cartão físico
- Sem bugs

> **Luxo = funciona sempre**

---

## Resumo

Este não é um sistema, app ou agenda.

**É um modelo de atendimento premium automatizado.**
