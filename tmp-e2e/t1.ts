import { makeCaller } from "./h.ts";
const T = (await Bun.file("/tmp/e2e/token.txt").text()).trim();
const A = makeCaller("admin.functions.ts", { token: T });
console.log(await A("getAdminContext"));
const el: any = await A("upsertElection","POST",{nome:"E2E — Teste pré-publicação",descricao:"Eleição de teste ponta a ponta",vagas_titulares:2,vagas_suplentes:1});
console.log("create", el);
