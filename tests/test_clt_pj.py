"""tools/clt_pj.py: 2026 INSS/IRRF/Simples arithmetic and the CLI contract."""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

import clt_pj  # noqa: E402


class Inss(unittest.TestCase):
    def test_progressive_bands(self):
        # 1621*7.5% + (2902.84-1621)*9% + (4354.27-2902.84)*12% + (8000-4354.27)*14%
        self.assertEqual(clt_pj.inss_empregado(8000), 921.51)
        self.assertEqual(clt_pj.inss_empregado(1621), 121.58)

    def test_ceiling(self):
        self.assertEqual(clt_pj.inss_empregado(8475.55), clt_pj.inss_empregado(50000))
        self.assertAlmostEqual(clt_pj.inss_empregado(50000), 988.09, places=1)

    def test_prolabore_is_flat_11_percent_capped(self):
        self.assertEqual(clt_pj.inss_prolabore(2000), 220.0)
        self.assertEqual(clt_pj.inss_prolabore(20000), round(8475.55 * 0.11, 2))


class Irrf(unittest.TestCase):
    def test_exempt_up_to_5000(self):
        for bruto in (2000, 4500, 5000):
            self.assertEqual(clt_pj.irrf(bruto, clt_pj.inss_empregado(bruto)), 0.0, bruto)

    def test_partial_reduction_band(self):
        bruto = 6200
        inss = clt_pj.inss_empregado(bruto)
        sem_redutor = (bruto - inss) * 0.275 - 908.73
        redutor = 978.62 - 0.133145 * bruto
        self.assertAlmostEqual(clt_pj.irrf(bruto, inss), sem_redutor - redutor, places=1)

    def test_no_reduction_above_7350(self):
        inss = clt_pj.inss_empregado(8000)
        self.assertAlmostEqual(clt_pj.irrf(8000, inss), (8000 - inss) * 0.275 - 908.73, places=2)

    def test_dependents_lower_the_tax(self):
        inss = clt_pj.inss_empregado(10000)
        self.assertLess(clt_pj.irrf(10000, inss, dependentes=2), clt_pj.irrf(10000, inss))

    def test_simplified_discount_used_when_larger(self):
        # A low pró-labore has INSS below R$ 607.20, so the simplified discount wins.
        self.assertEqual(clt_pj.irrf(9000, 100.0), clt_pj.irrf(9000, 607.20))


class Clt(unittest.TestCase):
    def test_package_components(self):
        c = clt_pj.calc_clt(8000, beneficios=1000)
        self.assertEqual(c.liquido_mensal, round(8000 - c.inss - c.irrf, 2))
        self.assertAlmostEqual(c.fgts_anual, 0.08 * 8000 * (13 + 1 / 3), places=1)
        self.assertEqual(c.beneficios_anual, 12000)
        self.assertAlmostEqual(c.pacote_anual, c.liquido_anual + c.fgts_anual + 12000, places=1)
        self.assertGreater(c.ferias_terco_liquido, 0)
        self.assertLess(c.ferias_terco_liquido, 8000 / 3)

    def test_without_fgts(self):
        c = clt_pj.calc_clt(8000, contar_fgts=False)
        self.assertEqual(c.pacote_anual, c.liquido_anual)


class Pj(unittest.TestCase):
    def test_anexo_iii_first_band_is_six_percent(self):
        p = clt_pj.calc_pj(10000, anexo="III")
        self.assertAlmostEqual(p.aliquota_efetiva, 0.06)
        self.assertEqual(p.prolabore, 2800.0)  # Fator R: 28% of revenue

    def test_effective_rate_uses_deduction(self):
        # 300k/yr in Anexo III band 2: (300000*11.2% - 9360) / 300000
        self.assertAlmostEqual(clt_pj.simples_aliquota_efetiva(300000, "III"), (300000 * 0.112 - 9360) / 300000)

    def test_auto_picks_the_better_annex(self):
        p = clt_pj.calc_pj(15000)
        best = max(clt_pj.calc_pj(15000, anexo="III").liquido_anual, clt_pj.calc_pj(15000, anexo="V").liquido_anual)
        self.assertEqual(p.liquido_anual, best)

    def test_dividends_above_50k_are_withheld(self):
        p = clt_pj.calc_pj(120000, anexo="III")
        self.assertGreater(p.lucros_distribuidos, 50000)
        self.assertAlmostEqual(p.irrf_dividendos, p.lucros_distribuidos * 0.10, places=1)
        self.assertEqual(clt_pj.calc_pj(20000).irrf_dividendos, 0.0)

    def test_fewer_billed_months(self):
        self.assertAlmostEqual(clt_pj.calc_pj(15000, meses=11).liquido_anual, clt_pj.calc_pj(15000).liquido_mensal * 11, places=1)

    def test_above_simples_ceiling_raises(self):
        with self.assertRaises(ValueError):
            clt_pj.calc_pj(500000)


class Equivalente(unittest.TestCase):
    def test_matches_the_clt_package(self):
        c = clt_pj.calc_clt(8000, beneficios=1200)
        p = clt_pj.equivalente_pj(c)
        self.assertGreaterEqual(p.liquido_anual, c.pacote_anual)
        self.assertLess(p.liquido_anual - c.pacote_anual, 1.0)
        self.assertGreater(p.faturamento_mensal, 8000)

    def test_unbilled_vacation_raises_the_bar(self):
        c = clt_pj.calc_clt(8000)
        self.assertGreater(clt_pj.equivalente_pj(c, meses=11).faturamento_mensal, clt_pj.equivalente_pj(c).faturamento_mensal)


class Cli(unittest.TestCase):
    def run_cli(self, *args):
        env = dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONUTF8="0")
        return subprocess.run([sys.executable, str(REPO / "tools" / "clt_pj.py"), *args], capture_output=True, env=env)

    def test_json_output_on_a_legacy_console(self):
        proc = self.run_cli("comparar", "--clt", "10000", "--pj", "14000", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout.decode("utf-8"))
        self.assertEqual(data["ano_tabelas"], 2026)
        self.assertIn("diferenca_anual_pj_menos_clt", data)

    def test_text_output_is_utf8(self):
        proc = self.run_cli("equivalente", "6000")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("Líquido mensal", proc.stdout.decode("utf-8"))

    def test_rejects_non_positive_values(self):
        self.assertEqual(self.run_cli("clt", "0").returncode, 2)
        self.assertEqual(self.run_cli("clt", "nan").returncode, 2)
        self.assertEqual(self.run_cli("pj", "10000", "--meses", "13").returncode, 2)

    def test_out_of_range_is_a_json_error(self):
        proc = self.run_cli("pj", "900000")
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(json.loads(proc.stderr.decode("utf-8"))["code"], "OUT_OF_RANGE")


if __name__ == "__main__":
    unittest.main()
