import { makeCaller, makeJar } from "./h.ts";
const T=(await Bun.file("/tmp/e2e/token.txt").text()).trim();
const st=await Bun.file("/tmp/e2e/state.json").json();
const A=makeCaller("admin.functions.ts",{token:T});
const R=async(...a:any[])=>{for(let i=0;i<4;i++){const r:any=await (A as any)(...a); if(!r.__error) return r.result; await Bun.sleep(400);} throw new Error("falhou "+a[0]);};
let cands=await R("listCandidates","GET",{electionId:st.eid});
for(const c of cands.filter((c:any)=>c.status==="pending")) await R("upsertCandidate","POST",{id:c.id,election_id:st.eid,nome:c.nome,matricula:c.matricula,status:"approved",proposta:c.proposta,numero:c.nome.startsWith("Ana")?10:20});
cands=await R("listCandidates","GET",{electionId:st.eid});
const aprovados=cands.filter((c:any)=>c.status==="approved");
console.log("aprovados:",aprovados.map((c:any)=>c.nome));
const ana=aprovados.find((c:any)=>c.nome.startsWith("Ana")), bru=aprovados.find((c:any)=>c.nome.startsWith("Bruno"));
const votos:any[]=[["E2E01","1985-03-10",{tipo:"nominal",candidateId:ana.id}],["E2E02","1990-07-22",{tipo:"nominal",candidateId:ana.id}],
 ["E2E03","1988-11-02",{tipo:"nominal",candidateId:bru.id}],["E2E04","1992-01-15",{tipo:"nominal",candidateId:bru.id}],
 ["E2E05","1995-05-30",{tipo:"branco",candidateId:null}],["E2E06","1991-09-09",{tipo:"nulo",candidateId:null}]];
for(const [m,dn,v] of votos){
  const j=makeJar(); const Vt=makeCaller("voter.functions.ts",{fetch:j.fetch});
  await Vt("voterLogin","POST",{identificador:m,dataNascimento:dn});
  const r:any=await Vt("castVote","POST",v); const again:any=await Vt("castVote","POST",v);
  const b:any=await Vt("getVoterBallot","GET");
  console.log(m,"voto:",r.__error??"ok","| 2o bloqueado:",!!again.__error,"| hasVoted:",b.result?.hasVoted);
}
const j2=makeJar(); const Vb=makeCaller("voter.functions.ts",{fetch:j2.fetch}); let bloq="";
for(let i=0;i<7;i++){const r:any=await Vb("voterLogin","POST",{identificador:"E2E07",dataNascimento:"2000-01-01"}); if(String(r.__error).includes("Muitas tentativas")){bloq=`bloqueado na tentativa ${i+1}`;break;}}
console.log("forca bruta:",bloq||"NAO BLOQUEOU");
const live=await R("getElectionLiveMonitor","GET",{electionId:st.eid});
console.log("monitor:",{votos:live.totalVotos??live.total,comparecimento:live.comparecimento??live.totalTokens});
await R("setElectionStatus","POST",{id:st.eid,status:"counting"});
const res:any=await R("getElectionResults","GET",{electionId:st.eid});
console.log("apuracao:",res.ranking?.map((r:any)=>[r.nome,r.votos,r.classificacao,r.criterioDesempate??r.desempate??""]));
console.log("totais:",{brancos:res.brancos,nulos:res.nulos,validos:res.validos,abstencoes:res.abstencoes});
const pdf:any=await R("generateAtaPdf","POST",{electionId:st.eid,observacoes:"Ata gerada no teste E2E."});
console.log("pdf bytes:",(pdf.base64??pdf.pdfBase64??"").length>1000?"ok":pdf);
console.log("homologar resultado:", await R("homologateResult","POST",{id:st.eid}));
const aud:any=await R("listAuditEvents","GET",{page:0,pageSize:15});
console.log("auditoria:",(aud.items??aud.rows??aud).slice?.(0,8).map((e:any)=>e.acao));
