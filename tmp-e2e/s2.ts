import { makeCaller, makeJar } from "./h.ts";
const T=(await Bun.file("/tmp/e2e/token.txt").text()).trim();
const st=await Bun.file("/tmp/e2e/state.json").json();
const A=makeCaller("admin.functions.ts",{token:T});
const R=async(...a:any[])=>{for(let i=0;i<4;i++){const r:any=await (A as any)(...a); if(!r.__error) return r.result; await Bun.sleep(400);} throw new Error("admin falhou "+a[0]);};

// 1) Importação CSV (linhas)
console.log("import:", await R("importEmployees","POST",{rows:[
 {matricula:"E2E06",nome:"Fabio Alves",data_nascimento:"1991-09-09",data_admissao:"2016-04-04",setor:"Manutenção",cargo:"Técnico",ativo:true},
 {matricula:"E2E07",nome:"Gisele Prado",data_nascimento:"1993-12-12",data_admissao:"2019-05-05",setor:"Manutenção",cargo:"Técnica",ativo:true}]}));

// 2) Autoinscrição de 3 eleitores
const voters=[["E2E01","1985-03-10"],["E2E02","1990-07-22"],["E2E03","1988-11-02"]];
const sessions: Record<string, any> = {};
for(const [m,dn] of voters){
  const jar=makeJar(); const V=makeCaller("voter.functions.ts",{fetch:jar.fetch});
  const login:any=await V("voterLogin","POST",{identificador:m,dataNascimento:dn});
  const reg:any=await V("registerCandidacy","POST",{proposta:`Proposta de melhoria de segurança do candidato ${m}`,cargo:"Analista",setor:"Operação"});
  const mine:any=await V("getMyCandidacy","GET");
  console.log(m,"login",login.__error??"ok","| inscricao",reg.__error??"ok","| status",mine.result?.candidacy?.status);
  sessions[m]=jar;
}
await Bun.write("/tmp/e2e/cands.json", JSON.stringify((await R("listCandidates","GET",{electionId:st.eid}))));
console.log("candidatos:", (await R("listCandidates","GET",{electionId:st.eid})).map((c:any)=>[c.nome,c.status,c.origem]));
