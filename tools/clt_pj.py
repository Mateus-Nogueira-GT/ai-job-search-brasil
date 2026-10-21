#!/usr/bin/env python3
"""CLT x PJ compensation calculator for the Brazilian market (2026 tables).

Brazilian offers come in two very different shapes: a CLT salary (employee,
with 13th salary, paid vacation + 1/3, FGTS, INSS and IRRF withheld) and a PJ
contract (the candidate invoices through their own company and receives none of
those). Comparing "R$ 10.000 CLT" with "R$ 14.000 PJ" by the headline number is
the single most common mistake in a Brazilian job search; this tool puts both on
the same annual, after-tax footing.

Usage:
    python3 tools/clt_pj.py clt 8000 [--dependentes 1] [--beneficios 1200]
    python3 tools/clt_pj.py pj 15000 [--anexo auto|III|V] [--contador 350] [--meses 12]
    python3 tools/clt_pj.py equivalente 8000 [--beneficios 1200] [--sem-fgts]
    python3 tools/clt_pj.py comparar --clt 8000 --pj 14000 [--beneficios 1200]
    ... --json            machine-readable output

Values are monthly, in BRL. Stdlib only, no I/O beyond stdout.

Tables (verify each January - they change yearly):
  - INSS 2026, employees: Portaria Interministerial MPS/MF nº 13/2026
    (minimum wage R$ 1.621,00; ceiling R$ 8.475,55).
  - IRRF 2026: monthly progressive table plus the Lei 15.270/2025 reduction
    (no tax up to R$ 5.000; partial reduction up to R$ 7.350); 10% withholding on
    profit distributions above R$ 50.000/month from one company.
  - Simples Nacional Anexos III and V (LC 123/2006, as amended by LC 155/2016),
    with the Fator R rule (payroll >= 28% of revenue -> Anexo III).

This is an estimate for comparing offers, not tax advice: it ignores PLR,
stock, alimony, annual IRPF adjustments (including the 2026 minimum tax on high
incomes), ISS variations and municipal specifics. Confirm a real PJ setup with a
contador.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from decimal import ROUND_HALF_UP, Decimal

YEAR = 2026

SALARIO_MINIMO = 1621.00
INSS_TETO = 8475.55
# (upper bound of band, rate) - progressive, each rate applies to its slice.
INSS_FAIXAS = [(1621.00, 0.075), (2902.84, 0.09), (4354.27, 0.12), (8475.55, 0.14)]
INSS_CONTRIBUINTE_INDIVIDUAL = 0.11  # pró-labore withholding, capped at the ceiling

# (upper bound, rate, deduction) - monthly progressive IRRF table.
IRRF_FAIXAS = [
    (2428.80, 0.0, 0.0),
    (2826.65, 0.075, 182.16),
    (3751.05, 0.15, 394.16),
    (4664.68, 0.225, 675.49),
    (float("inf"), 0.275, 908.73),
]
IRRF_DEDUCAO_DEPENDENTE = 189.59
IRRF_DESCONTO_SIMPLIFICADO = 607.20
# Lei 15.270/2025 monthly reduction.
REDUTOR_ISENCAO_ATE = 5000.00
REDUTOR_MAXIMO = 312.89
REDUTOR_FAIXA_ATE = 7350.00
REDUTOR_A = 978.62
REDUTOR_B = 0.133145
DIVIDENDOS_LIMITE_MENSAL = 50000.00
DIVIDENDOS_ALIQUOTA = 0.10

FGTS = 0.08
FATOR_R_MINIMO = 0.28

# (annual revenue upper bound, nominal rate, deduction)
SIMPLES_ANEXO_III = [
    (180000, 0.06, 0),
    (360000, 0.112, 9360),
    (720000, 0.135, 17640),
    (1800000, 0.16, 35640),
    (3600000, 0.21, 125640),
    (4800000, 0.33, 648000),
]
SIMPLES_ANEXO_V = [
    (180000, 0.155, 0),
    (360000, 0.18, 4500),
    (720000, 0.195, 9900),
    (1800000, 0.205, 17100),
    (3600000, 0.23, 62100),
    (4800000, 0.305, 540000),
]
SIMPLES_TETO = 4800000


def r2(x: float) -> float:
    """Round to centavos half-up, as payroll does. Plain round() is banker's
    rounding on a binary float: 1621 * 7.5% = 121.57499... would become 121.57."""
    return float(Decimal(repr(round(x, 6))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def inss_empregado(bruto: float) -> float:
    total, piso = 0.0, 0.0
    for teto, aliq in INSS_FAIXAS:
        if bruto <= piso:
            break
        total += (min(bruto, teto) - piso) * aliq
        piso = teto
    return r2(total)


def inss_prolabore(prolabore: float) -> float:
    return r2(min(prolabore, INSS_TETO) * INSS_CONTRIBUINTE_INDIVIDUAL)


def _irrf_tabela(base: float) -> float:
    for teto, aliq, deducao in IRRF_FAIXAS:
        if base <= teto:
            return max(0.0, base * aliq - deducao)
    raise AssertionError("unreachable")


def irrf(rendimento: float, inss: float, dependentes: int = 0) -> float:
    """Monthly IRRF on a taxable payment, with the 2026 reduction.

    The base takes the larger of the legal deductions (INSS + dependents) and the
    simplified monthly discount; the reduction is computed on the gross taxable
    income and capped at the tax due.
    """
    deducoes = max(inss + dependentes * IRRF_DEDUCAO_DEPENDENTE, IRRF_DESCONTO_SIMPLIFICADO)
    imposto = _irrf_tabela(max(0.0, rendimento - deducoes))
    if rendimento <= REDUTOR_ISENCAO_ATE:
        reducao = min(REDUTOR_MAXIMO, imposto)
    elif rendimento <= REDUTOR_FAIXA_ATE:
        reducao = max(0.0, REDUTOR_A - REDUTOR_B * rendimento)
    else:
        reducao = 0.0
    return r2(max(0.0, imposto - min(reducao, imposto)))


def liquido_mensal(bruto: float, dependentes: int = 0) -> tuple[float, float, float]:
    """(INSS, IRRF, net) for one CLT payment."""
    i = inss_empregado(bruto)
    t = irrf(bruto, i, dependentes)
    return i, t, r2(bruto - i - t)


@dataclass
class CLT:
    salario_bruto: float
    inss: float
    irrf: float
    liquido_mensal: float
    decimo_terceiro_liquido: float
    ferias_terco_liquido: float
    fgts_anual: float
    beneficios_anual: float
    liquido_anual: float
    pacote_anual: float  # net cash + FGTS (if counted) + benefits


def calc_clt(salario: float, dependentes: int = 0, beneficios: float = 0.0, contar_fgts: bool = True) -> CLT:
    inss, ir, liq = liquido_mensal(salario, dependentes)
    # 13th salary is taxed on its own (exclusive taxation), same tables.
    _, _, liq13 = liquido_mensal(salario, dependentes)
    # Vacation month: salary + 1/3 paid together; the extra over a normal month.
    _, _, liq_ferias_mes = liquido_mensal(salario * 4 / 3, dependentes)
    terco_liq = r2(liq_ferias_mes - liq)
    fgts = r2(FGTS * salario * (13 + 1 / 3))
    benef = r2(beneficios * 12)
    liquido_anual = r2(12 * liq + liq13 + terco_liq)
    pacote = r2(liquido_anual + (fgts if contar_fgts else 0.0) + benef)
    return CLT(salario, inss, ir, liq, liq13, terco_liq, fgts, benef, liquido_anual, pacote)


def simples_aliquota_efetiva(receita_anual: float, anexo: str) -> float:
    if receita_anual > SIMPLES_TETO:
        raise ValueError(f"faturamento anual acima do teto do Simples Nacional (R$ {SIMPLES_TETO:,.0f})")
    tabela = SIMPLES_ANEXO_III if anexo == "III" else SIMPLES_ANEXO_V
    for teto, nominal, deducao in tabela:
        if receita_anual <= teto:
            return (receita_anual * nominal - deducao) / receita_anual if receita_anual else nominal
    raise AssertionError("unreachable")


@dataclass
class PJ:
    faturamento_mensal: float
    anexo: str
    aliquota_efetiva: float
    das: float
    prolabore: float
    inss_prolabore: float
    irrf_prolabore: float
    contador: float
    lucros_distribuidos: float
    irrf_dividendos: float
    liquido_mensal: float
    meses_faturados: int
    liquido_anual: float


def _calc_pj_anexo(fat: float, anexo: str, contador: float, dependentes: int, meses: int, prolabore: float | None) -> PJ:
    receita_anual = fat * 12
    aliq = simples_aliquota_efetiva(receita_anual, anexo)
    das = r2(fat * aliq)
    if prolabore is None:
        # Anexo III needs payroll >= 28% of revenue (Fator R); Anexo V only the
        # minimum-wage pró-labore every partner must draw.
        prolabore = max(SALARIO_MINIMO, fat * FATOR_R_MINIMO) if anexo == "III" else SALARIO_MINIMO
    prolabore = r2(prolabore)
    inss_pl = inss_prolabore(prolabore)
    ir_pl = irrf(prolabore, inss_pl, dependentes)
    lucros = r2(max(0.0, fat - das - prolabore - contador))
    ir_div = r2(lucros * DIVIDENDOS_ALIQUOTA) if lucros > DIVIDENDOS_LIMITE_MENSAL else 0.0
    liq = r2(fat - das - inss_pl - ir_pl - contador - ir_div)
    return PJ(fat, anexo, round(aliq, 4), das, prolabore, inss_pl, ir_pl, contador, lucros, ir_div, liq, meses, r2(liq * meses))


def calc_pj(fat: float, anexo: str = "auto", contador: float = 350.0, dependentes: int = 0, meses: int = 12, prolabore: float | None = None) -> PJ:
    if anexo in ("III", "V"):
        return _calc_pj_anexo(fat, anexo, contador, dependentes, meses, prolabore)
    a = _calc_pj_anexo(fat, "III", contador, dependentes, meses, prolabore)
    b = _calc_pj_anexo(fat, "V", contador, dependentes, meses, prolabore)
    return a if a.liquido_anual >= b.liquido_anual else b


def equivalente_pj(clt: CLT, **pj_kwargs) -> PJ:
    """Smallest monthly PJ invoice whose annual net matches the CLT package."""
    alvo = clt.pacote_anual
    lo, hi = 0.0, SIMPLES_TETO / 12
    if calc_pj(hi, **pj_kwargs).liquido_anual < alvo:
        raise ValueError("pacote CLT acima do que o Simples Nacional comporta")
    for _ in range(80):
        mid = (lo + hi) / 2
        if calc_pj(mid, **pj_kwargs).liquido_anual >= alvo:
            hi = mid
        else:
            lo = mid
    return calc_pj(round(hi + 0.005, 2), **pj_kwargs)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def brl(x: float) -> str:
    s = f"{x:,.2f}"
    return "R$ " + s.replace(",", "_").replace(".", ",").replace("_", ".")


def show_clt(c: CLT, contar_fgts: bool) -> str:
    return "\n".join([
        f"CLT — salário bruto {brl(c.salario_bruto)}/mês (tabelas {YEAR})",
        f"  INSS:                 {brl(c.inss)}",
        f"  IRRF:                 {brl(c.irrf)}",
        f"  Líquido mensal:       {brl(c.liquido_mensal)}",
        f"  13º líquido:          {brl(c.decimo_terceiro_liquido)}",
        f"  1/3 de férias líq.:   {brl(c.ferias_terco_liquido)}",
        f"  Líquido anual:        {brl(c.liquido_anual)}",
        f"  FGTS anual:           {brl(c.fgts_anual)}{'' if contar_fgts else '  (não contado no pacote)'}",
        f"  Benefícios anuais:    {brl(c.beneficios_anual)}",
        f"  PACOTE ANUAL:         {brl(c.pacote_anual)}  (≈ {brl(c.pacote_anual / 12)}/mês)",
    ])


def show_pj(p: PJ) -> str:
    return "\n".join([
        f"PJ — faturamento {brl(p.faturamento_mensal)}/mês, Simples Nacional Anexo {p.anexo} (alíquota efetiva {p.aliquota_efetiva * 100:.2f}%)",
        f"  DAS (Simples):        {brl(p.das)}",
        f"  Pró-labore:           {brl(p.prolabore)}  (INSS {brl(p.inss_prolabore)}, IRRF {brl(p.irrf_prolabore)})",
        f"  Contador:             {brl(p.contador)}",
        f"  Lucros distribuídos:  {brl(p.lucros_distribuidos)}" + (f"  (IRRF 10%: {brl(p.irrf_dividendos)})" if p.irrf_dividendos else "  (isentos)"),
        f"  Líquido mensal:       {brl(p.liquido_mensal)}",
        f"  LÍQUIDO ANUAL:        {brl(p.liquido_anual)}  ({p.meses_faturados} meses faturados; sem 13º, férias pagas nem FGTS)",
    ])


NOTA = ("Estimativa para comparar propostas, não consultoria tributária. Ignora PLR, ações, ajuste anual do IRPF "
        "e particularidades municipais (ISS). Confirme a estrutura PJ com um contador.")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Calculadora CLT x PJ (Brasil, tabelas %d)" % YEAR)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common_clt(p):
        p.add_argument("--dependentes", type=int, default=0)
        p.add_argument("--beneficios", type=float, default=0.0, help="valor mensal de VR/VA, plano de saúde etc.")
        p.add_argument("--sem-fgts", action="store_true", help="não contar o FGTS no pacote CLT")

    def common_pj(p):
        p.add_argument("--anexo", choices=["auto", "III", "V"], default="auto")
        p.add_argument("--contador", type=float, default=350.0, help="mensalidade do contador (padrão R$ 350)")
        p.add_argument("--meses", type=int, default=12, help="meses faturados por ano (11 = um mês de férias sem faturar)")
        p.add_argument("--prolabore", type=float, default=None)

    p = sub.add_parser("clt", help="líquido e pacote anual de um salário CLT")
    p.add_argument("salario", type=float)
    common_clt(p)
    p = sub.add_parser("pj", help="líquido de um faturamento PJ no Simples Nacional")
    p.add_argument("faturamento", type=float)
    p.add_argument("--dependentes", type=int, default=0)
    common_pj(p)
    p = sub.add_parser("equivalente", help="faturamento PJ que empata com um salário CLT")
    p.add_argument("salario", type=float)
    common_clt(p)
    common_pj(p)
    p = sub.add_parser("comparar", help="compara uma proposta CLT com uma PJ")
    p.add_argument("--clt", type=float, required=True)
    p.add_argument("--pj", type=float, required=True)
    common_clt(p)
    common_pj(p)
    for sp in sub.choices.values():
        sp.add_argument("--json", action="store_true")

    # Text is pt-BR ("líquido", "R$", "≈"); a Windows pipe defaults to cp1252.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)  # absent on a StringIO under test
        if reconfigure:
            reconfigure(encoding="utf-8")

    a = ap.parse_args(argv)
    for name in ("salario", "faturamento", "clt", "pj"):
        v = getattr(a, name, None)
        if v is not None and not (v > 0 and v < float("inf")):
            ap.error(f"{name} deve ser um valor positivo")
    if getattr(a, "meses", 12) not in range(1, 13):
        ap.error("--meses deve estar entre 1 e 12")
    if a.dependentes < 0:
        ap.error("--dependentes não pode ser negativo")

    pj_kwargs = {}
    if a.cmd in ("pj", "equivalente", "comparar"):
        pj_kwargs = dict(anexo=a.anexo, contador=a.contador, dependentes=a.dependentes, meses=a.meses, prolabore=a.prolabore)

    try:
        out: dict = {"ano_tabelas": YEAR}
        text: list[str] = []
        if a.cmd in ("clt", "equivalente", "comparar"):
            c = calc_clt(a.salario if a.cmd != "comparar" else a.clt, a.dependentes, a.beneficios, not a.sem_fgts)
            out["clt"] = asdict(c)
            text.append(show_clt(c, not a.sem_fgts))
        if a.cmd == "pj":
            pj = calc_pj(a.faturamento, **pj_kwargs)
            out["pj"] = asdict(pj)
            text.append(show_pj(pj))
        if a.cmd == "equivalente":
            pj = equivalente_pj(c, **pj_kwargs)
            out["pj_equivalente"] = asdict(pj)
            out["razao_pj_clt"] = round(pj.faturamento_mensal / c.salario_bruto, 3)
            text += ["", show_pj(pj), "",
                     f"=> Para empatar com {brl(c.salario_bruto)} CLT, fature pelo menos {brl(pj.faturamento_mensal)}/mês como PJ "
                     f"({out['razao_pj_clt']:.2f}x o salário bruto)."]
        if a.cmd == "comparar":
            pj = calc_pj(a.pj, **pj_kwargs)
            out["pj"] = asdict(pj)
            diff = r2(pj.liquido_anual - c.pacote_anual)
            out["diferenca_anual_pj_menos_clt"] = diff
            melhor = "PJ" if diff > 0 else "CLT" if diff < 0 else "empate"
            text += ["", show_pj(pj), "",
                     f"=> Diferença anual (PJ − pacote CLT): {brl(diff)} — financeiramente melhor: {melhor}. "
                     "Pese também estabilidade, seguro-desemprego, multa de 40% do FGTS e benefícios não monetários."]
    except ValueError as e:
        print(json.dumps({"error": str(e), "code": "OUT_OF_RANGE"}, ensure_ascii=False), file=sys.stderr)
        return 1

    if a.json:
        out["nota"] = NOTA
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        print("\n".join(text))
        print("\n" + NOTA)
    return 0


if __name__ == "__main__":
    sys.exit(main())
