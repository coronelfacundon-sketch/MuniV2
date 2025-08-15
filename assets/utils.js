
// ===== Claves de almacenamiento
export const K_SETTINGS='muni_settings_v1';
export const K_SEQ='muni_seq_v1';
export const K_PF_MONO='muni_pf_mono_v1';
export const K_PF_RI='muni_pf_ri_v1';

// ===== Helpers DOM
export const $ = (q,root=document)=>root.querySelector(q);
export const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));

// ===== Settings (cohorte/curso/docente/versión/prefijo)
export function loadSettings(){ return JSON.parse(localStorage.getItem(K_SETTINGS)||'{}'); }
export function saveSettings(s){ localStorage.setItem(K_SETTINGS, JSON.stringify(s)); }
export function clearSettings(){ localStorage.removeItem(K_SETTINGS); }

// ===== Secuencias y numeración
export function getSeq(){ return JSON.parse(localStorage.getItem(K_SEQ)||'{}'); }
export function bumpSeq(tipo, curso){
  const seq=getSeq(); const key=`${(curso||'GEN').toUpperCase()}-${tipo}`;
  seq[key]=(seq[key]||0)+1; localStorage.setItem(K_SEQ, JSON.stringify(seq));
  return seq[key];
}
export function fmtRegistro(tipo){
  const s=loadSettings(); const n=bumpSeq(tipo, s.curso); const num=String(n).padStart(4,'0');
  return `${s.prefijo||'ESCOBAR360'}-${s.year||new Date().getFullYear()}-${(s.curso||'GEN').replace(/\s+/g,'')}-${tipo}-${num}`.toUpperCase();
}

// ===== Validaciones
export function validCUIT(c){
  if(!/^\d{11}$/.test(c||'')) return false;
  const a=c.split('').map(Number); const w=[5,4,3,2,7,6,5,4,3,2];
  let s=0; for(let i=0;i<10;i++) s+=a[i]*w[i];
  let d=11-(s%11); if(d===11) d=0; else if(d===10) d=9; return d===a[10];
}
export const validPhone = (p)=> /^\d{6,15}$/.test(p||'');
export const validEmail = (e)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e||'');
export const validCP = (cp)=> /^\d{4}$/.test(cp||'');

// ===== Storage helpers
export const lsGet=(k)=>JSON.parse(localStorage.getItem(k)||'[]');
export const lsSet=(k,v)=>localStorage.setItem(k, JSON.stringify(v));

// ===== Mini QR (pedagógico)
export class MiniQR{
  constructor(el){ this.el=el }
  make(text){
    const c=document.createElement('canvas'); const s=128; c.width=c.height=s; const g=c.getContext('2d');
    g.fillStyle='#fff'; g.fillRect(0,0,s,s); g.fillStyle='#000';
    const finder=(x,y)=>{ g.fillRect(x,y,28,28); g.fillStyle='#fff'; g.fillRect(x+6,y+6,16,16); g.fillStyle='#000'; g.fillRect(x+10,y+10,8,8); };
    finder(6,6); finder(s-34,6); finder(6,s-34);
    let h=0; for(const ch of String(text)){ h=(h*31 + ch.charCodeAt(0))>>>0; }
    for(let y=0;y<40;y++){ for(let x=0;x<40;x++){ if(((x*1103515245 + y*12345 + h)>>5)&1){ g.fillRect(36+x*2,36+y*2,2,2); } } }
    this.el.innerHTML=''; this.el.appendChild(c);
  }
}

// ===== ZIP (STORE) — utilitario mínimo para exportar pack de constancias
export function crc32(buf){
  // buf: Uint8Array
  let table = crc32.table;
  if(!table){
    table = new Uint32Array(256);
    for (let i=0; i<256; i++){
      let c=i;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i]=c>>>0;
    }
    crc32.table=table;
  }
  let c=0^(-1);
  for(let i=0;i<buf.length;i++) c=(c>>>8) ^ table[(c^buf[i])&0xFF];
  return (c^(-1))>>>0;
}

export function dateToDos(d=new Date()){
  const time = ((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
  const date = (((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|((d.getDate())&31);
  return {time,date};
}

export function buildZip(files){
  // files: [{name:string, data:Uint8Array}]
  const encoder = new TextEncoder();
  const localHeaders=[]; const central=[]; let offset=0; const chunks=[];
  const {time,date}=dateToDos(new Date());

  for(const f of files){
    const nameBytes = encoder.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); // local header sig
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method=store
    dv.setUint16(10, time, true);
    dv.setUint16(12, date, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra len
    lh.set(nameBytes, 30);

    chunks.push(lh, data);
    localHeaders.push({nameBytes,crc,size,offset});
    offset += lh.length + data.length;
  }

  const cdStart = offset;
  for(const h of localHeaders){
    const ce = new Uint8Array(46 + h.nameBytes.length);
    const dv = new DataView(ce.buffer);
    dv.setUint32(0, 0x02014b50, true); // central dir sig
    dv.setUint16(4, 20, true); // version made
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // method
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, h.crc, true);
    dv.setUint32(20, h.size, true);
    dv.setUint32(24, h.size, true);
    dv.setUint16(28, h.nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra len
    dv.setUint16(32, 0, true); // comment len
    dv.setUint16(34, 0, true); // disk start
    dv.setUint16(36, 0, true); // internal attr
    dv.setUint32(38, 0, true); // external attr
    dv.setUint32(42, h.offset, true); // local header offset
    ce.set(h.nameBytes, 46);
    chunks.push(ce);
    offset += ce.length;
    central.push(ce);
  }
  const cdSize = offset - cdStart;

  const eocd = new Uint8Array(22);
  const dv2 = new DataView(eocd.buffer);
  dv2.setUint32(0, 0x06054b50, true); // end of central dir
  dv2.setUint16(4, 0, true); // disk
  dv2.setUint16(6, 0, true); // disk start
  dv2.setUint16(8, localHeaders.length, true);
  dv2.setUint16(10, localHeaders.length, true);
  dv2.setUint32(12, cdSize, true);
  dv2.setUint32(16, cdStart, true);
  dv2.setUint16(20, 0, true); // comment len

  chunks.push(eocd);

  // concat
  let total=0; for(const c of chunks) total+=c.length;
  const out = new Uint8Array(total);
  let pos=0; for(const c of chunks){ out.set(c, pos); pos+=c.length; }
  return out;
}
