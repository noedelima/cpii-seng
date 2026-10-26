// =============================================================================
// LDAP "simple bind" mínimo — ZERO dependências (BER/ASN.1 artesanal + tls
// nativo). Suficiente para AUTENTICAR (bind) contra Active Directory / OpenLDAP;
// não faz busca nem leitura de atributos. Base da futura autenticação
// Matrícula/Senha de rede do CPII (ADR-003) — DORMENTE até LDAP_URL ser
// configurada no SWA pela DTI.
//
// v1.31 (auditoria #7): FALHA FECHADA para qualquer transporte sem TLS. Só
// `ldaps://` é aceito (o simple bind envia a senha em claro dentro do canal);
// certificado validado normalmente (rejectUnauthorized), TLS ≥ 1.2. Não há
// opção de desligar a validação.
//
//   await ldapBind('ldaps://ad.cp2.g12.br:636', '3304702@cp2.g12.br', 'senha')
//     → resolve { ok: true } | { ok: false, codigo } ; rejeita em erro de rede
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
const berInt = (n) => berTLV(0x02, Buffer.from([n]));
const berStr = (s) => berTLV(0x04, Buffer.from(String(s), 'utf8'));

function bindRequest(dn, senha) {
  const op = berTLV(0x60, Buffer.concat([
    berInt(3),
    berStr(dn),
    berTLV(0x80, Buffer.from(String(senha), 'utf8')),
  ]));
  return berTLV(0x30, Buffer.concat([berInt(1), op]));
}

// ---- BER (decode do BindResponse) ------------------------------------------
function lerTLV(buf, off) {
  if (off + 2 > buf.length) throw new Error('incompleto');
  const tag = buf[off];
  let len = buf[off + 1], ini = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f; len = 0;
    if (n > 4 || ini + n > buf.length) throw new Error('incompleto');
    for (let i = 0; i < n; i++) len = (len << 8) | buf[ini + i];
    ini += n;
  }
  if (ini + len > buf.length) throw new Error('incompleto');
  return { tag, len, ini, fim: ini + len };
}
function parseBindResponse(buf) {
  const seq = lerTLV(buf, 0);
  const msgId = lerTLV(buf, seq.ini);
  const op = lerTLV(buf, msgId.fim);
  if (op.tag !== 0x61) throw new Error('resposta LDAP inesperada');
  const cod = lerTLV(buf, op.ini);
  return { codigo: buf[cod.ini] };
}

// Valida a URL: somente ldaps:// com host — qualquer outra coisa é recusada.
function urlSegura(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('LDAP_URL inválida'); }
  if (u.protocol !== 'ldaps:') throw new Error('LDAP_URL recusada: somente ldaps:// (TLS) é permitido');
  if (!u.hostname) throw new Error('LDAP_URL sem host');
  return u;
}

// ---- Bind -------------------------------------------------------------------
function ldapBind(url, dn, senha, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = urlSegura(url); } catch (e) { return reject(e); }
    if (!senha) return resolve({ ok: false, codigo: 49 });
    const porta = Number(u.port) || 636;

    let socket, feito = false;
    const fim = (fn, v) => { if (!feito) { feito = true; try { socket.destroy(); } catch { } fn(v); } };
    const timer = setTimeout(() => fim(reject, new Error('LDAP: tempo esgotado')), timeoutMs);

    socket = tls.connect({
      host: u.hostname, port: porta, servername: u.hostname,
      rejectUnauthorized: true, minVersion: 'TLSv1.2',
    }, () => socket.write(bindRequest(dn, senha)));
    const partes = [];
    socket.on('data', (d) => {
      partes.push(d);
      try {
        const { codigo } = parseBindResponse(Buffer.concat(partes));
        clearTimeout(timer);
        fim(resolve, { ok: codigo === 0, codigo });
      } catch { /* resposta ainda incompleta — aguarda mais dados */ }
    });
    socket.on('error', (e) => { clearTimeout(timer); fim(reject, e); });
    socket.on('close', () => { clearTimeout(timer); fim(reject, new Error('LDAP: conexão encerrada sem resposta')); });
  });
}

// Disponível somente com URL ldaps:// válida — configuração insegura = dormente.
const ldapDisponivel = () => {
  try { return !!process.env.LDAP_URL && !!urlSegura(process.env.LDAP_URL); } catch { return false; }
};

module.exports = { ldapBind, ldapDisponivel, urlSegura };
