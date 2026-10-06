// =============================================================================
// LDAP "simple bind" mínimo — ZERO dependências (BER/ASN.1 artesanal + tls
// nativos). Suficiente para AUTENTICAR (bind) contra Active Directory / OpenLDAP;
// não faz busca nem leitura de atributos. Base da futura autenticação
// Matrícula/Senha de rede do CPII (ADR-003) — dormente até LDAP_URL ser
// configurada no SWA pela DTI.
//
//   await ldapBind('ldaps://ad.cp2.g12.br:636', '3304702@cp2.g12.br', 'senha')
//     → resolve { ok: true } (credencial válida)
//     → resolve { ok: false, codigo, mensagem } (credencial inválida — código 49)
//     → rejeita (erro de rede/servidor)
//
// BindRequest (RFC 4511): SEQUENCE { messageID(1), [APPLICATION 0] {
//   version(3), name OCTET STRING, [CONTEXT 0] senha } }
// =============================================================================
const tls = require('tls');

// ---- BER (encode) -----------------------------------------------------------
function berLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const berTLV = (tag, valor) => Buffer.concat([Buffer.from([tag]), berLen(valor.length), valor]);
const berInt = (n) => berTLV(0x02, Buffer.from([n]));            // inteiros pequenos (1/3)
const berStr = (s) => berTLV(0x04, Buffer.from(String(s), 'utf8'));

function bindRequest(dn, senha) {
  const op = berTLV(0x60, Buffer.concat([                        // [APPLICATION 0]
    berInt(3),                                                   // version 3
    berStr(dn),
    berTLV(0x80, Buffer.from(String(senha), 'utf8')),            // [0] simple
  ]));
  return berTLV(0x30, Buffer.concat([berInt(1), op]));           // { messageID=1, op }
}

// ---- BER (decode do BindResponse) ------------------------------------------
function lerTLV(buf, off) {
  const tag = buf[off];
  let len = buf[off + 1], ini = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f; len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[ini + i];
    ini += n;
  }
  return { tag, len, ini, fim: ini + len };
}
function parseBindResponse(buf) {
  const seq = lerTLV(buf, 0);                       // SEQUENCE
  const msgId = lerTLV(buf, seq.ini);               // messageID
  const op = lerTLV(buf, msgId.fim);                // [APPLICATION 1] BindResponse
  if (op.tag !== 0x61) throw new Error('resposta LDAP inesperada (tag 0x' + op.tag.toString(16) + ')');
  const cod = lerTLV(buf, op.ini);                  // resultCode (ENUMERATED)
  const codigo = buf[cod.ini];
  const dn = lerTLV(buf, cod.fim);                  // matchedDN
  const msg = lerTLV(buf, dn.fim);                  // diagnosticMessage
  const mensagem = buf.slice(msg.ini, msg.fim).toString('utf8');
  return { codigo, mensagem };
}

// ---- Bind -------------------------------------------------------------------
function ldapBind(url, dn, senha, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(new Error('LDAP_URL inválida')); }
    if (u.protocol !== 'ldaps:' || !u.hostname || u.username || u.password
        || (u.pathname && u.pathname !== '/') || u.search || u.hash) {
      return reject(new Error('LDAP_URL deve usar LDAPS com validação de certificado'));
    }
    if (!senha) return resolve({ ok: false, codigo: 49, mensagem: 'senha vazia (bind anônimo recusado)' });
    const porta = Number(u.port) || 636;
    const conectar = (cb) => tls.connect({
      host: u.hostname, port: porta, servername: u.hostname, rejectUnauthorized: true,
    }, cb);

    let socket, feito = false;
    const fim = (fn, v) => { if (!feito) { feito = true; try { socket.destroy(); } catch { } fn(v); } };
    const timer = setTimeout(() => fim(reject, new Error('LDAP: tempo esgotado')), timeoutMs);

    socket = conectar(() => socket.write(bindRequest(dn, senha)));
    const partes = [];
    socket.on('data', (d) => {
      partes.push(d);
      if (partes.reduce((n, b) => n + b.length, 0) > 65536) {
        clearTimeout(timer); fim(reject, new Error('LDAP: resposta excessiva')); return;
      }
      try {
        const buf = Buffer.concat(partes);
        if (buf.length < 2 || lerTLV(buf, 0).fim > buf.length) return;
        const { codigo, mensagem } = parseBindResponse(buf);
        clearTimeout(timer);
        fim(resolve, { ok: codigo === 0, codigo, mensagem });
      } catch { /* resposta ainda incompleta — aguarda mais dados */ }
    });
    socket.on('error', (e) => { clearTimeout(timer); fim(reject, e); });
    socket.on('close', () => { clearTimeout(timer); fim(reject, new Error('LDAP: conexão encerrada sem resposta')); });
  });
}

const ldapDisponivel = () => !!process.env.LDAP_URL;

module.exports = { ldapBind, ldapDisponivel };
