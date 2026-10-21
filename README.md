<p align="center">
  <img src="assets/mascot/pip_flight_loop.gif" alt="Pip, o passarinho mensageiro" width="180">
</p>

# AI Job Search Brasil 🇧🇷

*Sua busca de emprego com IA, rodando na sua máquina, adaptada ao mercado brasileiro.*

> [!IMPORTANT]
> **Este projeto é uma adaptação brasileira de um projeto dinamarquês.**
> O original é o **[AI Job Search](https://github.com/ai-job-search-dev/ai-job-search)**, criado
> por **[Mads Lorentzen](https://www.linkedin.com/in/mads-lorentzen/)**, geofísico dinamarquês
> que montou o framework para a própria recolocação profissional na Dinamarca (69 candidaturas,
> 20 primeiras entrevistas, 1 contrato assinado). O projeto original foi feito para o mercado
> dinamarquês, com portais como Jobindex e Jobnet.
>
> Este fork mantém todo o fluxo e a metodologia do original. O que mudou foi o que dependia
> do país: **portais de vagas brasileiros, regimes CLT/PJ, cálculo de salário líquido,
> currículo e processos seletivos no padrão do Brasil**. Todo o crédito pela arquitetura
> original é do Mads e dos contribuidores do projeto original, sob a
> [licença MIT](LICENSE). O README original, em inglês, está em [README.en.md](README.en.md).
>
> Projeto independente, sem vínculo com a Anthropic, o Gupy ou o VAGAS.com.br.

---

## O que é

Um conjunto de comandos para o [Claude Code](https://claude.com/claude-code) que o transforma
num assistente de candidaturas. Você preenche seu perfil uma vez, e a partir daí ele:

1. **Busca vagas** no Gupy, VAGAS.com.br, LinkedIn e Freehire, sem repetir vagas que você já viu;
2. **Avalia o encaixe** de cada vaga com o seu perfil (habilidades, experiência, cultura, local, regime);
3. **Adapta seu currículo e escreve a carta ou a mensagem** para aquela vaga específica, em LaTeX/PDF;
4. **Revisa tudo com um segundo agente** antes de entregar;
5. **Prepara você para a entrevista** e acompanha cada candidatura até o resultado.

```
/setup              /scrape                 /apply <url da vaga>
   |                   |                        |
   v                   v                        v
Seu perfil         Busca nos portais        Avalia o encaixe
preenchido         Gupy, VAGAS, LinkedIn    (regime, salário, requisitos)
   |                   |                        |
   v                   v                        v
Pronto para        /rank ordena as          Currículo + carta/mensagem
buscar             melhores vagas           -> revisor -> versão final
```

Tudo roda localmente: seus dados ficam no seu computador, e nada é enviado sem você pedir.

## O que foi adaptado para o Brasil

| Área | Original (Dinamarca) | Esta adaptação (Brasil) |
|------|----------------------|-------------------------|
| **Portais de vagas** | Jobindex, Jobnet, Jobbank, Jobdanmark | **Gupy** (o sistema de recrutamento da maioria das grandes empresas) e **VAGAS.com.br** (com faixa salarial quando publicada), ativos por padrão. LinkedIn com `-l "Brasil"`. Buscas extras via web em Catho, InfoJobs, Indeed, ProgramaThor, Remotar, Trampos, InHire e Solides. |
| **Tipo de contratação** | Emprego padrão | Identifica **CLT, PJ, estágio, trainee, jovem aprendiz, temporário e banco de talentos**. Um regime que você não aceita (ex.: "não aceito PJ") vira veto automático. |
| **Salário** | Índices de sindicato dinamarquês | **Calculadora CLT × PJ** com as tabelas de 2026: INSS, IRRF (com a isenção até R$ 5.000), 13º, férias + 1/3, FGTS, benefícios e Simples Nacional. Mostra quanto você precisa faturar como PJ para empatar com uma proposta CLT. |
| **Currículo** | Padrão europeu | Padrão brasileiro: **sem CPF, RG, foto, estado civil ou idade**; cidade/UF; telefone +55; seções em português; nomes de formação brasileiros (Bacharelado, Tecnólogo, Pós *lato sensu*). |
| **Carta de apresentação** | Carta formal sempre | No Brasil a carta formal é exceção: o fluxo propõe o **texto do campo do Gupy, o e-mail de candidatura ou a mensagem para o recrutador no LinkedIn**, e gera a carta só quando a vaga pede. |
| **Formulários** | Campos genéricos | **Pretensão salarial**, disponibilidade com **aviso prévio**, perguntas eliminatórias. Autodeclarações (raça, gênero, PcD) são sempre suas: o agente nunca preenche nem presume. |
| **Processo seletivo** | Entrevistas | Preparação para **testes de perfil e lógica, Entrevista Inteligente do Gupy (vídeo gravado), dinâmica de grupo**, RH e gestor. O Gupy informa as etapas reais de cada vaga. |
| **Segurança** | — | Alerta de **golpes de vaga**: taxa de cadastro, PIX, pedido de documentos antes da entrevista, contato só por WhatsApp. |

As regras completas estão em
[`10-mercado-brasileiro.md`](.claude/skills/job-application-assistant/10-mercado-brasileiro.md).

---

## Passo a passo

### 0. O que você precisa

| Ferramenta | Para quê | Como instalar |
|------------|----------|---------------|
| **Claude Code** | Roda o assistente | [claude.com/claude-code](https://claude.com/claude-code). Exige assinatura Claude Pro/Max/Team ou créditos de API (não há plano gratuito). |
| **Python 3.10+** | Ferramentas de apoio | macOS: `brew install python` · Windows: [python.org](https://www.python.org/downloads/) |
| **Bun** | Busca nos portais | macOS: `brew install oven-sh/bun/bun` · Linux/macOS: `curl -fsSL https://bun.sh/install \| bash` · Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| **LaTeX** | Gera o PDF do currículo e da carta | macOS: [MacTeX](https://tug.org/mactex/) · Windows: [MiKTeX](https://miktex.org/) · Linux: TeX Live. Instalação mínima: veja o [SETUP.md](SETUP.md#minimal-tex-install-tinytexbasictex). |
| **pypdf** (opcional) | Verifica se o PDF é legível por sistemas de triagem (ATS) | `pip install pypdf` |

> No Windows, use `python` em vez de `python3` nos comandos abaixo.

### 1. Faça sua cópia

> [!WARNING]
> **Cuidado com seus dados pessoais.** Um fork de um repositório público é sempre
> **público**, e o `/setup` (passo 3) grava seus **dados pessoais** (nome, contato,
> histórico profissional, pretensão salarial) em arquivos versionados. Se a cópia é para a
> sua própria busca de emprego, use um **repositório privado**, como abaixo. O passo a passo
> completo, e o porquê, está no [SETUP.md, seção 8](SETUP.md#8-pulling-upstream-updates-into-your-fork).
> Faça fork só se quiser contribuir com melhorias.

**Opção recomendada: cópia privada** (troque `SEU-USUARIO` pelo seu usuário do GitHub):

```bash
gh repo create minha-busca-de-emprego --private
git clone https://github.com/Mateus-Nogueira-GT/ai-job-search-brasil.git minha-busca-de-emprego
cd minha-busca-de-emprego
git remote rename origin upstream
git remote add origin https://github.com/SEU-USUARIO/minha-busca-de-emprego.git
git push -u origin master
```

Assim você recebe as atualizações deste projeto com `git pull upstream master`, e seus dados
ficam só no seu repositório privado.

**Opção para contribuir: fork público** (sem dados pessoais):

```bash
gh repo fork Mateus-Nogueira-GT/ai-job-search-brasil --clone
cd ai-job-search-brasil
gh repo set-default SEU-USUARIO/ai-job-search-brasil
```

### 2. Instale as ferramentas de busca

```bash
python3 tools/install_portal_clis.py
```

Isso prepara os buscadores de cada portal. Gupy e VAGAS funcionam mesmo sem essa etapa,
porque não têm dependências; ela só instala tipos usados nos testes.

### 3. Monte seu perfil

Abra o Claude Code na pasta do projeto:

```bash
claude
```

E digite:

```
/setup
```

O `/setup` oferece três caminhos e detecta qual serve para você:

- **Pasta de documentos:** coloque seu currículo em PDF, o export do LinkedIn, diplomas e
  cartas de recomendação em `documents/` (veja [documents/README.md](documents/README.md)), e ele lê tudo;
- **Colar o currículo** direto na conversa;
- **Entrevista:** ele faz perguntas e monta o perfil com você.

Diga que seu mercado é o **Brasil**. O `/setup` vai recomendar currículo em português e
perguntar os regimes que você aceita (CLT, PJ, estágio...), seu salário mínimo CLT e o valor
mínimo como PJ. Ele também pergunta em que cidades você topa trabalhar e o tempo máximo de
deslocamento, e com isso monta suas buscas.

### 4. Busque vagas

```
/scrape
```

Busca nos portais com base no seu perfil, remove as vagas que você já viu e mostra as novas
com uma avaliação rápida. Variações úteis:

```
/scrape dados          # foca numa área
/scrape broad          # busca em todas as categorias do seu perfil
/rank                  # pontua todas as vagas novas e devolve um ranking
```

### 5. Candidate-se

```
/apply https://empresa.gupy.io/jobs/12345678
```

Ou cole o texto da vaga, se o link não abrir:

```
/apply <texto completo da vaga>
```

O `/apply` faz, nesta ordem:

1. Verifica a vaga (texto escondido, instruções suspeitas, sinais de golpe);
2. **Avalia o encaixe** e mostra a nota por critério: habilidades, experiência, cultura, local e regime;
3. Se houver salário ou proposta, compara CLT × PJ;
4. Escreve o **currículo adaptado** e a **carta ou mensagem** no formato certo para a vaga;
5. Um **segundo agente revisa** e aponta problemas, e o primeiro corrige;
6. Gera os PDFs, confere 2 páginas, quebra de página e leitura por ATS;
7. Registra a candidatura no seu acompanhamento (`job_search_tracker.csv`).

Nada é enviado por você: o sistema prepara, e você revisa e envia.

### 6. Entrevistas e resultados

```
/interview             # prepara a próxima etapa: perguntas prováveis, respostas STAR, simulação
/outcome               # registra entrevistas, propostas, recusas; sugere follow-up quando a empresa some
/html-report           # painel offline com todas as suas candidaturas
```

---

## Ferramentas brasileiras direto no terminal

### Gupy

```bash
# Vagas de Python remotas, publicadas nos últimos 14 dias
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "python" --remote remoto --jobage 14 --format table

# Analista de dados, CLT, no estado de SP
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "analista de dados" -s SP --type clt --format table

# Estágio em engenharia em Minas Gerais
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "estágio engenharia" -s MG --type estagio --format table

# Vaga completa: descrição, requisitos, benefícios e etapas do processo
bun run .agents/skills/gupy-search/cli/src/cli.ts detail https://empresa.gupy.io/jobs/12345678 --format plain
```

Filtros: `--state`/`-s` (UF ou nome), `--city`/`-c`, `--remote remoto|hibrido|presencial`,
`--type clt|pj|estagio|trainee|aprendiz|temporario|banco-de-talentos|freelancer`, `--pcd`,
`--jobage <dias>`, `--sort recent|relevance`, `--page`, `--limit`.

### VAGAS.com.br

```bash
# A busca é literal: use o radical da área ("contabil", não "contador")
bun run .agents/skills/vagas-search/cli/src/cli.ts search -q "contabil" -c "São Paulo" --jobage 14 --format table

# Detalhe com faixa salarial, regime e benefícios
bun run .agents/skills/vagas-search/cli/src/cli.ts detail v2840369 --format plain
```

### Calculadora CLT × PJ

```bash
# Quanto sobra de um salário CLT de R$ 9.000 com R$ 1.500 de benefícios
python3 tools/clt_pj.py clt 9000 --beneficios 1500

# Quanto faturar como PJ para empatar com essa proposta CLT
python3 tools/clt_pj.py equivalente 9000 --beneficios 1500

# Comparar duas propostas reais
python3 tools/clt_pj.py comparar --clt 9000 --pj 13000

# PJ tirando um mês de férias sem faturar
python3 tools/clt_pj.py pj 15000 --meses 11
```

Exemplo real da ferramenta: um salário CLT de R$ 8.000 com R$ 1.200 de benefícios equivale
a faturar cerca de **R$ 9.860/mês como PJ** (Simples Nacional, Anexo III).

As tabelas (INSS 2026, IRRF com a Lei 15.270/2025, Simples Nacional Anexos III e V) ficam no
topo de [`tools/clt_pj.py`](tools/clt_pj.py) e mudam todo janeiro. É uma estimativa para
comparar propostas, não consultoria tributária: confirme sua estrutura PJ com um contador.

---

## Todos os comandos

| Comando | O que faz |
|---------|-----------|
| `/setup` | Monta seu perfil a partir de documentos, do currículo colado ou de uma entrevista |
| `/expand` | Enriquece o perfil com GitHub, portfólio, Google Scholar e ementas de cursos |
| `/scrape` | Busca vagas novas nos portais instalados |
| `/rank` | Pontua as vagas encontradas e devolve um ranking |
| `/apply <url>` | Avalia, adapta o currículo, escreve a carta ou mensagem, revisa e gera os PDFs |
| `/interview` | Prepara a próxima entrevista de uma candidatura, com simulação |
| `/outcome` | Registra o resultado, arquiva o que foi enviado e sugere follow-ups |
| `/upskill` | Mostra as habilidades que mais aparecem nas vagas e que faltam no seu perfil, com plano de estudo |
| `/html-report` | Gera um painel offline com suas candidaturas |
| `/gmail-sync` | Lê o Gmail e propõe atualizações de status (convites, recusas, propostas) |
| `/notion-sync` | Publica o funil num banco de dados do Notion (somente leitura) |
| `/add-portal` | Cria um buscador para outro portal (ex.: Catho, InfoJobs) |
| `/add-template` | Usa outro modelo de currículo ou carta (ex.: currículo de 1 página para estágio) |
| `/reset` | Apaga os dados do perfil para recomeçar |

---

## Limitações conhecidas

- **VAGAS.com.br** mostra no máximo cerca de 40 vagas por busca para visitantes, e a busca é
  literal. A ferramenta informa o total para você saber quando refinar.
- **Gupy:** vagas remotas não têm cidade nem estado, então um filtro de estado as exclui.
  Faça uma busca `--remote remoto` à parte (o `/scrape` já faz isso). O salário quase nunca é publicado.
- Os portais usam páginas públicas que podem mudar sem aviso. Se o `/scrape` marcar um portal
  como degradado, rode `/scrape health gupy` ou `/scrape health vagas`.
- Catho, InfoJobs e Indeed ainda não têm buscador próprio e entram via busca na web. Dá para
  criar um com `/add-portal`.
- O currículo padrão tem 2 páginas, o que serve a partir do nível pleno. Para estágio e
  júnior, registre um modelo de 1 página com `/add-template`.

## Segurança

As vagas são tratadas como **conteúdo não confiável**: o fluxo nunca segue instruções
escondidas no texto de uma vaga e não abre links de dentro dela. Mesmo assim, as defesas
dependem das instruções dadas ao agente e não isolam nada de verdade: confira o que foi
gerado antes de enviar. Detalhes em [SECURITY.md](SECURITY.md).

## Testes

```bash
python3 -m unittest discover -s tests -t .
cd .agents/skills/gupy-search/cli && bun test
cd .agents/skills/vagas-search/cli && bun test
```

Os testes dos portais rodam offline, sobre respostas reais salvas em `tests/fixtures/`.

## Créditos e licença

- **Projeto original:** [AI Job Search](https://github.com/ai-job-search-dev/ai-job-search), de
  **Mads Lorentzen** e contribuidores, criado para o mercado dinamarquês. Se o projeto te
  ajudar, considere apoiar o autor original no [Ko-fi](https://ko-fi.com/madslorentzen).
- **Adaptação brasileira:** [Mateus Nogueira](https://github.com/Mateus-Nogueira-GT):
  portais Gupy e VAGAS.com.br, calculadora CLT × PJ, guia do mercado brasileiro e esta documentação.
- Licença **MIT**, a mesma do original: veja [LICENSE](LICENSE). O aviso de copyright do autor
  original é mantido.

Histórico de mudanças: [CHANGELOG.md](CHANGELOG.md). Documentação técnica detalhada (em
inglês): [SETUP.md](SETUP.md) e [README.en.md](README.en.md).
