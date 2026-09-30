# Validation

`run_stress_test.py` is an offline artifact generator, not a runtime API
feature. It evaluates the frozen Module A + Module B pipeline on V1/V2 and
writes numbers/plots under `/results`.

Ground-truth labels are consumed only here for evaluation. The production
`/analyze` endpoint does not require them and never sends them to either module.
