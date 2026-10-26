# Bibliotecas de terceiros (vendor)

Cópias **locais e imutáveis** das bibliotecas carregadas sob demanda pelo Portal
(PDF, Excel e miniaturas de PDF). Substituem o carregamento do CDN jsDelivr sem
verificação de conteúdo (auditoria de segurança Codex, achado #14 — v1.31.0).

Geradas em 2026-10-26 pelo script de vendorização da v1.31:
pacotes npm baixados do **registro oficial** com o SHA-512 do pacote (`dist.integrity`)
conferido antes da extração; SheetJS do CDN oficial do projeto (a versão do npm,
0.18.5, está descontinuada e tem CVEs conhecidas).

| Arquivo | Pacote | Origem verificada | SHA-256 | SRI (sha384) |
|---|---|---|---|---|
| `vendor/jspdf/jspdf.umd.min.js` | jspdf 2.5.2 | registro npm (SHA-512 do pacote conferido) | `85ba2cc3ff858a20fa49fe6e457bec863ea40b55a9f3725e58a940e62f6f61a4` | `sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/` |
| `vendor/jspdf/jspdf.plugin.autotable.min.js` | jspdf-autotable 3.8.4 | registro npm (SHA-512 do pacote conferido) | `2223830cf9a1ec85af014cc71b37c1b1eb566f3d18b2ab8071e96af822c58bdb` | `sha384-Xl/CUCfJbzsngMp0CFxkmF0VW/8C160IsGujqeQlIhaGxKz2+JsIGORFqtCPeldF` |
| `vendor/pdfjs/pdf.min.mjs` | pdfjs-dist 4.10.38 | registro npm (SHA-512 do pacote conferido) | `27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c` | `sha384-+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7` |
| `vendor/pdfjs/pdf.worker.min.mjs` | pdfjs-dist 4.10.38 | registro npm (SHA-512 do pacote conferido) | `1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36` | `sha384-ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o` |
| `vendor/sheetjs/xlsx.full.min.js` | xlsx (SheetJS) 0.20.3 | cdn.sheetjs.com | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` | `sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT` |

**Atualizar:** trocar a versão no script, revalidar PDF (relatório da fila e
nota técnica), Excel e miniatura de PDF em anexo, e atualizar esta tabela.
Não editar estes arquivos à mão.
