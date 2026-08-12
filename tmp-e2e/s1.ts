import { makeCaller } from "./h.ts";
const T = (await Bun.file("/tmp/e2e/token.txt").text()).trim();
const A = makeCaller("admin.functions.ts", { token: T });
const R = async (...a: any[]) => { for (let i=0;i<4;i++){ const r:any = await (A as any)(...a); if (!r.__error) return r.result; await Bun.sleep(500);} throw new Error("falhou: "+JSON.stringify(a[0])); };
const eid = "2e1cfb83-a0ed-4247-9673-9d7b6e2d2a13";
const now = Date.now(), iso = (ms:number)=>new Date(ms).toISOString();
console.log("datas+vagas", await R("upsertElection","POST",{id:eid,nome:"E2E — Teste pré-publicação",descricao:"Eleição de teste ponta a ponta",
  data_inicio_inscricao:iso(now-864e5), data_fim_inscricao:iso(now+864e5),
  data_inicio_votacao:iso(now-36e5), data_fim_votacao:iso(now+2*864e5),
  vagas_titulares:2, vagas_suplentes:1}));
console.log("marcos", await R("updateElectionMilestones","POST",{id:eid,mandato_inicio:"2026-10-01",mandato_fim:"2027-09-30",data_posse:"2026-09-30"}));
console.log("status", await R("setElectionStatus","POST",{id:eid,status:"registration"}));
const e:any = await R("getElection","GET",{id:eid});
console.log("conferencia", {nome:e.nome,status:e.status,vt:e.vagas_titulares,vs:e.vagas_suplentes,ii:e.data_inicio_inscricao,fi:e.data_fim_inscricao,iv:e.data_inicio_votacao,fv:e.data_fim_votacao,mi:e.mandato_inicio,mf:e.mandato_fim,posse:e.data_posse, hom_insc:e.data_homologacao_inscricoes});
const emps = [["E2E01","Ana Souza","1985-03-10","2010-01-05"],["E2E02","Bruno Lima","1990-07-22","2015-06-01"],
  ["E2E03","Carla Dias","1988-11-02","2012-02-20"],["E2E04","Diego Reis","1992-01-15","2018-08-11"],["E2E05","Elis Nunes","1995-05-30","2020-03-02"]];
const ids: Record<string,string> = {};
for (const [m,n,dn,da] of emps) {
  const r:any = await R("upsertEmployee","POST",{matricula:m,nome:n,data_nascimento:dn,data_admissao:da,setor:"Operação",cargo:"Analista"});
  ids[m]=r.id; console.log("emp",m,r);
}
await Bun.write("/tmp/e2e/state.json", JSON.stringify({eid, emps: ids, birth: Object.fromEntries(emps.map(e=>[e[0],e[2]]))}));
