process.env.TSS_SERVER_FN_BASE="http://localhost:8080/_serverFn/";
const {createClientRpc}=await import("@tanstack/start-client-core/client-rpc");
import {fnId} from "./h.ts";
const rpc:any=createClientRpc(fnId("admin.functions.ts","getElection"));
const T=(await Bun.file("/tmp/e2e/token.txt").text()).trim();
const f:any=async(u:string,i:any)=>{console.log("URL",u);return fetch(u,i)};
try{console.log(await rpc({method:"GET",data:{id:"2e1cfb83-a0ed-4247-9673-9d7b6e2d2a13"},headers:{Authorization:"Bearer "+T},fetch:f}))}catch(e:any){console.log("ERR",String(e.message).slice(0,200))}
