---
framework_version: 1.0.0
---

# Mercado de Trabalho Brasileiro

<!-- Aplica-se quando CLAUDE.md declara Brasil como país (Identity → Location) ou quando a
vaga é no Brasil. Este arquivo complementa 03–08; onde ele conflita com a orientação
genérica (ex.: "carta de 1 página sempre"), ESTE arquivo vence para vagas brasileiras. -->

Regras práticas para avaliar vagas, montar currículo, responder formulários e conduzir
processos seletivos no Brasil. Leia junto com o arquivo do passo em execução: `/apply`
Step 1 (avaliação) → seções 1–4 e 9; Step 2 (CV) → seção 5; Step 3 (carta) → seção 6;
formulários → seção 7; `/interview` → seção 8.

---

## 1. Regime de contratação — leia antes de pontuar

O regime muda o valor real da proposta mais do que qualquer outro fator. Extraia-o do
texto da vaga (no Gupy: campo `contractType`; no VAGAS: `contractType`/"Regime ...") e
registre-o na avaliação.

| Regime | O que é | O que observar |
|--------|---------|----------------|
| **CLT** (efetivo) | Empregado com carteira assinada | 13º, férias + 1/3, FGTS 8%, INSS/IRRF retidos, aviso prévio, seguro-desemprego |
| **PJ** | Candidato fatura por empresa própria (Simples Nacional) | Sem 13º, férias pagas nem FGTS; custo de contador; nota fiscal mensal |
| **Estágio** | Lei 11.788/2008 — exige matrícula ativa | Até 6h/dia e 30h/semana, bolsa + auxílio-transporte, recesso de 30 dias/ano, máx. 2 anos na mesma empresa |
| **Trainee** | Programa de entrada, geralmente CLT | Formatura recente (1–3 anos), inscrições concentradas no 2º semestre, várias etapas e dinâmicas |
| **Jovem Aprendiz** | Lei 10.097/2000, 14–24 anos | Contrato especial de até 2 anos, ligado a curso de aprendizagem |
| **Temporário** | Lei 6.019/1974 | Até 180 dias (+90), geralmente via agência |
| **Cooperado / Freelancer / Autônomo** | Sem vínculo | Remuneração por projeto; confirme valor e prazo de pagamento |
| **Banco de talentos** | Não é vaga aberta | Candidatura entra em cadastro; prioridade baixa no ranking |

**Gate de regime (antes de pontuar):** se CLAUDE.md lista um regime como deal-breaker
(ex.: "não aceito PJ"), uma vaga nesse regime é **FAIL** — cite a linha da vaga. Se a vaga
não informa o regime, **FLAG** ("regime não informado — perguntar ao recrutador") e siga.

**Sinal de alerta — PJ com cara de CLT** ("pejotização"): vaga PJ que exige horário fixo,
subordinação direta, exclusividade e controle de ponto. Não é motivo para descartar, mas
aponte o risco ao candidato (sem direitos trabalhistas e com riscos de uma relação de emprego disfarçada).

## 2. Remuneração e pacote

Salários no Brasil são falados em **valor bruto mensal**. Compare propostas sempre pelo
**pacote anual líquido**, não pelo número da vaga:

> **Windows:** run these tools as `python`, not `python3`. A python.org install ships no `python3`, so that name reaches the Microsoft Store alias, which either exits 49 with no output (#669) or starts a separate Store Python without the packages `pip` installed (such as pypdf). `.claude/settings.json` allows both spellings.

```bash
python3 tools/clt_pj.py clt 9000 --beneficios 1500          # líquido + pacote anual CLT
python3 tools/clt_pj.py equivalente 9000 --beneficios 1500  # quanto faturar como PJ para empatar
python3 tools/clt_pj.py comparar --clt 9000 --pj 13000      # proposta CLT x proposta PJ
```

`--beneficios` é o valor mensal do que a empresa paga em dinheiro ou equivalente (VR/VA,
plano de saúde, auxílio home office). Regra de bolso que a ferramenta substitui: PJ precisa
pagar em torno de 1,3–1,5× o bruto CLT para empatar — o número real depende do faturamento,
do Anexo do Simples e dos benefícios, então rode a calculadora em vez de usar a regra.

Componentes a levantar em toda proposta:
- **Fixo:** salário bruto mensal (CLT) ou valor mensal da nota (PJ).
- **Variável:** PLR/PPR (quantos salários, meta atrelada), bônus anual, comissão.
- **Benefícios:** VR/VA (valor mensal), plano de saúde e odontológico (titular/dependentes,
  coparticipação), vale-transporte (desconto de até 6% do salário), auxílio home office,
  Wellhub/Gympass, seguro de vida, previdência privada, auxílio-creche, day off de aniversário.
- **Equity:** stock options/RSU (startups e multinacionais) — trate como incerto.
- **Data-base / dissídio:** reajuste anual da categoria pela convenção coletiva.

**Benchmarks de salário** (pesquise na hora, cite a fonte e o ano): guias salariais anuais
de consultorias de recrutamento (Robert Half, Michael Page, Hays), Glassdoor Brasil,
Catho, salario.com.br (dados do Novo Caged), levels.fyi para tech, e o **piso da categoria**
na convenção coletiva do sindicato quando a profissão tiver uma. Se `salary_data.json`
estiver configurado, `salary_lookup.py` também funciona — ele já ignora sufixos como
Ltda, S.A., S/A, EIRELI, ME/EPP e "do Brasil".

**Pretensão salarial em formulários** (Gupy pede com frequência, às vezes obrigatória):
- Informe **bruto mensal** no regime da vaga. Para vaga PJ, o valor mensal da nota.
- Use o benchmark + o mínimo do candidato em CLAUDE.md; nunca invente o mínimo — pergunte.
- Campo livre aceita faixa ("R$ 9.000 a R$ 10.500 CLT, a depender do pacote de benefícios").
- "A combinar" só quando o formulário permitir e o candidato preferir.

## 3. Senioridade, títulos e modelo de trabalho

- **Níveis:** Estagiário → Júnior (Jr) → Pleno (Pl) → Sênior (Sr) → Especialista/Staff →
  Coordenador → Gerente. Grandes empresas usam também Analista I/II/III. "Pleno" ≈ 3–5 anos
  na função; trate a régua de anos como indicativa, não como gate.
- **Títulos inclusivos:** "Pessoa Desenvolvedora", "Engenheiro(a)", "Analista (a)" — busque
  pelo radical da função, não pelo gênero gramatical.
- **Modelo:** remoto, híbrido (quantos dias presenciais? qual escritório?) ou presencial.
  "Remoto" às vezes exige residir em um estado/cidade — leia a vaga. Para Location &
  Logistics, use as regiões metropolitanas e o tempo de deslocamento declarados em
  `search-queries.md`, e lembre que deslocamento em capitais pode passar de 1h por trecho.

## 4. Idiomas

- Português é o idioma de trabalho padrão; não é requisito a sinalizar para candidato nativo.
- **Inglês** é o requisito mais comum e mais vago ("inglês avançado", "fluente",
  "conversação"). Aplique o Language Gate de `04-job-evaluation.md` comparando com o nível
  declarado. Escala usual nas vagas: básico < intermediário < avançado < fluente.
- Espanhol aparece em vagas com atuação na América Latina.
- Vaga escrita em inglês (multinacionais) → CV e mensagem em inglês; vaga em português →
  CV em português, salvo instrução contrária em CLAUDE.md (`CV language`).

## 5. Currículo brasileiro

Use o template moderncv normalmente (`05-cv-templates.md`), com estes ajustes:

- **Tamanho:** o fluxo padrão gera e verifica exatamente 2 páginas, o que serve bem a partir
  de pleno. Para estágio/júnior, recrutadores brasileiros preferem 1 página: em vez de
  encher a segunda página com conteúdo fraco, registre um template de 1 página com
  `/add-template` (Page limit: 1) — o `/apply` passa a verificar esse limite.
- **NÃO incluir:** CPF, RG, CNH (salvo vaga que exige dirigir — aí só "CNH categoria B"),
  foto (salvo se a vaga pedir), estado civil, filhos, data de nascimento/idade, religião,
  endereço completo. Isso protege o candidato de discriminação e de exposição de dados
  pessoais (LGPD). Cidade/UF basta: "São Paulo, SP".
- **Contato:** telefone com DDD em formato internacional legível (`+55 11 91234-5678`),
  e-mail profissional, LinkedIn, GitHub/portfólio. Contato em texto literal (ATS).
- **Títulos de seção em pt-BR:** Resumo Profissional · Experiência Profissional ·
  Formação Acadêmica · Competências · Idiomas · Certificações · Cursos Complementares ·
  Projetos · Publicações · Prêmios. Não inclua "Referências disponíveis mediante
  solicitação" — não é costume.
- **Formação:** use os nomes oficiais — Bacharelado, Licenciatura, Tecnólogo, Técnico,
  Pós-graduação *lato sensu* (Especialização/MBA), Mestrado, Doutorado. Em andamento:
  "Bacharelado em ... (em andamento, conclusão prevista em 12/2027)". Para estágio, o
  semestre atual e o turno importam ("7º semestre, noturno").
- **Datas:** siga a regra de intervalo ASCII de `05-cv-templates.md` — hífen simples no
  argumento de data do `\cventry`, sempre com início e fim: `03/2022 - 08/2025`,
  `03/2022 - atual` (nunca `--`, que vira travessão e some no import do ATS).
- **Gupy:** a candidatura passa pelo perfil Gupy (preenchido uma vez) **e** pelo PDF. O
  ranqueamento automático do Gupy compara o perfil e o currículo com as palavras da vaga:
  use os termos exatos da vaga em português quando forem verdadeiros (ex.: "Análise de
  dados" e "Power BI", não só "BI"), sem keyword stuffing.

## 6. Carta de apresentação e mensagens

No Brasil a carta formal é **menos comum** do que na Europa. Gupy e LinkedIn raramente
pedem uma; quando pedem, é um campo de texto. Decida com o candidato:

| Situação | Formato |
|----------|---------|
| Portal pede carta/"Por que você quer trabalhar aqui?" | Texto de 150–300 palavras no campo (ver `08-application-forms.md`), sem PDF |
| Candidatura por e-mail | Corpo do e-mail curto (até ~200 palavras) + CV anexo. Assunto: `Candidatura – <Vaga> – <Nome>` |
| Abordagem a recrutador/gestor no LinkedIn | Nota de conexão ≤ 300 caracteres, ou InMail de 3–5 linhas |
| Empresa/vaga pede carta formal (acadêmico, setor público, algumas multinacionais) | Template LaTeX normal, 1 página |

Português da carta: **"Prezado(a) <Nome>,"** ou **"Prezada equipe de Recrutamento,"**
quando não há nome (para startups, "Olá, <Nome>," é aceitável). Fecho: **"Atenciosamente,"**.
Evite clichês locais ("venho por meio desta", "sou uma pessoa proativa e dinâmica",
"vestir a camisa") — as regras de `03-writing-style.md` valem em português também, inclusive
a proibição de travessões longos como pausa retórica.

## 7. Formulários de candidatura

Perguntas típicas do Gupy e de ATS brasileiros (InHire, Solides, Kenoby, Recrutei, Pandapé):
- **Pretensão salarial** — ver seção 2.
- **Disponibilidade para início** — se empregado CLT, considere o aviso prévio
  (30 dias + 3 por ano trabalhado, até 90; pode ser negociado/indenizado).
- **Disponibilidade para viagens / mudança / modelo híbrido** — responda o que está em CLAUDE.md.
- **Perguntas eliminatórias** (sim/não): leia com cuidado; uma resposta "não" costuma
  reprovar automaticamente. Nunca responda "sim" a algo que o perfil não sustenta.
- **Autodeclarações** (raça/cor, gênero, PcD, orientação): são **sempre opcionais e do
  candidato**. Nunca preencha nem infira — mostre o campo e pergunte.
- **Testes on-line** (lógica, inglês, perfil comportamental): o agente não faz testes pelo
  candidato; pode explicar o formato e ajudar a praticar.

## 8. Processos seletivos

Etapas comuns (no Gupy, `detail` lista as etapas da vaga em `steps`):
1. **Cadastro e triagem automática** (perfil + CV + perguntas).
2. **Testes:** mapeamento comportamental/perfil (DISC-like), lógica, inglês, fit cultural.
3. **Entrevista Inteligente / vídeo assíncrono:** respostas gravadas a perguntas fixas,
   1–3 minutos cada. Prepare roteiros curtos em STAR, olhando para a câmera.
4. **Dinâmica de grupo** (trainee, estágio, varejo): case em equipe; avaliam colaboração,
   escuta e síntese, não quem fala mais.
5. **Entrevista com RH/Talent Acquisition** — motivação, pretensão, disponibilidade.
6. **Entrevista técnica / case / teste prático** (take-home em tech: confirme prazo e escopo).
7. **Entrevista com gestor** e às vezes com diretoria ou "bar raiser".
8. **Proposta** (por e-mail ou ligação), depois **exames admissionais** e documentação
   (CTPS digital, dados bancários — **só depois** da proposta formal).

Comunicação por **WhatsApp** é normal para agendamento; feedback negativo frequentemente não
chega — `/outcome followup` cobre o follow-up. Calendário: contratação desacelera de meados
de dezembro até depois do Carnaval; programas de trainee abrem inscrições majoritariamente
entre julho e outubro.

Perguntas que o candidato deve fazer (somam-se às de `07-interview-prep.md`): regime e
pacote completo; política de PLR e última PLR paga; modelo híbrido real (dias, escritório);
plano de carreira e ciclo de promoção/mérito; data-base do reajuste.

## 9. Vagas afirmativas e golpes

**Vagas afirmativas** (PcD pela Lei de Cotas 8.213/1991; exclusivas ou preferenciais para
mulheres, pessoas negras, pessoas LGBTQIA+, 50+): o Gupy marca vagas PcD (`pcd: true`).
- Uma vaga **exclusiva** para um grupo é elegível só se o candidato declarou pertencer a ele
  em CLAUDE.md. **Nunca infira** pertencimento a partir de nome, foto ou qualquer dado.
  Sem declaração: trate como Eligibility Gate **FAIL** citando a linha, e diga ao candidato
  que pode corrigir isso declarando no perfil.
- Vaga "preferencial" ou "também para PcD" não exclui ninguém: PASS normal.

**Golpes comuns — avise e não prossiga sem o candidato confirmar:**
- Cobrança de qualquer taxa (cadastro, curso, uniforme, "kit"), PIX ou boleto.
- Pedido de CPF, RG, dados bancários ou selfie com documento **antes** de uma entrevista real.
- Contato só por WhatsApp/Telegram com número desconhecido, salário muito acima do mercado
  para tarefa simples ("avaliar produtos", "curtir vídeos").
- Domínio que imita empresa conhecida. Confirme a vaga na página de carreiras oficial
  (para Gupy: `<empresa>.gupy.io`) seguindo `09-web-research.md`.

## 10. Portais

CLIs instalados (rodam no `/scrape`): `gupy-search` (maior cobertura de grandes empresas),
`vagas-search` (forte em não-tech e mostra faixa salarial), `linkedin-search` (use
`-l "Brasil"` ou `-l "São Paulo, Brazil"`), `freehire-search`.

Sem CLI (WebSearch `site:` em `search-queries.md`): Catho, InfoJobs, Indeed Brasil,
Glassdoor, BNE, ProgramaThor, GeekHunter, Trampos.co, Remotar, Revelo, Solides Vagas,
InHire (`*.inhire.app`), Kenoby/Gupy de empresas específicas, e o portal público Emprega
Brasil/SINE. **Concursos públicos** têm lógica própria (edital, prova, banca) e estão fora
do escopo deste fluxo.
