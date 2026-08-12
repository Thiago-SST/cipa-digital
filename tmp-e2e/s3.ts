import { makeCaller, makeJar } from "./h.ts";
const T=(await Bun.file("/tmp/e2e/token.txt").text()).trim();
const st=await Bun.file("/tmp/e2e/state.json").json();
const A=makeCaller("admin.functions.ts",{token:T});
const R=async(...a:any[])=>{for(let i=0;i<4;i++){const r:any=await (A as any)(...a); if(!r.__error) return r.result; await Bun.sleep(400);} throw new Error("admin falhou "+a[0]);};
const cands=await R("listCandidates","GET",{electionId:st.eid});
const byName=(n:string)=>cands.find((c:any)=>c.nome.startsWith(n));

// Impugnação por eleitor
const jar=makeJar(); const V=makeCaller("voter.functions.ts",{fetch:jar.fetch});
console.log("login E2E04:", (await V("voterLogin","POST",{identificador:"E2E04",dataNascimento:"1992-01-15"})).__error??"ok");
const sub:any=await V("submitChallenge","POST",{candidateId:byName("Carla").id,motivo:"Candidata não atende ao requisito de tempo mínimo previsto no edital."});
console.log("impugnacao:", sub.__error??"ok");
const painel:any=await V("getChallengePanel","GET");
console.log("painel publico exibe matricula?", JSON.stringify(painel.result?.candidates?.[0]??{}).includes("matricula"));
const chr:any=await R("listAllChallenges","GET",{electionId:st.eid}); const ch=Array.isArray(chr)?chr:(chr.items??chr.challenges??chr.rows??[]);
console.log("admin ve impugnacoes:", ch.length, ch[0]?.decisao);
console.log("julgar deferido:", await R("judgeChallenge","POST",{id:ch[0].id,decisao:"deferido",justificativa:"Procedente conforme edital."}));
console.log("status Carla apos deferimento:", (await R("listCandidates","GET",{electionId:st.eid})).find((c:any)=>c.nome.startsWith("Carla")).status);

// Homologar inscrições + abrir votação
console.log("homologar:", await R("homologateRegistrations","POST",{id:st.eid}));
console.log("status->voting:", await R("setElectionStatus","POST",{id:st.eid,status:"voting"}));
const aprovados=(await R("listCandidates","GET",{electionId:st.eid})).filter((c:any)=>c.status==="approved");
console.log("aprovados:", aprovados.map((c:any)=>c.nome));

// Votação: E2E01 e E2E02 empatam com 2 votos; teste branco e nulo
const ana=aprovados.find((c:any)=>c.nome.startsWith("Ana")), bru=aprovados.find((c:any)=>c.nome.startsWith("Bruno"));
const votos:any[]=[["E2E01","1985-03-10",{tipo:"nominal",candidateId:ana.id}],["E2E02","1990-07-22",{tipo:"nominal",candidateId:ana.id}],
 ["E2E03","1988-11-02",{tipo:"nominal",candidateId:bru.id}],["E2E04","1992-01-15",{tipo:"nominal",candidateId:bru.id}],
 ["E2E05","1995-05-30",{tipo:"branco",candidateId:null}],["E2E06","1991-09-09",{tipo:"nulo",candidateId:null}]];
for(const [m,dn,v] of votos){
  const j=makeJar(); const Vt=makeCaller("voter.functions.ts",{fetch:j.fetch});
  await Vt("voterLogin","POST",{identificador:m,dataNascimento:dn});
  const r:any=await Vt("castVote","POST",v);
  const again:any=await Vt("castVote","POST",v);
  const ballot:any=await Vt("getVoterBallot","GET");
  console.log(m,"voto:",r.__error??"ok","| 2o voto bloqueado:",!!again.__error,"| hasVoted:",ballot.result?.hasVoted);
}
// Força bruta
const j2=makeJar(); const Vb=makeCaller("voter.functions.ts",{fetch:j2.fetch});
let bloq="";
for(let i=0;i<7;i++){const r:any=await Vb("voterLogin","POST",{identificador:"E2E07",dataNascimento:"2000-01-01"}); if(String(r.__error).includes("Muitas tentativas")){bloq=`bloqueado na tentativa ${i+1}`;break;}}
console.log("forca bruta:", bloq||"NAO BLOQUEOU");
