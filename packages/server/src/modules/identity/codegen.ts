const prefixes = { STUDENT: 'S', GUARDIAN: 'P', STAFF: 'STF', TEACHER: 'T' } as const;

function randDigits(n:number){ let s=''; for(let i=0;i<n;i++) s+=Math.floor(Math.random()*10); return s; }

export function makeLoginId(role:'STUDENT'|'GUARDIAN'|'STAFF'|'TEACHER'){
  return `${prefixes[role] ?? 'U'}${randDigits(6)}`;
}

export function randomSecret(n=12){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s=''; for(let i=0;i<n;i++) s+=c[Math.floor(Math.random()*c.length)]; return s;
}